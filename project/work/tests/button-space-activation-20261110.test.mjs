// Break caught: the global Space brake handler cancels native button activation.
// Real production input, UI, simulation, and shipping English transform.
// Existing fake DOM/RAF/GPU/audio boundaries do not emulate native key activation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createInput} from '../src/campaign-input.js';
import {makeDOM,byControl} from './input-dom.mjs';
import {boot,action} from './main-entry-harness.mjs';
import {bootEnglish,englishModules} from './english-test-modules.mjs';
const locales=[{name:'CN',createInput,boot},{name:'EN',createInput:englishModules['./campaign-input.js'].createInput,boot:bootEnglish}];
for(const locale of locales){
 for(const nested of [false,true])test(`${locale.name}: Space on ${nested?'a button child':'a button'} leaves native activation and does not brake`,t=>{
  const dom=makeDOM(),input=locale.createInput(dom.canvas,dom);t.after(()=>input.dispose());
  const button=byControl(dom.mount,'travel');let target=button;
  if(nested){target=dom.document.createElement('span');button.append(target);}
  const event=dom.window.dispatch('keydown',{code:'Space',target});const sample=input.sample();
  t.diagnostic(JSON.stringify({locale:locale.name,nested,defaultPrevented:Boolean(event.defaultPrevented),brake:sample.brake}));
  assert.equal(Boolean(event.defaultPrevented),false,'button activation default must not be cancelled');
  assert.equal(sample.brake,false,'button activation is not a brake input');
  assert.equal(input.sample().brake,false,'button Space must not leave a held brake');
 });
 test(`${locale.name}: Space over the game canvas still brakes until keyup`,t=>{
  const dom=makeDOM(),input=locale.createInput(dom.canvas,dom);t.after(()=>input.dispose());
  const event=dom.window.dispatch('keydown',{code:'Space',target:dom.canvas});
  assert.equal(Boolean(event.defaultPrevented),true);assert.equal(input.sample().brake,true);
  dom.window.dispatch('keyup',{code:'Space',target:byControl(dom.mount,'travel')});assert.equal(input.sample().brake,false);
 });
 test(`${locale.name}: button focus still permits W and F gameplay shortcuts`,t=>{
  const dom=makeDOM(),input=locale.createInput(dom.canvas,dom);t.after(()=>input.dispose());
  const target=byControl(dom.mount,'travel');target.dispatch('click');
  dom.window.dispatch('keydown',{code:'KeyW',target});dom.window.dispatch('keydown',{code:'KeyF',target});
  const sample=input.sample();assert.equal(sample.governor,'travel');assert.equal(sample.throttle,1);assert.equal(sample.firePressed,true);
  dom.window.dispatch('keyup',{code:'KeyW',target});assert.equal(input.sample().throttle,0);assert.equal(input.sample().firePressed,false);
 });
 test(`${locale.name}: action button Space invokes its named action instead of a universal brake`,t=>{
  const dom=makeDOM(),input=locale.createInput(dom.canvas,dom);t.after(()=>input.dispose());
  for(const kind of ['brake','fire','boost']){
   const button=byControl(dom.mount,kind),child=dom.document.createElement('span');button.append(child);
   for(const target of [button,child]){
    const event=dom.window.dispatch('keydown',{code:'Space',target});
    assert.equal(Boolean(event.defaultPrevented),true,`${kind}: consume the named action key`);
    const sample=input.sample();assert.equal(sample.brake,kind==='brake');assert.equal(sample.boost,kind==='boost');assert.equal(sample.firePressed,kind==='fire');
    dom.window.dispatch('keyup',{code:'Space',target});const released=input.sample();assert.equal(released.brake,false);assert.equal(released.boost,false);assert.equal(released.firePressed,false);
   }
  }
 });
 test(`${locale.name}: focused real pause button Space reaches the main loop without braking`,async t=>{
  const app=await locale.boot('?sortie=showcase-flank');t.after(()=>app.dispose());action(app,'start').dispatch('click');
  const pause=action(app,'pause');pause.focus();
  const event=app.window.dispatch('keydown',{code:'Space',target:pause});app.frame();
  assert.equal(Boolean(event.defaultPrevented),false);assert.equal(app.metrics.lastControls.brake,false);assert.equal(app.latest.state.phase,'playing');
  app.window.dispatch('keyup',{code:'Space',target:pause});
  // Browser activation is checked separately; this only checks the real click consumer.
  pause.dispatch('click');assert.equal(app.latest.state.phase,'paused');
 });
}
