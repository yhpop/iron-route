import test from 'node:test';
import assert from 'node:assert/strict';
import {createEightNpcCrossfire} from '../src/eight-npc-crossfire-front.js';
import {createGame,stepGame} from '../src/campaign-simulation.js';
import {createRuinedDepotWorld} from '../src/ruined-depot-world-accelerated.js';
import {withPlayerVehicle} from '../src/player-vehicles-v3.js';
import {areHostile} from '../src/combat-relations.js';

test('northern threats are not preemptively consumed by allied opening duels; southern physical exchange remains',()=>{
 const {spec:base,field}=createEightNpcCrossfire(),spec=withPlayerVehicle(base,'newc-tiger'),world=createRuinedDepotWorld(spec,field);
 let s=createGame(spec);s=stepGame(s,{start:true},1/60,world);const events=[];
 try {
  for(let i=0;i<1800;i++){s=stepGame(s,{brake:true},1/60,world);assert.equal(s.phase,'playing');events.push(...s.events);}
  for(const id of ['ridge-gun','hostile-far-east']){
   assert.equal(s.entities[id].hp,spec.entities.find(e=>e.id===id).hp,id+' remains physically intact until approached');
   assert.equal(s.entities[id].alive,true);
  }
  for(const id of ['allied-support','allied-north','allied-far-east'])assert.ok(events.some(e=>e.type==='damaged'&&e.entityId===id),id+' contributes actual hostile damage');
  assert.ok(events.some(e=>e.type==='damaged'&&e.entityId==='road-gun'));
  for(const e of events.filter(e=>e.type==='damaged'))assert.ok(areHostile(s,e.entityId,e.targetId));
  assert.equal(Object.values(s.entities).filter(e=>e.kind==='turret').length,8);
 } finally {world.dispose();}
});

import {createLoadingExtraction} from '../src/loading-extraction-front.js';
import {sampleGroundContact} from '../src/terrain-candidate/heightfield.js';

test('staging leaves original mission, enemies, player rules and all non-pose ally fields unchanged',()=>{
 const {spec,field}=createEightNpcCrossfire(),prior=createLoadingExtraction();
 for(const key of ['spawn','geometry','routes','zones','objectives','convoyChoice','combatRelations'])assert.deepEqual(spec[key],prior.spec[key],key);
 assert.deepEqual(field,prior.field);
 for(const e of prior.spec.entities)assert.deepEqual(spec.entities.find(n=>n.id===e.id),e,e.id+' unchanged');
 const template=prior.spec.entities.find(e=>e.id==='allied-support');
 const poses=[['allied-east','allied',30,20,23,16],['allied-north','allied',-8,-18,0,-18],['allied-far-east','allied',30,-8,30,-20],['hostile-far-east','hostile',30,-20,30,-8]];
 for(const [id,team,x,z,tx,tz] of poses){
  const yaw=Math.atan2(-(tx-x),-(tz-z))||0,expected={...structuredClone(template),id,team,pose:{x,z,y:sampleGroundContact(field,x,z,yaw).height+.008,yaw},patrol:[]},actual=spec.entities.find(e=>e.id===id);
  if(['allied-north','allied-far-east'].includes(id)){const{pose:ap,...a}=actual,{pose:ep,...e}=expected;assert.deepEqual(a,e,id+' only placement allowed');}
  else assert.deepEqual(actual,expected,id+' original placement retained');
 }
});

// Collision-policy fixtures deliberately seed one shell; these are not input-only
// playthroughs and do not count as route victories or pacing evidence.
test('both moved allies absorb friendly shells physically and remain vulnerable to hostile shells',()=>{
 for(const id of ['allied-north','allied-far-east'])for(const friendly of [true,false]){
  const {spec,field}=createEightNpcCrossfire(),world=createRuinedDepotWorld(spec,field);
  try {
   let s=stepGame(createGame(spec),{start:true},1/60,world);const p=s.entities[id].pose,hp=s.entities[id].hp;
   s.projectiles=[{id:'policy-fixture',ownerId:friendly?'tank':'hostile-far-east',faction:friendly?'allied':'hostile',position:{x:p.x+3,y:p.y+.6,z:p.z},previousPosition:{x:p.x+3,y:p.y+.6,z:p.z},velocity:{x:-60,y:0,z:0},damage:12,life:4}];
   s=stepGame(s,{brake:true},.1,world);
   assert.equal(s.projectiles.some(e=>e.id==='policy-fixture'),false,id+' actual body intercepts');
   assert.equal(s.entities[id].hp,hp-(friendly?0:12),id+' faction damage');
   assert.ok(s.events.some(e=>e.type==='impact'&&e.projectileId==='policy-fixture'&&e.targetId===id&&e.value===(friendly?'friendly-block':'hit')));
  } finally {world.dispose();}
 }
});

