import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createVegetationView,createMeadow} from '../src/living-world.js';
import {createVerticalSlice} from '../src/terrain-candidate/vertical-slice.js';
import {sampleHeightfield} from '../src/terrain-candidate/heightfield.js';
const point=(x=0,z=0,y=0)=>({x,y,z,scale:1,widthScale:1.6,heightScale:1,angle:0,tint:.5,layer:'meadow'});
function roots(mesh){const positions=mesh.geometry.attributes.position,result=[],m=new THREE.Matrix4(),v=new THREE.Vector3();
 for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);for(let j=0;j<positions.count;j++)if(Math.abs(positions.getY(j))<1e-7){v.fromBufferAttribute(positions,j).applyMatrix4(m);result.push(v.clone());}}
 return result;
}
test('each blade root follows sloping terrain rather than one height per tuft',()=>{
 const height=(x,z)=>x*1.2+z*.35,scene=new THREE.Scene(),v=createVegetationView(scene,[point()],{groundHeightAt:height});
 try{const r=roots(v.root.children[0]);assert.ok(r.length>=14);for(const p of r){const gap=p.y-height(p.x,p.z);assert.ok(gap>=-.001,`root ${p.toArray()} penetrates by ${-gap}`);assert.ok(gap<.08,`floating root gap ${gap}`);}}
 finally{v.dispose();}
});
test('same layer tufts get deterministic independent blade layouts, not one repeated silhouette',()=>{
 const points=Array.from({length:12},(_,i)=>point(i*3));const v=createVegetationView(new THREE.Scene(),points),copy=createVegetationView(new THREE.Scene(),points);
 try{const mesh=v.root.children[0];assert.equal(mesh.count,84);assert.deepEqual(mesh.instanceMatrix.array,copy.root.children[0].instanceMatrix.array);
 const m=new THREE.Matrix4(),signatures=[];for(let i=0;i<12;i++){const parts=[];for(let b=0;b<7;b++){mesh.getMatrixAt(i*7+b,m);const e=m.elements;parts.push([e[12]-points[i].x,e[14]-points[i].z,e[5]].map(n=>n.toFixed(3)));}signatures.push(JSON.stringify(parts));}assert.equal(new Set(signatures).size,12);
 }finally{v.dispose();copy.dispose();}
});
test('crushing changes blade shape but never slides its anchored root across a slope',()=>{
 const h=(x,z)=>x*.7+z*.3,v=createVegetationView(new THREE.Scene(),[point()],{groundHeightAt:h});
 try{const mesh=v.root.children[0],m=new THREE.Matrix4(),before=[];for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);before.push(m.elements.slice(12,15));}v.update({x:0,z:0},.1);
 for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);assert.deepEqual(m.elements.slice(12,15),before[i]);}
 for(const p of roots(mesh))assert.ok(p.y-h(p.x,p.z)>=-.001);
 }finally{v.dispose();}
});
test('rooted meadow preserves one draw and original triangle budget, with explicit blade instance count',()=>{
 const {spec,field}=createVerticalSlice(),height=(x,z)=>sampleHeightfield(field,x,z).height,points=createMeadow(spec,height,3600),v=createVegetationView(new THREE.Scene(),points,{groundHeightAt:height});
 try{const mesh=v.root.children[0];assert.equal(v.diagnostics.instances,3600);assert.equal(v.diagnostics.bladeInstances,25200);assert.equal(v.diagnostics.drawCalls,1);assert.equal(mesh.count*mesh.geometry.attributes.position.count/3,151200);
 let worst=0;for(const p of roots(mesh))worst=Math.min(worst,p.y-height(p.x,p.z));assert.ok(worst>=-.002,`representative field root penetration ${worst}`);
 }finally{v.dispose();}
});
test('only changed tufts are queued for upload, pending ranges merge without losing prior changes',()=>{
 const v=createVegetationView(new THREE.Scene(),[point(),point(8),point(16)]);
 try{const a=v.root.children[0].instanceMatrix;a.clearUpdateRanges();const version=a.version;
 v.update({x:100,z:100},.1);assert.equal(a.version,version);assert.deepEqual(a.updateRanges,[]);
 v.update({x:0,z:0},.1);assert.deepEqual(a.updateRanges,[{start:0,count:112}]);
 v.update({x:16,z:0},.1);assert.deepEqual(a.updateRanges,[{start:0,count:112},{start:224,count:112}]);
 for(let i=0;i<20;i++)v.update({x:16,z:0},.1);assert.deepEqual(a.updateRanges,[{start:0,count:112},{start:224,count:112}]);
 a.clearUpdateRanges();v.update({x:16,z:0},.1);assert.deepEqual(a.updateRanges,[{start:0,count:112}]);
 }finally{v.dispose();}
});
test('actual field has narrow planted roots and no standing leaf triangles below terrain',()=>{
 const {spec,field}=createVerticalSlice(),h=(x,z)=>sampleHeightfield(field,x,z).height,v=createVegetationView(new THREE.Scene(),createMeadow(spec,h,3600),{groundHeightAt:h});
 try{const mesh=v.root.children[0],a=mesh.geometry.attributes.position,m=new THREE.Matrix4(),p=new THREE.Vector3();let min=Infinity,maxRootGap=0;
 for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);for(let j=0;j<a.count;j++){p.fromBufferAttribute(a,j).applyMatrix4(m);const gap=p.y-h(p.x,p.z);min=Math.min(min,gap);if(a.getY(j)===0)maxRootGap=Math.max(maxRootGap,gap);}}
 assert.ok(maxRootGap<.03,`broad floating root gap ${maxRootGap}`);assert.ok(min>=-.005,`standing leaf terrain penetration ${min}`);
 }finally{v.dispose();}
});
test('initial full buffer allocation does not leave a stale full-range queue for first local change',()=>{
 const v=createVegetationView(new THREE.Scene(),[point(),point(8)]);
 try{const a=v.root.children[0].instanceMatrix;assert.deepEqual(a.updateRanges,[]);assert.ok(a.version>0);v.update({x:8,z:0},.1);assert.deepEqual(a.updateRanges,[{start:112,count:112}]);}
 finally{v.dispose();}
});
test('flat ground retains broad bend variation instead of making every short blade upright',()=>{
 const p={...point(),heightScale:.55},v=createVegetationView(new THREE.Scene(),[p],{groundHeightAt:()=>0}),m=new THREE.Matrix4(),ratios=[];
 try{const mesh=v.root.children[0];for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);ratios.push(Math.hypot(m.elements[8],m.elements[9],m.elements[10])/m.elements[5]);}assert.ok(Math.max(...ratios)>2.5);assert.ok(Math.max(...ratios)-Math.min(...ratios)>1);}
 finally{v.dispose();}
});
test('crushed blades follow the slope instead of burying their tips while roots stay anchored',()=>{
 const {spec,field}=createVerticalSlice(),h=(x,z)=>sampleHeightfield(field,x,z).height,points=createMeadow(spec,h,3600),v=createVegetationView(new THREE.Scene(),points,{groundHeightAt:h});
 try{const mesh=v.root.children[0],a=mesh.geometry.attributes.position,m=new THREE.Matrix4(),p=new THREE.Vector3(),target=points[3414];v.update(target,.1);
 let min=Infinity;for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);for(let j=0;j<a.count;j++){p.fromBufferAttribute(a,j).applyMatrix4(m);min=Math.min(min,p.y-h(p.x,p.z));}}assert.ok(min>=-.005,`crushed leaf tip penetrates terrain by ${-min}`);
 }finally{v.dispose();}
});
