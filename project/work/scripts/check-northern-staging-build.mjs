import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const work=path.resolve(process.argv[2]??'.');
assert.equal(createHash('sha256').update(fs.readFileSync(path.join(work,'src/eight-npc-crossfire-front.js'))).digest('hex'),'5b96d98c378222e28cfaee642e3c6b7a651ba326f5023e85751b2e56cecf796c');
for(const folder of ['dist','dist-en']){
 const js=fs.readFileSync(path.join(work,folder,'game.js'),'utf8');
 assert.match(js,/\("allied-north","allied",10,30,2,16\)/,folder+' staged north guard must be in actual bundle');
 assert.match(js,/\("allied-far-east","allied",30,8,23,16\)/,folder+' staged east guard must be in actual bundle');
 assert.doesNotMatch(js,/\("allied-north","allied",-8,-18,0,-18\)/,folder+' stale parent north guard');
 assert.doesNotMatch(js,/\("allied-far-east","allied",30,-8,30,-20\)/,folder+' stale parent east guard');
}
await import('./check-featured-return-build.mjs');
console.log('Exact two-ally staging source and inherited actual-main CN/EN bundle closure verified.');
