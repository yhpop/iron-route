import test from 'node:test';
import assert from 'node:assert/strict';
import {getCraftedMission} from '../src/content/crafted20/index.js';
import {createWorld} from '../src/campaign-world.js';
import {lineBlocker,pathBlocker,trace} from '../src/content/geometry.js';

test('001 has no attendance gate before its gun and begins close enough for an early aiming decision',()=>{
 const m=getCraftedMission('crafted20-001');
 assert.deepEqual(m.objectives.map(o=>o.id),['clear-corner','reach-apron']);
 assert.deepEqual(m.objectives[0].requires,[]);assert.ok(m.spawn.z<=18);
 assert.ok(m.objectives.every(o=>typeof o.title==='string'&&o.title.length>3));
 assert.deepEqual(m.sceneDressing.roads.find(r=>r.id==='corner-street').points[0],[-18,36]);
 assert.equal(m.sceneDressing.landmarks.find(l=>l.geometryId==='corner-store').yawOffset,Math.PI);
});

test('002 west screen provides real LOS protection without blocking its side firing position',()=>{
 const m=getCraftedMission('crafted20-002'),gun=m.entities.find(e=>e.id==='armored-yard-gun');
 assert.equal(lineBlocker(gun.pose,{x:-15,z:0},m.geometry),'west-sight-screen');
 assert.equal(lineBlocker(gun.pose,{x:15,z:0},m.geometry),null);
 assert.equal(lineBlocker(gun.pose,m.witness.phases[0].firingPoses[0],m.geometry),null);
 assert.equal(pathBlocker(m.witness.phases[0].tankWaypoints,m.geometry,m.bounds),null);
 const screen=m.geometry.find(g=>g.id==='west-sight-screen');assert.ok(screen.width<=1.5&&screen.depth>=10);
 assert.ok(!m.sceneDressing.landmarks.some(l=>l.geometryId===screen.id),'a wall must not be stretched into a building asset');
});

for(const [id,zoneId,truckId,laneX] of [
 ['crafted20-003','pickup-point','recovery-truck',-18],
 ['crafted20-012','spur-pickup','spur-truck',16],
 ['crafted20-020','final-staging','last-supply-truck',-22],
])test(`${id}: entire pickup trigger permits a pivot beside the approaching truck, not in its lane`,()=>{
 const m=getCraftedMission(id),zone=m.zones.find(z=>z.id===zoneId),vehicle=m.entities.find(e=>e.id===truckId);
 const center=zone.polygon.reduce((a,p)=>({x:a.x+p.x/zone.polygon.length,z:a.z+p.z/zone.polygon.length}),{x:0,z:0});
 assert.ok(zone.polygon.every(p=>Math.abs(p.x-laneX)>=5),'pickup overlaps the truck/barrel turn envelope');
 const samples=[center,...zone.polygon.map(p=>({x:p.x+(center.x-p.x)*.05,z:p.z+(center.z-p.z)*.05}))];
 for(const p of samples){
  const world=createWorld(m);
  // Isolated worst-case clearance probe, NOT a driving tape: truck is alongside
  // the turn at its closest lane position, rather than safely far away at spawn.
  world.setEntities([{...vehicle,pose:{...vehicle.pose,x:laneX,z:p.z,y:0},alive:true,width:1.8,depth:3.6,height:2.2}]);
  let current={pose:{...p,y:0,yaw:0},turret:{yawRel:0,elevation:0,recoil:0,recoilVelocity:0}};
  for(let i=1;i<=16;i++){
   const to={pose:{...current.pose,yaw:i*Math.PI/8},turret:{...current.turret}};
   const result=world.sweepHullAndAttachedGun(current,to);
   assert.equal(result.blocked,false,`${p.x},${p.z} turn ${i}: ${result.contacts}`);current=result.accepted;
  }
  world.dispose();
 }
});

test('003 shorter off-lane rendezvous does not make the truck or objective complete magically',()=>{
 const m=getCraftedMission('crafted20-003'),pickup=m.witness.phases.find(p=>p.objectiveId==='meet-recovery-truck');
 const length=pickup.tankWaypoints.reduce((s,p,i,a)=>s+(i?Math.hypot(p.x-a[i-1].x,p.z-a[i-1].z):0),0);
 assert.ok(length<20,`return remains ${length} m`);
 const truck=m.entities.find(e=>e.id==='recovery-truck');assert.equal(truck.activationObjectiveId,'meet-recovery-truck');
 assert.deepEqual(m.objectives.find(o=>o.id==='meet-recovery-truck').requires,['clear-recovery-bend']);
 assert.equal(m.objectives.find(o=>o.id==='deliver-recovery-truck').type,'escort');
});

test('020 road guidance keeps the tank alongside until the already-aligned north cross street',()=>{
 const m=getCraftedMission('crafted20-020'),phase=m.witness.phases.find(p=>p.objectiveId==='deliver-last-supply');
 const early=phase.tankWaypoints.filter(p=>p.z>-15);
 assert.ok(early.every(p=>p.x<=-27),'outgoing witness cuts back across the moving truck before the north cross street');
 assert.ok(m.sceneDressing.markings?.some(p=>p.id==='final-bay-north-arrow'));
 assert.ok(m.briefing.includes('到了横路再向东并入'));
});
