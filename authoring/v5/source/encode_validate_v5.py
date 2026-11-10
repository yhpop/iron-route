"""Native 24-fps shot/final encodes with probe, full decode, and source evidence."""
from __future__ import annotations
import json, os, subprocess, time
from fractions import Fraction
from pathlib import Path
from render_common_v5 import *

# Identity geometry: convert full-range display RGB into limited-range BT.709 YUV.
# This matrix/range operation preserves the rendered display tone response.
COLOR_FILTER=('scale=w=iw:h=ih:in_range=full:out_range=limited:'
              'out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,'
              'format=pix_fmts=yuv420p,'
              'setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709')
# FFmpeg 7.1 can pass unspecified input-frame primaries/transfer through despite
# output flags; set frame metadata above and explicit x264 SPS/VUI values here.
X264_VUI_PARAMS='colorprim=bt709:transfer=bt709:colormatrix=bt709:fullrange=off'
ENCODING={'video_codec':'libx264','crf':16,'preset':'medium','pixel_format':'yuv420p',
          'input_rgb_range':'full','video_filter':COLOR_FILTER,'x264_vui_params':X264_VUI_PARAMS,
          'color_space':'bt709','color_transfer':'bt709','color_primaries':'bt709','color_range':'tv',
          'audio_codec':'aac','audio_bitrate':'256k','audio_rate':48000,'audio_channels':2}

