import test from 'node:test';
import assert from 'node:assert/strict';
import {listCraftedMissions,getCraftedMission,validateCraftedMission,CAMPAIGN_ID,PROGRESS_NAMESPACE} from '../src/content/crafted20/index.js';
import {getMission as getArchivedMission,listMissions as listArchivedMissions} from '../src/content/index.js';
import {createWorld} from '../src/campaign-world.js';
import {trace,inside,poseBlocker} from '../src/content/geometry.js';
const missions=listCraftedMissions();

test('exactly twenty authored missions have fresh IDs and an isolated progress namespace',()=>{
 assert.equal(CAMPAIGN_ID,'crafted20-v1');assert.equal(PROGRESS_NAMESPACE,'iron-route:crafted20:v1');
 assert.equal(missions.length,20);assert.equal(new Set(missions.map(m=>m.id)).size,20);
 assert.deepEqual(missions.map(m=>m.index),Array.from({length:20},(_,i)=>i+1));
 assert.equal(new Set(missions.map(m=>m.districtId)).size,4);
 for(const district of new Set(missions.map(m=>m.districtId)))assert.equal(missions.filter(m=>m.districtId===district).length,5);
 for(const m of missions){assert.equal(getCraftedMission(m.id),m);assert.equal(getArchivedMission(m.id),undefined);assert.ok(Object.isFrozen(m));assert.ok(Object.isFrozen(m.geometry[0]));}
 assert.equal(listArchivedMissions().length,303);assert.equal(getCraftedMission('mission-001'),undefined);assert.equal(getCraftedMission('crafted20-021'),undefined);
});

for(const m of missions){
 test(`${m.id}: objectives, alternatives, armor angles and honest design notes validate`,()=>{
  assert.ok(m.design.spatialIdentity);assert.ok(m.design.alternative);assert.ok(m.design.sequence.length>=2);assert.ok(m.design.beat.focus);
  assert.ok(['learn','apply','master'].includes(m.design.beat.stage));assert.equal(m.design.evidence.humanPlaythrough,'unverified');
  assert.deepEqual(m.design.proposedMechanics,[]);assert.ok(m.design.targetSeconds[0]>=60&&m.design.targetSeconds[1]<=180);
  assert.ok(m.design.safePlanningPoses.length);assert.ok(m.design.alternatives.length);
  const check=validateCraftedMission(m);assert.ok(check.valid,check.errors.join('; '));
 });
 test(`${m.id}: dressing binds buildings to real geometry and adds no surprise road blockers`,()=>{
  const dressing=m.sceneDressing;assert.equal(dressing.schema,1);assert.ok(dressing.landmarks.length);assert.ok(dressing.roads.length);
  const keys=new Set(['warehouse-sawtooth','pump-station','service-workshop']);
  for(const item of dressing.landmarks){
   const c=m.geometry.find(g=>g.id===item.geometryId);assert.ok(c,`${item.geometryId} absent`);assert.ok(keys.has(item.assetKey));
   assert.ok(c.width>=5.2&&c.width<=16&&c.depth>=5.2&&c.depth<=18,`building footprint ${c.id} is not suitable for kit`);
  }
  for(const road of dressing.roads){assert.ok(road.points.length>=2);assert.ok(road.width>=6);assert.equal(road.curb,false);for(const p of road.points)assert.ok(p.length===2&&p.every(Number.isFinite));}
  for(const prop of dressing.props)assert.equal(prop.collision,'none');
  for(const water of dressing.water){
   assert.ok(water.enclosedBy.length>0);for(const id of water.enclosedBy)assert.ok(m.geometry.find(g=>g.id===id&&!g.destructible),`water barrier ${id} absent`);
   const polygon=water.polygon.map(([x,z])=>({x,z}));
   for(const phase of m.witness.phases)for(const pose of phase.tankWaypoints)assert.equal(inside(pose,polygon),false,'witness drives on cosmetic water');
   for(const convoy of m.routes)for(const p of convoy.points)assert.equal(inside(p,polygon),false,'truck drives on cosmetic water');
  }
 });
 test(`${m.id}: alternative approaches clear the production collision world`,()=>{
  for(const alternative of m.design.alternatives){
   const world=createWorld(m);world.setDestroyed(alternative.destroyedIds||[]);
   world.setEntities(m.entities.filter(e=>e.kind==='turret'&&!(alternative.destroyedIds||[]).includes(e.id)).map(e=>({...e,alive:true,radius:.8,height:2.2})));
   const waypoints=trace(alternative.points.map(([x,z])=>({x,z})),m.spawn.yaw);
   let from={pose:{...waypoints[0],y:0},turret:{yawRel:0,elevation:0,recoil:0,recoilVelocity:0}};
   for(const p of waypoints){const to={pose:{...p,y:0},turret:{...from.turret}},result=world.sweepHullAndAttachedGun(from,to);assert.equal(result.blocked,false,`${alternative.id}: ${result.contacts}`);from=result.accepted;}
   if(alternative.fireTargetId){
    const target=m.entities.find(e=>e.id===alternative.fireTargetId)?.pose||m.geometry.find(g=>g.id===alternative.fireTargetId);
    const yaw=Math.atan2(from.pose.x-target.x,from.pose.z-target.z);
    const result=world.sweepTurretAtHull(from.pose,from.turret,{...from.turret,yawRel:yaw-from.pose.yaw});assert.equal(result.blocked,false,`${alternative.id} aim: ${result.contacts}`);
   }
   world.dispose();
  }
 });
}

test('optional shortcuts are genuinely optional and their closed-state shots have witnesses',()=>{
 for(const id of ['crafted20-007','crafted20-015']){
  const m=getCraftedMission(id),barriers=m.geometry.filter(g=>g.destructible);
  assert.ok(barriers.length);assert.ok(m.objectives.every(o=>o.type!=='breach'));
  for(const b of barriers){
   assert.ok(m.design.alternatives.some(a=>a.destroyedIds.includes(b.id)),`${b.id} is not used by an optional route`);
  }
 }
});

test('new validator reports malformed data instead of throwing before legacy validation',()=>{
 for(const candidate of [null,undefined,{}, {id:'crafted20-001',index:1,schema:1}])assert.equal(validateCraftedMission(candidate).valid,false);
});

test('all twenty authored missions provide semantic Chinese objective titles instead of raw IDs or generic type labels',()=>{
 for(const m of missions)for(const o of m.objectives){
  assert.ok(typeof o.title==='string'&&/[\u4e00-\u9fff]/.test(o.title)&&o.title.length>=5,`${m.id}/${o.id} lacks a meaningful title`);
  assert.ok(!['驶入标记区域','绕到侧面，摧毁标记武器','保护补给车抵达终点'].includes(o.title),`${o.id} only repeats a generic type label`);
 }
});
