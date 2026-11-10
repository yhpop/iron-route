import test from 'node:test';
import assert from 'node:assert/strict';
import {getCraftedMission} from '../src/content/crafted20/index.js';
import {createWorld} from '../src/campaign-world.js';
import {lineBlocker,inside,pathBlocker,trace,yawTo,wrap} from '../src/content/geometry.js';
const mission=()=>getCraftedMission('crafted20-002');
const inShield=(gun,p)=>Math.abs(wrap(yawTo(gun.pose,p)-gun.pose.yaw))<gun.shieldArc/2;

test('002 opening presents real gravel at the near west mouth, asphalt east, and a safe stationary spawn',()=>{
 const m=mission(),world=createWorld(m),gun=m.entities[0];
 const west={x:m.spawn.x-4,z:m.spawn.z-1.45},east={x:m.spawn.x+4,z:m.spawn.z-1.45};
 assert.ok(m.surfaces.some(s=>s.class==='rubble'&&inside(west,s.polygon)),'west material distinction must start at the visible near fork');
 assert.ok(!m.surfaces.some(s=>inside(east,s.polygon)),'east mouth remains asphalt');
 assert.ok(!m.surfaces.some(s=>inside(m.spawn,s.polygon)),'spawn turn is not on gravel');
 assert.equal(lineBlocker(m.spawn,gun.pose,m.geometry),'split-warehouse','no spawn shot or spawn attack');
 for(let i=0;i<16;i++){
  const pose={...m.spawn,yaw:i*Math.PI/8},to={...m.spawn,yaw:(i+1)*Math.PI/8},turret={yawRel:0,elevation:0,recoil:0,recoilVelocity:0};
  assert.equal(world.sweepHullAndAttachedGun({pose,turret},{pose:to,turret}).blocked,false,'safe full spawn pivot');
 }
 world.dispose();
});

test('002 east exposes a still-armored gun at its first shoulder while west genuinely screens the equivalent position',()=>{
 const m=mission(),gun=m.entities[0],east={x:11,z:4},west={x:-11,z:4};
 assert.equal(lineBlocker(gun.pose,east,m.geometry),null,'early east exposure');
 assert.equal(lineBlocker(gun.pose,west,m.geometry),'west-sight-screen','early west protection');
 assert.equal(inShield(gun,east),true,'east must still require a flank, not a free kill');
 assert.equal(inShield(gun,west),true);
 assert.ok(Math.hypot(east.x-m.spawn.x,east.z-m.spawn.z)<20,'decision is reachable near the fork');
});

function approaches(m){return [m.witness.phases[0].tankWaypoints.filter((p,i,a)=>!i||p.x!==a[i-1].x||p.z!==a[i-1].z),...m.design.alternatives.map(a=>a.points.map(([x,z])=>({x,z})))];}
for(const side of [0,1])test(`002 ${side===0?'west':'east'} actual approach and nearby firing poses clear hull, barrel and aiming sweeps`,()=>{
 const m=mission(),gun=m.entities[0],points=approaches(m)[side],end=points.at(-1),world=createWorld(m);
 assert.equal(lineBlocker(gun.pose,end,m.geometry),null);
 assert.equal(inShield(gun,end),false,'side shot must beat the unchanged armor');
 assert.equal(pathBlocker(trace(points),m.geometry,m.bounds),null);
 for(const dz of [-.8,0,.8])for(const dx of [-.8,0,.8]){
  const pose={x:end.x+dx,y:0,z:end.z+dz,yaw:0},turret={yawRel:0,elevation:0,recoil:0,recoilVelocity:0};
  assert.equal(world.sweepTurretAtHull(pose,turret,{...turret,yawRel:yawTo(pose,gun.pose)}).blocked,false,'nearby firing positions allow a full aiming sweep');
 }
 world.dispose();
});
test('002 actual approach lanes allow half-metre lateral drift rather than a precision wall scrape',()=>{
 const m=mission();for(const points of approaches(m))for(const drift of[-.5,.5]){
  const shifted=points.map((p,i)=>({...p,x:p.x+(i?drift:0)}));
  assert.equal(pathBlocker(trace(shifted),m.geometry,m.bounds),null,`lane ending ${points.at(-1).x}: drift ${drift}`);
 }
});

