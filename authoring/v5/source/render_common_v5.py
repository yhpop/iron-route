"""Shared immutable identity, atomic writes, and frame evidence for v5 renders."""
from __future__ import annotations
import contextlib, datetime, fcntl, hashlib, json, os, re, struct, time, zlib
from pathlib import Path

SCHEMA = 1

def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def sha256(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda: f.read(1024 * 1024), b''):
            h.update(b)
    return h.hexdigest()

def canonical(data):
    return json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()

def digest(data):
    return hashlib.sha256(canonical(data)).hexdigest()

def atomic_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + f'.{os.getpid()}.{time.time_ns()}.partial')
    with temp.open('wb') as f:
        f.write(json.dumps(data, indent=2, sort_keys=True).encode() + b'\n')
        f.flush(); os.fsync(f.fileno())
    os.replace(temp, path)
    fsync_dir(path.parent)

def fsync_dir(path):
    try:
        fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
        try: os.fsync(fd)
        finally: os.close(fd)
    except OSError:
        pass

def append_event(path, event):
    with Path(path).open('a') as f:
        f.write(json.dumps({'utc': utc(), 'epoch': time.time(), **event}, sort_keys=True) + '\n')
        f.flush(); os.fsync(f.fileno())

def load_config(path, verify_source=True, verify_audio=True):
    path = Path(path).resolve()
    c = json.loads(path.read_text())
    required = {'schema_version', 'production_id', 'blend_file', 'blend_sha256', 'render', 'shot_starts', 'events'}
    if required - c.keys():
        raise ValueError(f'Missing config keys: {sorted(required - c.keys())}')
    if c['schema_version'] != SCHEMA:
        raise ValueError('Unsupported config schema')
    if 'blender_version' in c and (not isinstance(c['blender_version'],str) or
            not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+',c['blender_version'])):
        raise ValueError('Optional blender_version must have major.minor.patch format, e.g. 4.3.2')
    if not re.fullmatch(r'[A-Za-z0-9_-]+', c['production_id']) or 'v5' not in c['production_id'].lower():
        raise ValueError('production_id must be a safe v5 identifier')
    expected = {'width':1280, 'height':720, 'fps':24, 'frame_start':1, 'frame_end':720,
                'engine':'BLENDER_EEVEE_NEXT', 'samples':96, 'raytracing':True,
                'raytracing_resolution':'1', 'temporal_denoise':False, 'threads':8}
    if c['render'] != expected:
        raise ValueError(f'Frozen production render settings must equal {expected}')
    if c['shot_starts'] != [1,121,265,385,505,601]:
        raise ValueError('Shot boundaries differ from frozen production')
    if c['events'] != {'stop_fire':481, 'impact':510, 'restart':601}:
        raise ValueError('Action landmarks differ from frozen production')
    if not re.fullmatch(r'[a-f0-9]{64}', c['blend_sha256']):
        raise ValueError('blend_sha256 must be a lowercase SHA256')
    blend = (path.parent / c['blend_file']).resolve()
    if verify_source and (not blend.is_file() or sha256(blend) != c['blend_sha256']):
        raise ValueError(f'Frozen source missing or SHA256 mismatch: {blend}')
    if c.get('audio_file'):
        if not re.fullmatch(r'[a-f0-9]{64}', c.get('audio_sha256', '')):
            raise ValueError('Configured audio needs audio_sha256')
        audio = (path.parent / c['audio_file']).resolve()
        if verify_audio and (not audio.is_file() or sha256(audio) != c['audio_sha256']):
            raise ValueError(f'Audio source missing or SHA256 mismatch: {audio}')
    fingerprint = digest(c)
    root = path.parent / 'production_v5' / (c['production_id'] + '_' + fingerprint[:16])
    return c, fingerprint, root

def frame_paths(root, frame):
    p = Path(root) / 'frames' / f'frame_{frame:04d}.png'
    return p, p.with_suffix('.json')

def png_decode(path, width=1280, height=720):
    """Verify CRC and complete pixel decode; Pillow is preferred outside Blender."""
    path = Path(path)
    # First inspect all PNG chunks, including their CRCs, and bounded inflate.
    raw = path.read_bytes()
    if raw[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('Not a PNG')
    pos = 8; idats = []; header = None; ended = False
    while pos < len(raw):
        if pos + 12 > len(raw): raise ValueError('Truncated PNG chunk')
        n = struct.unpack('>I', raw[pos:pos+4])[0]
        kind = raw[pos+4:pos+8]
        end = pos + n + 12
        if end > len(raw): raise ValueError('Truncated PNG payload')
        payload = raw[pos+8:pos+8+n]
        crc = struct.unpack('>I', raw[pos+8+n:end])[0]
        if zlib.crc32(kind + payload) & 0xffffffff != crc: raise ValueError('PNG CRC mismatch')
        if kind == b'IHDR':
            if header is not None or pos != 8 or n != 13: raise ValueError('Invalid PNG IHDR')
            header = struct.unpack('>IIBBBBB', payload)
        elif kind == b'IDAT': idats.append(payload)
        elif kind == b'IEND':
            if n or end != len(raw): raise ValueError('Invalid PNG end')
            ended = True; break
        pos = end
    if not ended or not header or not idats: raise ValueError('Incomplete PNG')
    w,h,bits,color,compression,filter_method,interlace = header
    if (w,h) != (width,height) or bits != 8 or color not in (2,6) or compression or filter_method or interlace:
        raise ValueError(f'PNG must be native {width}x{height}, RGB/RGBA 8-bit noninterlaced; got {header}')
    channels = 3 if color == 2 else 4
    expected = (w * channels + 1) * h
    inflater = zlib.decompressobj()
    pixels = inflater.decompress(b''.join(idats), expected + 1)
    if len(pixels) != expected or not inflater.eof or inflater.unconsumed_tail or inflater.unused_data:
        raise ValueError('PNG incomplete or excessive deflated pixels')
    if any(pixels[y*(w*channels+1)] > 4 for y in range(h)):
        raise ValueError('PNG invalid scanline filter')
    try:
        from PIL import Image, ImageFile
        ImageFile.LOAD_TRUNCATED_IMAGES = False
        with Image.open(path) as im:
            im.load()
            if im.size != (width,height): raise ValueError('Decoded PNG size mismatch')
            if len(im.tobytes()) != w*h*channels: raise ValueError('Incomplete decoded pixels')
    except ImportError:
        # Blender's Python need not have Pillow. Undo every PNG scanline filter.
        previous = bytearray(w*channels)
        stride = w*channels + 1
        for y in range(h):
            mode = pixels[y*stride]; row = bytearray(pixels[y*stride+1:(y+1)*stride])
            if mode:
                for x in range(len(row)):
                    a = row[x-channels] if x >= channels else 0
                    b = previous[x]; c = previous[x-channels] if x >= channels else 0
                    if mode == 1: predictor = a
                    elif mode == 2: predictor = b
                    elif mode == 3: predictor = (a+b)//2
                    else:
                        p = a+b-c; pa,pb,pc = abs(p-a),abs(p-b),abs(p-c)
                        predictor = a if pa <= pb and pa <= pc else b if pb <= pc else c
                    row[x] = (row[x]+predictor) & 255
            previous = row
    return {'width':w,'height':h,'bit_depth':bits,'channels':channels,'bytes':path.stat().st_size}

def verify_frame(root, frame, config, fingerprint):
    p, sidecar = frame_paths(root, frame)
    try:
        m = json.loads(sidecar.read_text())
        if not isinstance(m,dict): raise ValueError('Frame sidecar must be a JSON object')
        required = {'schema_version':SCHEMA, 'frame':frame, 'config_sha256':fingerprint,
                    'source_sha256':config['blend_sha256'], 'render_settings':config['render'],
                    'complete':True}
        if 'blender_version' in config:
            required['blender_version']=config['blender_version']
        for key,value in required.items():
            if m.get(key) != value: raise ValueError(f'Sidecar {key} mismatch')
        if m.get('provenance') not in ('blender_render_v5','trusted_qa_import_v5'):
            raise ValueError('Untrusted frame provenance')
        decoded = png_decode(p, config['render']['width'], config['render']['height'])
        if sha256(p) != m.get('png_sha256'): raise ValueError('Frame SHA256 mismatch')
        if decoded != m.get('png'): raise ValueError('Frame decoded metadata mismatch')
        return m, None
    except (OSError, ValueError, KeyError, TypeError, zlib.error, struct.error) as exc:
        return None, str(exc)

def scan_frames(root, config, fingerprint):
    good, bad = {}, {}
    for f in range(config['render']['frame_start'], config['render']['frame_end']+1):
        m,error = verify_frame(root,f,config,fingerprint)
        if m: good[f] = m
        else:
            p,s = frame_paths(root,f)
            if p.exists() or s.exists(): bad[f] = error
    return good,bad

def counts(good, end=720):
    contiguous = 0
    while contiguous+1 in good: contiguous += 1
    return {'total_complete':len(good),'contiguous_complete':contiguous,
            'requested_complete':sum(1 for f in good if f <= end),'requested_end':end}

@contextlib.contextmanager
def render_lock(config_path):
    # The same file/inode is used by run_single_probe.py. Never unlink it.
    lockpath = Path(config_path).resolve().parent / 'render_slot.lock'
    with lockpath.open('a+') as lock:
        try: fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError: raise RuntimeError(f'Render slot is busy: {lockpath}')
        try: yield lock
        finally: fcntl.flock(lock, fcntl.LOCK_UN)
