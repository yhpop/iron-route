#!/usr/bin/env python3
"""Freeze an already reviewed v5 candidate without overwriting existing identity.

This helper never invokes Blender, rebuilds a scene, changes render settings, or
performs a visual review. --verify-only reads evidence without taking the render
lock or writing files, so it may run alongside an active production render.
"""
from __future__ import annotations
import argparse, contextlib, fcntl, hashlib, json, math, os, re, shutil, sys, tempfile, wave
from pathlib import Path

# A read-only verification must not create __pycache__ beside the active runner.
sys.dont_write_bytecode = True
from render_common_v5 import png_decode

REPRESENTATIVE_FRAMES = [60, 193, 324, 445, 523, 660]
SHOT_STARTS = [1, 121, 265, 385, 505, 601]
BLENDER_VERSION = '4.3.2'
RENDER = {'width':1280,'height':720,'fps':24,'frame_start':1,'frame_end':720,
          'engine':'BLENDER_EEVEE_NEXT','samples':96,'raytracing':True,
          'raytracing_resolution':'1','temporal_denoise':False,'threads':8}
EVENTS = {'stop_fire':481,'impact':510,'restart':601}


def stable_sha256(path):
    path = Path(path)
    before = path.stat()
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024*1024), b''):
            h.update(block)
    after = path.stat()
    fields = ('st_dev','st_ino','st_size','st_mtime_ns','st_ctime_ns')
    if any(getattr(before,k) != getattr(after,k) for k in fields):
        raise RuntimeError(f'File changed during verification: {path}')
    return h.hexdigest()


def canonical_sha256(data):
    return hashlib.sha256(json.dumps(data,sort_keys=True,separators=(',',':'),ensure_ascii=True).encode()).hexdigest()


def json_object(path):
    data = json.loads(Path(path).read_text())
    if not isinstance(data,dict):
        raise ValueError(f'Expected a JSON object: {path}')
    return data


def require_fields(data, expected, label):
    for key,value in expected.items():
        if data.get(key) != value:
            raise ValueError(f'{label}: {key} must equal {value!r}, found {data.get(key)!r}')


