import test from 'node:test';
import assert from 'node:assert/strict';
import {createCrossfireV3Front} from '../src/crossfire-v3-front.js';
const candidate=await import('../src/crossfire-v4-front.js').catch(()=>null);
const ids=['allied-support','hostile-flanker'];
function fixture(){assert.equal(typeof candidate?.createCrossfireV4Front,'function','independent V4 builder required');return candidate.createCrossfireV4Front();}
test('V4 is a serializable independent V3 wrapper with real patrols and unchanged physical mission',()=>{
 const old=createCrossfireV3Front(),before=structuredClone(old),{spec,field}=fixture();
 assert.equal(spec.id,'mission-9052');assert.equal(spec.index,9052);assert.equal(spec.crossfireV4,true);assert.equal(spec.crossfireV3,true);assert.equal(spec.title,'焦土交叉火线 V4 · 机动接应');
 for(const k of ['spawn','geometry','routes','zones','objectives','convoyChoice','combatRelations'])assert.deepEqual(spec[k],old.spec[k],k);
 assert.deepEqual(field,old.field);assert.deepEqual(JSON.parse(JSON.stringify(spec)),spec);
 for(const e of old.spec.entities){const next=spec.entities.find(n=>n.id===e.id);if(!ids.includes(e.id)){assert.deepEqual(next,e);continue;}const {patrol,pose,...rest}=next,{pose:oldPose,...oldRest}=e;assert.deepEqual(rest,oldRest,'weapons, HP and every non-pose actor field unchanged');if(e.id==='allied-support')assert.deepEqual(pose,oldPose,'ally pose unchanged');else{assert.deepEqual(Object.keys(pose).sort(),['x','y','yaw','z']);assert.deepEqual([pose.x,pose.z],[1.2,16],'parent-reviewed V4-only flanker relocation for actual upright art fit');}assert.ok(Array.isArray(patrol)&&patrol.length>=2);}
 assert.equal(spec.entities.length,old.spec.entities.length);assert.deepEqual(createCrossfireV3Front(),before);
});

import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createTerrainCombatWorld} from '../src/terrain-candidate/combat-world.js';
import {createGame,stepGame,retry} from '../src/campaign-simulation.js';
import {listPlayerVehicles,withPlayerVehicle,playerRig} from '../src/player-vehicles-v3.js';
import {INTERCEPTOR_COLLISION_RIG,interceptorCollider} from '../src/interceptor.js';
import * as THREE from 'three';
import {hullVector,rotateYaw,getTankTransform} from '../src/tank-controller.js';
import {sentryMuzzleTransform} from '../src/sentry-rig.js';
import {createUprightMeshInspector} from '../../evidence/maneuver-v4/upright-mesh-tools.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function setup(vehicle='sandfalcon'){const {spec:base,field}=fixture(),spec=withPlayerVehicle(base,vehicle),world=createTerrainCombatWorld(spec,field);return {spec,field,world,state:stepGame(createGame(spec),{start:true},1/60,world)};}
// Offline current source-camera projection only: not GPU/CSS/device proof.
function assertSourceFrustum(state){for(const [w,h]of [[1280,720],[390,844],[844,390]]){const p=state.tank.pose,a=p.yaw+state.tank.turret.yawRel,target=new THREE.Vector3(p.x-Math.sin(a)*2.2,p.y+.5,p.z-Math.cos(a)*2.2),portrait=w/h<.85,camera=new THREE.PerspectiveCamera(42,w/h,.15,150);camera.position.copy(target).add(new THREE.Vector3(...(portrait?[8,23,22]:[10,19,18])));camera.lookAt(target);camera.updateMatrixWorld();for(const id of ids){const e=state.entities[id],body=interceptorCollider(e),rig=INTERCEPTOR_COLLISION_RIG,points=[];for(const [proxy,pivot,rel]of [[rig.hullProxy,{x:0,y:0,z:0},0],[rig.turretProxy,rig.turretPivot,body.turret.yawRel]])for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5]){const local=rotateYaw({x:proxy.offset.x+x*proxy.width,y:proxy.offset.y+y*proxy.height,z:proxy.offset.z+z*proxy.depth},rel),v=hullVector({x:local.x+pivot.x,y:local.y+pivot.y,z:local.z+pivot.z},e.pose);points.push({x:e.pose.x+v.x,y:e.pose.y+v.y,z:e.pose.z+v.z});}const t=getTankTransform(body,rig);points.push(t.barrelStart,t.barrelEnd,t.position,sentryMuzzleTransform(e).position);for(const point of points){const q=new THREE.Vector3(point.x,point.y,point.z).project(camera);assert.ok(Math.abs(q.x)<1&&Math.abs(q.y)<1&&Math.abs(q.z)<1,`${id} whole tilted rig/shot muzzle in source ${w}x${h} at tick ${state.tick}: ${q.x},${q.y}`);}}}}
function routeDistance(p,r){let d=Infinity;for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],x=b.x-a.x,z=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*x+(p.z-a.z)*z)/(x*x+z*z)));d=Math.min(d,Math.hypot(p.x-a.x-t*x,p.z-a.z-t*z));}return d;}

