import test from 'node:test';
import assert from 'node:assert/strict';
import {createTank,stepTank} from '../src/tank-controller.js';
import {createWorld} from '../src/campaign-world.js';
import {createUI} from '../src/campaign-ui.js';
import {makeDOM} from './input-dom.mjs';
const aim={worldPoint:{x:8,y:1,z:0}};
function parked(x){const world=createWorld({geometry:[{id:'wall',kind:'box',x,z:0,width:1,depth:12,height:3}]});let state=createTank(),step;for(let i=0;i<240;i++){step=stepTank(state,{aim},1/60,world);state=step.state;}return{world,state,step};}
function hud(tank,frame,reload=0){const dom=makeDOM(),ui=createUI({...dom,missions:[]});ui.render({phase:'playing',tank,tankFrame:frame,tankCombat:{hp:100,reload},objectiveStates:{}},{id:'test',title:'test',objectives:[]},{});return{ui,node:dom.mount.querySelector('[data-stat="reload"]')};}
test('real wall limits turret slew but clear accepted muzzle can fire; HUD must not claim muzzle obstruction',()=>{
 const {world,state,step}=parked(2);assert.equal(state.blocked.barrel,true);assert.equal(state.blocked.muzzle,false);assert.equal(step.frame.canFire,true);
 const fired=stepTank(state,{aim,firePressed:true},1/60,world);assert.equal(fired.events[0].type,'fire');
 const {ui,node}=hud(state,step.frame);assert.match(node.textContent,/可开火/);assert.match(node.textContent,/转向受限/);assert.doesNotMatch(node.textContent,/炮口受阻/);assert.equal(node.getAttribute('data-ready'),'true');ui.dispose();
});
test('genuine muzzle obstruction still prevents fire and is presented as obstruction',()=>{
 const {world,state,step}=parked(3),fired=stepTank(state,{aim,firePressed:true},1/60,world);assert.equal(state.blocked.muzzle,true);assert.equal(fired.events[0].type,'fire-blocked');assert.equal(fired.state.turret.recoil,0);
 const {ui,node}=hud(state,step.frame);assert.match(node.textContent,/炮口受阻/);assert.equal(node.getAttribute('data-ready'),'false');ui.dispose();
});
test('reload is visible while turret slew is limited instead of being hidden by false muzzle warning',()=>{
 const {state,step}=parked(2),{ui,node}=hud(state,step.frame,.7);assert.match(node.textContent,/装填 0.7s/);assert.match(node.textContent,/转向受限/);assert.equal(node.getAttribute('data-ready'),'false');ui.dispose();
});
