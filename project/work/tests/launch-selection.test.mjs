import test from 'node:test';import assert from 'node:assert/strict';
import {getOptionalMission} from '../src/content/optional-records.js';
import {listMissions} from '../src/content/index.js';
import {createGame,stepGame} from '../src/campaign-simulation.js';
import {createWorld} from '../src/campaign-world.js';
import {DEFAULT_CONFIG} from '../src/tank-controller.js';
import {PROGRESS_KEY,loadProgress} from '../src/session.js';
import {resolveLaunch,persistLaunchProgress,recordLaunchWin,nextCampaignMission} from '../src/launch-selection.js';
const normal=[{id:'mission-001'},{id:'mission-002'}],optional={id:'mission-9001'},progress={schema:1,selectedMissionId:'mission-002',unlockedIds:['mission-001','mission-002'],bestResults:{}};
test('optional fork launch is separate from campaign registry and forbids every progress write',async()=>{const {resolveLaunch}=await import('../src/launch-selection.js');const before=JSON.stringify(progress),selection=resolveLaunch('?sortie=warehouse-fork',normal,progress,key=>key==='warehouse-fork'?optional:null);assert.equal(selection.spec,optional);assert.equal(selection.optional,true);assert.equal(selection.progressWritable,false);assert.equal(JSON.stringify(progress),before);assert.equal(normal.length,2);});
test('normal and invalid queries preserve valid normal selection and do not unlock anything',async()=>{const {resolveLaunch}=await import('../src/launch-selection.js');for(const query of ['', '?sortie=bad','?sortie=warehouse-fork&sortie=other']){const selection=resolveLaunch(query,normal,progress,key=>key==='warehouse-fork'?optional:null);assert.equal(selection.spec,normal[1]);assert.equal(selection.progressWritable,true);assert.equal(selection.optional,false);}const fallback=resolveLaunch('',normal,{selectedMissionId:'missing',unlockedIds:['mission-001']},()=>null);assert.equal(fallback.spec,normal[0]);});
test('unknown optional ID cannot produce a fake next campaign mission',async()=>{const {nextCampaignMission}=await import('../src/launch-selection.js');assert.equal(nextCampaignMission(normal,'mission-9001'),null);assert.equal(nextCampaignMission(normal,'mission-001'),normal[1]);assert.equal(nextCampaignMission(normal,'mission-002'),null);});
test('optional start retry and win leave the actual normal storage bytes unchanged',async()=>{const {resolveLaunch,persistLaunchProgress,recordLaunchWin}=await import('../src/launch-selection.js');const map=new Map([['tank-campaign:progress:v1',JSON.stringify(progress)]]);let writes=0;const storage={getItem:k=>map.get(k)??null,setItem(k,v){writes++;map.set(k,v)}};const before=[...map];const choice=resolveLaunch('?sortie=warehouse-fork',normal,progress,()=>optional);let p=progress;for(const phase of ['start','retry','won']){if(phase==='won')p=recordLaunchWin(choice,p,{ticks:100,hp:100},normal);assert.equal(persistLaunchProgress(choice,storage,p),null);}assert.equal(writes,0);assert.deepEqual([...map],before);const regular=resolveLaunch('',normal,{...progress,selectedMissionId:'mission-001'},()=>null);p=recordLaunchWin(regular,progress,{ticks:200,hp:90},normal);assert.equal(p.bestResults['mission-001'].ticks,200);assert.equal(persistLaunchProgress(regular,storage,p),true);assert.equal(writes,1);});

test('actual optional slugs stay outside the 303-mission registry and malformed queries resume normal selection',()=>{
 const missions=listMissions(),before=JSON.stringify(progress);
 for(const [slug,id] of [['breach-cover','mission-9002'],['warehouse-fork','mission-9001']]){
  const selection=resolveLaunch(`?sortie=${slug}`,missions,progress,getOptionalMission);
  assert.equal(selection.spec,getOptionalMission(slug));assert.equal(selection.spec.id,id);
  assert.equal(selection.optional,true);assert.equal(selection.progressWritable,false);
  assert.equal(missions.some(mission=>mission.id===id),false);assert.equal(nextCampaignMission(missions,id),null);
 }
 for(const query of ['', '?sortie=missing','?sortie=__proto__','?sortie=constructor','?sortie=',
  '?sortie=breach-cover&sortie=breach-cover','?sortie=breach-cover&sortie=warehouse-fork',
  '?sortie=unknown&sortie=breach-cover','?sortie=breach-cover&sortie=unknown']){
  const selection=resolveLaunch(query,missions,progress,getOptionalMission);
  assert.equal(selection.spec.id,'mission-002',query);assert.equal(selection.optional,false,query);assert.equal(selection.progressWritable,true,query);
 }
 const fallback=resolveLaunch('?sortie=unknown',missions,{...progress,selectedMissionId:'mission-003'},getOptionalMission);
 assert.equal(fallback.spec.id,'mission-001');assert.equal(missions.length,303);assert.equal(JSON.stringify(progress),before);
});

