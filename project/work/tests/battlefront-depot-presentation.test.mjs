/** CPU THREE identities/geometry only. Art clone fixtures do not decode textures or prove beauty. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBattlefrontDepotFront} from '../src/battlefront-depot-front.js';
import {createRuinedDepotFront} from '../src/ruined-depot-front.js';
import {createRuinedDepotView} from '../src/ruined-depot-view.js';
import {createCrossfireWarfieldView} from '../src/crossfire-warfield-view.js';
import {createCampaignView} from '../src/campaign-view.js';
import {createGame} from '../src/campaign-simulation.js';
const fakeArt={clone(){const root=new THREE.Group();for(const name of ['TurretYaw','GunPitch','Recoil','Muzzle','WheelLFront','WheelLRear','WheelRFront','WheelRRear']){const n=new THREE.Group();n.name=name;root.add(n);}return root;}};
function campaign(front,extra={}){const scene=new THREE.Scene(),view=createCampaignView(scene,front.spec,{artKit:fakeArt,terrainFactory:()=>({update(){},dispose(){}}),groundHeightAt:()=>0,...extra});return {scene,view};}
test('explicit candidate-only boundary suppression retains logical zones and gold active choice rings',async()=>{
 const f=createBattlefrontDepotFront(),before=JSON.stringify(f.spec.zones),a=campaign(f,{suppressZoneBoundaries:true}),b=campaign(createRuinedDepotFront());
 try{await a.view.ready;assert.equal(a.scene.getObjectByName('zone-boundary:'+f.spec.zones[0].id)===undefined,true);assert.ok(b.scene.getObjectByName('zone-boundary:'+f.spec.zones[0].id));
 const s=createGame(f.spec);s.objectiveStates[f.spec.convoyChoice.requiresObjectiveId].status='complete';a.view.update(s);
 for(const option of f.spec.convoyChoice.options){const ring=a.scene.getObjectByName('objective-marker:'+option.zoneId);assert.ok(ring?.visible);assert.equal(ring.material.color.getHex(),0xe9c46a);}
 assert.equal(JSON.stringify(f.spec.zones),before);
 }finally{a.view.dispose();b.view.dispose();}
});
test('candidate owns one clone per original material identity, borrowing maps and geometry',()=>{
 const {spec,field}=createBattlefrontDepotFront(),scene=new THREE.Scene(),g=new THREE.BoxGeometry(),map=new THREE.Texture(),m=new THREE.MeshStandardMaterial({color:0xffffff,map,roughness:.4,metalness:.2});
 const library={clone(){const root=new THREE.Group();root.add(new THREE.Mesh(g,m),new THREE.Mesh(g,[m,m]));return root;}};
 const view=createRuinedDepotView(scene,spec,field,library),meshes=[];view.root.traverse(n=>{if(n.isMesh)meshes.push(n);});const owned=meshes[0].material;
 try{assert.equal(owned===m,false);assert.equal(owned.map,map);assert.equal(owned.roughness,1);assert.equal(owned.metalness,0);assert.ok(owned.color.r<m.color.r);for(const n of meshes){assert.equal(n.geometry,g);for(const material of Array.isArray(n.material)?n.material:[n.material])assert.equal(material,owned);}
 let clones=0,borrowed=0;owned.addEventListener('dispose',()=>clones++);for(const x of [g,m,map])x.addEventListener('dispose',()=>borrowed++);view.dispose();view.dispose();assert.equal(clones,1);assert.equal(borrowed,0);assert.equal(m.color.getHex(),0xffffff);
 }finally{view.dispose();g.dispose();m.dispose();map.dispose();}
});
test('candidate replaces all old generated warfield buckets with one static bounded ground-detail mesh',()=>{
 const {spec,field}=createBattlefrontDepotFront(),scene=new THREE.Scene(),view=createCrossfireWarfieldView(scene,spec,field);
 try{assert.equal(view.root.children.length,1);assert.equal(view.root.children[0].name,'battlefront-ground-detail');assert.equal(view.diagnostics.drawBuckets,1);assert.equal(view.diagnostics.physicsBodiesAdded,0);assert.ok(view.diagnostics.spallTriangles>0&&view.diagnostics.spallTriangles<=460);assert.ok(view.diagnostics.walkableMaxThickness<=.018);const mesh=view.root.children[0],array=mesh.geometry.attributes.position.array,version=mesh.geometry.attributes.position.version;view.update({phase:'playing'},[],1/60);assert.equal(mesh.geometry.attributes.position.array,array);assert.equal(mesh.geometry.attributes.position.version,version);
 }finally{view.dispose();}
});

test('library or material clone failure is transactional and frees only created tint clones',()=>{
 for(const mode of ['library','material']){
  const f=createBattlefrontDepotFront(),scene=new THREE.Scene(),proxy=new THREE.Group();proxy.name='solid:'+f.spec.geometry.find(c=>c.ruinInstanceId).id;scene.add(proxy);
  const g=new THREE.BoxGeometry(),m=new THREE.MeshStandardMaterial(),second=new THREE.MeshStandardMaterial();let calls=0,freed=0,borrowed=0;for(const r of [g,m,second])r.addEventListener('dispose',()=>borrowed++);
  const originalClone=m.clone.bind(m);m.clone=()=>{const c=originalClone();c.addEventListener('dispose',()=>freed++);return c;};second.clone=()=>{throw new Error('material clone rejected');};
  const library={clone(){if(++calls===2&&mode==='library')throw new Error('library clone rejected');const group=new THREE.Group();group.add(new THREE.Mesh(g,m));if(mode==='material')group.add(new THREE.Mesh(g,second));return group;}};
  assert.throws(()=>createRuinedDepotView(scene,f.spec,f.field,library),/clone rejected/);assert.equal(scene.children.length,1);assert.equal(proxy.visible,true);assert.equal(freed,1);assert.equal(borrowed,0);g.dispose();m.dispose();second.dispose();
 }
});

test('real campaign updates suppress actual proxies but keep replacement details through phase updates',async()=>{
 const f=createBattlefrontDepotFront(),a=campaign(f,{suppressZoneBoundaries:true,livingFactory:root=>createCrossfireWarfieldView(root,f.spec,f.field)});await a.view.ready;
 const ruin=createRuinedDepotView(a.scene,f.spec,f.field,{clone:()=>new THREE.Group()}),s=createGame(f.spec),proxies=f.spec.geometry.filter(c=>c.ruinInstanceId).map(c=>a.scene.getObjectByName('solid:'+c.id)),detail=a.scene.getObjectByName('battlefront-ground-detail');
 try{assert.equal(proxies.length,61);for(const phase of ['briefing','playing','paused','playing']){s.phase=phase;for(let i=0;i<3;i++){a.view.update(s,[],1/60);assert.equal(proxies.every(p=>p.visible),true);ruin.update();assert.equal(proxies.some(p=>p.visible),false);assert.equal(detail.visible,true);}}for(const name of ['warfield-soot','warfield-fragments','warfield-wall-scars','warfield-ruins','flush-scorch-paint','distant-cosmetic-smoke'])assert.equal(a.scene.getObjectByName(name)===undefined,true,name);
 }finally{ruin.dispose();a.view.dispose();}
});

test('occlusion restores tint before adapter disposes it once; borrowed original never freed',async()=>{
 const {createPlayerOcclusion}=await import('../src/player-occlusion.js');const f=createBattlefrontDepotFront(),scene=new THREE.Scene(),g=new THREE.BoxGeometry(4,5,.8),m=new THREE.MeshStandardMaterial(),first=f.spec.ruinedDepotLayout[0],ruin=createRuinedDepotView(scene,f.spec,f.field,{clone:()=>new THREE.Mesh(g,m)}),mesh=ruin.root.children[0].children[0],tint=mesh.material;let ownedFreed=0,borrowedFreed=0,cutFreed=0;
 tint.addEventListener('dispose',()=>ownedFreed++);m.addEventListener('dispose',()=>borrowedFreed++);const camera=new THREE.PerspectiveCamera(42,1,.1,100);camera.position.set(first.x,2,first.z+10);camera.lookAt(first.x,1,first.z-10);const occlusion=createPlayerOcclusion(scene);
 assert.ok(occlusion.update(camera,{x:first.x,y:0,z:first.z-10})>=1);assert.equal(mesh.material===tint,false);mesh.material.addEventListener('dispose',()=>cutFreed++);occlusion.dispose();assert.equal(mesh.material===tint,true);assert.equal(cutFreed,1);assert.equal(ownedFreed,0);ruin.dispose();ruin.dispose();assert.equal(ownedFreed,1);assert.equal(borrowedFreed,0);g.dispose();m.dispose();
});
