import test from 'node:test';
import assert from 'node:assert/strict';
import {createEightNpcCrossfire} from '../src/eight-npc-crossfire-front.js';
import {createGame} from '../src/campaign-simulation.js';
import {computeBattlefieldGuidance} from '../src/battlefield-guidance.js';
import {makeDOM} from './input-dom.mjs';
import {createUI} from '../src/campaign-ui.js';

function fixture(){const {spec}=createEightNpcCrossfire(),state=createGame(spec);state.phase='playing';return {state,origin:{x:200,y:300},projectEntity:()=>({x:30,y:80})};}
test('actual terrain travel recovery remains explained after the immediate block clears, without mutating simulation',()=>{
 const input=fixture();input.state.tankFrame.terrainTravelClearance=true;input.state.tankFrame.contacts=[];input.state.tank.blocked={body:false,barrel:false,muzzle:false};
 const before=JSON.stringify(input.state),r=computeBattlefieldGuidance(input).recovery;
 assert.ok(r,'active accepted controller recovery must not vanish with the transient blocked flag');assert.equal(r.kind,'terrain');assert.match(r.text,/触地.*抬炮.*松开油门.*刹车.*瞄准/);assert.match(r.compactText,/松油门.*刹车/);assert.equal(r.accessibilityLabel,r.text);assert.equal(JSON.stringify(input.state),before);
 delete input.state.tankFrame.terrainTravelClearance;assert.equal(computeBattlefieldGuidance(input).recovery,null);
});
test('confirmed terrain-only barrel contact gives physical raise-aim advice, never guesses from proximity or boundary',()=>{
 const input=fixture();input.state.tank.blocked.barrel=true;input.state.tankFrame.contacts=['terrain'];let r=computeBattlefieldGuidance(input).recovery;assert.equal(r.kind,'terrain');assert.match(r.text,/炮管触地.*瞄准点.*移远.*抬高/);assert.doesNotMatch(r.text,/保证|无视|穿过/);
 for(const contacts of [[],['terrain-boundary'],['unknown'],['terrain','supply']]){input.state.tankFrame.contacts=contacts;r=computeBattlefieldGuidance(input).recovery;assert.notEqual(r.kind,'terrain',JSON.stringify(contacts));}
});
test('terrain recovery cannot hide a simultaneous solid contact or leak into paused/loading/hidden states',()=>{
 const input=fixture();input.state.tankFrame.terrainTravelClearance=true;input.state.tank.blocked.barrel=true;input.state.tankFrame.contacts=['terrain','supply'];assert.notEqual(computeBattlefieldGuidance(input).recovery.kind,'terrain');
 input.state.tankFrame.contacts=[];input.state.tank.blocked.body=true;assert.notEqual(computeBattlefieldGuidance(input).recovery.kind,'terrain');
 for(const patch of [{viewStatus:'loading'},{viewStatus:'failed'},{visible:false}])assert.equal(computeBattlefieldGuidance({...input,...patch}).recovery,null);
 for(const phase of ['briefing','paused','won','lost']){input.state.phase=phase;assert.equal(computeBattlefieldGuidance(input).recovery,null);}
});
test('real HUD consumer displays active terrain recovery and clears it on release without requiring a blocked flag',()=>{
 const dom=makeDOM(),input=fixture(),spec=input.state.mission,ui=createUI({...dom,missions:[spec]});
 try {
  input.state.tankFrame.terrainTravelClearance=true;
  const render=()=>ui.render(input.state,spec,{}, {battlefieldGuidance:computeBattlefieldGuidance(input)});
  render();const line=dom.mount.querySelector('.campaign-convoy-status');assert.equal(line.hidden,false);assert.equal(line.getAttribute('data-recovery-active'),'true');assert.match(line.textContent,/松油门\/刹车/);assert.match(line.getAttribute('aria-label'),/其他障碍仍会挡车/);
  delete input.state.tankFrame.terrainTravelClearance;render();assert.equal(line.getAttribute('data-recovery-active'),'false');assert.doesNotMatch(line.textContent,/触地恢复/);
 } finally {ui.dispose();}
});
