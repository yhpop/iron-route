// Catches action buttons falling through to the canvas Space brake mapping,
// missing Enter, stale holds, and cross-source release. Real input and main /
// UI / simulation plus shipping English transform; existing fake DOM/RAF/GPU/audio.
// No native-browser synthetic-click or assistive-technology claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createInput} from '../src/campaign-input.js';
import {makeDOM,byControl} from './input-dom.mjs';
import {boot,action} from './main-entry-harness.mjs';
import {bootEnglish,englishModules} from './english-test-modules.mjs';
const locales=[{name:'CN',createInput,boot},{name:'EN',createInput:englishModules['./campaign-input.js'].createInput,boot:bootEnglish}];
const down=(dom,target,code='Space',fields={})=>dom.window.dispatch('keydown',{target,code,repeat:false,...fields});
const up=(dom,target,code='Space',fields={})=>dom.window.dispatch('keyup',{target,code,...fields});
const pointer=(target,type,pointerId)=>target.dispatch(type,{pointerId,pointerType:'touch',button:0,clientX:60,clientY:60});
const actions=sample=>({fire:sample.firePressed,brake:sample.brake,boost:sample.boost});
const neutral={fire:false,brake:false,boost:false};
const want={fire:{fire:true,brake:false,boost:false},brake:{fire:false,brake:true,boost:false},boost:{fire:false,brake:false,boost:true}};
function setup(locale,t){const dom=makeDOM(),input=locale.createInput(dom.canvas,dom);t.after(()=>input.dispose());return {...dom,input};}

