import test from 'node:test';import assert from 'node:assert/strict';
import {createEightNpcCrossfire} from '../src/eight-npc-crossfire-front.js';import {createGame} from '../src/campaign-simulation.js';import {computeBattlefieldGuidance} from '../src/battlefield-guidance.js';
function fixture(){const {spec}=createEightNpcCrossfire(),state=createGame(spec);state.phase='playing';state.tankFrame.terrainTravelClearance=true;state.tankFrame.contacts=['terrain'];state.tank.blocked={body:false,barrel:true,muzzle:false};return {state,origin:{x:200,y:300},projectEntity:()=>({x:30,y:80})};}
test('retained terrain floor with a current block offers ordinary escape instead of implying successful recovery',()=>{
 const input=fixture(),before=JSON.stringify(input.state),r=computeBattlefieldGuidance(input).recovery;assert.equal(r.kind,'terrain');assert.match(r.text,/仍受地形限制.*碰撞检查.*松开油门.*刹车.*重新瞄准.*倒车/);assert.match(r.compactText,/仍不动.*倒车/);assert.equal(r.accessibilityLabel,r.text);assert.equal(JSON.stringify(input.state),before);
 input.state.tank.blocked.barrel=false;input.state.tankFrame.contacts=[];const clear=computeBattlefieldGuidance(input).recovery;assert.doesNotMatch(clear.text,/仍受地形限制/);assert.match(clear.text,/行驶.*抬炮/);
});
test('solid and mixed contacts still outrank retained terrain recovery and release removes old ground warning',()=>{
 const input=fixture();input.state.tankFrame.contacts=['terrain','supply'];let r=computeBattlefieldGuidance(input).recovery;assert.notEqual(r.kind,'terrain');assert.doesNotMatch(r.text,/仍受地形限制/);
 delete input.state.tankFrame.terrainTravelClearance;input.state.tankFrame.contacts=[];input.state.tank.blocked.barrel=false;assert.equal(computeBattlefieldGuidance(input).recovery,null);
});
