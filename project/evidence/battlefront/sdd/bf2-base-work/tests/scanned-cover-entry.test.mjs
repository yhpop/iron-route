/** Actual main body and real simulation; explicit fake GLB/GPU artwork boundary. Not visual evidence. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {boot,makeStorage} from './main-entry-harness.mjs';
const settle=()=>new Promise(r=>setImmediate(r));
function boundary({ready=Promise.resolve(),error}={}){const calls=[];return {calls,loadModule:async path=>path==='./scanned-cover-loader.js'?{loadScannedCoverLibrary:async()=>{calls.push('load');const attempt=calls.filter(c=>c==='load').length;await (typeof ready==='function'?ready(attempt):ready);const failure=typeof error==='function'?error(attempt):error;if(failure)throw failure;return {dispose(){calls.push('library-dispose');}};}}:path==='./scanned-cover-view.js'?{applyScannedCoverView(_scene,spec){assert.equal(spec.scannedCover,true);calls.push('decorate');return {dispose(){calls.push('decorator-dispose');}};}}:path==='./player-model-loader.js'?{loadPlayerModel:async()=>({root:{visible:true},update(){},dispose(){}})}:path==='./interceptor-art-loader.js'?{attachInterceptorArt:async base=>({...base,diagnostics:{communityVehicles:1}})}:import(new URL(path,new URL('../src/main.js',import.meta.url)))};}
test('actual entry opts into scanned mission; artwork installed before ready, retry reuses library, teardown owns it',async()=>{const b=boundary(),storage=makeStorage(),before=[...storage.values],app=await boot('?sortie=scanned-cover',storage,b);try{await settle();assert.equal(app.latest.spec.id,'mission-9060');assert.equal(app.latest.spec.playerVehicle.id,'sandfalcon');assert.equal(app.latest.status.viewStatus,'ready');assert.deepEqual(b.calls,['load','decorate']);app.uiActions.retry();await settle();assert.deepEqual(b.calls,['load','decorate','decorator-dispose','decorate']);assert.deepEqual([...storage.values],before);}finally{app.dispose();}assert.deepEqual(b.calls.slice(-2),['decorator-dispose','library-dispose']);});
test('old default and V4 startup never request scan library',async()=>{for(const search of ['','?sortie=crossfire-v4']){const b=boundary(),app=await boot(search,undefined,b);try{assert.notEqual(app.latest.spec.id,'mission-9060');assert.deepEqual(b.calls,[]);}finally{app.dispose();}}});
test('pending scan load gates start and canceled application disposes late library without decorating',async()=>{let resolve;const b=boundary({ready:new Promise(r=>resolve=r)}),app=await boot('?sortie=scanned-cover',undefined,b);assert.equal(app.latest.status.viewStatus,'loading');app.uiActions.start();assert.equal(app.latest.state.phase,'briefing');app.dispose();resolve();await settle();assert.deepEqual(b.calls,['load','library-dispose']);});
test('scan load error fails closed and never enables start',async()=>{let resolve;const b=boundary({ready:new Promise(r=>resolve=r),error:new Error('scan maps missing')}),app=await boot('?sortie=scanned-cover',undefined,b);resolve();await settle();assert.equal(app.latest.status.viewStatus,'failed');app.uiActions.start();assert.equal(app.latest.state.phase,'briefing');assert.deepEqual(b.calls,['load']);app.dispose();});
test('production lazy boundary dynamically imports embedded scan; decorator disposed ahead of wall owner',()=>{const loader=readFileSync(new URL('../src/scanned-cover-loader.js',import.meta.url),'utf8'),main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');assert.match(loader,/import\(['"]\.\/scanned-cover-embedded.js['"]\)/);assert.match(main,/scanView\?\.dispose\(\);.*worldView\?\.dispose\(\)/);});
test('English inventory covers opt-in title without changing source Chinese',async()=>{const {translateEnglishSource}=await import('../scripts/english-localization.mjs');const source=readFileSync(new URL('../src/scanned-cover-front.js',import.meta.url),'utf8');assert.match(translateEnglishSource('src/scanned-cover-front.js',source),/Scanned Concrete Cover/);assert.match(source,/实景混凝土/);});
test('switching away during pending scan never decorates replacement mission',async()=>{let resolve;const b=boundary({ready:new Promise(r=>resolve=r)}),app=await boot('?sortie=scanned-cover',undefined,b);app.uiActions.selectMission('crafted20-002');resolve();await settle();assert.equal(app.latest.spec.id,'crafted20-002');assert.equal(app.latest.status.viewStatus,'ready');assert.deepEqual(b.calls,['load']);app.dispose();assert.deepEqual(b.calls,['load','library-dispose']);});

// A cached rejection must not make Retry permanently fail; successful and pending loads remain shared.
for(const failures of [1,2])test(`actual main retries ${failures} failed scan load(s), reaches ready and reuses success`,async()=>{
 let release;const b=boundary({ready:new Promise(r=>release=r),error:n=>n<=failures?new Error('transient scan failure'):null});
 const app=await boot('?sortie=scanned-cover',undefined,b);
 try{release();await settle();for(let n=1;n<=failures;n++){
  assert.equal(app.latest.status.viewStatus,'failed');app.uiActions.start();assert.equal(app.latest.state.phase,'briefing');assert.equal(app.metrics.inputEnabled,false);
  assert.equal(b.calls.filter(c=>c==='load').length,n);app.uiActions.retry();await settle();
 }
 assert.equal(app.latest.status.viewStatus,'ready');assert.equal(b.calls.filter(c=>c==='load').length,failures+1);
 app.uiActions.retry();await settle();assert.equal(app.latest.status.viewStatus,'ready');assert.equal(b.calls.filter(c=>c==='load').length,failures+1);
 app.uiActions.start();assert.equal(app.latest.state.phase,'playing');
 }finally{app.dispose();}assert.equal(b.calls.filter(c=>c==='library-dispose').length,1);
});
test('Retry while scan is pending shares one load and only latest selection decorates',async()=>{
 let release;const b=boundary({ready:new Promise(r=>release=r)}),app=await boot('?sortie=scanned-cover',undefined,b);
 try{app.uiActions.retry();app.uiActions.retry();assert.equal(app.latest.status.viewStatus,'loading');release();await settle();assert.equal(app.latest.status.viewStatus,'ready');assert.deepEqual(b.calls,['load','decorate']);}finally{app.dispose();}
});
for(const cancel of ['dispose','selection'])test(`failed-load retry pending ${cancel} race cannot decorate stale world`,async()=>{
 let first,second;const gates=[new Promise(r=>first=r),new Promise(r=>second=r)];const b=boundary({ready:n=>gates[n-1],error:n=>n===1?new Error('first scan failure'):null});
 const app=await boot('?sortie=scanned-cover',undefined,b);
 try{first();await settle();assert.equal(app.latest.status.viewStatus,'failed');app.uiActions.retry();await settle();assert.equal(app.latest.status.viewStatus,'loading');assert.equal(b.calls.filter(c=>c==='load').length,2);
 if(cancel==='dispose')app.dispose();else app.uiActions.selectMission('crafted20-002');second();await settle();assert.equal(b.calls.includes('decorate'),false);
 if(cancel==='selection'){assert.equal(app.latest.spec.id,'crafted20-002');assert.equal(app.latest.status.viewStatus,'ready');assert.equal(b.calls.includes('library-dispose'),false);}
 }finally{second();await settle();app.dispose();}assert.equal(b.calls.filter(c=>c==='library-dispose').length,1);
});
