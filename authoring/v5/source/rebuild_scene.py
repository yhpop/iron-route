import bpy,math,random,os,sys,json
from mathutils import Vector,Matrix,Euler
P=os.path.dirname(os.path.abspath(__file__));sys.path.insert(0,P)
from materials import make_materials
R=random.Random(41)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
s=bpy.context.scene;s.name='RUINED AVENUE / RECOVERED V4 / QA REQUIRED';s.frame_start=1;s.frame_end=720;s.render.fps=24
COL={}
for name in ['01_TANK_EDITABLE','02_RUINED_CITY','03_ROAD_AND_DEBRIS','04_BARRICADE','05_ANIMATED_FX','06_CAMERAS_AND_LIGHTS']:
 c=bpy.data.collections.new(name);s.collection.children.link(c);COL[name]=c
active=COL['01_TANK_EDITABLE']
root=bpy.data.objects.new('TANK / animated motion controller',None);active.objects.link(root)
body=bpy.data.objects.new('Suspension / isolated hull pitch and recoil',None);active.objects.link(body);body.parent=root
M=make_materials(root)
wall_family=[]
for i in range(5):m=M['wall'].copy();m.name='CONCRETE / '+str(i);wall_family.append(m)
brick=M['wall'].copy();brick.name='Exposed old brick';road_family=[]
for i in range(6):m=M['concrete'].copy();m.name='Road rubble family '+str(i);road_family.append(m)
def move(o):
 for c in list(o.users_collection):c.objects.unlink(o)
 active.objects.link(o)
def cube(name,loc,dim,mat,bevel=0,parent=None,rot=(0,0,0)):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=dim;o.rotation_euler=rot;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);move(o);o.data.materials.append(mat)
 if parent:o.parent=parent
 if bevel:b=o.modifiers.new('Manufactured edges','BEVEL');b.width=bevel;b.segments=2;o.modifiers.new('Weighted face normals','WEIGHTED_NORMAL')
 return o
def cyl(name,loc,r,dep,mat,parent=None,rot=(0,0,0),vertices=20):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=dep,location=loc,rotation=rot);o=bpy.context.object;o.name=name;move(o);o.data.materials.append(mat)
 if parent:o.parent=parent
 for p in o.data.polygons:p.use_smooth=True
 return o
def ico(name,loc,scale,mat,parent=None,sub=1):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;move(o);o.data.materials.append(mat)
 if parent:o.parent=parent
 for p in o.data.polygons:p.use_smooth=True
 return o
def beam(name,a,b,r,mat,parent=None):
 d=Vector(b)-Vector(a);o=cyl(name,(Vector(a)+Vector(b))/2,r,d.length,mat,parent,vertices=8);o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
batches={}
def box(loc,dim,mat,rot=(0,0,0)):
 key=(active.name,mat.name);v,f=batches.setdefault(key,([],[]));base=len(v);T=Matrix.Translation(Vector(loc))@Euler(rot).to_matrix().to_4x4()
 for x,y,z in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]:v.append(T@Vector((x*dim[0]/2,y*dim[1]/2,z*dim[2]/2)))
 f.extend(tuple(base+i for i in q) for q in [(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)])
def flush():
 for (cn,mn),(v,f) in batches.items():
  me=bpy.data.meshes.new(cn+' geometry');me.from_pydata(v,[],f);me.materials.append(bpy.data.materials[mn]);ob=bpy.data.objects.new(cn+' / '+mn,me);COL[cn].objects.link(ob)
 batches.clear()
