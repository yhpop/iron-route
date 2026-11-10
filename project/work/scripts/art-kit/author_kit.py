"""Original industrial canal art kit. Blender 4.3, no downloads or add-ons.
Run: blender -b --factory-startup --python scripts/art-kit/author_kit.py
Coordinates: Blender metres Z-up / +Y forward -> glTF Y-up / -Z forward.
"""
import bpy, math, random, json, hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]; OUT=ROOT/'assets/art-kit'; TEX=OUT/'textures'
random.seed(20261028)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.materials):bpy.data.materials.remove(d)
S=bpy.context.scene;S.unit_settings.system='METRIC';S.unit_settings.scale_length=1
M={}
def mat(name,color,rough=.75,metal=0,tex=None):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 if tex:
  n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=bpy.data.images.load(str(TEX/f'{tex}_base.png'),check_existing=True);n.image.pack();m.node_tree.links.new(n.outputs['Color'],p.inputs['Base Color'])
  n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=bpy.data.images.load(str(TEX/f'{tex}_orm.png'),check_existing=True);n.image.colorspace_settings.name='Non-Color';n.image.pack();sep=m.node_tree.nodes.new('ShaderNodeSeparateColor');m.node_tree.links.new(n.outputs['Color'],sep.inputs['Color']);m.node_tree.links.new(sep.outputs['Green'],p.inputs['Roughness'])
 M[name]=m;return m
mat('Concrete',(0.5,.47,.4),tex='warm_concrete');mat('Brick',(.49,.27,.17),tex='clay_brick');mat('SagePaint',(.28,.36,.3),tex='paint_sage');mat('OchrePaint',(.52,.35,.12),tex='paint_ochre');mat('ZincRoof',(.18,.22,.22),metal=.25,tex='roof_zinc');mat('Canvas',(.49,.47,.36),tex='canvas');mat('Steel',(.17,.21,.2),.48,.68);mat('DarkSteel',(.055,.07,.07),.6,.6);mat('Rubber',(.022,.026,.025),.93);mat('Glass',(.054,.12,.14),.2,.32);mat('Ivory',(.72,.7,.58),.63);mat('Lamp',(.87,.72,.39),.3,.12);mat('RedLamp',(.46,.055,.023),.37);mat('Asphalt',(.1,.11,.1),tex='asphalt')
PARENT=None

def applymat(o,material):o.data.materials.append(M[material]);return o

def mesh(name,verts,faces,material,bevel=0,parent=None):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);S.collection.objects.link(o);applymat(o,material);o.parent=parent or PARENT
 if bevel:add_bevel(o,bevel)
 return o

def add_bevel(o,w=.035,segments=2):
 mo=o.modifiers.new('Manufactured edge radius','BEVEL');mo.width=w;mo.segments=1 if w<=.012 else segments
 mo.affect='EDGES';mo.limit_method='ANGLE'
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 bpy.ops.object.modifier_apply(modifier=mo.name)
 for p in o.data.polygons:p.use_smooth=True
 no=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');no.keep_sharp=True;no.weight=30
 try:bpy.ops.object.modifier_apply(modifier=no.name)
 except:pass
 o.select_set(False)

def cube(name,loc,size,ma,bev=.025,parent=None):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);applymat(o,ma);o.parent=parent or PARENT
 if bev:add_bevel(o,bev)
 o.select_set(False);return o

def cyl(name,loc,r,depth,ma,vertices=24,axis='Z',r2=None,parent=None,bev=.015):
 bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=r if r2 is None else r2,depth=depth,location=loc);o=bpy.context.object;o.name=name
 if axis=='Y':o.rotation_euler.x=math.pi/2
 elif axis=='X':o.rotation_euler.y=math.pi/2
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);applymat(o,ma);o.parent=parent or PARENT
 if bev:add_bevel(o,bev)
 for p in o.data.polygons:p.use_smooth=len(p.vertices)==4
 o.select_set(False);return o

def tube(name,a,b,r,ma,parent=None,vertices=12):
 a,b=Vector(a),Vector(b);o=cyl(name,(a+b)/2,r,(b-a).length,ma,vertices,parent=parent,bev=min(.012,r*.15));o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o

