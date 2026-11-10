from pathlib import Path
import datetime,hashlib,json,zipfile
r=Path(__file__).resolve().parents[2];a=r.parent/'battlefront_grounded_candidate/iron-route-grounded-freight-yard-source-candidate.zip';sha=lambda b:hashlib.sha256(b).hexdigest();expected='0f8f04e5e941390f27d1947820a620687300970efe9264e6b7676f52c04c2ccf'
assert sha(a.read_bytes())==expected
registration={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceArchive':str(a),'sourceSHA256':expected,'helperSHA256':sha(Path(__file__).read_bytes()),'timeoutSeconds':120,'command':'timeout --kill-after=2s 120s python3 evidence/extraction/extract-base.py','expectedWrites':'new candidate extraction only; no parent mutations','retryIfUncertain':False}
with (r/'evidence/extraction/bootstrap-registration.json').open('x') as f:json.dump(registration,f,indent=2)
entries=[]
with zipfile.ZipFile(a) as z:
 names=z.namelist();assert len(names)==len(set(names))==1814
 for n in names:
  p=Path(n);assert not p.is_absolute() and '..' not in p.parts;assert not n.endswith('/');assert not (r/p).exists();data=z.read(n);dest=r/p;dest.parent.mkdir(parents=True,exist_ok=True)
  with dest.open('xb') as f:f.write(data)
  assert sha(dest.read_bytes())==sha(data);entries.append({'path':n,'bytes':len(data),'sha256':sha(data)})
assert sha(a.read_bytes())==expected
(r/'work/node_modules').symlink_to(r.parent/'ridge_recovery/deps/源码/node_modules',target_is_directory=True)
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'parentSourceArchive':str(a),'parentSourceSHA256':expected,'entries':entries,'totalBytes':sum(e['bytes'] for e in entries),'parentUnchanged':True,'sourceScope':'Independent gameplay branch from frozen grounded source, no visual edits or acceptance implied.'}
with (r/'evidence/extraction/BASE.json').open('x') as f:json.dump(out,f,indent=2,ensure_ascii=False)
print(json.dumps({k:v for k,v in out.items() if k!='entries'}));print('entries',len(entries))
