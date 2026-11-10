#!/usr/bin/env python3
"""Read-only inspection of unique06 build outputs and immutable literal E1 records."""
import pathlib,json,hashlib,re,gzip
ROOT=pathlib.Path(__file__).resolve().parents[3];OUT=pathlib.Path(__file__).resolve().parent
sha=lambda v:hashlib.sha256(v).hexdigest()
head=json.loads((OUT/'source-head-fullsuite397.json').read_text())['sourceHead']
changes=[p for p,d in head.items() if sha((ROOT/p).read_bytes())!=d]
assert changes==['work/tests/battlefront-depot-scope.test.mjs'],changes
report={'boundary':'Read-only analysis, not rebuild/replay/browser/device verification','onlySourceChangeSince06':changes,'builds':{},'E1':{}}
for folder,offline in [('dist','铁流_电脑浏览器离线版.html'),('dist-en','Iron_Route_Desktop_Offline.html')]:
 directory=ROOT/'work'/folder;manifest=json.loads((directory/'build-manifest.json').read_text());meta=json.loads((directory/'build-metafile.json').read_text());js=(directory/'game.js').read_bytes();code=js.decode();inputs=meta['inputs']
 assert sha(js)==manifest['sha256'];assert len(js)==manifest['javascriptBytes'];assert manifest['browserVerified']==False and manifest['runtimeRequestsMeasured']==False
 main='src/main.js';new='src/loading-extraction-front.js';ruin='src/ruined-depot-world-accelerated.js';terrain='src/terrain-candidate/combat-world-accelerated.js';world='src/campaign-world-accelerated.js';helper='src/collision-broadphase.js'
 imports=lambda p:[i['path'] for i in inputs[p]['imports'] if not i.get('external')]
 incoming=lambda target:sorted(p for p in inputs if target in imports(p))
 assert new in inputs and new in imports(main);assert 'src/battlefront-depot-front.js' in imports(new)
 for parent,child in [(main,ruin),(ruin,terrain),(terrain,world),(world,helper)]:assert child in imports(parent) and incoming(child)==[parent],(parent,child,incoming(child))
 assert 'src/ruined-depot-world.js' not in inputs
 for p in ['src/terrain-candidate/combat-world.js','src/campaign-world.js']:assert p in inputs and p in imports(main)
 assert 'src/content/generated-records.js' not in inputs and not any('strv103' in p.lower() for p in inputs)
 assert 'loading-extraction' in code and 'mission-9090' in code
 standalone=(directory/offline).read_bytes();html=standalone.decode();match=re.search(r'<script type="module">([\s\S]*)</script>',html);assert match
 assert match.group(1)==re.sub(r'</script',lambda m:'<\\/script',code,flags=re.I)
 assert '<script type="module" src=' not in html;assert '<link rel="stylesheet" href="./style.css">' not in html
 if folder=='dist-en':assert not re.search(r'[\u3400-\u4dbf\u4e00-\u9fff]',code)
 report['builds'][folder]={'javascriptSHA256':sha(js),'javascriptBytes':len(js),'metafileSHA256':sha((directory/'build-metafile.json').read_bytes()),'manifestSHA256':sha((directory/'build-manifest.json').read_bytes()),'standalonePath':str((directory/offline).relative_to(ROOT)),'standaloneSHA256':sha(standalone),'standaloneBytes':len(standalone),'standaloneScriptExactBundle':True,'newMissionInput':new,'newMissionInputBytes':inputs[new]['bytes'],'newSlugAndIdPresentInBundle':True,'acceleratedChain':[[main,ruin],[ruin,terrain],[terrain,world],[world,helper]],'acceleratedIncomingUnique':True,'originalOtherWorldsRetained':True,'browserVerified':False,'runtimeRequestsMeasured':False}
physical=None
for name in ['win-direct-01','win-direct-01-fresh','playerloss-01','truckloss-02']:
 p=ROOT/'evidence/extraction/e1'/(name+'-result.json.gz');raw=json.loads(gzip.decompress(p.read_bytes()));current={f:sha((ROOT/'work'/f).read_bytes()) for f in raw['sourceHashes']}
 assert len(current)==32 and current==raw['sourceHashes'];assert all((ROOT/'work'/f).read_text()==s for f,s in raw['sourceSnapshot'].items())
 if physical is None:physical=current
 else:assert physical==current
 report['E1'][name]={'rawSHA256':sha(p.read_bytes()),'physicalSourceFiles':32,'allPhysicalHashesAndTextExact':True,'phase':raw['finalState']['phase'],'cause':raw['finalState'].get('result',{}).get('cause'),'freshReplayClaim':False}
report['physicalClosure32']=physical
(OUT/'build-and-physical-inspection.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='physicalClosure32'},indent=2))
