import bpy,json,glob,os,math
from mathutils import Vector,Matrix
import bmesh
ROOT=os.getcwd(); results={}
def arr(v):return [float(x) for x in v]
def xyz(v):return dict(zip('xyz',arr(v)))
def bounds(v):return [Vector([min(p[i] for p in v) for i in range(3)]),Vector([max(p[i] for p in v) for i in range(3)])]
def canon(v):return Vector((v.x,v.z,-v.y))
def proxy(v,origin):
 lo,hi=bounds([canon(p-origin) for p in v]);return dict(width=hi.x-lo.x,height=hi.y-lo.y,depth=hi.z-lo.z,offset=xyz((lo+hi)/2))
def empty(name,pos,parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;o.location=pos;return o
for p in glob.glob('originals/newc42/fbx/**/*.fbx',recursive=True):
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=os.path.abspath(p))
 ident,width=('newc-leichttraktor',1.8) if 'Leichttraktor' in p else (('newc-pz3',2.0) if 'Pz-III' in p else ('newc-tiger',2.25))
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];tur=next(o for o in meshes if o.name=='Turret');gun=next(o for o in meshes if o.name in ['Gun','Barrel']);hull=[o for o in meshes if o not in [tur,gun]]
 # Neutralise identified side insignia palette faces (not body topology), preserving lights and tools.
 removed=[]
 for o in meshes:
  uv=o.data.uv_layers.active
  if not uv:continue
  for f in o.data.polygons:
   c=o.matrix_world@f.center;pal=int(uv.data[f.loop_indices[0]].uv.x*8)
   marking=(o.name=='Turret' and ident=='newc-leichttraktor' and 200<=f.index<=211) or (o.name=='Pz-VI-Tiger' and 760<=f.index<=770 and pal in [6,7]) or (o.name=='Pz-III-J' and 1187<=f.index<=1206 and pal in [6,7])
   if marking:
    for li in f.loop_indices:uv.data[li].uv=({'newc-leichttraktor':(.1739,.4691),'newc-tiger':(.2012,.3747),'newc-pz3':(.203,.4902)}[ident])
    removed.append([o.name,f.index])
 # Source connected components, not arbitrary clipping: longest gun-axis component is shaft.
 adj={v.index:set() for v in gun.data.vertices}
 for edge in gun.data.edges:
  a,b=edge.vertices;adj[a].add(b);adj[b].add(a)
 components=[];seen=set()
 for v in gun.data.vertices:
  if v.index in seen:continue
  todo=[v.index];group=[]
  while todo:
   k=todo.pop()
   if k in seen:continue
   seen.add(k);group.append(k);todo.extend(adj[k]-seen)
  components.append(group)
 shaft=max(components,key=lambda group:max((gun.matrix_world@gun.data.vertices[k].co).y for k in group)-min((gun.matrix_world@gun.data.vertices[k].co).y for k in group))
 original={o: [o.matrix_world@v.co for v in o.data.vertices] for o in meshes};lo,hi=bounds(sum([original[o] for o in hull],[]));scale=width/(hi.x-lo.x);center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
 def convert(v):
  v=(v-center)*scale;return Vector((-v.x,-v.y,v.z))
 tp=convert(tur.matrix_world.translation);gp=convert(gun.matrix_world.translation)
 coords={o:[convert(v) for v in vs] for o,vs in original.items()};gcoords=coords[gun];tip=max(v.y for v in gcoords);front=[v for v in gcoords if tip-v.y<.001];mp=sum(front,Vector())/len(front)
 # A gun's original hinge may be offset from the tube; preserve author pivot and measure muzzle from vertices.
 root=empty('TankRoot',(0,0,0));t=empty('TurretPivot',tp,root);e=empty('GunElevationPivot',gp-tp,t);r=empty('RecoilPivot',(0,0,0),e);m=empty('Muzzle',mp-gp,r)
 wheelRadii={}
 for i,o in enumerate(meshes):
  parent=r if o==gun else t if o==tur else root;origin=gp if o==gun else tp if o==tur else Vector()
  if o.name.startswith('Wheel'):
   wl,wh=bounds(coords[o]);origin=(wl+wh)/2;o.name='Wheel_'+str(i);wheelRadii[o.name]=max(wh.y-wl.y,wh.z-wl.z)/2
  o.parent=None;o.matrix_world=Matrix.Identity(4)
  for v,c in zip(o.data.vertices,coords[o]):v.co=c-origin
  o.parent=parent;o.location=origin-(gp if parent==r else tp if parent==t else Vector())
  if o==gun:o.name='GunMesh'
  elif o==tur:o.name='TurretMesh'
  for mat in o.data.materials:
   if mat and mat.use_nodes:
    bs=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
    if bs:bs.inputs['Roughness'].default_value=.82;bs.inputs['Metallic'].default_value=.12
 for image in bpy.data.images:
  if image.source=='FILE':image.filepath=os.path.join(os.path.dirname(os.path.abspath(p)),'colorAtlas.png');image.reload();image.pack()
 bpy.context.view_layer.update()
 # Shaft capsule and analytic swept mantlet envelope; all original gun vertices remain covered.
 shaftpoints=[canon(gcoords[k]-gp) for k in shaft];loS,hiS=bounds(shaftpoints)
 a=Vector(((loS.x+hiS.x)/2,(loS.y+hiS.y)/2,hiS.z));end=canon(mp-gp)
 axis=end-a;rad=max((v-(a+axis*max(0,min(1,(v-a).dot(axis)/axis.length_squared)))).length for v in shaftpoints)+1e-5
 rear=[canon(v-gp) for k,v in enumerate(gcoords) if k not in set(shaft)]
 swept=[canon(v-tp) for v in coords[tur]];bp=canon(gp-tp);low,high=map(math.radians,[-10,30])
 for v in rear:
  for recoil in [0,.15]:
   y,z=v.y,v.z+recoil
   angles=[low,high]
   for base in [math.atan2(-z,y),math.atan2(y,z)]:
    for k in range(-2,3):
     t=base+k*math.pi
     if low<=t<=high:angles.append(t)
   for t in angles:swept.append(bp+Vector((v.x,y*math.cos(t)-z*math.sin(t),y*math.sin(t)+z*math.cos(t))))
 loT,hiT=bounds(swept);loT-=Vector((1e-5,)*3);hiT+=Vector((1e-5,)*3)
 turretProxy=dict(width=hiT.x-loT.x,height=hiT.y-loT.y,depth=hiT.z-loT.z,offset=xyz((loT+hiT)/2))
 rig=dict(hullProxy=proxy(sum([coords[o] for o in hull],[]),Vector()),turretProxy=turretProxy,turretPivot=xyz(canon(tp)),barrelPivot=xyz(canon(gp-tp)),barrelCapsule=dict(radius=rad,start=xyz(a),end=xyz(end)),muzzleLocal=xyz(end))
 results[ident]=dict(id=ident,version=1,file='armor/'+ident+'.glb',gameScale=1,forward='-Z',up='+Y',sourceScale=scale,rig=rig,wheelNodes=[o.name for o in meshes if o.name.startswith('Wheel_')],wheelRadii=wheelRadii,capabilities=dict(turretYaw=True,gunElevation=True,recoil=True,wheelRotation=True,trackAnimation=False),license='CC0-1.0',visualStatus='offline-reviewed-low-poly-not-photoreal',validatedMotion=dict(elevationDegrees=[-10,30],recoil=[0,.15]),neutralizedMarkingFaces=removed,shaftSourceVertexCount=len(shaft))
 bpy.ops.export_scene.gltf(filepath=os.path.abspath('work/assets/armor/'+ident+'.glb'),export_format='GLB',export_yup=True,export_animations=False)
 bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath('evidence/armor/'+ident+'.blend'))
json.dump(results,open('evidence/armor/rig-measurements.json','w'),indent=2)
open('work/assets/armor/rigs.js','w').write('/** Measured game-scale Newc42 derivatives. Not historical dimensions. */\nconst deepFreeze=o=>{Object.values(o).forEach(v=>{if(v&&typeof v===\"object\")deepFreeze(v)});return Object.freeze(o)};\nexport const ARMOR_RIGS=deepFreeze('+json.dumps(results,indent=2)+');\n')