# Reconstruct the procedural ruined avenue with the original seed and parameters.
active=COL['02_RUINED_CITY']
for side in [-1,1]:
 for y in range(-34,73,10):
  w=R.uniform(7.4,9.5);dep=R.uniform(6,10);floors=R.randint(2,6);front=side*9.8;center=side*(9.8+dep/2);mat=R.choice(wall_family)
  box((center,y,1.5),(dep-.5,w-.6,3),M['dark'])
  for floor in range(floors):
   z=floor*3.15;sd=dep*R.uniform(.63,1) if floor==floors-1 else dep;box((side*(9.8+sd/2),y,z+.22),(sd,w,.34),mat)
   for wy in [-w/2+.3,w/2-.3]:
    hh=R.uniform(1.1,2.9) if floor==floors-1 else 2.92;box((center,y+wy,z+hh/2+.4),(dep,.30,hh),mat)
   for j in range(5):
    yy=y-w/2+.4+j*(w-.8)/4
    if R.random()<(.40 if floor==floors-1 else .13):continue
    hh=R.uniform(.8,2.8) if floor==floors-1 else 2.8;box((front,yy,z+.4+hh/2),(.4,.38,hh),mat)
    if R.random()>.18:box((front,yy+.7,z+.75),(.4,1.25,.52),brick if R.random()<.25 else mat)
    if floor<floors-1 and R.random()>.3:box((front,yy+.7,z+2.87),(.38,1.3,.36),mat)
   if floor==floors-1:
    for j in range(5):box((front+side*.2,y+R.uniform(-w/2,w/2),z+R.uniform(.4,1.4)),(.035,.035,R.uniform(1.3,2.8)),M['metal'],(R.uniform(-.4,.4),R.uniform(-.35,.35),0))
  for j in range(3):
   yy=y+R.uniform(-w/2,w/2);xx=side*R.uniform(8,10);box((xx,yy,.5),(R.uniform(1,2.7),R.uniform(1.2,3),.25),mat,(R.uniform(-.2,.2),R.uniform(-.5,.5),R.random()*3))
active=COL['03_ROAD_AND_DEBRIS'];box((0,12,-.20),(19,130,.35),M['road'])
for side in [-1,1]:
 box((side*8.8,12,-.015),(2,128,.3),road_family[2])
 for y in range(-45,77,2):box((side*7.78,y,.17),(.20,1.9,.28),road_family[3])
 for j in range(640):
  x=side*R.uniform(6.2,10.5);y=R.uniform(-42,72);a=R.uniform(.10,.55);box((x,y,a*.45),(a*R.uniform(1,3),a*R.uniform(.8,2),a),R.choice(road_family),(R.random()*.8,R.random()*.7,R.random()*6.28))
 for j in range(90):
  x=side*R.uniform(2.5,7);y=R.uniform(-38,70);a=R.uniform(.05,.18);box((x,y,.05),(a*2,a,.08),road_family[R.randrange(5)],(0,0,R.random()*6.28))
for y in range(-42,75,5):box((0,y,.001),(.10,1.6,.015),M['road'])
for x in [-3.2,3.2]:box((x,10,.002),(.46,124,.009),M['road'])
# Preserve seeded downstream detail placement; the polygonal puddles remain deliberately omitted in v4.
for j in range(50):R.choice([-1,1]);R.uniform(3.3,7.1);R.uniform(-38,70);R.uniform(.3,1);R.uniform(.4,1.8)
for side in [-1,1]:
 for y in [-23,-3,17,40,60]:
  x=side*7.3;beam('Bent street light',(x,y,.1),(x+side*.2,y,5),.06,M['metal']);beam('Street light arm',(x+side*.2,y,5),(x-side*.7,y,5.35),.045,M['metal']);cube('Street light shade',(x-side*.8,y,5.3),(.6,.3,.16),M['dark'])
 for y in [-30,6,31,57]:
  x=side*8;beam('Bare tree trunk',(x,y,0),(x+.2,y+.1,4.8),.1,M['mud'])
  for j in range(7):
   z=R.uniform(1.7,4.5);end=(x+R.uniform(-1.3,1.3),y+R.uniform(-1.3,1.3),z+R.uniform(.5,1.6));beam('Bare tree branch',(x+.1,y,z),end,.035,M['mud'])
flush()
# Controlled existing-mesh damage and slight bevels; no heavy subdivision.
DR=random.Random(734)
for o in COL['03_ROAD_AND_DEBRIS'].objects:
 if o.type=='MESH' and 'Road rubble' in o.name:
  for offset in range(0,len(o.data.vertices),8):
   vs=[o.data.vertices[i] for i in range(offset,min(offset+8,len(o.data.vertices)))];dims=[max(v.co[k] for v in vs)-min(v.co[k] for v in vs) for k in range(3)]
   if max(dims)>4:continue
   for v in vs:
    for k in range(3):v.co[k]+=DR.uniform(-.12,.12)*dims[k]
  b=o.modifiers.new('Chipped rubble edges','BEVEL');b.width=.027;b.segments=1