for(const locale of locales){
 for(const kind of ['fire','brake','boost'])for(const code of ['Space','Enter'])
 test(`${locale.name}: ${code} on ${kind} invokes only that action, then releases on a changed keyup target`,t=>{
  const dom=setup(locale,t),button=byControl(dom.mount,kind),child=dom.document.createElement('span');button.append(child);button.focus();
  const event=down(dom,child,code),sample=dom.input.sample();
  t.diagnostic(JSON.stringify({kind,code,defaultPrevented:Boolean(event.defaultPrevented),...actions(sample)}));
  assert.deepEqual(actions(sample),want[kind]);assert.equal(Boolean(event.defaultPrevented),true);
  assert.equal(button.getAttribute('data-active'),'true');
  assert.deepEqual(actions(dom.input.sample()),kind==='fire'?neutral:want[kind]);
  down(dom,button,code,{repeat:true});assert.deepEqual(actions(dom.input.sample()),kind==='fire'?neutral:want[kind]);
  const release=up(dom,dom.document.createElement('input'),code,{ctrlKey:true});
  assert.equal(Boolean(release.defaultPrevented),true,'owned activation keyup suppresses native activation');
  assert.deepEqual(actions(dom.input.sample()),neutral);assert.equal(button.getAttribute('data-active'),'false');
  // Deliberate click event checks absence of a second action consumer, not UA synthesis.
  button.dispatch('click',{detail:0});assert.deepEqual(actions(dom.input.sample()),neutral);
 });
 test(`${locale.name}: an already held pointerId cannot switch action ownership`,t=>{
  const dom=setup(locale,t),brake=byControl(dom.mount,'brake'),boost=byControl(dom.mount,'boost');
  pointer(brake,'pointerdown',7);pointer(boost,'pointerdown',7);
  assert.deepEqual(actions(dom.input.sample()),want.brake);assert.equal(boost.captured.size,0);
  dom.window.dispatch('pointerup',{pointerId:7});assert.deepEqual(actions(dom.input.sample()),neutral);assert.equal(brake.getAttribute('data-active'),'false');
 });
 test(`${locale.name}: duplicate fire pointerdown with one pointerId cannot queue another edge`,t=>{
  const dom=setup(locale,t),fire=byControl(dom.mount,'fire');pointer(fire,'pointerdown',7);assert.equal(dom.input.sample().firePressed,true);
  pointer(fire,'pointerdown',7);assert.equal(dom.input.sample().firePressed,false);
  pointer(fire,'pointerup',7);pointer(fire,'pointerdown',7);assert.equal(dom.input.sample().firePressed,true);
 });
 test(`${locale.name}: drive stick still keeps one pointer owner while actions accept several`,t=>{
  const dom=setup(locale,t),drive=byControl(dom.mount,'drive');
  drive.dispatch('pointerdown',{pointerId:7,pointerType:'touch',button:0,clientX:60,clientY:0});
  drive.dispatch('pointerdown',{pointerId:8,pointerType:'touch',button:0,clientX:60,clientY:120});
  assert.equal(dom.input.sample().throttle,1);assert.equal(drive.hasPointerCapture(8),false);
  pointer(drive,'pointerup',8);assert.equal(dom.input.sample().throttle,1);
  pointer(drive,'pointerup',7);assert.equal(dom.input.sample().throttle,0);
 });
 test(`${locale.name}: fire edges are per physical key; duplicate and repeated downs do not queue another shot`,t=>{
  const dom=setup(locale,t),button=byControl(dom.mount,'fire');
  down(dom,button);assert.equal(dom.input.sample().firePressed,true);
  down(dom,button);assert.equal(dom.input.sample().firePressed,false);
  down(dom,button,'Space',{repeat:true});assert.equal(dom.input.sample().firePressed,false);
  down(dom,button,'Enter');assert.equal(dom.input.sample().firePressed,true);
  up(dom,dom.canvas);assert.equal(button.getAttribute('data-active'),'true');
  up(dom,dom.canvas,'Enter');assert.equal(button.getAttribute('data-active'),'false');
  down(dom,button);assert.equal(dom.input.sample().firePressed,true);
 });
 for(const kind of ['brake','boost']){
  test(`${locale.name}: ${kind} stays held until both Space and Enter release`,t=>{
   const dom=setup(locale,t),button=byControl(dom.mount,kind);
   down(dom,button);down(dom,button,'Enter');assert.equal(dom.input.sample()[kind],true);
   up(dom,dom.canvas);assert.equal(dom.input.sample()[kind],true);assert.equal(button.getAttribute('data-active'),'true');
   up(dom,dom.canvas,'Enter');assert.equal(dom.input.sample()[kind],false);assert.equal(button.getAttribute('data-active'),'false');
  });
  for(const first of ['keyboard','pointer'])test(`${locale.name}: releasing ${first} does not cancel the other ${kind} source`,t=>{
   const dom=setup(locale,t),button=byControl(dom.mount,kind);pointer(button,'pointerdown',7);down(dom,button,'Enter');
   assert.equal(dom.input.sample()[kind],true);
   if(first==='keyboard')up(dom,dom.canvas,'Enter');else pointer(button,'pointerup',7);
   assert.equal(dom.input.sample()[kind],true);assert.equal(button.getAttribute('data-active'),'true');
   if(first==='keyboard')pointer(button,'pointerup',7);else up(dom,dom.canvas,'Enter');
   assert.equal(dom.input.sample()[kind],false);assert.equal(button.getAttribute('data-active'),'false');
  });
  test(`${locale.name}: two pointers on ${kind} retain the second hold after the first releases`,t=>{
   const dom=setup(locale,t),button=byControl(dom.mount,kind);pointer(button,'pointerdown',7);pointer(button,'pointerdown',8);
   pointer(button,'pointerup',7);assert.equal(dom.input.sample()[kind],true);assert.equal(button.getAttribute('data-active'),'true');
   pointer(button,'pointerup',8);assert.equal(dom.input.sample()[kind],false);assert.equal(button.getAttribute('data-active'),'false');
  });
  test(`${locale.name}: ${kind} focusout cancels keyboard only, keeps pointer, and does not restart on repeat`,t=>{
   const dom=setup(locale,t),button=byControl(dom.mount,kind),other=byControl(dom.mount,'travel');
   down(dom,button);down(dom,button,'Enter');pointer(button,'pointerdown',9);
   button.dispatch('focusout',{relatedTarget:other});assert.equal(dom.input.sample()[kind],true);
   pointer(button,'pointerup',9);assert.deepEqual(actions(dom.input.sample()),neutral);assert.equal(button.getAttribute('data-active'),'false');
   down(dom,button,'Space',{repeat:true});down(dom,button,'Enter',{repeat:true});assert.deepEqual(actions(dom.input.sample()),neutral);
   up(dom,other);up(dom,other,'Enter');down(dom,button);assert.equal(dom.input.sample()[kind],true);
  });
  test(`${locale.name}: ${kind} focus stays held inside its own button subtree`,t=>{
   const dom=setup(locale,t),button=byControl(dom.mount,kind),child=dom.document.createElement('span');button.append(child);
   down(dom,button,'Enter');button.dispatch('focusout',{relatedTarget:child});assert.equal(dom.input.sample()[kind],true);
   button.dispatch('focusout',{target:child,relatedTarget:null});assert.equal(dom.input.sample()[kind],false);
  });
 }
 test(`${locale.name}: focusout does not revoke a fire edge, but cannot refire from the same held key`,t=>{
  const dom=setup(locale,t),button=byControl(dom.mount,'fire');down(dom,button);
  button.dispatch('focusout',{relatedTarget:byControl(dom.mount,'travel')});assert.equal(dom.input.sample().firePressed,true);
  assert.equal(button.getAttribute('data-active'),'false');down(dom,button,'Space',{repeat:true});assert.equal(dom.input.sample().firePressed,false);
 });
 for(const end of ['reset','blur','hidden','visibility-state','disable','dispose','pointercancel','lostcapture'])
 test(`${locale.name}: ${end} clears every action source and queued fire, with no OS-repeat resurrection`,t=>{
  for(const kind of ['fire','brake','boost']){
   const dom=setup(locale,t),button=byControl(dom.mount,kind);down(dom,button,'Enter');
   assert.deepEqual(actions(dom.input.sample()),want[kind],'keyboard must be active before cleanup');
   // Fire a second, independent pointer edge so cleanup must clear a queued shot too.
   pointer(button,'pointerdown',10);
   if(end==='reset')dom.input.reset();
   if(end==='blur')dom.window.dispatch('blur');
   if(end==='hidden'){dom.document.hidden=true;dom.document.dispatch('visibilitychange');dom.document.hidden=false;}
   if(end==='visibility-state'){dom.document.visibilityState='hidden';dom.document.dispatch('visibilitychange');dom.document.visibilityState='visible';}
   if(end==='disable'){dom.input.setEnabled(false);down(dom,button);dom.input.setEnabled(true);}
   if(end==='dispose')dom.input.dispose();
   if(end==='pointercancel')pointer(button,'pointercancel',10);
   if(end==='lostcapture')pointer(button,'lostpointercapture',10);
   assert.deepEqual(actions(dom.input.sample()),neutral);assert.equal(button.getAttribute('data-active'),'false');assert.equal(button.captured.size,0);
   down(dom,button,'Enter',{repeat:true});down(dom,button,'Space',{repeat:true});assert.deepEqual(actions(dom.input.sample()),neutral);
   up(dom,dom.canvas,'Enter');up(dom,dom.canvas);
  }
 });
 test(`${locale.name}: modified or editable action keydowns remain untouched and never awaken on repeat`,t=>{
  const dom=setup(locale,t);
  for(const kind of ['fire','brake','boost'])for(const code of ['Space','Enter']){
   const button=byControl(dom.mount,kind);
   for(const modifier of ['ctrlKey','metaKey','altKey']){
    const event=down(dom,button,code,{[modifier]:true});assert.equal(Boolean(event.defaultPrevented),false);assert.deepEqual(actions(dom.input.sample()),neutral);
    down(dom,button,code,{repeat:true});assert.deepEqual(actions(dom.input.sample()),neutral);up(dom,button,code);
   }
   for(const tag of ['input','textarea','select','span']){
    const editor=dom.document.createElement(tag);if(tag==='span')editor.isContentEditable=true;button.append(editor);
    const event=down(dom,editor,code);assert.equal(Boolean(event.defaultPrevented),false);assert.deepEqual(actions(dom.input.sample()),neutral);editor.remove();
   }
  }
 });
 test(`${locale.name}: foreign action-lookalike buttons cannot acquire this input's action ownership`,t=>{
  const dom=setup(locale,t),cluster=dom.document.createElement('div'),button=dom.document.createElement('button');cluster.className='campaign-touch-actions';button.setAttribute('data-control','fire');cluster.append(button);dom.mount.append(cluster);
  for(const code of ['Space','Enter']){const event=down(dom,button,code);assert.equal(Boolean(event.defaultPrevented),false);assert.deepEqual(actions(dom.input.sample()),neutral);up(dom,button,code);}
 });
 for(const kind of ['fire','brake','boost'])for(const code of ['Space','Enter'])
 test(`${locale.name}: ${kind} ${code} reaches real main controls and simulation without another action`,async t=>{
  const app=await locale.boot('?sortie=showcase-flank');t.after(()=>app.dispose());action(app,'start').dispatch('click');
  const button=byControl(app.mount,kind);button.focus();down(app,button,code);app.frame();
  assert.deepEqual(actions(app.metrics.lastControls),want[kind]);assert.equal(app.latest.state.tankCombat.shotsFired,kind==='fire'?1:0);
  up(app,action(app,'pause'),code);button.dispatch('click',{detail:0});app.frame();
  assert.deepEqual(actions(app.metrics.lastControls),neutral);assert.equal(app.latest.state.tankCombat.shotsFired,kind==='fire'?1:0);
 });
 test(`${locale.name}: main pause and resume do not resurrect action keys from OS repeats`,async t=>{
  const app=await locale.boot('?sortie=showcase-flank');t.after(()=>app.dispose());action(app,'start').dispatch('click');
  const boost=byControl(app.mount,'boost'),fire=byControl(app.mount,'fire');down(app,boost,'Enter');down(app,fire);app.frame();
  assert.equal(app.metrics.lastControls.boost,true);assert.equal(app.latest.state.tankCombat.shotsFired,1);
  action(app,'pause').dispatch('click');action(app,'resume').dispatch('click');down(app,boost,'Enter',{repeat:true});down(app,fire,'Space',{repeat:true});app.frame();
  assert.deepEqual(actions(app.metrics.lastControls),neutral);assert.equal(app.latest.state.tankCombat.shotsFired,1);
 });
}
