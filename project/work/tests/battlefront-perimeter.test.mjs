/** CPU geometry/frustum evidence only: not pixels, GPU compilation or measured performance. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import * as THREE from 'three';
import {applyFollowCamera} from '../src/opening-combat-camera.js';
import {createBattlefrontDepotFront} from '../src/battlefront-depot-front.js';import * as relief from '../src/terrain-candidate/relief-view.js';
const freeze=o=>{if(o&&typeof o==='object'&&!ArrayBuffer.isView(o)){Object.freeze(o);for(const v of Object.values(o))freeze(v);}return o;};
const shader=()=>({uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader});
test('candidate supplies exact stitched 656-edge exterior-only ring with upward winding and joined corners',async()=>{
 const {field}=createBattlefrontDepotFront(),before=JSON.stringify(field);freeze(field);
 const scene=new THREE.Group(),view=relief.createReliefView(scene,field,{loadTextures:false,appearance:'battlefront'});
 try{
 assert.ok(view.perimeterMesh,'battlefront must supply missing optical exterior geometry');
 const api=await import('../src/battlefront-perimeter-view.js');assert.equal(typeof api.createBattlefrontPerimeterGeometry,'function');
 const {geometry:g,diagnostics}=api.createBattlefrontPerimeterGeometry(field),p=g.attributes.position,uv=g.attributes.uv,idx=g.index.array,b=field.bounds;
 try{assert.equal(idx.length/3,1312);assert.equal(p.count,1312);assert.equal(diagnostics.perimeterEdges,656);assert.deepEqual(diagnostics.outerBounds,{minX:-616,maxX:616,minZ:-618,maxZ:618});
 const expected=[];for(let i=0;i<160;i++)expected.push([i,0]);for(let j=0;j<168;j++)expected.push([160,j]);for(let i=160;i>0;i--)expected.push([i,168]);for(let j=168;j>0;j--)expected.push([0,j]);
 const inner=new Set(),outer=new Set();for(let k=0;k<656;k++){const [i,j]=expected[k],n=k*2;assert.equal(p.getX(n),Math.fround(b.minX+i*field.dx));assert.equal(p.getZ(n),Math.fround(b.minZ+j*field.dz));assert.equal(p.getY(n),Math.fround(field.heights[j*161+i]));inner.add([p.getX(n),p.getZ(n)].join(','));outer.add([p.getX(n+1),p.getZ(n+1)].join(','));assert.equal(p.getY(n+1),0);assert.ok(p.getX(n+1)===-616||p.getX(n+1)===616||p.getZ(n+1)===-618||p.getZ(n+1)===618);}
 assert.equal(inner.size,656);assert.equal(outer.size,656);for(const c of ['-616,-618','616,-618','616,618','-616,618'])assert.ok(outer.has(c));
 let area=0;for(let k=0;k<idx.length;k+=3){const a=idx[k],c=idx[k+1],d=idx[k+2],signed=(p.getZ(c)-p.getZ(a))*(p.getX(d)-p.getX(a))-(p.getX(c)-p.getX(a))*(p.getZ(d)-p.getZ(a));assert.ok(signed>0,'every triangle faces up');area+=signed/2;
 // Convex half-space proves each entire triangle is outside, not just its centroid.
 assert.ok([['X',-40,-1],['X',40,1],['Z',-42,-1],['Z',42,1]].some(([axis,edge,sign])=>[a,c,d].every(n=>sign*(p['get'+axis](n)-edge)>=0)),'no positive-area interior overlap');}
 assert.ok(Math.abs(area-(1232*1236-80*84))<1);for(let k=0;k<p.count;k++){assert.ok(Math.abs(uv.getX(k)-p.getX(k)/4)<1e-5);assert.ok(Math.abs(uv.getY(k)+p.getZ(k)/4)<1e-5);}
 assert.equal(JSON.stringify(field),before);
 }finally{g.dispose();}
 }finally{view.dispose();}
});
test('candidate ring borrows one material and maps, has no raycast/caster, and disposes each resource exactly once',()=>{
 const {field,spec}=createBattlefrontDepotFront(),before=JSON.stringify({field,spec});freeze(field);freeze(spec);const scene=new THREE.Scene(),v=relief.createReliefView(scene,field,{loadTextures:false,appearance:'battlefront'});
 try{assert.ok(v.perimeterMesh,'missing ring');const r=v.perimeterMesh;assert.equal(r.material,v.mesh.material);assert.equal(r.castShadow,false);assert.equal(r.receiveShadow,true);assert.equal(r.material.transparent,false);assert.equal(r.material.opacity,1);assert.equal(new THREE.Raycaster(new THREE.Vector3(-50,100,0),new THREE.Vector3(0,-1,0)).intersectObject(r).length,0);
 const s=shader();v.mesh.material.onBeforeCompile(s);const resources=new Set([r.geometry,v.mesh.geometry,v.mesh.material,v.mesh.material.map,v.mesh.material.normalMap,v.mesh.material.roughnessMap,...Object.values(s.uniforms).map(u=>u.value).filter(t=>t?.isTexture)]),counts=new Map();for(const x of resources){counts.set(x,0);x.addEventListener('dispose',()=>counts.set(x,counts.get(x)+1));}assert.equal(resources.size,10);assert.equal(v.diagnostics.drawCalls,2);assert.equal(v.diagnostics.perimeterTriangles,1312);assert.equal(v.diagnostics.additionalTextureBytes,0);const version=s.uniforms.terrainMask.value.version;v.update(freeze({phase:'playing'}),freeze([]),1/60);assert.equal(s.uniforms.terrainMask.value.version,version);assert.equal(JSON.stringify({field,spec}),before);v.dispose();v.dispose();assert.equal(scene.children.length,0);for(const n of counts.values())assert.equal(n,1);
 }finally{v.dispose();}
});
test('actual production camera frustum and smoothing/aim envelope fit ring for aspect .25..8 and four review viewports',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),cameraImplementation=readFileSync(new URL('../src/opening-combat-camera.js',import.meta.url),'utf8'),cam=main.match(/PerspectiveCamera\(([^)]+)\)/)[1].split(',').map(Number),offsets=[...cameraImplementation.matchAll(/target\.[xyz]\+\(portrait\?(\d+):(\d+)\)/g)].map(m=>[+m[1],+m[2]]),aim=+main.match(/Math\.sin\(aim\)\*([\d.]+)/)[1],threshold=+cameraImplementation.match(/portrait=camera\.aspect<([\d.]+)/)[1];assert.deepEqual(cam,[42,1,.15,150]);assert.deepEqual(offsets,[[8,10],[23,19],[22,18]]);assert.equal(aim,2.2);assert.equal(threshold,.85);assert.match(main,/target\.lerp\(focus,1-Math\.exp\(-Math\.min\(dt,\.1\)\*5\)\)/,'target remains convex combination of prior targets/focus');
 const {field,spec}=createBattlefrontDepotFront(),v=relief.createReliefView(new THREE.Group(),field,{loadTextures:false,appearance:'battlefront'});try{assert.ok(v.perimeterMesh,'missing ring');v.perimeterMesh.geometry.computeBoundingBox();const bounds=v.perimeterMesh.geometry.boundingBox,radial=150*Math.sqrt(1+Math.tan(21*Math.PI/180)**2*(1+8**2)),b=spec.bounds;assert.ok(radial>480&&radial<490);
 const aspects=[.25,.849999,.85,8,400/300,844/390,1280/720,390/844],origins=[];for(const profile of [{},{eightNpcReconstruction:true}])for(const aspect of aspects){const camera=new THREE.PerspectiveCamera(cam[0],aspect,cam[2],cam[3]),focus=new THREE.Vector3();applyFollowCamera(camera,new THREE.Vector3(),focus,profile,aspect*720,720);origins.push(camera.position.clone());
 for(const x of [b.minX-aim,b.maxX+aim])for(const z of [b.minZ-aim,b.maxZ+aim])for(const y of [.5,4.7]){const target=new THREE.Vector3(x,y,z);applyFollowCamera(camera,target,focus,profile,aspect*720,720);camera.updateMatrixWorld();for(const sx of [-1,1])for(const sy of [-1,1])for(const depth of [-1,1]){const p=new THREE.Vector3(sx,sy,depth).unproject(camera);assert.ok(p.x>bounds.min.x&&p.x<bounds.max.x&&p.z>bounds.min.z&&p.z<bounds.max.z,'entire convex finite frustum enclosed');}}
 }
 // Continuous aspect range bound, not only sampled viewports or ray-plane division at horizon.
 for(const axis of ['x','z']){const min=axis==='x'?b.minX:b.minZ,max=axis==='x'?b.maxX:b.maxZ,offset=Math.max(...origins.map(p=>p[axis]));assert.ok(min-aim+Math.min(...origins.map(p=>p[axis]))-radial>bounds.min[axis]);assert.ok(max+aim+offset+radial<bounds.max[axis]);}
 }finally{v.dispose();}
});

test('all three retained appearances remain one mesh with no optical ring',()=>{
 const {field}=createBattlefrontDepotFront();for(const appearance of ['default','scorched','crossfire']){const scene=new THREE.Group(),v=relief.createReliefView(scene,field,{loadTextures:false,appearance});try{assert.equal(v.perimeterMesh,undefined);assert.equal(scene.children.length,1);assert.equal(v.diagnostics.drawCalls,1);assert.equal(v.diagnostics.triangles,53760);}finally{v.dispose();}assert.equal(scene.children.length,0);}
});
