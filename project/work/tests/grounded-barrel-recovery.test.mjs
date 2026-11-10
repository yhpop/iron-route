import test from 'node:test';
import assert from 'node:assert/strict';
import {createEightNpcCrossfire} from '../src/eight-npc-crossfire-front.js';
import {listPlayerVehicles} from '../src/player-vehicles-v3.js';
import {createGame,stepGame} from '../src/campaign-simulation.js';
import {createTerrainCombatWorld} from '../src/terrain-candidate/combat-world-accelerated.js';
import {createTerrainCombatWorld as referenceWorld} from '../src/terrain-candidate/combat-world.js';
import {createHeightfield,sampleHeightfield} from '../src/terrain-candidate/heightfield.js';
import {interceptorCollider} from '../src/interceptor.js';
import {getTankTransform,stepTank} from '../src/tank-controller.js';
const DT=1/60,{field}=createEightNpcCrossfire(),vehicles=listPlayerVehicles();
// Deliberately isolated mechanics fixture using the actual authored ridge. These
// start positions are NOT claimed as complete mission/route acceptance evidence.
function fixture(vehicle,worldFactory=createTerrainCombatWorld,options={}) {
 const terrain=options.field||field;
 const spec={schema:1,id:'grounded-gun-fixture',spawn:{x:8,y:0,z:16,yaw:0},playerVehicle:vehicle,geometry:[],entities:[],routes:[],zones:[],objectives:[],bounds:terrain.bounds,...options.spec};
 const world=worldFactory(spec,terrain);
 return {world,field:terrain,state:stepGame(createGame(spec),{start:true},DT,world)};
}
const lowAim=(s,f=field)=>{const x=s.tank.pose.x-3,z=s.tank.pose.z;return {worldPoint:{x,y:sampleHeightfield(f,x,z).height,z}};};
function untilRecovery(f) {for(let i=0;i<700;i++){f.beforeRecovery=f.state;f.state=stepGame(f.state,{throttle:1,aim:lowAim(f.state,f.field)},DT,f.world);if(f.state.tankFrame.terrainTravelClearance)return f.state;}assert.fail('real terrain contact must start bounded recovery');}
// Removing the contact-triggered retained floor leaves Vanguard/Tiger permanently
// stuck before z=10, despite repeated forward input and an unobstructed hull.
for(const v of vehicles)test(v.id+' progresses along the ridge under continuous ground aim without bypassing gun clearance',()=>{
 const f=fixture(v);let assisted=false,terrainContacts=0;
 try {for(let i=0;i<800;i++){const before=f.state;f.state=stepGame(before,{throttle:1,aim:lowAim(before)},DT,f.world);assisted ||= f.state.tankFrame.terrainTravelClearance===true;terrainContacts+=f.state.tankFrame.contacts.includes('terrain');assert.ok(Math.abs(f.state.tank.turret.elevation-before.tank.turret.elevation)<=v.controller.elevationRate*DT+1e-9);assert.ok(f.state.tank.turret.elevation<=v.controller.elevationLimits[1]);assert.deepEqual(f.world.muzzleContacts(getTankTransform(f.state.tank,v.controller.rig),v.controller.rig).contacts,[],'accepted real gun stays clear');}
 assert.ok(f.state.tank.pose.z<5,'ordinary throttle must not remain locked at the ridge');if(['vanguard','newc-tiger'].includes(v.id)){assert.ok(terrainContacts>0);assert.ok(assisted);}else assert.equal(assisted,false,'non-contact rigs must not get fabricated assistance');
 }finally{f.world.dispose();}
});
test('recovery retains user yaw, permits a real shot/recoil, and releases depression control on neutral or brake',()=>{
 const v=vehicles.find(v=>v.id==='newc-tiger'),f=fixture(v);
 try {const contacted=untilRecovery(f),held=contacted.tank.turret.elevation;assert.ok(held>-.12);const aim=lowAim(contacted);const shot=stepGame(contacted,{throttle:1,aim,firePressed:true},DT,f.world);assert.equal(shot.tankCombat.shotsFired,1);assert.ok(shot.events.some(e=>e.type==='shot'));assert.ok(shot.tank.turret.recoil>0);assert.ok(Math.abs(shot.tank.turret.yawRel-contacted.tank.turret.yawRel)<v.controller.turretYawRate*DT+1e-9);
 const releaseAim={worldPoint:{x:contacted.tank.pose.x+3,y:sampleHeightfield(field,contacted.tank.pose.x+3,contacted.tank.pose.z).height,z:contacted.tank.pose.z}};
 for(const input of [{throttle:0},{throttle:1,brake:true}]){let s=contacted;for(let i=0;i<240;i++)s=stepGame(s,{...input,aim:releaseAim},DT,f.world);assert.notEqual(s.tankFrame.terrainTravelClearance,true);assert.ok(s.tank.turret.elevation<held,'release restores lower aim if physically clear');}
 const pause=stepTank(contacted.tank,{paused:true},DT,f.world,v.controller);assert.deepEqual(pause.state,contacted.tank);const resumed=stepTank(pause.state,{throttle:1,aim},DT,f.world,v.controller);assert.equal(resumed.frame.terrainTravelClearance,true);const stopped=stepTank(pause.state,{brake:true,aim},DT,f.world,v.controller);assert.notEqual(stopped.frame.terrainTravelClearance,true);
 }finally{f.world.dispose();}
});
test('reference and accelerated terrain recovery produce identical full states',()=>{
 const v=vehicles.find(v=>v.id==='newc-tiger'),a=fixture(v),b=fixture(v,referenceWorld);try{for(let i=0;i<480;i++){const input={throttle:1,aim:lowAim(a.state)};a.state=stepGame(a.state,input,DT,a.world);b.state=stepGame(b.state,input,DT,b.world);assert.deepEqual(a.state,b.state);}}finally{a.world.dispose();b.world.dispose();}
});
const flat=createHeightfield({bounds:{minX:-30,maxX:30,minZ:-30,maxZ:30},cellSize:1,heightAt:()=>0,roads:[]});
for(const label of ['wall','truck','wreck'])test(label+' contact never activates terrain lift or removes real obstruction',()=>{
 const v=vehicles.find(v=>v.id==='newc-tiger'),f=fixture(v,createTerrainCombatWorld,{field:flat,spec:{spawn:{x:0,y:0,z:9,yaw:0},geometry:label==='wall'?[{id:'wall',kind:'box',x:0,y:0,z:0,width:8,depth:.05,height:5}]:[]}});
 try {let s=f.state.tank,blocked=false;for(let i=0;i<700;i++){if(label!=='wall')f.world.setEntities([label==='wreck'?interceptorCollider({id:label,vehicle:'pz3',pose:{x:0,y:0,z:0,yaw:0},hp:0,alive:false}):{id:label,kind:'truck',pose:{x:0,y:0,z:0,yaw:0},width:2.5,depth:4,height:3,hp:100,alive:true}]);const r=stepTank(s,{throttle:1,aim:{worldPoint:{x:0,y:0,z:-3}}},DT,f.world,v.controller);s=r.state;blocked ||= r.frame.contacts.includes(label);assert.notEqual(r.frame.terrainTravelClearance,true);}assert.ok(blocked);assert.ok(s.pose.z>2.5);const z=s.pose.z;for(let i=0;i<90;i++)s=stepTank(s,{throttle:-1},DT,f.world,v.controller).state;assert.ok(s.pose.z>z+.2,'real obstacle still permits safe retreat');
 }finally{f.world.dispose();}
});

