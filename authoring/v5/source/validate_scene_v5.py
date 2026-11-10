"""Non-render, full timeline geometry/driver/source validation before freezing."""
import bpy,sys,json,math,hashlib,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from improve_running_gear import belt_path,LENGTH,LINKS_PER_SIDE,ROAD_RADIUS,GUIDE_RADIUS
P=Path(__file__).resolve().parent.parent;s=bpy.context.scene
root=bpy.data.objects['TANK / animated motion controller'];links=sorted([o for o in s.objects if o.name.startswith('Tread link ')],key=lambda o:o.name)
assert len(links)==112
worst=0;invalid=set();stop=[];marker_frames=[m.frame for m in s.timeline_markers if m.camera]
assert sorted(marker_frames)==[1,121,265,385,505,601],marker_frames
for f in range(1,721):
 s.frame_set(f);bpy.context.view_layer.update();travel=root.location.y
 for o in links:
  i=int(o.name.rsplit(' ',1)[1]);expected=belt_path((i*LENGTH/LINKS_PER_SIDE-(travel+20))%LENGTH)
  err=max(abs(o.location.y-expected[0]),abs(o.location.z-expected[1]),abs(math.sin(o.rotation_euler.x)-math.sin(expected[2])),abs(math.cos(o.rotation_euler.x)-math.cos(expected[2])))
  worst=max(worst,err)
  if err>2e-5:raise AssertionError((f,o.name,err,list(o.location),expected))
 for o in s.objects:
  if o.animation_data:
   for fc in o.animation_data.drivers:
    if not fc.driver.is_valid:invalid.add((o.name,fc.data_path,fc.array_index))
  assert all(math.isfinite(float(v)) for v in o.matrix_world.translation),(f,o.name)
 if 481<=f<=600:stop.append([travel]+[float(o['belt_position']) for o in links])
assert not invalid,sorted(invalid)
assert max(row[0] for row in stop)-min(row[0] for row in stop)<1e-6
for i in range(1,113):assert max(row[i] for row in stop)-min(row[i] for row in stop)<1e-6
assert len([i for i in bpy.data.images if i.packed_file and i.name.startswith(('worn_asphalt','damaged_concrete_floor'))])==6
assert(s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.render.fps,s.render.fps_base)==(1280,720,100,24,1)
assert s.eevee.taa_render_samples==96 and s.eevee.use_raytracing and s.eevee.ray_tracing_options.resolution_scale=='1' and not s.eevee.ray_tracing_options.denoise_temporal
s.frame_set(1)
r={'source_sha256':hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),'blender_version':bpy.app.version_string,'timeline_frames_checked':720,'tread_links_checked_per_frame':112,'max_driver_geometry_error':worst,'invalid_drivers':list(invalid),'stop_frames_checked':[481,600],'shot_starts':sorted(marker_frames),'packed_scans':6,'native_resolution':[1280,720],'fps':24,'render_samples':96,'raytracing_resolution':'1','temporal_denoise':False,'epoch':time.time()}
(P/'qa'/'V5_full_timeline_validation.json').write_text(json.dumps(r,indent=2));print('V5_FULL_TIMELINE_VALIDATION',json.dumps(r),flush=True)
