// Real UI/input and actual main visibility -> pause -> render -> resume.
// DOM rectangles/dispatch, RAF, GPU views and audio use the existing Node boundary.
// UI fixture actors are explicit rectangles, not pixels or device evidence.
// Main's one route-choice setup mirrors convoy-command-main; no route win is claimed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createUI} from '../src/campaign-ui.js';
import {createInput} from '../src/campaign-input.js';
import {createEightNpcCrossfire} from '../src/eight-npc-crossfire-front.js';
import {createGame} from '../src/campaign-simulation.js';
import {makeDOM,byControl} from './input-dom.mjs';
import {boot,action} from './timed-main-harness.mjs';
import {englishModules,englishMainSource} from './english-test-modules.mjs';

const locales=[
  {name:'CN',createUI,createInput,load:p=>import(new URL('../src/'+p.slice(2),import.meta.url))},
  {name:'EN',createUI:englishModules['./campaign-ui.js'].createUI,createInput:englishModules['./campaign-input.js'].createInput,mainSource:englishMainSource,load:p=>englishModules[p]},
];
const box=(left,top,width,height)=>({left,top,width,height});
const viewport=box(0,0,1280,720),enemy={id:'northern-enemy',...box(700,80,60,60)};
const overlaps=(a,b)=>a.left<b.left+b.width&&a.left+a.width>b.left&&a.top<b.top+b.height&&a.top+a.height>b.top;
function geometry(dom){
  dom.window.innerWidth=1280;dom.window.innerHeight=720;dom.window.matchMedia=()=>({matches:true});
  dom.canvas.rect={...viewport};
  const get=s=>dom.mount.querySelector(s),hud=get('.campaign-hud'),hold=get('[data-action="convoy-order"]');
  const panel=()=>box(parseFloat(hud.style['--combat-hud-left'])||625,parseFloat(hud.style['--combat-hud-top'])||12,425,213);
  hud.getBoundingClientRect=panel;
  hold.getBoundingClientRect=()=>{const b=panel();return box(b.left+16,b.top+168,134,32);};
  get('.campaign-nav').rect=box(14,12,210,44);
  const governor=get('.campaign-governor');if(governor)governor.rect=box(14,660,160,40);
  dom.window.getComputedStyle=node=>({display:node.hidden||node.className.includes('campaign-stick')||node.className==='campaign-touch-actions'?'none':'block',visibility:'visible',pointerEvents:node.tagName==='BUTTON'?'auto':'none'});
  // miniDOM does not bubble; dispatch HUD pointerdown with its original target.
  const press=(id=7)=>hud.dispatch('pointerdown',{target:hold,pointerType:'mouse',pointerId:id,button:0});
  const away=()=>dom.window.dispatch('pointermove',{pointerType:'mouse',clientX:1100,clientY:400});
  return {get,hud,hold,panel,press,away};
}
function fixture(t,locale){
  const dom=makeDOM(),spec=createEightNpcCrossfire().spec;
  let state={...createGame(spec),phase:'playing',selectedConvoyChoiceId:'direct'},actors=[],stamp=0;
  const ui=locale.createUI({...dom,missions:[spec],orderConvoy(){}}),g=geometry(dom);
  const render=()=>ui.render(state,spec,{storageAvailable:true},{viewStatus:'ready',combatHud:{viewport,actors,stamp:stamp+=1000}});
  render();t.after(()=>ui.dispose());
  return {...dom,...g,ui,render,obstruct(){actors=[enemy];render();},phase(phase){state={...state,phase};render();},
    hidden(fields={hidden:true,visibilityState:'hidden'}){Object.assign(dom.document,fields);dom.document.dispatch('visibilitychange');},
    visible(){Object.assign(dom.document,{hidden:false,visibilityState:'visible'});dom.document.dispatch('visibilitychange');}};
}
for(const locale of locales){
  for(const signal of ['hidden','visibilityState'])test(`${locale.name}: ${signal} cancels an interrupted HUD press without blur or pointerup`,t=>{
    // Break caught: omission of hidden-document clearing of combatPressedPointers.
    const f=fixture(t,locale);f.press();f.hold.focus();f.away();f.obstruct();
    assert.equal(f.hud.getAttribute('data-layout-reason'),'interaction-locked');
    assert.equal(overlaps(f.panel(),enemy),true);
    f.hidden(signal==='hidden'?{hidden:true,visibilityState:'visible'}:{hidden:false,visibilityState:'hidden'});
    f.phase('paused');f.visible();f.phase('playing');
    t.diagnostic(JSON.stringify({locale:locale.name,signal,afterResume:f.hud.getAttribute('data-layout-reason'),overlap:f.hud.getAttribute('data-layout-overlap')}));
    assert.equal(f.hud.getAttribute('data-layout-reason'),'clear-slot');
    assert.equal(overlaps(f.panel(),enemy),false);
    assert.equal(f.hold.disabled,false);assert.equal(f.hud.hidden,false);
    // A later real press still acquires the lock; unrelated release cannot clear it.
    f.press(8);f.away();f.render();assert.equal(f.hud.getAttribute('data-layout-reason'),'interaction-locked');
    f.window.dispatch('pointerup',{pointerId:7});f.render();assert.equal(f.hud.getAttribute('data-layout-reason'),'interaction-locked');
    f.window.dispatch('pointerup',{pointerId:8});f.render();assert.notEqual(f.hud.getAttribute('data-layout-reason'),'interaction-locked');
  });
  test(`${locale.name}: hiding clears an obsolete hover coordinate even when no pointer is pressed`,t=>{
    // Break caught: clearing only held IDs, while retaining the near-control hover.
    const f=fixture(t,locale);f.window.dispatch('pointermove',{pointerType:'mouse',clientX:770,clientY:196});f.obstruct();
    assert.equal(f.hud.getAttribute('data-layout-reason'),'interaction-locked');
    f.hidden();f.phase('paused');f.visible();f.phase('playing');
    assert.equal(f.hud.getAttribute('data-layout-reason'),'clear-slot');assert.equal(overlaps(f.panel(),enemy),false);
  });
  test(`${locale.name}: a visible-only notification preserves a real held HUD control`,t=>{
    // Break caught: unconditional cleanup on every visibilitychange.
    const f=fixture(t,locale);f.press();f.away();f.obstruct();const before=f.panel();
    f.visible();f.render();assert.equal(f.hud.getAttribute('data-layout-reason'),'interaction-locked');assert.deepEqual(f.panel(),before);
    f.window.dispatch('pointerup',{pointerId:7});f.render();assert.equal(f.hud.getAttribute('data-layout-reason'),'clear-slot');
  });
  test(`${locale.name}: keyboard focus protection survives hidden-page pointer cleanup`,t=>{
    // Break caught: treating genuine keyboard focus as stale pointer focus.
    const f=fixture(t,locale);f.hold.focus();f.window.dispatch('keydown',{code:'Tab',target:f.hold});f.obstruct();
    f.hidden();f.visible();f.render();
    assert.equal(f.document.activeElement,f.hold);assert.equal(f.hud.getAttribute('data-layout-reason'),'interaction-locked');
  });
  test(`${locale.name}: actual main pauses and clears gameplay input but must also release the hidden HUD press`,async t=>{
    // Same GPU/asset boundaries as featured-return-20261103; main, UI, input,
    // gesture guard, clock, world, simulation and camera projection remain real.
    const gpu={
      './interceptor-art-loader.js':{attachInterceptorArt:async base=>({...base,diagnostics:{communityVehicles:1}})},
      './player-model-loader.js':{loadPlayerModel:async()=>({root:{visible:true},update(){},dispose(){}})},
      './scanned-cover-loader.js':{loadScannedCoverLibrary:async()=>({dispose(){}})},
      './scanned-cover-view.js':{applyScannedCoverView:()=>({dispose(){}})},
      './ruined-depot-loader.js':{loadRuinedDepotLibrary:async()=>({dispose(){}})},
      './ruined-depot-view.js':{createRuinedDepotView:()=>({update(){},dispose(){}})},
    };
    const app=await boot('?sortie=eight-npc-reconstruction',undefined,{mainSource:locale.mainSource,loadModule:p=>gpu[p]??locale.load(p)});
    t.after(()=>app.dispose());const g=geometry(app);action(app,'start').dispatch('click');
    // Explicit fixture eligibility only. This is not a route/mission replay.
    assert.ok(app.latest.spec.convoyChoice.options.some(option=>option.id==='direct'));
    app.latest.state.selectedConvoyChoiceId='direct';app.frame();
    assert.equal(g.hold.disabled,false);assert.equal(app.latest.state.phase,'playing');
    g.press(41);g.away();
    const boost=byControl(app.mount,'boost');boost.dispatch('pointerdown',{pointerId:42,pointerType:'touch',button:0});
    app.frame(300);assert.equal(app.metrics.lastControls.boost,true);assert.equal(g.hud.getAttribute('data-layout-reason'),'interaction-locked');
    Object.assign(app.document,{hidden:true,visibilityState:'hidden'});app.document.dispatch('visibilitychange');
    assert.equal(app.latest.state.phase,'paused');assert.equal(app.metrics.inputEnabled,false);assert.equal(app.metrics.audioPaused,true);assert.equal(boost.captured.size,0);
    const pausedTick=app.latest.state.tick;app.frame();assert.equal(app.latest.state.tick,pausedTick);
    Object.assign(app.document,{hidden:false,visibilityState:'visible'});app.document.dispatch('visibilitychange');
    action(app,'resume').dispatch('click');app.frame();
    const result={locale:locale.name,phase:app.latest.state.phase,inputEnabled:app.metrics.inputEnabled,boost:app.metrics.lastControls.boost,hudReason:g.hud.getAttribute('data-layout-reason')};
    t.diagnostic(JSON.stringify(result));
    assert.equal(result.phase,'playing');assert.equal(result.inputEnabled,true);assert.equal(result.boost,false);
    assert.notEqual(result.hudReason,'interaction-locked','hidden press must not survive real main pause/render/resume');
    assert.equal(app.metrics.networkRequests,0);assert.equal(app.errors.length,0);
  });
}
