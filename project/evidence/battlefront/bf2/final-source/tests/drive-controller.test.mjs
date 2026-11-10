import test from 'node:test';
import assert from 'node:assert/strict';
import * as drive from '../src/tank-controller.js';
import * as collision from '../src/campaign-world.js';
const DT = 1 / 60;
const empty = () => collision.createWorld({geometry:[]});
const advance = (state, input, ticks, env = empty()) => {
  let result;
  for (let i=0;i<ticks;i++) { result = drive.stepTank(state,input,DT,env); state=result.state; }
  return result;
};
const speed = tank => (tank.vL+tank.vR)/2;

test('module exposes the nested deterministic drive and geometry interfaces', () => {
  assert.equal(typeof drive.createTank,'function');
  assert.equal(typeof drive.stepTank,'function');
  assert.equal(typeof collision.createWorld,'function');
});
test('forward acceleration takes time, coasts, and never mutates the old snapshot', () => {
  const initial = drive.createTank({x:2,y:0,z:3,yaw:0});
  const copy = structuredClone(initial);
  const first = advance(initial,{throttle:1},1);
  assert.deepEqual(initial,copy);
  assert.ok(speed(first.state)>0 && speed(first.state)<0.03);
  assert.equal(first.state.pose.x,2);
  assert.ok(first.state.pose.z<3);
  const atSpeed = advance(initial,{throttle:1},120).state;
  assert.ok(Math.abs(speed(atSpeed)-2.2)<1e-8);
  const coast = advance(atSpeed,{},1).state;
  assert.ok(speed(coast)>2 && speed(coast)<speed(atSpeed));
  assert.ok(coast.trackL>atSpeed.trackL);
});
test('reverse input brakes to zero before building signed reverse travel', () => {
  let state = advance(drive.createTank(),{throttle:1},120).state;
  let sawStop=false;
  for(let i=0;i<130;i++) {
    const before=speed(state);
    state=advance(state,{throttle:-1},1).state;
    if(Math.abs(speed(state))<1e-8) sawStop=true;
    if(speed(state)<0) { assert.equal(sawStop,true); assert.ok(before<=0.05); break; }
  }
  state=advance(state,{throttle:-1},180).state;
  assert.ok(Math.abs(speed(state)+1.1)<1e-8);
});
test('governor and boost change target speed, not instantaneous velocity or yaw ability', () => {
  const cruise=advance(drive.createTank(),{throttle:1},120).state;
  const boosted=advance(cruise,{throttle:1,boost:true},1);
  assert.ok(speed(boosted.state)<2.23);
  assert.equal(boosted.frame.boostActive,true);
  const travel=advance(cruise,{throttle:1,governor:'travel'},120).state;
  assert.ok(Math.abs(speed(travel)-3)<1e-8);
  const crawl=advance(travel,{throttle:1,governor:'crawl'},1).state;
  assert.ok(speed(crawl)>2.9 && speed(crawl)<3);
  assert.equal(advance(travel,{throttle:1,steer:1,boost:true},1).frame.boostActive,false);
});
test('stationary right pivot counter-rotates accepted belts without translation', () => {
  const result=advance(drive.createTank(),{steer:1},120);
  assert.ok(result.state.pose.yaw<-0.9);
  assert.equal(result.state.pose.x,0);
  assert.equal(result.state.pose.z,0);
  assert.ok(result.state.trackL>0 && result.state.trackR<0);
  assert.ok(Math.abs(result.state.trackL+result.state.trackR)<1e-10);
  assert.ok(Math.abs(result.frame.yawRate)<=0.7+1e-10);
});
test('drive curve follows a true arc with track-gauge-consistent odometry, no strafing', () => {
  const state=drive.createTank(); state.vL=1; state.vR=2;
  const env=empty();
  const r=drive.stepTank(state,{throttle:1,steer:-0.5},DT,env);
  const d=(r.frame.deltaTrackL+r.frame.deltaTrackR)/2;
  const a=r.state.pose.yaw;
  assert.ok(Math.abs(r.state.pose.x-d*(Math.cos(a)-1)/a)<1e-10);
  assert.ok(Math.abs(r.state.pose.z+d*Math.sin(a)/a)<1e-10);
  assert.ok(Math.abs((r.frame.deltaTrackR-r.frame.deltaTrackL)/drive.DEFAULT_CONFIG.trackGauge-a)<1e-10);
});
test('independent turret tracks a fixed world target while hull turns and elevation is bounded', () => {
  const aim={worldPoint:{x:12,y:3,z:-12}};
  const r=advance(drive.createTank(),{throttle:0.6,steer:0.3,aim},180);
  const p=r.frame.muzzleWorld.position;
  const d=r.frame.muzzleWorld.direction;
  const to={x:12-p.x,y:3-p.y,z:-12-p.z};
  const n=Math.hypot(to.x,to.y,to.z);
  assert.ok((d.x*to.x+d.y*to.y+d.z*to.z)/n>0.995);
  assert.ok(Math.abs(r.state.turret.yawRel)>0.1);
  assert.ok(r.state.turret.elevation<=25*Math.PI/180);
  assert.ok(r.state.turret.elevation>=-8*Math.PI/180);
});
test('pause cannot move, aim, change governor, consume recoil, or fire', () => {
  const state=advance(drive.createTank(),{throttle:1,firePressed:true},1).state;
  const r=drive.stepTank(state,{paused:true,governor:'travel',firePressed:true,aim:{worldPoint:{x:99,y:99,z:99}}},DT,empty());
  assert.deepEqual(r.state,state);
  assert.deepEqual(r.events,[]);
});
test('invalid inputs stay finite and fixed-tick replays ignore render batching', () => {
  const initial=drive.createTank({x:NaN,y:Infinity,z:undefined,yaw:NaN});
  const r=advance(initial,{throttle:NaN,steer:Infinity,aim:{worldPoint:{x:NaN,y:1,z:2}}},1);
  assert.ok(Object.values(r.state.pose).every(Number.isFinite));
  const ticks=Array.from({length:240},(_,i)=>({throttle:i<160?1:-1,steer:i>90?0.4:0,boost:i<60}));
  const run=chunk=>{let state=drive.createTank();const w=empty(); for(let f=0;f<ticks.length;f+=chunk)for(const input of ticks.slice(f,f+chunk)) state=drive.stepTank(state,input,DT,w).state; return state;};
  assert.deepEqual(run(1),run(2)); assert.deepEqual(run(1),run(4));
});
test('a blocked drive stops accepted tracks and cannot store a release-launch surge', () => {
  const world=collision.createWorld({geometry:[{id:'wall',kind:'box',x:0,z:-4,width:12,depth:.02,height:4}]});
  let result=advance(drive.createTank(),{throttle:1,boost:true},240,world);
  assert.ok(result.state.blocked.body || result.state.blocked.barrel);
  assert.ok(Math.abs(speed(result.state))<1e-5);
  const atWall=structuredClone(result.state);
  result=advance(result.state,{throttle:1,boost:true},30,world);
  assert.ok(Math.abs(result.state.trackL-atWall.trackL)<1e-5);
  world.setDestroyed(['wall']);
  result=advance(result.state,{throttle:1,boost:true},1,world);
  assert.ok(speed(result.state)<0.03);
});
test('fire uses the accepted muzzle and starts recoil only on an unobstructed shot', () => {
  const state=drive.createTank();
  const shot=advance(state,{firePressed:true},1);
  assert.equal(shot.events.length,1); assert.equal(shot.events[0].type,'fire');
  assert.ok(shot.state.turret.recoil>0);
  assert.deepEqual(shot.events[0].muzzle.position,shot.frame.muzzleWorld.position);
  const muzzle=drive.getTankTransform(state).position;
  const world=collision.createWorld({geometry:[{id:'tip',kind:'box',x:muzzle.x,z:muzzle.z-.12,y:muzzle.y-.2,width:.3,depth:.1,height:.4}]});
  const blocked=advance(state,{firePressed:true},1,world);
  assert.equal(blocked.events[0].type,'fire-blocked');
  assert.equal(blocked.state.turret.recoil,0);
});

