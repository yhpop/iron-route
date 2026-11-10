import test from 'node:test';
import assert from 'node:assert/strict';
import {createTank,stepTank,wrapAngle,getTankTransform} from '../src/tank-controller.js';
import {stepTank as parentStep} from './fixtures/launch-turn-parent-controller-20261105.js';
import {listPlayerVehicles} from '../src/player-vehicles-v3.js';
import {createWorld} from '../src/campaign-world.js';

const DT=1/60, EPS=1e-9;
const mean=s=>(s.vL+s.vR)/2;
const yaw=(s,c)=>(s.vR-s.vL)/c.trackGauge;
const advance=(state,input,ticks,config,env,step=stepTank)=>{
  let result;
  for(let n=0;n<ticks;n++) {result=step(state,input,DT,env,config);state=result.state;}
  return result;
};

// Regression: independent equal per-track increments erased the steering target
// during powered launch. Use the real controller and real vehicle tuning.
for(const vehicle of listPlayerVehicles())for(const governor of ['crawl','cruise','travel'])
for(const throttle of [1,-1])for(const steer of [1,-1])
test(`${vehicle.id}/${governor}: ${throttle>0?'forward':'reverse'} launch ${steer>0?'right':'left'} steers on its first sampled step`,()=>{
  const c=vehicle.controller,input={throttle,steer,governor};
  const first=stepTank(createTank(),input,DT,undefined,c);
  assert.ok(first.frame.yawRate*steer < -1e-8,'sampled steer must produce signed yaw, not equal accelerated tracks');
  assert.ok(mean(first.state)*throttle>0,'powered launch must also translate');
  const run=advance(createTank(),input,29,c);
  assert.ok(run.state.pose.yaw*steer < -1e-5,'steering must remain effective through the native 29-step launch interval');
  assert.ok(Math.hypot(run.state.pose.x,run.state.pose.z)>0);
  assert.ok(Math.abs(first.state.vL)<=c.accel*DT+EPS);
  assert.ok(Math.abs(first.state.vR)<=c.accel*DT+EPS);
  assert.ok(Math.abs(first.frame.yawRate)<=c.maxYawAccel*DT+EPS);
});