test('every V4 player chassis has initial actual hull/muzzle clearance and accepted forward/reverse/pivot drive',()=>{
 assert.equal(listPlayerVehicles().length,5);
 for(const vehicle of listPlayerVehicles()){const {spec,world,state}=setup(vehicle.id);try{
  assert.deepEqual(world.hullContacts(state.tank,playerRig(spec)),[],vehicle.id+' initial hull');
  assert.deepEqual(world.muzzleContacts(state.tankFrame.muzzleWorld,playerRig(spec),['tank']).contacts,[],vehicle.id+' initial muzzle');
  for(const [input,name,min]of [[{throttle:1},'forward',.6],[{throttle:-1},'reverse',.4],[{steer:1},'pivot',.3]]){let s=state;for(let n=0;n<90;n++)s=stepGame(s,input,1/60,world);const value=name==='pivot'?Math.abs(s.tank.pose.yaw-state.tank.pose.yaw):Math.hypot(s.tank.pose.x-state.tank.pose.x,s.tank.pose.z-state.tank.pose.z);assert.ok(value>min,`${vehicle.id} ${name}: ${value}`);}
 }finally{world.dispose();}}
});

test('30-second actual V4 opening accepts >1m per patrol, parks on existing charge, deals opposing real damage without friendly damage and stays off convoy routes',async()=>{
 const {spec,field,world,state}=setup(),inspector=await createUprightMeshInspector();let s=state,events=[],counts=Object.fromEntries(ids.map(id=>[id,{sweeps:0,blocked:0,travel:0,holds:0,newChargesAfterMotion:0}]));
 const sweep=world.sweepHullAndAttachedGun;world.sweepHullAndAttachedGun=(...args)=>{const result=sweep(...args);if(ids.includes(args[0].id)){const c=counts[args[0].id];c.sweeps++;c.blocked+=Number(result.blocked);}return result;};
 function checkUpright(){const cameras=[[1280,720],[390,844],[844,390]].map(([width,height])=>{const p=s.tank.pose,a=p.yaw+s.tank.turret.yawRel,f=new THREE.Vector3(p.x-Math.sin(a)*2.2,p.y+.5,p.z-Math.cos(a)*2.2),camera=new THREE.PerspectiveCamera(42,width/height,.15,150);camera.position.copy(f).add(new THREE.Vector3(...(width/height<.85?[8,23,22]:[10,19,18])));camera.lookAt(f);camera.updateMatrixWorld();return{camera,width,height};});for(const id of ids){const fit=inspector.measure(s.entities[id],field,cameras);assert.ok(fit.minGap>=-.1,`${id} actual upright GLB/treads penetrate ${fit.minGap}m at tick ${s.tick}`);assert.ok(fit.views.every(v=>v.allInFrustum),`${id} actual upright GLB/treads outside source frustum at tick ${s.tick}`);assert.ok(fit.muzzleToShotDistance<1e-5,id+' actual yaw-only rendered muzzle/real shot agreement');}}
 try{checkUpright();for(let n=0;n<1800;n++){const previous=s;s=stepGame(s,{},1/60,world);events.push(...s.events);
  if(n%30===29){assertSourceFrustum(s);checkUpright();}
  for(const id of ids){const a=previous.entities[id],b=s.entities[id],c=counts[id],distance=Math.hypot(b.pose.x-a.pose.x,b.pose.z-a.pose.z);c.travel+=distance;
   // Interceptors run before combat: only a charge already present at tick entry
   // requires a hold. A tick that STARTS charging may first accept reload motion.
   if(a.charge>0||a.telegraphTarget){assert.deepEqual(b.pose,a.pose,id+' charging hold');assert.equal(b.speed,0);c.holds++;}
   if(!a.charge&&b.charge>0&&distance>0)c.newChargesAfterMotion++;
   assert.ok(b.pose.x>= (id===ids[0]?-5.1:-.1)&&b.pose.x<= (id===ids[0]?-3.9:1.3),id+' bounded x');
   assert.ok(b.pose.z>= (id===ids[0]?15.9:15.8)&&b.pose.z<= (id===ids[0]?18.1:16.2),id+' bounded z');
   for(const route of spec.routes)assert.ok(routeDistance(b.pose,route)>route.width/2+Math.hypot(b.width,b.depth)/2+.25,id+' off route '+route.id);
  }
 }
 assert.equal(s.tick,1800);assert.equal(s.phase,'playing');
 for(const [a,b]of [[ids[0],ids[1]],[ids[1],ids[0]]]){const c=counts[a];assert.ok(c.sweeps>100,a+' actual compound sweeps');assert.equal(c.blocked,0,a+' no blocked opening sweeps');assert.ok(c.travel>1,a+' accepted travel');assert.ok(Math.abs(c.travel-s.entities[a].travel)<1e-10,a+' stored accepted travel matches');assert.ok(c.holds>100,a+' observed charge holds');assert.ok(c.newChargesAfterMotion>0,a+' actual pre-charge movement boundary');assert.ok(events.some(e=>e.type==='shot'&&e.entityId===a));assert.ok(events.some(e=>e.type==='damaged'&&e.entityId===a&&e.targetId===b));}
 assert.equal(s.tankCombat.damageTaken,0);assert.equal(s.entities.supply.hp,100);
 assert.ok(!events.some(e=>e.type==='damaged'&&['tank','supply','allied-support'].includes(e.targetId)&&['tank','supply','allied-support'].includes(e.entityId)));
 }finally{world.dispose();inspector.dispose();}
});

