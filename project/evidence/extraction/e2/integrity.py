#!/usr/bin/env python3
"""Read-only source/record/archive audit; writes only owned E2 evidence snapshots."""
import pathlib,json,hashlib,difflib,sys,datetime
ROOT=pathlib.Path(__file__).resolve().parents[3];OUT=pathlib.Path(__file__).resolve().parent
phase=sys.argv[1] if len(sys.argv)>1 else 'preflight'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
base=json.loads((ROOT/'evidence/extraction/BASE.json').read_text())
headbase=json.loads((ROOT/'evidence/extraction/sdd/e2-base-expanded.json').read_text())
owned=['work/src/main.js','work/src/campaign-ui.js','work/locales/en-ui.json','work/locales/en-missions.json','work/tests/sweep-acceleration-entry.test.mjs','work/tests/loading-extraction-entry.test.mjs','work/tests/battlefront-depot-scope.test.mjs']
new=['work/tests/loading-extraction-entry.test.mjs'];buildconfig=['work/build.mjs','work/build-english.mjs','work/package.json','work/package-lock.json','work/index.html']
for p in owned:
    old=ROOT/'evidence/extraction/sdd/e2-base-source'/p
    if old.exists():assert sha(old)==headbase['sourceHead'][p],('owned BASE snapshot mismatch',p)
checks={r['path']:{'expected':r['sha256'],'actual':sha(ROOT/r['path'])} for r in base['entries']};assert len(checks)==1814
changed=[p for p,v in checks.items() if v['expected']!=v['actual']]
allowed=set(owned)
if phase=='final':allowed.update(p for p in checks if p.startswith(('work/dist/','work/dist-en/')))
assert not set(changed)-allowed,sorted(set(changed)-allowed)
head={p:sha(ROOT/p) for p in sorted(set(headbase['sourceHead'])|set(new)|set(buildconfig))}
assert not [p for p,d in headbase['sourceHead'].items() if p not in owned and head[p]!=d]
sourcehead={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baselineSourceHeadSHA256':headbase['sourceHeadSHA256'],'sourceFileCount':len(head),'sourceHeadSHA256':hashlib.sha256(json.dumps(head,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'hashEncoding':headbase['hashEncoding'],'buildConfigPaths':buildconfig,'sourceHead':head}
(OUT/'source-head.json').write_text(json.dumps(sourcehead,indent=2)+'\n')
# All immutable E1 artifacts incl exact raws/source snapshots/helper versions.
e1=ROOT/'evidence/extraction/e1';manifest=json.loads((e1/'evidence-manifest.json').read_text())['files'];e1checks={p:{'expected':d,'actual':sha(e1/p)} for p,d in manifest.items()};assert all(v['expected']==v['actual'] for v in e1checks.values())
archives=json.loads((ROOT/'evidence/grounded/final/final-identity.json').read_text())['protectedPredecessorArchives']
archives.update({'battlefront_grounded_candidate/iron-route-grounded-freight-yard-source-candidate.zip':'0f8f04e5e941390f27d1947820a620687300970efe9264e6b7676f52c04c2ccf','battlefront_grounded_candidate/iron-route-grounded-freight-yard-device-candidate.zip':'20dce1068bd11079f3fe765508cea0edb23e9993839b9ce55ed6bdcdc551582d'})
archivechecks={p:{'expected':d,'actual':sha(ROOT.parent/p)} for p,d in archives.items()};assert len(archives)==14;assert all(v['expected']==v['actual'] for v in archivechecks.values())
snapshotPaths=[*owned,*buildconfig,'work/scripts/english-localization.mjs'];diff=''
for p in snapshotPaths:
 target=OUT/'final-source'/p;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((ROOT/p).read_bytes())
 if p in owned:
  old=ROOT/'evidence/extraction/sdd/e2-base-source'/p
  before=old.read_text().splitlines(keepends=True) if old.exists() else []
  diff+=''.join(difflib.unified_diff(before,(ROOT/p).read_text().splitlines(keepends=True),fromfile='e2BASE/'+p+(' (absent)' if not old.exists() else ''),tofile='e2/'+p,n=10))
(OUT/'source.diff').write_text(diff)
result={'phase':phase,'utc':sourcehead['utc'],'sourceFileCount':len(head),'sourceHeadSHA256':sourcehead['sourceHeadSHA256'],'all1814Checked':True,'changedBaselineFiles':changed,'authorizedSourceChanges':owned,'baselineChecks':checks,'E1ManifestSHA256':sha(e1/'evidence-manifest.json'),'E1FileCount':len(e1checks),'E1AllExact':True,'E1Checks':e1checks,'archiveCount':len(archivechecks),'archivesAllExact':True,'archiveChecks':archivechecks,'U10DiffSHA256':sha(OUT/'source.diff'),'snapshotPaths':snapshotPaths}
(OUT/(phase+'-integrity.json')).write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['baselineChecks','E1Checks','archiveChecks']},indent=2))