test('authored rubble reduces acceleration, capped speed and yaw but keeps the same drive bounds',()=>{
  const polygon=[{x:-100,z:-100},{x:100,z:-100},{x:100,z:100},{x:-100,z:100}];
  const road=empty(),rubble=collision.createWorld({surfaces:[{id:'rubble',class:'rubble',traction:.65,drag:1.5,polygon}]});
  const initial=drive.createTank();
  const firstRoad=advance(initial,{throttle:1},1,road),firstRubble=advance(initial,{throttle:1},1,rubble);
  assert.ok(speed(firstRubble.state)<speed(firstRoad.state)*.8);
  assert.ok(speed(firstRubble.state)>0);
  const roadCruise=advance(initial,{throttle:1},240,road),rubbleCruise=advance(initial,{throttle:1},240,rubble);
  assert.ok(speed(rubbleCruise.state)<speed(roadCruise.state)*.7);
  assert.equal(rubbleCruise.frame.surface.id,'rubble');
  const pivotRoad=advance(initial,{steer:1},120,road),pivotRubble=advance(initial,{steer:1},120,rubble);
  assert.ok(Math.abs(pivotRubble.frame.yawRate)<Math.abs(pivotRoad.frame.yawRate));
  assert.ok(Math.abs(pivotRubble.frame.yawRate)<=drive.DEFAULT_CONFIG.maxYawRate);
  const reverse=advance(initial,{throttle:-1},240,rubble);
  assert.ok(speed(reverse.state)>=-drive.DEFAULT_CONFIG.reverseCap);
  const edge=drive.createTank({x:101,z:0,yaw:0});
  assert.deepEqual(advance(edge,{throttle:1,steer:.3},30,rubble).state,advance(edge,{throttle:1,steer:.3},30,road).state);
});

