import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCombatFx} from '../src/combat-fx.js';
const state={entities:{},projectiles:[]};
const hit={id:'ground',type:'impact',targetId:'terrain',position:{x:0,y:3,z:0},normal:{x:0,y:1,z:0}};
test('ground impact has a broader persistent dust batch without enlarging muzzle smoke',()=>{
 const scene=new THREE.Scene(),fx=createCombatFx(scene,{geometry:[]},{mobile:false});fx.update(state,[hit],0);
 const dust=scene.getObjectByName('ground-impact-dust');assert.ok(dust);
 assert.ok(dust.material.size>=1.4);assert.equal(scene.getObjectByName('impact-and-muzzle-smoke').material.size,.75);
 assert.ok(dust.geometry.drawRange.count>0);
 for(let i=0;i<4;i++)fx.update(state,[],.25);
 assert.ok(dust.geometry.drawRange.count>0);assert.ok(dust.geometry.attributes.color.getW(0)>.1);
 for(let i=0;i<12;i++)fx.update(state,[],.25);assert.equal(dust.geometry.drawRange.count,0);fx.dispose();
});
test('dust uses shared bounded budget and reduced motion expires promptly',()=>{
 for(const reducedMotion of [false,true]){
 const scene=new THREE.Scene(),fx=createCombatFx(scene,{geometry:[]},{mobile:true,reducedMotion});
 fx.update(state,Array.from({length:100},(_,i)=>({...hit,id:i})),0);
 const dust=scene.getObjectByName('ground-impact-dust');assert.ok(dust);assert.ok(dust.geometry.drawRange.count<=fx.getStats().budget.smoke);
 if(reducedMotion){fx.update(state,[],.25);assert.equal(dust.geometry.drawRange.count,0);}fx.dispose();assert.equal(scene.children.length,0);
 }
});