import {createRuinedDepotWorld as createUnacceleratedWorld} from '../src/ruined-depot-world.js';

test('staged encounter retains identical accelerated and reference simulation semantics',()=>{
 const {spec:base,field}=createEightNpcCrossfire(),spec=withPlayerVehicle(base,'newc-tiger'),worlds=[createRuinedDepotWorld(spec,field),createUnacceleratedWorld(spec,field)];
 let states=worlds.map(w=>stepGame(createGame(spec),{start:true},1/60,w));
 try {for(let tick=0;tick<600;tick++){states=states.map((s,i)=>stepGame(s,{brake:true},1/60,worlds[i]));assert.deepEqual(states[0],states[1],'tick '+tick);}}
 finally{for(const w of worlds)w.dispose();}
});

import {createWorld} from '../src/campaign-world-accelerated.js';
import {interceptorCollider,INTERCEPTOR_COLLISION_RIG as npcRig} from '../src/interceptor.js';
import {sampleHeightfield} from '../src/terrain-candidate/heightfield.js';
import {getTankTransform} from '../src/tank-controller.js';

test('current moved compounds and footprints are grounded and leave both complete convoy corridors clear live or wrecked',()=>{
 const {spec,field}=createEightNpcCrossfire(),world=createRuinedDepotWorld(spec,field),isolated=createWorld({...spec,geometry:[],entities:[]}),moved=spec.entities.filter(e=>['allied-north','allied-far-east'].includes(e.id));
 try {
  stepGame(createGame(spec),{start:true},1/60,world);
  for(const e of moved){
   const t=interceptorCollider(e);assert.deepEqual(world.sweepHullAndAttachedGun(t,t,npcRig,[e.id]).contacts,[],e.id);assert.deepEqual(world.muzzleContacts(getTankTransform(t,npcRig),npcRig,[e.id]).contacts,[],e.id);
   for(let x=-1.1;x<=1.1;x+=.2)for(let z=-2;z<=2;z+=.2){const X=e.pose.x+Math.cos(e.pose.yaw)*x+Math.sin(e.pose.yaw)*z,Z=e.pose.z-Math.sin(e.pose.yaw)*x+Math.cos(e.pose.yaw)*z,gap=e.pose.y-sampleHeightfield(field,X,Z).height;assert.ok(gap>=0&&gap<.02,e.id+' ground gap '+gap);}
  }
  for(const destroyed of [false,true])for(let a=0;a<8;a++){
   isolated.setEntities(moved.map(e=>interceptorCollider({...e,aimYaw:a*Math.PI/4,alive:!destroyed,destroyed,hp:destroyed?0:e.hp})));
   for(const route of spec.routes)assert.equal(isolated.isRouteClear(route,{width:route.width,depth:3.6,height:2.2}),true,route.id+' full corridor');
  }
  // Negative control: the same physical compound parked on the east lane is rejected.
  const e=moved[0];isolated.setEntities([interceptorCollider({...e,pose:{x:14,y:0,z:0,yaw:0}})]);
  assert.equal(isolated.isRouteClear(spec.routes[0],{width:1.8,depth:3.6,height:2.2}),false);
 } finally {world.dispose();isolated.dispose();}
});

import {listPlayerVehicles,playerRig} from '../src/player-vehicles-v3.js';
test('all five retained player rigs start clear in the staged mission and preserve pause, resume and retry',async()=>{
 const {retry}=await import('../src/campaign-simulation.js');
 for(const vehicle of listPlayerVehicles()){
  const {spec:base,field}=createEightNpcCrossfire(),spec=withPlayerVehicle(base,vehicle.id),world=createRuinedDepotWorld(spec,field);
  try {
   const initial=createGame(spec);let s=stepGame(initial,{start:true},1/60,world);assert.deepEqual(world.hullContacts(s.tank,playerRig(spec)),[],vehicle.id);assert.deepEqual(world.muzzleContacts(getTankTransform(s.tank,playerRig(spec)),playerRig(spec),['tank']).contacts,[],vehicle.id);
   for(let i=0;i<60;i++)s=stepGame(s,{throttle:.5,steer:i<30?.3:-.3},1/60,world);
   assert.ok(s.tick===60&&s.phase==='playing');assert.ok(Math.hypot(s.tank.pose.x-initial.tank.pose.x,s.tank.pose.z-initial.tank.pose.z)>.01);
   const paused=stepGame(s,{pause:true},1/60,world);assert.equal(paused.tick,s.tick);assert.deepEqual(stepGame(paused,{throttle:1,steer:1,firePressed:true},1/60,world),paused);assert.equal(stepGame(paused,{resume:true},1/60,world).phase,'playing');assert.deepEqual(retry(spec),createGame(spec));
  }finally{world.dispose();}
 }
});
