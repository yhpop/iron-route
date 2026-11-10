/** Actual source GLB / CPU Three tests. No claim about browser pixels or device performance. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import * as THREE from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createInterceptorLibrary} from '../src/interceptor-art.js';import {createEightNpcCrossfire} from '../src/eight-npc-crossfire-front.js';import {createGame,stepGame} from '../src/campaign-simulation.js';
const api=await import('../src/team-roof-mark.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
async function fixture(){const b=await readFile(new URL('../assets/pz3-interceptor.glb',import.meta.url));const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');const lib=createInterceptorLibrary(gltf);const {spec}=createEightNpcCrossfire();return {lib,spec,asset:lib.clone()};}
test('roof identifiers 20261103: seven actual PzIII receive shape+color relation marks, no source mutation',async()=>{
 assert.equal(typeof api.createPz3TeamMark,'function');const f=await fixture(),before=JSON.stringify(f.spec),s=createGame(f.spec),marks=[];
 try{for(const source of f.spec.entities){const asset=f.lib.clone(),mark=api.createPz3TeamMark(asset,f.spec,source);if(source.vehicle==='pz3'){assert.ok(mark);marks.push(mark);mark.update(s);assert.equal(mark.root.visible,true);assert.equal(mark.root.parent.name,'TurretDetail_6');assert.equal(mark.relation,source.team==='allied'?'ally':'enemy');assert.ok(mark.triangles>0&&mark.triangles<120);assert.equal(mark.root.material.depthTest,true);assert.equal(mark.root.material.depthWrite,true);assert.equal(mark.root.material.fog,true);assert.equal(mark.root.renderOrder,0);}else assert.equal(mark,null);}
 assert.equal(marks.length,7);assert.equal(marks.filter(m=>m.relation==='ally').length,4);assert.equal(JSON.stringify(f.spec),before);
 }finally{marks.forEach(m=>m.dispose());f.lib.dispose();}
});
test('actual GLB every decal vertex lies within its measured roof region and <=4mm above real indexed roof',async()=>{
 assert.equal(typeof api.createPz3TeamMark,'function');const f=await fixture();try{for(const team of ['allied','hostile']){const source=f.spec.entities.find(e=>e.vehicle==='pz3'&&e.team===team),asset=f.lib.clone(),mark=api.createPz3TeamMark(asset,f.spec,source),roof=asset.getObjectByName('TurretDetail_6'),local=new THREE.Mesh(roof.geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),positions=mark.root.geometry.attributes.position,ray=new THREE.Raycaster();local.updateMatrixWorld(true);
 for(let i=0;i<positions.count;i++){const v=new THREE.Vector3().fromBufferAttribute(positions,i);assert.ok(v.x>=-.341&&v.x<=.071&&v.z>=-.441&&v.z<=-.039);ray.set(new THREE.Vector3(v.x,1,v.z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(local,false)[0];assert.ok(hit,'actual roof hit');assert.ok(v.y-hit.point.y>=0&&v.y-hit.point.y<.004,`surface offset ${v.y-hit.point.y}`);}
 local.material.dispose();mark.dispose();}}finally{f.lib.dispose();}
});
test('roof mark is attached to actual turret rotation, freezes on pause and hides wreck/missing/unknown relations',async()=>{
 assert.equal(typeof api.createPz3TeamMark,'function');const f=await fixture(),source=f.spec.entities.find(e=>e.vehicle==='pz3'&&e.team==='allied'),mark=api.createPz3TeamMark(f.asset,f.spec,source);try{let s=createGame(f.spec);mark.update(s);const before=JSON.stringify(s),yaw=f.asset.getObjectByName('TurretYaw');f.asset.updateMatrixWorld(true);const a=mark.root.localToWorld(new THREE.Vector3(-.135,.36,-.24));yaw.rotation.y=.8;f.asset.updateMatrixWorld(true);const b=mark.root.localToWorld(new THREE.Vector3(-.135,.36,-.24));assert.notDeepEqual(b.toArray(),a.toArray());assert.equal(JSON.stringify(s),before);
 s=stepGame(stepGame(s,{start:true}),{pause:true});mark.update(s);const frozen=mark.root.matrixWorld.clone();mark.update(s);assert.deepEqual(mark.root.matrixWorld.elements,frozen.elements);assert.equal(mark.root.visible,true);
 for(const patch of [{alive:false},{destroyed:true},{hp:0},{team:'unknown'},{team:'hostile'}]){const copy=structuredClone(s);Object.assign(copy.entities[source.id],patch);mark.update(copy);assert.equal(mark.root.visible,false);}
 const copy=structuredClone(s);delete copy.entities[source.id];mark.update(copy);assert.equal(mark.root.visible,false);mark.update(s);assert.equal(mark.root.visible,true);
 let g=0,m=0;mark.root.geometry.addEventListener('dispose',()=>g++);mark.root.material.addEventListener('dispose',()=>m++);mark.dispose();mark.dispose();assert.equal(g,1);assert.equal(m,1);assert.equal(mark.root.parent,null);
 }finally{mark.dispose();f.lib.dispose();}
});
test('roof mark fails closed for legacy/neutral/missing art',async()=>{
 assert.equal(typeof api.createPz3TeamMark,'function');const f=await fixture(),source=f.spec.entities.find(e=>e.vehicle==='pz3');try{assert.equal(api.createPz3TeamMark(f.asset,{...f.spec,eightNpcReconstruction:false},source),null);assert.equal(api.createPz3TeamMark(f.asset,f.spec,{...source,team:'unknown'}),null);assert.equal(api.createPz3TeamMark(new THREE.Group(),f.spec,source),null);}finally{f.lib.dispose();}
});
test('production authored view integrates seven physical marks, hides dead/missing marks, leaves legacy view unchanged and disposes once',async()=>{
 const {createAuthoredSceneView}=await import('../src/authored-scene-view.js'),{createCampaignArtLibrary}=await import('../src/art-kit.js'),{geometryLibrary}=await import('./helpers/art-geometry.mjs');
 const f=await fixture(),base=createCampaignArtLibrary(await geometryLibrary()),scene=new THREE.Scene(),kit={clone:key=>key==='pz3'?f.lib.clone():base.clone(key)},view=createAuthoredSceneView(scene,f.spec,kit);let s=createGame(f.spec);const before=JSON.stringify(s);
 try{await view.ready;view.update(s,[],0);const marks=[];view.root.traverse(n=>{if(n.name.startsWith('team-roof-mark:'))marks.push(n);});assert.equal(marks.length,7);assert.ok(marks.every(n=>n.visible));assert.equal(JSON.stringify(s),before);
 const id=f.spec.entities.find(e=>e.vehicle==='pz3').id;s.entities[id].alive=false;s.entities[id].hp=0;view.update(s,[],0);assert.equal(view.entities.get(id).getObjectByName(`team-roof-mark:${id}`).visible,false);
 const another=f.spec.entities.find(e=>e.vehicle==='pz3'&&e.id!==id).id;delete s.entities[another];view.update(s,[],0);assert.equal(view.entities.get(another).getObjectByName(`team-roof-mark:${another}`).visible,false);
 let disposed=0;for(const mesh of marks)mesh.geometry.addEventListener('dispose',()=>disposed++);view.dispose();view.dispose();assert.equal(disposed,7);assert.equal(scene.children.length,0);
 const old=createAuthoredSceneView(scene,{...f.spec,eightNpcReconstruction:false},kit);try{await old.ready;let count=0;old.root.traverse(n=>{if(n.name.startsWith('team-roof-mark:'))count++;});assert.equal(count,0);}finally{old.dispose();}
 }finally{view.dispose();base.dispose();f.lib.dispose();}
});