test('V4 pause/resume/input-paused snapshots and fresh retry are exact with a moving real battle',()=>{
 const {spec,world,state}=setup();let s=state;try{for(let n=0;n<260;n++)s=stepGame(s,{},1/60,world);assert.ok(ids.some(id=>s.entities[id].travel>0));
  const before=structuredClone(s),paused=stepGame(s,{pause:true},1/60,world);assert.deepEqual(paused,{...before,phase:'paused',events:[]});s=paused;
  for(let n=0;n<30;n++)s=stepGame(s,{throttle:1,steer:1,firePressed:true},1/60,world);assert.deepEqual(s,paused);
  const resumed=stepGame(s,{resume:true},1/60,world);assert.deepEqual(resumed,{...paused,phase:'playing',events:[]});
  assert.deepEqual(stepGame(resumed,{paused:true,throttle:1,firePressed:true},1/60,world),resumed);
  const next=stepGame(resumed,{},1/60,world),control=stepGame(before,{},1/60,world);assert.deepEqual(next,control);
  assert.deepEqual(retry(spec),createGame(spec));assert.deepEqual(retry(spec),createGame(withPlayerVehicle(fixture().spec,'sandfalcon')));
 }finally{world.dispose();}
});

test('independent labeled 12HP real-fatal-hit fixtures leave each wreck stationary, solid and unable to shoot',()=>{
 // At close range the faster hostile charge kills a simultaneous 12HP ally before
 // it shoots. Test each real fatal hit independently, preserving the other 110HP.
 for(const id of ids){const {world,state}=setup();let s=structuredClone(state),events=[];s.entities[id].hp=12;
 try{for(let n=0;n<300;n++){s=stepGame(s,{},1/60,world);events.push(...s.events);}assert.ok(events.some(e=>e.type==='damaged'&&e.targetId===id&&ids.includes(e.entityId)&&e.entityId!==id));assert.ok(events.some(e=>e.type==='destroyed'&&e.entityId===id));assert.equal(s.entities[id].alive,false);assert.equal(s.entities[id].hp,0);
  const dead=structuredClone(s.entities[id]);events=[];for(let n=0;n<120;n++){s=stepGame(s,{},1/60,world);events.push(...s.events);}
  assert.deepEqual(s.entities[id],dead);const p=dead.pose,hit=world.raycast({x:p.x-5,y:p.y+.5,z:p.z},{x:p.x+5,y:p.y+.5,z:p.z},ids.filter(other=>other!==id));assert.equal(hit?.id,id,id+' isolated solid wreck ray');const body={...interceptorCollider(dead),id:'wreck-probe'},contact=world.sweepHullAndAttachedGun(body,body,INTERCEPTOR_COLLISION_RIG,['wreck-probe']);assert.equal(contact.blocked,true,id+' solid wreck compound');assert.ok(contact.contacts.includes(id),id+' explicit persistent wreck contact');
  assert.ok(!events.some(e=>e.type==='shot'&&e.entityId===id));
 }finally{world.dispose();}}
});

