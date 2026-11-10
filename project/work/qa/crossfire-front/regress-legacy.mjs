/** Preserve original expected files. Legacy metadata mismatch must match frozen V1 exactly. */
import{readFileSync,writeFileSync}from'node:fs';import{spawnSync}from'node:child_process';import assert from'node:assert/strict';
const manifest=JSON.parse(readFileSync('qa/accepted40/manifest.json')),rows=[];
console.log('START legacy20 '+new Date().toISOString());
for(const m of manifest.missions){const tape='qa/accepted40/'+m.main.tape;const run=source=>{const p=spawnSync(process.execPath,['qa/accepted40/replay-snapshot.mjs',source,tape],{encoding:'utf8',timeout:240000});assert.ifError(p.error);const r=JSON.parse(p.stdout.trim().split('\n').at(-1));return r;};const r=run('src');assert.equal(r.phase,'won');assert.equal(r.specMatches,true);if(!r.stateMatches){const old=run('../../scorched_front_candidate/work/src');assert.equal(r.hash,old.hash);r.historicalMismatchAlsoInFrozenV1=true;r.frozenV1Hash=old.hash;}rows.push(r);console.log(JSON.stringify(r));writeFileSync('qa/crossfire-front/legacy20-regression.json',JSON.stringify({complete:rows.length===20,rows},null,2));}
console.log('END legacy20 '+new Date().toISOString());
