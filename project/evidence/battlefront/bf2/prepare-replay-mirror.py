"""Copy frozen code and original BF1 harness/accepted raw; no execution transformation."""
from pathlib import Path
import shutil,hashlib,json,os
out=Path(__file__).resolve().parent; root=out.parents[2]; work=root/'work'; mirror=out/'replay-mirror'; mw=mirror/'work'
assert not mirror.exists(),'refuse overwrite mirror'
mw.mkdir(parents=True)
shutil.copytree(work/'src',mw/'src')
for f in ['package.json','package-lock.json']:
 shutil.copy2(work/f,mw/f)
(mw/'scripts').mkdir();shutil.copy2(work/'scripts/battlefront-replay.mjs',mw/'scripts/battlefront-replay.mjs')
for f in ['assets/armor/rigs.js','assets/armor/quaternius-sandfalcon-rig.js']:
 p=mw/f;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(work/f,p)
os.symlink(str((work/'node_modules').resolve()),mw/'node_modules',target_is_directory=True)
(mw/'qa/battlefront-depot').mkdir(parents=True)
raw=mirror/'evidence/battlefront/bf1/route-qa';raw.mkdir(parents=True)
for route in ['direct','covered']:
 for suffix in ['result.json.gz','inputs.json']:
  filename=f'sandfalcon-{route}-{suffix}';shutil.copy2(root/'evidence/battlefront/bf1/route-qa'/filename,raw/filename)
hash=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
files=[*sorted((work/'src').rglob('*')),work/'scripts/battlefront-replay.mjs',work/'assets/armor/rigs.js',work/'assets/armor/quaternius-sandfalcon-rig.js',work/'package.json',work/'package-lock.json']
identities={str(p.relative_to(work)):{'final':hash(p),'mirror':hash(mw/p.relative_to(work))} for p in files if p.is_file()}
assert all(v['final']==v['mirror'] for v in identities.values())
rawidentities={p.name:hash(p) for p in sorted(raw.iterdir())}
record={'boundary':'Byte-exact original BF1 harness in isolated mirror. No wrapper or field repair. This is CPU physical replay, not app entry/render acceptance.','finalWork':str(work),'mirrorWork':str(mw),'readonlyBorrowedNodeModules':os.readlink(mw/'node_modules'),'files':identities,'copiedAcceptedRawAndInputs':rawidentities}
(out/'mirror-input-identities.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'mirror':str(mw),'filesEqual':len(identities),'harnessSHA256':hash(work/'scripts/battlefront-replay.mjs'),'raw':rawidentities}))
