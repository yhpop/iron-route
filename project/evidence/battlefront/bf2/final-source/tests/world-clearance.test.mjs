import test from 'node:test';
import assert from 'node:assert/strict';
import * as collision from '../src/campaign-world.js';
const rig={
  hullProxy:{width:2,height:1,depth:3,offset:{x:0,y:.5,z:0}},
  turretProxy:{width:1,height:.5,depth:1,offset:{x:0,y:0,z:0}},
  turretPivot:{x:0,y:1.5,z:0},barrelPivot:{x:0,y:0,z:-.5},
  barrelCapsule:{radius:.08},muzzleLocal:{x:0,y:0,z:-2.5},trackLoopMeters:6,wheelRadius:.2,
};
const transform=(x=0,z=0,yaw=0,yawRel=0,elevation=0,recoil=0)=>({pose:{x,y:0,z,yaw},turret:{yawRel,elevation,recoil,recoilVelocity:0}});
const box=(id,x,z,width,depth,height=3,y=0,yaw=0)=>({id,kind:'box',x,z,width,depth,height,y,yaw});

test('thin wall cannot be tunneled through even when the endpoint is entirely clear',()=>{
  const w=collision.createWorld({geometry:[box('thin',0,-5,8,.005)]});
  const r=w.sweepHullAndAttachedGun(transform(),transform(0,-12),rig);
  assert.equal(r.blocked,true);assert.ok(r.accepted.pose.z>-2);assert.ok(r.accepted.pose.z<-1.7);
  assert.ok(r.forwardDistance>1.7 && r.forwardDistance<2);
  assert.ok(r.contacts.includes('thin'));
});
test('an elevated gun can overhang a low wall without a long hull rectangle',()=>{
  const w=collision.createWorld({geometry:[box('low',0,-3.3,5,.2,.6)]});
  const r=w.sweepHullAndAttachedGun(transform(),transform(0,-.7),rig);
  assert.equal(r.blocked,false);assert.equal(r.accepted.pose.z,-.7);
});
test('barrel rotation stops at first thin pillar, not the clear endpoint',()=>{
  const w=collision.createWorld({geometry:[box('pillar',-2.1,-2.1,.04,.04,2)]});
  const from=transform().turret,to={...from,yawRel:Math.PI/2};
  const r=w.sweepTurretAtHull(transform().pose,from,to,rig);
  assert.equal(r.blocked,true);assert.ok(r.accepted.yawRel>0.5 && r.accepted.yawRel<Math.PI/4);
  assert.equal(r.forwardDistance,0);assert.ok(r.contacts.includes('pillar'));
});
test('attached gun is swept with hull pivot and cannot rotate through a corner',()=>{
  const w=collision.createWorld({geometry:[box('corner',-2.1,-2.1,.04,.04,2)]});
  const r=w.sweepHullAndAttachedGun(transform(),transform(0,0,Math.PI/2),rig);
  assert.equal(r.blocked,true);assert.ok(r.accepted.pose.yaw<Math.PI/4);
  assert.equal(r.forwardDistance,0);
});
test('barrel elevation is swept rather than checking only the muzzle ray',()=>{
  const w=collision.createWorld({geometry:[box('lintel',0,-1.8,.3,.2,.06,1.78)]});
  const r=w.sweepTurretAtHull(transform().pose,transform().turret,transform(0,0,0,0,.45).turret,rig);
  assert.equal(r.blocked,true); assert.ok(r.accepted.elevation>0 && r.accepted.elevation<.3);
});
test('collision skin does not trap a tank trying to back away from a wall',()=>{
  const w=collision.createWorld({geometry:[box('wall',0,-5,8,.01)]});
  const approach=w.sweepHullAndAttachedGun(transform(),transform(0,-4),rig);
  const retreat=w.sweepHullAndAttachedGun(approach.accepted,transform(0,0),rig);
  assert.equal(retreat.blocked,false);assert.equal(retreat.accepted.pose.z,0);
  assert.ok(retreat.forwardDistance<0);
});
test('raycasts return nearest height-aware obstruction and respect destruction and ignored IDs',()=>{
  const w=collision.createWorld({geometry:[box('low',0,-2,1,1,.5),box('tall',0,-4,1,1,3)]});
  let hit=w.raycast({x:0,y:1,z:0},{x:0,y:1,z:-8});
  assert.equal(hit.id,'tall');assert.equal(hit.fraction,3.5/8);assert.equal(hit.point.z,-3.5);
  assert.equal(w.raycast({x:0,y:1,z:0},{x:0,y:1,z:-8},['tall']),null);
  w.setDestroyed(['tall']);assert.equal(w.raycast({x:0,y:1,z:0},{x:0,y:1,z:-8}),null);
  w.setDestroyed([]);assert.equal(w.raycast({x:0,y:1,z:0},{x:0,y:1,z:-8}).id,'tall');
});
test('circle collider uses a finite cylinder rather than its bounding square',()=>{
  const w=collision.createWorld({geometry:[{id:'column',kind:'circle',x:0,z:0,radius:1,height:2}]});
  assert.equal(w.raycast({x:.9,y:1,z:2},{x:.9,y:1,z:.9}),null);
  const h=w.raycast({x:0,y:1,z:2},{x:0,y:1,z:-2});
  assert.equal(h.id,'column');assert.equal(h.fraction,.25);
  assert.equal(w.raycast({x:0,y:3,z:2},{x:0,y:3,z:-2}),null);
});
test('rotated boxes are queried in their actual orientation',()=>{
  const w=collision.createWorld({geometry:[box('diagonal',0,0,6,.2,2,0,Math.PI/4)]});
  assert.equal(w.raycast({x:2,y:1,z:2},{x:3,y:1,z:3}),null);
  assert.equal(w.raycast({x:0,y:1,z:2},{x:0,y:1,z:-2}).id,'diagonal');
});
test('route envelope must fit through a real opened breach and dispose rejects stale queries',()=>{
  const w=collision.createWorld({geometry:[box('gate',0,0,6,.3)]});
  const route={points:[{x:0,z:3},{x:0,z:-3}],width:3};
  assert.equal(w.isRouteClear(route,{width:2,depth:3,height:1.5}),false);
  w.setDestroyed(['gate']);assert.equal(w.isRouteClear(route,{width:2,depth:3,height:1.5}),true);
  w.dispose();assert.throws(()=>w.raycast({x:0,y:0,z:0},{x:1,y:0,z:0}),/disposed/i);
});

