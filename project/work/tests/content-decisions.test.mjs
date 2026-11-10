import test from 'node:test';
import assert from 'node:assert/strict';
import {authoredMissions} from '../src/content/authored.js';
import {compiledCatalog} from '../src/content/catalog.js';
import {lineBlocker} from '../src/content/geometry.js';
import {canonicalObjectives} from '../src/content/signatures.js';

test('foundry slow flank has actual shot-blocking cover but preserves its firing angle',()=>{
 const m=authoredMissions()[1],turret=m.entities.find(e=>e.kind==='turret');
 assert.equal(lineBlocker({x:-14,z:0},turret.pose,m.geometry),'west-flank-screen');
 assert.equal(lineBlocker({x:-10,z:-10},turret.pose,m.geometry),null);
});

test('expanded protection scenarios never replace vehicle movement with idle timer holds',()=>{
 for(const m of compiledCatalog()){
  assert.equal(m.objectives.some(o=>o.type==='defend'),false,m.id);
  if(['two-stop-transfer','two-lane-defense','rearguard-withdrawal'].includes(m.objectiveGraphId)){
   assert.ok(m.entities.filter(e=>e.kind==='truck').length>=2,m.id);
   assert.ok(m.entities.filter(e=>e.kind==='turret').length>=2,m.id);
  }
 }
});

test('choose-order missions include a real protected convoy and active fire exposure',()=>{
 for(const m of compiledCatalog().filter(m=>['choose-target-order','choose-breach-order'].includes(m.objectiveGraphId))){
  assert.ok(m.entities.some(e=>e.kind==='truck'),m.id);assert.ok(m.entities.some(e=>e.kind==='turret'),m.id);
  assert.ok(m.objectives.some(o=>o.type==='escort'),m.id);
 }
});

test('objective signatures ignore IDs and declaration order but retain causal differences',()=>{
 const a=[{id:'a',type:'breach',targetIds:['wall'],requires:[],nextIds:['b']},{id:'b',type:'reach',targetIds:[],requires:['a'],nextIds:[],zoneId:'exit'}];
 const b=[{...a[1],id:'y',requires:['x']},{...a[0],id:'x',nextIds:['y']}];
 const c=structuredClone(b);c[0].requires=[];
 const walls=[{id:'wall',destructible:true}];
 assert.equal(canonicalObjectives(a,[],walls),canonicalObjectives(b,[],walls));
 assert.notEqual(canonicalObjectives(a,[],walls),canonicalObjectives(c,[],walls));
});
