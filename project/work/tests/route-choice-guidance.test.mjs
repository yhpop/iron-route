import test from 'node:test';import assert from 'node:assert/strict';
import {routeChoiceName,routeChoiceLabels} from '../src/route-choice-guidance.js';
import {createRidgeConvoyMission} from '../src/terrain-candidate/ridge-convoy.js';import {createGame} from '../src/campaign-simulation.js';
import {createUI} from '../src/campaign-ui.js';import {makeDOM} from './input-dom.mjs';
function fixture(){const {spec}=createRidgeConvoyMission(),state=createGame(spec);state.phase='playing';state.objectiveStates['receive-orders'].status='complete';return {spec,state};}
const rect={left:10,top:20,width:1000,height:700};
test('route guidance uses authored names for both zone and locked route, without generic forward/left promises',()=>{const {spec}=fixture();assert.equal(routeChoiceName(spec,{zoneId:'choose-east'}),'东侧硬路');assert.equal(routeChoiceName(spec,{choiceId:'covered'}),'西侧低地土路');assert.equal(routeChoiceName(spec,{choiceId:'unknown'}),null);assert.equal(routeChoiceName({},{}),null);});
test('physical gold-circle labels are projected with same names and disappear when selection is committed',()=>{const {spec,state}=fixture();const p=pose=>({x:500+pose.x*10,y:300,inFront:true});const labels=routeChoiceLabels(state,spec,p,rect);assert.deepEqual(labels.map(l=>l.title),['东侧硬路','西侧低地土路']);assert.deepEqual(labels.map(l=>l.x),[580,420]);state.selectedConvoyChoiceId='direct';assert.deepEqual(routeChoiceLabels(state,spec,p,rect),[]);});
test('labels never mirror behind-camera or offscreen choices, or show on inactive frames',()=>{const {spec,state}=fixture();for(const projection of [null,{x:500,y:300,inFront:false},{x:0,y:300,inFront:true},{x:500,y:10,inFront:true}])assert.deepEqual(routeChoiceLabels(state,spec,()=>projection,rect),[]);for(const phase of ['briefing','paused','lost','won'])assert.deepEqual(routeChoiceLabels({...state,phase},spec,()=>({x:500,y:300,inFront:true}),rect),[]);});
test('actual HUD adds noninteractive world labels and hides stale labels after route commit',()=>{const {spec,state}=fixture(),dom=makeDOM(),ui=createUI({...dom,missions:[spec]});dom.mount.querySelector('.campaign-hud').rect={left:900,top:0,width:100,height:80};dom.mount.querySelector('.campaign-nav').rect={left:900,top:0,width:100,height:80};ui.render(state,spec,{}, {routeLabels:[{id:'choose-east',title:'东侧硬路',x:580,y:300}]});const label=dom.mount.querySelector('[data-route-zone="choose-east"]');assert.ok(label);assert.equal(label.textContent,'东侧硬路');assert.equal(label.style.left,'580px');assert.equal(label.hidden,false);ui.render({...state,selectedConvoyChoiceId:'direct'},spec,{}, {routeLabels:[]});assert.equal(label.hidden,true);ui.dispose();assert.equal(dom.mount.querySelector('.campaign-ui'),null);});
test('measured HUD overlap suppresses world label and restores it when clear, including resized HUD',()=>{
 const {spec,state}=fixture(),dom=makeDOM(),ui=createUI({...dom,missions:[spec]});
 const status={routeLabels:[{id:'choose-west',title:'西侧低地土路',x:420,y:300}]};
 ui.render(state,spec,{},status);
 const hud=dom.mount.querySelector('.campaign-hud'),label=dom.mount.querySelector('[data-route-zone="choose-west"]');
 hud.rect={left:20,top:20,width:425,height:240};
 label.rect={left:390,top:231,width:120,height:29};
 ui.render(state,spec,{},status);assert.equal(label.hidden,true);
 label.rect={left:500,top:300,width:120,height:29};
 ui.render(state,spec,{},status);assert.equal(label.hidden,false);
 hud.rect={left:20,top:20,width:600,height:340};
 ui.render(state,spec,{},status);assert.equal(label.hidden,true);
 ui.dispose();
});
