// Real production input, UI, simulation and English localization. DOM/GPU/audio
// boundaries use the existing Node harness; this is not native-browser evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createInput} from '../src/campaign-input.js';
import {createUI} from '../src/campaign-ui.js';
import {createGame,stepGame} from '../src/campaign-simulation.js';
import {createEightNpcCrossfire} from '../src/eight-npc-crossfire-front.js';
import {makeDOM} from './input-dom.mjs';
import {boot,action} from './main-entry-harness.mjs';
import {bootEnglish,englishModules} from './english-test-modules.mjs';

const modifiers=['ctrlKey','metaKey','altKey'];
const codes=['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight','KeyF','Digit1','Digit2','Digit3'];
const locales=[
  {name:'CN',createInput,createUI,boot},
  {name:'EN',createInput:englishModules['./campaign-input.js'].createInput,createUI:englishModules['./campaign-ui.js'].createUI,boot:bootEnglish},
];
const neutral=governor=>({throttle:0,steer:0,brake:false,boost:false,governor,firePressed:false,paused:false});
const down=(dom,code,fields={})=>dom.window.dispatch('keydown',{code,repeat:false,target:dom.canvas,...fields});
const up=(dom,code,fields={})=>dom.window.dispatch('keyup',{code,target:dom.canvas,...fields});

// Removing modifier rejection would consume browser/OS chords and emit game input.
for(const locale of locales)for(const modifier of modifiers)
test(`${locale.name}: ${modifier} chords do not drive, fire, boost, brake or change gear`,t=>{
  const dom=makeDOM(),input=locale.createInput(dom.canvas,dom);t.after(()=>input.dispose());
  for(const code of codes)for(const shiftKey of [false,true]){
    const governor=code==='Digit2'?'crawl':'cruise';
    input.reset();input.setGovernor(governor);
    const event=down(dom,code,{[modifier]:true,shiftKey});
    const sampled=input.sample();
    assert.deepEqual(sampled,neutral(governor),`${modifier} ${code} must not enter the control state`);
    assert.equal(Boolean(event.defaultPrevented),false,`${modifier} ${code} must retain native default`);
    // A modifier released while the key is held must not turn repeat into a new press.
    down(dom,code,{repeat:true});assert.deepEqual(input.sample(),neutral(governor));
    up(dom,code);
  }
});

for(const locale of locales)for(const modifier of modifiers)
test(`${locale.name}: modified F cannot emit a real projectile from the running main loop (${modifier})`,async t=>{
  const app=await locale.boot('?sortie=showcase-flank');t.after(()=>app.dispose());
  action(app,'start').dispatch('click');
  const event=down(app,'KeyF',{[modifier]:true});app.frame();
  t.diagnostic(JSON.stringify({locale:locale.name,modifier,shotsFired:app.latest.state.tankCombat.shotsFired,firePressed:app.metrics.lastControls.firePressed,defaultPrevented:Boolean(event.defaultPrevented)}));
  assert.equal(app.latest.state.tankCombat.shotsFired,0);
  assert.equal(app.metrics.lastControls.firePressed,false);
  assert.equal(Boolean(event.defaultPrevented),false);
  up(app,'KeyF',{[modifier]:true});down(app,'KeyF');app.frame();
  assert.equal(app.latest.state.tankCombat.shotsFired,1,'ordinary F must still fire after the shortcut');
});

for(const locale of locales)for(const modifier of modifiers)
test(`${locale.name}: modified H cannot change the convoy order (${modifier})`,t=>{
  const dom=makeDOM(),spec=createEightNpcCrossfire().spec;
  // Explicit UI phase/route fixture, not a gameplay route-completion claim.
  let state={...createGame(spec),phase:'playing',selectedConvoyChoiceId:'direct'};
  const ui=locale.createUI({...dom,orderConvoy:convoyOrder=>{state=stepGame(state,{convoyOrder},1/60);}});
  t.after(()=>ui.dispose());ui.render(state,spec,{unlockedIds:[spec.id]},{viewStatus:'ready'});
  const before=state,event=down(dom,'KeyH',{[modifier]:true});
  assert.equal(state,before,'browser history / hide-app shortcut must not issue Hold');
  assert.equal(Boolean(event.defaultPrevented),false);
  const ordinary=down(dom,'KeyH');
  assert.equal(state.convoyOrder,'hold');assert.equal(ordinary.defaultPrevented,true);
  ui.render(state,spec,{unlockedIds:[spec.id]},{viewStatus:'ready'});
  down(dom,'KeyH',{shiftKey:true});assert.equal(state.convoyOrder,'advance','Shift+H preserves inherited behavior');
});

for(const locale of locales)
test(`${locale.name}: Shift boost and ordinary driving/fire remain functional; modified keyup still releases`,t=>{
  const dom=makeDOM(),input=locale.createInput(dom.canvas,dom);t.after(()=>input.dispose());
  down(dom,'ShiftLeft',{shiftKey:true});down(dom,'KeyW',{shiftKey:true});down(dom,'KeyD',{shiftKey:true});
  down(dom,'Digit3',{shiftKey:true});down(dom,'KeyF',{shiftKey:true});
  assert.deepEqual(input.sample(),{throttle:1,steer:1,brake:false,boost:true,governor:'travel',firePressed:true,paused:false});
  up(dom,'KeyW',{metaKey:true});up(dom,'KeyD',{ctrlKey:true});up(dom,'ShiftLeft',{altKey:true});up(dom,'KeyF');
  assert.deepEqual(input.sample(),neutral('travel'));
});
