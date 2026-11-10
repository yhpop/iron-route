"""Bounded serial CPU worker: capture exact code hash inventories before/after."""
import sys, pathlib,hashlib,json,subprocess,time,datetime
root=pathlib.Path(__file__).resolve().parents[3]/'work'
out=pathlib.Path(__file__).resolve().parent
name,cap,*cmd=sys.argv[1:]
def inventory():
 return {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for d in ['src','tests','scripts','locales'] for p in sorted((root/d).rglob('*')) if p.is_file()}
before=inventory();(out/(name+'-before.json')).write_text(json.dumps(before,indent=2)+'\n')
start=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.monotonic()
with (out/(name+'.log')).open('w') as log:
 log.write('START '+start+'\nCOMMAND '+json.dumps(cmd)+'\nCAP_SECONDS '+cap+'\n');log.flush()
 try:r=subprocess.run(cmd,cwd=root,stdout=log,stderr=subprocess.STDOUT,timeout=int(cap));code=r.returncode
 except subprocess.TimeoutExpired:code=124;log.write('\nTIMEOUT\n')
 elapsed=time.monotonic()-t;after=inventory();drift=[p for p in before.keys()|after.keys() if before.get(p)!=after.get(p)]
 log.write('\nEXIT '+str(code)+'\nSECONDS '+str(elapsed)+'\nCODE_DRIFT '+json.dumps(drift)+'\nEND '+datetime.datetime.now(datetime.timezone.utc).isoformat()+'\n')
(out/(name+'-after.json')).write_text(json.dumps(after,indent=2)+'\n')
record={'name':name,'command':cmd,'capSeconds':int(cap),'start':start,'seconds':elapsed,'exit':code,'codeDrift':drift}
(out/(name+'-terminal.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record));sys.exit(code or bool(drift))
