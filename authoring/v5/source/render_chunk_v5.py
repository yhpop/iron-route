"""Blender entry point. Invoked only by render_sequence_v5 under render_slot.lock."""
import argparse, json, os, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from render_common_v5 import *

def main():
    import bpy
    p=argparse.ArgumentParser()
    p.add_argument('--config',required=True); p.add_argument('--fingerprint',required=True)
    p.add_argument('--frames',required=True); p.add_argument('--threads',type=int,choices=[4,8],required=True)
    p.add_argument('--lock-fd',type=int,required=True)
    a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
    # A child inherits the held lock fd, so an orphan renderer still owns the slot.
    inherited=os.fstat(a.lock_fd)
    expected=os.stat(Path(a.config).resolve().parent/'render_slot.lock')
    if (inherited.st_dev,inherited.st_ino)!=(expected.st_dev,expected.st_ino):
        raise RuntimeError('Wrong inherited render lock')
    c,fp,root=load_config(a.config,verify_audio=False)
    if fp!=a.fingerprint: raise RuntimeError('Config changed before render')
    actual_blender_version='.'.join(str(part) for part in bpy.app.version)
    if 'blender_version' in c and actual_blender_version!=c['blender_version']:
        raise RuntimeError(f'Blender version mismatch: required {c["blender_version"]}, running {actual_blender_version}')
    if Path(bpy.data.filepath).resolve()!=(Path(a.config).resolve().parent/c['blend_file']).resolve():
        raise RuntimeError('Blender opened the wrong source')
    frames=[int(f) for f in a.frames.split(',')]
    if not 1<=len(frames)<=2 or len(set(frames))!=len(frames) or any(f<1 or f>720 for f in frames):
        raise ValueError('A batch must contain one or two unique production frames')
    s=bpy.context.scene
    s.render.engine=c['render']['engine']
    s.render.resolution_x=1280; s.render.resolution_y=720; s.render.resolution_percentage=100
    s.render.fps=24; s.render.fps_base=1.0
    s.frame_start=1; s.frame_end=720
    s.render.threads_mode='FIXED'; s.render.threads=a.threads
    s.render.image_settings.file_format='PNG'; s.render.image_settings.color_mode='RGB'
    s.render.image_settings.color_depth='8'; s.render.image_settings.compression=15
    s.render.use_file_extension=True; s.render.use_border=False
    s.eevee.taa_render_samples=96; s.eevee.use_raytracing=True
    rt=s.eevee.ray_tracing_options
    # Deliberately fail rather than silently omit unsupported quality properties.
    rt.resolution_scale='1'; rt.denoise_temporal=False
    if (s.eevee.taa_render_samples!=96 or not s.eevee.use_raytracing or
            rt.resolution_scale!='1' or rt.denoise_temporal):
        raise RuntimeError('Required production quality settings were not applied')
    (root/'frames').mkdir(parents=True,exist_ok=True)
    for frame in frames:
        existing,error=verify_frame(root,frame,c,fp)
        if existing:
            print('FRAME_ALREADY_VALID',frame,flush=True); continue
        final,sidecar=frame_paths(root,frame)
        if final.exists() or sidecar.exists():
            raise RuntimeError(f'Unquarantined invalid frame {frame}: {error}')
        temp=final.with_name(final.stem+f'.{os.getpid()}.{time.time_ns()}.partial.png')
        s.frame_set(frame); s.render.filepath=str(temp)
        started=time.time()
        bpy.ops.render.render(write_still=True)
        if not temp.is_file(): raise RuntimeError(f'Render did not create {temp}')
        decoded=png_decode(temp)
        with temp.open('rb') as image_file: os.fsync(image_file.fileno())
        image_hash=sha256(temp)
        os.replace(temp,final); fsync_dir(final.parent)
        meta={'schema_version':SCHEMA,'frame':frame,'complete':True,'provenance':'blender_render_v5',
              'config_sha256':fp,'source_sha256':c['blend_sha256'],'render_settings':c['render'],
              'actual_threads':a.threads,'blender_version':actual_blender_version,
              'blender_version_string':bpy.app.version_string,
              'png_sha256':image_hash,'png':decoded,'utc':utc(),'epoch':time.time(),
              'render_seconds':time.time()-started,'renderer_pid':os.getpid()}
        atomic_json(sidecar,meta)
        append_event(root/'frame_events.jsonl',{'event':'frame_complete',**meta})
        print('FRAME_COMPLETE',json.dumps(meta,sort_keys=True),flush=True)
    print('BATCH_COMPLETE',json.dumps({'frames':frames,'config_sha256':fp}),flush=True)

if __name__=='__main__': main()
