"""Independent GLB binary, transformed geometry, UV, pivot, texture and budget check.
Python + numpy only. --write-manifest creates the measured handoff contract.
"""
import struct,json,hashlib,sys,math,os
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[2];OUT=Path(os.environ.get('ART_KIT_DIRECTORY',str(ROOT/'assets/art-kit')))
KEYS=['warehouse-sawtooth','pump-station','service-workshop','cargo-truck','sentry-turret']
ROOTS=['WarehouseSawtooth','PumpStation','ServiceWorkshop','CargoTruck','SentryTurret']
def load(path):
 b=path.read_bytes();assert struct.unpack_from('<4sII',b)==(b'glTF',2,len(b))
 n,t=struct.unpack_from('<II',b,12);assert t==0x4e4f534a;j=json.loads(b[20:20+n]);off=20+n;nb,t=struct.unpack_from('<II',b,off);assert t==0x004e4942
 return j,b[off+8:off+8+nb],b

def accessor(j,b,i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];cnt={'VEC3':3,'VEC2':2,'VEC4':4,'SCALAR':1}[a['type']];start=v.get('byteOffset',0)+a.get('byteOffset',0);sz=np.dtype(dt).itemsize;stride=v.get('byteStride',cnt*sz)
 return np.ndarray((a['count'],cnt),dtype=dt,buffer=b,offset=start,strides=(stride,sz)).copy()

def matrix(n):
 if 'matrix' in n:return np.array(n['matrix']).reshape(4,4).T
 m=np.eye(4);x,y,z,w=n.get('rotation',[0,0,0,1]);m[:3,:3]=[[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]];m[:3,:3]=m[:3,:3]@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0]);return m
