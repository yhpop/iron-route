import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {createEightNpcCrossfire} from '../src/eight-npc-crossfire-front.js';
import {createEightNpcCrossfire as createParentOpening} from './fixtures/eight-npc-opening-parent.js';
import {createRuinedDepotWorld as fastWorld} from '../src/ruined-depot-world-accelerated.js';
import {createRuinedDepotWorld as oldWorld} from '../src/ruined-depot-world.js';
import {createGame,stepGame,retry} from '../src/campaign-simulation.js';
import {withPlayerVehicle,playerRig} from '../src/player-vehicles-v3.js';
import {interceptorCollider,INTERCEPTOR_COLLISION_RIG as rig} from '../src/interceptor.js';
import {sampleHeightfield} from '../src/terrain-candidate/heightfield.js';
import {getTankTransform} from '../src/tank-controller.js';
import {areHostile} from '../src/combat-relations.js';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const armed=s=>Object.values(s.entities).filter(e=>e.kind==='turret');
const additions=['allied-east','allied-north','allied-far-east','hostile-far-east'];
function setup(worldFactory=fastWorld,builder=createEightNpcCrossfire){const{spec:b,field}=builder(),spec=withPlayerVehicle(b,'sandfalcon'),world=worldFactory(spec,field),s=createGame(spec);s.tank.pose=world.groundPose(s.tank.pose);return{spec,field,world,state:stepGame(s,{start:true},1/60,world)};}
function routeDistance(p,r){let d=Infinity;for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],x=b.x-a.x,z=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*x+(p.z-a.z)*z)/(x*x+z*z)));d=Math.min(d,Math.hypot(p.x-a.x-t*x,p.z-a.z-t*z));}return d;}
test('all initial compound rigs clear; four added stationary hull footprints are grounded and off both routes',()=>{const {spec,field,world,state:s}=setup();try{
 assert.deepEqual(world.hullContacts(s.tank,playerRig(spec)),[]);
 for(const e of armed(s).filter(e=>e.vehicle==='pz3')){const c=interceptorCollider(e);assert.deepEqual(world.sweepHullAndAttachedGun(c,c,rig,[e.id]).contacts,[],e.id);assert.deepEqual(world.muzzleContacts(getTankTransform(c,rig),rig,[e.id]).contacts,[],e.id);}
 for(const id of additions){const e=s.entities[id];for(const route of spec.routes)assert.ok(routeDistance(e.pose,route)>route.width/2+Math.hypot(e.width,e.depth)/2+.25,id+' off '+route.id);
  // Conservative near-ground footprint sampling, not an actual rendered-mesh test.
  for(let x=-1.1;x<=1.1;x+=.2)for(let z=-2;z<=2;z+=.2){const X=e.pose.x+Math.cos(e.pose.yaw)*x+Math.sin(e.pose.yaw)*z,Z=e.pose.z-Math.sin(e.pose.yaw)*x+Math.cos(e.pose.yaw)*z,gap=e.pose.y-sampleHeightfield(field,X,Z).height;assert.ok(gap>=0&&gap<.02,id+' upright ground-footprint gap '+gap);}
 }
}finally{world.dispose();}});
function opening(factory){const {spec,world,state}=setup(factory,createParentOpening);let s=state;const events=[],shots=new Map(),travel={},samples=[];try{
 for(let n=0;n<1800;n++){const prior=s;s=stepGame(s,{},1/60,world);assert.equal(s.phase,'playing');events.push(...s.events);
  for(const e of armed(s)){const old=prior.entities[e.id];travel[e.id]=(travel[e.id]||0)+Math.hypot(e.pose.x-old.pose.x,e.pose.z-old.pose.z);if(old.charge>0||old.telegraphTarget)assert.deepEqual(e.pose,old.pose,e.id+' charging parked');}
  for(const event of s.events.filter(e=>e.type==='shot')){const p=s.projectiles.find(p=>p.id===event.projectileId);assert.ok(p&&p.ownerId===event.entityId);assert.deepEqual(p.position,event.position);shots.set(p.id,{owner:p.ownerId,tick:s.tick});}
  for(const event of s.events.filter(e=>e.type==='impact')){const shot=shots.get(event.projectileId);assert.ok(shot&&shot.owner===event.entityId&&shot.tick<s.tick);}
  for(const event of s.events.filter(e=>e.type==='damaged'))assert.ok(areHostile(s,event.entityId,event.targetId),'no friendly damage');
  if(n%60===59)samples.push(hash(s));
 }
 for(const e of armed(s)){assert.ok(events.some(x=>x.type==='shot'&&x.entityId===e.id),e.id+' real fire');assert.ok(events.some(x=>x.type==='damaged'&&x.entityId===e.id),e.id+' actual opposing damage');assert.ok(e.alive,e.id+' survives opening');}
 for(const id of ['road-gun','allied-support'])assert.ok(travel[id]>1,id+' accepted patrol');for(const id of additions)assert.equal(travel[id],0,id+' honest stationary emplacement');
 assert.equal(s.objectiveStates['prepare-extraction'].status,'complete');assert.equal(s.entities.supply.pose.x,state.entities.supply.pose.x);assert.equal(s.entities.supply.pose.z,state.entities.supply.pose.z);assert.equal(s.selectedConvoyChoiceId,null);
 const pause=stepGame(s,{pause:true},1/60,world);assert.equal(pause.tick,s.tick);assert.equal(stepGame(pause,{},1/60,world).tick,s.tick);assert.deepEqual(retry(spec),createGame(spec));
 return{finalHash:hash(s),samples,events,travel,actorSummary:armed(s).map(e=>({id:e.id,hp:e.hp,shots:events.filter(x=>x.type==='shot'&&x.entityId===e.id).length,damage:events.filter(x=>x.type==='damaged'&&x.entityId===e.id).reduce((n,x)=>n+x.value,0)})),tick:s.tick};
}finally{world.dispose();}}
test('frozen parent 30s production opening: all eight fire and deal real hostile damage, charge holds, extraction and pause stay physical; acceleration trace identical',()=>{
 const fast=opening(fastWorld),original=opening(oldWorld);assert.deepEqual(fast,original);
 if(process.env.EIGHT_NPC_EVIDENCE)fs.writeFileSync(process.env.EIGHT_NPC_EVIDENCE,JSON.stringify({...fast,acceleratedEquivalent:true,scope:'headless simulation, not built GPU performance'},null,2)+'\n');
});
