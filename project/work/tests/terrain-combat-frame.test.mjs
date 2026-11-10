import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {geometryLibrary} from './helpers/art-geometry.mjs';
import {createCampaignArtLibrary} from '../src/art-kit.js';
import {createCampaignView} from '../src/campaign-view.js';
import {createGame,stepGame} from '../src/campaign-simulation.js';
import {createTerrainCombatMission} from '../src/terrain-candidate/combat-mission.js';
import {createTerrainCombatWorld} from '../src/terrain-candidate/combat-world.js';
import {createReliefView} from '../src/terrain-candidate/relief-view.js';

test('actual campaign frame consumer accepts actual relief provider through first frame, play and retry',async()=>{
 const artKit=createCampaignArtLibrary(await geometryLibrary()),{spec,field}=createTerrainCombatMission(),scene=new THREE.Scene();
 for(let retry=0;retry<2;retry++){
  const world=createTerrainCombatWorld(spec,field),view=createCampaignView(scene,spec,{artKit,terrainFactory:root=>createReliefView(root,field,{loadTextures:false})});
  let state=createGame(spec);state.tank.pose=world.groundPose(state.tank.pose);
  await view.ready;assert.ok(scene.getObjectByName('shared-heightfield-relief'));
  assert.doesNotThrow(()=>view.update(state,[],1/60),'first frame must call the real terrain update contract without crashing');
  state=stepGame(state,{start:true},1/60,world);
  for(let i=0;i<5;i++){state=stepGame(state,{throttle:1},1/60,world);view.update(state,state.events,1/60);}
  view.dispose();world.dispose();assert.doesNotThrow(()=>view.update(state,[],1/60));assert.equal(scene.children.length,0);
 }
 artKit.dispose();
});
