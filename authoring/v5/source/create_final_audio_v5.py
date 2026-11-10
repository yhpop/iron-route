#!/usr/bin/env python3
"""Recreate the exact frozen 30-second soundtrack without overwriting any file."""
import argparse,hashlib,json,os,runpy,shutil,tempfile
from pathlib import Path
EXPECTED_SHA256='9fefc99b5565d9c689a3b96b703564411d0e9dd1f81c5f1c89d795e6925343d6'
def digest(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',required=True,help='New WAV path in the recovery project');a=p.parse_args();out=Path(a.output).resolve()
 if out.exists():
  if digest(out)!=EXPECTED_SHA256:raise RuntimeError('Existing output differs; refusing to overwrite it')
  print(json.dumps({'output':str(out),'sha256':EXPECTED_SHA256,'status':'existing_exact_match'}));return
 out.parent.mkdir(parents=True,exist_ok=True)
 legacy=Path(__file__).resolve().with_name('create_audio_original.py')
 with tempfile.TemporaryDirectory(prefix='audio_recovery_',dir=out.parent) as d:
  script=Path(d)/'create_audio_original.py';shutil.copyfile(legacy,script)
  runpy.run_path(str(script),run_name='__main__')
  candidate=Path(d)/'Tank_City_Final_Soundtrack.wav';actual=digest(candidate)
  if actual!=EXPECTED_SHA256:raise RuntimeError('Rebuilt audio SHA mismatch: '+actual+'; check numerical library versions before using it')
  import wave
  with wave.open(str(candidate)) as w:
   assert(w.getnchannels(),w.getframerate(),w.getsampwidth(),w.getnframes())==(2,48000,2,1440000)
  if out.exists():raise RuntimeError('Output appeared during rebuild; refusing to replace it')
  with candidate.open('rb') as f:os.fsync(f.fileno())
  os.replace(candidate,out)
 print(json.dumps({'output':str(out),'sha256':actual,'duration_seconds':30,'channels':2,'sample_rate':48000,'status':'rebuilt_exact_match'}))
if __name__=='__main__':main()
