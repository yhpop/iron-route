from pathlib import Path
import sys,json,hashlib
out=Path(__file__).resolve().parent; record=json.loads((out/'mirror-input-identities.json').read_text()); final=Path(record['finalWork']); mirror=Path(record['mirrorWork']); hash=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
checks={f:{'frozen':v['final'],'final':hash(final/f),'mirror':hash(mirror/f)} for f,v in record['files'].items()}
raw={name:hash(mirror.parent/'evidence/battlefront/bf1/route-qa'/name) for name in record['copiedAcceptedRawAndInputs']}
frozen=json.loads((out/'final-source-manifest.json').read_text());drift=[f for f,v in frozen.items() if hash(final/f)!=v]
result={'label':sys.argv[1],'files':checks,'raw':raw,'finalFrozenCodeDrift':drift};(out/(sys.argv[1]+'-mirror-check.json')).write_text(json.dumps(result,indent=2)+'\n')
assert all(v['frozen']==v['final']==v['mirror'] for v in checks.values());assert raw==record['copiedAcceptedRawAndInputs'];assert not drift
print(json.dumps({'mirrorCheck':sys.argv[1],'equalFiles':len(checks),'acceptedRawAndInputsUnchanged':True,'finalFrozenCodeDrift':drift}))
