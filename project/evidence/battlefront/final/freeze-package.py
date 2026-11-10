#!/usr/bin/env python3
"""One-shot private freeze. No install/build/simulation/upload. Never overwrite.
The controller launches a separate-session worker, kills/waits for its process
group on timeout, and preserves all partial outputs and terminal records.
"""
from pathlib import Path
import datetime, gzip, hashlib, json, os, signal, subprocess, sys, traceback, zipfile

ROOT = Path(__file__).resolve().parents[3]
FINAL = ROOT / 'evidence/battlefront/final'
STATUS = ROOT / 'BATTLEFRONT_FREEZE_STATUS.json'
SOURCE = ROOT / 'iron-route-battlefront-depot-source-candidate.zip'
DEVICE = ROOT / 'iron-route-battlefront-depot-device-candidate.zip'
SOURCE_MANIFEST = ROOT / 'battlefront-source-entry-manifest.json'
HANDOFF = ROOT / 'BATTLEFRONT_ARTIFACT_HANDOFF.json'
REVIEW_SHA = '8a20728a3c9f9545f16334b66b19465c4e610493ce8f28ca1cfe56c3cdfc6416'
WHOLE_HEAD_SHA = '52b827337ae84830d0f3b5a7d6cfc39749cebe0a958a9d7c8a47104238cfca13'
CODE_SHA = 'd1c5f94bb5589c2405f01da6618fa7e60ba005beee8af8f4242b45baa8b09d6f'
OLD = {
 'ruined_performance_candidate/iron-route-sweep-acceleration-source-candidate.zip': '83fcc0daee46a8e4e49371d49d4bf66487de7b88d2d57c659119dec6e30f246e',
 'ruined_performance_candidate/iron-route-sweep-acceleration-device-copy.zip': '1a7d8ae21364fa2213e4931267638737842101caf2d2937c25d6ffab3303bdf2',
}

def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def digest(data): return hashlib.sha256(data).hexdigest()
def row(path):
 h = hashlib.sha256()
 with path.open('rb') as stream:
  for block in iter(lambda: stream.read(1024 * 1024), b''): h.update(block)
 return {'bytes': path.stat().st_size, 'sha256': h.hexdigest()}
def read(path): return json.loads(path.read_text())
def save_new(path, value):
 with path.open('x') as stream: json.dump(value, stream, ensure_ascii=False, indent=2); stream.write('\n')
def regular_tree(root):
 for folder, dirs, files in os.walk(root, followlinks=False):
  dirs[:] = sorted(d for d in dirs if d not in {'node_modules', '.git', '__pycache__', 'replay-mirror'} and not (Path(folder)/d).is_symlink())
  for name in sorted(files):
   path = Path(folder)/name
   if path.is_file() and not path.is_symlink(): yield path
def audit_zip(path, expected):
 with zipfile.ZipFile(path) as archive:
  names = archive.namelist()
  assert len(names) == len(set(names)) == len(expected)
  assert set(names) == set(expected)
  assert archive.testzip() is None
  for name in names:
   parts = Path(name).parts
   assert not name.startswith('/') and '..' not in parts
   assert not {'node_modules', '.git', '__pycache__', 'replay-mirror'} & set(parts)
   data = archive.read(name)
   assert {'bytes': len(data), 'sha256': digest(data)} == expected[name], ('archive entry', name)
 return {'archive': path.name, **row(path), 'entries': len(expected), 'allEntryHashesVerified': True, 'crcVerified': True}

