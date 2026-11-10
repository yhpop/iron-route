// Executes production UI/input. Rectangles and DOM propagation are explicit test
// fixtures, not browser hit-testing or rendered-pixel evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDOM} from './input-dom.mjs';
import {createUI} from '../src/campaign-ui.js';
import {createInput} from '../src/campaign-input.js';
import {createEightNpcCrossfire} from '../src/eight-npc-crossfire-front.js';
import {createGame} from '../src/campaign-simulation.js';

const viewport={left:0,top:0,width:1280,height:720};
const box=(left,top,width,height)=>({left,top,width,height});
const enemy={id:'northern-enemy',...box(700,80,60,60)};
const intersects=(a,b)=>a.left<b.left+b.width&&a.left+a.width>b.left&&a.top<b.top+b.height&&a.top+a.height>b.top;
function fixture(t) {
  const dom=makeDOM();
  dom.window.innerWidth=1280;dom.window.innerHeight=720;dom.window.matchMedia=()=>({matches:true});
  const spec=createEightNpcCrossfire().spec;
  let state={...createGame(spec),phase:'playing',selectedConvoyChoiceId:'direct'},stamp=0,actors=[];
  const orders=[];
  const ui=createUI({...dom,missions:[spec],orderConvoy:value=>orders.push(value)});
  const input=createInput(dom.canvas,{window:dom.window,document:dom.document,projectAim:(x,y)=>({x,y:0,z:y})});
  const get=selector=>dom.mount.querySelector(selector),hud=get('.campaign-hud'),hold=get('[data-action="convoy-order"]'),cycle=get('[data-action="cycle-objective"]');
  const panel=()=>box(parseFloat(hud.style['--combat-hud-left'])||625,parseFloat(hud.style['--combat-hud-top'])||12,425,213);
  hud.getBoundingClientRect=panel;
  hold.getBoundingClientRect=()=>{const b=panel();return box(b.left+16,b.top+168,134,32);};
  cycle.getBoundingClientRect=()=>{const b=panel();return box(b.left+16,b.top+60,134,28);};
  get('.campaign-nav').rect=box(14,12,210,44);
  get('.campaign-governor').rect=box(14,660,160,40);
  dom.window.getComputedStyle=node=>({display:node.hidden||node.className.includes('campaign-stick')||node.className==='campaign-touch-actions'?'none':'block',visibility:'visible',pointerEvents:node.tagName==='BUTTON'?'auto':'none'});
  // miniDOM intentionally has no DOM event bubbling. Dispatch to the same
  // ancestors as a browser while retaining the original target for real handlers.
  function pointer(target,type,detail={}) {
    const event=target.dispatch(type,{pointerType:'mouse',pointerId:1,button:0,...detail});
    for(let parent=target.parentElement;parent;parent=parent.parentElement)parent.dispatch(type,event);
    dom.window.dispatch(type,event);
    return event;
  }
  const render=()=>ui.render(state,spec,{storageAvailable:true,goalHint:'已选短路'},{viewStatus:'ready',combatHud:{viewport,actors,stamp:stamp+=1000}});
  render();t.after(()=>{input.dispose();ui.dispose();});
  return {...dom,get,hud,hold,cycle,input,orders,pointer,panel,render,
    obstruct(){actors=[enemy];render();},setState(values){state={...state,...values};render();}};
}

test('canvas aiming through non-interactive HUD text clears a northern enemy instead of freezing the panel',t=>{
  // The break: treating a canvas aim coordinate anywhere inside HUD as UI use.
  const f=fixture(t),text=f.get('.campaign-mission-label').textContent;
  assert.equal(f.document.activeElement,f.document.body);
  assert.deepEqual(f.panel(),box(625,12,425,213));
  f.pointer(f.canvas,'pointermove',{clientX:700,clientY:80});
  assert.deepEqual(f.input.sample().aim,{worldPoint:{x:700,y:0,z:80}});
  f.obstruct();
  assert.equal(f.hud.getAttribute('data-layout-reason'),'clear-slot');
  assert.equal(intersects(f.panel(),enemy),false);
  assert.equal(f.get('.campaign-mission-label').textContent,text);
  assert.equal(f.hud.hidden,false);
});

test('canvas firing through HUD text remains gameplay and does not acquire an interaction lock',t=>{
  const f=fixture(t);assert.equal(f.document.activeElement,f.document.body);
  f.pointer(f.canvas,'pointermove',{clientX:700,clientY:80});
  const down=f.pointer(f.canvas,'pointerdown',{clientX:700,clientY:80});
  assert.equal(down.defaultPrevented,true);
  assert.equal(f.input.sample().firePressed,true);
  f.obstruct();
  assert.equal(f.hud.getAttribute('data-layout-reason'),'clear-slot');
  assert.equal(intersects(f.panel(),enemy),false);
});