for(const vehicle of listPlayerVehicles()){
 const c=vehicle.controller;
 test(`${vehicle.id}: D-only pivots and coast/brake/reverse interlock remain exactly the parent behavior`,()=>{
  const states=[createTank()];
  states.push(advance(createTank(),{throttle:1},120,c,undefined,parentStep).state);
  states.push(advance(createTank(),{throttle:1,steer:1},100,c,undefined,parentStep).state);
  states.push(advance(createTank(),{steer:1},20,c,undefined,parentStep).state);
  for(const input of [{steer:1},{steer:-1},{},{throttle:1},{throttle:1,brake:true},{throttle:-1,brake:true},{paused:true,throttle:1,steer:1}])
   for(const state of states)assert.deepEqual(stepTank(state,input,DT,undefined,c),parentStep(state,input,DT,undefined,c));
  // Preserve every reversing tick, including the true stop before reverse drive.
  let state=states[2],sawStop=false;
  for(let n=0;n<300;n++){
   const input={throttle:-1,steer:-1},before=state;
   const result=stepTank(state,input,DT,undefined,c);
   if(mean(before)>1e-10)assert.deepEqual(result,parentStep(before,input,DT,undefined,c));
   state=result.state;
   if(Math.abs(mean(state))<1e-10)sawStop=true;
   if(mean(state)<-1e-8){assert.ok(sawStop,'reverse traction requires a zero-mean step');break;}
  }
  assert.ok(sawStop);
 });
 test(`${vehicle.id}: driven launch obeys track acceleration, angular acceleration, governor/reverse caps and true arc odometry`,()=>{
  for(const dt of [1/120,DT,.05,.1])for(const governor of ['crawl','cruise','travel'])for(const throttle of [1,-1]){
   let state=createTank();
   const cap=throttle>0?c.governorCaps[governor]:c.reverseCap;
   for(let n=0;n<120;n++){
    const before=state,result=stepTank(state,{throttle,steer:n<60?1:-1,governor},dt,undefined,c);state=result.state;
    assert.ok(Math.abs(state.vL-before.vL)<=c.accel*dt+EPS,'left track slew');
    assert.ok(Math.abs(state.vR-before.vR)<=c.accel*dt+EPS,'right track slew');
    assert.ok(Math.abs(yaw(state,c)-yaw(before,c))<=c.maxYawAccel*dt+EPS,'angular slew');
    assert.ok(Math.max(Math.abs(state.vL),Math.abs(state.vR))<=cap+EPS,'track cap');
    assert.ok(Math.abs(yaw(state,c))<=c.maxYawRate+EPS,'yaw cap');
    const angle=wrapAngle(state.pose.yaw-before.pose.yaw);
    assert.ok(Math.abs((result.frame.deltaTrackR-result.frame.deltaTrackL)/c.trackGauge-angle)<EPS,'accepted odometry');
   }
  }
 });
 test(`${vehicle.id}: released steer, opposite turn, governor reduction and surface deceleration keep parent semantics`,()=>{
  const fast=advance(createTank(),{throttle:1,governor:'travel'},240,c,undefined,parentStep).state;
  const turning=advance(createTank(),{throttle:1,steer:1},200,c,undefined,parentStep).state;
  const rubble=createWorld({surfaces:[{id:'rubble',class:'rubble',traction:.35,drag:2.5,polygon:[{x:-100,z:-100},{x:100,z:-100},{x:100,z:100},{x:-100,z:100}]}]});
  try{
   for(const [state,input,env] of [[fast,{throttle:1,steer:1,governor:'crawl'}],[fast,{throttle:1,steer:1},rubble],[turning,{throttle:1,steer:-1}],[turning,{throttle:1}],[turning,{steer:1}]])
    assert.deepEqual(stepTank(state,input,DT,env,c),parentStep(state,input,DT,env,c));
  }finally{rubble.dispose();}
 });
 test(`${vehicle.id}: launch correction respects real hull/gun collision acceptance and stores no wall push`,()=>{
  const initial=createTank(),tip=getTankTransform(initial,c.rig).barrelEnd;
  const front=Math.min(tip.z-c.rig.barrelCapsule.radius,c.rig.hullProxy.offset.z-c.rig.hullProxy.depth/2,c.rig.turretPivot.z+c.rig.turretProxy.offset.z-c.rig.turretProxy.depth/2);
  const world=createWorld({geometry:[{id:'launch-wall',kind:'box',x:0,z:front-.6,width:80,depth:.02,height:8}]});
  try{
   assert.equal(world.sweepHullAndAttachedGun(initial,initial,c.rig).blocked,false,'initial hull/gun pose must be clear');
   let state=initial,blocked;
   for(let n=0;n<300;n++){
    const before=state,result=stepTank(state,{throttle:1,steer:1},DT,world,c);state=result.state;
    assert.equal(world.sweepHullAndAttachedGun(state,state,c.rig).blocked,false,'accepted body and gun must remain clear');
    assert.ok(Math.abs(state.vL-result.frame.deltaTrackL/DT)<EPS);
    assert.ok(Math.abs(state.vR-result.frame.deltaTrackR/DT)<EPS);
    assert.ok(Math.abs(wrapAngle(state.pose.yaw-before.pose.yaw)-result.frame.yawRate*DT)<EPS);
    if(result.frame.contacts.includes('launch-wall')){blocked=state;break;}
   }
   assert.ok(blocked,'driven steering must actually encounter the real wall');
   // At a contact, accepted speed rather than pre-collision request is carried forward.
   for(let n=0;n<30;n++)state=stepTank(state,{throttle:1,steer:1},DT,world,c).state;
   const stopped=state;
   assert.ok(Math.max(Math.abs(stopped.vL),Math.abs(stopped.vR))<1e-5,'contact must not accumulate virtual track speed');
   world.setDestroyed(['launch-wall']);
   const released=stepTank(stopped,{throttle:1,steer:1},DT,world,c);
   assert.ok(Math.abs(released.state.vL-stopped.vL)<=c.accel*DT+EPS);
   assert.ok(Math.abs(released.state.vR-stopped.vR)<=c.accel*DT+EPS);
  }finally{world.dispose();}
 });
 test(`${vehicle.id}: low-throttle pivots stay inherited, signed yaw crosses wrap, and opposite yaw decelerates within limits`,()=>{
  for(const throttle of [-.1,.1])assert.deepEqual(stepTank(createTank(),{throttle,steer:1},DT,undefined,c),parentStep(createTank(),{throttle,steer:1},DT,undefined,c));
  const opposite=createTank();opposite.vL=.1;opposite.vR=.3;
  const next=stepTank(opposite,{throttle:1,steer:1},DT,undefined,c).state;
  assert.ok(yaw(next,c)>0,'opposite angular inertia must not snap through zero');
  assert.ok(yaw(next,c)<yaw(opposite,c),'right steer must reduce previous left yaw');
  assert.ok(yaw(opposite,c)-yaw(next,c)<=c.maxYawAccel*DT+EPS);
  const nearWrap=createTank({yaw:-Math.PI+1e-6});
  const wrapped=stepTank(nearWrap,{throttle:1,steer:1},DT,undefined,c);
  assert.ok(wrapped.state.pose.yaw>0,'small right turn crosses -PI continuously');
  assert.ok(wrapped.frame.yawRate<0);
  const origin=stepTank(createTank(),{throttle:1,steer:1},DT,undefined,c);
  assert.ok(Math.abs(wrapped.state.vL-origin.state.vL)<EPS);
  assert.ok(Math.abs(wrapped.state.vR-origin.state.vR)<EPS);
 });
}

test('invalid dt stays rejected and input sanitization cannot inject non-finite launch motion',()=>{
 const c=listPlayerVehicles()[0].controller;
 for(const dt of [0,-1,.10001,NaN,Infinity])assert.throws(()=>stepTank(createTank(),{throttle:1,steer:1},dt,undefined,c),RangeError);
 const state=stepTank(createTank(),{throttle:NaN,steer:Infinity},DT,undefined,c).state;
 assert.equal(state.vL,0);assert.equal(state.vR,0);
});
