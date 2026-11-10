// Catches modifier gestures entering the shared touch-control begin path.
// Real production input/main/UI/simulation and shipping English conversion.
// Existing DOM/RAF/GPU/audio doubles do not establish native-device behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createInput} from '../src/campaign-input.js';
import {makeDOM,byControl} from './input-dom.mjs';
import {boot,action} from './main-entry-harness.mjs';
import {bootEnglish,englishModules} from './english-test-modules.mjs';
const locales=[{name:'CN',createInput,boot},{name:'EN',createInput:englishModules['./campaign-input.js'].createInput,boot:bootEnglish}];
const controls=['fire','brake','boost','drive','aim'];
const modifiers=['ctrlKey','metaKey','altKey'];
const pointer=(target,type,fields={})=>target.dispatch(type,{pointerId:7,pointerType:'mouse',button:0,clientX:60,clientY:0,...fields});
const selected=s=>({throttle:s.throttle,steer:s.steer,fire:s.firePressed,brake:s.brake,boost:s.boost,aim:s.aim});
const neutral={throttle:0,steer:0,fire:false,brake:false,boost:false,aim:undefined};
function setup(locale,t){const dom=makeDOM(),input=locale.createInput(dom.canvas,{...dom,projectAim:(x,y)=>({x,y:0,z:y})});t.after(()=>input.dispose());return {...dom,input};}
for(const locale of locales){
 for(const kind of controls)for(const modifier of modifiers)
 test(`${locale.name}: ${modifier} on ${kind} cannot activate or capture a mouse or pen`,t=>{
  for(const pointerType of ['mouse','pen']){
   const dom=setup(locale,t),control=byControl(dom.mount,kind);
   const event=pointer(control,'pointerdown',{pointerType,[modifier]:true});
   const sampled=selected(dom.input.sample());
   t.diagnostic(JSON.stringify({kind,modifier,pointerType,sample:sampled}));
   assert.deepEqual(sampled,neutral);
   assert.equal(Boolean(event.defaultPrevented),false);
   assert.equal(control.hasPointerCapture(7),false);
   pointer(control,'pointermove',{pointerType,clientX:120,clientY:60});
   assert.deepEqual(selected(dom.input.sample()),neutral,'rejected pointer cannot awaken on move');
   pointer(control,'pointerup',{pointerType});
  }
 });
 for(const kind of controls)
 test(`${locale.name}: ordinary and Shift ${kind} remain usable after a rejected gesture`,t=>{
  for(const pointerType of ['mouse','pen','touch'])for(const shiftKey of [false,true]){
   const dom=setup(locale,t),control=byControl(dom.mount,kind);
   pointer(control,'pointerdown',{pointerType,ctrlKey:true});pointer(control,'pointerup');dom.input.sample();
   const event=pointer(control,'pointerdown',{pointerType,shiftKey}),s=dom.input.sample();
   assert.equal(Boolean(event.defaultPrevented),true);assert.equal(control.hasPointerCapture(7),true);
   if(kind==='fire')assert.equal(s.firePressed,true);
   if(kind==='brake'||kind==='boost')assert.equal(s[kind],true);
   if(kind==='drive')assert.equal(s.throttle,1);
   if(kind==='aim')assert.deepEqual(s.aim,{worldPoint:{x:512,y:0,z:30.71999999999997}});
   pointer(control,'pointerup',{pointerType,ctrlKey:true});
   assert.equal(control.hasPointerCapture(7),false);
   const released=dom.input.sample();assert.equal(released.throttle,0);assert.equal(released.steer,0);assert.equal(released.firePressed,false);assert.equal(released.brake,false);assert.equal(released.boost,false);
  }
 });
 for(const kind of ['brake','boost'])
 test(`${locale.name}: rejected second pointer does not disturb held ${kind}`,t=>{
  const dom=setup(locale,t),control=byControl(dom.mount,kind);
  pointer(control,'pointerdown',{pointerId:7});assert.equal(dom.input.sample()[kind],true);
  for(const modifier of modifiers){
   pointer(control,'pointerdown',{pointerId:8,[modifier]:true});
   assert.equal(control.hasPointerCapture(8),false);assert.equal(dom.input.sample()[kind],true);
   pointer(control,'pointerup',{pointerId:8});assert.equal(dom.input.sample()[kind],true);
  }
  pointer(control,'pointerup',{pointerId:7,altKey:true});assert.equal(dom.input.sample()[kind],false);
 });
 for(const modifier of modifiers)
 test(`${locale.name}: modified fire button does not shoot in real running main`,async t=>{
  const app=await locale.boot('?sortie=showcase-flank');t.after(()=>app.dispose());action(app,'start').dispatch('click');
  const fire=byControl(app.mount,'fire');const event=pointer(fire,'pointerdown',{[modifier]:true});app.frame();
  t.diagnostic(JSON.stringify({modifier,shotsFired:app.latest.state.tankCombat.shotsFired,firePressed:app.metrics.lastControls.firePressed}));
  assert.equal(app.latest.state.tankCombat.shotsFired,0);assert.equal(app.metrics.lastControls.firePressed,false);assert.equal(Boolean(event.defaultPrevented),false);
  pointer(fire,'pointerup');pointer(fire,'pointerdown');app.frame();assert.equal(app.latest.state.tankCombat.shotsFired,1);
  pointer(fire,'pointerup');app.frame();assert.equal(app.latest.state.tankCombat.shotsFired,1);
 });
}
