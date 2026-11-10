import test from 'node:test';
import assert from 'node:assert/strict';
import {createEightNpcCrossfire} from '../src/eight-npc-crossfire-front.js';
import {withPlayerVehicle,getPlayerVehicle} from '../src/player-vehicles-v3.js';
import {createTerrainCombatWorld} from '../src/terrain-candidate/combat-world-accelerated.js';
import {createTerrainCombatWorld as referenceWorld} from '../src/terrain-candidate/combat-world.js';
import {sampleHeightfield} from '../src/terrain-candidate/heightfield.js';
import {createTank,stepTank,getTankTransform} from '../src/tank-controller.js';
const DT=1/60,{spec:base,field}=createEightNpcCrossfire(),vehicle=getPlayerVehicle('newc-tiger'),config=vehicle.controller;
// This is an observed-pose mechanics fixture, NOT the original Mac input replay.
// Rounded telemetry has no lastAim or full history. Reconstructed barrel endpoints
// match the reported values to < 0.5 micrometres. Aim below is an explicit test input.
function fixture(factory=createTerrainCombatWorld,extraGeometry=[]){
 const spec=withPlayerVehicle(base,vehicle.id);spec.geometry.push(...extraGeometry);const world=factory(spec,field),state=createTank({x:8.105954608,y:.294153078,z:-7.583887789,yaw:.337857932});
 state.pose=world.groundPose(state.pose);state.turret={yawRel:2.060644255,elevation:-.118368584,recoil:.08,recoilVelocity:0};state.terrainTravelElevation=-.028368584;
 const x=5.105954608,z=-7.583887789,input={throttle:1,aim:{worldPoint:{x,y:sampleHeightfield(field,x,z).height,z}}};
 return {world,state,input};
}
test('observed clear pose has a rejected combined yaw/lift/return but a valid elevation-only escape',()=>{
 const {world,state}=fixture();try{
  const t=getTankTransform(state,config.rig);for(const [p,want] of [[t.barrelStart,{x:7.742168,y:1.635979,z:-7.052077}],[t.barrelEnd,{x:6.200367,y:1.646999,z:-5.392390}]])for(const k of ['x','y','z'])assert.ok(Math.abs(p[k]-want[k])<.0000005);
  assert.deepEqual(world.muzzleContacts(t,config.rig).contacts,[]);
  const desired={...state.turret,yawRel:state.turret.yawRel-.0125,elevation:state.turret.elevation+.01,recoil:.07278367916551601,recoilVelocity:-.7278367916551601};
  assert.deepEqual(world.sweepTurretAtHull(state.pose,state.turret,desired,config.rig).contacts,['terrain']);
  const lifted=world.sweepTurretAtHull(state.pose,state.turret,{...state.turret,elevation:desired.elevation},config.rig);
  assert.equal(lifted.blocked,false);assert.ok(lifted.accepted.elevation>state.turret.elevation);
 }finally{world.dispose();}
});
// Removing the independent, swept lift leaves elevation, yaw and recoil unchanged
// despite a valid lift and hundreds of real forward input ticks.
test('terrain recovery uses the available swept lift when simultaneous yaw prevents it',()=>{
 const {world,state,input}=fixture();try{
  const {state:next}=stepTank(state,input,DT,world,config);
  assert.ok(next.turret.elevation>state.turret.elevation+.009,'a rejected yaw must not cancel the available physical lift');
  assert.ok(Math.abs(next.turret.yawRel-state.turret.yawRel)<1e-9,'fallback does not force user yaw through terrain');
  assert.equal(next.turret.recoil,state.turret.recoil,'fallback does not force a blocked combined recoil return');
  assert.deepEqual(world.muzzleContacts(getTankTransform(next,config.rig),config.rig).contacts,[]);
 }finally{world.dispose();}
});
test('held forward and fixed ground aim regain movement and normal recoil after the coupled contact',()=>{
 const f=fixture(),initial=f.state;let s=initial,maximumElevation=s.turret.elevation;try{
  for(let i=0;i<441;i++){const before=s;s=stepTank(s,f.input,DT,f.world,config).state;
   assert.ok(Math.abs(s.turret.elevation-before.turret.elevation)<=config.elevationRate*DT+1e-9);
   assert.ok(s.turret.elevation<=config.elevationLimits[1]);maximumElevation=Math.max(maximumElevation,s.turret.elevation);
   assert.deepEqual(f.world.muzzleContacts(getTankTransform(s,config.rig),config.rig).contacts,[]);
  }
  assert.ok(Math.hypot(s.pose.x-initial.pose.x,s.pose.z-initial.pose.z)>2,'must clear the observed contact rather than retain an active flag without motion');
  assert.equal(s.turret.recoil,0);assert.ok(Math.abs(s.turret.yawRel-initial.turret.yawRel)>.1,'normal user yaw resumes after clearance');assert.ok(maximumElevation<config.elevationLimits[1]);
 }finally{f.world.dispose();}
});
test('coupled recovery agrees between reference and accelerated real collision worlds',()=>{
 const a=fixture(),b=fixture(referenceWorld);try{for(let i=0;i<180;i++){a.state=stepTank(a.state,a.input,DT,a.world,config).state;b.state=stepTank(b.state,b.input,DT,b.world,config).state;assert.deepEqual(a.state,b.state);}}finally{a.world.dispose();b.world.dispose();}
});
test('a real ceiling blocks the fallback lift instead of being ignored for recovery',()=>{
 const ceiling={id:'ceiling-control',kind:'box',x:6.2,z:-5.39,y:1.6469989612468194+config.rig.barrelCapsule.radius+.031,width:.5,depth:.5,height:.2},f=fixture(createTerrainCombatWorld,[ceiling]);let s=f.state,ceilingContact=false;
 try{for(let i=0;i<180;i++){const r=stepTank(s,f.input,DT,f.world,config);s=r.state;ceilingContact ||=r.frame.contacts.includes('ceiling-control');assert.deepEqual(f.world.muzzleContacts(getTankTransform(s,config.rig),config.rig).contacts,[]);}
 assert.ok(ceilingContact);assert.ok(s.turret.elevation-f.state.turret.elevation<.002,'real overhead clearance, not the requested floor, bounds the lift');assert.ok(Math.hypot(s.pose.x-f.state.pose.x,s.pose.z-f.state.pose.z)<.02);
 }finally{f.world.dispose();}
});
test('maximum real elevation remains a physical limit and reverse remains available',()=>{
 const world=createTerrainCombatWorld({playerVehicle:vehicle,geometry:[],bounds:field.bounds},field);let s=createTank({x:9.2,z:4.8,yaw:0});s.pose=world.groundPose(s.pose);s.turret={yawRel:1.5,elevation:.3,recoil:0,recoilVelocity:0};let contact=false;
 try{for(let i=0;i<180;i++){const r=stepTank(s,{throttle:1},DT,world,config);s=r.state;contact ||=r.frame.contacts.includes('terrain');assert.equal(s.turret.elevation,.3);assert.deepEqual(world.muzzleContacts(getTankTransform(s,config.rig),config.rig).contacts,[]);}
 assert.ok(contact);assert.ok(s.pose.z>4.7);const z=s.pose.z;for(let i=0;i<90;i++)s=stepTank(s,{throttle:-1},DT,world,config).state;assert.ok(s.pose.z>z+.3);
 }finally{world.dispose();}
});
test('neutral and brake release the terrain recovery instead of forcing the fallback lift',()=>{
 for(const release of [{throttle:0},{throttle:1,brake:true}]){const f=fixture();try{const r=stepTank(f.state,{...f.input,...release},DT,f.world,config);assert.equal(r.state.terrainTravelElevation,undefined);assert.notEqual(r.frame.terrainTravelClearance,true);assert.equal(r.state.turret.elevation,f.state.turret.elevation);}finally{f.world.dispose();}}
});
import fs from 'node:fs';
import {createGame,stepGame} from '../src/campaign-simulation.js';
test('literal normal aim and real fire from an isolated default-gun spawn do not deadlock recovery',()=>{
 const tape=JSON.parse(fs.readFileSync(new URL('./fixtures/grounded-barrel/coupled-fired-aim.json',import.meta.url))),spec={schema:1,id:'coupled-fire-mechanics-fixture',spawn:tape.spawn,playerVehicle:vehicle,geometry:[],entities:[],routes:[],zones:[],objectives:[],bounds:field.bounds},world=createTerrainCombatWorld(spec,field);
 let s=stepGame(createGame(spec),{start:true},tape.dt,world),assisted=false,shots=0;
 try{for(const run of tape.runs)for(let i=0;i<run.n;i++){
  const before=s;s=stepGame(s,run.input,tape.dt,world);shots+=s.events.filter(e=>e.type==='shot').length;assisted ||=s.tankFrame.terrainTravelClearance===true;
  assert.ok(Math.abs(s.tank.turret.elevation-before.tank.turret.elevation)<=config.elevationRate*tape.dt+1e-9);
  assert.deepEqual(world.muzzleContacts(getTankTransform(s.tank,config.rig),config.rig).contacts,[]);
 }
 assert.equal(shots,1);assert.equal(s.tankCombat.shotsFired,1);assert.ok(assisted);assert.ok(Math.hypot(s.tank.pose.x-tape.spawn.x,s.tank.pose.z-tape.spawn.z)>2,'literal input with one real shot must progress past coupled terrain contact');assert.equal(s.tank.turret.recoil,0);assert.equal(s.tankCombat.hp,155);
 }finally{world.dispose();}
});
