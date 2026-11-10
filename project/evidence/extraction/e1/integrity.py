#!/usr/bin/env python3
"""Read-only baseline/archive check + owned source snapshots; no Git or installs."""
import pathlib,json,hashlib,difflib,datetime
ROOT=pathlib.Path(__file__).resolve().parents[3]; OUT=pathlib.Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
base=json.loads((ROOT/'evidence/extraction/BASE.json').read_text()); headbase=json.loads((ROOT/'evidence/extraction/sdd/e1-base.json').read_text())
checks={r['path']:{'expected':r['sha256'],'actual':sha(ROOT/r['path'])} for r in base['entries']}
assert len(checks)==1814
assert all(r['expected']==r['actual'] for r in checks.values()),'frozen baseline mutated'
owned=['work/src/loading-extraction-front.js','work/tests/loading-extraction.test.mjs']
basework={r['path'] for r in base['entries'] if r['path'].startswith('work/')}
currentwork={str(p.relative_to(ROOT)) for p in (ROOT/'work').rglob('*') if p.is_file() and 'node_modules' not in p.parts}
assert currentwork-basework==set(owned),(currentwork-basework)
head={p:sha(ROOT/p) for p in sorted([*headbase['sourceHead'],*owned])}
assert all(head[p]==digest for p,digest in headbase['sourceHead'].items())
canonical=json.dumps(head,sort_keys=True,separators=(',',':'))
headresult={'baselineSourceHeadSHA256':headbase['sourceHeadSHA256'],'sourceFileCount':len(head),'sourceHeadSHA256':hashlib.sha256(canonical.encode()).hexdigest(),'hashEncoding':'UTF-8 json.dumps(sourceHead,sort_keys=True,separators=(comma,colon))','sourceHead':head}
(OUT/'source-head.json').write_text(json.dumps(headresult,indent=2)+'\n')
archivepins=json.loads((ROOT/'evidence/grounded/final/final-identity.json').read_text())['protectedPredecessorArchives']
archivepins.update({'battlefront_grounded_candidate/iron-route-grounded-freight-yard-source-candidate.zip':'0f8f04e5e941390f27d1947820a620687300970efe9264e6b7676f52c04c2ccf','battlefront_grounded_candidate/iron-route-grounded-freight-yard-device-candidate.zip':'20dce1068bd11079f3fe765508cea0edb23e9993839b9ce55ed6bdcdc551582d'})
archives={p:{'expected':digest,'actual':sha(ROOT.parent/p)} for p,digest in archivepins.items()}
assert len(archives)==14 and all(r['expected']==r['actual'] for r in archives.values())
diff=''
for p in owned:
 target=OUT/'final-source'/p;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((ROOT/p).read_bytes())
 diff+=''.join(difflib.unified_diff([], (ROOT/p).read_text().splitlines(keepends=True),fromfile='frozen-grounded/'+p+' (absent)',tofile='e1/'+p,n=10))
(OUT/'source.diff').write_text(diff)
result={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baseFileCount':len(checks),'all1814BaselineBytesExact':True,'baselineChecks':checks,'newWorkFiles':owned,'ownedSHA256':{p:sha(ROOT/p) for p in owned},'sourceFileCount':len(head),'sourceHeadSHA256':headresult['sourceHeadSHA256'],'sourceDiffSHA256':sha(OUT/'source.diff'),'sourceDiffContext':10,'protectedArchiveCount':len(archives),'protectedArchives':archives,'baseAuthority':'evidence/extraction/BASE.json exact immutable frozen grounded ZIP extraction; sdd/e1-base.json source head from that extraction','sourceZIP':base['parentSourceSHA256']}
(OUT/'integrity.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['baselineChecks','protectedArchives']},indent=2))