def extrude_x(name,profile,w,ma,bev=.03,parent=None):
 v=[(x,y,z) for x in [-w/2,w/2] for y,z in profile];n=len(profile);f=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 return mesh(name,v,f,ma,bev,parent)

def empty(name,loc=(0,0,0),parent=None):
 o=bpy.data.objects.new(name,None);S.collection.objects.link(o);o.location=loc;o.parent=parent;return o

def text(name,body,loc,size,ma,rotation=(math.pi/2,0,math.pi),parent=None):
 c=bpy.data.curves.new(name,'FONT');c.body=body;c.size=size;c.align_x='CENTER';c.extrude=.001;c.resolution_u=2
 o=bpy.data.objects.new(name,c);S.collection.objects.link(o);o.location=loc;o.rotation_euler=rotation;o.parent=parent or PARENT;c.materials.append(M[ma]);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);return o

def uv(o,tile=2):
 if o.type!='MESH':return
 layer=o.data.uv_layers.new(name='SurfaceUV') if not o.data.uv_layers else o.data.uv_layers.active
 for p in o.data.polygons:
  n=p.normal;ax=max(range(3),key=lambda i:abs(n[i]));coords=[i for i in range(3) if i!=ax]
  for li in p.loop_indices:
   v=o.matrix_world @ o.data.vertices[o.data.loops[li].vertex_index].co;layer.data[li].uv=(v[coords[0]]/tile,v[coords[1]]/tile)

def window_front(name,x,y,z,w,h):
 cube(name+' recess',(x,y,z),(w+.15,.065,h+.15),'DarkSteel',.02)
 cube(name+' glazing',(x,y+.038,z),(w,.024,h),'Glass',.01)
 for xx in [x-w/2,x,x+w/2]:cube(name+' mullion',(xx,y+.064,z),(.045,.055,h+.09),'Steel',.007)
 for zz in [z-h/2,z,z+h/2]:cube(name+' transom',(x,y+.065,zz),(w+.09,.06,.045),'Steel',.007)
 cube(name+' sill',(x,y+.075,z-h/2-.09),(w+.26,.18,.12),'Concrete',.015)

def shutter(name,x,y,z,w,h):
 cube(name+' frame',(x,y,z),(w+.2,.11,h+.2),'Concrete',.025);cube(name+' door',(x,y+.065,z),(w,.05,h),'SagePaint',.02)
 for i in range(int(h/.15)):cube(name+' roll seam',(x,y+.098,z-h/2+i*.15),(w-.04,.025,.022),'Steel',.005)
 for xx in [x-w*.44,x+w*.44]:cube(name+' guide',(xx,y+.12,z),(.055,.06,h),'DarkSteel',.008)
 cube(name+' pull',(x,y+.14,z-h*.3),(.33,.05,.035),'Steel',.006)

def vent(loc,w=1,d=.8):
 x,y,z=loc;cube('Rooftop exhaust curb',(x,y,z),(w,d,.15),'Concrete');cube('Folded exhaust housing',(x,y,z+.2),(w*.86,d*.83,.3),'ZincRoof',.04)
 for i in range(7):cube('Exhaust louver',(x,y-d*.42,z+.12+i*.035),(w*.72,.035,.014),'DarkSteel',.003)

def foundations():
 cube('Continuous plinth',(0,0,.16),(8,8,.32),'Concrete',.055)
 for x in [-3.88,3.88]:
  for y in [-3.88,0,3.88]:cube('Pilaster',(x,y,1.65),(.23,.23,3.05),'Concrete',.028)

