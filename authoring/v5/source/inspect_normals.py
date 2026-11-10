import bpy,bmesh,json
out=[]
for name in ['Sloped main armored hull','Sloped turret with cheek armor','Hull deck','03_ROAD_AND_DEBRIS / FINAL / rain-wet cracked asphalt','02_RUINED_CITY / CONCRETE / 0']:
 o=bpy.data.objects.get(name)
 if not o:continue
 bm=bmesh.new();bm.from_mesh(o.data);volume=bm.calc_volume(signed=True);old=[f.normal.copy() for f in bm.faces];bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));changed=sum(a.dot(f.normal)<0 for a,f in zip(old,bm.faces));out.append({'name':name,'faces':len(bm.faces),'signed_volume':volume,'normals_reversed_by_recalc':changed});bm.free()
print('NORMAL_AUDIT',json.dumps(out))
