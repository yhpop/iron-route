/** Actual main/production input/clock/simulation + Node fake DOM/GPU boundary.
 * Explicit boundary fixtures below are NOT natural playthroughs. E1 recordings
 * remain the natural combat/win/death evidence. No browser/layout/decode claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
import {boot,action} from './main-entry-harness.mjs';
import {createRuinedDepotWorld} from '../src/ruined-depot-world-accelerated.js';
import {createLoadingExtraction} from '../src/loading-extraction-front.js';
import {createGame} from '../src/campaign-simulation.js';
import {createUI} from '../src/campaign-ui.js';
import {makeDOM} from './input-dom.mjs';
const settle=()=>new Promise(r=>setImmediate(r));
const objective=app=>app.mount.querySelector('.campaign-objective').textContent;
function settings({failures=0,wait,lateView}={}){
 let loads=0,decorations=0;const worlds=[],terrain=[];
 return {worlds,terrain,get loads(){return loads;},get decorations(){return decorations;},viewReady:()=>lateView,
 async loadModule(path){
  if(path==='./ruined-depot-world.js')return {createRuinedDepotWorld(spec,field){worlds.push({spec,field});return createRuinedDepotWorld(spec,field);}};
  if(path==='./ruined-depot-loader.js')return {async loadRuinedDepotLibrary(){loads++;await wait;if(loads<=failures)throw new Error('E2 boundary decode rejection');return {clone:()=>new THREE.Group(),dispose(){}};}};
  if(path==='./scanned-cover-loader.js')return {loadScannedCoverLibrary:async()=>({clone:()=>new THREE.Group(),dispose(){}})};
  if(path==='./scanned-cover-view.js')return {applyScannedCoverView:()=>({dispose(){}})};
  if(path==='./ruined-depot-view.js'){const real=await import('../src/ruined-depot-view.js');return {createRuinedDepotView(...args){decorations++;return real.createRuinedDepotView(...args);}};}
  if(path==='./terrain-candidate/relief-view.js')return {createReliefView(_root,field,options){terrain.push({field,options});return {dispose(){}};}};
  if(path==='./player-model-loader.js')return {loadPlayerModel:async()=>({root:{visible:true},update(){},dispose(){}})};
  if(path==='./interceptor-art-loader.js')return {attachInterceptorArt:async b=>b};
  return import(new URL(path,new URL('../src/main.js',import.meta.url)));
 }};
}
function requireCandidate(app){assert.equal(app.latest.spec.id,'mission-9090');assert.equal(app.latest.spec.loadingExtraction,true);}
function tick(app,n=1){for(let i=0;i<n;i++)app.frame();}
function neutral(app){assert.equal(app.metrics.lastControls.throttle,0);assert.equal(app.metrics.lastControls.steer,0);assert.equal(app.metrics.lastControls.boost,false);assert.equal(app.metrics.lastControls.firePressed,false);}
function hold(app){for(const code of ['KeyW','KeyD','ShiftLeft','KeyF'])app.window.dispatch('keydown',{code});}

test('real optional featured selection and direct slug bind own builder field, inherited dispatch, URL and no save writes',async()=>{
 const b=settings(),app=await boot('?keep=x#stay',undefined,b),writes=app.storage.writes.length,bytes=[...app.storage.values];try{
  action(app,'open-missions').dispatch('click');const card=app.mount.querySelector('[data-featured-slug="loading-extraction"]');assert.ok(card,'new featured card');card.dispatch('click');await settle();requireCandidate(app);
  assert.equal(app.latest.spec.slug,'loading-extraction');assert.equal(app.latest.spec.playerVehicle.id,'sandfalcon');assert.equal(app.latest.spec.objectives[0].duration,18);
  for(const flag of ['optional','battlefrontDepot','ruinedDepot','scannedCover','crossfireFront','terrainCombat'])assert.equal(app.latest.spec[flag],true,flag);
  assert.equal(app.location.search,'?keep=x&sortie=loading-extraction');assert.equal(app.location.hash,'#stay');assert.equal(app.storage.writes.length,writes);assert.deepEqual([...app.storage.values],bytes);assert.equal(app.latest.status.viewStatus,'ready');
  app.metrics.viewOptions.terrainFactory(new THREE.Group());assert.equal(b.terrain[0].field,b.worlds[0].field);assert.deepEqual(b.worlds[0].field,createLoadingExtraction().field);assert.equal(b.worlds[0].spec.id,'mission-9090');
  assert.equal(app.metrics.viewOptions.suppressZoneBoundaries,true);assert.equal(b.terrain[0].options.appearance,'battlefront');assert.equal(app.latest.status.routeLabels.length,0);
 }finally{app.dispose();}
 const direct=await boot('?sortie=loading-extraction',undefined,settings());try{await settle();requireCandidate(direct);assert.equal(direct.historyCalls.length,0);assert.equal(direct.storage.writes.length,0);}finally{direct.dispose();}
});

test('real preparation ticks, actual main pause/resume/lifecycle freeze and held-input release',async()=>{
 const app=await boot('?sortie=loading-extraction',undefined,settings());try{await settle();requireCandidate(app);assert.equal(objective(app),'0/2 · 装卸掩护 · 18.0s');app.uiActions.start();tick(app,12);
  const elapsed=app.latest.state.objectiveStates['prepare-extraction'].elapsed;assert.ok(elapsed>0);assert.ok(elapsed<1);assert.equal(objective(app),`0/2 · 装卸掩护 · ${(18-elapsed).toFixed(1)}s`);
  assert.equal(app.latest.state.selectedConvoyChoiceId,null);assert.equal(app.latest.state.entities.supply.pose.z,28);assert.equal(app.latest.status.objectiveGuidance.target.id,'loading-area');
  for(const pause of [()=>app.uiActions.pause(),()=>app.window.dispatch('blur'),()=>{app.document.hidden=true;app.document.dispatch('visibilitychange');},()=>app.window.dispatch('pagehide',{persisted:true})]){
   hold(app);app.uiActions.orderConvoy('hold');pause();assert.equal(app.latest.state.phase,'paused');assert.equal(app.metrics.inputEnabled,false);const frozen=structuredClone(app.latest.state),text=objective(app);tick(app,5);assert.deepEqual(app.latest.state,frozen);assert.equal(objective(app),text);
   app.document.hidden=false;app.window.dispatch('pageshow',{persisted:true});app.uiActions.resume();tick(app);neutral(app);assert.notEqual(app.latest.state.convoyOrder,'hold');
  }
 }finally{app.dispose();}
});

test('BOUNDARY FIXTURES: real main ticks reset unfinished hold outside zone and replace countdown at escort activation',async()=>{
 const app=await boot('?sortie=loading-extraction',undefined,settings());try{await settle();requireCandidate(app);app.uiActions.start();tick(app,8);assert.ok(app.latest.state.objectiveStates['prepare-extraction'].elapsed>0);
  app.latest.state.tank.pose.x=5;tick(app);assert.equal(app.latest.state.objectiveStates['prepare-extraction'].elapsed,0);assert.equal(objective(app),'0/2 · 装卸掩护 · 18.0s');
  app.latest.state.tank.pose.x=0;app.latest.state.objectiveStates['prepare-extraction'].elapsed=18-1/60;tick(app);assert.equal(app.latest.state.objectiveStates['prepare-extraction'].status,'complete');assert.equal(app.latest.state.objectiveStates['escort-supply'].status,'active');assert.equal(objective(app),'1/2 · 护送补给车撤离');assert.doesNotMatch(objective(app),/\d\.\ds/);
  app.uiActions.pause();app.uiActions.retry();await settle();assert.equal(objective(app),'0/2 · 装卸掩护 · 18.0s');assert.equal(app.latest.state.objectiveStates['prepare-extraction'].elapsed,0);
 }finally{app.dispose();}
});

for(const cause of ['tank-destroyed','protected-vehicle-destroyed'])test(`BOUNDARY FIXTURE: actual main ${cause} classification/retry restores full fresh state and clears held commands`,async()=>{
 const app=await boot('?sortie=loading-extraction',undefined,settings());try{await settle();requireCandidate(app);const fresh=structuredClone(app.latest.state);app.uiActions.start();tick(app,6);hold(app);app.uiActions.orderConvoy('hold');
  // Test-only HP/pose/choice fixtures isolate retry. These are not natural deaths.
  app.latest.state.tank.pose.x=5;app.latest.state.selectedConvoyChoiceId='direct';app.latest.state.entities.supply.routeIndex=1;
  if(cause==='tank-destroyed')app.latest.state.tankCombat.hp=0;else {app.latest.state.entities.supply.hp=0;app.latest.state.entities.supply.alive=false;}
  tick(app);assert.equal(app.latest.state.phase,'lost');assert.equal(app.latest.state.result.cause,cause);assert.equal(app.metrics.inputEnabled,false);
  app.uiActions.retry();await settle();assert.deepEqual(app.latest.state,fresh);assert.equal(app.storage.writes.length,0);assert.equal(app.latest.spec.id,'mission-9090');app.uiActions.start();tick(app);neutral(app);assert.notEqual(app.latest.state.convoyOrder,'hold');assert.equal(app.latest.state.selectedConvoyChoiceId,null);assert.equal(app.latest.state.entities.supply.routeIndex,null);assert.equal(app.latest.state.objectiveStates['prepare-extraction'].elapsed,1/60);
 }finally{app.dispose();}
});

test('new direct entry retries rejected loader and reuses successful app-owned cache',async()=>{
 let release;const wait=new Promise(r=>release=r),b=settings({failures:1,wait}),app=await boot('?sortie=loading-extraction',undefined,b);try{requireCandidate(app);release();await settle();assert.equal(app.latest.status.viewStatus,'failed');app.uiActions.start();assert.equal(app.latest.state.phase,'briefing');app.uiActions.retry();await settle();assert.equal(app.latest.status.viewStatus,'ready');assert.equal(b.loads,2);app.uiActions.retry();await settle();assert.equal(b.loads,2);assert.equal(app.latest.status.viewStatus,'ready');}finally{release();app.dispose();}
});
test('new entry async loading readiness discards stale selection and disposal decorations',async()=>{
 let release;const wait=new Promise(r=>release=r),b=settings({wait,lateView:wait}),app=await boot('?sortie=loading-extraction',undefined,b);try{requireCandidate(app);assert.equal(app.latest.status.viewStatus,'loading');assert.equal(b.decorations,0);app.uiActions.selectMission('crafted20-002');release();await settle();assert.equal(app.latest.spec.id,'crafted20-002');assert.equal(b.decorations,0);await app.uiActions.selectFeaturedMission('loading-extraction');await settle();assert.equal(app.latest.status.viewStatus,'ready');assert.equal(b.decorations,1);}finally{release();app.dispose();}
 let release2;const wait2=new Promise(r=>release2=r),b2=settings({wait:wait2,lateView:wait2}),disposed=await boot('?sortie=loading-extraction',undefined,b2);requireCandidate(disposed);disposed.dispose();release2();await settle();assert.equal(b2.decorations,0);
});

test('candidate-only readout uses definition duration/state elapsed, handles briefing, clamps zero and preserves exact old text',async()=>{
 const dom=makeDOM(),ui=createUI(dom),{spec}=createLoadingExtraction(),state=createGame(spec);try{
  ui.render(state,spec,{});assert.equal(objective(dom),'0/2 · 装卸掩护 · 18.0s');state.objectiveStates['prepare-extraction'].elapsed=4.25;spec.objectives[0].duration=20;ui.render(state,spec,{});assert.equal(objective(dom),'0/2 · 装卸掩护 · 15.8s');state.objectiveStates['prepare-extraction'].elapsed=21;ui.render(state,spec,{});assert.equal(objective(dom),'0/2 · 装卸掩护 · 0.0s');
  delete spec.loadingExtraction;ui.render(state,spec,{});assert.equal(objective(dom),'0/2 · 掩护装卸 18 秒');
 }finally{ui.dispose();}
 for(const [search,id,text] of [
  ['','crafted20-002','0/2 · 绕到装甲侧面，清除仓库炮位'],
  ['?sortie=battlefront-depot','mission-9080','0/2 · 接应补给车，驶入东西集结圈选路'],
  ['?sortie=ruined-depot','mission-9070','0/2 · 接应补给车，驶入东西集结圈选路'],
  ['?sortie=scanned-cover','mission-9060','0/2 · 接应补给车，驶入东西集结圈选路'],
  ['?sortie=warehouse-fork','mission-9001','0/3 · 突破标记路障']]){
  const app=await boot(search,undefined,settings());try{await settle();assert.equal(app.latest.spec.id,id);assert.equal(objective(app),text);}finally{app.dispose();}
 }
});

test('actual production English modules translate new source/menu/readout and preserve default and old URLs',async()=>{
 const {bootEnglish,englishModules}=await import('./english-test-modules.mjs');const old=englishModules['./scanned-cover-view.js'];englishModules['./scanned-cover-view.js']={applyScannedCoverView:()=>({dispose(){}})};
 try{const app=await bootEnglish('?sortie=loading-extraction');try{
   await settle();requireCandidate(app);const fresh=structuredClone(app.latest.state);
   assert.equal(app.latest.spec.title,'Loading-Apron Cover · Extraction');assert.equal(app.latest.spec.objectives[0].title,'Cover loading for 18 seconds');assert.equal(objective(app),'0/2 · Cover loading · 18.0s');
   app.uiActions.start();tick(app,6);assert.equal(objective(app),`0/2 · Cover loading · ${(18-app.latest.state.objectiveStates['prepare-extraction'].elapsed).toFixed(1)}s`);
   hold(app);app.uiActions.pause();const frozen=structuredClone(app.latest.state),text=objective(app);tick(app,5);assert.deepEqual(app.latest.state,frozen);assert.equal(objective(app),text);app.uiActions.resume();tick(app);neutral(app);
   // English production modules; explicitly labeled pose/elapsed boundary fixtures.
   app.latest.state.tank.pose.x=5;tick(app);assert.equal(app.latest.state.objectiveStates['prepare-extraction'].elapsed,0);assert.equal(objective(app),'0/2 · Cover loading · 18.0s');
   app.latest.state.tank.pose.x=0;app.latest.state.objectiveStates['prepare-extraction'].elapsed=18-1/60;tick(app);assert.equal(app.latest.state.objectiveStates['escort-supply'].status,'active');assert.equal(objective(app),'1/2 · Escort the supply truck to extraction');assert.doesNotMatch(objective(app),/\d\.\ds/);
   app.uiActions.pause();app.uiActions.retry();await settle();assert.deepEqual(app.latest.state,fresh);assert.equal(objective(app),'0/2 · Cover loading · 18.0s');
   action(app,'open-missions').dispatch('click');assert.ok(app.mount.querySelector('[data-featured-slug="loading-extraction"]'));assert.doesNotMatch(app.mount.textContent+app.latest.spec.briefing,/\p{Script=Han}/u);
  }finally{app.dispose();}
  for(const [search,id,text] of [
   ['','crafted20-002','0/2 · Flank the armor and destroy the warehouse gun'],
   ['?sortie=battlefront-depot','mission-9080','0/2 · Meet the supply truck and enter a route assembly circle'],
   ['?sortie=ruined-depot','mission-9070','0/2 · Meet the supply truck and enter a route assembly circle'],
   ['?sortie=scanned-cover','mission-9060','0/2 · Meet the supply truck and enter a route assembly circle'],
   ['?sortie=warehouse-fork','mission-9001','0/3 · Break through the marked barrier']]){
   const app=await bootEnglish(search);try{await settle();assert.equal(app.latest.spec.id,id);assert.equal(objective(app),text);}finally{app.dispose();}
  }
 }finally{englishModules['./scanned-cover-view.js']=old;}
});

test('English inventory completely covers new source and all actual main Han literals before final production build',async()=>{
 const {englishInventory,prepareEnglishSource}=await import('../scripts/english-localization.mjs');assert.ok(englishInventory['src/loading-extraction-front.js']);
 for(const file of ['src/main.js','src/campaign-ui.js','src/loading-extraction-front.js']){const source=await readFile(new URL('../'+file,import.meta.url),'utf8');assert.doesNotMatch(prepareEnglishSource(file,source),/\p{Script=Han}/u);}
});
