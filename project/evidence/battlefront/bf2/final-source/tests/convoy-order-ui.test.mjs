import test from 'node:test';import assert from 'node:assert/strict';
import {createUI} from '../src/campaign-ui.js';import {makeDOM} from './input-dom.mjs';
import {createGame} from '../src/campaign-simulation.js';
test('touch button and H send explicit command; repeated H and text editing do not issue orders',()=>{
 const spec={schema:1,id:'ui-orders',convoyCommands:true,spawn:{x:0,z:0},objectives:[],entities:[{id:'supply',kind:'truck',hp:100,pose:{x:0,z:10}}]};
 const state=createGame(spec);state.phase='playing';const calls=[],dom=makeDOM(),ui=createUI({...dom,missions:[spec],orderConvoy:order=>calls.push(order)});
 ui.render(state,spec,{});const button=dom.mount.querySelector('[data-action="convoy-order"]');assert.ok(button);assert.equal(button.hidden,false);
 button.dispatch('click');assert.deepEqual(calls,['hold']);
 dom.window.dispatch('keydown',{code:'KeyH',repeat:true});assert.equal(calls.length,1);
 dom.window.dispatch('keydown',{code:'KeyH',target:dom.document.createElement('input')});assert.equal(calls.length,1);
 dom.window.dispatch('keydown',{code:'KeyH'});assert.deepEqual(calls,['hold','hold']);
 state.convoyOrder='hold';ui.render(state,spec,{});assert.match(button.textContent,/继续/);button.dispatch('click');assert.equal(calls.at(-1),'advance');
 state.phase='paused';ui.render(state,spec,{});assert.equal(button.disabled,true);dom.window.dispatch('keydown',{code:'KeyH'});assert.equal(calls.length,3);ui.dispose();
});
test('legacy and pre-choice missions do not allow orders',()=>{
 const dom=makeDOM(),spec={schema:1,id:'legacy',spawn:{x:0,z:0},objectives:[],entities:[]},state=createGame(spec),ui=createUI({...dom,missions:[spec],orderConvoy:()=>assert.fail('must not issue')});state.phase='playing';
 ui.render(state,spec,{});const button=dom.mount.querySelector('[data-action="convoy-order"]');assert.ok(button);assert.equal(button.hidden,true);
 spec.convoyCommands=true;spec.convoyChoice={};ui.render(state,spec,{});assert.equal(button.disabled,true);ui.dispose();
});