DR=random.Random(829);broken=0
for o in COL['02_RUINED_CITY'].objects:
 if o.type!='MESH':continue
 for offset in range(0,len(o.data.vertices),8):
  vs=[o.data.vertices[i] for i in range(offset,min(offset+8,len(o.data.vertices)))];lo=[min(v.co[k] for v in vs) for k in range(3)];hi=[max(v.co[k] for v in vs) for k in range(3)];d=[hi[k]-lo[k] for k in range(3)];cx=(lo[0]+hi[0])/2
  if min(d[:2])<.65 and .8<d[2]<3.3 and DR.random()<.36:
   for v in vs:
    if abs(v.co.z-hi[2])<.005:v.co.z-=DR.uniform(.10,.45)*d[2];v.co.x+=DR.uniform(-.075,.075);v.co.y+=DR.uniform(-.075,.075)
   broken+=1
  elif d[2]<.45 and d[0]>3 and d[1]>5 and DR.random()<.24:
   fx=lo[0] if cx>0 else hi[0]
   for v in vs:
    if abs(v.co.x-fx)<.01:v.co.x+=math.copysign(DR.uniform(.12,.7),cx);v.co.y+=DR.uniform(-.28,.28)
   broken+=1
# Far extension prevents the reverse shot from revealing an empty world edge.
for cn in ['02_RUINED_CITY','03_ROAD_AND_DEBRIS']:
 for o in list(COL[cn].objects):
  if o.type=='MESH':cp=o.copy();cp.data=o.data;cp.name='Distant continuation / '+o.name;cp.location.y-=110;COL[cn].objects.link(cp)
# Main tank hull, now with grounded track assembly and a separate suspended body.
active=COL['01_TANK_EDITABLE'];verts=[(-1.52,-2.9,.72),(1.52,-2.9,.72),(1.52,2.95,.72),(-1.52,2.95,.72),(-1.67,-2.65,1.52),(1.67,-2.65,1.52),(1.48,2.15,1.68),(-1.48,2.15,1.68)]
me=bpy.data.meshes.new('Sloped hull mesh');me.from_pydata([(x*1.04,y,z) for x,y,z in verts],[],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]);me.materials.append(M['armor']);o=bpy.data.objects.new('Sloped main armored hull',me);active.objects.link(o);o.parent=body
cube('Lower suspension chassis',(0,-.05,.75),(2.8,5.6,.65),M['rubber'],.13,body);cube('Hull deck',(0,-.15,1.60),(3.35*1.04,5.55,.20),M['armor'],.06,body)
def travel_driver(o,property,index,expression):
 d=o.driver_add(property,index).driver;v=d.variables.new();v.name='travel';v.type='TRANSFORMS';v.targets[0].id=root;v.targets[0].transform_type='LOC_Y';v.targets[0].transform_space='LOCAL_SPACE';d.expression=expression