def freeze():
 for path in [SOURCE, DEVICE, SOURCE_MANIFEST, HANDOFF, FINAL/'pre-freeze-audit.json', FINAL/'review-gate.json']:
  assert not path.exists(), ('Never overwrite, inspect prior execution', str(path))
 assert row(FINAL/'whole-review.md')['sha256'] == REVIEW_SHA
 assert 'Ready to freeze private Mac/source candidate: YES.' in (FINAL/'whole-review.md').read_text()
 disposition = read(FINAL/'controller-review-disposition.json')
 assert disposition['privateFreezeApproved'] and disposition['requiredFindingsOpen'] == 0
 head_path = ROOT/'evidence/battlefront/sdd/whole-review-head.json'
 assert row(head_path)['sha256'] == WHOLE_HEAD_SHA
 head = read(head_path)
 for section in ['sourceAndHelperFiles', 'reportsAndBindings']:
  for name, expected in head[section].items(): assert row(ROOT/name) == expected, ('reviewed head drift', name)
 code_path = ROOT/'evidence/battlefront/bf2/final-source-manifest.json'
 assert row(code_path)['sha256'] == CODE_SHA
 code = read(code_path)
 def current_code():
  paths = [p for folder in ['src','tests','scripts','locales'] for p in regular_tree(ROOT/'work'/folder)]
  paths += [ROOT/'work'/n for n in ['build.mjs','build-english.mjs','package.json','package-lock.json']]
  return {str(p.relative_to(ROOT/'work')): row(p)['sha256'] for p in sorted(paths)}
 assert current_code() == code, 'Frozen source set/bytes changed'
 audit = read(ROOT/'evidence/battlefront/bf2/final-audit.json')
 suite = audit['fullSuite']; terminal = read(ROOT/'evidence/battlefront/bf2/08-full-suite-terminal.json')
 assert suite['tests'] == 1100 and suite['pass'] == 1079 and suite['fail'] == 0 and suite['skipped'] == 21
 assert terminal['exit'] == 0 and terminal['codeDrift'] == [] and not audit['finalCodeDrift']
 build_rows = {}
 for folder, build in audit['builds'].items():
  for name, expected in build['files'].items():
   key = f'work/{folder}/{name}'; assert row(ROOT/key) == expected, ('build drift', key); build_rows[key] = expected
  assert build['manifest']['browserVerified'] is False and build['manifest']['runtimeRequestsMeasured'] is False
  assert build['manifest']['sweepAcceleration']['resolved'] == 'src/ruined-depot-world-accelerated.js'
 for route, record in audit['replays'].items():
  assert record['fullJSONEqualAccepted'] and record['generatedCompressedBytesEqualAccepted']
  for item in record['copies'].values(): assert row(ROOT/item['copied']) == {k:item[k] for k in ['bytes','sha256']}
  generated = ROOT/f'evidence/battlefront/bf2/replays/{route}-generated-result.json.gz'
  accepted = ROOT/f'evidence/battlefront/bf1/route-qa/sandfalcon-{route}-result.json.gz'
  assert generated.read_bytes() == accepted.read_bytes()
  raw = json.loads(gzip.decompress(generated.read_bytes()))
  assert raw['finalState']['phase'] == 'won' and raw['finalState']['entities']['supply']['arrived']
  for name, content in raw['sourceSnapshot'].items(): assert (ROOT/'work'/name).read_text() == content
 base = read(ROOT/'BASE.json'); predecessor = Path(base['sourceRoot'])
 for name, expected in base['files'].items(): assert row(predecessor/name) == expected, ('parent work drift',name)
 for name, expected in OLD.items(): assert row(ROOT.parent/name)['sha256'] == expected, ('old archive drift',name)
 bf2base = read(ROOT/'evidence/battlefront/sdd/bf2-base-head.json')['workFiles']
 expected_work = set(bf2base) | {n.removeprefix('work/') for n in head['sourceAndHelperFiles'] if n.startswith('work/')} | {n.removeprefix('work/') for n in build_rows}
 actual_work = {str(p.relative_to(ROOT/'work')) for p in regular_tree(ROOT/'work')}
 assert actual_work == expected_work, ('unexpected/missing work set', sorted(actual_work-expected_work), sorted(expected_work-actual_work))
 fixture_manifest = read(ROOT/'evidence/battlefront/sdd/legacy-test-fixtures.json')
 for name, expected in fixture_manifest['files'].items():
  assert row(ROOT/name) == expected and row(Path(fixture_manifest['sourceRoot'])/name) == expected
 pre = {'utc':now(),'reviewSHA256':REVIEW_SHA,'wholeHeadSHA256':WHOLE_HEAD_SHA,'sourceManifestSHA256':CODE_SHA,'frozenCodeFiles':len(code),'completeWorkSetFiles':len(actual_work),'parentWorkFilesExact':len(base['files']),'predecessorArchiveHashes':OLD,'suite':{k:suite[k] for k in ['tests','pass','fail','skipped','seconds']},'buildRows':build_rows,'fullReplaysExact':['direct','covered'],'privateOnly':True}
 save_new(FINAL/'pre-freeze-audit.json',pre)
 gate = {'controllerAuthorizesFreeze':True,'independentTaskReviewsApproved':True,'independentStrongestWholeReviewApproved':True,'requiredFindingsOpen':0,'reviewSHA256':REVIEW_SHA,'wholeHeadSHA256':WHOLE_HEAD_SHA,'sourceManifestSHA256':CODE_SHA,'preAuditSHA256':row(FINAL/'pre-freeze-audit.json')['sha256'],'privateDevelopmentAcceptanceOnly':True,'browserVerified':False,'publicReleaseApproved':False,'macPerformanceFixProved':False}
 save_new(FINAL/'review-gate.json',gate)
 selected = [p for folder in ['work','evidence','docs','credits'] for p in regular_tree(ROOT/folder)]
 selected += [ROOT/n for n in ['BASE.json','README.md','PACKAGING_PLAN.md']]
 selected = sorted(set(selected)); rows = {str(p.relative_to(ROOT)):row(p) for p in selected}
 for name, expected in head['sourceAndHelperFiles'].items(): assert rows[name] == expected
 for name, expected in head['reportsAndBindings'].items(): assert rows[name] == expected
 for name, expected in build_rows.items(): assert rows[name] == expected
 for name in fixture_manifest['files']: assert name in rows
 source_manifest = {'candidate':'battlefront-depot-private-acceptance','reviewGate':gate,'files':rows,'excluded':['node_modules','.git','__pycache__','replay-mirror'],'sourceScope':'Current application code/runtime assets/tests/evidence. Earlier upstream/DCC source collections remain in preserved predecessor Library source archive; no claim to duplicate every historical authoring file.','browserVerified':False,'macPerformanceFixProved':False,'publicCommercialReleaseApproved':False}
 save_new(SOURCE_MANIFEST,source_manifest); selected.append(SOURCE_MANIFEST); rows[SOURCE_MANIFEST.name]=row(SOURCE_MANIFEST)
 with zipfile.ZipFile(SOURCE,'x',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
  for path in selected: archive.write(path,str(path.relative_to(ROOT)))
 source_result = audit_zip(SOURCE,rows)
 device_files = {}
 offline = ['dist/铁流_电脑浏览器离线版.html','dist-en/Iron_Route_Desktop_Offline.html']
 for name in offline:
  data=(ROOT/'work'/name).read_bytes();assert {'bytes':len(data),'sha256':digest(data)}==build_rows['work/'+name];device_files[name]=data
 for folder in ['dist','dist-en']:
  for name in ['THREE_LICENSE.txt','game.js.LEGAL.txt','build-manifest.json','build-metafile.json']:
   device_files[f'{folder}/{name}']=(ROOT/'work'/folder/name).read_bytes()
 for path in regular_tree(ROOT/'work/licenses'): device_files[str(path.relative_to(ROOT/'work'))]=path.read_bytes()
 for path in regular_tree(ROOT/'credits'): device_files[str(path.relative_to(ROOT))]=path.read_bytes()
 for folder in ['art-kit','armor','terrain','ruined-depot']:
  device_files[f'credits/assets-{folder}.md']=(ROOT/'work/assets'/folder/'README.md').read_bytes()
 device_files['credits/ORIGINAL_TANK_PROVENANCE.md']=(ROOT/'work/assets/PROVENANCE.md').read_bytes()
 for path in regular_tree(ROOT/'work/src/terrain-candidate/vendor'):
  if 'license' in path.name.lower() or 'readme' in path.name.lower(): device_files['credits/vendor/'+str(path.relative_to(ROOT/'work/src/terrain-candidate/vendor'))]=path.read_bytes()
 for locale,target in zip(['CN','EN'],offline):
  device_files[f'Open_Battlefront_Depot_{locale}.html']=f'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url={target}?sortie=battlefront-depot"><a href="{target}?sortie=battlefront-depot">Open Battlefront Depot ({locale})</a>'.encode()
 device_files['MAC_ACCEPTANCE_PENDING.md']=(ROOT/'evidence/battlefront/MAC_ACCEPTANCE_PENDING.md').read_bytes()
 device_files['WHOLE_REVIEW.md']=(FINAL/'whole-review.md').read_bytes()
 device_files['RULINGS_MADE.md']=(ROOT/'evidence/battlefront/RULINGS_MADE.md').read_bytes()
 device_files['CONTROLLER_DISPOSITION.json']=(FINAL/'controller-review-disposition.json').read_bytes()
 device_files['README.txt']=('Private development/device acceptance candidate, mission-9080 / battlefront-depot. Extract into a NEW folder and open Open_Battlefront_Depot_CN.html or EN.html. These launchers only open the exact built standalone HTML with ?sortie=battlefront-depot. No Node install required. Old versions are not replaced. No new tank/Strv; existing five vehicles only. Source regression1079pass/0fail/21inherited skips; real device rendering/touch/HUD and seconds-long scheduling remain unaccepted/unresolved. Original Vanguard public/commercial redistribution rights are not cleared. Retain licenses/credits and read the Mac checklist and whole review. No Mac raw-data upload.\n').encode()
 device_rows={n:{'bytes':len(b),'sha256':digest(b)} for n,b in device_files.items()}
 device_manifest={'candidate':'battlefront-depot-private-device','sourceArchive':source_result,'reviewGate':gate,'exactBuiltOfflineHTML':{n:build_rows['work/'+n] for n in offline},'files':device_rows,'browserVerified':False,'macPerformanceFixProved':False,'publicReleaseApproved':False}
 name='battlefront-device-exact-manifest.json';device_files[name]=(json.dumps(device_manifest,ensure_ascii=False,indent=2)+'\n').encode();device_rows[name]={'bytes':len(device_files[name]),'sha256':digest(device_files[name])}
 with zipfile.ZipFile(DEVICE,'x',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
  for name,data in device_files.items(): archive.writestr(name,data)
 device_result=audit_zip(DEVICE,device_rows)
 for path in selected: assert row(path)==rows[str(path.relative_to(ROOT))], ('changed during freeze',str(path))
 assert current_code()==code
 for name,expected in OLD.items(): assert row(ROOT.parent/name)['sha256']==expected
 for name,expected in base['files'].items(): assert row(predecessor/name)==expected
 result={'utc':now(),'status':'frozen-and-ZIP-verified','source':source_result,'device':device_result,'wholeReviewSHA256':REVIEW_SHA,'sourceManifestSHA256':CODE_SHA,'sourceEntryManifestSHA256':row(SOURCE_MANIFEST)['sha256'],'allSelectedCurrentAndZipBytesExact':True,'old709ParentWorkFilesExact':True,'twoPredecessorArchivesExact':True,'privateDevelopmentAcceptanceOnly':True,'browserVerified':False,'macPerformanceFixProved':False,'uploadAttempted':False}
 save_new(HANDOFF,result); print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':
 if '--worker' in sys.argv:
  assert STATUS.exists(), 'Use registered controller, not direct worker'
  freeze()
 else:
  assert not STATUS.exists(), 'Prior execution exists: inspect status/process/output; never blindly retry'
  status={'status':'registered','utc':now(),'controllerPID':os.getpid(),'script':row(Path(__file__)),'timeoutSeconds':900,'processGroupTermination':True,'uploadAttempted':False}
  save_new(STATUS,status)
  def checkpoint(): STATUS.write_text(json.dumps(status,indent=2)+'\n')
  try:
   with (ROOT/'BATTLEFRONT_PACKAGE.log').open('x') as log:
    proc=subprocess.Popen([sys.executable,str(Path(__file__)),'--worker'],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
    status.update(status='running',workerPID=proc.pid,processGroupId=proc.pid);checkpoint()
    try: code=proc.wait(timeout=900)
    except subprocess.TimeoutExpired:
     status.update(status='timeout-terminating-process-group',timedOut=True);checkpoint();os.killpg(proc.pid,signal.SIGTERM)
     try: proc.wait(timeout=5)
     except subprocess.TimeoutExpired: os.killpg(proc.pid,signal.SIGKILL);proc.wait(timeout=5)
     raise RuntimeError('Packaging timed out; partial outputs retained, do not deliver or blindly retry')
   status.update(workerExit=code,endedUTC=now());checkpoint();assert code==0, 'Worker failed; inspect retained log and artifacts'
   result=read(HANDOFF)
   for key in ['source','device']: assert row(ROOT/result[key]['archive'])=={k:result[key][k] for k in ['bytes','sha256']}
   status.update(status='completed',exitCode=0,handoff=row(HANDOFF));checkpoint();print(json.dumps(result,ensure_ascii=False))
  except BaseException as error:
   status.update(status='failed-incomplete-do-not-handoff',exitCode=1,endedUTC=now(),error=repr(error),traceback=traceback.format_exc());checkpoint();raise