def building(which):
 global PARENT
 root=empty({'warehouse-sawtooth':'WarehouseSawtooth','pump-station':'PumpStation','service-workshop':'ServiceWorkshop'}[which]);PARENT=root
 foundations()
 if which=='warehouse-sawtooth':
  cube('Masonry warehouse shell',(0,0,1.6),(7.72,7.50,2.7),'Brick',.06)
  # Two properly shaped sawtooth monitor roofs, not floating rectangular caps.
  for i in range(2):
   ya=-3.85+i*3.84; profile=[(ya,2.89),(ya+3.68,2.89),(ya+3.68,3.94),(ya+3.50,3.94),(ya,3.04)]
   extrude_x('Sawtooth structural wedge',profile,7.76,'ZincRoof',.025)
   cube('Northlight ribbon',(0,ya+3.705,3.47),(7.35,.035,.78),'Glass',.008)
   for x in [-3.5,-2.33,-1.16,0,1.16,2.33,3.5]:cube('Northlight mullion',(x,ya+3.73,3.47),(.055,.045,.83),'Steel',.008)
   cube('Monitor ridge flashing',(0,ya+3.58,3.97),(7.9,.28,.06),'Steel',.015)
   for x in [-3.1,-2.1,-1.1,0,1.1,2.1,3.1]:tube('Standing seam',(x,ya+.07,3.075),(x,ya+3.45,3.94),.018,'Steel',vertices=6)
  shutter('Loading shutter',-.95,3.78,1.46,3.5,2.35);window_front('Office glazing',2.25,3.78,1.85,1.5,1.2)
  cube('Door head canopy',(-.95,3.78,2.81),(4.1,.42,.12),'ZincRoof',.025)
  text('Depot stencil','CANAL  /  07',(-.9,3.96,2.69),.21,'Ivory')
  for x in [-3.85,3.85]:
   for y in [-2.4,0,2.4]:
    cube('Side high window',(x,y,2.22),(.035,1.66,.77),'Glass',.008)
    for yy in [y-.83,y,y+.83]:cube('Side steel frame',(x*1.004,yy,2.22),(.045,.05,.85),'Steel',.007)
    for zz in [1.81,2.62]:cube('Side lintel',(x, y,zz),(.12,1.86,.1),'Concrete',.01)
  for x in [-3.7,3.7]:tube('Downpipe',(x,3.91,.38),(x,3.91,2.8),.055,'Steel')
 elif which=='pump-station':
  cube('Lower concrete plant',(0,0,1.41),(7.78,7.50,2.5),'Concrete',.075)
  cube('Raised pump hall',(-1.35,-.8,2.91),(4.9,5.9,1.9),'Concrete',.075)
  cube('Upper roof coping',(-1.35,-.8,3.93),(5.08,6.08,.14),'ZincRoof',.025)
  cube('Low roof slab',(0,0,2.73),(7.88,7.88,.16),'ZincRoof',.035)
  # Chamfered parapets and open roof recess make a stepped industrial silhouette.
  for x in [-3.83,3.83]:cube('Roof parapet',(x,0,2.94),(.15,7.8,.33),'Concrete',.025)
  cube('Front parapet',(0,3.83,2.94),(7.7,.15,.33),'Concrete',.025)
  for x in [-2.8,-1.35,.1]:window_front('Pump clerestory',x,2.17,3.28,1.08,.65)
  shutter('Service gate',-1.85,3.78,1.4,2.55,2.25);window_front('Control room',1.62,3.78,1.75,2,1.05)
  text('Pump station sign','PUMP  03',(1.6,3.965,2.47),.22,'DarkSteel')
  # Huge cast conduits, flange stacks and roof service equipment.
  for yy in [-1.9,.1,1.9]:
   tube('External pipe',(3.82,yy,.4),(3.82,yy,2.42),.1,'SagePaint');cyl('Pipe flange',(3.82,yy,1),.15,.07,'Steel')
  vent((2.25,-2.1,2.89),1.6,1.3);vent((2.25,.1,2.89),1.2,1.2)
  for x in [-3.2,-2,-.8]:cube('Upper facade weather band',(x,-3.78,3.2),(.17,.035,.9),'ZincRoof',.005)
  cube('Warning panel',(3.947,2.35,1.45),(.02,.65,.78),'OchrePaint',.012)
 else:
  cube('Repair hall masonry',(0,0,1.48),(7.74,7.50,2.55),'Brick',.06)
  # Cross-section is peaked, with fascia, ridge and rainwater channels.
  v=[(-3.94,-3.94,2.78),(3.94,-3.94,2.78),(0,-3.94,3.94),(-3.94,3.94,2.78),(3.94,3.94,2.78),(0,3.94,3.94)]
  mesh('Gabled folded zinc roof',v,[(0,2,1),(3,4,5),(0,3,5,2),(2,5,4,1),(0,1,4,3)],'ZincRoof',.025)
  cube('Ridge cap',(0,0,3.97),(.22,7.94,.06),'Steel',.018)
  for y in [-3.4,-2.4,-1.4,-.4,.6,1.6,2.6,3.6]:
   tube('Left roof standing seam',(-3.89,y,2.83),(0,y,3.97),.018,'Steel',vertices=6);tube('Right roof standing seam',(0,y,3.97),(3.89,y,2.83),.018,'Steel',vertices=6)
  shutter('Repair bay',-1.7,3.78,1.44,3.0,2.28);shutter('Workshop door',1.88,3.78,1.44,2.35,2.28)
  text('Repair hall sign','DOCK  WORKS',(0,3.965,2.79),.29,'Ivory')
  for x in [-3.86,3.86]:
   for y in [-2,1.4]:
    cube('Workshop side glazing',(x,y,1.88),(.03,2.1,1.1),'Glass',.012)
    for yy in [y-1.05,y,y+1.05]:cube('Window surround',(x*1.005,yy,1.88),(.05,.06,1.16),'Steel',.009)
    for zz in [1.3,1.88,2.46]:cube('Window rail',(x*1.005,y,zz),(.05,2.16,.055),'Steel',.009)
   tube('Eave gutter',(x,-3.85,2.82),(x,3.85,2.82),.07,'Steel')
  for y in [-1.8,1.4]:
   cyl('Roof extractor',(-2,y,3.5),.24,.45,'Steel',20);cyl('Extractor rain cap',(-2,y,3.75),.34,.08,'ZincRoof',20)
 # Rusticated plinth and neutral datum course tie all three families together.
 for y in [-3.89,3.89]:cube('Concrete datum',(0,y,.49),(7.8,.11,.16),'Concrete',.018)
 for x in [-3.89,3.89]:cube('Concrete datum',(x,0,.49),(.11,7.8,.16),'Concrete',.018)
 return root

