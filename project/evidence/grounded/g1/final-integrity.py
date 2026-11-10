import difflib,gzip,hashlib,json,pathlib,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[3];OUT=pathlib.Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
b=json.loads((ROOT/'evidence/grounded/BASE.json').read_text());expected={x['path']:x for x in b['entries']};changed=[]
for e in b['entries']:
 p=ROOT/e['path'];actual=sha(p.read_bytes()) if p.is_file() else None
 if actual!=e['sha256']:changed.append({'path':e['path'],'old':e['sha256'],'new':actual})
allowed={'work/src/terrain-candidate/relief-view.js','work/tests/battlefront-depot-terrain.test.mjs'}
assert {e['path'] for e in changed}==allowed,changed
owned=['work/src/battlefront-perimeter-view.js','work/src/terrain-candidate/relief-view.js','work/tests/battlefront-depot-terrain.test.mjs','work/tests/battlefront-perimeter.test.mjs','work/tests/battlefront-grounded-terrain.test.mjs']
archive=pathlib.Path(b['parentSourceArchive']);assert sha(archive.read_bytes())==b['parentSourceSHA256']
snapshot=OUT/'final-source';snapshot.mkdir(exist_ok=True)
with zipfile.ZipFile(archive) as z:
 diff=[]
 for name in owned:
  p=ROOT/name;new=p.read_text();old=z.read(name).decode() if name in z.namelist() else ''
  dest=snapshot/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(new)
  diff.extend(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='approved-source/'+name,tofile='grounded-g1/'+name))
 (OUT/'source.diff').write_text(''.join(diff))
# Preserve exact failed-test inputs by reconstructing only the two documented later adapter additions.
red=OUT/'red-tests';red.mkdir(exist_ok=True);redchecks={};before=json.loads((OUT/'01-red-before.json').read_text())
for name,marker in [('battlefront-grounded-terrain.test.mjs',"\ntest('actual candidate outside-bounds"),('battlefront-perimeter.test.mjs',"\ntest('all three retained")]:
 name='work/tests/'+name;s=(ROOT/name).read_text().split(marker)[0]
 if 'grounded' in name:s=s.replace(".replace(/\\bmax\\(/g,'Math.max(')",'')
 actual=sha(s.encode());assert actual==before[name],(name,actual,before[name]);(red/pathlib.Path(name).name).write_text(s);redchecks[name]=actual
physical={}
for route in ['direct','covered']:
 p=ROOT/f'evidence/battlefront/bf1/route-qa/sandfalcon-{route}-result.json.gz';j=json.load(gzip.open(p,'rt'));mismatches=[]
 for name,text in j['sourceSnapshot'].items():
  raw=(ROOT/'work'/name).read_bytes()
  if raw.decode()!=text or sha(raw)!=j['sourceHashes'][name]:mismatches.append(name)
 assert not mismatches,mismatches
 physical[route]={'artifactSHA256':sha(p.read_bytes()),'sourceKeys':len(j['sourceSnapshot']),'mismatches':mismatches,'sourceHashes':j['sourceHashes'],'inputs':j['inputs'],'specHash':j['specHash'],'finalHash':j['finalHash'],'freshSimulation':False}
head={}
for prefix in ['work/src','work/tests','work/scripts','work/assets']:
 for p in sorted((ROOT/prefix).rglob('*')):
  if p.is_file():head[str(p.relative_to(ROOT))]=sha(p.read_bytes())
identity={'approvedSourceArchiveSHA256':sha(archive.read_bytes()),'baseManifestSHA256':sha((ROOT/'evidence/grounded/BASE.json').read_bytes()),'preexistingEntries':len(b['entries']),'changedPreexisting':changed,'unexpectedPreexistingChanges':[],'ownedSource':{n:sha((ROOT/n).read_bytes()) for n in owned},'redTestsExactPrelaunchBinding':redchecks,'retainedPhysicalAuthority':physical,'workSourceTestScriptAssetCount':len(head),'completeWorkSourceTestScriptAssetHeadSHA256':sha(json.dumps(head,sort_keys=True,separators=(',',':')).encode()),'sourceHead':head,'sourceDiffSHA256':sha((OUT/'source.diff').read_bytes()),'runnerSHA256':sha((OUT/'run-job.py').read_bytes()),'sourceSnapshot':'evidence/grounded/g1/final-source','noGitHead':'No Git command permitted; complete content-addressed source head supplied instead.'}
(OUT/'final-identity.json').write_text(json.dumps(identity,indent=2)+'\n')
print(json.dumps({k:v for k,v in identity.items() if k not in ['sourceHead','retainedPhysicalAuthority']},indent=2));print('retained physical authority:',{r:dict(sourceKeys=v['sourceKeys'],mismatches=v['mismatches']) for r,v in physical.items()})
