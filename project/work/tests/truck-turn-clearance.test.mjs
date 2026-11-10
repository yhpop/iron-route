import test from 'node:test';import assert from 'node:assert/strict';
import {createGame} from '../src/campaign-simulation.js';
import {stepTrucks} from '../src/mission-runtime.js';
import {syncWorldEntities} from '../src/combat.js';
import {createWorld} from '../src/campaign-world.js';
import {stepTank,DEFAULT_CONFIG} from '../src/tank-controller.js';
function approach(flag,{x=0,turret=0}={}){
 const spec={schema:1,id:'clearance',bounds:{minX:-50,maxX:50,minZ:-50,maxZ:50},spawn:{x,y:0,z:0,yaw:0},geometry:[],entities:[{id:'truck',kind:'truck',pose:{x:0,y:0,z:12,yaw:0},hp:100,routeId:'r',speed:1.15,escortRange:25,...(flag===undefined?{}:{yieldForTankTurn:flag})}],routes:[{id:'r',width:7,points:[{x:0,z:12},{x:0,z:-20}]}],objectives:[],zones:[]};
 const world=createWorld(spec),s=createGame(spec);s.phase='playing';s.tank.turret.yawRel=turret;
 for(let i=0;i<1500;i++){syncWorldEntities(s,world);stepTrucks(s,1/60,world);}syncWorldEntities(s,world);
 return {s,world};
}
test('opt-in convoy leaves actual hull turn room after real truck approach',()=>{
 const {s,world}=approach(true),rig=DEFAULT_CONFIG.rig.hullProxy;
 const radius=Math.hypot(rig.width/2,rig.depth/2)+.2;
 assert.ok(s.entities.truck.pose.z>=s.entities.truck.depth/2+radius);
 for(const steer of [-1,1]){let tank=structuredClone(s.tank);for(let i=0;i<120;i++)tank=stepTank(tank,{steer},1/60,world).state;assert.ok(Math.abs(tank.pose.yaw)>1,'must be able to pivot without touching truck');}
 world.dispose();
});
test('turn room also applies to lateral approach; only exact true opts in',()=>{
 const enabled=approach(true,{x:2.5}),legacy=approach(false,{x:2.5});
 assert.equal(enabled.s.entities.truck.stoppedReason,'tank');assert.ok(enabled.s.entities.truck.pose.z>3);
 assert.ok(legacy.s.entities.truck.pose.z<0);enabled.world.dispose();legacy.world.dispose();
 const old=approach(),off=approach(false),string=approach('true');
 assert.equal(old.s.entities.truck.pose.z,off.s.entities.truck.pose.z);assert.equal(old.s.entities.truck.pose.z,string.s.entities.truck.pose.z);
 assert.ok(Math.abs(old.s.entities.truck.pose.z-3.3000833333332116)<1e-6);
 for(const p of [old,off,string])p.world.dispose();
});
test('yield spacing does not disable body or backward cannon collisions',()=>{
 const {s,world}=approach(true,{turret:Math.PI});
 assert.equal(s.entities.truck.stoppedReason,'obstacle'); // real cannon envelope stops truck, not ignored
 assert.ok(s.entities.truck.pose.z>4.7);
 let tank=structuredClone(s.tank);const before=tank.pose.z;for(let i=0;i<120;i++)tank=stepTank(tank,{throttle:-1},1/60,world).state;
 assert.ok(tank.pose.z-before<.1);assert.ok(tank.blocked.body||tank.blocked.barrel);world.dispose();
 const front=approach(true);let t=front.s.tank;for(let i=0;i<300;i++)t=stepTank(t,{throttle:-1},1/60,front.world).state;
 assert.ok(t.pose.z<1);assert.ok(t.blocked.body||t.blocked.barrel);front.world.dispose();
});
