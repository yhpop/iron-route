import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
// Independent literal acceptance values come from the pre-existing witness index.
const cases=[
  ['tiger-west',14781,14780,139,84,132,12334,12334],
  ['sandfalcon-west',16157,16156,72,100,160,10617,10617],
  ['sandfalcon-east',15613,15612,34,100,156,9190,9190],
  ['tiger-east',6401,6400,155,86,143,2400,9543],
];
for(const [route,inputs,tick,playerHp,supplyHp,events,prefix,oldCount] of cases) test(route+' fresh-process literal CPU victory, escort and full-event regression', {timeout:600000}, t=>{
  const child=spawnSync(process.execPath,['run-route.mjs',route],{cwd:root,encoding:'utf8',timeout:590000,maxBuffer:1024*1024});
  assert.equal(child.error,undefined,'replay process completes');
  assert.equal(child.status,0,child.stderr||child.stdout);
  const r=JSON.parse(child.stdout);
  assert.deepEqual([r.inputs,r.tick,r.playerHp,r.supplyHp,r.events,r.retainedHistoricalInputs,r.originalHistoricalInputs],[inputs,tick,playerHp,supplyHp,events,prefix,oldCount]);
  assert.equal(r.phase,'won'); assert.equal(r.supplyArrived,true);
  assert.equal(r.stats.muzzleChecks,inputs); assert.ok(r.stats.damageChecks>0); assert.ok(r.stats.projectileChecks>0);
  assert.equal(r.sourceFiles,409); assert.ok(r.dependencyFiles>0);
  assert.equal(r.completeOldTapeConsumed,route!=='tiger-east');
  assert.equal(r.entireStateAndEventsStrictEqual,true);
  if(route.endsWith('east')) assert.equal(r.losslessRawEvidence,true);
  if(route!=='tiger-west') assert.equal(r.stats.lateNorthernDamage,0,'does not cover historical late-hit scenario');
  t.diagnostic(JSON.stringify(r));
});
