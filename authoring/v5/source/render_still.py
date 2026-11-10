import bpy,sys,argparse,time,json,os,hashlib
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--frame',type=int,required=True);p.add_argument('--engine',choices=['EEVEE','CYCLES'],default='EEVEE');p.add_argument('--samples',type=int,default=64);p.add_argument('--label',required=True);p.add_argument('--threads',type=int,default=4);p.add_argument('--raytracing',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);root=Path(__file__).resolve().parent.parent;s=bpy.context.scene
s.render.resolution_x=1280;s.render.resolution_y=720;s.render.resolution_percentage=100;s.render.fps=24;s.render.threads_mode='FIXED';s.render.threads=a.threads;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGB'
if a.engine=='EEVEE':
 s.render.engine='BLENDER_EEVEE_NEXT';s.eevee.taa_render_samples=a.samples;s.eevee.use_raytracing=a.raytracing
 if a.raytracing:
  opts=s.eevee.ray_tracing_options
  if hasattr(opts,'resolution_scale'):opts.resolution_scale='1'
  if hasattr(opts,'screen_trace_quality'):opts.screen_trace_quality=.8
  if hasattr(opts,'denoise_temporal'):opts.denoise_temporal=False
  if hasattr(opts,'trace_max_roughness'):opts.trace_max_roughness=.8
  if hasattr(s.eevee,'fast_gi_ray_count'):s.eevee.fast_gi_ray_count=4
  print('RAYTRACING_OPTIONS',[(p.identifier,str(getattr(opts,p.identifier))) for p in opts.bl_rna.properties if p.identifier!='rna_type'],flush=True)
else:
 s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=a.samples;s.cycles.use_denoising=False;s.cycles.use_adaptive_sampling=True;s.cycles.adaptive_threshold=.035;s.cycles.max_bounces=6;s.cycles.diffuse_bounces=3;s.cycles.glossy_bounces=3;s.cycles.transmission_bounces=2;s.cycles.volume_bounces=1;s.cycles.transparent_max_bounces=8;s.cycles.sample_clamp_indirect=3
s.frame_set(a.frame);final=root/'qa'/f'{a.label}_frame_{a.frame:04d}.png';s.render.filepath=str(final)+'.partial.png';start=time.time();bpy.ops.render.render(write_still=True);os.replace(s.render.filepath,final);result={'frame':a.frame,'engine':a.engine,'samples':a.samples,'seconds':round(time.time()-start,3),'output':str(final),'source_sha256':hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),'png_sha256':hashlib.sha256(final.read_bytes()).hexdigest(),'width':1280,'height':720,'fps':24,'threads':a.threads,'raytracing':bool(s.eevee.use_raytracing),'raytracing_resolution':s.eevee.ray_tracing_options.resolution_scale,'temporal_denoise':bool(s.eevee.ray_tracing_options.denoise_temporal)};(root/'qa'/f'{a.label}_frame_{a.frame:04d}.json').write_text(json.dumps(result,indent=2));print('PROBE_DONE',json.dumps(result),flush=True)
