/** Actual main/UI/input with fake DOM/renderer. Not browser or multitouch device QA. */
import test from 'node:test';import assert from 'node:assert/strict';
import {boot,action,makeStorage,CURRENT_PROGRESS_KEY} from './main-entry-harness.mjs';
import {byControl} from './input-dom.mjs';
async function setup(){const storage=makeStorage();storage.values.set(CURRENT_PROGRESS_KEY,JSON.stringify({schema:1,selectedMissionId:'crafted20-005',unlockedIds:Array.from({length:5},(_,i)=>`crafted20-00${i+1}`),bestResults:{}}));const app=await boot('',storage);action(app,'start').dispatch('click');app.frame();return app;}
test('actual main uses one selected identity for HUD and bearing; Q preserves held throttle, retry clears pin',async t=>{
 const app=await setup();t.after(()=>app.dispose());const first=app.latest.status.objectiveGuidance.objective.id;
 app.window.dispatch('keydown',{code:'KeyW'});const before=JSON.stringify(app.latest.state),resets=app.metrics.inputResets,writes=app.storage.writes.length;
 app.window.dispatch('keydown',{code:'KeyQ'});const g=app.latest.status.objectiveGuidance;assert.notEqual(g.objective.id,first);assert.equal(g.manual,true);assert.equal(g.targetObjectiveId,g.objective.id);assert.equal(JSON.stringify(app.latest.state),before);assert.match(app.latest.progress.goalHint,new RegExp(g.objective.title));assert.match(action(app,'cycle-objective').textContent,new RegExp(g.objective.title));assert.equal(app.metrics.inputResets,resets);assert.equal(app.storage.writes.length,writes);
 for(let i=0;i<3;i++)app.frame();assert.equal(app.metrics.lastControls.throttle,1);assert.equal(app.metrics.lastControls.firePressed,false);assert.equal(app.latest.status.objectiveGuidance.objective.id,g.objective.id);
 action(app,'pause').dispatch('click');assert.equal(app.latest.status.objectiveGuidance.manual,true);action(app,'retry').dispatch('click');assert.equal(app.latest.status.objectiveGuidance.manual,false);assert.equal(app.latest.status.objectiveGuidance.objective.id,first);
});
test('actual input retains held drive pointer when native objective click changes tracking; selected title is polite live text',async t=>{
 const app=await setup();t.after(()=>app.dispose());const drive=byControl(app.mount,'drive'),strip=action(app,'cycle-objective');
 drive.dispatch('pointerdown',{pointerId:41,button:0,pointerType:'touch',clientX:60,clientY:0});const first=app.latest.status.objectiveGuidance.objective.id,resets=app.metrics.inputResets;
 strip.dispatch('click');assert.notEqual(app.latest.status.objectiveGuidance.objective.id,first);assert.equal(drive.hasPointerCapture(41),true);assert.equal(app.metrics.inputResets,resets);
 for(let i=0;i<3;i++)app.frame();assert.equal(app.metrics.lastControls.throttle,1);assert.equal(app.metrics.lastControls.firePressed,false);
 assert.equal(strip.getAttribute('aria-live'),'polite');assert.equal(strip.getAttribute('aria-atomic'),'true');
});
