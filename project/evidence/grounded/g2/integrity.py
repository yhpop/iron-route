import difflib,gzip,hashlib,json,pathlib,re,sys
ROOT=pathlib.Path(__file__).resolve().parents[3];OUT=pathlib.Path(__file__).resolve().parent;FINAL=OUT.parent/'final';mode=sys.argv[1]
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda p:json.loads(p.read_text())
base=read(ROOT/'evidence/grounded/BASE.json');g2=read(ROOT/'evidence/grounded/sdd/g2-base.json')
head={str(p.relative_to(ROOT)):sha(p.read_bytes()) for prefix in ['work/src','work/tests','work/scripts','work/assets'] for p in sorted((ROOT/prefix).rglob('*')) if p.is_file()};headHash=sha(json.dumps(head,sort_keys=True,separators=(',',':')).encode())
changed=[{'path':p,'old':h,'new':head.get(p)} for p,h in g2['sourceHead'].items() if head.get(p)!=h];added=sorted(set(head)-set(g2['sourceHead']))
guardPaths={'work/tests/battlefront-depot-scope.test.mjs','work/tests/crossfire-v4-front.test.mjs'}
assert {e['path'] for e in changed}==({'work/src/authored-scene-view.js'} if mode=='pre' else {'work/src/authored-scene-view.js'}|guardPaths),changed
assert added==['work/src/battlefront-building-finish.js','work/tests/battlefront-building-finish.test.mjs'],added
assert sha((OUT/'run-job.py').read_bytes())==sha((OUT.parent/'g1/run-job.py').read_bytes())
physical={}
# Exact BF1 authority root-set, recursively discovered locally without simulation.
closure={}
def visit(p):
 p=p.resolve();name=str(p.relative_to(ROOT/'work'))
 if name in closure:return
 raw=p.read_bytes();closure[name]=sha(raw)
 for m in re.finditer(r'''(?:from\s*|import\s*)['"](\.[^'"]+)['"]''',raw.decode()):visit(p.parent/m.group(1))
for name in ['src/battlefront-depot-front.js','src/ruined-depot-world-accelerated.js','src/player-vehicles-v3.js','src/campaign-simulation.js']:visit(ROOT/'work'/name)
assert len(closure)==31,len(closure)
for route,expected in [('direct','0d76b716b131103839fd8e9fcfb61de5aa74bc58cb44e6d0bbbdf1061dbc1361'),('covered','5a470daefbd47a83e045f772fe3bb4f3c568e1ab6bb0c4e2c66bdf21b810bb08')]:
 p=ROOT/f'evidence/battlefront/bf1/route-qa/sandfalcon-{route}-result.json.gz';raw=p.read_bytes();assert sha(raw)==expected;j=json.loads(gzip.decompress(raw));assert len(j['sourceSnapshot'])==31;assert j['sourceHashes']==closure
 for name,s in j['sourceSnapshot'].items():assert (ROOT/'work'/name).read_text()==s,name
 physical[route]={'artifact':str(p.relative_to(ROOT)),'artifactSHA256':sha(raw),'sourceKeys':31,'sourceHashes':j['sourceHashes'],'inputs':j['inputs'],'specHash':j['specHash'],'finalHash':j['finalHash'],'freshSimulation':False}
# Entire inherited record identity, with only explicitly authorized source/build writes.
allowed={'work/src/terrain-candidate/relief-view.js','work/tests/battlefront-depot-terrain.test.mjs','work/src/authored-scene-view.js'}| (guardPaths if mode=='post' else set());inheritedChanges=[]
for e in base['entries']:
 p=ROOT/e['path'];h=sha(p.read_bytes()) if p.is_file() else None
 if h!=e['sha256']:
  assert e['path'] in allowed or (mode=='post' and e['path'].startswith(('work/dist/','work/dist-en/'))),e['path']
  inheritedChanges.append({'path':e['path'],'old':e['sha256'],'new':h})
