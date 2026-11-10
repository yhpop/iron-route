# This file runs inside rebuild_scene.py's documented scene namespace.
# Kinematics, grounded suspension and the six-shot camera sequence.
motion=[(1,-20),(121,-16),(265,-11.2),(385,-7.2),(457,-4.8),(473,-4.5),(481,-4.5),(601,-4.5),(625,-4.3),(720,-1.1)]
for f,y in motion:root.location=(0,y,-.1);root.keyframe_insert('location',frame=f)
for fc in root.animation_data.action.fcurves:
 for k in fc.keyframe_points:k.interpolation='BEZIER';k.handle_left_type='AUTO_CLAMPED';k.handle_right_type='AUTO_CLAMPED'
for f,a,z in [(1,0,0),(455,0,0),(465,-.022,-.025),(473,-.012,-.015),(479,0,0),(481,.012,-.04),(485,-.008,-.035),(492,0,0),(720,0,0)]:
 body.rotation_euler.x=a;body.location.z=z;body.keyframe_insert('rotation_euler',frame=f,index=0);body.keyframe_insert('location',frame=f,index=2)
for f,y in [(1,0),(479,0),(481,-.32),(488,0),(720,0)]:barrel.location.y=y;barrel.keyframe_insert('location',frame=f,index=1)
def pos(f):
 for (a,y1),(b,y2) in zip(motion[:-1],motion[1:]):
  if a<=f<=b:return y1+(y2-y1)*(f-a)/(b-a)
 return -1.1
active=COL['04_BARRICADE'];centerbags=[]
for j in range(9):
 x=-6+j*1.5;ob=cube('Concrete roadblock %02d'%j,(x,26,.62),(1.38,.9,1.25),M['concrete'],.06)
 if j in [3,4,5]:
  base=ob.location.copy()
  for f,dy,dz,rx in [(1,0,0,0),(509,0,0,0),(518,(j-3)*.18+.2,1.2-abs(j-4)*.25,.5*(j-3)),(540,1.2,-.15,1.5),(720,1.2,-.15,1.5)]:
   dx=(j-4)*max(0,f-509)/31*.35 if f<540 else (j-4)*.35;ob.location=base+Vector((dx,dy,dz));ob.rotation_euler=(rx,0,(j-4)*rx*.25);ob.keyframe_insert('location',frame=f);ob.keyframe_insert('rotation_euler',frame=f)
  for fc in ob.animation_data.action.fcurves:
   for k in fc.keyframe_points:k.interpolation='LINEAR'
 for k in range(2):
  bag=ico('Sandbag',(x-.38+k*.74,25.9,1.36),(.41,.31,.17),M['sand'],sub=2)
  if j in [3,4,5]:centerbags.append(bag)
for j in range(15):
 bag=ico('Sandbag parapet',(R.uniform(-5.5,5.5),26.6,1.55+R.uniform(-.15,.2)),(.48,.28,.18),M['sand'],sub=2)
 if abs(bag.location.x)<2:centerbags.append(bag)
for i,bag in enumerate(centerbags):
 base=bag.location.copy()
 for f,loc in [(1,base),(509,base),(521,base+Vector(((i%3-1)*.22,-.3,.65))),(550,Vector((base.x+(i%3-1)*.18,24.7+(i%2)*.32,.2))),(720,Vector((base.x+(i%3-1)*.18,24.7+(i%2)*.32,.2)))]:bag.location=loc;bag.keyframe_insert('location',frame=f)
for x in [-5,4.5]:
 for a,b in [((x-.7,25.8,0),(x+.7,26.8,1.8)),((x+.7,25.8,0),(x-.7,26.8,1.8)),((x,25.4,.5),(x,27.2,1.1))]:beam('Steel barricade cross',a,b,.13,M['metal'])
active=COL['05_ANIMATED_FX']
def sk(o,keys):
 base=o.scale.copy()
 for f,val in keys:o.scale=base*val;o.keyframe_insert('scale',frame=f)
 for fc in o.animation_data.action.fcurves:
  for k in fc.keyframe_points:k.interpolation='LINEAR'
flash=ico('Muzzle flash',(0,6.05,.42),(.45,1.2,.45),M['fire'],barrel,2);sk(flash,[(1,.001),(479,.001),(481,1),(483,.55),(486,.001),(720,.001)])
for j in range(6):
 puff=ico('Muzzle smoke',(R.uniform(-.15,.15),5.3+R.random(),.45+R.random()*.3),(.24,.5,.25),M['smoke'],barrel,2);sk(puff,[(1,.001),(482,.001),(490,1),(505,1.7),(520,.001),(720,.001)])
