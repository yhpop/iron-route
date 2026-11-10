# Deterministic non-destructive adapter: source geometry retained, articulated by connected components.
import bpy,os,json,sys
from collections import defaultdict
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
out=os.path.abspath(args[0] if args else 'pz3-interceptor.glb')
os.makedirs(os.path.dirname(out),exist_ok=True)
original=[o for o in bpy.context.scene.objects if o.type=='MESH']
root=bpy.data.objects.new('PanzerIII',None);bpy.context.collection.objects.link(root)
def group(name,parent,position):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;o.location=position;return o
yaw=group('TurretYaw',root,(0,0,1.044));pitch=group('GunPitch',yaw,(0,.56,.182));recoil=group('Recoil',pitch,(0,0,0));group('Muzzle',recoil,(0,1.52,0))
def mat(name,col,metal,rough):
 m=bpy.data.materials.new(name);m.diffuse_color=(*col,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*col,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
paint=mat('Pz3 Weathered Grey Olive',(.21,.25,.19),.35,.68);rubber=mat('Pz3 Aged Track Steel',(.055,.065,.057),.55,.83);gun=mat('Pz3 Gun Steel',(.16,.18,.14),.55,.57)
for old in original:
 adj=defaultdict(set)
 for e in old.data.edges:a,b=e.vertices;adj[a].add(b);adj[b].add(a)
 seen=set();comps=[]
 for v in old.data.vertices:
  if v.index in seen:continue
  todo=[v.index];seen.add(v.index);c=[]
  while todo:
   i=todo.pop();c.append(i)
   for j in adj[i]:
    if j not in seen:seen.add(j);todo.append(j)
  comps.append(c)
 for i,ids in enumerate(comps):
  ids=set(ids);coords=[old.data.vertices[j].co.copy() for j in sorted(ids)];mapping={j:k for k,j in enumerate(sorted(ids))};faces=[[mapping[j] for j in f.vertices] for f in old.data.polygons if all(j in ids for j in f.vertices)]
  lo=Vector([min(p[a] for p in coords) for a in range(3)]);hi=Vector([max(p[a] for p in coords) for a in range(3)])
  wheel=old.name=='Plane.004' and (8<=i<=11 or 18<=i<=29);belt=old.name=='Plane.004' and i in [6,7]
  parent=root;pivot=Vector((0,0,.02));name=f'HullDetail_{i}';material=paint
  if old.name=='Plane.000':
   parent=yaw;pivot=Vector((0,0,.542));name=f'TurretDetail_{i}'
   if i in [2,4,5]:parent=recoil;pivot=Vector((0,.28,.633));name=f'GunDetail_{i}';material=gun
  elif wheel:
   pivot=(lo+hi)/2;parent=group('Wheel_'+str(i),root,tuple((pivot-Vector((0,0,.02)))*2));name='WheelMesh_'+str(i)
  elif belt:name='Belt_'+str(i);material=rubber
  m=bpy.data.meshes.new(name);m.from_pydata([tuple((p-pivot)*2) for p in coords],[],faces);m.update();obj=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(obj);obj.parent=parent;m.materials.append(material)
  # Keep low-poly source bevels rather than smoothing across armour edges.
  if wheel:
   for poly in m.polygons:poly.use_smooth=True
for o in list(bpy.context.scene.objects):
 if o==root or o.parent:continue
 bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.object.select_all(action='SELECT');bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_yup=True,export_materials='EXPORT',export_extras=True)
print('VEHICLE_EXPORTED',out)