def wheel(name,x,y):
 global PARENT
 old=PARENT;w=empty(name,(x,y,.37),old);PARENT=w
 # Geometry authored at local origin; independent X-axis wheel animation.
 bpy.ops.mesh.primitive_torus_add(major_radius=.255,minor_radius=.105,major_segments=32,minor_segments=10,location=(0,0,0),rotation=(0,math.pi/2,0))
 o=bpy.context.object;o.name='Moulded rubber tire';o.parent=w;applymat(o,'Rubber');o.select_set(False)
 for side in [-1 if x<0 else 1]:
  cyl('Pressed wheel rim',(side*.105,0,0),.215,.03,'Steel',24,'X');cyl('Recessed rim center',(side*.126,0,0),.14,.026,'DarkSteel',24,'X');cyl('Axle hub',(side*.15,0,0),.072,.05,'Steel',20,'X')
  for i in range(6):
   a=i*math.tau/6;cyl('Wheel lug',(side*.15,math.sin(a)*.115,math.cos(a)*.115),.018,.028,'Ivory',6,'X',bev=.003)
 for i in range(24):
  a=i*math.tau/24
  for side in [-1,1]:
   o=cube('Chevron tire tread',(side*.045,math.sin(a)*.352,math.cos(a)*.352),(.088,.075,.018),'Rubber',.007);o.rotation_euler.x=-a;o.rotation_euler.z=side*.22
 PARENT=old;return w

def fender(x,y):
 # Stamped arch section follows wheel opening, instead of a box perched on a cylinder.
 n=16;v=[]
 for xx in [x-.11,x+.11]:
  for r in [.405,.465]:
   for i in range(n+1):
    a=math.pi*i/n;v.append((xx,y+math.cos(a)*r,.37+math.sin(a)*r))
 f=[]
 for i in range(n):
  f += [(i,i+1,n+2+i,n+1+i),(2*(n+1)+i,3*(n+1)+i,3*(n+1)+i+1,2*(n+1)+i+1),(i,2*(n+1)+i,2*(n+1)+i+1,i+1),(n+1+i,n+2+i,3*(n+1)+i+1,3*(n+1)+i)]
 return mesh('Pressed wheel arch',v,f,'SagePaint',.012)

