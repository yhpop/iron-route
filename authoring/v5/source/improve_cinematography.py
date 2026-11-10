"""V5: closer motivated framing, directional daylight and restrained sprung-body motion."""
import math
from mathutils import Vector

def apply_cinematography(bpy):
 s=bpy.context.scene;root=bpy.data.objects['TANK / animated motion controller'];body=bpy.data.objects['Suspension / isolated hull pitch and recoil'];col=bpy.data.collections['06_CAMERAS_AND_LIGHTS']
 def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
 sun=bpy.data.objects['Late afternoon sun through clouds'];sun.location=(-18,-27,26);aim(sun,(0,6,0));sun.data.energy=2.35;sun.data.angle=.105;sun.data.color=(1,.90,.76)
 for name,power,size,color in [('Large overcast sky',1700,30,(.71,.82,1)),('Warm rim through broken city',1250,10,(1,.85,.65)),('Soft front fill',650,15,(.78,.88,1))]:
  o=bpy.data.objects[name];o.data.energy=power;o.data.size=size;o.data.color=color
 key=bpy.data.objects['Lighting / restrained moving side key'];key.location=(7,-4,6);aim(key,(0,.4,1.2));key.data.energy=1050;key.data.size=6;key.data.color=(.86,.93,1)
 # A low-energy broad rim helps readable painted surfaces without an obvious spotlight.
 d=bpy.data.lights.new('V5 / warm body rim','AREA');d.energy=500;d.shape='DISK';d.size=5;d.color=(1,.86,.66);o=bpy.data.objects.new(d.name,d);col.objects.link(o);o.parent=root;o.location=(-6,5,5);aim(o,(0,.3,1.2))
 world=s.world;world.use_nodes=True;n=world.node_tree.nodes;links=world.node_tree.links;bg=n.get('Background');sky=n.new('ShaderNodeTexSky');sky.name='V5 / dust-filtered daylight sky';sky.sky_type='NISHITA';sky.sun_disc=False;sky.sun_elevation=math.radians(31);sky.sun_rotation=math.radians(225);sky.altitude=.25;sky.air_density=1.1;sky.dust_density=2.3;links.new(sky.outputs['Color'],bg.inputs['Color']);bg.inputs['Strength'].default_value=.16
 fog=bpy.data.materials.get('FINAL / atmospheric perspective')
 if fog:
  for n in fog.node_tree.nodes:
   if n.type=='PRINCIPLED_VOLUME':n.inputs['Density'].default_value=.00145;n.inputs['Color'].default_value=(.48,.54,.62,1)
 s.view_settings.look='AgX - Medium High Contrast';s.view_settings.exposure=.35
 focus=bpy.data.objects.new('V5 / focus on tank',None);col.objects.link(focus);focus.parent=root;focus.location=(0,.1,1.3)
 def point_at(f,offset,target_offset):
  s.frame_set(f);y=root.location.y
  return (f,(offset[0],y+offset[1],offset[2]),(target_offset[0],y+target_offset[1],target_offset[2]))
 def camera(name,keys,lens,dof=True,fstop=8):
  c=bpy.data.objects[name];c.animation_data_clear();c.data.lens=lens;c.data.shift_x=0;c.data.shift_y=0;c.data.dof.use_dof=dof;c.data.dof.focus_object=focus if dof else None;c.data.dof.aperture_fstop=fstop
  for f,loc,target in keys:c.location=loc;aim(c,target);c.keyframe_insert('location',frame=f);c.keyframe_insert('rotation_euler',frame=f)
  for fc in c.animation_data.action.fcurves:
   for k in fc.keyframe_points:k.interpolation='LINEAR'
  return c
 camera('01 / AERIAL FOLLOW / 00-05s',[point_at(1,(6.8,-12,8.3),(.1,1.0,1.25)),point_at(61,(6.1,-11.3,7.4),(.1,1.1,1.3)),point_at(120,(5.7,-10.8,6.6),(.1,1.3,1.35))],32,True,9)
 camera('02 / LOW RIGHT TRACKS / 05-11s',[point_at(121,(6.5,.1,1.25),(0,.1,1.05)),point_at(193,(6.4,-1.25,1.2),(0,-.1,1.1)),point_at(264,(6.3,-2.5,1.3),(0,-.3,1.1))],35,True,7.1)
 # Keep the gunner view expansive and clear, without artificial focus pumping.
 camera('03 / GUNNER POV / 11-16s',[(265,(.60,-12.95,3.18),(.1,26,1.35)),(384,(.30,-8.30,3.18),(.1,26,1.35))],31,False)
 keys=[]
 for f,x,y,z in [(385,6.9,10.1,2.65),(473,6.7,9.8,2.7),(480,6.68,9.78,2.7),(481,6.73,9.81,2.735),(484,6.65,9.74,2.675),(490,6.62,9.7,2.7),(504,6.5,9.5,2.72)]:keys.append(point_at(f,(x,y,z),(0,1.4,1.5)))
 c=camera('04 / FRONT THREE QUARTER / 16-21s',keys,34,True,8);c.data.shift_x=.10
 c=camera('05 / BARRICADE IMPACT / 21-25s',[(505,(5.2,10,3.0),(0,26,1.75)),(600,(5.6,8.6,3.4),(0,26,2.15))],46,False)
 camera('06 / AERIAL PULLBACK / 25-30s',[point_at(601,(6.2,-12,7.5),(.2,7,1.6)),point_at(720,(8,-17,13.3),(.4,8,1.6))],29,True,11)
 # Separate tiny road response from existing stop/fire recoil. Treads remain rooted.
 ride=bpy.data.objects.new('V5 / restrained suspension ride',None);bpy.data.collections['01_TANK_EDITABLE'].objects.link(ride);ride.parent=root;body.parent=ride
 for f in range(1,721,3):
  s.frame_set(max(1,f-1));y0=root.location.y;s.frame_set(min(720,f+1));y1=root.location.y;s.frame_set(f);y=root.location.y;v=abs(y1-y0)*12;gate=min(1,v/.55)
  ride.location.z=gate*(.006*math.sin(y*5.2)+.003*math.sin(y*11.3+.8));ride.rotation_euler.x=gate*(.0045*math.sin(y*4.3)+.0015*math.sin(y*9.2));ride.rotation_euler.y=gate*.0032*math.sin(y*6.8+.9)
  ride.keyframe_insert('location',frame=f);ride.keyframe_insert('rotation_euler',frame=f)
 s.frame_set(720);ride.keyframe_insert('location',frame=720);ride.keyframe_insert('rotation_euler',frame=720)
 for fc in ride.animation_data.action.fcurves:
  for k in fc.keyframe_points:k.interpolation='BEZIER';k.handle_left_type='AUTO_CLAMPED';k.handle_right_type='AUTO_CLAMPED'
 # Render settings are explicitly native. The final sampling choice is benchmarked.
 s.render.engine='BLENDER_EEVEE_NEXT';s.eevee.taa_render_samples=96;s.eevee.use_raytracing=True;s.eevee.ray_tracing_options.resolution_scale='1';s.eevee.ray_tracing_options.screen_trace_quality=.8;s.eevee.ray_tracing_options.trace_max_roughness=.8;s.eevee.ray_tracing_options.denoise_temporal=False;s.eevee.fast_gi_ray_count=4;s.render.resolution_x=1280;s.render.resolution_y=720;s.render.resolution_percentage=100;s.render.fps=24;s.render.fps_base=1;s.frame_start=1;s.frame_end=720
 s.render.threads_mode='FIXED';s.render.threads=8;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGB';s.frame_set(1)
 return {'opening_lens_mm':32,'opening_camera_lowered':True,'samples':96,'suspension_body_only':True,'resolution':[1280,720],'fps':24}