def verify_evidence(root, qa_prefix, production_id):
    candidate = root/'Tank_City_V5_Improved.blend'
    source_sha = stable_sha256(candidate)
    timeline_path = root/'qa'/'V5_full_timeline_validation.json'
    timeline = json_object(timeline_path)
    require_fields(timeline, {'source_sha256':source_sha,'blender_version':BLENDER_VERSION,
        'timeline_frames_checked':720,'tread_links_checked_per_frame':112,'invalid_drivers':[],
        'stop_frames_checked':[481,600],'shot_starts':SHOT_STARTS,'packed_scans':6,
        'native_resolution':[1280,720],'fps':24,'render_samples':96,
        'raytracing_resolution':'1','temporal_denoise':False}, 'Full-timeline QA')
    error = timeline.get('max_driver_geometry_error')
    if not isinstance(error,(int,float)) or not math.isfinite(error) or not 0 <= error <= 2e-5:
        raise ValueError('Full-timeline QA: driver geometry error is absent or exceeds 2e-5')
    qa = []
    for frame in REPRESENTATIVE_FRAMES:
        sidecar = root/'qa'/f'{qa_prefix}_frame_{frame:04d}.json'
        png = sidecar.with_suffix('.png')
        evidence = json_object(sidecar)
        require_fields(evidence, {'source_sha256':source_sha,'frame':frame,'engine':'EEVEE',
            'samples':96,'width':1280,'height':720,'fps':24,'threads':8,'raytracing':True,
            'raytracing_resolution':'1','temporal_denoise':False}, f'QA frame {frame}')
        # Absolute historical output paths can be stale after restoration. Bind by
        # verified local basename, complete PNG decode, hash, and frozen source.
        if Path(evidence.get('output','')).name != png.name:
            raise ValueError(f'QA frame {frame}: output basename does not match its evidence')
        png_decode(png,1280,720)
        image_sha = stable_sha256(png)
        if image_sha != evidence.get('png_sha256'):
            raise ValueError(f'QA frame {frame}: PNG SHA256 mismatch')
        qa.append({'frame':frame,'png':str(png),'png_sha256':image_sha,
                   'sidecar_sha256':stable_sha256(sidecar)})
    review_path = root/'qa'/'V5_source_freeze_review.json'
    review = json_object(review_path)
    require_fields(review, {'source_sha256':source_sha,
                    'frames_visually_reviewed':REPRESENTATIVE_FRAMES}, 'Visual source review')
    # The first status is the explicit sign-off already recorded for the original
    # frozen candidate. New recovery reviews may use the more explicit schema.
    if review.get('status') == 'production_source_frozen_pending_motion_and_final_film_validation':
        pass
    elif review.get('status') == 'approved_for_production_freeze':
        require_fields(review, {'review_kind':'professional_visual_source_review','approved':True},
                       'Visual source review')
    else:
        raise ValueError('Visual source review does not explicitly approve this source for freeze')
    observations = review.get('observations')
    if (not isinstance(observations,list) or len(observations)<6 or
            any(not isinstance(x,str) or not x.strip() for x in observations)):
        raise ValueError('Visual source review requires substantive observations covering all six stills')
    if not isinstance(review.get('scope_limits'),list) or not review['scope_limits']:
        raise ValueError('Visual source review must record remaining motion/final-film QA limitations')
    if review.get('unresolved_blockers'):
        raise ValueError('Visual source review has unresolved blockers')
    audio = root/'source'/'Tank_City_Final_Soundtrack.wav'
    with wave.open(str(audio),'rb') as wav:
        if (wav.getframerate(),wav.getnchannels(),wav.getsampwidth(),wav.getnframes(),wav.getcomptype()) != (48000,2,2,1440000,'NONE'):
            raise ValueError('Soundtrack must be exactly 30 seconds, 48 kHz stereo signed 16-bit PCM')
        payload = wav.readframes(wav.getnframes()+1)
        if len(payload) != 1440000*2*2:
            raise ValueError('Soundtrack PCM payload is truncated')
    audio_sha = stable_sha256(audio)
    config = {'schema_version':1,'production_id':production_id,'blender_version':BLENDER_VERSION,
              'blend_file':'Tank_City_V5_Production.blend','blend_sha256':source_sha,
              'audio_file':'source/Tank_City_Final_Soundtrack.wav','audio_sha256':audio_sha,
              'render':dict(RENDER),'shot_starts':list(SHOT_STARTS),'events':dict(EVENTS)}
    evidence = {'timeline_file':str(timeline_path),'timeline_sha256':stable_sha256(timeline_path),
                'visual_review_file':str(review_path),'visual_review_sha256':stable_sha256(review_path),
                'representative_qa':qa}
    return config,evidence


def check_existing(root,config,require_both=False):
    frozen = root/config['blend_file']; config_path = root/'production_config.json'
    for path in (frozen,config_path):
        if path.is_symlink(): raise RuntimeError(f'Refusing symlinked production target: {path}')
    if frozen.exists() and stable_sha256(frozen) != config['blend_sha256']:
        raise RuntimeError(f'Existing production source has a different SHA256; refusing overwrite: {frozen}')
    if config_path.exists() and json_object(config_path) != config:
        raise RuntimeError(f'Existing production config differs; refusing overwrite: {config_path}')
    if require_both and (not frozen.is_file() or not config_path.is_file()):
        raise RuntimeError('Read-only verification requires existing matching production source and config')
    return frozen,config_path


def fsync_directory(path):
    fd = os.open(path,os.O_RDONLY|os.O_DIRECTORY)
    try: os.fsync(fd)
    finally: os.close(fd)


