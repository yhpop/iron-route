import bpy,json,struct,hashlib,math
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[3];A=R/'evidence/ruined-depot/asset';IDS={'workshop':'polySurface1011','broken-corner':'polySurface773','window-wall':'polySurface806'}
def uvhash(o,name):return hashlib.sha256(json.dumps([list(v.uv)for v in o.data.uv_layers[name].data]).encode()).hexdigest()
source={}
for id,name in IDS.items():
 o=bpy.data.objects[name];p=[o.matrix_world@v.co for v in o.data.vertices];lo=Vector([min(v[k]for v in p)for k in range(3)]);hi=Vector([max(v[k]for v in p)for k in range(3)]);c=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z));source[id]={'coordinates':[(v-c)*.8 for v in p],'polygons':[list(f.vertices)for f in o.data.polygons],'uv':{n:uvhash(o,n)for n in ['UV1','UV2']}}
bpy.ops.wm.open_mainfile(filepath=str(A/'ruins-baked-preserved-uv.blend'),use_scripts=False)
b=(R/'work/assets/ruined-depot/ruins.glb').read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);binary=b[28+n:]
def access(i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];types={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4};fmt={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']];k=types[a['type']];stride=v.get('byteStride',struct.calcsize('<'+fmt*k));start=v.get('byteOffset',0)+a.get('byteOffset',0);return [struct.unpack_from('<'+fmt*k,binary,start+q*stride)for q in range(a['count'])]
def unique(p):return {tuple(round(float(x),5)for x in v)for v in p}
result={'modules':{}};atlasTriangles=[]
for id in IDS:
 o=bpy.data.objects[id];s=source[id];assert [list(f.vertices)for f in o.data.polygons]==s['polygons'];assert all((a.co-b).length<1e-6 for a,b in zip(o.data.vertices,s['coordinates']));assert all(uvhash(o,key)==value for key,value in s['uv'].items());o.data.calc_loop_triangles();uv=o.data.uv_layers['DepotAtlas'];area=0;worldarea=0;densities=[]
 for tri in o.data.loop_triangles:
  a,c,d=[uv.data[k].uv for k in tri.loops];atlasTriangles.append([(float(t.x),float(t.y))for t in [a,c,d]]);varea=abs((c.x-a.x)*(d.y-a.y)-(c.y-a.y)*(d.x-a.x))/2;warea=tri.area;area+=varea;worldarea+=warea
  if warea>1e-9:densities.append(math.sqrt(varea/warea)*2048)
 node=next(x for x in j['nodes']if x['name']==id);primitives=j['meshes'][node['mesh']]['primitives'];positions=[v for p in primitives for v in access(p['attributes']['POSITION'])];runtime=[(p.x,p.z,-p.y)for p in s['coordinates']];assert unique(positions)==unique(runtime)
 result['modules'][id]={'sourceVertexCount':len(s['coordinates']),'sourcePolygonCount':len(s['polygons']),'sourceTriangleCount':len(o.data.loop_triangles),'allVertexCoordinatesPreserved':True,'allPolygonIndicesPreserved':True,'originalUVHashesPreserved':s['uv'],'exportedUniquePositionsMatchSource':True,'surfaceAreaM2':worldarea,'atlasUVArea':area,'meanAreaTexelsPerMetre':math.sqrt(area/worldarea)*2048,'minMaxTriangleTexelsPerMetre':[min(densities),max(densities)],'runtimeBounds':{'min':[min(p[k]for p in positions)for k in range(3)],'max':[max(p[k]for p in positions)for k in range(3)],'size':[max(p[k]for p in positions)-min(p[k]for p in positions)for k in range(3)]}}
def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def overlap_area(subject,clip):
 if cross(*clip)<0:clip=list(reversed(clip))
 out=list(subject)
 for a,b in zip(clip,clip[1:]+clip[:1]):
  inp=out;out=[]
  if not inp:break
  prev=inp[-1];dp=cross(a,b,prev)
  for curr in inp:
   dc=cross(a,b,curr)
   if (dc>=0)!=(dp>=0):
    ratio=dp/(dp-dc);out.append((prev[0]+ratio*(curr[0]-prev[0]),prev[1]+ratio*(curr[1]-prev[1])))
   if dc>=0:out.append(curr)
   prev=curr;dp=dc
 return abs(sum(a[0]*b[1]-a[1]*b[0]for a,b in zip(out,out[1:]+out[:1])))/2 if len(out)>2 else 0
boxes=[(min(v[0]for v in t),min(v[1]for v in t),max(v[0]for v in t),max(v[1]for v in t))for t in atlasTriangles];overlaps=[]
for i,t in enumerate(atlasTriangles):
 for k in range(i+1,len(atlasTriangles)):
  a=boxes[i];b=boxes[k]
  if a[2]<=b[0]or b[2]<=a[0]or a[3]<=b[1]or b[3]<=a[1]:continue
  area=overlap_area(t,atlasTriangles[k])
  if area>1e-8:overlaps.append({'triangles':[i,k],'uvArea':area})
result['atlasOverlapCheck']={'positiveAreaIntersectionsAbove1eMinus8':overlaps,'trianglePairsChecked':len(atlasTriangles)*(len(atlasTriangles)-1)//2};(A/'atlas-overlap-diagnostic.json').write_text(json.dumps(result['atlasOverlapCheck'],indent=2));assert not overlaps
result['totalAtlasCoverage']=sum(x['atlasUVArea']for x in result['modules'].values());result['images']=j['images'];result['materials']=j['materials'];(A/'geometry-uv-audit.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
