// Record consistency only. Never runs simulation or replays controls.
import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const OUT=new URL('./',import.meta.url),read=name=>fs.readFileSync(new URL(name,OUT)),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const old=read('win-direct-01-result.json.gz'),fresh=read('win-direct-01-fresh-result.json.gz'),a=JSON.parse(gunzipSync(old)),b=JSON.parse(gunzipSync(fresh));
// Regression reproduces signed-zero mismatch at the storage boundary, not physics.
assert.throws(()=>assert.deepEqual({basis:[-0]},JSON.parse(JSON.stringify({basis:[-0]}))));
assert.deepEqual(JSON.parse(JSON.stringify({basis:[-0]})),JSON.parse(JSON.stringify({basis:[-0]})));
assert.deepEqual(fresh,old,'ENTIRE compressed outputs byte-equal');assert.deepEqual(gunzipSync(fresh),gunzipSync(old),'ENTIRE serialized JSON byte-equal');assert.deepEqual(b,a,'ENTIRE parsed outputs deepStrictEqual');assert.equal(b.finalState.phase,'won');assert.equal(b.inputs,9190);assert.equal(b.tickStateHashes.length,9190);
const result={boundary:'Saved artifact comparison only; the single fresh literal simulation was 07-replay, whose in-memory-vs-JSON comparator failed on -0. No additional simulation.',originalSHA256:sha(old),freshSHA256:sha(fresh),compressedByteEqual:true,entireSerializedByteEqual:true,entireParsedDeepStrictEqual:true,inputs:b.inputs,tickStateHashes:b.tickStateHashes.length,finalHash:b.finalHash,originalJobExit:1,originalJobError:'deepStrictEqual raw in-memory signed -0 vs JSON-loaded +0; all serialized artifacts byte-identical',regression:'assert.throws signed-zero object vs its JSON roundtrip; normalized whole-object comparison passes',sourceHashesHash:sha(JSON.stringify(b.sourceHashes))};
fs.writeFileSync(new URL('saved-replay-comparison.json',OUT),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
