"""Small practical attached equipment and correct closed-surface normals for v5."""
import math
from mathutils import Vector

def apply_hardware(bpy):
 col=bpy.data.collections['01_TANK_EDITABLE'];body=bpy.data.objects['Suspension / isolated hull pitch and recoil'];turret=bpy.data.objects['Turret / aim controller'];steel=bpy.data.materials['FINAL / oiled steel'];edge=bpy.data.materials['FINAL / exposed armor edge']
 # Paint coordinates move with the sprung body, and with the recoiling barrel,
 # instead of sliding through its anchored world-space camouflage field.
 armor=bpy.data.materials['FINAL / worn multi-tone armor']
 for node in armor.node_tree.nodes:
  if node.type=='TEX_COORD':node.object=body
 barrel=bpy.data.objects['Gun barrel / recoil controller'];bpy.context.view_layer.update()
 ref=bpy.data.objects.new('V5 / barrel paint coordinates',None);col.objects.link(ref);ref.parent=barrel;ref.matrix_world=body.matrix_world.copy()
 barrel_paint=armor.copy();barrel_paint.name='V5 / coherent recoiling barrel paint'
 for node in barrel_paint.node_tree.nodes:
  if node.type=='TEX_COORD':node.object=ref
 for ob in barrel.children:
  if ob.type=='MESH':
   for index,mat in enumerate(ob.data.materials):
    if mat==armor:ob.data.materials[index]=barrel_paint

 def curve(name,points,radius,mat,parent):
  c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=1;c.bevel_depth=radius;c.bevel_resolution=2;sp=c.splines.new('POLY');sp.points.add(len(points)-1)
  for v,p in zip(sp.points,points):v.co=(*p,1)
  ob=bpy.data.objects.new(name,c);col.objects.link(ob);c.materials.append(mat);ob.parent=parent;return ob
 for row,z in enumerate([1.22,1.29]):
  points=[]
  for i in range(25):
   t=i/24;points.append((-1.18+2.36*t,-3.04-.035*math.sin(t*math.pi),z-.17*math.sin(t*math.pi)))
  curve('V5 / rear tow cable '+str(row),points,.016,steel,body)
  for side in [-1,1]:
   points=[(side*1.22+.065*math.cos(i*math.tau/24),-3.065,z+.058*math.sin(i*math.tau/24)) for i in range(25)]
   curve('V5 / towing eye',points,.014,edge,body)
 # A folded canvas roll with restrained irregular folds and two retaining straps.
 canvas=bpy.data.materials.new('V5 / weathered equipment canvas');canvas.use_nodes=True;p=canvas.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.075,.09,.057,1);p.inputs['Roughness'].default_value=.86
 n=canvas.node_tree.nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=100;n.inputs['Detail'].default_value=1;b=canvas.node_tree.nodes.new('ShaderNodeBump');b.inputs['Strength'].default_value=.18;b.inputs['Distance'].default_value=.0009;canvas.node_tree.links.new(n.outputs['Fac'],b.inputs['Height']);canvas.node_tree.links.new(b.outputs['Normal'],p.inputs['Normal'])
 verts=[];faces=[];nx=20;nr=24
 for j in range(nx+1):
  x=-.9+1.8*j/nx
  for k in range(nr):
   a=k*math.tau/nr;r=.17*(1+.045*math.sin(a*5+j*.9)+.025*math.cos(a*9-j*.7));verts.append((x,-1.22+math.cos(a)*r,.91+math.sin(a)*r*.9))
 for j in range(nx):
  for k in range(nr):a=j*nr+k;b=j*nr+(k+1)%nr;c=(j+1)*nr+(k+1)%nr;d=(j+1)*nr+k;faces.append((a,b,c,d))
 faces.extend([tuple(reversed(range(nr))),tuple(nx*nr+k for k in range(nr))]);me=bpy.data.meshes.new('V5 / canvas fold mesh');me.from_pydata(verts,[],faces);me.materials.append(canvas);ob=bpy.data.objects.new('V5 / secured canvas equipment roll',me);col.objects.link(ob);ob.parent=turret
 for face in me.polygons:face.use_smooth=True
 for x in [-.57,.57]:
  points=[(x,-1.22+math.cos(i*math.tau/32)*.175,.91+math.sin(i*math.tau/32)*.159) for i in range(33)]
  curve('V5 / canvas retaining strap',points,.014,steel,turret)
 # Higher angular resolution and flat end normals on prominent wheel hardware.
 # These small changes remove obvious low-poly bearing highlights in shot02.
 rounded=0
 for ob in list(col.objects):
  if ob.type!='MESH':continue
  if ob.name.startswith('Wheel axle cap'):radius,depth,axis=.113,.10,'Z'
  elif ob.name.startswith('Steel road wheel hub'):radius,depth,axis=.37*.46/.53,.08,'X'
  elif ob.name.startswith('Road wheel '):radius,depth,axis=.46,.40,'X'
  else:continue
  bevel=min(.014,depth*.15);segments=48;vertices=[];faces=[]
  profile=[(radius-bevel,-depth/2),(radius,-depth/2+bevel),(radius,depth/2-bevel),(radius-bevel,depth/2)]
  for r,z in profile:
   for k in range(segments):
    a=k*math.tau/segments;x=r*math.cos(a);y=r*math.sin(a);vertices.append((z,y,x) if axis=='X' else (x,y,z))
  for j in range(len(profile)-1):
   for k in range(segments):faces.append((j*segments+k,j*segments+(k+1)%segments,(j+1)*segments+(k+1)%segments,(j+1)*segments+k))
  faces.extend([tuple(reversed(range(segments))),tuple((len(profile)-1)*segments+k for k in range(segments))])
  me=bpy.data.meshes.new(ob.name+' / V5 circular hardware');me.from_pydata(vertices,[],faces)
  for m in ob.data.materials:me.materials.append(m)
  for poly in me.polygons:poly.use_smooth=len(poly.vertices)==4
  ob.data=me;rounded+=1
 # Recalculate only original/bounded closed mesh data. Open added wreck panels and
 # flat road ribbons have deliberately authored normals and must not be propagated.
 import bmesh
 processed=set();changed=0;flipped=0
 for ob in list(bpy.context.scene.objects):
  if ob.type!='MESH' or ob.data in processed:continue
  processed.add(ob.data)
  if ob.name.startswith('V5 /') and ob.name!='V5 / secured canvas equipment roll':continue
  bm=bmesh.new();bm.from_mesh(ob.data)
  if not bm.faces:bm.free();continue
  old=[f.normal.copy() for f in bm.faces];bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));count=sum(a.dot(f.normal)<0 for a,f in zip(old,bm.faces))
  if count:bm.to_mesh(ob.data);ob.data.update();changed+=1;flipped+=count
  bm.free()
 return {'closed_meshes_corrected':changed,'face_normals_corrected':flipped,'attached_detail_objects':9,'barrel_texture_reference':True,'canvas_extra_faces':nx*nr+2,'wheel_meshes_refined':rounded}
