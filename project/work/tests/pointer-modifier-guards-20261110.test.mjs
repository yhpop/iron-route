// Detects a missing modifier guard on the actual canvas pointerdown input path.
// Production input/main/UI/simulation and shipping English transform are real.
// DOM, RAF, GPU and audio use the existing Node harness, not native-device evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createInput} from '../src/campaign-input.js';
import {makeDOM,byControl} from './input-dom.mjs';
import {boot,action} from './main-entry-harness.mjs';
import {bootEnglish,englishModules} from './english-test-modules.mjs';
const locales=[{name:'CN',createInput,boot},{name:'EN',createInput:englishModules['./campaign-input.js'].createInput,boot:bootEnglish}];
const modifiers=['ctrlKey','metaKey','altKey'];
const pointer=(canvas,fields={})=>canvas.dispatch('pointerdown',{pointerId:1,pointerType:'mouse',button:0,clientX:600,clientY:400,...fields});
for(const locale of locales)for(const pointerType of ['mouse','pen'])for(const modifier of modifiers)
test(`${locale.name}: ${modifier} ${pointerType} click does not queue fire, change aim or consume native default`,t=>{
 const dom=makeDOM(),input=locale.createInput(dom.canvas,{...dom,projectAim:(x,y)=>({x,y:0,z:y})});t.after(()=>input.dispose());
 dom.canvas.dispatch('pointermove',{pointerType,clientX:120,clientY:80});
 assert.deepEqual(input.sample().aim,{worldPoint:{x:120,y:0,z:80}});
 const event=pointer(dom.canvas,{pointerType,[modifier]:true});const sampled=input.sample();
 assert.equal(sampled.firePressed,false,'modified pointer must not queue a shot');
 assert.deepEqual(sampled.aim,{worldPoint:{x:120,y:0,z:80}},'rejected click must not reposition aim');
 assert.equal(Boolean(event.defaultPrevented),false,'leave browser/OS gesture default alone');
 assert.equal(input.sample().firePressed,false,'no delayed shot remains queued');
});
for(const locale of locales)for(const modifier of modifiers)
test(`${locale.name}: ${modifier} canvas click cannot fire a real shot in the running main loop`,async t=>{
 const app=await locale.boot('?sortie=showcase-flank');t.after(()=>app.dispose());action(app,'start').dispatch('click');
 const event=pointer(app.canvas,{[modifier]:true});app.frame();
 t.diagnostic(JSON.stringify({locale:locale.name,modifier,shotsFired:app.latest.state.tankCombat.shotsFired,firePressed:app.metrics.lastControls.firePressed,defaultPrevented:Boolean(event.defaultPrevented)}));
 assert.equal(app.latest.state.tankCombat.shotsFired,0);assert.equal(app.metrics.lastControls.firePressed,false);
 assert.equal(Boolean(event.defaultPrevented),false);
 pointer(app.canvas);app.frame();assert.equal(app.latest.state.tankCombat.shotsFired,1,'fresh ordinary click still fires');
});
for(const locale of locales){
 test(`${locale.name}: ordinary and Shift primary clicks keep aim and single-shot behavior`,t=>{
  const dom=makeDOM(),input=locale.createInput(dom.canvas,{...dom,projectAim:(x,y)=>({x,y:0,z:y})});t.after(()=>input.dispose());
  for(const pointerType of ['mouse','pen'])for(const shiftKey of [false,true]){
   const event=pointer(dom.canvas,{pointerType,shiftKey});const result=input.sample();
   assert.equal(result.firePressed,true);assert.deepEqual(result.aim,{worldPoint:{x:600,y:0,z:400}});assert.equal(Boolean(event.defaultPrevented),true);assert.equal(input.sample().firePressed,false);
  }
 });
 test(`${locale.name}: touch canvas never fires and the ordinary touch fire button still works`,t=>{
  const dom=makeDOM(),input=locale.createInput(dom.canvas,dom);t.after(()=>input.dispose());
  pointer(dom.canvas,{pointerType:'touch'});assert.equal(input.sample().firePressed,false);
  const fire=byControl(dom.mount,'fire');pointer(fire,{pointerType:'touch',pointerId:7});assert.equal(input.sample().firePressed,true);assert.equal(input.sample().firePressed,false);
  fire.dispatch('pointerup',{pointerType:'touch',pointerId:7});assert.equal(fire.captured.size,0);
 });
}
