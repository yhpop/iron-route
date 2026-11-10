/** Frozen BF1 physics/gameplay/assets/HUD ownership contract. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const base=JSON.parse(readFileSync(new URL('../../evidence/battlefront/sdd/bf2-base-head.json',import.meta.url))),allowed=new Set(['src/main.js','src/campaign-view.js','src/ruined-depot-view.js','src/crossfire-warfield-view.js','src/terrain-candidate/relief-view.js','locales/en-missions.json','tests/sweep-acceleration-entry.test.mjs']);
test('all BF2 base work outside exact authorized presentation/localization/build-test files remains byte-exact including BF1 gameplay and raw',()=>{
 const changed=[];for(const [file,info]of Object.entries(base.workFiles)){if(allowed.has(file))continue;const hash=createHash('sha256').update(readFileSync(new URL('../'+file,import.meta.url))).digest('hex');if(hash!==info.sha256)changed.push(file);}assert.deepEqual(changed,[]);
});