test('real breach-cover start retry and simulated win make zero storage writes before normal progression resumes',t=>{
 const missions=listMissions(),map=new Map([[PROGRESS_KEY,JSON.stringify(progress)]]);let writes=0;
 const storage={getItem:key=>map.get(key),setItem(key,value){writes++;map.set(key,value);}},before=[...map];
 const saved=loadProgress(storage,missions),savedBytes=JSON.stringify(saved);
 const choice=resolveLaunch('?sortie=breach-cover',missions,saved,getOptionalMission),dt=1/60;
 const world=createWorld(choice.spec);t.after(()=>world.dispose());
 let current=createGame(choice.spec);
 assert.equal(current.missionId,'mission-9002');assert.equal(persistLaunchProgress(choice,storage,saved),null);
 current=stepGame(current,{start:true},dt,world);assert.equal(current.phase,'playing');
 assert.equal(persistLaunchProgress(choice,storage,saved),null);
 current=createGame(choice.spec);assert.equal(current.phase,'briefing');assert.equal(current.tick,0);
 assert.equal(current.missionId,'mission-9002');assert.equal(persistLaunchProgress(choice,storage,saved),null);
 current=stepGame(current,{start:true},dt,world);
 // Drive the legal intact-wall bypass with real control frames, not a forged win.
 for(const [x,z] of [[-25,24],[-25,-36],[0,-36]]){
  for(let tick=0;tick<6000&&current.phase==='playing';tick++){
   const {pose,vL,vR}=current.tank,distance=Math.hypot(x-pose.x,z-pose.z);
   if(distance<.45){for(let stop=0;stop<35&&current.phase==='playing';stop++)current=stepGame(current,{brake:true},dt,world);break;}
   const delta=Math.atan2(-(x-pose.x),-(z-pose.z))-pose.yaw,angle=Math.atan2(Math.sin(delta),Math.cos(delta));
   const angularVelocity=(vR-vL)/DEFAULT_CONFIG.trackGauge;
   current=stepGame(current,{governor:'cruise',throttle:Math.abs(angle)<.25?Math.min(1,distance/2):0,steer:-Math.max(-1,Math.min(1,(1.1*angle-angularVelocity)/.55))},dt,world);
  }
 }
 assert.equal(current.phase,'won');assert.equal(current.result.outcome,'won');assert.equal(current.entities['dual-wall'].alive,true);
 const unchanged=recordLaunchWin(choice,saved,{ticks:current.tick,hp:current.tankCombat.hp},missions);
 assert.equal(unchanged,saved);assert.equal(persistLaunchProgress(choice,storage,unchanged),null);
 assert.equal(writes,0);assert.deepEqual([...map],before);assert.equal(JSON.stringify(saved),savedBytes);
 assert.deepEqual(saved.unlockedIds,['mission-001','mission-002']);assert.deepEqual(saved.bestResults,{});
 const normal=resolveLaunch('',missions,loadProgress(storage,missions),getOptionalMission);
 assert.equal(normal.spec.id,'mission-002');assert.equal(normal.progressWritable,true);
 const advanced=recordLaunchWin(normal,saved,{ticks:200,hp:90},missions);
 assert.deepEqual(advanced.unlockedIds,['mission-001','mission-002','mission-003']);
 assert.deepEqual(advanced.bestResults,{'mission-002':{ticks:200,hp:90}});
 assert.equal(persistLaunchProgress(normal,storage,advanced),true);assert.equal(writes,1);
 assert.deepEqual(loadProgress(storage,missions),advanced);
});