L=8.8+math.tau*.64;A=4.4;B=A+math.pi*.64;C=B+4.4
for side in [-1,1]:
 for j in range(6):
  y=-1.975+j*.79;w=cyl('Road wheel %s %d'%(side,j),(side*1.65,y,.68),.46,.40,M['rubber'],root,(0,math.pi/2,0),24);h=cyl('Steel road wheel hub',(side*1.88,y,.68),.37*.46/.53,.08,M['edge'],root,(0,math.pi/2,0),24)
  for wheel in [w,h]:bpy.context.view_layer.objects.active=wheel;wheel.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);wheel.select_set(False);travel_driver(wheel,'rotation_euler',0,'-(travel+20)/.46')
  cyl('Wheel axle cap',(side*1.94,y,.68),.113,.10,M['metal'],root,(0,math.pi/2,0),16)
  for k in range(8):a=k*math.tau/8;cyl('Wheel hub fastener',(side*.08,math.sin(a)*.19,math.cos(a)*.19),.022,.025,M['edge'],h,(0,math.pi/2,0),6)
 for y in [-2.4,2.4]:cyl('End idler sprocket',(side*1.65,y,.97),.395,.395,M['metal'],root,(0,math.pi/2,0),16)
 for j in range(56):
  link=cube('Tread link %s %02d'%(side,j),(side*1.68,0,0),(.65,L/56*.90,.12),M['metal'],parent=root);link['belt_position']=j*L/56;d=link.driver_add('["belt_position"]').driver;v=d.variables.new();v.name='travel';v.type='TRANSFORMS';v.targets[0].id=root;v.targets[0].transform_type='LOC_Y';v.targets[0].transform_space='LOCAL_SPACE';d.expression=f'({j*L/56:.6f}-(travel+20))%{L:.6f}'
  for prop,idx,expr in [('location',1,f'-2.2+t if t<4.4 else 2.2+.64*cos(-pi/2+(t-4.4)/.64) if t<{B:.6f} else 2.2-(t-{B:.6f}) if t<{C:.6f} else -2.2+.64*cos(pi/2+(t-{C:.6f})/.64)'),('location',2,f'.17 if t<4.4 else .81+.64*sin(-pi/2+(t-4.4)/.64) if t<{B:.6f} else 1.45 if t<{C:.6f} else .81+.64*sin(pi/2+(t-{C:.6f})/.64)'),('rotation_euler',0,f'0 if t<4.4 else (t-4.4)/.64 if t<{B:.6f} else pi if t<{C:.6f} else pi+(t-{C:.6f})/.64')]:
   dr=link.driver_add(prop,idx).driver;v=dr.variables.new();v.name='t';v.type='SINGLE_PROP';v.targets[0].id=link;v.targets[0].data_path='["belt_position"]';dr.expression=expr
  cube('Track / traction rubber pad',(0,0,-.075),(.41,.17,.035),M['rubber'],.006,link);cyl('Track / hinge pin',(0,.1,.015),.024,.69,M['metal'],link,(0,math.pi/2,0),8)
 for j in range(5):
  cube('Side skirt armor',(side*1.99,-2.1+j*1.05,1.33),(.12,1,.55),M['armor'],.035,body,(0,side*.08,0))
  for yy in [-.38,.38]:cyl('Skirt bolt',(side*2.07,-2.1+j*1.05+yy,1.48),.025,.035,M['metal'],body,(0,math.pi/2,0),8)
 cube('Rear mud flap',(side*1.71,-2.97,.63),(.67,.12,.8),M['rubber'],.02,body)
 for y in [-2.3,-1.3,-.3,.7,1.7]:cube('Skirt raised seam',(side*2.075,y,1.3),(.018,.025,.48),M['edge'],.004,body)
 for j in range(9):cube('Rear radiator slat',(side*.70,-2.95,.91+j*.066),(.94,.035,.028),M['metal'],.004,body)
 for y in [-1.8,-.8,.2,1.2]:cube('Hull deck grab rail',(side*1.53,y,1.78),(.038,.35,.045),M['metal'],.008,body)
 for y in [2.12,2.42]:cube('Glacis segmented applique',(side*.72,y,1.48),(.72,.30,.06),M['armor'],.008,body)
