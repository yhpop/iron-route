"""Final read-only source/evidence/build checks and byte-exact replay evidence extraction."""
from pathlib import Path
import json,hashlib,gzip,shutil
out=Path(__file__).resolve().parent;root=out.parents[2];work=root/'work';mirror=out/'replay-mirror';h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
frozen=json.loads((out/'final-source-manifest.json').read_text());codeDrift=[f for f,v in frozen.items() if h(work/f)!=v]
base=json.loads((root/'evidence/battlefront/sdd/bf2-base-head.json').read_text());changes=[f for f,v in base['workFiles'].items() if h(work/f)!=v['sha256']]
allowed=['locales/en-missions.json','src/campaign-view.js','src/crossfire-warfield-view.js','src/main.js','src/ruined-depot-view.js','src/terrain-candidate/relief-view.js','tests/sweep-acceleration-entry.test.mjs'];assert sorted(changes)==allowed;assert not codeDrift
bf1before=json.loads((out/'bf1-evidence-before.json').read_text());bf1root=root/'evidence/battlefront/bf1';bf1after={str(p.relative_to(bf1root)):h(p) for p in sorted(bf1root.rglob('*')) if p.is_file()};assert bf1before==bf1after
(out/'bf1-evidence-after.json').write_text(json.dumps(bf1after,indent=2)+'\n')
legacy=json.loads((root/'evidence/battlefront/sdd/legacy-test-fixtures.json').read_text());legacyRows={f:{'expected':v['sha256'],'candidate':h(root/f),'originalParent':h(Path(legacy['sourceRoot'])/f)} for f,v in legacy['files'].items()};assert all(v['expected']==v['candidate']==v['originalParent'] for v in legacyRows.values())
original=json.loads((root/'BASE.json').read_text());parentRows={f:h(Path(original['sourceRoot'])/f) for f in original['files']};assert all(parentRows[f]==v['sha256'] for f,v in original['files'].items())
replays={};dest=out/'replays';dest.mkdir(exist_ok=True)
for route in ['direct','covered']:
 paths={f'{route}-generated-result.json.gz':mirror/f'work/qa/battlefront-depot/{route}-bf2-final-result.json.gz',f'{route}-independent-original.json':mirror/f'evidence/battlefront/bf1/route-qa/sandfalcon-{route}-independent.json',f'{route}-inspection-checkpoints.json':mirror/f'evidence/battlefront/bf1/route-qa/sandfalcon-{route}-inspection-checkpoints.json'}
 copies={}
 for name,p in paths.items():
  target=dest/name
  if target.exists(): assert h(p)==h(target),'existing extracted raw drift; refusing overwrite'
  else: shutil.copy2(p,target)
  assert h(p)==h(target);copies[name]={'mirrorOriginal':str(p.relative_to(mirror)),'copied':str(target.relative_to(root)),'sha256':h(target),'bytes':target.stat().st_size}
 raw=json.loads(gzip.decompress((dest/f'{route}-generated-result.json.gz').read_bytes()));accepted=root/f'evidence/battlefront/bf1/route-qa/sandfalcon-{route}-result.json.gz';assert raw==json.loads(gzip.decompress(accepted.read_bytes()));helper=json.loads((dest/f'{route}-independent-original.json').read_text());assert helper['fullEvidenceExact'] is True;assert helper['harnessSHA256']==h(work/'scripts/battlefront-replay.mjs');assert helper['finalHash']==raw['finalHash']
 replays[route]={'copies':copies,'originalHelperRetainedByteExact':True,'helperGeneratedEvidenceFileNote':'Original helper path refers to mirror work root; copies mapping above gives fixed BF2 evidence location without rewriting helper.','acceptedSHA256':h(accepted),'generatedCompressedBytesEqualAccepted':h(accepted)==h(dest/f'{route}-generated-result.json.gz'),'inputs':raw['inputs'],'tick':raw['finalState']['tick'],'phase':raw['finalState']['phase'],'events':len(raw['events']),'finalHash':helper['finalHash'],'specHash':helper['specHash'],'closureFiles':len(raw['sourceHashes']),'fullJSONEqualAccepted':True,'harnessSHA256':helper['harnessSHA256']}
builds={}
for directory in ['dist','dist-en']:
 d=work/directory;manifest=json.loads((d/'build-manifest.json').read_text());meta=json.loads((d/'build-metafile.json').read_text());assert h(d/'game.js')==manifest['sha256'];assert manifest['javascriptBytes']==(d/'game.js').stat().st_size;assert h(d/'style.css')==h(work/'src/style.css');assert manifest['browserVerified'] is False
 inputs=meta['inputs'];required=['src/main.js','src/battlefront-depot-front.js','src/battlefront-depot-ground-view.js','src/ruined-depot-world-accelerated.js','src/terrain-candidate/combat-world-accelerated.js','src/campaign-world-accelerated.js','src/collision-broadphase.js']
 assert all(p in inputs for p in required);assert 'src/ruined-depot-world.js' not in inputs;assert 'src/content/generated-records.js' not in inputs;assert not any('strv103' in p.lower() for p in inputs)
 files={str(p.relative_to(d)):{'sha256':h(p),'bytes':p.stat().st_size} for p in sorted(d.rglob('*')) if p.is_file()};assets={p:h(work/p) for p in inputs if p.startswith('assets/')};builds[directory]={'manifest':manifest,'files':files,'assetInputs':assets,'requiredClosure':required,'originalSpecifier':manifest['sweepAcceleration'],'reusedFromFullSuite':True,'noSecondBuild':True}
assert builds['dist']['assetInputs']==builds['dist-en']['assetInputs']
skips=(out/'full-suite-inherited-skips.txt').read_text().splitlines();assert len(skips)==21
report={'boundary':'Final file and CPU evidence audit only. No browser/Mac/image decode/DOM/touch/GPU/beauty/performance acceptance.','sourceFreezeManifestSHA256':h(out/'final-source-manifest.json'),'sourceFreezeFiles':len(frozen),'finalCodeDrift':codeDrift,'baseWorkFiles':len(base['workFiles']),'authorizedChangedBaseFiles':changes,'unchangedBaseFiles':len(base['workFiles'])-len(changes),'BF1EvidenceFilesUnchanged':len(bf1after),'legacyRestoredFixtures':legacyRows,'originalParentWorkFilesUnchanged':len(parentRows),'originalParentWorkHashes':parentRows,'replays':replays,'builds':builds,'fullSuite':{'tests':1100,'pass':1079,'fail':0,'skipped':21,'seconds':340.3307834669977,'codeDrift':[],'inheritedSkippedNames':skips}}
(out/'final-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'finalCodeDrift':codeDrift,'unchangedBaseFiles':report['unchangedBaseFiles'],'BF1EvidenceFilesUnchanged':len(bf1after),'legacyRestoredFixturesUnchanged':len(legacyRows),'originalParentWorkFilesUnchanged':len(parentRows),'replays':replays,'builds':{d:{'sha256':v['manifest']['sha256'],'bytes':v['manifest']['javascriptBytes']} for d,v in builds.items()}}))