def truck():
 global PARENT
 r=empty('CargoTruck');PARENT=r
 for x in [-.48,.48]:cube('Chassis C rail',(x,-.02,.51),(.13,3.3,.2),'DarkSteel',.025)
 for y in [-1.07,1.03]:cyl('Axle',(0,y,.37),.075,1.55,'DarkSteel',16,'X');cyl('Differential',(0,y,.37),.15,.32,'Steel',20,'X')
 cube('Cargo deck',(0,-.67,.81),(1.57,2.14,.16),'Steel',.025)
 # Cab-over silhouette: sloped windscreen, upper lip, sculpted body and lower chin.
 profile=[(.35,.72),(1.66,.72),(1.73,1.18),(1.66,1.36),(1.40,1.88),(.39,1.88)]
 extrude_x('Formed cab shell',profile,1.48,'SagePaint',.065)
 cube('Cab roof',(0,.9,1.91),(1.52,1.08,.1),'SagePaint',.045)
 # Slanted split windshield matches the actual body surface.
 for s in [-1,1]:
  x0=.045*s;x1=.66*s
  mesh('Laminated windshield',[(x0,1.665,1.38),(x1,1.665,1.38),(x1,1.436,1.835),(x0,1.436,1.835)],[(0,1,2,3)],'Glass')
  tube('Windshield wiper',(s*.15,1.674,1.405),(s*.56,1.585,1.58),.012,'DarkSteel',vertices=8)
 for s in [-1,1]:
  x=s*.752
  mesh('Cab side window',[(x,.47,1.36),(x,1.60,1.36),(x,1.38,1.80),(x,.47,1.80)],[(0,1,2,3)],'Glass')
  cube('Door lower panel',(x,.94,1.035),(.026,1.05,.46),'SagePaint',.025)
  cube('Door handle',(x+s*.023,.54,1.25),(.036,.17,.025),'Steel',.008)
  cube('Door sill',(x,.94,.79),(.035,1.05,.045),'Ivory',.008)
  tube('Mirror arm',(x,1.42,1.48),(s*.84,1.38,1.65),.018,'Steel')
  cube('Wing mirror',(s*.858,1.38,1.64),(.07,.12,.22),'DarkSteel',.025)
  cube('Side step',(s*.69,.52,.59),(.29,.4,.07),'Steel',.02)
  for j in range(5):cube('Step tread',(s*.69,.37+j*.07,.632),(.25,.016,.009),'DarkSteel',.003)
 # Front radiator opening, horizontal louvres, separate lenses and reinforced bumper.
 cube('Radiator recess',(0,1.731,1.02),(.93,.035,.33),'DarkSteel',.025)
 for z in [.9,.98,1.06,1.14]:cube('Radiator chrome rib',(0,1.755,z),(.86,.025,.023),'Steel',.005)
 for s in [-1,1]:
  cube('Headlamp surround',(s*.58,1.74,1.04),(.23,.035,.22),'DarkSteel',.025)
  cube('Headlamp lens',(s*.58,1.764,1.05),(.18,.02,.14),'Lamp',.025)
  cube('Turn indicator',(s*.60,1.75,1.24),(.12,.025,.055),'OchrePaint',.012)
 cube('Front reinforced bumper',(0,1.745,.72),(1.58,.1,.16),'Steel',.035)
 cube('License plaque',(0,1.794,.76),(.35,.008,.10),'Ivory',.008)
 text('Vehicle registration','C17',(0,1.799,.723),.075,'DarkSteel')
 # Rounded cargo curtain profile with tied canvas roof and framed lower sideboards.
 cross=[(-.75,.89),(.75,.89),(.75,1.90),(.70,2.04),(.55,2.11),(0,2.15),(-.55,2.11),(-.70,2.04),(-.75,1.90)]
 ys=[-1.73,-1.60,-1.36,-1.12,-.88,-.65,-.41,-.18,.06,.30];v=[]
 for j,y in enumerate(ys):
  for x,z in cross:v.append((x,y,z-(.018 if j%2==0 and z>1.9 else 0)))
 n=len(cross);f=[tuple(reversed(range(n))),tuple(range((len(ys)-1)*n,len(ys)*n))]
 for j in range(len(ys)-1):
  for i in range(n):f.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 mesh('Bowed canvas and hoop tension folds',v,f,'Canvas',.012)
 for y in [-1.60,-1.12,-.65,-.18,.20]:
  path=[(-.758,1.38),(-.758,1.90),(-.708,2.047),(-.555,2.119),(0,2.159),(.555,2.119),(.708,2.047),(.758,1.90),(.758,1.38)]
  vv=[(x,y+dy,z) for dy in [-.022,.022] for x,z in path];nn=len(path)
  mesh('Continuous over-roof cargo tie',vv,[(i,i+1,nn+i+1,nn+i) for i in range(nn-1)],'OchrePaint')
 for s in [-1,1]:
  cube('Cargo sideboard',(s*.77,-.71,1.11),(.055,2.01,.46),'SagePaint',.02)
  cube('Cargo upper rail',(s*.783,-.71,1.36),(.045,2.04,.055),'Steel',.01)
  for y in [-1.6,-1.12,-.65,-.18,.2]:
   cube('Cargo stake',(s*.795,y,1.12),(.045,.045,.5),'Steel',.007)
   cube('Canvas strap',(s*.757,y,1.7),(.022,.045,.61),'OchrePaint',.004)
   cube('Tie-down buckle',(s*.79,y,1.4),(.03,.07,.065),'Steel',.008)
  cube('Cargo safety stripe',(s*.804,-.69,1.15),(.012,1.72,.07),'OchrePaint',.004)
  cube('Utility locker',(s*.57,-.38,.58),(.34,.6,.25),'SagePaint',.025)
  cube('Locker latch',(s*.75,-.38,.59),(.025,.09,.025),'Steel',.007)
 cube('Rear tailgate',(0,-1.744,1.13),(1.56,.055,.5),'SagePaint',.025)
 for x in [-.57,.57]:
  cube('Tailgate hinge',(x,-1.785,.93),(.23,.03,.045),'Steel',.008)
  cube('Rear brake light',(x,-1.775,.76),(.14,.025,.085),'RedLamp',.012)
 cube('Rear bumper',(0,-1.75,.63),(1.6,.1,.11),'Steel',.025)
 text('Rear cargo marking','CANAL  LOGISTICS',(0,-1.782,1.08),.11,'Ivory',rotation=(math.pi/2,0,0))
 for x in [-.72,.72]:
  for y in [-1.07,1.03]:wheel(('WheelL' if x<0 else 'WheelR')+('Front' if y>0 else 'Rear'),x,y);fender(x,y)
 return r