for j in range(18):
 x=R.uniform(-1.6,1.6);y=26+R.uniform(-.7,.7);z=R.uniform(.6,3.4);o=ico('Impact fireball %02d'%j,(x,y,z),(R.uniform(.6,1.1),R.uniform(.6,1),R.uniform(.8,1.45)),M['fire'],sub=2);start=510+R.randint(0,6);sk(o,[(1,.001),(start,.001),(start+7,1.7*.73),(start+17,1.9*.73),(555,.001),(720,.001)])
for j in range(26):
 x=R.uniform(-1.7,1.7);y=26+R.uniform(-1,1);z=R.uniform(1,5);o=ico('Rolling impact smoke %02d'%j,(x,y,z),(R.uniform(.8,1.4),R.uniform(.8,1.5),R.uniform(1.1,1.7)),M['smoke'],sub=2)
 for v in o.data.vertices:v.co*=1+.17*math.sin(v.co.x*13+v.co.z*9+j)
 start=514+R.randint(0,18);sk(o,[(1,.001),(start,.001),(start+15,.8*1.3),(580,1.6),(720,2.4)]);o.location=(x,y,z);o.keyframe_insert('location',frame=start);o.location=(x+2.4,y+.9,z+7);o.keyframe_insert('location',frame=720)
for j in range(14):
 a=j*math.tau/14;o=ico('Ground shockwave dust',(math.cos(a)*1.3,26+math.sin(a),.4),(.55,.5,.5),M['dust'],sub=2);sk(o,[(1,.001),(510,.001),(519,.6),(542,1.5),(584,.001),(720,.001)]);o.keyframe_insert('location',frame=510);o.location=(math.cos(a)*5.8,26+math.sin(a)*3,.4);o.keyframe_insert('location',frame=559)
for j in range(32):
 x=R.uniform(-1,1);y=26+R.uniform(-.7,.7);dims=(R.uniform(.06,.2),R.uniform(.08,.23),R.uniform(.08,.26));R.randrange(5);o=cube('Flying concrete debris',(x,y,1.1),dims,M['concrete']);sk(o,[(1,.001),(510,.001),(514,1),(720,1)]);vx=R.uniform(-6,6);vy=R.uniform(-4,4);height=R.uniform(2,6)
 for f,t in [(514,0),(531,.5),(552,1),(565,1.25)]:o.location=(x+vx*t,y+vy*t,max(.1,1.1+height*3*t-9*t*t));o.rotation_euler=(t*j,t*j*.6,t*j*.3);o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_euler',frame=f)
for j in range(8):
 o=ico('Aftermath fire',(R.uniform(-1.7,1.7),26+R.uniform(-.4,.4),R.uniform(.35,1.2)),(.3,.25,.7),M['fire']);sk(o,[(1,.001),(544,.001),(552,.6),(570,1),(589,.7),(610,1.15),(632,.8),(650,1.1),(675,.7),(698,1),(720,.8)])
for x,y in [(-17,44),(15,63),(-13,-7),(18,15)]:
 for j in range(7):ico('Distant smoke',(x+j*.37,y,3+j*1.5),(1+j*.16,.9+j*.15,1.4),M['smoke'])
active=COL['06_CAMERAS_AND_LIGHTS']
bpy.ops.object.light_add(type='SUN',location=(0,-20,20));o=bpy.context.object;o.name='Late afternoon sun through clouds';o.rotation_euler=(.48,-.6,-.65);o.data.energy=1.35;o.data.angle=.17;o.data.color=(1,.93,.79);move(o)
for name,loc,power,size,col in [('Large overcast sky',(0,4,25),1300,35,(.77,.85,1)),('Warm rim through broken city',(-16,35,15),1800,12,(1,.82,.57)),('Soft front fill',(0,-15,12),420,20,(.8,.86,1))]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=col;o.rotation_euler=(Vector((0,8,0))-o.location).to_track_quat('-Z','Y').to_euler();move(o)
bpy.ops.object.light_add(type='AREA',location=(8,5,7));o=bpy.context.object;o.name='Lighting / restrained moving side key';o.parent=root;o.data.shape='DISK';o.data.size=7;o.data.energy=650;o.data.color=(.88,.93,1);o.rotation_euler=(Vector((0,0,1.5))-o.location).to_track_quat('-Z','Y').to_euler();move(o)
for name,loc,power,keys in [('Muzzle illumination',(0,1.5,2.1),550,[(1,0),(479,0),(481,1),(484,0),(720,0)]),('Explosion illumination',(0,25.5,2.6),990,[(1,0),(510,0),(516,1),(534,.6),(550,.14),(720,.1)])]:
 bpy.ops.object.light_add(type='POINT',location=loc);o=bpy.context.object;o.name=name;o.data.color=(1,.3,.025);o.data.shadow_soft_size=2;move(o)
 for f,v in keys:o.data.energy=power*v;o.data.keyframe_insert('energy',frame=f)
