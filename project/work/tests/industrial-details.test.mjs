import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {listCraftedMissions} from '../src/content/crafted20/index.js';
import {createIndustrialDetails} from '../src/industrial-details.js';
import {parseArtGeometry} from './helpers/art-geometry.mjs';

function assertContained(view,spec){view.root.updateWorldMatrix(true,true);for(const group of view.root.children){const c=spec.geometry.find(x=>x.id===group.userData.colliderId);assert.ok(c,'every attachment names an existing collider');const inverse=new THREE.Matrix4().compose(new THREE.Vector3(c.x,c.y||0,c.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),c.yaw||0),new THREE.Vector3(1,1,1)).invert();group.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position,m=inverse.clone().multiply(o.matrixWorld),p=new THREE.Vector3();for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i).applyMatrix4(m);assert.ok(Math.abs(p.x)<=c.width/2+1e-5,`${c.id} x ${p.x}`);assert.ok(Math.abs(p.z)<=c.depth/2+1e-5,`${c.id} z ${p.z}`);assert.ok(p.y>=-1e-5&&p.y<=c.height+1e-5,`${c.id} y ${p.y}`);}});}}
test('all 20 actual industrial attachment vertices stay inside authoritative prisms without mutating physics/mission data',async()=>{
 let enriched=0;for(const spec of listCraftedMissions()){const before=JSON.stringify(spec),scene=new THREE.Scene(),view=createIndustrialDetails(scene,spec);await view.ready;assertContained(view,spec);assert.equal(JSON.stringify(spec),before);assert.equal(view.diagnostics.physicsBodiesAdded,0);assert.ok(view.diagnostics.drawCalls<=40);assert.ok(view.diagnostics.triangles<=26000);enriched+=view.root.children.length;view.dispose();assert.equal(scene.children.length,0);}assert.ok(enriched>=16);
});
test('rotated basin walls and quarter-turned pump equipment are inside the rotated physical boxes',()=>{
 const spec={geometry:[{id:'wall',kind:'box',x:12,z:3,y:.4,yaw:.7,width:1,depth:20,height:2.4},{id:'pump',kind:'box',x:0,z:0,yaw:-.6,width:11,depth:7,height:4}],sceneDressing:{water:[{polygon:[[0,0],[1,0],[1,1]],enclosedBy:['wall']}],landmarks:[{geometryId:'pump',assetKey:'pump-station',yawOffset:Math.PI/2}]}};
 const view=createIndustrialDetails(new THREE.Scene(),spec);assert.equal(view.root.children.length,2);assertContained(view,spec);view.dispose();
});
test('pump assemblies share GPU geometry/materials, carry real flanges/valves, and dispose each resource once',()=>{
 const spec={geometry:['a','b'].map((id,i)=>({id,kind:'box',x:i*15,z:0,width:8,depth:8,height:4})),sceneDressing:{landmarks:['a','b'].map(geometryId=>({geometryId,assetKey:'pump-station'}))}},view=createIndustrialDetails(new THREE.Scene(),spec),[a,b]=view.root.children;
 assert.ok(a.userData.features.includes('valve-wheel'));assert.ok(a.userData.features.includes('flanged-manifold'));assert.ok(a.children.length>1);for(let i=0;i<a.children.length;i++){assert.equal(a.children[i].geometry,b.children[i].geometry);assert.equal(a.children[i].material,b.children[i].material);}
 const resources=new Set();view.root.traverse(o=>{if(o.isMesh){resources.add(o.geometry);resources.add(o.material);}});const count=new Map([...resources].map(r=>[r,0]));for(const r of resources)r.addEventListener('dispose',()=>count.set(r,count.get(r)+1));view.dispose();view.dispose();for(const n of count.values())assert.equal(n,1);
});
test('attachments disappear with their destroyed authoritative solid; invalid references never create phantom freestanding details',()=>{
 const spec={geometry:[{id:'p',kind:'box',x:0,z:0,width:8,depth:8,height:4},{id:'tiny',kind:'box',x:20,z:0,width:.01,depth:1,height:.01}],sceneDressing:{landmarks:[{geometryId:'p',assetKey:'pump-station'},{geometryId:'missing',assetKey:'pump-station'}],water:[{polygon:[[0,0],[1,0],[1,1]],enclosedBy:['missing','tiny']}]}};
 const before=JSON.stringify(spec),v=createIndustrialDetails(new THREE.Scene(),spec);assert.equal(v.root.children.length,1);v.update({entities:{p:{destroyed:true}}});assert.equal(v.root.children[0].visible,false);v.update({entities:{p:{alive:true}}});assert.equal(v.root.children[0].visible,true);assert.equal(JSON.stringify(spec),before);assert.ok(v.diagnostics.warnings.length>=2);v.dispose();
});
test('pump manifold is exposed above the actual shipping GLB lower roof, not buried in the raised hall',async()=>{
 const model=(await parseArtGeometry('pump-station')).scene,scene=new THREE.Scene();scene.add(model);const spec={geometry:[{id:'p',kind:'box',x:0,z:0,width:8,depth:8,height:4}],sceneDressing:{landmarks:[{geometryId:'p',assetKey:'pump-station'}]}},view=createIndustrialDetails(scene,spec);scene.updateMatrixWorld(true);
 for(const [x,z] of [[1.52,-2.63],[3.35,-2.63],[2.05,-1.83]]){const ray=new THREE.Raycaster(new THREE.Vector3(x,4.1,z),new THREE.Vector3(0,-1,0)),roof=ray.intersectObject(model,true)[0],detail=ray.intersectObject(view.root,true)[0];assert.ok(roof&&Math.abs(roof.point.y-2.81)<.01,'mount sits on actual lower roof');assert.ok(detail&&detail.point.y>roof.point.y+.25,'equipment reads above, not inside, roof');assert.ok(detail.point.y<4,'equipment remains under authoritative height');}
 view.dispose();
});
test('hazard coping meets the visible top surface instead of being buried under existing wall cap',()=>{
 const spec={geometry:[{id:'w',kind:'box',x:0,z:0,width:20,depth:1,height:2.4}],sceneDressing:{water:[{polygon:[[-9,0],[9,0],[9,10]],enclosedBy:['w']}]}};const view=createIndustrialDetails(new THREE.Scene(),spec);view.root.updateMatrixWorld(true);const hit=new THREE.Raycaster(new THREE.Vector3(-8.32,4,0),new THREE.Vector3(0,-1,0)).intersectObject(view.root,true)[0];assert.ok(hit);assert.ok(Math.abs(hit.point.y-2.4)<1e-6,'coping paint must meet authoritative top');assert.equal(hit.object.material.polygonOffset,true);view.dispose();
});
test('constructor failure after scene attachment removes the partial root and disposes actual resources once',()=>{
 const counts=new Map();class FailingScene extends THREE.Scene{add(root){super.add(root);root.traverse(o=>{if(o.isMesh)for(const r of [o.geometry,o.material])if(!counts.has(r)){counts.set(r,0);r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));}});throw new Error('scene attachment failed');}}
 const scene=new FailingScene();assert.throws(()=>createIndustrialDetails(scene,listCraftedMissions()[9]),/scene attachment failed/);assert.equal(scene.children.length,0);assert.ok(counts.size>4);for(const count of counts.values())assert.equal(count,1);
});
test('malformed entries and walls too small for mechanical hardware omit details instead of implying new obstacles',()=>{
 const s={geometry:[{id:'short',kind:'box',x:0,z:0,width:1,depth:.5,height:.6}],sceneDressing:{water:[null,{enclosedBy:['short'],polygon:[[0,0],[1,1]]}],landmarks:[null]}};const scene=new THREE.Scene(),v=createIndustrialDetails(scene,s);assert.equal(v.root.children.length,0);assert.ok(v.diagnostics.warnings.length>=3);v.dispose();assert.equal(scene.children.length,0);
});
