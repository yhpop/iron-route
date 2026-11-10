import test from 'node:test';import assert from 'node:assert/strict';import {existsSync} from 'node:fs';
import {createWorld as original} from '../src/campaign-world.js';import {DEFAULT_CONFIG} from '../src/tank-controller.js';
const url=new URL('../src/campaign-world-accelerated.js',import.meta.url),rig=DEFAULT_CONFIG.rig;
const tank=(x=0,z=0,yaw=0,y=0,joint=0,elevation=0)=>({pose:{x,y,z,yaw},turret:{yawRel:joint,elevation,recoil:0,recoilVelocity:0}});
const outcome=fn=>{try{return {returned:fn()};}catch(e){return {threw:{name:e.name,message:e.message}};}};
async function accelerated(){assert.ok(existsSync(url),'Missing accelerated collision module: implement atomic dynamic bound snapshots');return (await import(url)).createWorld;}
test('compound tanks and trucks refresh every successful snapshot; failures and caller mutations preserve prior cache',async(t)=>{
 const create=await accelerated(),geometry=[{id:'same-owner',kind:'box',x:0,z:-5,y:0,width:1,depth:1,height:2}],a=original({geometry}),b=create({geometry});
 let comparisons=0;
 const call=(name,...args)=>{assert.deepStrictEqual(outcome(()=>b[name](...args)),outcome(()=>a[name](...args)),name);comparisons++;};
 const query=()=>{for(const ignores of [[],['moving'],['truck'],['same-owner'],['moving','truck','same-owner']]){call('sweepHullAndAttachedGun',tank(),tank(.03,-.2,.04),rig,ignores);call('muzzleContacts',tank(),rig,ignores);call('raycast',{x:0,y:1,z:0},{x:0,y:1,z:-10},ignores);call('isRouteClear',[{x:0,z:0,yaw:0},{x:0,z:-.1,yaw:0}],{width:2,depth:3,height:1},ignores);}call('sweepTurretAtHull',tank().pose,tank().turret,tank(0,0,0,0,.1,.1).turret,rig);call('hullContacts',tank());call('muzzleClear',tank());};
 for(let i=0;i<30;i++){
  const moving={id:'moving',kind:'tank',hp:100,...tank(i%3===0?0:10,-2,i*.2,i%4===0?4:0,i*.1,(i%5)*.1),rig:structuredClone(rig)};
  const truck={id:'truck',kind:'truck',hp:100,pose:{x:i%2?0:15,y:i%3,z:-3,yaw:i*.13},width:2,depth:3,height:2};
  const same={id:'same-owner',kind:'tank',hp:100,...tank(0,-2,0,0,Math.PI/2)};
  const list=[moving,truck,same];call('setEntities',list);query();
  // None of these objects may alias the private primitive snapshot or its bounds.
  moving.pose.x=300;moving.pose.y=50;moving.turret.yawRel=2;moving.rig.hullProxy.width=300;truck.pose.z=200;query();
  // flatMap validation throws after one valid entity: BOTH previous snapshots survive.
  call('setEntities',[{...truck,pose:{x:100,y:0,z:100,yaw:0}},{id:'invalid',x:NaN,z:0}]);query();
  call('setDestroyed',['same-owner','moving','truck']);query();call('setDestroyed',[]);
  for(const state of [{hp:0},{hp:-1},{destroyed:true},{alive:false},{kind:'barrier'},{hp:100}]){call('setEntities',list.map(e=>({...e,...state})));query();}
  call('setEntities',[]);query();call('setEntities',list);query();
 }
 for(const basis of [{right:[1,0,0],up:[0,.98,.2],forward:[0,-.2,.98]},{right:[.98,.2,0],up:[-.2,.98,0],forward:[0,0,1]}]){const e={id:'moving',kind:'tank',hp:1,...tank(0,-2,.2,0,.3,.2),rig:structuredClone(rig)};e.pose.basis=basis;call('setEntities',[e]);query();basis.right[0]=100;e.pose.basis.up[1]=-10;e.rig.barrelCapsule.radius=500;query();call('setEntities',[e]);query();}
 // Unsupported dimensions and nonfinite yaw are original-narrowphase fallbacks, not rejected entities.
 for(const extra of [{width:-2,depth:2},{width:Infinity,depth:2},{height:NaN},{yaw:Infinity}]){call('setEntities',[{id:'odd',kind:'truck',x:0,y:0,z:-2,...extra}]);query();}
 assert.ok(comparisons>8000);call('dispose');call('setEntities',[]);call('setDestroyed',[]);t.diagnostic(`whole dynamic public outcomes compared: ${comparisons}`);
});