// Narrow controller boundary fixture: repeated terrain rejection and blocked joint
// are supplied deliberately. Actual obstacle safety is covered by the real-world
// tests above; this test only guards accumulating a requested floor when the gun
// has not actually moved. It is not physics or mission acceptance evidence.
test('consecutive rejected motions cannot compound reserve beyond actual gun elevation',()=>{
 const v=vehicles.find(v=>v.id==='newc-tiger'),f=fixture(v);try{untilRecovery(f);let s=f.state.tank;const initial=s.terrainTravelElevation,env={...f.world,sweepHullAndAttachedGun:from=>({accepted:from,forwardDistance:0,blocked:true,blockedPart:'barrel',contacts:['terrain']}),sweepTurretAtHull:(_pose,from)=>({accepted:from,blocked:true,contacts:['roof']})};for(let i=0;i<30;i++){const before=s,r=stepTank(s,{throttle:1,aim:lowAim({tank:s})},DT,env,v.controller);s=r.state;assert.equal(s.turret.elevation,before.turret.elevation);assert.ok(s.terrainTravelElevation<=Math.max(initial,before.turret.elevation+v.controller.elevationRate*.15)+1e-10,'requested floor must be anchored to actual elevation, not the prior requested target');}}finally{f.world.dispose();}
});
test('reverse ground contact recovers through real aim and signed track travel',()=>{
 const v=vehicles.find(v=>v.id==='newc-tiger'),f=fixture(v,createTerrainCombatWorld,{spec:{spawn:{x:8,y:0,z:-12,yaw:0}}});let first=null;try{for(let i=0;i<1200;i++){const before=f.state;f.state=stepGame(before,{throttle:-1,aim:lowAim(before)},DT,f.world);if(f.state.tankFrame.terrainTravelClearance)first??=f.state.tank.pose.z;assert.ok(f.state.tankFrame.deltaTrackL<=1e-10);assert.ok(f.state.tankFrame.deltaTrackR<=1e-10);assert.deepEqual(f.world.muzzleContacts(getTankTransform(f.state.tank,v.controller.rig),v.controller.rig).contacts,[]);}assert.ok(first!==null);assert.ok(f.state.tank.pose.z>first+3,'reverse must clear the contact region, not remain at a sub-centimetre stop');}finally{f.world.dispose();}
});
test('terrain boundary rejection never masquerades as recoverable ground contact',()=>{
 const v=vehicles.find(v=>v.id==='newc-tiger'),f=fixture(v,createTerrainCombatWorld,{field:flat,spec:{spawn:{x:0,y:0,z:-23,yaw:0}}});let boundary=false;try{for(let i=0;i<600;i++){f.state=stepGame(f.state,{throttle:1},DT,f.world);boundary ||= f.state.tankFrame.contacts.some(id=>id.includes('bound'));assert.notEqual(f.state.tankFrame.terrainTravelClearance,true);}assert.ok(boundary);assert.ok(f.state.tank.pose.z>=-27);}finally{f.world.dispose();}
});
