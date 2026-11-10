#!/usr/bin/env python3
"""Exclusive private freeze. No build, replay, network or predecessor writes."""
from pathlib import Path
import datetime,gzip,hashlib,json,os,zipfile
R=Path(__file__).resolve().parents[3];O=Path(__file__).resolve().parent
SOURCE=R/'iron-route-loading-extraction-source-candidate.zip'
DEVICE=R/'iron-route-loading-extraction-device-candidate.zip'
MANIFEST=R/'extraction-source-entry-manifest.json';HANDOFF=R/'EXTRACTION_ARTIFACT_HANDOFF.json'
EXCLUDE={'node_modules','.git','__pycache__','replay-mirror'}
ROOT_EXCLUDE={SOURCE.name,DEVICE.name,MANIFEST.name,HANDOFF.name,'EXTRACTION_LIBRARY_HANDOFF.json','EXTRACTION_POST_FREEZE_CHECK.json'}
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def digest(b):return hashlib.sha256(b).hexdigest()
def row(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return {'bytes':p.stat().st_size,'sha256':h.hexdigest()}
def read(p):return json.loads(p.read_text())
def save(p,obj):
 with p.open('x') as f:json.dump(obj,f,ensure_ascii=False,indent=2);f.write('\n')
def tree(root):
 for folder,dirs,files in os.walk(root,followlinks=False):
  dirs[:]=sorted(d for d in dirs if d not in EXCLUDE and not (Path(folder)/d).is_symlink())
  for n in sorted(files):
   p=Path(folder)/n
   if p.is_file() and not p.is_symlink():yield p

def selected(p):
 rel=p.relative_to(R)
 if len(rel.parts)==1 and (p.name in ROOT_EXCLUDE or p.suffix=='.zip'):return False
 if p.parent==O and (p.name.startswith('01-freeze') or p.name=='freeze-registration.json'):return False
 return True

def audit_zip(p,expected):
 with zipfile.ZipFile(p) as z:
  names=z.namelist();assert len(names)==len(set(names))==len(expected);assert set(names)==set(expected);assert z.testzip() is None
  for n in names:
   q=Path(n);assert not q.is_absolute() and '..' not in q.parts and not EXCLUDE.intersection(q.parts),n
   data=z.read(n);assert {'bytes':len(data),'sha256':digest(data)}==expected[n],n
 return {'archive':p.name,**row(p),'entries':len(expected),'allEntryHashesVerified':True,'crcVerified':True}

def check_sources(head):
 paths=[p for d in ['src','tests','scripts','assets','locales'] for p in tree(R/'work'/d)]
 paths.extend(R/p for p in head['buildConfigPaths'])
 actual={str(p.relative_to(R)):row(p)['sha256'] for p in paths}
 assert actual==head['sourceHead'],'Full source membership or bytes drift'
 assert digest(json.dumps(actual,sort_keys=True,separators=(',',':')).encode())==head['sourceHeadSHA256']
 return actual

def main():
 reg=read(O/'freeze-registration.json');assert reg['exclusiveAttempt']==1 and reg['workerSHA256']==row(Path(__file__))['sha256']
 for p in [SOURCE,DEVICE,MANIFEST,HANDOFF,O/'pre-freeze-audit.json']:assert not p.exists(),('Inspect existing outcome; never overwrite',str(p))
 a=read(O/'freeze-approval.json');assert a['privateFreezeApproved'] and a['requiredFindingsOpen']==0
 assert a['compositeGateAccepted'] and not a['zeroFailureFullSuiteClaim'] and not a['publicReleaseApproved']
 for key in ['wholeReview','e1Review','e2Review','reviewHead']:
  assert row(R/a[key+'Path'])['sha256']==a[key+'SHA256'],key
 assert 'Ready to freeze private Mac/source candidate: YES.' in (R/a['wholeReviewPath']).read_text()
 reviewed=read(R/a['reviewHeadPath'])
 for name,expected in reviewed['files'].items():assert row(R/name)==expected,('Reviewed byte drift',name)
 head=read(R/'evidence/extraction/e2/source-head.json');assert head['sourceHeadSHA256']==a['finalSourceHeadSHA256'];check_sources(head)
 full=read(R/'evidence/extraction/e2/06-full-suite-terminal.json');focused=read(R/'evidence/extraction/e2/07-scope-recovery-terminal.json');final=read(R/'evidence/extraction/e2/08-final-readonly-audit-terminal.json')
 for t,code in [(full,1),(focused,0),(final,0)]:assert t['exitCode']==code and not t['timedOut'] and t['sourceIdentityUnchanged'] and not t['livingGroupAfterWait']
 log=(R/'evidence/extraction/e2/06-full-suite.log').read_text()
 for text in ['tests 1138','pass 1116','fail 1','skipped 21','cancelled 0']:assert text in log,text
 recovery=(R/'evidence/extraction/e2/07-scope-recovery.log').read_text();assert 'pass 1' in recovery and 'fail 0' in recovery
 identity=read(R/'evidence/extraction/e2/final-integrity.json');assert identity['sourceHeadSHA256']==head['sourceHeadSHA256']
 for name,v in identity['baselineChecks'].items():assert row(R/name)['sha256']==v['actual'],name
 assert len(identity['baselineChecks'])==1814
 for name,v in identity['archiveChecks'].items():assert row(R.parent/name)['sha256']==v['expected']==v['actual'],name
 assert len(identity['archiveChecks'])==14
 # The immutable parent extraction sources, not only ZIP identities, remain intact.
 base=read(R/'evidence/extraction/BASE.json')
 for e in base['entries']:assert row(R.parent/'battlefront_grounded_candidate'/e['path'])=={'bytes':e['bytes'],'sha256':e['sha256']},e['path']
 for owner in ['e1','e2']:
  for name,s in read(R/f'evidence/extraction/{owner}/evidence-manifest.json')['files'].items():assert row(R/f'evidence/extraction/{owner}'/name)['sha256']==s,name
 for stem in ['win-direct-01','win-direct-01-fresh','playerloss-01','truckloss-02']:
  raw=json.loads(gzip.decompress((R/f'evidence/extraction/e1/{stem}-result.json.gz').read_bytes()))
  assert len(raw['sourceSnapshot'])==32
  for name,source in raw['sourceSnapshot'].items():
   data=(R/'work'/name).read_bytes();assert data.decode()==source and digest(data)==raw['sourceHashes'][name],name
 inspection=read(R/'evidence/extraction/e2/build-and-physical-inspection.json')
 assert inspection['onlySourceChangeSince06']==['work/tests/battlefront-depot-scope.test.mjs']
 for folder,b in inspection['builds'].items():
  assert row(R/'work'/folder/'game.js')=={'bytes':b['javascriptBytes'],'sha256':b['javascriptSHA256']}
  assert row(R/'work'/folder/'build-metafile.json')['sha256']==b['metafileSHA256']
  assert row(R/'work'/folder/'build-manifest.json')['sha256']==b['manifestSHA256']
  assert row(R/b['standalonePath'])=={'bytes':b['standaloneBytes'],'sha256':b['standaloneSHA256']}
  assert b['standaloneScriptExactBundle'] and b['newSlugAndIdPresentInBundle']
 gate={'utc':now(),'privateFreezeApproved':True,'requiredFindingsOpen':0,'compositeGateAccepted':True,'zeroFailureFullSuiteClaim':False,'fullSuite':{'tests':1138,'pass':1116,'fail':1,'skipped':21,'cancelled':0},'focusedRecovery':{'pass':1,'fail':0},'sourceHeadSHA256':head['sourceHeadSHA256'],'wholeReviewSHA256':a['wholeReviewSHA256'],'browserVerified':False,'macPerformanceFixProved':False,'publicReleaseApproved':False}
 save(O/'pre-freeze-audit.json',gate)
 files=[p for p in tree(R) if selected(p)];rows={str(p.relative_to(R)):row(p) for p in files}
 assert {e['path'] for e in base['entries']}.issubset(rows)
 for n,v in reviewed['files'].items():assert rows[n]==v,n
 save(MANIFEST,{'candidate':'loading-extraction-private-source','reviewGate':gate,'files':rows,'excludedDirectories':sorted(EXCLUDE),'privateOnly':True,'sourceScope':'All selected inherited and current source/tests/evidence/docs/builds; predecessor archives remain separate and unchanged.'})
 files.append(MANIFEST);rows[MANIFEST.name]=row(MANIFEST)
 with zipfile.ZipFile(SOURCE,'x',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for p in files:z.write(p,str(p.relative_to(R)))
 src=audit_zip(SOURCE,rows)
 device={};offline=['dist/铁流_电脑浏览器离线版.html','dist-en/Iron_Route_Desktop_Offline.html']
 for n in offline:device[n]=(R/'work'/n).read_bytes()
 for folder in ['dist','dist-en']:
  for n in ['THREE_LICENSE.txt','game.js.LEGAL.txt','build-manifest.json','build-metafile.json']:device[f'{folder}/{n}']=(R/'work'/folder/n).read_bytes()
 for root,prefix in [(R/'work/licenses','licenses'),(R/'credits','credits')]:
  for p in tree(root):device[prefix+'/'+str(p.relative_to(root))]=p.read_bytes()
 for folder in ['art-kit','armor','terrain','ruined-depot']:device[f'credits/assets-{folder}.md']=(R/'work/assets'/folder/'README.md').read_bytes()
 device['credits/ORIGINAL_TANK_PROVENANCE.md']=(R/'work/assets/PROVENANCE.md').read_bytes()
 vendor=R/'work/src/terrain-candidate/vendor'
 for p in tree(vendor):
  if 'license' in p.name.lower() or 'readme' in p.name.lower():device['credits/vendor/'+str(p.relative_to(vendor))]=p.read_bytes()
 for locale,target in zip(['CN','EN'],offline):device[f'Open_Loading_Extraction_{locale}.html']=f'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url={target}?sortie=loading-extraction"><a href="{target}?sortie=loading-extraction">Open Loading Extraction ({locale})</a>'.encode()
 for dest,path in {'README.txt':'START_HERE_EXTRACTION.md','MAC_BASELINE_LIMITATIONS.md':'evidence/extraction/MAC_BASELINE_RESULT_1513.md','DEVICE_ACCEPTANCE_NOT_EXECUTED.md':'evidence/extraction/sdd/device-acceptance-draft.md','E1_REVIEW.md':a['e1ReviewPath'],'E2_EVIDENCE_CLARIFICATION.md':'evidence/extraction/E2_REPORT_CLARIFICATION.md','E2_REVIEW.md':a['e2ReviewPath'],'WHOLE_REVIEW.md':a['wholeReviewPath'],'CONTROLLER_DISPOSITION.json':'evidence/extraction/delivery/freeze-approval.json','RULINGS_MADE.md':'evidence/extraction/RULINGS_MADE.md'}.items():device[dest]=(R/path).read_bytes()
 deviceRows={n:{'bytes':len(b),'sha256':digest(b)} for n,b in device.items()}
 dm={'candidate':'loading-extraction-private-device','sourceArchive':src,'reviewGate':gate,'files':deviceRows,'browserVerified':False,'macPerformanceFixProved':False,'publicReleaseApproved':False}
 b=(json.dumps(dm,ensure_ascii=False,indent=2)+'\n').encode();device['extraction-device-exact-manifest.json']=b;deviceRows['extraction-device-exact-manifest.json']={'bytes':len(b),'sha256':digest(b)}
 with zipfile.ZipFile(DEVICE,'x',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for n,b in device.items():z.writestr(n,b)
 dev=audit_zip(DEVICE,deviceRows)
 for p in files:assert row(p)==rows[str(p.relative_to(R))],('Changed during freeze',str(p))
 check_sources(head)
 for n,v in identity['archiveChecks'].items():assert row(R.parent/n)['sha256']==v['expected'],n
 save(HANDOFF,{'utc':now(),'status':'frozen-and-ZIP-verified','source':src,'device':dev,'reviewGate':gate,'allSelectedCurrentAndZipBytesExact':True,'predecessorArchivesExact':14,'sourceEntryManifestSHA256':row(MANIFEST)['sha256'],'uploadAttempted':False})
 print(json.dumps(read(HANDOFF),ensure_ascii=False,indent=2))
if __name__=='__main__':main()
