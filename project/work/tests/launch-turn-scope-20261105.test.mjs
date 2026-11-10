import test from 'node:test';
import assert from 'node:assert/strict';
import {createTank,stepTank} from '../src/tank-controller.js';
import {stepTank as parentStep} from './fixtures/launch-turn-parent-controller-20261105.js';
import {listPlayerVehicles,getPlayerVehicle} from '../src/player-vehicles-v3.js';
import {createWorld} from '../src/campaign-world.js';
const DT=1/60,EPS=1e-9;
const yaw=(s,c)=>(s.vR-s.vL)/c.trackGauge;
const surface=()=>createWorld({surfaces:[{id:'earth',class:'earth',traction:.76,drag:1.35,polygon:[{x:-100,z:-100},{x:100,z:-100},{x:100,z:100},{x:-100,z:100}]}]});

test('captured Sandfalcon pivot-to-drive retains inherited turn reduction, independently of replay outcome',()=>{
 const c=getPlayerVehicle('sandfalcon').controller,state=createTank({x:0,y:.008,z:23,yaw:-.6604266666670213});
 state.vL=.5640613954508495;state.vR=-.5640613954508495;
 state.turret.yawRel=-.4457508605127902;state.turret.elevation=.07292211793806533;
 const input={throttle:1,steer:1,brake:false,aim:{worldPoint:{x:26.832815729997474,y:3.008,z:9.583592135001263}}},env=surface();
 try{assert.deepEqual(stepTank(state,input,DT,env,c),parentStep(state,input,DT,env,c));}finally{env.dispose();}
});

for(const vehicle of listPlayerVehicles()){
 const c=vehicle.controller;
 test(`${vehicle.id}: adding forward/reverse drive to a full pivot preserves inherited over-rotation behavior`,()=>{
  for(const steer of [-1,1]){
   let pivot=createTank();for(let i=0;i<120;i++)pivot=parentStep(pivot,{steer},DT,undefined,c).state;
   for(const throttle of [-1,1])for(const governor of ['crawl','cruise','travel']){
    const input={throttle,steer,governor};
    assert.deepEqual(stepTank(pivot,input,DT,undefined,c),parentStep(pivot,input,DT,undefined,c));
   }
  }
 });
 test(`${vehicle.id}: launch response is continuous through tiny opposite, zero and same-direction old yaw`,()=>{
  for(const throttle of [-1,1])for(const steer of [-1,1])for(const governor of ['crawl','cruise','travel']){
   const results=[];
   for(const oldYaw of [-1e-7,0,1e-7]){
    const state=createTank();state.vL=throttle*.1-c.trackGauge*oldYaw/2;state.vR=throttle*.1+c.trackGauge*oldYaw/2;
    const result=stepTank(state,{throttle,steer,governor},DT,undefined,c);results.push(result);
    assert.ok(result.frame.yawRate*steer < -1e-6,'tiny opposite residual must not suppress requested turn');
    assert.ok(Math.abs(result.state.vL-state.vL)<=c.accel*DT+EPS);
    assert.ok(Math.abs(result.state.vR-state.vR)<=c.accel*DT+EPS);
    assert.ok(Math.abs(yaw(result.state,c)-oldYaw)<=c.maxYawAccel*DT+EPS);
   }
   // An epsilon-sized perturbation changes the response by epsilon scale, not
   // a full acceleration tick. This catches an artificial oldYaw-sign gate.
   assert.ok(Math.abs(results[0].frame.yawRate-results[2].frame.yawRate)<3e-7);
   assert.ok(Math.abs(results[0].frame.speedForward-results[2].frame.speedForward)<3e-7);
  }
 });
 test(`${vehicle.id}: opposite steering builds gradually and a released steer retains parent behavior`,()=>{
  let state=createTank();
  for(let n=0;n<150;n++){
   const steer=n<50?1:n<100?-1:1,input={throttle:1,steer},before=state;
   const result=stepTank(state,input,DT,undefined,c);state=result.state;
   assert.ok(Math.abs(state.vL-before.vL)<=c.accel*DT+EPS);
   assert.ok(Math.abs(state.vR-before.vR)<=c.accel*DT+EPS);
   assert.ok(Math.abs(yaw(state,c)-yaw(before,c))<=c.maxYawAccel*DT+EPS);
  }
  assert.deepEqual(stepTank(state,{throttle:1},DT,undefined,c),parentStep(state,{throttle:1},DT,undefined,c));
 });
}