def publish_no_replace(temp,destination):
    # Same-directory hard-link publication is atomic and cannot clobber an
    # existing target, even if an unrelated process races the render lock.
    os.link(temp,destination)
    fsync_directory(destination.parent)


def freeze(root,config):
    frozen,config_path = check_existing(root,config)
    created = []
    if not frozen.exists():
        with tempfile.NamedTemporaryFile(prefix='.freeze_v5_',suffix='.blend.partial',dir=root,delete=False) as out:
            temp = Path(out.name)
            try:
                with (root/'Tank_City_V5_Improved.blend').open('rb') as src:
                    shutil.copyfileobj(src,out,1024*1024)
                out.flush(); os.fsync(out.fileno())
            except BaseException:
                temp.unlink(missing_ok=True); raise
        try:
            if stable_sha256(temp) != config['blend_sha256']:
                raise RuntimeError('Candidate changed during byte-copy; production source not published')
            publish_no_replace(temp,frozen); created.append(str(frozen))
        finally: temp.unlink(missing_ok=True)
    if not config_path.exists():
        # A failed config write can leave a matching frozen source. The next
        # invocation re-verifies all evidence and can finish this safely.
        payload = (json.dumps(config,indent=2)+'\n').encode()
        with tempfile.NamedTemporaryFile(prefix='.freeze_v5_',suffix='.json.partial',dir=root,delete=False) as out:
            temp = Path(out.name)
            try: out.write(payload); out.flush(); os.fsync(out.fileno())
            except BaseException: temp.unlink(missing_ok=True); raise
        try: publish_no_replace(temp,config_path); created.append(str(config_path))
        finally: temp.unlink(missing_ok=True)
    check_existing(root,config,require_both=True)
    return created


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root',type=Path,default=Path(__file__).resolve().parent.parent)
    p.add_argument('--qa-prefix',default='V5_Verified')
    p.add_argument('--production-id',default='tank-city-v5-20261004')
    p.add_argument('--verify-only',action='store_true',help='Read-only; safe while the render lock is held')
    args = p.parse_args(argv)
    root = args.root.resolve()
    if not re.fullmatch(r'[A-Za-z0-9_-]+',args.qa_prefix): p.error('qa-prefix must be a safe basename')
    if not re.fullmatch(r'[A-Za-z0-9_-]+',args.production_id) or 'v5' not in args.production_id.lower():
        p.error('production-id must be a safe v5 identifier')
    lock = None
    try:
        if not args.verify_only:
            lock = (root/'render_slot.lock').open('a+')
            try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            except BlockingIOError:
                raise RuntimeError('Render slot is busy; freeze refused. --verify-only is safe during rendering')
        config,evidence = verify_evidence(root,args.qa_prefix,args.production_id)
        check_existing(root,config,require_both=args.verify_only)
        created = [] if args.verify_only else freeze(root,config)
        fp = canonical_sha256(config)
        result = {'status':'verified_read_only' if args.verify_only else 'frozen' if created else 'already_frozen',
                  'created':created,'production_source':str(root/config['blend_file']),
                  'source_sha256':config['blend_sha256'],'config_file':str(root/'production_config.json'),
                  'config_file_sha256':stable_sha256(root/'production_config.json'),
                  'config_sha256':fp,'audio_sha256':config['audio_sha256'],
                  'production_directory':str(root/'production_v5'/(args.production_id+'_'+fp[:16])),
                  'remaining_gates':['first-48-frame motion review','complete 720-frame film and audio review'],
                  'evidence':evidence}
        print(json.dumps(result,indent=2,sort_keys=True))
        return 0
    finally:
        if lock is not None:
            with contextlib.suppress(OSError): fcntl.flock(lock,fcntl.LOCK_UN)
            lock.close()


if __name__ == '__main__':
    try: sys.exit(main())
    except (OSError,ValueError,RuntimeError,wave.Error) as exc:
        print(f'FREEZE_REFUSED: {exc}',file=sys.stderr); sys.exit(1)