test('entering rubble lowers target smoothly instead of snapping stored speed',()=>{
  const polygon=[{x:-100,z:-100},{x:100,z:-100},{x:100,z:100},{x:-100,z:100}];
  const rubble=collision.createWorld({surfaces:[{id:'rubble',class:'rubble',traction:.65,drag:1.5,polygon}]});
  const moving=advance(drive.createTank(),{throttle:1,governor:'travel'},240).state;
  const after=advance(moving,{throttle:1},1,rubble);
  assert.ok(speed(after.state)<speed(moving));
  assert.ok(speed(after.state)>speed(moving)-.05);
  assert.ok(after.frame.desiredSpeed<2);
});

test('real runtime truck cannot trap a stationary sideways barrel or prevent reverse escape',async()=>{
  const {createGame,stepGame}=await import('../src/campaign-simulation.js');
  const spec={schema:1,id:'barrel-escape',seed:1,spawn:{x:3,y:0,z:0,yaw:Math.PI/2},geometry:[],surfaces:[],zones:[],objectives:[],routes:[{id:'crossing',width:7,points:[{x:0,z:8},{x:0,z:-8}]}],entities:[{id:'truck',kind:'truck',pose:{x:0,z:8,yaw:0},routeId:'crossing',hp:70}]};
  const world=collision.createWorld(spec);let state=stepGame(createGame(spec),{start:true},DT,world);
  for(let tick=0;tick<500;tick++)state=stepGame(state,{},DT,world);
  assert.ok(state.entities.truck.pose.z>1.9);
  assert.equal(state.tank.blocked.barrel,false);
  for(let tick=0;tick<10;tick++)state=stepGame(state,{throttle:-1},DT,world);
  assert.ok(state.tank.pose.x>3.01,`reverse was trapped at x=${state.tank.pose.x}`);
  assert.equal(state.tank.blocked.barrel,false);
  world.dispose();
});
