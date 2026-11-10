import test from 'node:test';
import assert from 'node:assert/strict';
import {loadProgress,recordWin,saveProgress,PROGRESS_KEY} from '../src/session.js';
import {listCraftedMissions,PROGRESS_NAMESPACE} from '../src/content/crafted20/index.js';
import {boot,action,makeStorage,legacyStorageBytes} from './main-entry-harness.mjs';

const missions=listCraftedMissions();
function storageFixture(entries=[]){
 const values=new Map(entries),reads=[],writes=[];
 return {values,reads,writes,getItem(key){reads.push(key);return values.get(key)??null;},setItem(key,value){writes.push(key);values.set(key,String(value));}};
}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

test('stale sequential save retains earlier tabs unlocks and wins while applying latest selection',()=>{
 const storage=storageFixture();
 let tabA=loadProgress(storage,missions,PROGRESS_NAMESPACE);
 const tabB=freeze(loadProgress(storage,missions,PROGRESS_NAMESPACE));
 tabA=recordWin(tabA,'crafted20-001',{ticks:200,hp:90},missions);
 assert.equal(saveProgress(storage,tabA,PROGRESS_NAMESPACE),true);
 tabA=recordWin(tabA,'crafted20-002',{ticks:300,hp:70},missions);
 tabA.selectedMissionId='crafted20-003';
 assert.equal(saveProgress(storage,tabA,PROGRESS_NAMESPACE),true);
 assert.equal(saveProgress(storage,tabB,PROGRESS_NAMESPACE),true);
 assert.deepEqual(loadProgress(storage,missions,PROGRESS_NAMESPACE),{
  schema:1,unlockedIds:['crafted20-001','crafted20-002','crafted20-003'],
  bestResults:{'crafted20-001':{ticks:200,hp:90},'crafted20-002':{ticks:300,hp:70}},selectedMissionId:'crafted20-001'
 });
 assert.deepEqual(tabB,{schema:1,unlockedIds:['crafted20-001'],bestResults:{},selectedMissionId:'crafted20-001'});
});

test('merge chooses one complete faster win, preserves stored ties, unions distinct wins and leaves caller untouched',()=>{
 const stored={schema:1,unlockedIds:['crafted20-001','crafted20-002','crafted20-003'],selectedMissionId:'crafted20-002',bestResults:{
  'crafted20-001':{ticks:100,hp:20},'crafted20-002':{ticks:300,hp:95},'crafted20-003':{ticks:500,hp:30}
 }};
 const storage=storageFixture([[PROGRESS_NAMESPACE,JSON.stringify(stored)]]);
 const incoming=freeze({schema:1,unlockedIds:['crafted20-001','crafted20-004'],selectedMissionId:'crafted20-004',bestResults:{
  'crafted20-001':{ticks:150,hp:99},'crafted20-002':{ticks:200,hp:40},'crafted20-003':{ticks:500,hp:90},'crafted20-004':{ticks:600,hp:80}
 },storageAvailable:true,goalHint:'not persistent'});
 const before=JSON.stringify(incoming);
 assert.equal(saveProgress(storage,incoming,PROGRESS_NAMESPACE),true);
 assert.deepEqual(JSON.parse(storage.values.get(PROGRESS_NAMESPACE)),{
  schema:1,unlockedIds:['crafted20-001','crafted20-002','crafted20-003','crafted20-004'],selectedMissionId:'crafted20-004',bestResults:{
   'crafted20-001':{ticks:100,hp:20},'crafted20-002':{ticks:200,hp:40},'crafted20-003':{ticks:500,hp:30},'crafted20-004':{ticks:600,hp:80}
  }
 });
 assert.equal(JSON.stringify(incoming),before);
});

test('crafted save reads and writes only its namespace, preserving old303 and rescue bytes',()=>{
 const storage=storageFixture([[PROGRESS_KEY,legacyStorageBytes],['embers-salvage:local-voyage','  rescue bytes\n']]);
 const progress=loadProgress(storage,missions,PROGRESS_NAMESPACE);
 assert.equal(saveProgress(storage,progress,PROGRESS_NAMESPACE),true);
 assert.deepEqual(storage.reads,[PROGRESS_NAMESPACE,PROGRESS_NAMESPACE]);
 assert.deepEqual(storage.writes,[PROGRESS_NAMESPACE]);
 assert.equal(storage.values.get(PROGRESS_KEY),legacyStorageBytes);
 assert.equal(storage.values.get('embers-salvage:local-voyage'),'  rescue bytes\n');
 assert.deepEqual(JSON.parse(storage.values.get(PROGRESS_NAMESPACE)).unlockedIds,['crafted20-001']);
});

test('unreadable or missing storage refuses a blind write and leaves caller unchanged',()=>{
 const progress=freeze(loadProgress(null,missions,PROGRESS_NAMESPACE));let writes=0;
 const unreadable={getItem(){throw Error('read denied');},setItem(){writes++;}};
 const writeOnly={setItem(){writes++;}};
 assert.equal(saveProgress(unreadable,progress,PROGRESS_NAMESPACE),false);
 assert.equal(saveProgress(writeOnly,progress,PROGRESS_NAMESPACE),false);
 assert.equal(saveProgress(null,progress,PROGRESS_NAMESPACE),false);
 assert.equal(writes,0);
 assert.deepEqual(progress.unlockedIds,['crafted20-001']);
});

