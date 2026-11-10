import subprocess,time,os,json,fcntl,argparse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--frame',type=int,required=True);p.add_argument('--engine',default='EEVEE');p.add_argument('--samples',type=int,default=64);p.add_argument('--label',required=True);p.add_argument('--threads',type=int,default=4);p.add_argument('--raytracing',action='store_true');p.add_argument('--blend',default='Tank_City_V5_Improved.blend');a=p.parse_args();root=Path(__file__).resolve().parent.parent
lock=(root/'render_slot.lock').open('a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);env=os.environ.copy();env.update({'LP_NUM_THREADS':str(a.threads),'OMP_NUM_THREADS':str(a.threads),'OPENBLAS_NUM_THREADS':'1','MESA_SHADER_CACHE_DIR':str(root/'mesa_cache'),'XDG_CACHE_HOME':str(root/'blender_cache')});peak=0;start=time.time();log=root/'logs'/f'{a.label}_{a.frame:04d}.log'
with log.open('w') as out:
 proc=subprocess.Popen(['blender','-b',str(root/a.blend),'-t',str(a.threads),'--python-exit-code','1','--python',str(root/'source/render_still.py'),'--','--frame',str(a.frame),'--engine',a.engine,'--samples',str(a.samples),'--label',a.label,'--threads',str(a.threads)]+(['--raytracing'] if a.raytracing else []),stdout=out,stderr=subprocess.STDOUT,env=env)
 while proc.poll() is None:
  try:rss=int(next(x for x in open(f'/proc/{proc.pid}/status') if x.startswith('VmRSS:')).split()[1])/1024
  except (FileNotFoundError,StopIteration):rss=0
  peak=max(peak,rss);available=int(next(x for x in open('/proc/meminfo') if x.startswith('MemAvailable:')).split()[1])/1024
  state={'status':'rendering_probe','frame':a.frame,'label':a.label,'engine':a.engine,'samples':a.samples,'renderer_pid':proc.pid,'rss_mb':rss,'peak_rss_mb':peak,'elapsed_seconds':time.time()-start,'updated_epoch':time.time()};tmp=root/'probe_status.tmp';tmp.write_text(json.dumps(state,indent=2));tmp.replace(root/'probe_status.json')
  if rss>6*1024 or available<768:
   proc.terminate()
   try:proc.wait(timeout=15)
   except subprocess.TimeoutExpired:proc.kill();proc.wait()
   raise SystemExit('Resource guard stopped probe; output/source preserved')
  time.sleep(10)
 rc=proc.returncode
 expected=root/'qa'/f'{a.label}_frame_{a.frame:04d}.png'
 if rc==0 and (not expected.is_file() or expected.stat().st_size<50000):rc=1
state.update({'status':'probe_complete' if rc==0 else 'probe_failed','exit_code':rc,'peak_rss_mb':peak,'elapsed_seconds':time.time()-start,'updated_epoch':time.time()});(root/'probe_status.json').write_text(json.dumps(state,indent=2));print(json.dumps(state),flush=True)
if rc:print(log.read_text()[-5000:],flush=True);raise SystemExit(rc)