def turret():
 global PARENT
 r=empty('SentryTurret');PARENT=r
 cyl('Octagonal foundation',(0,0,.115),.79,.23,'Concrete',8,bev=.035)
 cyl('Bolted plinth',(0,0,.29),.61,.13,'Steel',12,bev=.025)
 cyl('Tapered pedestal',(0,0,.65),.49,.67,'SagePaint',12,r2=.37,bev=.025)
 cyl('Yaw bearing',(0,0,1.025),.46,.12,'DarkSteel',32,bev=.015)
 for i in range(8):
  a=i*math.tau/8;x=math.sin(a)*.64;y=math.cos(a)*.64;cyl('Foundation anchor',(x,y,.257),.043,.045,'DarkSteel',6,bev=.004)
 for s in [-1,1]:
  cube('Pedestal access panel',(s*.403,0,.65),(.035,.4,.37),'Steel',.03)
  for z in [.52,.6,.68,.76]:cube('Cooling fin',(s*.427,0,z),(.025,.32,.025),'DarkSteel',.004)
 yaw=empty('TurretYaw',(0,0,1.13),r);PARENT=yaw
 # Compact cast armor has chamfered shoulders and a sloped front face.
 extrude_x('Cast armored receiver',[(-.48,-.10),(.42,-.10),(.56,.12),(.29,.46),(-.34,.46),(-.51,.28)],1.03,'SagePaint',.06)
 for s in [-1,1]:
  cube('Cheek applique armor',(s*.542,-.04,.18),(.065,.72,.36),'OchrePaint',.035)
  for y in [-.27,.16]:cyl('Cheek bolt',(s*.584,y,.16),.035,.03,'Steel',6,'X',bev=.004)
  cyl('Gun trunnion',(s*.33,.32,.15),.18,.16,'Steel',24,'X')
 cube('Rear battery pack',(0,-.515,.14),(.65,.15,.31),'DarkSteel',.03)
 for x in [-.22,-.11,0,.11,.22]:cube('Battery cooling vane',(x,-.606,.15),(.035,.025,.26),'Steel',.004)
 cube('Optic hood',(-.28,.30,.48),(.28,.28,.22),'DarkSteel',.035)
 cube('Optic glass',(-.28,.456,.49),(.18,.025,.09),'Glass',.014)
 cyl('Antenna base',(.38,-.30,.49),.055,.12,'Steel',12)
 tube('Radio antenna',(.38,-.30,.53),(.38,-.30,1.04),.014,'DarkSteel',vertices=8)
 pitch=empty('GunPitch',(0,.34,.15),yaw);PARENT=pitch
 cyl('Recoil jacket',(0,.15,0),.145,.47,'DarkSteel',24,'Y');cyl('Mantlet collar',(0,.01,0),.20,.16,'SagePaint',24,'Y')
 recoil=empty('Recoil',(0,0,0),pitch);PARENT=recoil
 cyl('Stepped barrel',(0,.48,0),.082,.6,'Steel',24,'Y');cyl('Barrel shroud',(0,.34,0),.108,.34,'SagePaint',24,'Y')
 for y in [.2,.48,.70]:cyl('Machined barrel ring',(0,y,0),.115,.055,'DarkSteel',24,'Y')
 # Open bored muzzle with a dark interior, not a solid capped cylinder.
 vv=[];nn=24
 for yy,rr in [(.71,.115),(.89,.115),(.89,.062),(.72,.062)]:
  for i in range(nn):a=i*math.tau/nn;vv.append((math.cos(a)*rr,yy,math.sin(a)*rr))
 ff=[]
 for ring in range(3):
  for i in range(nn):ff.append((ring*nn+i,ring*nn+(i+1)%nn,(ring+1)*nn+(i+1)%nn,(ring+1)*nn+i))
 mesh('Open muzzle brake',vv,ff,'DarkSteel',.008)
 cyl('Bore darkness',(0,.715,0),.06,.008,'Rubber',24,'Y',bev=0)
 empty('Muzzle',(0,.9,0),recoil)
 PARENT=r;shield=empty('Shield',(0,0,0),r);PARENT=shield
 # Optional shield does not exceed the original radial core envelope.
 extrude_x('Optional frontal blast shield',[(.49,.32),(.65,.32),(.67,1.15),(.52,1.27)],.87,'Steel',.035)
 cube('Shield safety paint',(0,.68,.88),(.69,.025,.12),'OchrePaint',.01)
 PARENT=r
 return r

