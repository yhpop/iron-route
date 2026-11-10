// CPU Three + production simulation/model adapter, NOT browser pixels or GPU QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCrossfireV4Front} from '../src/crossfire-v4-front.js';
import {withPlayerVehicle} from '../src/player-vehicles-v3.js';
import {createGame,stepGame} from '../src/campaign-simulation.js';
import {createTerrainCombatWorld} from '../src/terrain-candidate/combat-world.js';
import {createInterceptorLibrary} from '../src/interceptor-art.js';
import {createCampaignArtLibrary} from '../src/art-kit.js';
import {createAuthoredSceneView} from '../src/authored-scene-view.js';
import {geometryLibrary} from './helpers/art-geometry.mjs';
import {computeBattlefieldGuidance} from '../src/battlefield-guidance.js';
import {createUI} from '../src/campaign-ui.js';
import {makeDOM} from './input-dom.mjs';
const ids=['allied-support','hostile-flanker'];
function snapshot(root){const t=root.getObjectByName('Pz3Treads'),m=new THREE.Matrix4();t.getMatrixAt(0,m);return {position:root.position.toArray(),yaw:root.rotation.y,wheel:root.getObjectByName('Wheel_18').rotation.x,tread:m.toArray()};}
test('actual V4 accepted patrol moves production model and running gear; charging and pause hold both exactly; DOM consumes truthful moving label',async()=>{
 const {spec:raw,field}=createCrossfireV4Front(),spec=withPlayerVehicle(raw,'sandfalcon'),world=createTerrainCombatWorld(spec,field),b=await readFile(new URL('../assets/pz3-interceptor.glb',import.meta.url)),gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''),base=createCampaignArtLibrary(await geometryLibrary()),extra=createInterceptorLibrary(gltf),scene=new THREE.Scene(),view=createAuthoredSceneView(scene,spec,{clone:k=>k==='pz3'?extra.clone():base.clone(k)}),dom=makeDOM(),ui=createUI({...dom,missions:[spec],pause(){}});let s=stepGame(createGame(spec),{start:true},1/60,world),moving=0,holding=0,movingHUD=0;view.update(s,[],0);
 try{for(let n=0;n<600;n++){const previous=s,before=Object.fromEntries(ids.map(id=>[id,snapshot(view.entities.get(id))]));s=stepGame(s,{},1/60,world);view.update(s,s.events,1/60);
  for(const id of ids){const e=s.entities[id],now=snapshot(view.entities.get(id));assert.deepEqual(now.position,[e.pose.x,e.pose.y||0,e.pose.z]);assert.equal(now.yaw,e.pose.yaw||0);if(e.travel>previous.entities[id].travel+1e-9){moving++;assert.notDeepEqual(now.position,before[id].position);assert.notEqual(now.wheel,before[id].wheel);assert.notDeepEqual(now.tread,before[id].tread);}if(previous.entities[id].charge>0||previous.entities[id].telegraphTarget){holding++;assert.deepEqual(now,before[id]);}}
  const guidance=computeBattlefieldGuidance({state:s,origin:{x:500,y:400},projectEntity:()=>({x:100,y:200})});ui.render(s,spec,{}, {battlefieldGuidance:guidance});if(guidance.support.entries[0]?.engagement==='maneuvering'){movingHUD++;const node=dom.mount.querySelector('.campaign-support-status');assert.equal(node.hidden,false);assert.match(node.textContent,/装填机动|机动换位/);assert.match(node.getAttribute('aria-label'),/装填机动|机动换位/);}
 }
 assert.ok(moving>100);assert.ok(holding>100);assert.ok(movingHUD>30);
 const before=Object.fromEntries(ids.map(id=>[id,snapshot(view.entities.get(id))]));s=stepGame(s,{pause:true},1/60,world);for(let n=0;n<30;n++){s=stepGame(s,{throttle:1},1/60,world);view.update(s,[],0);for(const id of ids)assert.deepEqual(snapshot(view.entities.get(id)),before[id]);}
 }finally{ui.dispose();view.dispose();base.dispose();extra.dispose();world.dispose();}
});