test('approaching the real Hold button keeps its full panel still and reports remaining danger',t=>{
  const f=fixture(t),before=f.panel();
  f.pointer(f.canvas,'pointermove',{clientX:770,clientY:196}); // 5px outside Hold.
  f.obstruct();
  assert.equal(f.hud.getAttribute('data-layout-reason'),'interaction-locked');
  assert.deepEqual(f.panel(),before);
  assert.ok(Number(f.hud.getAttribute('data-layout-overlap'))>0);
  f.pointer(f.canvas,'pointermove',{clientX:1100,clientY:400});f.render();
  assert.equal(f.hud.getAttribute('data-layout-reason'),'clear-slot');
});

test('a held real button stays stable off-panel, then releases without stale pointer-origin focus',t=>{
  const f=fixture(t),before=f.panel();
  f.pointer(f.hold,'pointerdown',{clientX:680,clientY:196});f.hold.focus();
  f.pointer(f.canvas,'pointermove',{clientX:1100,clientY:400});f.obstruct();
  assert.equal(f.hud.getAttribute('data-layout-reason'),'interaction-locked');assert.deepEqual(f.panel(),before);
  f.pointer(f.canvas,'pointerup',{clientX:1100,clientY:400});
  f.pointer(f.canvas,'pointerdown',{pointerId:2,clientX:700,clientY:80});
  assert.equal(f.document.activeElement,f.hold);
  f.render();assert.equal(f.hud.getAttribute('data-layout-reason'),'clear-slot');
  f.window.dispatch('keydown',{code:'Tab'});f.render();
  assert.equal(f.hud.getAttribute('data-layout-reason'),'interaction-locked');
});

test('touch Hold use locks while held but a released touch coordinate never becomes hover',t=>{
  const f=fixture(t);
  f.pointer(f.hold,'pointerdown',{pointerType:'touch',pointerId:7,clientX:680,clientY:196});
  f.pointer(f.hold,'pointermove',{pointerType:'touch',pointerId:7,clientX:680,clientY:196});
  f.obstruct();assert.equal(f.hud.getAttribute('data-layout-reason'),'interaction-locked');
  f.pointer(f.hold,'pointerup',{pointerType:'touch',pointerId:7,clientX:680,clientY:196});
  f.render();assert.equal(f.hud.getAttribute('data-layout-reason'),'clear-slot');
});

test('releasing another pointer cannot move a control that is still held',t=>{
  const f=fixture(t),before=f.panel();
  f.pointer(f.hold,'pointerdown',{pointerType:'touch',pointerId:7,clientX:680,clientY:196});
  f.pointer(f.canvas,'pointerup',{pointerType:'touch',pointerId:9,clientX:1100,clientY:400});
  f.obstruct();assert.equal(f.hud.getAttribute('data-layout-reason'),'interaction-locked');assert.deepEqual(f.panel(),before);
  f.pointer(f.hold,'pointercancel',{pointerType:'touch',pointerId:7});
  f.render();assert.equal(f.hud.getAttribute('data-layout-reason'),'clear-slot');
});

test('hidden controls do not turn canvas aiming into UI interaction',t=>{
  const f=fixture(t);
  assert.equal(f.cycle.hidden,true);
  f.pointer(f.canvas,'pointermove',{clientX:680,clientY:90});f.obstruct();
  assert.equal(f.hud.getAttribute('data-layout-reason'),'clear-slot');
});

test('keyboard focus still locks a real HUD button without pointer interaction',t=>{
  const f=fixture(t),before=f.panel();f.hold.focus();f.obstruct();
  assert.equal(f.hud.getAttribute('data-layout-reason'),'interaction-locked');assert.deepEqual(f.panel(),before);
  f.hold.dispatch('click');assert.deepEqual(f.orders,['hold']);
});

// A disabled visible button cannot accept an action, so it is not an approach
// target. The disabled state comes from production convoy eligibility.
test('disabled Hold geometry cannot lock the panel while aiming through it',t=>{
  const f=fixture(t);f.setState({entities:{}});
  assert.equal(f.hold.hidden,false);assert.equal(f.hold.disabled,true);
  f.pointer(f.canvas,'pointermove',{clientX:680,clientY:196});f.obstruct();
  assert.equal(f.hud.getAttribute('data-layout-reason'),'clear-slot');
  assert.equal(intersects(f.panel(),enemy),false);
});

test('window blur releases an interrupted real button press without losing later keyboard protection',t=>{
  const f=fixture(t);f.pointer(f.hold,'pointerdown',{pointerId:3,clientX:680,clientY:196});
  f.hold.focus();f.obstruct();assert.equal(f.hud.getAttribute('data-layout-reason'),'interaction-locked');
  f.window.dispatch('blur');f.render();assert.equal(f.hud.getAttribute('data-layout-reason'),'clear-slot');
  f.window.dispatch('keydown',{code:'Tab'});f.render();
  assert.equal(f.hud.getAttribute('data-layout-reason'),'interaction-locked');
});