test('live entities block the hull and gun, replace their snapshot, and ignore a truck only for its own query',()=>{
  const w=collision.createWorld({geometry:[]});
  const entities=[{id:'truck-a',kind:'truck',pose:{x:0,z:-5,yaw:0},width:1.8,depth:3.6,height:2.2,hp:100}];
  w.setEntities(entities);
  assert.equal(w.sweepHullAndAttachedGun(transform(),transform(0,-7),rig).blocked,true);
  assert.equal(w.raycast({x:0,y:1,z:0},{x:0,y:1,z:-8}).id,'truck-a');
  assert.equal(w.isRouteClear({points:[{x:0,z:-5},{x:0,z:-7}]},{width:1.8,depth:3.6,height:2.2,ignoreIds:['truck-a']}),true);
  entities[0].pose.x=50; // Snapshot must not alias runtime mutable state.
  assert.equal(w.raycast({x:0,y:1,z:0},{x:0,y:1,z:-8}).id,'truck-a');
  w.setEntities(entities);
  assert.equal(w.sweepHullAndAttachedGun(transform(),transform(0,-7),rig).blocked,false);
  w.setEntities([{...entities[0],pose:{x:0,z:-5,yaw:0},hp:0}]);
  assert.equal(w.raycast({x:0,y:1,z:0},{x:0,y:1,z:-8}),null);
});
test('tank snapshot blocks truck routes but never collides with its own drive or muzzle query',()=>{
  const w=collision.createWorld();w.setEntities([{id:'tank',kind:'tank',pose:{x:0,z:0,yaw:0},width:2,depth:3,height:1.5,hp:100}]);
  assert.equal(w.sweepHullAndAttachedGun(transform(),transform(0,-.1),rig).blocked,false);
  assert.equal(w.isRouteClear({points:[{x:0,z:4},{x:0,z:-4}]},{width:1.8,depth:3.6,height:2}),false);
  assert.equal(w.raycast({x:0,y:1,z:3},{x:0,y:1,z:-3},['tank']),null);
});
test('recoil return envelope cannot push the extended barrel through a wall',()=>{
  const w=collision.createWorld({geometry:[box('return-wall',0,-3.05,3,.04)]});
  const from=transform(0,0,0,0,0,.2).turret,to={...from,recoil:0};
  const r=w.sweepTurretAtHull(transform().pose,from,to,rig);
  assert.equal(r.blocked,true);assert.ok(r.accepted.recoil>0.05 && r.accepted.recoil<.15);
});