import {createProductionCamera,projectPoint} from './helpers/production-camera.mjs';
test('002 normal side-shot poses keep the enemy in the unchanged portrait camera instead of requiring blind aim',()=>{
 const m=mission(),gun=m.entities[0];
 const poses=[m.witness.phases[0].firingPoses[0],...m.design.alternatives.map(a=>({x:a.points.at(-1)[0],z:a.points.at(-1)[1]}))];
 for(const pose of poses)for(const aspect of [16/9,390/844,3/4]){
  const camera=createProductionCamera()({pose:{...pose,y:0,yaw:0},turret:{yawRel:yawTo(pose,gun.pose)}},aspect);
  const target=projectPoint(camera,{...gun.pose,y:1.1});
  assert.ok(target.inFrustum&&Math.abs(target.x)<.9,`${pose.x},${pose.z} aspect ${aspect}: enemy NDC ${target.x},${target.y}`);
 }
});

test('002 side-shot arrivals show the target before aiming, so a portrait player need not acquire an offscreen target',()=>{
 const m=mission(),gun=m.entities[0],main=m.witness.phases[0].tankWaypoints.at(-1);
 const ends=[main,...m.design.alternatives.map(a=>{const points=a.points.map(([x,z])=>({x,z}));return {...points.at(-1),yaw:yawTo(points.at(-2),points.at(-1))};})];
 for(const pose of ends){
  const camera=createProductionCamera()({pose:{...pose,y:0},turret:{yawRel:0}},390/844),target=projectPoint(camera,{...gun.pose,y:1.1});
  assert.ok(target.inFrustum&&Math.abs(target.x)<.9,`before aim ${pose.x},${pose.z}: target NDC ${target.x},${target.y}`);
 }
});

import {createGame,stepGame} from '../src/campaign-simulation.js';
import {getTankTransform,DEFAULT_CONFIG} from '../src/tank-controller.js';
// Isolated combat fixtures only: changed initial spawn tests a specific geometric
// relationship. These are NOT winning route tapes, teleports or pacing evidence.
function shotProbe(pose){
 const m=structuredClone(mission()),gun=m.entities[0];m.spawn={...pose,y:0,yaw:yawTo(pose,gun.pose)};
 const world=createWorld(m);let state=createGame(m);const events=[];state=stepGame(state,{start:true},1/60,world);
 for(let i=0;i<240;i++){
  const aim={worldPoint:{...gun.pose,y:1.1}},muzzle=getTankTransform(state.tank,DEFAULT_CONFIG.rig),dx=aim.worldPoint.x-muzzle.position.x,dy=aim.worldPoint.y-muzzle.position.y,dz=aim.worldPoint.z-muzzle.position.z;
  const dot=(dx*muzzle.direction.x+dy*muzzle.direction.y+dz*muzzle.direction.z)/Math.hypot(dx,dy,dz);
  state=stepGame(state,{brake:true,aim,firePressed:state.tankCombat.shotsFired===0&&dot>.9995},1/60,world);events.push(...state.events);
 }
 world.dispose();return {state,events};
}
test('002 early east shoulder really returns a shield impact; equivalent west point really intercepts the shell with its wall',()=>{
 const east=shotProbe({x:11,z:4}),west=shotProbe({x:-11,z:4});
 assert.ok(east.events.some(e=>e.type==='impact'&&e.targetId==='armored-yard-gun'&&e.value==='shield'));
 assert.equal(east.state.entities['armored-yard-gun'].hp,90);
 assert.ok(west.events.some(e=>e.type==='impact'&&e.targetId==='west-sight-screen'));
 assert.equal(west.state.entities['armored-yard-gun'].hp,90);
 assert.ok(east.events.some(e=>e.type==='shot'&&e.entityId==='armored-yard-gun'),'east attracts real fire');
 assert.ok(!west.events.some(e=>e.type==='shot'&&e.entityId==='armored-yard-gun'),'west is screened, not just labeled safe');
});
test('002 actual side shots damage the original 90-HP armored gun by the unchanged 45 damage',()=>{
 const m=mission(),points=[m.witness.phases[0].firingPoses[0],...m.design.alternatives.map(a=>({x:a.points.at(-1)[0],z:a.points.at(-1)[1]}))];
 for(const p of points){const r=shotProbe(p);assert.equal(r.state.entities['armored-yard-gun'].hp,45);assert.ok(r.events.some(e=>e.type==='damaged'&&e.targetId==='armored-yard-gun'&&e.value===45));}
});
