#!/usr/bin/env python3
"""Checkpointed local CPU render controller. Never relies on cross-call ps output."""
from __future__ import annotations
import argparse, contextlib, json, os, resource, shutil, signal, subprocess, sys, threading, time
from pathlib import Path
from render_common_v5 import *
from encode_validate_v5 import encode_segment

class ProcessFailure(RuntimeError):
    def __init__(self,message,guard=False):
        super().__init__(message); self.guard=guard

def memory_mb(pid):
    rss=high=0.0
    try:
        info=Path(f'/proc/{pid}/status').read_text().splitlines()
        for line in info:
            if line.startswith('VmRSS:'): rss=int(line.split()[1])/1024
            if line.startswith('VmHWM:'): high=int(line.split()[1])/1024
    except (OSError,ValueError): pass
    available=float('inf')
    try:
        available=int(next(x for x in Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')).split()[1])/1024
    except (OSError,ValueError,StopIteration): pass
    # Respect a cgroup limit even if /proc reports the physical host's memory.
    try:
        limit=Path('/sys/fs/cgroup/memory.max').read_text().strip()
        if limit!='max':
            used=int(Path('/sys/fs/cgroup/memory.current').read_text())
            available=min(available,max(0,(int(limit)-used)/1024/1024))
    except (OSError,ValueError): pass
    return rss,high,available

class Controller:
    def __init__(self,config_path,c,fp,root,lock,end):
        self.config_path=Path(config_path).resolve(); self.c=c; self.fp=fp; self.root=root
        self.lock=lock; self.end=end; self.good={}; self.peak=0; self.child=None
        self.started=time.time(); self.mutex=threading.RLock(); self.publish_mutex=threading.RLock(); self.stop=threading.Event()
        self.state={'status':'starting','phase':'scanning','active_frames':[], 'renderer_pid':None,
                    'pid':os.getpid(),'config_sha256':fp,'source_sha256':c['blend_sha256'],
                    'output_directory':str(root),'requested_end':end,
                    'checkpoint_scope':'Local workspace only; not durable against workspace rollback'}
        for d in ('frames','logs','failed_artifacts','checkpoints'): (root/d).mkdir(parents=True,exist_ok=True)
        self.heart=threading.Thread(target=self._heartbeat,daemon=True)
    def snapshot(self):
        with self.mutex:
            pid=self.child.pid if self.child and self.child.poll() is None else None
            rss,hwm,avail=memory_mb(pid or os.getpid())
            self.peak=max(self.peak,rss,hwm,resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024)
            return {**self.state,**counts(dict(self.good),self.end),'utc':utc(),'updated_epoch':time.time(),
                    'elapsed_seconds':time.time()-self.started,'renderer_pid':pid,
                    'rss_mb':rss,'peak_rss_mb':self.peak,'available_mb':None if avail==float('inf') else avail}
    def publish(self):
        with self.publish_mutex:
            state=self.snapshot()
            atomic_json(self.root/'status.json',state)
            atomic_json(self.config_path.parent/'production_status.json',state)
            append_event(self.root/'heartbeat.jsonl',state)
            print(json.dumps(state,sort_keys=True),flush=True)
    def _heartbeat(self):
        while not self.stop.wait(15):
            try:
                for frame in list(self.state.get('active_frames',[])):
                    if frame not in self.good and frame_paths(self.root,frame)[1].is_file():
                        meta,_=verify_frame(self.root,frame,self.c,self.fp)
                        if meta:
                            with self.mutex: self.good[frame]=meta
                self.publish()
            except Exception as exc: print(f'HEARTBEAT_WRITE_ERROR {exc}',file=sys.stderr,flush=True)
    def set_phase(self,phase,**fields):
        with self.mutex: self.state.update({'phase':phase,**fields})
        self.publish()
    def terminate_child(self):
        p=self.child
        if p is None or p.poll() is not None: return
        with contextlib.suppress(ProcessLookupError): os.killpg(p.pid,signal.SIGTERM)
        try: p.wait(timeout=10)
        except subprocess.TimeoutExpired:
            with contextlib.suppress(ProcessLookupError): os.killpg(p.pid,signal.SIGKILL)
            p.wait(timeout=10)
    def run(self,cmd,log,phase,timeout):
        self.set_phase(phase,status='running',log_file=str(log))
        append_event(self.root/'events.jsonl',{'event':'process_start','command':cmd,'log':str(log)})
        env=os.environ.copy()
        threads=str(self.state.get('actual_threads',4) if phase=='rendering' else 4)
        env.update({'LP_NUM_THREADS':threads,'OMP_NUM_THREADS':threads,'OPENBLAS_NUM_THREADS':'1',
                    'MESA_SHADER_CACHE_DIR':str(self.config_path.parent/'mesa_cache'),'XDG_CACHE_HOME':str(self.config_path.parent/'blender_cache'),'LIBGL_ALWAYS_SOFTWARE':'1'})
        started=time.monotonic(); error=None
        try:
            with Path(log).open('wb') as out:
                # Inherit the lock so an orphan child cannot overlap a fresh controller.
                self.child=subprocess.Popen(cmd,stdout=out,stderr=subprocess.STDOUT,env=env,
                              start_new_session=True,pass_fds=(self.lock.fileno(),))
                while self.child.poll() is None:
                    rss,hwm,available=memory_mb(self.child.pid)
                    self.peak=max(self.peak,rss,hwm)
                    if rss>6144 or available<768:
                        error=ProcessFailure(f'Memory guard: RSS {rss:.1f} MB, available {available:.1f} MB',guard=True)
                        self.terminate_child(); break
                    if time.monotonic()-started>timeout:
                        error=ProcessFailure(f'Process exceeded {timeout}s; see {log}')
                        self.terminate_child(); break
                    time.sleep(1)
                rc=self.child.returncode
            append_event(self.root/'events.jsonl',{'event':'process_end','phase':phase,'exit_code':rc,
                         'log':str(log),'error':str(error) if error else None,'peak_rss_mb':self.peak})
            if error: raise error
            if rc!=0: raise ProcessFailure(f'{phase} exited {rc}; see {log}')
        except BaseException:
            self.terminate_child(); raise
        finally:
            self.child=None
    def quarantine(self,frame,reason):
        stamp=str(time.time_ns())
        for p in frame_paths(self.root,frame):
            if p.exists(): os.replace(p,self.root/'failed_artifacts'/(p.name+'.'+stamp))
        append_event(self.root/'events.jsonl',{'event':'invalid_frame_quarantined','frame':frame,'reason':reason})
    def import_qa(self,path):
        manifest_path=Path(path).resolve(); m=json.loads(manifest_path.read_text())
        expected={'schema_version':1,'config_sha256':self.fp,'source_sha256':self.c['blend_sha256'],
                  'render_settings':self.c['render'],'trust_statement':'same frozen v5 source and render settings'}
        if 'blender_version' in self.c: expected['blender_version']=self.c['blender_version']
        if any(m.get(k)!=v for k,v in expected.items()): raise ValueError('QA import identity/certification mismatch')
        for entry in m['frames']:
            frame=int(entry['frame'])
            if not 1<=frame<=720: raise ValueError('QA frame out of range')
            source=(manifest_path.parent/entry['png_file']).resolve()
            decoded=png_decode(source)
            if sha256(source)!=entry['png_sha256']: raise ValueError('QA import PNG SHA256 mismatch')
            if frame in self.good: continue
            final,sidecar=frame_paths(self.root,frame)
            if final.exists() or sidecar.exists(): self.quarantine(frame,'before explicit QA import')
            temp=final.with_name(final.name+f'.{os.getpid()}.partial')
            shutil.copyfile(source,temp)
            with temp.open('rb') as f: os.fsync(f.fileno())
            os.replace(temp,final); fsync_dir(final.parent)
            meta={**expected,'frame':frame,'complete':True,'provenance':'trusted_qa_import_v5',
                  'png':decoded,'png_sha256':entry['png_sha256'],'import_manifest_sha256':sha256(manifest_path),
                  'imported_utc':utc(),'imported_epoch':time.time()}
            atomic_json(sidecar,meta)
            checked,error=verify_frame(self.root,frame,self.c,self.fp)
            if not checked: raise RuntimeError(f'Imported frame verification failed: {error}')
            self.good[frame]=checked
            append_event(self.root/'frame_events.jsonl',{'event':'qa_frame_imported',**meta})
    def checkpoints(self,seen):
        starts=self.c['shot_starts']; ends=[x-1 for x in starts[1:]]+[720]
        for i,(first,last) in enumerate(zip(starts,ends),1):
            if i in seen or last>self.end or any(f not in self.good for f in range(first,last+1)): continue
            path,_=encode_segment(self.config_path,self.c,self.fp,self.root,self.good,first,last,
                                 f'shot_{i:02d}_{first:04d}_{last:04d}',self.run)
            seen.add(i); self.set_phase('checkpoint_verified',last_checkpoint=str(path))
    def render(self,args):
        self.heart.start()
        try:
            self.good,bad=scan_frames(self.root,self.c,self.fp)
            if args.verify_only:
                self.set_phase('verification_complete',status='verified_snapshot',invalid_frames=bad)
                return
            for f,reason in bad.items(): self.quarantine(f,reason)
            run_identity={'config':self.c,'config_sha256':self.fp,
                        'source_sha256':self.c['blend_sha256'],'started_utc':utc(),
                        'scripts':{p.name:sha256(p) for p in Path(__file__).parent.glob('*_v5.py')},
                        'checkpoint_scope':'Same-workspace recovery only; rollback may remove any local artifact'}
            atomic_json(self.root/'run_identity.json',run_identity)
            atomic_json(self.root/'runs'/f'run_{time.time_ns()}_{os.getpid()}.json',run_identity)
            if args.import_qa: self.import_qa(args.import_qa)
            self.set_phase('validated_existing_frames',status='running',invalid_frames_quarantined=len(bad))
            seen=set(); self.checkpoints(seen)
            failures={}; force_single=False; thread_limit=8
            while True:
                missing=[f for f in range(1,self.end+1) if f not in self.good]
                if not missing: break
                if args.encode_only: raise RuntimeError(f'Cannot encode: missing {len(missing)} requested frames')
                batch=missing[:1 if force_single else 2]
                # A changed source/config is fatal, never a quality fallback.
                _,current_fp,_=load_config(self.config_path)
                if current_fp!=self.fp: raise RuntimeError('Production config changed during run')
                if any(failures.get(f,0)>=args.max_attempts for f in batch):
                    raise RuntimeError(f'Render retry budget exhausted for {batch}; raw frames and logs preserved')
                attempts=max(failures.get(f,0) for f in batch)+1
                stamp=time.time_ns()
                log=self.root/'logs'/f'render_{batch[0]:04d}_{batch[-1]:04d}_attempt{attempts}_{stamp}.log'
                self.state.update(active_frames=batch,actual_threads=thread_limit)
                cmd=[args.blender,'-b',str((self.config_path.parent/self.c['blend_file']).resolve()),
                     '-t',str(thread_limit),'--python-exit-code','1','--python',
                     str(Path(__file__).with_name('render_chunk_v5.py')),'--','--config',str(self.config_path),
                     '--fingerprint',self.fp,'--frames',','.join(map(str,batch)),
                     '--threads',str(thread_limit),'--lock-fd',str(self.lock.fileno())]
                problem=None
                try: self.run(cmd,log,'rendering',args.batch_timeout)
                except ProcessFailure as exc: problem=exc
                missing_after=[]
                for frame in batch:
                    meta,error=verify_frame(self.root,frame,self.c,self.fp)
                    if meta: self.good[frame]=meta
                    else:
                        missing_after.append(frame); failures[frame]=failures.get(frame,0)+1
                        p,s=frame_paths(self.root,frame)
                        if p.exists() or s.exists(): self.quarantine(frame,error)
                self.set_phase('batch_checked',active_frames=[],last_batch_error=str(problem) if problem else None)
                self.checkpoints(seen)
                if missing_after:
                    append_event(self.root/'events.jsonl',{'event':'retry_required','frames':missing_after,
                                 'reason':str(problem) if problem else 'exit 0 but expected frame artifacts missing'})
                    # Preserve full image quality. Only lifetime/concurrency change.
                    if force_single: thread_limit=4
                    force_single=True
                    time.sleep(3)
                elif not problem:
                    # Once reduced for a failure, remain bounded to single frames for safety.
                    pass
            self.checkpoints(seen)
            if self.end==720:
                path,meta=encode_segment(self.config_path,self.c,self.fp,self.root,self.good,1,720,
                                        'Tank_City_V5_Final_720p24',self.run,final=True)
                self.set_phase('complete',status='complete',final_file=str(path),final_sha256=meta['file_sha256'])
            else:
                path,meta=encode_segment(self.config_path,self.c,self.fp,self.root,self.good,1,self.end,
                                         f'motion_QA_0001_{self.end:04d}',self.run)
                self.set_phase('requested_range_complete',status='range_complete',preview_file=str(path),
                               preview_sha256=meta['file_sha256'])
        except BaseException as exc:
            self.terminate_child()
            self.set_phase('stopped',status='interrupted' if isinstance(exc,(KeyboardInterrupt,SystemExit)) else 'failed',
                           error=str(exc),active_frames=[])
            raise
        finally:
            self.stop.set(); self.heart.join(timeout=20)
            self.publish()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--config',default=str(Path(__file__).resolve().parent.parent/'production_config.json'))
    p.add_argument('--end',type=int,default=720,help='Render 1..end; use 48 for initial motion QA')
    p.add_argument('--blender',default='blender'); p.add_argument('--batch-timeout',type=int,default=1800)
    p.add_argument('--max-attempts',type=int,default=4)
    p.add_argument('--import-qa',help='Explicit same-source/settings certified QA manifest')
    p.add_argument('--verify-only',action='store_true',help='Lock and fully check PNGs/sidecars without rendering or encoding')
    p.add_argument('--encode-only',action='store_true',help='Do not render; require all requested source frames')
    args=p.parse_args()
    if args.verify_only and (args.encode_only or args.import_qa): p.error('verify-only cannot be combined with encode-only/import-qa')
    if not 1<=args.end<=720 or args.max_attempts<1: p.error('end must be 1..720 and attempts positive')
    # Never infer live renderer status from a stale status file or process listing.
    with render_lock(args.config) as lock:
        c,fp,root=load_config(args.config)
        ctl=Controller(args.config,c,fp,root,lock,args.end)
        def stop_handler(signum,frame): raise KeyboardInterrupt(f'Received signal {signum}')
        signal.signal(signal.SIGTERM,stop_handler)
        ctl.render(args)

if __name__=='__main__':
    try: main()
    except KeyboardInterrupt as exc: print(str(exc),file=sys.stderr); sys.exit(130)
    except Exception as exc: print(f'RENDER_FAILED: {exc}',file=sys.stderr,flush=True); sys.exit(1)