def cam(name,params,lens):
 bpy.ops.object.camera_add();o=bpy.context.object;o.name=name;move(o);o.data.lens=lens;o.data.sensor_width=36;o.data.clip_end=300
 for f,loc,target in params:o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_euler',frame=f)
 for fc in o.animation_data.action.fcurves:
  for k in fc.keyframe_points:k.interpolation='LINEAR'
 mark=s.timeline_markers.new(name,frame=params[0][0]);mark.camera=o;return o
c1=cam('01 / AERIAL FOLLOW / 00-05s',[(1,(8.5,pos(1)-15.5,16),(2,pos(1)+6,1.3)),(61,(8,pos(61)-14,14),(2,pos(61)+6,1.3)),(120,(7.6,pos(120)-12.5,12),(2,pos(120)+6,1.3))],28)
cam('02 / LOW RIGHT TRACKS / 05-11s',[(121,(5.8,pos(121)+.5,1.1),(0,pos(121)+.5,1.2)),(193,(5.8,pos(193)-1.5,1.1),(0,pos(193)+.5,1.2)),(264,(5.8,pos(264)-3.5,1.1),(0,pos(264)+.5,1.2))],32)
cam('03 / GUNNER POV / 11-16s',[(265,(.65,pos(265)-1.75,3.2),(.2,26,1.4)),(384,(.25,pos(384)-1.1,3.2),(.1,26,1.4))],30)
c4=cam('04 / FRONT THREE QUARTER / 16-21s',[(385,(6.3,pos(385)+8.3,3.3),(0,pos(385)+1,1.65)),(473,(5.9,pos(473)+8,3.3),(0,pos(473)+1,1.65)),(480,(5.88,pos(480)+7.98,3.3),(0,pos(480)+1,1.65)),(481,(5.93,pos(481)+7.97,3.34),(0,pos(481)+1,1.65)),(484,(5.84,pos(484)+7.94,3.28),(0,pos(484)+1,1.65)),(490,(5.82,pos(490)+7.9,3.3),(0,pos(490)+1,1.65)),(504,(5.65,pos(504)+7.6,3.3),(0,pos(504)+1,1.65))],26);c4.data.shift_x=.14988476037979126
cam('05 / BARRICADE IMPACT / 21-25s',[(505,(5.5,10.5,3.4),(0,26,1.7)),(600,(6,8.7,3.5),(0,26,2.2))],48)
cam('06 / AERIAL PULLBACK / 25-30s',[(601,(6.8,pos(601)-11.5,8.5),(2,pos(601)+9,1.5)),(720,(9.2,pos(720)-19,18),(2,pos(720)+9,1.5))],26)
s.timeline_markers.new('FIRE / single shot',frame=481);s.timeline_markers.new('IMPACT / single hit',frame=510);s.camera=c1
s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.28,.32,.40,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.28
cube('Atmosphere / distant dust haze',(0,20,12),(60,160,30),M['dark']);fog=bpy.context.object;fog.data.materials.clear();m=bpy.data.materials.new('FINAL / atmospheric perspective');m.use_nodes=True;n=m.node_tree.nodes;n.clear();out=n.new('ShaderNodeOutputMaterial');vol=n.new('ShaderNodeVolumePrincipled');vol.inputs['Density'].default_value=.0028;vol.inputs['Color'].default_value=(.5,.55,.61,1);vol.inputs['Anisotropy'].default_value=.12;m.node_tree.links.new(vol.outputs[0],out.inputs['Volume']);fog.data.materials.append(m)
s.render.engine='BLENDER_EEVEE_NEXT';s.eevee.taa_render_samples=48;s.render.resolution_x=1280;s.render.resolution_y=720;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.film_transparent=False;s.use_nodes=False;s.view_settings.view_transform='AgX';s.view_settings.look='AgX - Medium High Contrast';s.view_settings.exposure=.55
s['recovery_note']='Reconstructed from retained procedural source after old executor files became unavailable. Not the inaccessible original blend file.';s['appearance_status']='Approved v3 direction plus bounded v4 lighting/contact refinements; recovered source awaits native-resolution QA.'
s['reference_url']='https://www.youtube.com/watch?v=a3G69PTuT_M';s['duration_seconds']=30;s['native_resolution']='1280x720';s['frame_sampling']='720 distinct frames at 24fps, no interpolation or upscaling'
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':area.spaces.active.shading.type='SOLID';area.spaces.active.region_3d.view_perspective='CAMERA'
s.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=P+'/Tank_City_Recovered_v4.blend')
with open(P+'/source_manifest.json','w') as f:json.dump({'objects':len(s.objects),'frames':720,'fps':24,'resolution':[1280,720],'cuts_seconds':[0,5,11,16,21,25],'ground_contact_gap_m':.0025,'existing_structures_ragged':broken,'recovery':'Rebuilt source, not restored old binary','render_started':False},f,indent=2)
print('RECOVERED_SOURCE_SAVED',P+'/Tank_City_Recovered_v4.blend',flush=True)
