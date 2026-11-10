import test from 'node:test';
import assert from 'node:assert/strict';
import {listCraftedMissions} from '../src/content/crafted20/index.js';
import {createWorld} from '../src/campaign-world.js';
import {initializeEntities,syncWorldEntities} from '../src/combat.js';
import {createObjectiveStates,stepTrucks} from '../src/mission-runtime.js';
import {poseBlocker} from '../src/content/geometry.js';

for(const mission of listCraftedMissions()){
 test(`${mission.id}: authored witness clears production hull, barrel and aim sweeps`,()=>{
  const world=createWorld(mission),dead=new Set();
  let current={pose:{...mission.spawn},turret:{yawRel:0,elevation:0,recoil:0,recoilVelocity:0}};
  const entities=initializeEntities(mission);
  const sync=()=>{world.setDestroyed([...dead]);world.setEntities(Object.values(entities).filter(e=>e.kind==='turret'&&!dead.has(e.id)));};sync();
  for(const phase of mission.witness.phases){
   const reset=world.sweepTurretAtHull(current.pose,current.turret,{...current.turret,yawRel:0});
   assert.equal(reset.blocked,false,`${phase.objectiveId} reset aim: ${reset.contacts}`);current.turret=reset.accepted;
   for(const waypoint of phase.tankWaypoints){
    const next={pose:{...waypoint,y:0},turret:{...current.turret}};
    const result=world.sweepHullAndAttachedGun(current,next);
    assert.equal(result.blocked,false,`${phase.objectiveId} at ${waypoint.x},${waypoint.z}: ${result.contacts}`);current=result.accepted;
   }
   for(const fire of phase.firingPoses||[]){
    const result=world.sweepTurretAtHull(current.pose,current.turret,{...current.turret,yawRel:fire.turretYaw-current.pose.yaw});
    assert.equal(result.blocked,false,`${phase.objectiveId} aim: ${result.contacts}`);current.turret=result.accepted;
   }
   const objective=mission.objectives.find(o=>o.id===phase.objectiveId);
   if(['disable','breach'].includes(objective.type))objective.targetIds.forEach(id=>dead.add(id));sync();
  }
  world.dispose();
 });
 const trucks=mission.entities.filter(e=>e.kind==='truck');
 if(trucks.length)test(`${mission.id}: trucks physically finish without parked-vehicle deadlock (routing only)`,()=>{
  const world=createWorld(mission),entities=initializeEntities(mission),states=createObjectiveStates(mission);
  const s={mission,missionId:mission.id,tick:0,phase:'playing',tank:{pose:{...mission.spawn}},tankCombat:{hp:100},entities,objectiveStates:states,events:[],nextEventId:1};
  // Deliberate isolated routing check: threats/barriers are already cleared; driver is placed
  // alongside a truck in an actually clear pose. This is NOT an input-driven combat playthrough.
  for(const e of Object.values(entities))if(e.kind!=='truck'){e.alive=false;e.hp=0;}
  world.setDestroyed(Object.values(entities).filter(e=>e.kind==='barrier').map(e=>e.id));
  for(const v of Object.values(states))v.status='complete';
  const vehicles=Object.values(entities).filter(e=>e.kind==='truck');
  const solids=mission.geometry.filter(g=>!g.destructible);
  for(let tick=0;tick<15000&&!vehicles.every(e=>e.arrived);tick++){
   s.tick=tick;const lead=vehicles.find(e=>!e.arrived);
   const offsets=[[7,0],[-7,0],[0,7],[0,-7],[7,7],[-7,7],[7,-7],[-7,-7]];
   const pose=offsets.map(([x,z])=>({x:lead.pose.x+x,y:0,z:lead.pose.z+z,yaw:0})).find(p=>!poseBlocker(p,solids,mission.bounds));
   assert.ok(pose,'No clear nearby tank pose for route probe');s.tank.pose=pose;
   syncWorldEntities(s,world);stepTrucks(s,.1,world);
  }
  assert.ok(vehicles.every(e=>e.arrived),JSON.stringify(vehicles.map(e=>({id:e.id,pose:e.pose,reason:e.stoppedReason,index:e.routeIndex}))));world.dispose();
 });
}

test('08 releases only the berth actually visited; 17 releases both banks at its shared rendezvous',()=>{
 for(const [id,releaseIds,expected] of [
  ['crafted20-008',['release-west-berth'],['west-berth-truck']],
  ['crafted20-017',['meet-bank-convoy'],['west-bank-truck','east-bank-truck']],
 ]){
  const mission=listCraftedMissions().find(m=>m.id===id),world=createWorld(mission),entities=initializeEntities(mission),states=createObjectiveStates(mission);
  const s={mission,missionId:id,tick:0,phase:'playing',tank:{pose:{x:id.endsWith('008')?-18:0,y:0,z:id.endsWith('008')?22:30,yaw:0}},tankCombat:{hp:100},entities,objectiveStates:states,events:[],nextEventId:1};
  const before=Object.fromEntries(Object.values(entities).filter(e=>e.kind==='truck').map(e=>[e.id,{...e.pose}]));
  syncWorldEntities(s,world);stepTrucks(s,.1,world);
  for(const e of Object.values(entities).filter(e=>e.kind==='truck')){assert.deepEqual(e.pose,before[e.id]);assert.equal(e.stoppedReason,'objective');}
  for(const release of releaseIds)states[release].status='complete';
  stepTrucks(s,.1,world);
  for(const e of Object.values(entities).filter(e=>e.kind==='truck')){
   if(expected.includes(e.id)){assert.equal(e.status,'moving');assert.notDeepEqual(e.pose,before[e.id]);}
   else {assert.deepEqual(e.pose,before[e.id]);assert.equal(e.stoppedReason,'objective');}
  }
  world.dispose();
 }
});
