import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {validateTape} from '../qa/vertical-slice/replay-tape.mjs';
const read=route=>JSON.parse(gunzipSync(readFileSync(new URL(`../qa/vertical-slice/${route}-inputs.json.gz`,import.meta.url))));
test('representative sortie recordings contain only bounded real player controls',()=>{for(const route of ['direct','covered']){const tape=read(route);assert.equal(tape.route,route);assert.ok(validateTape(tape)>1000);}});
test('representative replay rejects a tape that would inject a pose, health or invalid input',()=>{for(const input of [{pose:{x:9,z:-32}},{hp:1000},{steer:2},{throttle:NaN},{convoyOrder:'teleport'},{aim:{worldPoint:{x:0,y:Infinity,z:0}}}]){const tape=read('direct');tape.runs.push({n:1,input});assert.throws(()=>validateTape(tape));}});