test('failed writes report unsaved without changing stored bytes or caller state',()=>{
 const stored='  '+JSON.stringify({schema:1,unlockedIds:['crafted20-001','crafted20-002'],bestResults:{'crafted20-001':{ticks:20,hp:30}},selectedMissionId:'crafted20-002'})+'\n';
 const storage=storageFixture([[PROGRESS_NAMESPACE,stored]]);
 storage.setItem=()=>{throw Error('quota');};
 const incoming=freeze(loadProgress(null,missions,PROGRESS_NAMESPACE));
 assert.equal(saveProgress(storage,incoming,PROGRESS_NAMESPACE),false);
 assert.equal(storage.values.get(PROGRESS_NAMESPACE),stored);
 assert.deepEqual(incoming.bestResults,{});
});

for(const raw of ['{broken','null','[]','42',JSON.stringify({schema:2,unlockedIds:['crafted20-020'],bestResults:{'crafted20-001':{ticks:1,hp:100}}})]){
 test(`unusable stored document can be replaced with valid current progress: ${raw.slice(0,35)}`,()=>{
  const storage=storageFixture([[PROGRESS_NAMESPACE,raw]]),incoming=freeze(loadProgress(null,missions,PROGRESS_NAMESPACE));
  assert.equal(saveProgress(storage,incoming,PROGRESS_NAMESPACE),true);
  assert.deepEqual(JSON.parse(storage.values.get(PROGRESS_NAMESPACE)),incoming);
 });
}

test('malformed stored fields do not erase valid schema-1 unlocks and records',()=>{
 const storage=storageFixture([[PROGRESS_NAMESPACE,JSON.stringify({schema:1,
  unlockedIds:['crafted20-002',null,3,'crafted20-002',''],selectedMissionId:'crafted20-020',bestResults:{
   'crafted20-001':{ticks:200,hp:70},'crafted20-002':{ticks:-1,hp:100},'crafted20-003':{ticks:'10',hp:100},'crafted20-004':null,'crafted20-005':{ticks:30,hp:'bad'}
  }
 })]]);
 const incoming=freeze(loadProgress(null,missions,PROGRESS_NAMESPACE));
 assert.equal(saveProgress(storage,incoming,PROGRESS_NAMESPACE),true);
 const saved=loadProgress(storage,missions,PROGRESS_NAMESPACE);
 assert.deepEqual(saved,{schema:1,unlockedIds:['crafted20-001','crafted20-002'],selectedMissionId:'crafted20-001',bestResults:{'crafted20-001':{ticks:200,hp:70}}});
 const raw=JSON.parse(storage.values.get(PROGRESS_NAMESPACE));
 assert.deepEqual(raw.unlockedIds,['crafted20-002','crafted20-001']);
 assert.deepEqual(raw.bestResults,{'crafted20-001':{ticks:200,hp:70}});
});

for(const staleAction of ['retry','select'])test(`actual main: stale tab ${staleAction} preserves two previously persisted wins`,async t=>{
 const storage=makeStorage();storage.values.delete(PROGRESS_NAMESPACE);
 const tabA=await boot('',storage),tabB=await boot('',storage);
 t.after(()=>{tabA.dispose();tabB.dispose();});
 for(const id of ['crafted20-001','crafted20-002']){
  tabA.uiActions.selectMission(id);action(tabA,'start').dispatch('click');tabA.terminalOnNextFrame();tabA.frame();
  assert.equal(tabA.latest.state.phase,'won');
 }
 const before=JSON.parse(storage.values.get(PROGRESS_NAMESPACE));
 assert.deepEqual(before.unlockedIds,['crafted20-001','crafted20-002','crafted20-003']);
 assert.deepEqual(Object.keys(before.bestResults),['crafted20-001','crafted20-002']);
 if(staleAction==='retry'){action(tabB,'start').dispatch('click');tabB.window.dispatch('keydown',{code:'Escape'});action(tabB,'retry').dispatch('click');}
 else tabB.uiActions.selectMission('crafted20-001');
 const after=JSON.parse(storage.values.get(PROGRESS_NAMESPACE));
 assert.deepEqual(after.unlockedIds,before.unlockedIds);
 assert.deepEqual(after.bestResults,before.bestResults);
 assert.equal(after.selectedMissionId,'crafted20-001');
 assert.equal(storage.values.get(PROGRESS_KEY),legacyStorageBytes);
 const refreshed=await boot('',storage);t.after(()=>refreshed.dispose());
 assert.deepEqual(refreshed.latest.progress.unlockedIds,['crafted20-001','crafted20-002','crafted20-003']);
 assert.deepEqual(refreshed.latest.progress.bestResults,before.bestResults);
});
