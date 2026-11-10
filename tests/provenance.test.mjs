import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {suiteRoot,checkedBytes,verifyFileHashes} from '../lib/evidence.mjs';
test('historical baseline and its external reference files remain separately pinned',()=>{
  const m=JSON.parse(fs.readFileSync(path.join(suiteRoot,'fixtures/manifest.json')));
  const baseline=JSON.parse(checkedBytes(suiteRoot,m.historicalBaseline));
  assert.deepEqual(baseline.counts,{tests:1471,pass:1421,fail:29,skipped:21,cancelled:0,todo:0});
  assert.equal(baseline.failureNames.length,29);
  const hashes=JSON.parse(checkedBytes(suiteRoot,m.historicalDependencyManifest));
  assert.equal(verifyFileHashes(path.join(suiteRoot,'objective_choice_candidate'),hashes),7);
});