def compact_turret_head(root):
 # Bake an anisotropic design refinement into vertices/positions, NOT runtime node scale.
 # The entire gun yaw envelope must stay inside the existing radius-0.8 body proxy.
 yaw=next(o for o in root.children if o.name=='TurretYaw')
 for o in list(yaw.children_recursive):
  if o.type=='MESH':
   bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);o.select_set(False)
   for v in o.data.vertices:v.co.x*=.84;v.co.y*=.61
  o.location.x*=.84;o.location.y*=.61

ASSETS={k:building(k) for k in ['warehouse-sawtooth','pump-station','service-workshop']};ASSETS['cargo-truck']=truck();ASSETS['sentry-turret']=turret();compact_turret_head(ASSETS['sentry-turret'])
bpy.context.view_layer.update()
# Apply placement transforms to static mesh data and consolidate each articulated branch.
# Joining by parent retains pivots and reduces object/node/draw overhead.
for root in ASSETS.values():
 for o in list(root.children_recursive):
  if o.type=='MESH':uv(o)
 parents=[root]+[o for o in root.children_recursive if o.type=='EMPTY']
 for p in parents:
  objs=[o for o in p.children if o.type=='MESH']
  if not objs:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in objs:o.select_set(True)
  bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();o=bpy.context.object;o.name=p.name+'_Geometry'
  # Local transforms are applied without moving parent pivots.
  bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.select_set(False)
# Source scene contains separate asset roots at origin for authoring, not a staged gameplay scene.
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'industrial-canal-kit.blend'))
for key,r in ASSETS.items():
 bpy.ops.object.select_all(action='DESELECT');r.select_set(True)
 for o in r.children_recursive:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(key+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_animations=False,export_extras=True,export_materials='EXPORT',export_image_format='AUTO',export_draco_mesh_compression_enable=False)
 print('EXPORTED',key)
print('ART_KIT_AUTHORING_COMPLETE')
