import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,action,selectOptional,makeStorage,legacyStorageBytes,CURRENT_PROGRESS_KEY} from './main-entry-harness.mjs';
import {PROGRESS_KEY} from '../src/session.js';
import {listCraftedMissions,getCraftedMission} from '../src/content/crafted20/index.js';

// This runs main's body with its actual import paths/aliases resolved. Reverting
// its production catalog or omitting its explicit save key must fail these tests.
test('production entry defaults to the twenty authored records without reading or rewriting archived progress',async t=>{
 const storage=makeStorage();storage.values.delete(CURRENT_PROGRESS_KEY);
 const app=await boot('',storage);t.after(()=>app.dispose());
 assert.equal(app.latest.spec,getCraftedMission('crafted20-001'));
 assert.deepEqual(app.latest.progress.unlockedIds,['crafted20-001']);
 assert.deepEqual(storage.reads,[CURRENT_PROGRESS_KEY,CURRENT_PROGRESS_KEY]); // Load, then merge-before-save.
 assert.deepEqual(storage.writes.map(write=>write.key),[CURRENT_PROGRESS_KEY]);
 assert.equal(storage.values.get(PROGRESS_KEY),legacyStorageBytes);
 assert.match(app.mount.querySelector('.campaign-eyebrow').textContent,/1\s*\/\s*20/);
 action(app,'open-missions').dispatch('click');
 assert.match(app.mount.querySelector('.campaign-dialog__title').textContent,/20/);
 const section=app.mount.querySelector('.campaign-optional-section');
 assert.match(section.querySelector('h2').textContent,/旧版/);assert.match(section.querySelector('p').textContent,/不计入.*20/);
 const dialog=app.mount.querySelector('.campaign-dialog'),grid=app.mount.querySelector('[data-mission-id]').parentElement;
 assert.ok(dialog.children.indexOf(section)>dialog.children.indexOf(grid),'new campaign comes before legacy extras');
 const ids=[];
 do{ids.push(...app.mount.querySelectorAll('[data-mission-id]').map(node=>node.getAttribute('data-mission-id')));const next=action(app,'next-page');if(next.disabled)break;next.dispatch('click');}while(true);
 assert.deepEqual(ids,listCraftedMissions().map(mission=>mission.id));assert.equal(ids.length,20);
});

test('production progression saves only new IDs, resumes, and stops at authored mission twenty',async t=>{
 const storage=makeStorage();storage.values.delete(CURRENT_PROGRESS_KEY);
 const app=await boot('',storage);t.after(()=>app.dispose());
 // Terminal override checks entry/progression orchestration, NOT combat wins.
 for(let index=1;index<=20;index++){
  const id=`crafted20-${String(index).padStart(3,'0')}`;
  assert.equal(app.latest.spec.id,id);action(app,'start').dispatch('click');app.terminalOnNextFrame();app.frame();
  assert.equal(app.latest.state.phase,'won');assert.ok(app.latest.progress.bestResults[id]);
  const next=app.mount.querySelector('[data-action="next-mission"]');
  if(index<20){assert.ok(next);next.dispatch('click');}else assert.equal(next,null);
 }
 assert.equal(app.latest.progress.unlockedIds.length,20);
 assert.ok(storage.writes.every(write=>write.key===CURRENT_PROGRESS_KEY));
 assert.equal(storage.values.get(PROGRESS_KEY),legacyStorageBytes);
 const reload=await boot('',storage);t.after(()=>reload.dispose());
 assert.equal(reload.latest.spec.id,'crafted20-020');assert.equal(Object.keys(reload.latest.progress.bestResults).length,20);
});

test('legacy optional sorties cannot write either campaign save and return to authored selections',async t=>{
 const storage=makeStorage(),before=[...storage.values];
 const app=await boot('?sortie=breach-cover',storage);t.after(()=>app.dispose());
 assert.match(app.mount.querySelector('.campaign-eyebrow').textContent,/旧版/);
 action(app,'start').dispatch('click');app.terminalOnNextFrame();app.frame();action(app,'retry').dispatch('click');selectOptional(app,'warehouse-fork');
 assert.deepEqual([...storage.values],before);assert.equal(storage.writes.length,0);
 app.uiActions.selectMission('mission-001');assert.equal(app.latest.spec.id,'mission-9001');
 app.uiActions.selectMission('crafted20-001');assert.equal(app.latest.spec,getCraftedMission('crafted20-001'));
 assert.equal(storage.values.get(PROGRESS_KEY),legacyStorageBytes);assert.equal(app.location.search,'');
 const reload=await boot('',storage);t.after(()=>reload.dispose());assert.equal(reload.latest.spec.id,'crafted20-001');
});

