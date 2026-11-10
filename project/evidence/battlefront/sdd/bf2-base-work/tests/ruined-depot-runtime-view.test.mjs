/** CPU runtime-view regression: real campaign/authored/scorched/ruin updates.
 * Only art-library clones and terrain GPU resources are fake. No renderer,
 * browser, image decoding, route acceptance or simulation-state repair.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createRuinedDepotFront} from '../src/ruined-depot-front.js';
import {createScannedCoverFront} from '../src/scanned-cover-front.js';
import {createCampaignView} from '../src/campaign-view.js';
import {createScorchedWorldView} from '../src/scorched-world-view.js';
import {createRuinedDepotView} from '../src/ruined-depot-view.js';
import {createRuinedDepotWorld} from '../src/ruined-depot-world.js';
import {createGame,stepGame} from '../src/campaign-simulation.js';
const cosmeticNames=['warfield-fragments','warfield-wall-scars','warfield-ruins'];
function fakeArt(){return {clone(){const root=new THREE.Group();for(const name of ['TurretYaw','GunPitch','Recoil','Muzzle','WheelLFront','WheelLRear','WheelRFront','WheelRRear']){const node=new THREE.Group();node.name=name;root.add(node);}return root;}};}
async function owner(front=createRuinedDepotFront()){
 const {spec,field}=front,scene=new THREE.Scene();
 const campaign=createCampaignView(scene,spec,{
  artKit:fakeArt(),terrainFactory:()=>({update(){},dispose(){}}),
  livingFactory:root=>createScorchedWorldView(root,spec,field,{reducedMotion:true})
 });
 await campaign.ready;
 const proxies=spec.geometry.filter(c=>c.ruinInstanceId).map(c=>scene.getObjectByName(`solid:${c.id}`));
 const cosmetics=cosmeticNames.map(name=>scene.getObjectByName(name));
 return {scene,spec,field,campaign,proxies,cosmetics};
}
const visible=roots=>roots.filter(root=>root.visible).length;
function assertSuppressed(f,ruin){assert.equal(visible(f.proxies),0,'no conservative proxy artwork after final adapter update');assert.equal(visible(f.cosmetics),0,'old cosmetics stay hidden');assert.equal(ruin.root.children.length,3);assert.equal(visible(ruin.root.children),3,'real ruin instance holders remain visible');}

test('real campaign owner resets 61 proxies, then ruin update suppresses them across briefing, playing, pause and resume frames',async()=>{
 const f=await owner(),world=createRuinedDepotWorld(f.spec,f.field),library={clone:()=>new THREE.Group()};
 const ruin=createRuinedDepotView(f.scene,f.spec,f.field,library);let state=createGame(f.spec);
 try{
  assert.equal(f.proxies.length,61);assert.ok(f.cosmetics.every(Boolean));assertSuppressed(f,ruin);
  for(const phase of ['briefing','playing','paused','playing']){
   if(phase!==state.phase)state=stepGame(state,{[phase==='paused'?'pause':state.phase==='paused'?'resume':'start']:true},1/60,world);
   assert.equal(state.phase,phase);
   for(let frame=0;frame<3;frame++){
    f.campaign.update(state,[],1/60);
    assert.equal(visible(f.proxies),61,'exercise real authored visibility overwrite, not a no-op owner');
    ruin.update(state,[],1/60);assertSuppressed(f,ruin);
   }
  }
 }finally{ruin.dispose();f.campaign.dispose();world.dispose();}
});

test('runtime suppression restores captured mixed visibility on retry/dispose, is inert after dispose and never frees borrowed resources',async()=>{
 const f=await owner(),geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshStandardMaterial(),library={clone:()=>new THREE.Mesh(geometry,material)};
 let freed=0;geometry.addEventListener('dispose',()=>freed++);material.addEventListener('dispose',()=>freed++);
 f.proxies[0].visible=false;f.cosmetics[0].visible=false;
 const original=new Map([...f.proxies,...f.cosmetics].map(node=>[node,node.visible])),state=createGame(f.spec);
 let ruin=createRuinedDepotView(f.scene,f.spec,f.field,library);
 try{
  for(let attempt=0;attempt<2;attempt++){
   f.campaign.update(state,[],1/60);ruin.update(state,[],1/60);assertSuppressed(f,ruin);
   ruin.dispose();ruin.dispose();assert.equal(ruin.root.parent,null);
   for(const [node,value]of original)assert.equal(node.visible,value,'restore exact initial borrowed visibility');
   ruin.update(state,[],1/60);for(const [node,value]of original)assert.equal(node.visible,value,'disposed update must not reclaim visibility');
   assert.equal(freed,0,'adapter must not dispose library geometry/materials');
   if(attempt===0)ruin=createRuinedDepotView(f.scene,f.spec,f.field,library);
  }
 }finally{ruin.dispose();f.campaign.dispose();assert.equal(freed,0);geometry.dispose();material.dispose();}
});

test('old scanned mission real campaign owner keeps original solid and cosmetic visibility without new adapter',async()=>{
 const f=await owner(createScannedCoverFront()),state=createGame(f.spec);
 try{assert.equal(f.proxies.length,0);const oldRoots=f.spec.geometry.filter(c=>!c.crush).map(c=>f.scene.getObjectByName(`solid:${c.id}`));const cosmeticsBefore=f.cosmetics.map(node=>node.visible);for(let frame=0;frame<3;frame++){f.campaign.update(state,[],1/60);assert.ok(oldRoots.every(node=>node.visible));assert.deepEqual(f.cosmetics.map(node=>node.visible),cosmeticsBefore);}assert.equal(f.scene.getObjectByName('ruined-depot-view'),undefined);}finally{f.campaign.dispose();}
});
