import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createCampaignView} from '../src/campaign-view.js';
const spec={bounds:{minX:-10,maxX:10,minZ:-10,maxZ:10},geometry:[],entities:[{id:'gun',kind:'turret',pose:{x:0,y:0,z:0,yaw:0}}]};
// Catch silently leaving the rejected icosahedron branch alive alongside new effects.
test('campaign view delegates actual projectile and impact presentation without polygon pulses',()=>{
 const scene=new THREE.Scene(),view=createCampaignView(scene,spec);
 view.update({projectiles:[{id:'p',faction:'player',ownerId:'tank',position:{x:1,y:1,z:3},previousPosition:{x:1,y:1,z:4},velocity:{x:0,y:0,z:-38}}],entities:{}},[{id:'shot',type:'shot',projectileId:'p',entityId:'tank',position:{x:1,y:1,z:4}},{id:'hit',type:'impact',targetId:'gun',entityId:'tank',position:{x:0,y:1,z:.8}}],.016);
 assert.ok(scene.getObjectByName('shell-cores'));let polygonPulses=0;scene.traverse(o=>{if(o.geometry?.type==='IcosahedronGeometry')polygonPulses++;});assert.equal(polygonPulses,0);view.dispose();assert.equal(scene.children.length,0);
});
// Catch presenting the charging warning as another continuous real bullet path.
test('enemy charge cue is explicitly dashed and only exists during actual charge',()=>{
 const scene=new THREE.Scene(),view=createCampaignView(scene,spec),entity={alive:true,pose:{x:0,y:0,z:0,yaw:0},charge:.6,telegraphTarget:{x:0,y:.8,z:8}};
 view.update({entities:{gun:entity},projectiles:[]},[],.016);const cue=scene.getObjectByName('enemy-charge-warning:gun');assert.ok(cue);assert.equal(cue.material.isLineDashedMaterial,true);assert.equal(cue.visible,true);assert.ok(cue.geometry.attributes.lineDistance);
 view.update({entities:{gun:{...entity,charge:0,telegraphTarget:null}},projectiles:[]},[],.016);assert.equal(cue.visible,false);view.dispose();
});