for(const raw of ['not JSON',JSON.stringify({schema:1,selectedMissionId:'mission-207',unlockedIds:['mission-001','mission-207'],bestResults:{'mission-207':{ticks:1,hp:100}}})])test(`invalid or old IDs in authored slot start fresh: ${raw.slice(0,20)}`,async t=>{
 const storage=makeStorage();storage.values.set(CURRENT_PROGRESS_KEY,raw);
 const app=await boot('?sortie=unknown',storage);t.after(()=>app.dispose());
 assert.equal(app.latest.spec.id,'crafted20-001');assert.deepEqual(app.latest.progress.unlockedIds,['crafted20-001']);assert.deepEqual(app.latest.progress.bestResults,{});
 assert.equal(storage.values.get(PROGRESS_KEY),legacyStorageBytes);
});

test('main loads one shared art kit and forwards the actual renderer texture capability across selections',async t=>{
 const app=await boot();t.after(()=>app.dispose());
 assert.equal(app.metrics.artLoads,1);assert.ok(app.metrics.viewOptions.artKit);
 assert.equal(app.metrics.viewOptions.terrain.maxAnisotropy,4);
 const kit=app.metrics.viewOptions.artKit;
 app.uiActions.selectMission('crafted20-001');assert.equal(app.metrics.viewOptions.artKit,kit);assert.equal(app.metrics.artLoads,1);
 app.dispose();assert.equal(app.metrics.artDisposes,1);
});

test('active texture failure blocks launch and displays a recoverable error; stale failures cannot break a new world',async t=>{
 const pending=[];
 const app=await boot('',makeStorage(),{viewReady:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))});t.after(()=>app.dispose());
 app.uiActions.selectMission('crafted20-001');pending[0].reject(new Error('stale texture failure'));
 await new Promise(resolve=>setImmediate(resolve));assert.equal(app.errors.length,0);assert.equal(app.help.hidden,true);
 action(app,'start').dispatch('click');pending[1].reject(new Error('active texture failure'));
 await new Promise(resolve=>setImmediate(resolve));assert.equal(app.latest.state.phase,'briefing');assert.match(app.mount.querySelector('.campaign-resource-status').textContent,/active texture failure/);assert.equal(app.help.hidden,true);
});

test('art loader failure is a visible boot error rather than a silent primitive fallback',async()=>{
 const app=await boot('',makeStorage(),{artError:new Error('embedded art decode failed'),expectBootFailure:true});
 assert.equal(app.help.hidden,false);assert.match(app.help.querySelector('details').querySelector('pre').textContent,/embedded art decode failed/);assert.equal(app.metrics.worldCreates,0);
});

test('blocked authored storage never falls back to old saves and remains playable with an unsaved warning',async t=>{
 const storage=makeStorage(),reads=[],writes=[];
 storage.getItem=key=>{reads.push(key);throw new Error('storage denied');};
 storage.setItem=key=>{writes.push(key);throw new Error('quota exceeded');};
 const app=await boot('',storage);t.after(()=>app.dispose());
 assert.equal(app.latest.spec.id,'crafted20-001');assert.equal(app.latest.progress.storageAvailable,false);
 assert.deepEqual(reads,[CURRENT_PROGRESS_KEY,CURRENT_PROGRESS_KEY]);assert.deepEqual(writes,[]); // No blind write after failed merge read.
 assert.equal(storage.values.get(PROGRESS_KEY),legacyStorageBytes);
 action(app,'start').dispatch('click');assert.equal(app.latest.state.phase,'playing');assert.equal(app.mount.querySelector('.campaign-save-status').hidden,false);
});

