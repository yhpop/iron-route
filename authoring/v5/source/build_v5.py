import bpy,os,sys,json,time,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
P=Path(__file__).resolve().parent;ROOT=P.parent;sys.path.insert(0,str(P))
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [];skip_env='--skip-environment' in args
from improve_materials import apply_materials
from improve_cinematography import apply_cinematography
s=bpy.context.scene;s.frame_set(1);before=len(s.objects);report={'materials':apply_materials(bpy),'cinematography':apply_cinematography(bpy),'environment_included':not skip_env,'base_sha256':hashlib.sha256((P/'Tank_City_Recovered_v4.blend').read_bytes()).hexdigest()}
if not skip_env:
 from improve_environment import apply_environment
 report['environment']=apply_environment(bpy)
from improve_hardware import apply_hardware
report['hardware']=apply_hardware(bpy)
from improve_running_gear import apply_running_gear
report['running_gear']=apply_running_gear(bpy)
from apply_scanned_surfaces import apply_scanned_surfaces
report['scanned_surfaces']=apply_scanned_surfaces(bpy)
from improve_effects import apply_effects
report['effects']=apply_effects(bpy)
# Verify the full hull/turret/barrel stays inside the front hero shot at its extremes.
def shot4_bounds():
 pts=[]
 for f in [385,425,473,481,490,504]:
  s.frame_set(f);bpy.context.view_layer.update()
  for n in ['Sloped main armored hull','Sloped turret with cheek armor','Gun muzzle']:
   o=bpy.data.objects[n]
   pts.extend(world_to_camera_view(s,s.camera,o.matrix_world@Vector(c)).x for c in o.bound_box)
 return min(pts),max(pts)
c=bpy.data.objects['04 / FRONT THREE QUARTER / 16-21s'];lo,hi=shot4_bounds();c.data.shift_x+=(lo+hi)/2-.5;lo,hi=shot4_bounds()
if hi-lo>.90:c.data.lens*=.90/(hi-lo)
report['shot4_x_bounds']=shot4_bounds();report['objects_before']=before;report['objects_after']=len(s.objects);report['mesh_polygons']=sum(len(o.data.polygons) for o in s.objects if o.type=='MESH')
report['frames']=720;report['fps']=24;report['native_resolution']=[1280,720];report['render_samples']=s.eevee.taa_render_samples
root=bpy.data.objects['TANK / animated motion controller'];track=bpy.data.objects['Tread link -1 00'];stop=[]
for f in [481,550,600]:s.frame_set(f);stop.append([root.location.y,track['belt_position']])
assert max(x[0] for x in stop)-min(x[0] for x in stop)<1e-6;assert max(x[1] for x in stop)-min(x[1] for x in stop)<1e-6
report['stop_motion_verified']=True;s.frame_set(1)
label='V5a_Lookdev' if skip_env else 'V5_Improved';s.name='RUINED AVENUE / '+label;s['quality_version']=label;s['source_policy']='Versioned improvement; original v4 and existing preview are unchanged.'
blend=ROOT/f'Tank_City_{label}.blend';bpy.ops.wm.save_as_mainfile(filepath=str(blend));report['blend_sha256']=hashlib.sha256(blend.read_bytes()).hexdigest();report['blend']=str(blend);report['created_epoch']=time.time();(ROOT/(label+'_build_report.json')).write_text(json.dumps(report,indent=2,default=str));print('BUILD_REPORT',json.dumps(report,default=str),flush=True)
if '--render60' in args:
 s.frame_set(60);s.render.filepath=str(ROOT/'qa'/f'{label}_frame_0060.png');start=time.time();bpy.ops.render.render(write_still=True);print('QA_FRAME_DONE',json.dumps({'frame':60,'seconds':time.time()-start,'path':s.render.filepath}),flush=True)
