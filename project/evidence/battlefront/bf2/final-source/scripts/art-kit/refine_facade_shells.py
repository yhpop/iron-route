"""One-time corrective mesh-data edit after pixel QA. Author script already reflects it.
Inset the wall shell behind the inset facade; retain all outer trim and pivots.
"""
import bpy
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/art-kit'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'industrial-canal-kit.blend'))
for key,name in [('warehouse-sawtooth','WarehouseSawtooth'),('pump-station','PumpStation'),('service-workshop','ServiceWorkshop')]:
 r=bpy.data.objects[name];o=next(o for o in r.children if o.type=='MESH');me=o.data
 adj=[[] for _ in me.vertices]
 for e in me.edges:a,b=e.vertices;adj[a].append(b);adj[b].append(a)
 seen=set();components=[]
 for i in range(len(adj)):
  if i in seen:continue
  stack=[i];seen.add(i);comp=[]
  while stack:
   v=stack.pop();comp.append(v)
   for n in adj[v]:
    if n not in seen:seen.add(n);stack.append(n)
  points=[o.matrix_world@me.vertices[j].co for j in comp];lo=Vector([min(v[a] for v in points) for a in range(3)]);hi=Vector([max(v[a] for v in points) for a in range(3)]);dim=hi-lo
  components.append((dim.x*dim.y*dim.z,comp,lo,hi))
 volume,comp,lo,hi=max(components,key=lambda c:c[0]);assert 7.7<hi.y-lo.y<7.8,(key,lo,hi)
 inv=o.matrix_world.inverted();factor=7.5/(hi.y-lo.y)
 for i in comp:
  p=o.matrix_world@me.vertices[i].co;p.y*=factor;me.vertices[i].co=inv@p
 me.update();print('SET_BACK_FACADE_SHELL',key,len(comp),factor)
 bpy.ops.object.select_all(action='DESELECT');r.select_set(True)
 for c in r.children_recursive:c.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(key+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_animations=False,export_extras=True,export_materials='EXPORT',export_image_format='AUTO',export_draco_mesh_compression_enable=False)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'industrial-canal-kit.blend'))
print('FACADE_REFINE_COMPLETE')