# Every inherited G1 file, test, evidence and raw data is covered above or g2 head.
archives={}
for folder in ['battlefront_depot_candidate','ruined_performance_candidate','ruined_depot_candidate','scanned_cover_resource_candidate','scorched_crossfire_v3_candidate','crossfire_maneuver_v4_candidate']:
 for p in sorted((ROOT.parent/folder).glob('*.zip')):archives[str(p.relative_to(ROOT.parent))]=sha(p.read_bytes())
assert archives[str(pathlib.Path(base['parentSourceArchive']).relative_to(ROOT.parent))]==base['parentSourceSHA256']
parent=ROOT.parent/'battlefront_depot_candidate';parentSource={}
for e in base['entries']:
 if any(e['path'].startswith(prefix) for prefix in ['work/src/','work/tests/','work/scripts/','work/assets/']):
  p=parent/e['path'];assert sha(p.read_bytes())==e['sha256'],str(p);parentSource[e['path']]=e['sha256']
record={'mode':mode,'baseHeadSHA256':g2['workHeadSHA256'],'sourceHeadSHA256':headHash,'sourceFileCount':len(head),'sourceHead':head,'changedFromG2Base':changed,'addedFromG2Base':added,'inheritedEntryCount':len(base['entries']),'inheritedChanges':inheritedChanges,'BF1AuthorityRecursiveClosure':dict(sorted(closure.items())),'retainedReplayAuthority':physical,'protectedPredecessorArchives':archives,'protectedParentSourceFileCount':len(parentSource),'protectedParentSourceHeadSHA256':sha(json.dumps(parentSource,sort_keys=True,separators=(',',':')).encode()),'mainSHA256':head['work/src/main.js'],'originalMainSHA256':read(ROOT/'BASE.json')['files']['src/main.js']['sha256'],'runnerSHA256':sha((OUT/'run-job.py').read_bytes()),'noGit':'Canonical SHA256 sorted compact JSON map; no Git operations or commits.'}
assert record['mainSHA256']=='2f9e5103d6ff46f3ec162e54137b12f118a912417b5aeeb5108ff43a8af02e73';assert record['originalMainSHA256']=='9d937baf1d64fcb3409d3e975e1cf836c221e900dea420fdd57741289867e6dc'
if mode=='pre':
 for name in ['work/src/authored-scene-view.js','work/src/battlefront-building-finish.js','work/tests/battlefront-building-finish.test.mjs']:
  dest=OUT/'final-source'/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((ROOT/name).read_bytes())
 diff=[]
 for name in ['work/src/authored-scene-view.js','work/src/battlefront-building-finish.js','work/tests/battlefront-building-finish.test.mjs']:
  old=(OUT/'authored-scene-view.before.js').read_text() if name.endswith('/authored-scene-view.js') else ''
  diff.extend(difflib.unified_diff(old.splitlines(True),(ROOT/name).read_text().splitlines(True),fromfile='approved-g2-base/'+name,tofile='grounded-g2/'+name))
 (OUT/'source.diff').write_text(''.join(diff))