test('a texture rejection after whole-page disposal cannot reopen the error overlay',async()=>{
 let reject;const app=await boot('',makeStorage(),{viewReady:()=>new Promise((resolve,rejectReady)=>{reject=rejectReady;})});
 app.dispose();reject(new Error('disposed texture failure'));
 await new Promise(resolve=>setImmediate(resolve));assert.equal(app.errors.length,0);assert.equal(app.help.hidden,true);assert.equal(app.metrics.artDisposes,1);
});


test('loading and failed views gate start/resume; retry clears failure and only resolved current resources enable play',async t=>{
 const pending=[];const app=await boot('',makeStorage(),{viewReady:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))});t.after(()=>app.dispose());
 assert.equal(action(app,'start').disabled,true);app.uiActions.start();app.uiActions.resume();assert.equal(app.latest.state.phase,'briefing');assert.equal(app.metrics.inputEnabled,false);
 pending[0].reject(new Error('test texture unavailable'));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(action(app,'start').disabled,true);app.uiActions.start();app.uiActions.resume();assert.equal(app.latest.state.phase,'briefing');assert.equal(app.metrics.inputEnabled,false);
 assert.match(app.mount.querySelector('.campaign-resource-status').textContent,/test texture unavailable/);assert.equal(app.help.hidden,true);
 action(app,'retry').dispatch('click');assert.equal(app.latest.state.phase,'briefing');assert.equal(action(app,'start').disabled,true);
 assert.doesNotMatch(app.mount.querySelector('.campaign-resource-status').textContent,/test texture unavailable/);
 pending[1].resolve();await new Promise(resolve=>setImmediate(resolve));assert.equal(action(app,'start').disabled,false);assert.equal(app.mount.querySelector('.campaign-resource-status'),null);
 action(app,'start').dispatch('click');assert.equal(app.latest.state.phase,'playing');assert.equal(app.metrics.inputEnabled,true);
 action(app,'pause').dispatch('click');action(app,'resume').dispatch('click');assert.equal(app.latest.state.phase,'playing');
});

// Startup lifetime cases first reproduced independently by the entry reviewer.
test('tank load rejection frees the already-loaded art library and renderer',async()=>{
 const app=await boot('',makeStorage(),{tankError:new Error('tank decode failed'),expectBootFailure:true});
 assert.match(app.help.querySelector('details').querySelector('pre').textContent,/tank decode failed/);assert.equal(app.metrics.worldCreates,0);
 assert.equal(app.metrics.artDisposes,1);assert.equal(app.metrics.rendererDisposes,1);
});
for(const phase of ['art','tank'])test(`permanent pagehide during ${phase} load prevents orphan worlds and disposes late resources`,async()=>{
 let resolve;const gate=new Promise(done=>{resolve=done;}),storage=makeStorage();
 const app=await boot('',storage,{[`${phase}Ready`]:gate,expectBootFailure:true});
 assert.equal(app.latest,undefined);app.dispose();resolve();await new Promise(done=>setImmediate(done));
 assert.equal(app.metrics.worldCreates,0);assert.equal(storage.writes.length,0);assert.equal(app.metrics.framesScheduled||0,0);
 assert.equal(app.metrics.artDisposes,1);assert.equal(app.metrics.rendererDisposes,1);
});
test('an art rejection after permanent pagehide is canceled without reopening a boot failure',async()=>{
 let reject;const gate=new Promise((resolve,fail)=>{reject=fail;});
 const app=await boot('',makeStorage(),{artReady:gate,expectBootFailure:true});app.dispose();reject(new Error('late art failure'));
 await new Promise(done=>setImmediate(done));assert.equal(app.errors.length,0);assert.equal(app.metrics.worldCreates,0);assert.equal(app.metrics.rendererDisposes,1);
});

test('first authored objective and off-screen bearing name the actual corner threat, not an unexplained gate',async t=>{
 const storage=makeStorage();storage.values.delete(CURRENT_PROGRESS_KEY);
 const app=await boot('',storage);t.after(()=>app.dispose());
 assert.match(app.mount.querySelector('.campaign-brief-objective').textContent,/清除仓库转角的火力点/);
 action(app,'start').dispatch('click');app.frame();
 assert.match(app.mount.querySelector('.campaign-objective').textContent,/清除仓库转角的火力点/);
 assert.match(app.mount.querySelector('.campaign-bearing').textContent,/清除仓库转角的火力点 [→↘↓↙←↖↑↗] \d+ m/);
});
