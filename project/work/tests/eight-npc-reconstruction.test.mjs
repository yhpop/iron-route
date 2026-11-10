import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoadingExtraction} from '../src/loading-extraction-front.js';
const candidate=await import('../src/eight-npc-crossfire-front.js').catch(()=>null);
test('new optional reconstruction has eight armed NPCs, four per team, preserving old physical mission',()=>{
 assert.equal(typeof candidate?.createEightNpcCrossfire,'function','new independent eight-NPC builder required');
 const original=createLoadingExtraction(),before=structuredClone(original),next=candidate.createEightNpcCrossfire();
 assert.equal(next.spec.eightNpcReconstruction,true);assert.notEqual(next.spec.id,original.spec.id);
 assert.equal(next.spec.slug,'eight-npc-reconstruction');assert.equal(next.spec.optional,true);
 const armed=next.spec.entities.filter(e=>['turret','drone'].includes(e.kind));
 assert.equal(armed.length,8);for(const team of ['allied','hostile'])assert.equal(armed.filter(e=>e.team===team).length,4);
 for(const key of ['spawn','geometry','routes','zones','objectives','convoyChoice','combatRelations'])assert.deepEqual(next.spec[key],original.spec[key],key);
 assert.deepEqual(next.field,original.field);assert.deepEqual(createLoadingExtraction(),before);
 assert.deepEqual(next.spec.entities.find(e=>e.id==='supply'),original.spec.entities.find(e=>e.id==='supply'));
 assert.deepEqual(JSON.parse(JSON.stringify(next.spec)),next.spec);
});
import fs from 'node:fs';
test('optional entry is constructed, resolved and presented without changing default selection',()=>{
 const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/import \{createEightNpcCrossfire\} from '\.\/eight-npc-crossfire-front\.js'/);
 assert.match(main,/eightNpc=createEightNpcCrossfire\(\)/);
 assert.match(main,/spec.id===eightNpc.spec.id\?eightNpc:/);
 assert.match(main,/slug==='eight-npc-reconstruction'\?eightNpc.spec:/);
 assert.match(main,/slug:'eight-npc-reconstruction',spec:eightNpc.spec/);
});
import {translateEnglishSource} from '../scripts/english-localization.mjs';
test('new mission has complete explicit English source inventory',()=>{
 const file='src/eight-npc-crossfire-front.js',source=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 assert.doesNotMatch(translateEnglishSource(file,source),/\p{Script=Han}/u);
});
