/** Actual main + fake DOM/GPU boundary. No browser, image decode, layout or touch claims. */
import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {boot,action} from './main-entry-harness.mjs';
import {createRuinedDepotWorld} from '../src/ruined-depot-world-accelerated.js';
const settle=()=>new Promise(r=>setImmediate(r));
function settings({failures=0,wait,lateView}={}){let loads=0,decorations=0;const worlds=[],terrain=[];return {worlds,terrain,get loads(){return loads;},get decorations(){return decorations;},viewReady:()=>lateView,
 async loadModule(path){
 if(path==='./ruined-depot-world.js')return {createRuinedDepotWorld(spec,field){worlds.push({spec,field});return createRuinedDepotWorld(spec,field);}};
 if(path==='./ruined-depot-loader.js')return {async loadRuinedDepotLibrary(){loads++;await wait;if(loads<=failures)throw new Error('test reject');return {clone:()=>new THREE.Group(),dispose(){}};}};
 if(path==='./scanned-cover-loader.js')return {loadScannedCoverLibrary:async()=>({clone:()=>new THREE.Group(),dispose(){}})};
 if(path==='./scanned-cover-view.js')return {applyScannedCoverView:()=>({dispose(){}})};
 if(path==='./ruined-depot-view.js'){const real=await import('../src/ruined-depot-view.js');return {createRuinedDepotView(...args){decorations++;return real.createRuinedDepotView(...args);}};}
 if(path==='./terrain-candidate/relief-view.js')return {createReliefView(_root,field,options){terrain.push({field,options});return {dispose(){}};}};
 if(path==='./player-model-loader.js')return {loadPlayerModel:async()=>({root:{visible:true},update(){},dispose(){}})};
 if(path==='./interceptor-art-loader.js')return {attachInterceptorArt:async b=>b};
 return import(new URL(path,new URL('../src/main.js',import.meta.url)));
 }};}
test('real featured entry uses exact mission flags, Sandfalcon, shared field and accelerated world path',async()=>{
 const b=settings(),app=await boot('?keep=x#stay',undefined,b),before=[...app.storage.values];
 try{action(app,'open-missions').dispatch('click');const card=app.mount.querySelector('[data-featured-slug="battlefront-depot"]');assert.ok(card);card.dispatch('click');await settle();const {spec,status}=app.latest;assert.equal(spec.id,'mission-9080');assert.equal(spec.slug,'battlefront-depot');for(const flag of ['optional','battlefrontDepot','ruinedDepot','scannedCover','crossfireFront','terrainCombat'])assert.equal(spec[flag],true,flag);assert.equal(spec.playerVehicle.id,'sandfalcon');assert.equal(app.location.search,'?keep=x&sortie=battlefront-depot');assert.equal(app.location.hash,'#stay');assert.equal(status.viewStatus,'ready');assert.equal(app.metrics.viewOptions.suppressZoneBoundaries,true);app.metrics.viewOptions.terrainFactory(new THREE.Group());assert.equal(b.terrain[0].field,b.worlds[0].field);assert.equal(b.terrain[0].options.appearance,'battlefront');const living=app.metrics.viewOptions.livingFactory(new THREE.Group());assert.equal(living.diagnostics.drawBuckets,1);living.dispose();assert.equal(status.routeLabels.length,0);app.uiActions.start();app.frame();assert.equal(app.latest.state.phase,'playing');assert.deepEqual([...app.storage.values],before);app.uiActions.retry();await settle();for(const vehicle of app.uiActions.playerVehicles){app.uiActions.selectPlayerVehicle(vehicle.id);await settle();assert.equal(app.latest.spec.playerVehicle.id,vehicle.id);}
 }finally{app.dispose();}
});
test('candidate real direct URL retries rejected library without poisoning cache',async()=>{
 let release;const wait=new Promise(r=>release=r),b=settings({failures:1,wait}),app=await boot('?sortie=battlefront-depot',undefined,b);try{release();await settle();assert.equal(app.latest.status.viewStatus,'failed');app.uiActions.start();assert.equal(app.latest.state.phase,'briefing');app.uiActions.retry();await settle();assert.equal(app.latest.status.viewStatus,'ready');assert.equal(b.loads,2);app.uiActions.retry();await settle();assert.equal(b.loads,2);assert.equal(app.latest.status.viewStatus,'ready');}finally{app.dispose();}
});
test('candidate waits for actual loaded world readiness and discards stale selection',async()=>{
 let release;const wait=new Promise(r=>release=r),b=settings({wait,lateView:wait}),app=await boot('?sortie=battlefront-depot',undefined,b);try{assert.equal(app.latest.status.viewStatus,'loading');assert.equal(b.decorations,0);app.uiActions.selectMission('crafted20-002');release();await settle();assert.equal(app.latest.spec.id,'crafted20-002');assert.equal(b.decorations,0);await app.uiActions.selectFeaturedMission('battlefront-depot');await settle();assert.equal(app.latest.status.viewStatus,'ready');assert.equal(b.decorations,1);assert.equal(b.loads,1);}finally{release();app.dispose();}
});
test('real English source/menu contains new translated entry without changing old default or old slugs',async()=>{
 const {bootEnglish,englishModules}=await import('./english-test-modules.mjs');const oldScan=englishModules['./scanned-cover-view.js'];englishModules['./scanned-cover-view.js']={applyScannedCoverView:()=>({dispose(){}})};const app=await bootEnglish('?sortie=battlefront-depot');try{await settle();assert.equal(app.latest.spec.title,'Damaged Freight Yard · Two-Line Escort');assert.equal(app.latest.spec.id,'mission-9080');assert.doesNotMatch(app.mount.textContent,/\p{Script=Han}/u);}finally{app.dispose();englishModules['./scanned-cover-view.js']=oldScan;}
 for(const [search,id]of [['','crafted20-002'],['?sortie=ruined-depot','mission-9070'],['?sortie=scanned-cover','mission-9060']]){const app=await boot(search,undefined,settings());try{await settle();assert.equal(app.latest.spec.id,id);assert.equal(app.metrics.viewOptions.suppressZoneBoundaries,undefined);}finally{app.dispose();}}
});
