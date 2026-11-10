/** CPU/fake DOM actual-main tests, NOT visual/device acceptance.
 * Real: entry body, UI, navigation, simulation, new world/field, ruin adapter,
 * player occlusion. Fake GPU boundary: GLB library, campaign/tank/terrain views,
 * renderer/audio/RAF (existing harness). No test-only production bypass.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {boot,makeStorage,action} from './main-entry-harness.mjs';
import {createRuinedDepotWorld} from '../src/ruined-depot-world.js';
import {createRuinedDepotView} from '../src/ruined-depot-view.js';
import {createPlayerOcclusion} from '../src/player-occlusion.js';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function boundary({ruinReady,scanReady,failures=0,adapterFailures=0,lateView}={}){
 const calls=[],fields=[],adapters=[],libraries=[],terrainOptions=[];let scene,app,attempt=0,adapterAttempt=0;
 let routeProjectionCalls=0;
 const b={calls,fields,adapters,libraries,terrainOptions,get routeProjectionCalls(){return routeProjectionCalls;},setApp(value){app=value;},
  viewReady(spec){
   if(!spec.ruinedDepot)return;
   const install=()=>{
    const old=[];scene.traverse(node=>{if(node.userData.fakeCampaign)old.push(node);});for(const node of old)node.removeFromParent();
    // Fake campaign GPU owner: asynchronously creates the actual proxy names.
    for(const collider of spec.geometry.filter(c=>c.ruinInstanceId)){const root=new THREE.Group();root.name=`solid:${collider.id}`;root.userData.fakeCampaign=true;scene.add(root);}
    for(const name of ['warfield-fragments','warfield-wall-scars','warfield-ruins']){const root=new THREE.Group();root.name=name;root.userData.fakeCampaign=true;scene.add(root);}
    calls.push('campaign-ready');
   };
   if(lateView)return lateView.promise.then(install);install();
  },
  async loadModule(path){
   if(path==='./route-choice-guidance.js'){const real=await import('../src/route-choice-guidance.js');return {...real,routeChoiceLabels(...args){routeProjectionCalls++;return real.routeChoiceLabels(...args);}};}
   if(path==='./ruined-depot-loader.js')return {async loadRuinedDepotLibrary(){const n=++attempt;calls.push(`ruin-load:${n}`);await (typeof ruinReady==='function'?ruinReady(n):ruinReady);if(n<=failures)throw new Error(`ruin failure ${n}`);const library={clone(){return new THREE.Group();},dispose(){calls.push('ruin-library-dispose');library.disposes++;library.viewDisposesAtRelease=app?.metrics.viewDisposes;},disposes:0};libraries.push(library);return library;}};
   if(path==='./scanned-cover-loader.js')return {async loadScannedCoverLibrary(){calls.push('scan-load');await scanReady;return {clone(){return new THREE.Group();},dispose(){calls.push('scan-library-dispose');}};}};
   if(path==='./scanned-cover-view.js')return {applyScannedCoverView(){calls.push('scan-decorate');return {dispose(){calls.push('scan-adapter-dispose');}};}};
   if(path==='./ruined-depot-world.js')return {createRuinedDepotWorld(spec,field){fields.push(field);calls.push('ruin-world');return createRuinedDepotWorld(spec,field);}};
   if(path==='./ruined-depot-view.js')return {createRuinedDepotView(parent,spec,field,library){calls.push('ruin-decorate');assert.equal(field,fields.at(-1));if(++adapterAttempt<=adapterFailures)throw new Error('adapter failure');const view=createRuinedDepotView(parent,spec,field,library);adapters.push(view);assert.equal(view.diagnostics.hiddenProxyRoots,61);assert.equal(view.diagnostics.hiddenCosmeticBuckets,3);const dispose=view.dispose;return {...view,update(...args){calls.push('ruin-update');view.update(...args);},dispose(){calls.push('ruin-adapter-dispose');calls.push(`campaign-disposes-before-adapter:${app?.metrics.viewDisposes}`);dispose();}};}};
   if(path==='./player-occlusion.js')return {createPlayerOcclusion(parent){scene=parent;const view=createPlayerOcclusion(parent);return {...view,dispose(){calls.push('occlusion-dispose');view.dispose();}};}};
   if(path==='./terrain-candidate/relief-view.js')return {createReliefView(_root,field,options){terrainOptions.push({field,options});return {update(){},dispose(){}};}};
   if(path==='./player-model-loader.js')return {loadPlayerModel:async()=>({root:{visible:true},update(){},dispose(){}})};
   if(path==='./interceptor-art-loader.js')return {attachInterceptorArt:async base=>({...base,diagnostics:{communityVehicles:1}})};
   return import(new URL(path,new URL('../src/main.js',import.meta.url)));
  }};
 return b;
}
async function launch(settings={},search='?sortie=ruined-depot',storage){const b=boundary(settings),app=await boot(search,storage,b);b.setApp(app);return {app,b};}
function assertGated(app,status='loading'){assert.equal(app.latest.status.viewStatus,status);app.uiActions.start();app.uiActions.resume();assert.equal(app.latest.state.phase,'briefing');assert.equal(app.metrics.inputEnabled,false);}
test('actual main resolves ruined-depot, new shared field/exact world, lighter scorched view, independent app-owned libraries',async()=>{
 const storage=makeStorage(),before=[...storage.values],{app,b}=await launch({},undefined,storage);
 try{await settle();assert.equal(app.latest.spec.id,'mission-9070');assert.equal(app.latest.spec.playerVehicle.id,'sandfalcon');assert.equal(app.latest.status.viewStatus,'ready');assert.equal(b.fields.length,1);app.metrics.viewOptions.terrainFactory(new THREE.Group());assert.equal(b.terrainOptions[0].field,b.fields[0]);assert.equal(b.terrainOptions[0].options.appearance,'scorched');app.uiActions.start();app.frame();assert.ok(b.calls.includes('ruin-update'));assert.equal(app.latest.state.phase,'playing');assert.equal(app.metrics.inputEnabled,true);assert.deepEqual(Array.from(app.latest.status.routeLabels),[]);assert.equal(b.routeProjectionCalls,0,'new mission never projects floating route labels');assert.ok(app.latest.spec.convoyChoice.options.length>=2);assert.deepEqual([...storage.values],before);}finally{app.dispose();}
 assert.equal(b.libraries[0].disposes,1);assert.equal(b.calls.filter(c=>c==='scan-library-dispose').length,1);
});
test('new featured card selects real mission from prior campaign and reloadable URL; optional saves untouched',async()=>{
 const {app,b}=await launch({},'?keep=a%20b#stay'),before=[...app.storage.values];
 try{action(app,'open-missions').dispatch('click');const card=app.mount.querySelector('[data-featured-slug="ruined-depot"]');assert.ok(card);card.dispatch('click');await settle();assert.equal(app.latest.spec.id,'mission-9070');assert.equal(app.location.search,'?keep=a%20b&sortie=ruined-depot');assert.equal(app.location.hash,'#stay');assert.deepEqual([...app.storage.values],before);assert.ok(b.calls.includes('ruin-decorate'));}finally{app.dispose();}
});
test('old defaults, V4 and scan startup never request or decorate ruins',async()=>{for(const search of ['','?sortie=crossfire-v4','?sortie=scanned-cover']){const {app,b}=await launch({},search);try{await settle();assert.equal(b.calls.some(c=>c.startsWith('ruin-')),false);}finally{app.dispose();}}});
for(const pending of ['ruin','scan'])test(`${pending} independently gates new start/resume/input`,async()=>{
 const wait=gate(),{app}=await launch({[pending==='ruin'?'ruinReady':'scanReady']:wait.promise});
 try{assertGated(app);wait.resolve();await settle();assert.equal(app.latest.status.viewStatus,'ready');app.uiActions.start();assert.equal(app.latest.state.phase,'playing');assert.equal(app.metrics.inputEnabled,true);}finally{wait.resolve();app.dispose();}
});
for(const failures of [1,2])test(`ruin Retry clears ${failures} rejection(s), success reused without new load`,async()=>{
 const wait=gate(),{app,b}=await launch({ruinReady:wait.promise,failures});
 try{wait.resolve();await settle();for(let n=1;n<=failures;n++){assertGated(app,'failed');assert.equal(b.calls.filter(c=>c.startsWith('ruin-load')).length,n);app.uiActions.retry();await settle();}assert.equal(app.latest.status.viewStatus,'ready');app.uiActions.retry();await settle();assert.equal(app.latest.status.viewStatus,'ready');assert.equal(b.calls.filter(c=>c.startsWith('ruin-load')).length,failures+1);}finally{app.dispose();}assert.equal(b.libraries[0].disposes,1);
});
test('pending multiple Retry shares one ruin load, only latest world decorates',async()=>{
 const wait=gate(),{app,b}=await launch({ruinReady:wait.promise});try{app.uiActions.retry();app.uiActions.retry();assertGated(app);wait.resolve();await settle();assert.equal(b.calls.filter(c=>c.startsWith('ruin-load')).length,1);assert.equal(b.calls.filter(c=>c==='ruin-decorate').length,1);assert.equal(app.latest.status.viewStatus,'ready');}finally{wait.resolve();app.dispose();}
});
test('switch away and return before shared ruin completion decorates only latest view',async()=>{
 const wait=gate(),{app,b}=await launch({ruinReady:wait.promise});try{app.uiActions.selectMission('crafted20-002');await app.uiActions.selectFeaturedMission('ruined-depot');assertGated(app);wait.resolve();await settle();assert.equal(app.latest.spec.id,'mission-9070');assert.equal(b.calls.filter(c=>c==='ruin-decorate').length,1);assert.equal(b.calls.filter(c=>c.startsWith('ruin-load')).length,1);}finally{wait.resolve();app.dispose();}
});
for(const cancel of ['selection','dispose'])test(`failed-retry pending ${cancel} blocks stale decoration and owns late release once`,async()=>{
 const first=gate(),second=gate(),{app,b}=await launch({ruinReady:n=>(n===1?first:second).promise,failures:1});
 try{first.resolve();await settle();assertGated(app,'failed');app.uiActions.retry();await settle();assertGated(app);if(cancel==='dispose')app.dispose();else app.uiActions.selectMission('crafted20-002');second.resolve();await settle();assert.equal(b.calls.includes('ruin-decorate'),false);if(cancel==='selection'){assert.equal(app.latest.status.viewStatus,'ready');assert.equal(b.libraries[0].disposes,0);}}finally{first.resolve();second.resolve();await settle();app.dispose();}assert.equal(b.libraries[0].disposes,1);
});
test('late initial library after app teardown is disposed exactly once and never decorated',async()=>{
 const wait=gate(),{app,b}=await launch({ruinReady:wait.promise});app.dispose();app.dispose();wait.resolve();await settle();assert.equal(b.calls.includes('ruin-decorate'),false);assert.equal(b.libraries[0].disposes,1);
});
test('adapter failure fails closed, retains successful library for a genuine retry',async()=>{
 const wait=gate(),{app,b}=await launch({ruinReady:wait.promise,adapterFailures:1});try{wait.resolve();await settle();assertGated(app,'failed');assert.equal(b.libraries[0].disposes,0);app.uiActions.retry();await settle();assert.equal(app.latest.status.viewStatus,'ready');assert.equal(b.calls.filter(c=>c.startsWith('ruin-load')).length,1);}finally{wait.resolve();app.dispose();}assert.equal(b.libraries[0].disposes,1);
});
test('late campaign-ready creates proxies/cosmetics before real ruin adapter hides them',async()=>{
 const lateView=gate(),{app,b}=await launch({lateView});try{await settle();assertGated(app);assert.equal(b.calls.includes('ruin-decorate'),false);lateView.resolve();await settle();assert.equal(app.latest.status.viewStatus,'ready');assert.ok(b.calls.indexOf('campaign-ready')<b.calls.indexOf('ruin-decorate'));assert.equal(b.adapters[0].diagnostics.hiddenProxyRoots,61);}finally{lateView.resolve();app.dispose();}
});
test('actual teardown callbacks order occlusion before ruin before campaign view before libraries',async()=>{
 const {app,b}=await launch();await settle();const before=app.metrics.viewDisposes;b.calls.length=0;app.dispose();assert.ok(b.calls.indexOf('occlusion-dispose')<b.calls.indexOf('ruin-adapter-dispose'));const countAtAdapter=Number(b.calls.find(c=>c.startsWith('campaign-disposes-before-adapter:')).split(':')[1]);
 assert.equal(b.libraries[0].viewDisposesAtRelease,countAtAdapter+1,'campaign view releases after adapter and immediately before libraries');assert.ok(countAtAdapter>=before);assert.ok(b.calls.indexOf('ruin-adapter-dispose')<b.calls.indexOf('ruin-library-dispose'));assert.equal(b.libraries[0].disposes,1);
});
test('lazy GPU boundary imports only embedded new asset; credits disclose separate sources and authored maps',()=>{
 const loader=readFileSync(new URL('../src/ruined-depot-loader.js',import.meta.url),'utf8'),html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(loader,/import\(['"]\.\/ruined-depot-embedded.js['"]\)/);for(const text of ['LFA','destroyed-walls-3d-models','licenses/by/3.0','Fleurman','destroyed-city-assets','UV','not measured'])assert.ok(html.includes(text),text);
});

test('cached success survives switching missions and return without a duplicate decode',async()=>{
 const {app,b}=await launch();try{await settle();app.uiActions.selectMission('crafted20-002');assert.equal(b.libraries[0].disposes,0);await app.uiActions.selectFeaturedMission('ruined-depot');await settle();assert.equal(app.latest.status.viewStatus,'ready');assert.equal(b.calls.filter(c=>c.startsWith('ruin-load')).length,1);assert.equal(b.calls.filter(c=>c==='ruin-decorate').length,2);}finally{app.dispose();}assert.equal(b.libraries[0].disposes,1);
});
test('translated new production source has exact English title and no Han; real English menu selects it with same input gate',async()=>{
 const {translateEnglishSource}=await import('../scripts/english-localization.mjs');
 for(const file of ['ruined-depot-front.js','ruined-depot-world.js','ruined-depot-view.js','ruined-depot-loader.js','ruined-depot-embedded.js']){const source=readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8'),english=translateEnglishSource(`src/${file}`,source);assert.doesNotMatch(english,/\p{Script=Han}/u);if(file==='ruined-depot-front.js')assert.match(english,/Ruined Depot · Escort Through Broken Walls/);}
 const {bootEnglish,englishModules}=await import('./english-test-modules.mjs'),old=englishModules['./ruined-depot-loader.js'],oldOcclusion=englishModules['./player-occlusion.js'],wait=gate();let englishScene;
 englishModules['./player-occlusion.js']={createPlayerOcclusion(scene){englishScene=scene;return oldOcclusion.createPlayerOcclusion(scene);}};
 englishModules['./ruined-depot-loader.js']={async loadRuinedDepotLibrary(){await wait.promise;return {clone:()=>new THREE.Group(),dispose(){}};}};
 let app;try{app=await bootEnglish('',undefined,{viewReady(spec){
  // Explicit fake campaign GPU boundary: provide the roots required by real scan/ruin adapters.
  if(!spec.scannedCover)return;for(const c of spec.geometry){const root=new THREE.Group();root.name=`solid:${c.id}`;englishScene.add(root);}
  for(const name of ['warfield-fragments','warfield-wall-scars','warfield-ruins']){const root=new THREE.Group();root.name=name;englishScene.add(root);}
 }});action(app,'open-missions').dispatch('click');const card=app.mount.querySelector('[data-featured-slug="ruined-depot"]');assert.ok(card);assert.match(card.textContent,/Ruined Depot/);card.dispatch('click');await settle();assert.equal(app.latest.spec.id,'mission-9070');assertGated(app);wait.resolve();await settle();app.uiActions.start();app.frame();assert.equal(app.latest.spec.title,'Ruined Depot · Escort Through Broken Walls');assert.equal(app.latest.state.phase,'playing');assert.deepEqual(Array.from(app.latest.status.routeLabels),[]);const nodes=root=>[root,...root.children.flatMap(nodes)];for(const node of nodes(app.mount)){assert.doesNotMatch(node.textContent,/\p{Script=Han}/u);for(const [key,value] of Object.entries(node.attributes))if(['aria-label','title','placeholder'].includes(key))assert.doesNotMatch(value,/\p{Script=Han}/u);}}finally{wait.resolve();app?.dispose();englishModules['./ruined-depot-loader.js']=old;englishModules['./player-occlusion.js']=oldOcclusion;}
});

test('source remedy is new-mission-only: old V4 and scan still execute their original floating-label projector',async()=>{
 for(const search of ['?sortie=crossfire-v4','?sortie=scanned-cover']){const {app,b}=await launch({},search);try{await settle();app.uiActions.start();app.frame();assert.ok(b.routeProjectionCalls>0);}finally{app.dispose();}}
});

test('all five original chassis choices remain available in new briefing and keep cached app art',async()=>{
 const {app,b}=await launch();try{await settle();assert.equal(app.uiActions.playerVehicles.length,5);assert.equal(app.mount.querySelectorAll('[data-vehicle-id]').length,5);for(const vehicle of app.uiActions.playerVehicles){app.uiActions.selectPlayerVehicle(vehicle.id);await settle();assert.equal(app.latest.spec.id,'mission-9070');assert.equal(app.latest.spec.playerVehicle.id,vehicle.id);assert.equal(app.latest.status.viewStatus,'ready');}assert.equal(b.calls.filter(c=>c.startsWith('ruin-load')).length,1);}finally{app.dispose();}assert.equal(b.libraries[0].disposes,1);
});