test('V4 retains V3 physical sources and spec; grounded view and preserved V3 view have separate exact SHA bindings',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../../evidence/baseline-v3-work-sha256.json',import.meta.url)));
 // The optional grounded view is no longer byte-identical to V3; all nine
 // physical/other source pins and the original view artifact remain protected.
 const preservedView=createHash('sha256').update(readFileSync(new URL('../../evidence/grounded/g2/authored-scene-view.before.js',import.meta.url))).digest('hex');assert.equal(preservedView,'2e7da33acb99251e1a5b098c2d779749e43c9ce13f3efab8c4121607cfe1587c');assert.equal(preservedView,manifest['work/src/authored-scene-view.js']);
 assert.equal(createHash('sha256').update(readFileSync(new URL('../src/authored-scene-view.js',import.meta.url))).digest('hex'),'56e855b45a6ce89dffdccc80fb08122e190a115398344f5fe481425cb3eaf1ab','authorized grounded candidate view');
 for(const file of ['crossfire-v3-front.js','crossfire-front.js','scorched-front.js','campaign-simulation.js','interceptor.js','combat.js','terrain-candidate/combat-world.js','player-vehicles-v3.js','interceptor-art.js'])assert.equal(createHash('sha256').update(readFileSync(new URL('../src/'+file,import.meta.url))).digest('hex'),manifest['work/src/'+file],file);
 assert.equal(sha(createCrossfireV3Front().spec),'f58408f8e47258b890124e3db264ae25ed0fd9f5b46911838c09f3df68b44b48');
 const before=sha(createCrossfireV3Front());fixture();assert.equal(sha(createCrossfireV3Front()),before);
});

test('labeled player-zero-HP defeat fixture freezes the full V4 battle and retries exactly, without claiming a route result',()=>{
 const {spec,world,state}=setup();let s=state;try{for(let n=0;n<260;n++)s=stepGame(s,{},1/60,world);
  s=structuredClone(s);s.tankCombat.hp=0;s=stepGame(s,{},1/60,world);assert.equal(s.phase,'lost');assert.equal(s.result.cause,'tank-destroyed');
  const frozen={...structuredClone(s),events:[]};for(let n=0;n<60;n++)s=stepGame(s,{throttle:1,steer:1,firePressed:true,convoyOrder:'advance'},1/60,world);assert.deepEqual(s,frozen);assert.deepEqual(retry(spec),createGame(spec));
 }finally{world.dispose();}
});

test('all five production player rigs preserve a real visible opposing opening with >1m per patrol before 8 seconds',()=>{
 for(const vehicle of listPlayerVehicles()){const {world,state}=setup(vehicle.id);let s=state,events=[];try{for(let n=0;n<480;n++){s=stepGame(s,{},1/60,world);events.push(...s.events);if(n%30===29)assertSourceFrustum(s);}
  for(const [a,b]of [[ids[0],ids[1]],[ids[1],ids[0]]]){assert.ok(s.entities[a].travel>1,vehicle.id+' '+a+' travel');assert.ok(events.some(e=>e.type==='shot'&&e.entityId===a),vehicle.id+' '+a+' shot');assert.ok(events.some(e=>e.type==='damaged'&&e.entityId===a&&e.targetId===b),vehicle.id+' '+a+' real opposing hit');}
  assert.equal(s.tankCombat.damageTaken,0,vehicle.id+' player unharmed in opening');assert.equal(s.entities.supply.hp,100,vehicle.id+' supply unharmed in opening');
  assert.ok(!events.some(e=>e.type==='damaged'&&['tank','supply','allied-support'].includes(e.targetId)&&['tank','supply','allied-support'].includes(e.entityId)));
 }finally{world.dispose();}}
});
