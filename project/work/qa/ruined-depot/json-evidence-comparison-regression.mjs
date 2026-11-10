import assert from 'node:assert/strict';import {assertFullEvidenceExact} from './full-evidence-json.mjs';
const generated={spec:{id:'mission-9070'},sourceSnapshot:{all:'retained'},sourceHashes:{all:'abc'},runs:[{n:1,input:{start:true}}],events:[{normal:{x:-0,y:1,z:-0}}],finalState:{tank:{yaw:-0},phase:'won'},finalHash:'unchanged'};
const stored=JSON.parse(JSON.stringify(generated));
assertFullEvidenceExact(generated,stored);
for(const mutate of [x=>{x.events[0].normal.y=2},x=>{delete x.sourceSnapshot},x=>{x.extra='not allowed'},x=>{x.runs[0].input.start=false},x=>{x.finalState.phase='lost'}]){let changed=structuredClone(generated);mutate(changed);assert.throws(()=>assertFullEvidenceExact(changed,stored));}
console.log('PASS: complete JSON roundtrip identity; changed/removed/added evidence fields all rejected');
