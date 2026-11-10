import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,action,selectOptional,makeStorage,storageBytes,fixture} from './main-entry-harness.mjs';
import {getOptionalMission} from '../src/content/optional-records.js';
import {listCraftedMissions as listMissions} from '../src/content/crafted20/index.js';
import {PROGRESS_NAMESPACE as PROGRESS_KEY} from '../src/content/crafted20/index.js';

for(const slug of ['warehouse-fork','breach-cover']){
 test(`actual main: discover ${slug}, retain optional retry/close, then refresh explicit normal choice`,async t=>{
  const storage=makeStorage(),app=await boot('?raw=a%20b&keep=%2f#resume',storage);t.after(()=>app.dispose());
  assert.equal(app.historyCalls.length,0,'boot never rewrites URL');const initialWrites=storage.writes.length;
  selectOptional(app,slug);assert.equal(app.latest.spec,getOptionalMission(slug));assert.equal(storage.writes.length,initialWrites);
  assert.equal(app.location.search,`?raw=a%20b&keep=%2f&sortie=${slug}`);assert.equal(app.historyCalls.length,1);assert.equal(app.location.hash,'#resume');
  const optionalReload=await boot(app.location.search+app.location.hash,storage);assert.equal(optionalReload.latest.spec.id,app.latest.spec.id);assert.equal(optionalReload.historyCalls.length,0);optionalReload.dispose();
  action(app,'start').dispatch('click');assert.equal(app.latest.state.phase,'playing');assert.equal(app.metrics.inputEnabled,true);assert.equal(app.metrics.audioPaused,false);
  app.window.dispatch('keydown',{code:'Escape'});assert.equal(app.latest.state.phase,'paused');assert.equal(app.metrics.inputEnabled,false);
  action(app,'retry').dispatch('click');assert.equal(app.latest.state.phase,'briefing');assert.equal(app.latest.spec,getOptionalMission(slug));assert.equal(app.metrics.audioPaused,true);
  const beforeClose=app.latest.state;action(app,'open-missions').dispatch('click');action(app,'close-missions').dispatch('click');assert.equal(app.latest.state,beforeClose);assert.equal(app.historyCalls.length,1);
  action(app,'open-missions').dispatch('click');app.mount.querySelector('[data-mission-id="crafted20-001"]').dispatch('click');
  assert.equal(app.latest.spec.id,'crafted20-001');assert.equal(app.location.search,'?raw=a%20b&keep=%2f');assert.equal(app.historyCalls.length,2);
  assert.equal(storage.writes.length,initialWrites+1);assert.equal(JSON.parse(storage.values.get(PROGRESS_KEY)).selectedMissionId,'crafted20-001');
  const reload=await boot(app.location.search+app.location.hash,storage);assert.equal(reload.latest.spec.id,'crafted20-001');assert.equal(reload.historyCalls.length,0);reload.dispose();
  assert.ok(app.metrics.worldDisposes>=2);assert.ok(app.metrics.inputResets>=4);
 });
 test(`actual main: ${slug} commands and synthetic terminal classification preserve exact optional storage bytes`,async t=>{
  const storage=makeStorage(),app=await boot(`?sortie=${slug}`,storage);t.after(()=>app.dispose());
  action(app,'start').dispatch('click');app.terminalOnNextFrame();app.frame();assert.equal(app.latest.state.phase,'won');
  assert.equal(app.mount.querySelector('[data-action="next-mission"]'),null);action(app,'retry').dispatch('click');
  assert.equal(storage.writes.length,0);assert.equal(storage.values.get(PROGRESS_KEY),storageBytes);assert.equal(storage.values.get('legacy-unrelated'),' exact legacy bytes \n');
  assert.deepEqual(app.latest.progress.unlockedIds,fixture.unlockedIds);assert.deepEqual(app.latest.progress.bestResults,{});assert.equal(app.historyCalls.length,0);
  app.uiActions.selectMission('crafted20-002');action(app,'start').dispatch('click');app.terminalOnNextFrame();app.frame();assert.equal(app.latest.state.phase,'won');
  assert.deepEqual(app.latest.progress.unlockedIds,['crafted20-001','crafted20-002','crafted20-003']);assert.ok(app.latest.progress.bestResults['crafted20-002']);assert.equal(storage.writes.length,2);
 });
}

test('actual main: all 20 authored cards stay paginated independently of two optional cards',async t=>{
 const app=await boot();t.after(()=>app.dispose());action(app,'open-missions').dispatch('click');
 const ids=[];let pages=0;
 while(true){pages++;ids.push(...app.mount.querySelectorAll('[data-mission-id]').map(card=>card.getAttribute('data-mission-id')));assert.equal(app.mount.querySelectorAll('[data-optional-slug]').length,2);const next=action(app,'next-page');if(next.disabled)break;next.dispatch('click');assert.ok(pages<=2);}
 assert.equal(pages,2);assert.deepEqual(ids,listMissions().map(spec=>spec.id));assert.deepEqual(app.mount.querySelector('select').children.map(option=>option.value),['all','1','2','3','4']);assert.equal(app.historyCalls.length,0);
});