entries=[]
for key,rootname in zip(KEYS,ROOTS):
 j,b,whole=load(OUT/(key+'.glb'));assert not j.get('extensionsRequired'),key+' decoder/extension dependency';assert all('uri' not in x for x in j.get('images',[])),key+' external image';assert all('uri' not in x for x in j.get('buffers',[])),key+' external buffer'
 names={n.get('name'):i for i,n in enumerate(j['nodes'])};assert rootname in names
 tris=0;draw=0;points=[];branch={};worlds={};facade_walls=[];facade_panels=[]
 def walk(i,parent):
  global tris,draw
  n=j['nodes'][i];m=parent@matrix(n);worlds[i]=m
  if 'mesh' in n:
   own=[]
   for p in j['meshes'][n['mesh']]['primitives']:
    assert p.get('mode',4)==4
    v=accessor(j,b,p['attributes']['POSITION']);assert np.isfinite(v).all();assert 'TEXCOORD_0' in p['attributes'];uv=accessor(j,b,p['attributes']['TEXCOORD_0']);assert np.isfinite(uv).all();nor=accessor(j,b,p['attributes']['NORMAL']);assert np.isfinite(nor).all()
    idx=accessor(j,b,p['indices']);assert idx.max()<len(v);tris+=len(idx)//3;draw+=1
    v=(m@np.column_stack((v,np.ones(len(v)))).T).T[:,:3];points.append(v);own.append(v)
    if key in KEYS[:3]:
     tri=v[idx.reshape(-1,3)];cross=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);area2=np.linalg.norm(cross,axis=1);centres=tri.mean(axis=1)
     forward=(cross[:,2]/np.maximum(area2,1e-12)<-.99)&(centres[:,1]>.4)&(centres[:,1]<2.75)&(centres[:,2]<-3.5)
     material=j['materials'][p['material']]['name']
     if material in ['Brick','Concrete']:
      for k in np.flatnonzero(forward):facade_walls.append((float(area2[k]),float(centres[k,2])))
     if material in ['Glass','SagePaint']:
      for k in np.flatnonzero(forward&(area2>.04)):facade_panels.append(float(centres[k,2]))
   branch[n['name']]=[np.vstack(own).min(0).tolist(),np.vstack(own).max(0).tolist()]
  for c in n.get('children',[]):walk(c,m)
 for i in j['scenes'][j.get('scene',0)]['nodes']:walk(i,np.eye(4))
 allv=np.vstack(points);lo=allv.min(0);hi=allv.max(0);dimensions=hi-lo
 assert lo[1]>-.025,(key,'below ground',lo)
 assert tris<30000,(key,'triangle budget',tris)
 assert len(j['materials'])<=14 and draw<=32
 assert len(whole)<3_000_000
 images=[]
 for im in j.get('images',[]):
  bv=j['bufferViews'][im['bufferView']];data=b[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']]
  assert im['mimeType']=='image/png';w,h=struct.unpack_from('>II',data,16);assert w<=512 and h<=512;images.append({'name':im.get('name'),'width':w,'height':h,'bytes':len(data)})
 entry={'assetKey':key,'file':key+'.glb','root':rootname,'sha256':hashlib.sha256(whole).hexdigest(),'bytes':len(whole),'triangles':tris,'drawPrimitives':draw,'materials':len(j['materials']),'embeddedTextures':images,'boundsMeters':[lo.tolist(),hi.tolist()],'dimensionsMeters':dimensions.tolist(),'rootPivotMeters':worlds[names[rootname]][:3,3].tolist()}
 if key in KEYS[:3]:
  assert np.max(np.abs(allv[:,[0,2]]))<=4.002,(key,'footprint overflow',lo,hi)
  assert hi[1]<=4.002
  assert facade_walls and facade_panels,(key,'missing measurable wall/panels')
  shell_z=max(facade_walls)[1];panel_z=min(facade_panels);relief=shell_z-panel_z
  assert relief>.02,(key,'window/shutter is buried behind opaque facade shell',shell_z,panel_z)
  entry['facadeReadability']={'wallFrontPlaneZ':shell_z,'panelFrontPlaneZ':panel_z,'visibleReliefMeters':relief}
  entry['collisionContract']={'kind':'box','width':8,'depth':8,'height':4,'origin':'base-centre','scaleToAuthoredGeometry':True,'facadeOverhangMeters':0,'notes':'All architectural detail contained inside collision footprint; roof shape is not a mesh collider.'};entry['recommendedScale']={'x':[.65,1.8],'y':[.7,1.25],'z':[.65,2 if key=='warehouse-sawtooth' else 1.8]}
 elif key=='cargo-truck':
  assert np.max(np.abs(allv[:,0]))<=.901 and np.max(np.abs(allv[:,2]))<=1.801 and hi[1]<=2.2
  entry['collisionContract']={'kind':'box','width':1.8,'depth':3.6,'height':2.2,'origin':'base-centre','routeClearance':{'width':2.2,'depth':4},'notes':'Combat and dynamic body use 1.8 x 3.6 x 2.2; content uses conservative 2.2 x 4 route envelope.'}
  entry['rig']={'wheels':['WheelLFront','WheelLRear','WheelRFront','WheelRRear'],'wheelSpinAxis':'local +X','wheelRadiusMeters':.36,'forward':'-Z'}
 else:
  required=['TurretYaw','GunPitch','Recoil','Muzzle','Shield'];assert all(n in names for n in required)
  assert names['GunPitch'] in j['nodes'][names['TurretYaw']]['children'];assert names['Recoil'] in j['nodes'][names['GunPitch']]['children'];assert names['Muzzle'] in j['nodes'][names['Recoil']]['children']
  radius=float(np.max(np.linalg.norm(allv[:,[0,2]],axis=1)))
  assert radius<=.801,(key,'neutral sweep overflows dynamic proxy',radius)
  # Exercise articulation extremes from the binary nodes, not source assumptions.
  import copy
  posed_max=radius
  for pitch in [-.08,0,.35]:
   for recoil in [0,.07]:
    nodes=copy.deepcopy(j['nodes']);nodes[names['GunPitch']]['rotation']=[math.sin(pitch/2),0,0,math.cos(pitch/2)];nodes[names['Recoil']]['translation']=[0,0,recoil]
    vv=[]
    def posewalk(i,parent):
     n=nodes[i];m=parent@matrix(n)
     if 'mesh' in n:
      for p in j['meshes'][n['mesh']]['primitives']:
       v=accessor(j,b,p['attributes']['POSITION']);vv.append((m@np.column_stack((v,np.ones(len(v)))).T).T[:,:3])
     for child in n.get('children',[]):posewalk(child,m)
    for ii in j['scenes'][j.get('scene',0)]['nodes']:posewalk(ii,np.eye(4))
    v=np.vstack(vv);posed_max=max(posed_max,float(np.max(np.linalg.norm(v[:,[0,2]],axis=1))))
    assert v[:,1].min()>=-.001 and v[:,1].max()<=2.2
  # Analytic continuous-pitch radial envelope: extrema of a*sin(t)+b*cos(t)
  # occur at interval endpoints or atan2(a,b)+k*pi. Recoil is linear, so
  # its convex radial norm is bounded by the two recoil endpoints.
  pitch_i=names['GunPitch'];inv=np.linalg.inv(worlds[pitch_i]);pitch_vertices=[]
  def gather(i):
   n=j['nodes'][i]
   if 'mesh' in n:
    for p in j['meshes'][n['mesh']]['primitives']:
     vv=accessor(j,b,p['attributes']['POSITION']);pitch_vertices.append((inv@worlds[i]@np.column_stack((vv,np.ones(len(vv)))).T).T[:,:3])
   for child in n.get('children',[]):gather(child)
  gather(pitch_i);base=np.vstack(pitch_vertices);origin=worlds[pitch_i][:3,3]
  for recoil in [0,.07]:
   v=base.copy();v[:,2]+=recoil # also moving jacket is conservative
   candidate=[np.full(len(v),-.08),np.full(len(v),.35)]
   turn=np.arctan2(v[:,1],v[:,2])
   for k in [-2,-1,0,1,2]:candidate.append(turn+k*math.pi)
   for theta in candidate:
    inside=(theta>=-.08)&(theta<=.35)
    if not inside.any():continue
    zz=origin[2]+np.sin(theta[inside])*v[inside,1]+np.cos(theta[inside])*v[inside,2];xx=origin[0]+v[inside,0]
    posed_max=max(posed_max,float(np.max(np.hypot(xx,zz))))
  assert posed_max<=.801,(key,'continuous articulated sweep overflows dynamic proxy',posed_max)
  entry['collisionContract']={'kind':'circle','radius':.8,'height':2.2,'origin':'base-centre','barrelVisualOverhang':False,'fullYawVisualSweepRadiusMeters':radius,'articulatedSweepRadiusMeters':posed_max,'sweepValidation':'analytic continuous pitch extrema, all yaw, recoil endpoints','notes':'Complete visual silhouette including the barrel stays inside radius .8 for all yaw, declared elevation and recoil extremes. No added collider. Use Muzzle for visual shot origin; combat remains authority.'}
  entry['rig']={'yaw':'TurretYaw','yawAxis':'local +Y','elevation':'GunPitch','elevationAxis':'local +X','recoil':'Recoil','recoilAxis':'local +Z','recoilRangeMeters':[0,.07],'muzzle':'Muzzle','optionalShield':'Shield','neutralMuzzleWorldMeters':worlds[names['Muzzle']][:3,3].tolist(),'elevationRangeRadians':[-.08,.35]}
 entries.append(entry)
 print(key, 'tris',tris,'draws',draw,'bytes',len(whole),'bounds',lo.round(4),hi.round(4))
manifest={'schema':1,'kit':'industrial-canal-20261028','provenance':'Original procedural Blender mesh and seeded raster surface authoring. No external assets, downloads or original tank changes. Existing tank used only as scale/style reference.','units':'metres','upAxis':'+Y','forwardAxis':'-Z','pivot':'base-centre','lighting':'Dynamic PBR; no scene lighting baked into textures','runtimeDependencies':'glTF 2.0 native loader only; PNG textures embedded; no Draco/Meshopt/KTX decoder','optimization':'Branch consolidation and material reuse applied in authoring; no glTF Transform installation was present, so no new package was installed. Meshes are uncompressed indexed triangles.','budget':{'maxTrianglesPerAsset':30000,'maxMaterialsPerAsset':14,'maxDrawPrimitivesPerAsset':32,'maxGLBBytes':3000000,'maxTextureDimension':512},'assets':entries,'source':['industrial-canal-kit.blend','../../scripts/art-kit/author_kit.py','../../scripts/art-kit/generate_textures.py'],'renders':'renders/*.png are genuine offline Blender renders of exported/re-imported GLBs, NOT browser/gameplay evidence'}
if '--write-manifest' in sys.argv:(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
else:
 saved=json.loads((OUT/'manifest.json').read_text());assert [(e['sha256'],e['triangles']) for e in saved['assets']]==[(e['sha256'],e['triangles']) for e in entries]
print('ART_KIT_VALIDATION_PASS')
