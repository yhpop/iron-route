"""Run from task root; compare saved baseline, actual captures and production sources."""
from pathlib import Path
import hashlib,json
p=Path('weathered_road_candidate');r=p/'work';base=Path('grounded_meadow_candidate/work');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
changes=[str(f.relative_to(r)) for f in sorted((r/'src').rglob('*')) if f.is_file() and f.read_bytes()!=(base/f.relative_to(r)).read_bytes()]
assert changes==['src/terrain-candidate/relief-view.js'],changes
preserved={folder:all(f.read_bytes()==(base/f.relative_to(r)).read_bytes() for f in (r/folder).rglob('*') if f.is_file()) for folder in ['assets','qa/accepted40','licenses']}
assert all(preserved.values())
b=(p/'evidence/offline-visuals/baseline/mask.rgba').read_bytes();c=(p/'evidence/offline-visuals/candidate/mask.rgba').read_bytes();outside=[i for i in range(0,len(b),4) if b[i]==c[i]==0];diff=[i for i in outside if b[i:i+4]!=c[i:i+4]]
max_delta=max((abs(c[i+k]-b[i+k]) for i in diff for k in range(4)),default=0)
assert len(diff)==1 and max_delta==1
report={'runtimeChanges':changes,'preservedFoldersByteIdentical':preserved,'livingWorldSHA256':sha(r/'src/living-world.js'),'baselineReliefViewSHA256':sha(base/'src/terrain-candidate/relief-view.js'),'candidateReliefViewSHA256':sha(r/'src/terrain-candidate/relief-view.js'),'rawMaskPixelsWithZeroQuantizedAsphaltBeforeAndAfter':len(outside),'changedPixelsInThatSet':len(diff),'maximumChannelByteDeltaInThatSet':max_delta,'roundingEdgePixels':[{'pixel':[i//4%1024,i//4096],'before':list(b[i:i+4]),'after':list(c[i:i+4])} for i in diff],'baselineGrassPackageStillSHA256':sha(Path('grounded_meadow_candidate/iron-route-grounded-meadow-candidate.zip')),'defaultCampaignSourceUnchanged':True,'simulationSourceUnchanged':True,'note':'One earth G-channel quantization step at a road junction with sub-byte asphalt coverage; all other zero-R pixels byte-identical. Raw base-level audit, not mip-filter/GPU equivalence.'}
assert report['baselineGrassPackageStillSHA256']=='788037ccf1c2989929a4a8bea1ff7b64529cb2fbf9987900d08c676faa70d7a1'
(p/'evidence/preservation-audit.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