def probe_media(path, first, last, audio_required):
    cmd=['ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(path)]
    p=subprocess.run(cmd,capture_output=True,text=True,timeout=300)
    if p.returncode or p.stderr.strip(): raise RuntimeError(f'ffprobe failed: {p.stderr}')
    result=json.loads(p.stdout)
    vs=[s for s in result['streams'] if s['codec_type']=='video']
    aud=[s for s in result['streams'] if s['codec_type']=='audio']
    n=last-first+1; duration=n/24
    if len(vs)!=1: raise RuntimeError('Expected exactly one video stream')
    v=vs[0]
    checks=(v.get('codec_name')=='h264', v.get('width')==1280, v.get('height')==720,
            v.get('avg_frame_rate')=='24/1', v.get('r_frame_rate')=='24/1',
            v.get('pix_fmt')==ENCODING['pixel_format'],
            all(v.get(key)==ENCODING[key] for key in
                ('color_space','color_transfer','color_primaries','color_range')),
            int(v.get('nb_read_frames','-1'))==n,
            abs(float(v.get('duration','-1'))-duration)<.001)
    if not all(checks): raise RuntimeError(f'Video verification failed: {v}')
    if audio_required:
        if len(aud)!=1: raise RuntimeError('Expected exactly one audio stream')
        a=aud[0]
        if (a.get('codec_name')!='aac' or int(a.get('sample_rate',0))!=48000 or
                a.get('channels')!=2 or abs(float(a.get('duration','-1'))-duration)>.002):
            raise RuntimeError(f'Audio verification failed: {a}')
    elif aud: raise RuntimeError('Unexpected audio stream')
    if abs(float(result['format'].get('duration','-1'))-duration)>.002:
        raise RuntimeError('Container duration mismatch')
    return result

def full_decode(path, run, log):
    run(['ffmpeg','-hide_banner','-v','error','-xerror','-err_detect','explode','-i',str(path),
         '-map','0:v:0','-map','0:a:0?','-f','null','-'],log,'decode',900)
    # The command is intentionally quiet; any error diagnostics fail verification.
    if Path(log).read_text(errors='replace').strip():
        raise RuntimeError(f'Full decode reported diagnostics: {log}')

def encode_segment(config_path,c,fp,root,good,first,last,name,run,final=False):
    n=last-first+1
    if any(f not in good for f in range(first,last+1)):
        raise RuntimeError(f'Cannot encode missing frames in {first}..{last}')
    if final and (first,last)!=(1,720): raise RuntimeError('Final must contain frames 1..720')
    # Revalidate every source PNG immediately before an encode, never trust status alone.
    frame_evidence=[]
    for frame in range(first,last+1):
        m,error=verify_frame(root,frame,c,fp)
        if not m: raise RuntimeError(f'Frame {frame} invalid before encode: {error}')
        frame_evidence.append({'frame':frame,'png_sha256':m['png_sha256']})
    audio=(Path(config_path).resolve().parent/c['audio_file']).resolve() if c.get('audio_file') else None
    if final and audio is None: raise RuntimeError('Final encode requires the approved soundtrack')
    if audio and sha256(audio)!=c['audio_sha256']: raise RuntimeError('Soundtrack changed')
    identity={'schema_version':SCHEMA,'config_sha256':fp,'source_sha256':c['blend_sha256'],
              'audio_sha256':c.get('audio_sha256') if audio else None,'first_frame':first,'last_frame':last,
              'frame_count':n,'frames':frame_evidence,'all_frames_sha256':digest(frame_evidence),
              'encoding':ENCODING}
    outdir=root/('final' if final else 'checkpoints'); outdir.mkdir(parents=True,exist_ok=True)
    output=outdir/(name+'.mp4'); metadata=output.with_suffix('.json')
    stamp=f'{time.time_ns()}_{os.getpid()}'
    if output.exists() and metadata.exists():
        try:
            old=json.loads(metadata.read_text())
            if any(old.get(k)!=v for k,v in identity.items()): raise ValueError('Encode identity mismatch')
            if old.get('file_sha256')!=sha256(output): raise ValueError('Encode SHA256 mismatch')
            probe_media(output,first,last,bool(audio))
            full_decode(output,run,root/'logs'/f'{name}_reuse_decode_{stamp}.log')
            if final:
                finish_final_artifacts(root,good,old,metadata,frame_evidence,c,fp)
            return output,old
        except (RuntimeError,ValueError,OSError,subprocess.SubprocessError) as exc:
            append_event(root/'events.jsonl',{'event':'invalid_checkpoint','path':str(output),'reason':str(exc)})
    # Never overwrite an old artifact without retaining it for diagnosis.
    for previous in (output,metadata):
        if previous.exists():
            failed=root/'failed_artifacts'; failed.mkdir(exist_ok=True)
            os.replace(previous,failed/(previous.name+'.'+stamp))
    temporary=outdir/(name+'.'+stamp+'.partial.mp4')
    cmd=['ffmpeg','-hide_banner','-nostdin','-v','warning','-y','-framerate','24',
         '-start_number',str(first),'-i',str(root/'frames'/'frame_%04d.png')]
    if audio:
        cmd+=['-ss',f'{(first-1)/24:.9f}','-i',str(audio)]
    cmd+=['-map','0:v:0']
    if audio: cmd+=['-map','1:a:0']
    cmd+=['-frames:v',str(n),'-t',f'{n/24:.9f}','-c:v','libx264','-crf','16',
          '-preset','medium','-vf',COLOR_FILTER,'-pix_fmt','yuv420p','-x264-params',X264_VUI_PARAMS,
          '-colorspace',ENCODING['color_space'],'-color_trc',ENCODING['color_transfer'],
          '-color_primaries',ENCODING['color_primaries'],'-color_range',ENCODING['color_range'],
          '-r','24','-fps_mode','cfr','-threads','4']
    if audio: cmd+=['-c:a','aac','-b:a','256k','-ar','48000','-ac','2']
    else: cmd+=['-an']
    cmd+=['-movflags','+faststart',str(temporary)]
    try:
        run(cmd,root/'logs'/f'{name}_encode_{stamp}.log','encode',1800)
        if not temporary.is_file() or temporary.stat().st_size==0: raise RuntimeError('Encode artifact missing')
        probe=probe_media(temporary,first,last,bool(audio))
        full_decode(temporary,run,root/'logs'/f'{name}_decode_{stamp}.log')
        with temporary.open('rb') as f: os.fsync(f.fileno())
        os.replace(temporary,output); fsync_dir(outdir)
        meta={**identity,'file_sha256':sha256(output),'file_bytes':output.stat().st_size,
              'file':str(output),'complete':True,'full_decode_zero_errors':True,
              'ffprobe':probe,'utc':utc(),'epoch':time.time()}
        atomic_json(metadata,meta)
        if final:
            finish_final_artifacts(root,good,meta,metadata,frame_evidence,c,fp)
        append_event(root/'events.jsonl',{'event':'final_verified' if final else 'checkpoint_verified',
                     'path':str(output),'file_sha256':meta['file_sha256'],'first':first,'last':last})
        return output,meta
    except BaseException:
        # Keep partial movie, complete raw frames, logs, and any earlier encodes.
        raise

def finish_final_artifacts(root,good,meta,metadata,frame_evidence,c,fp):
    sheet=contact_sheet(root,good)
    manifest=root/'final'/'all_frames_manifest.json'
    atomic_json(manifest,{'config_sha256':fp,'source_sha256':c['blend_sha256'],
                'frames':frame_evidence,'all_frames_sha256':digest(frame_evidence)})
    meta['contact_sheet']={'path':str(sheet),'sha256':sha256(sheet)}
    meta['frame_manifest']={'path':str(manifest),'sha256':sha256(manifest)}
    meta['artifacts_complete']=True
    atomic_json(metadata,meta)

def contact_sheet(root,good):
    from PIL import Image,ImageDraw
    chosen=[1,60,120,121,180,264,265,324,384,385,444,480,481,505,510,540,600,601,660,720]
    sheet=Image.new('RGB',(1280,5*204),(18,20,24)); draw=ImageDraw.Draw(sheet)
    for i,f in enumerate(chosen):
        with Image.open(frame_paths(root,f)[0]) as im:
            im.load(); thumbnail=im.convert('RGB'); thumbnail.thumbnail((320,180))
        x=(i%4)*320; y=(i//4)*204
        sheet.paste(thumbnail,(x,y)); draw.text((x+8,y+183),f'Frame {f:04d} | {(f-1)/24:.3f}s',fill='white')
    path=root/'final'/'contact_sheet.jpg'; temp=path.with_name('contact_sheet.partial.jpg')
    sheet.save(temp,quality=94); os.replace(temp,path); fsync_dir(path.parent)
    return path