else:
 pre=read(FINAL/'pre-suite-identity.json');drift=[{'path':p,'fullSuiteSHA256':h,'finalSHA256':head.get(p)} for p,h in pre['sourceHead'].items() if head.get(p)!=h];assert {e['path'] for e in drift}==guardPaths;assert set(pre['sourceHead'])==set(head);record['fullSuiteToFinalTestOnlyDrift']=drift;record['allProductionAssetsScriptsOtherTestsExactToFullSuite']=True;record['fullSuiteSourceHeadSHA256']=pre['sourceHeadSHA256'];assert pre['protectedPredecessorArchives']==archives;assert pre['protectedParentSourceHeadSHA256']==record['protectedParentSourceHeadSHA256']
 builds={}
 suiteBuilds=read(FINAL/'full-suite-builds.json')
 for directory,standalone in [('dist','铁流_电脑浏览器离线版.html'),('dist-en','Iron_Route_Desktop_Offline.html')]:
  d=ROOT/'work'/directory;manifest=read(d/'build-manifest.json');meta=read(d/'build-metafile.json');inputs=meta['inputs'];js=(d/'game.js').read_bytes();assert sha(js)==manifest['sha256'];assert manifest['sweepAcceleration']=={'scope':'ruined-main-import-only','importer':'src/main.js','specifier':'./ruined-depot-world.js','resolved':'src/ruined-depot-world-accelerated.js'}
  assert 'src/battlefront-building-finish.js' in inputs
  for target,source in [('src/ruined-depot-world-accelerated.js','src/main.js'),('src/terrain-candidate/combat-world-accelerated.js','src/ruined-depot-world-accelerated.js'),('src/campaign-world-accelerated.js','src/terrain-candidate/combat-world-accelerated.js'),('src/collision-broadphase.js','src/campaign-world-accelerated.js')]:assert sorted(p for p,v in inputs.items() if any(i['path']==target and not i.get('external') for i in v['imports']))==[source]
  for p in ['src/campaign-world.js','src/terrain-candidate/combat-world.js']:assert p in inputs
  assert 'src/ruined-depot-world.js' not in inputs;assert not any('strv103' in p.lower() for p in inputs)
  html=(d/standalone).read_text();assert '<script type="module">'+re.sub('</script',lambda m:'<'+chr(92)+'/script',js.decode(),flags=re.I)+'</script>' in html;assert './game.js' not in html;assert not manifest['browserVerified'];assert not manifest['runtimeRequestsMeasured']
  builds[directory]={'script':'build.mjs' if directory=='dist' else 'build-english.mjs','reusedFrom':'06-full-suite embedded actual CN/EN entry-regression builds; no separate build','manifest':manifest,'files':{p.name:{'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size} for p in sorted(d.iterdir()) if p.is_file()},'standalone':standalone,'mainOnlyAcceleratedMappingVerified':True}
 assert {d:v['files'] for d,v in builds.items()}==suiteBuilds
 record['builds']=builds
 text=(OUT/'06-full-suite.log').read_text();counts={k:int(re.search(r'ℹ '+k+r' (\d+)',text).group(1)) for k in ['tests','pass','fail','cancelled','skipped']};assert counts=={'tests':1117,'pass':1094,'fail':2,'cancelled':0,'skipped':21}
 record['fullSuiteActualCounts']=counts;record['fullSuiteDisposition']='Once-only full suite has two obsolete authored-view identity guard failures; NOT a zero-failure full-suite result. Two repaired guards checked separately.'
 record['recoveryGuardTerminal']=read(OUT/'08-guards-terminal.json');assert record['recoveryGuardTerminal']['exitCode']==0
 recovery=(OUT/'08-guards.log').read_text();assert re.search(r'ℹ pass 2\b',recovery);assert re.search(r'ℹ fail 0\b',recovery)
 # Keep complete final five-file snapshot and exact SHA-based diff.
 names=['work/src/authored-scene-view.js','work/src/battlefront-building-finish.js','work/tests/battlefront-building-finish.test.mjs',*sorted(guardPaths)]
 diff=[]
 for name in names:
  dest=OUT/'final-source'/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((ROOT/name).read_bytes())
  old=(OUT/'authored-scene-view.before.js').read_text() if name.endswith('/authored-scene-view.js') else (OUT/'old-guards'/pathlib.Path(name).name).read_text() if name in guardPaths else ''
  diff.extend(difflib.unified_diff(old.splitlines(True),(ROOT/name).read_text().splitlines(True),fromfile='approved-g2-base/'+name,tofile='grounded-g2/'+name))
 (OUT/'source.diff').write_text(''.join(diff))
record['sourceDiffSHA256']=sha((OUT/'source.diff').read_bytes());(FINAL/f'{"pre-suite" if mode=="pre" else "final"}-identity.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({k:v for k,v in record.items() if k not in ['sourceHead','BF1AuthorityRecursiveClosure','retainedReplayAuthority','builds','protectedPredecessorArchives']},indent=2))
