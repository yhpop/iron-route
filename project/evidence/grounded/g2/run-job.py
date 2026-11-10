#!/usr/bin/env python3
"""Bounded process-group runner; no shell, installations, or inherited runner."""
import ctypes, datetime, hashlib, json, os, pathlib, signal, subprocess, sys, time
ROOT=pathlib.Path(__file__).resolve().parents[3]
OUT=pathlib.Path(__file__).resolve().parent
# Adopt orphaned descendants so their terminal status can be waited, not leaked.
ctypes.CDLL(None).prctl(36,1,0,0,0)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def identity():
    paths=[*ROOT.joinpath('work/src').rglob('*'),*ROOT.joinpath('work/tests').rglob('*'),*ROOT.joinpath('work/scripts').rglob('*'),*OUT.glob('*.py'),*OUT.glob('*.mjs')]
    return {str(p.relative_to(ROOT)):sha(p) for p in sorted(paths) if p.is_file()}
def reap():
    while True:
        try:
            pid,_=os.waitpid(-1,os.WNOHANG)
            if not pid: break
        except ChildProcessError: break

def living(group):
    result=[]
    for p in pathlib.Path('/proc').glob('[0-9]*/stat'):
        try:
            s=p.read_text(); tail=s[s.rfind(')')+2:].split()
            if int(tail[2])==group and tail[0]!='Z': result.append(int(p.parent.name))
        except (OSError,ValueError,IndexError): pass
    return result

def run(name,timeout,cmd):
    before=identity(); (OUT/f'{name}-before.json').write_text(json.dumps(before,indent=2)+'\n')
    meta={'name':name,'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'timeoutSeconds':timeout,'command':cmd,'cwd':str(ROOT/'work'),'runnerSHA256':sha(pathlib.Path(__file__))}
    (OUT/f'{name}-launch.json').write_text(json.dumps(meta,indent=2)+'\n')
    start=time.monotonic(); timed=False; killed=[]
    with (OUT/f'{name}.log').open('w') as log:
        p=subprocess.Popen(cmd,cwd=ROOT/'work',stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
        meta['pid']=p.pid; (OUT/f'{name}-launch.json').write_text(json.dumps(meta,indent=2)+'\n')
        while p.poll() is None or living(p.pid):
            if time.monotonic()-start>=timeout:
                timed=True; killed=living(p.pid)
                try: os.killpg(p.pid,signal.SIGTERM)
                except ProcessLookupError: pass
                time.sleep(.2)
                try: os.killpg(p.pid,signal.SIGKILL)
                except ProcessLookupError: pass
                break
            time.sleep(.025)
        rc=p.wait(); reap()
        until=time.monotonic()+2
        while living(p.pid) and time.monotonic()<until: time.sleep(.025); reap()
        reap(); survivors=living(p.pid)
    after=identity(); (OUT/f'{name}-after.json').write_text(json.dumps(after,indent=2)+'\n')
    terminal={**meta,'exitCode':rc,'timedOut':timed,'elapsedSeconds':time.monotonic()-start,'sourceIdentityUnchanged':before==after,'signaledPids':killed,'livingGroupAfterWait':survivors}
    (OUT/f'{name}-terminal.json').write_text(json.dumps(terminal,indent=2)+'\n');print(json.dumps(terminal))
    return 124 if timed else rc
if __name__=='__main__':sys.exit(run(sys.argv[1],float(sys.argv[2]),sys.argv[3:]))
