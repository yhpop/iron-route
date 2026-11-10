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
const fakeArt={clone(){return new THREE.Group();}};
function campaign(front,extra={}){const scene=new THREE.Scene(),view=createCampaignView(scene,front.spec,{artKit:fakeArt,terrainFactory:()=>({update(){},dispose(){}}),groundHeightAt:()=>0,...extra});return {scene,view};}
test('explicit candidate-only boundary suppression retains logical zones and gold active choice rings',async()=>{
 const f=createBattlefrontDepotFront(),before=JSON.stringify(f.spec.zones),a=campaign(f,{suppressZoneBoundaries:true}),b=campaign(createRuinedDepotFront());
 try{await a.view.ready;assert.equal(a.scene.getObjectByName('zone-boundary:'+f.spec.zones[0].id),undefined);assert.ok(b.scene.getObjectByName('zone-boundary:'+f.spec.zones[0].id));
 const s=createGame(f.spec);s.objectiveStates[f.spec.convoyChoice.requiresObjectiveId].status='complete';a.view.update(s);
 for(const option of f.spec.convoyChoice.options){const ring=a.scene.getObjectByName('objective-marker:'+option.zoneId);assert.ok(ring?.visible);assert.equal(ring.material.color.getHex(),0xe9c46a);}
 assert.equal(JSON.stringify(f.spec.zones),before);
 }finally{a.view.dispose();b.view.dispose();}
});
test('candidate owns one clone per original material identity, borrowing maps and geometry',()=>{
 const {spec,field}=createBattlefrontDepotFront(),scene=new THREE.Scene(),g=new THREE.BoxGeometry(),map=new THREE.Texture(),m=new THREE.MeshStandardMaterial({color:0xffffff,map,roughness:.4,metalness:.2});
 const library={clone(){const root=new THREE.Group();root.add(new THREE.Mesh(g,m),new THREE.Mesh(g,[m,m]));return root;}};
 const view=createRuinedDepotView(scene,spec,field,library),meshes=[];view.root.traverse(n=>{if(n.isMesh)meshes.push(n);});const owned=meshes[0].material;
 try{assert.notEqual(owned,m);assert.equal(owned.map,map);assert.equal(owned.roughness,1);assert.equal(owned.metalness,0);assert.ok(owned.color.r<m.color.r);for(const n of meshes){assert.equal(n.geometry,g);for(const material of Array.isArray(n.material)?n.material:[n.material])assert.equal(material,owned);}
 let clones=0,borrowed=0;owned.addEventListener('dispose',()=>clones++);for(const x of [g,m,map])x.addEventListener('dispose',()=>borrowed++);view.dispose();view.dispose();assert.equal(clones,1);assert.equal(borrowed,0);assert.equal(m.color.getHex(),0xffffff);
 }finally{view.dispose();g.dispose();m.dispose();map.dispose();}
});
test('candidate replaces all old generated warfield buckets with one static bounded ground-detail mesh',()=>{
 const {spec,field}=createBattlefrontDepotFront(),scene=new THREE.Scene(),view=createCrossfireWarfieldView(scene,spec,field);
 try{assert.equal(view.root.children.length,1);assert.equal(view.root.children[0].name,'battlefront-ground-detail');assert.equal(view.diagnostics.drawBuckets,1);assert.equal(view.diagnostics.physicsBodiesAdded,0);assert.ok(view.diagnostics.spallTriangles>0&&view.diagnostics.spallTriangles<=460);assert.ok(view.diagnostics.walkableMaxThickness<=.018);const mesh=view.root.children[0],array=mesh.geometry.attributes.position.array,version=mesh.geometry.attributes.position.version;view.update({phase:'playing'},[],1/60);assert.equal(mesh.geometry.attributes.position.array,array);assert.equal(mesh.geometry.attributes.position.version,version);
 }finally{view.dispose();}
});
