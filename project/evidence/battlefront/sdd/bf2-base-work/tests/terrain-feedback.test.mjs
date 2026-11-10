import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createCampaignView} from '../src/campaign-view.js';
import {createTerrainCombatMission} from '../src/terrain-candidate/combat-mission.js';
import {createTerrainCombatWorld} from '../src/terrain-candidate/combat-world.js';
import {createGame,stepGame} from '../src/campaign-simulation.js';
import {resolveImpactFrame} from '../src/combat-fx-frame.js';
test('elevated terrain impact carries actual collision normal through simulation to FX',()=>{
 const {spec,field}=createTerrainCombatMission(),world=createTerrainCombatWorld(spec,field);let s=createGame(spec);s.phase='playing';s.tank.pose=world.groundPose(s.tank.pose);
 const a={x:-20,y:20,z:23},b={x:-20,y:-20,z:23},hit=world.raycast(a,b,['tank']);
 s.projectiles=[{id:'test',ownerId:'tank',team:'player',damage:99,life:10,position:a,previousPosition:a,velocity:{x:0,y:-500,z:0}}];
 s=stepGame(s,{},.1,world);const event=s.events.find(e=>e.type==='impact'&&e.targetId==='terrain');assert.ok(event);assert.deepEqual(event.normal,hit.normal);
 const frame=resolveImpactFrame(event,s,spec);assert.deepEqual(frame.normal,hit.normal);assert.equal(frame.staticSurface,true);assert.equal(frame.surface,'ground');world.dispose();
});
test('objective ring and subdivided zone edges follow heightfield instead of fixed flat Y',()=>{
 const heightAt=(x,z)=>3+.1*x+.04*z*z,scene=new THREE.Scene(),spec={bounds:{minX:-20,maxX:20,minZ:-20,maxZ:20},geometry:[],zones:[{id:'exit',polygon:[{x:-2,z:-2},{x:2,z:-2},{x:2,z:2},{x:-2,z:2}]}],objectives:[{id:'goal',zoneId:'exit'}]};
 const view=createCampaignView(scene,spec,{groundHeightAt:heightAt});view.update({objectiveStates:{goal:{status:'active'}},entities:{},projectiles:[]},[],0);
 const marker=scene.getObjectByName('objective-marker:exit');marker.updateMatrixWorld(true);const p=marker.geometry.attributes.position,v=new THREE.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(marker.matrixWorld);assert.ok(Math.abs(v.y-heightAt(v.x,v.z)-.08)<1e-5);}
 const zone=scene.getObjectByName('zone-boundary:exit');assert.ok(zone);assert.ok(zone.geometry.attributes.position.count>5);for(let i=0;i<zone.geometry.attributes.position.count;i++){v.fromBufferAttribute(zone.geometry.attributes.position,i);assert.ok(Math.abs(v.y-heightAt(v.x,v.z)-.05)<1e-5);}view.dispose();assert.equal(scene.children.length,0);
});
test('terrain dust remains readable for one second, leaves bounded surface mark, then expires',async()=>{const {createCombatFx}=await import('../src/combat-fx.js');const scene=new THREE.Scene(),fx=createCombatFx(scene,{}, {reducedMotion:false});const state={entities:{},projectiles:[]};fx.update(state,[{id:'terrain-hit',type:'impact',targetId:'terrain',position:{x:2,y:4,z:3},normal:{x:0,y:1,z:0}}],0);for(let i=0;i<10;i++)fx.update(state,[],.1);assert.ok(fx.getStats().smoke>0);assert.equal(fx.getStats().scorches,1);for(let i=0;i<100;i++)fx.update(state,[],.1);assert.equal(fx.getStats().smoke,0);assert.equal(fx.getStats().scorches,0);fx.dispose();});