test('actual main: invalid optional and locked/unknown normal selections have no world/storage/history effects',async t=>{
 const app=await boot('?sortie=breach-cover');t.after(()=>app.dispose());
 assert.equal(typeof app.uiActions.selectOptionalMission,'function');const current=app.latest,creates=app.metrics.worldCreates;
 for(const slug of ['missing','__proto__','constructor','',null])app.uiActions.selectOptionalMission(slug);
 for(const id of ['crafted20-003','missing','mission-9001'])app.uiActions.selectMission(id);
 assert.equal(app.latest,current);assert.equal(app.metrics.worldCreates,creates);assert.equal(app.storage.writes.length,0);assert.equal(app.historyCalls.length,0);
});

test('actual main: repeated optional switches replace entry without stale controls or normal writes',async t=>{
 const app=await boot('?sortie=breach-cover&sortie=warehouse-fork&x=%2F#stay');t.after(()=>app.dispose());
 const writes=app.storage.writes.length;
 for(const slug of ['warehouse-fork','breach-cover','warehouse-fork']){selectOptional(app,slug);assert.equal(app.latest.spec,getOptionalMission(slug));assert.equal(app.latest.state.phase,'briefing');assert.equal(app.metrics.inputEnabled,false);assert.equal(app.metrics.audioPaused,true);assert.equal(app.location.search,`?x=%2F&sortie=${slug}`);}
 assert.equal(app.storage.writes.length,writes);assert.equal(app.historyCalls.length,3);assert.ok(app.metrics.inputResets>=4);
});

for(const failure of ['historyThrows','historyUnavailable'])test(`actual main: ${failure} warns without blocking play, retry retains warning and successful selection clears it`,async t=>{
 const app=await boot('?sortie=breach-cover#stay',makeStorage(),{[failure]:true});t.after(()=>app.dispose());
 app.uiActions.selectMission('crafted20-001');assert.equal(app.latest.spec.id,'crafted20-001');
 const warning=()=>app.mount.querySelector('.campaign-entry-warning');assert.match(warning()?.textContent||'',/刷新.*原|刷新.*之前/);assert.doesNotMatch(warning().textContent,/进度.*保存/);
 action(app,'start').dispatch('click');assert.equal(app.latest.state.phase,'playing');app.window.dispatch('keydown',{code:'Escape'});action(app,'retry').dispatch('click');assert.ok(warning());
 action(app,'open-missions').dispatch('click');assert.ok(warning());action(app,'close-missions').dispatch('click');assert.ok(warning());
 app.options.historyThrows=false;app.history.replaceState=function(state,title,url){app.historyCalls.push({state,title,url});app.location.href=new URL(url,app.location).href;};
 app.uiActions.selectMission('crafted20-001');assert.equal(warning(),null);assert.equal(app.location.search,'');assert.equal(app.location.hash,'#stay');
 assert.equal(Object.hasOwn(JSON.parse(app.storage.values.get(PROGRESS_KEY)),'entryWarning'),false);
});

for(const slug of ['warehouse-fork','breach-cover'])test(`actual main: normal selection from ${slug} removes stale sortie before fresh boot`,async t=>{
 const storage=makeStorage(),app=await boot(`?keep=a%20b&sortie=${slug}#resume`,storage);t.after(()=>app.dispose());
 action(app,'open-missions').dispatch('click');app.mount.querySelector('[data-mission-id="crafted20-001"]').dispatch('click');
 assert.equal(app.latest.spec.id,'crafted20-001');assert.equal(app.location.search,'?keep=a%20b');assert.equal(app.historyCalls.length,1);
 const reload=await boot(app.location.search+app.location.hash,storage);assert.equal(reload.latest.spec.id,'crafted20-001');reload.dispose();
});

test('actual main and real input: changing optional selection clears held driving, boost and queued fire',async t=>{
 const app=await boot('?sortie=breach-cover');t.after(()=>app.dispose());
 for(const slug of ['warehouse-fork','breach-cover','warehouse-fork']){
  action(app,'start').dispatch('click');app.window.dispatch('keydown',{code:'KeyW'});app.window.dispatch('keydown',{code:'ShiftLeft'});app.window.dispatch('keydown',{code:'KeyF'});
  app.uiActions.selectOptionalMission(slug);assert.equal(app.latest.state.phase,'briefing');assert.equal(app.metrics.inputEnabled,false);
  action(app,'start').dispatch('click');app.frame();assert.equal(app.metrics.lastControls.throttle,0);assert.equal(app.metrics.lastControls.boost,false);assert.equal(app.metrics.lastControls.firePressed,false);
  app.window.dispatch('keydown',{code:'Escape'});action(app,'retry').dispatch('click');
 }
 assert.equal(app.storage.writes.length,0);
});