test('live truck envelope honors yaw at both endpoints and sweeps a zero-distance turn',()=>{
  const w=collision.createWorld({geometry:[box('truck-corner',-1.4,-1.4,.05,.05,3)]});
  const r=w.isRouteClear({points:[{x:0,z:0,yaw:0},{x:0,z:0,yaw:Math.PI/2}]},{width:1.8,depth:3.6,height:2.2});
  assert.equal(r,false);
  assert.equal(w.isRouteClear({points:[{x:0,z:0,yaw:0},{x:0,z:0,yaw:0}]},{width:1.8,depth:3.6,height:2.2}),true);
});

test('live tank compound snapshot blocks crossing trucks at its sideways barrel, not just its hull',()=>{
  const w=collision.createWorld();
  const tank={id:'tank',kind:'tank',...transform(3,0,Math.PI/2),rig,hp:100};
  w.setEntities([tank]);
  const route={points:[{x:0,z:8,yaw:0},{x:0,z:-8,yaw:0}]};
  assert.equal(w.isRouteClear(route,{width:1.8,depth:3.6,height:2.2}),false);
  assert.equal(w.isRouteClear(route,{width:1.8,depth:3.6,height:1}),true); // real barrel height, no wide gun AABB
  const hit=w.raycast({x:.5,y:1.5,z:2},{x:.5,y:1.5,z:-2});
  assert.equal(hit?.id,'tank');assert.ok(hit.fraction>.47&&hit.fraction<.49);
  assert.equal(w.raycast({x:.5,y:1.5,z:2},{x:.5,y:1.5,z:-2},['tank']),null);
  assert.equal(w.sweepHullAndAttachedGun(tank,{...tank,pose:{...tank.pose,x:3.1}},rig).blocked,false);
  tank.turret.yawRel=Math.PI/2; // retained snapshot cannot change under a query
  assert.equal(w.isRouteClear(route,{width:1.8,depth:3.6,height:2.2}),false);
  w.setEntities([tank]);
  assert.equal(w.isRouteClear(route,{width:1.8,depth:3.6,height:2.2}),true);
});

test('surface polygons sample actual boundaries and deterministic overlapping traction/drag',()=>{
  const polygon=[{x:-2,z:-3},{x:2,z:-3},{x:2,z:3},{x:-2,z:3}];
  const spec={surfaces:[{id:'rubble',class:'rubble',traction:.7,drag:1.35,polygon},{id:'deep',class:'rubble',traction:.5,drag:1.5,polygon:[{x:0,z:0},{x:1,z:0},{x:1,z:1},{x:0,z:1}]}]};
  const w=collision.createWorld(spec);
  assert.deepEqual(w.surfaceAt({x:10,z:0}),{id:null,class:'road',traction:1,drag:1});
  assert.deepEqual(w.surfaceAt({x:-2,z:0}),{id:'rubble',class:'rubble',traction:.7,drag:1.35});
  assert.deepEqual(w.surfaceAt({x:.5,z:.5}),{id:'deep',class:'rubble',traction:.5,drag:1.5});
  spec.surfaces[0].traction=0;polygon[0].x=50;
  assert.equal(w.surfaceAt({x:-1,z:-1}).traction,.7);
});
