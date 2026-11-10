import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createVegetationView} from '../src/living-world.js';
const points=[{x:0,y:0,z:0,scale:1,angle:0,tint:.5},{x:8,y:0,z:0,scale:.7,angle:1,tint:.8}];
const far={x:100,z:100};

test('unchanged meadow never dirties the instance buffer',()=>{
 const view=createVegetationView(new THREE.Scene(),points),mesh=view.root.children[0];
 try{const before=mesh.instanceMatrix.array.slice(),version=mesh.instanceMatrix.version;
 for(let i=0;i<120;i++)view.update(far,1/60);
 assert.deepEqual(mesh.instanceMatrix.array,before);
 assert.equal(mesh.instanceMatrix.version,version,'unchanged matrices must not request another GPU upload');
 }finally{view.dispose();}
});
test('new crush and recovery upload only when geometry actually changes',()=>{
 const view=createVegetationView(new THREE.Scene(),points),mesh=view.root.children[0],matrix=new THREE.Matrix4();
 try{let version=mesh.instanceMatrix.version;const original=mesh.instanceMatrix.array.slice();
 view.update({x:0,z:0},.1);assert.equal(mesh.instanceMatrix.version,version+1);
 mesh.getMatrixAt(0,matrix);assert.ok(matrix.elements[5]<.2);assert.deepEqual(mesh.instanceMatrix.array.slice(112),original.slice(112),'distant grass stays untouched');
 version=mesh.instanceMatrix.version;for(let i=0;i<120;i++)view.update({x:0,z:0},.1);
 assert.equal(mesh.instanceMatrix.version,version,'holding an already flattened tuft does not change it');
 view.update(far,0);assert.equal(mesh.instanceMatrix.version,version,'zero elapsed time does not recover');
 view.update(far,.1);assert.equal(mesh.instanceMatrix.version,version+1);mesh.getMatrixAt(0,matrix);assert.ok(matrix.elements[5]>original[5]*.12);
 for(let i=0;i<201;i++)view.update(far,.1);mesh.getMatrixAt(0,matrix);assert.equal(matrix.elements[5],original[5]);
 version=mesh.instanceMatrix.version;view.update(far,.1);assert.equal(mesh.instanceMatrix.version,version,'fully recovered grass is static again');
 view.dispose();view.update({x:0,z:0},.1);assert.equal(mesh.instanceMatrix.version,version);
 }finally{view.dispose();}
});