for j in range(11):cube('Engine cooling grille',(0,-2.04+j*.105,1.735),(1.92,.045,.045),M['metal'],.005,body)
for x in [-1.25,1.25]:cube('Front headlight housing',(x,2.28,1.4),(.35,.20,.19),M['edge'],.025,body);cube('Headlight glass',(x,2.395,1.4),(.23,.018,.10),M['glass'],.01,body);beam('Front towing shackle',(x-.1,2.65,.8),(x+.1,2.65,.8),.055,M['metal'],body)
tr=bpy.data.objects.new('Turret / aim controller',None);active.objects.link(tr);tr.parent=body;tr.location=(0,.12,1.75);tr.scale=(1.10,1.12,1)
cyl('Turret ring',(0,0,0),1.25,.18,M['metal'],tr)
vv=[(-1.23,-1.15,0),(1.23,-1.15,0),(1.38,.83,0),(.74,1.55,0),(-.74,1.55,0),(-1.38,.83,0),(-1,-1,.85),(1,-1,.85),(1.09,.7,.77),(.7,1.13,.6),(-.7,1.13,.6),(-1.09,.7,.77)]
me=bpy.data.meshes.new('Turret armor');me.from_pydata(vv,[],[(0,5,4,3,2,1),(6,7,8,9,10,11)]+[(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)]);me.materials.append(M['armor']);o=bpy.data.objects.new('Sloped turret with cheek armor',me);active.objects.link(o);o.parent=tr
for side in [-1,1]:
 cube('Turret reactive cheek',(side*.95,.79,.48),(.63,1.1,.45),M['armor'],.06,tr,(0,side*.2,side*-.27));cube('Turret stowage bin',(side*1.20,-.46,.5),(.36,1.12,.45),M['armor'],.03,tr)
 for j in range(4):cyl('Smoke grenade launcher',(side*1.42,.36-j*.20,.57),.065,.24,M['metal'],tr,(0,side*.8,0),12)
 for y in [-.65,-.2,.25,.70]:cyl('Turret armor bolt',(side*1.32,y,.46),.023,.025,M['edge'],tr,(0,math.pi/2,0),6)
barrel=bpy.data.objects.new('Gun barrel / recoil controller',None);active.objects.link(barrel);barrel.parent=tr
cyl('Gun mantlet',(0,1.15,.40),.30,.65,M['armor'],barrel,(math.pi/2,0,0));cyl('Main gun tube',(0,3.42,.42),.105,4.2,M['armor'],barrel,(math.pi/2,0,0));cyl('Barrel fume extractor',(0,2.95,.42),.16,.62,M['armor'],barrel,(math.pi/2,0,0));cyl('Gun muzzle',(0,5.56,.42),.13,.28,M['metal'],barrel,(math.pi/2,0,0));cyl('Dark bore opening',(0,5.706,.42),.092,.012,M['dark'],barrel,(math.pi/2,0,0))
for y in [1.55,2.10,3.55,4.2,4.8]:cyl('Barrel reinforcement ring',(0,y,.42),.12,.085,M['metal'],barrel,(math.pi/2,0,0),24)
for x,y in [(-.54,-.36),(.55,0)]:cyl('Crew hatch',(x,y,.91),.36,.12,M['armor'],tr,vertices=24);cube('Hatch handle',(x,y,1.01),(.18,.075,.05),M['metal'],.02,tr)
for j in range(4):cube('Commander periscope',(.55+math.cos(j*math.pi/2)*.29,math.sin(j*math.pi/2)*.29,1.01),(.17,.1,.09),M['glass'],.01,tr)
beam('Radio antenna',(-.92,-.76,.7),(-.96,-.8,2.25),.012,M['metal'],tr);cyl('Roof MG mount',(-.48,-.28,1.1),.08,.35,M['metal'],tr);cube('Roof machine gun receiver',(-.48,-.05,1.24),(.17,.45,.14),M['metal'],.02,tr);cyl('Roof machine gun barrel',(-.48,.44,1.24),.034,.6,M['metal'],tr,(math.pi/2,0,0),12)
cube('Commander optical housing',(.54,0,1.13),(.3,.34,.3),M['armor'],.025,tr);cube('Commander optical aperture',(.54,.182,1.15),(.22,.023,.13),M['glass'],.004,tr);cube('Gunner sight box',(-.62,.52,.96),(.32,.37,.26),M['armor'],.02,tr);cube('Gunner sight optical aperture',(-.62,.716,.96),(.23,.025,.14),M['glass'],.004,tr)
for name in ['Sloped main armored hull','Sloped turret with cheek armor']:
 ob=bpy.data.objects[name];ob.data.materials.append(M['edge']);b=ob.modifiers.new('Subtle exposed edge wear','BEVEL');b.width=.022;b.segments=2;b.material=1;ob.modifiers.new('Armor face normals','WEIGHTED_NORMAL')
# Remaining scene sections are in a separate source file to keep restoration auditable.
exec(compile(open(P+'/animation_and_fx.py').read(),P+'/animation_and_fx.py','exec'))
