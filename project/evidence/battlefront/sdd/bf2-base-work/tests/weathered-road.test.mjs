import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import * as relief from '../src/terrain-candidate/relief-view.js';
import {createHeightfield,roadSample} from '../src/terrain-candidate/heightfield.js';
const field=()=>createHeightfield({bounds:{minX:-20,maxX:20,minZ:-22,maxZ:22},cellSize:1,roads:[{material:'asphalt',width:7,points:[[0,-20],[0,20]]},{material:'earth',width:4,points:[[-12,-20],[-12,20]]}],heightAt:(x,z)=>Math.sin(x*.1)*.2});
function shaderFor(view){const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};view.mesh.material.onBeforeCompile(shader);return shader;}
function edge50(z){let lo=-.6,hi=.3;for(let i=0;i<24;i++){const edge=(lo+hi)/2;if(relief.roadMaterialWeight({material:'asphalt',edge},3.5,z)>.5)lo=edge;else hi=edge;}return(lo+hi)/2;}
test('asphalt shoulder breakup is resolvable at the existing mask scale, not sub-texel fuzz',()=>{
 const edges=Array.from({length:400},(_,i)=>edge50(-20+i*.1));assert.ok(Math.max(...edges)-Math.min(...edges)>.15,'road edge must vary more than roughly two representative map texels');
 for(let z=-20;z<20;z+=.31){assert.equal(relief.roadMaterialWeight({edge:-.6,material:'asphalt'},3.5,z),1);assert.equal(relief.roadMaterialWeight({edge:.3,material:'asphalt'},3.5,z),0);const center=edge50(z);assert.ok(relief.roadMaterialWeight({edge:center-.15,material:'asphalt'},3.5,z)>.99);assert.ok(relief.roadMaterialWeight({edge:center+.15,material:'asphalt'},3.5,z)<.01);}
});
test('world-space asphalt weather differs across four-metre texture repeats and stays bounded',()=>{
 assert.equal(typeof relief.asphaltWeatherWeight,'function');const f=field(),values=[];
 for(let z=-18;z<15;z+=.3){const a=relief.asphaltWeatherWeight(roadSample(f.roads,0,z),0,z),b=relief.asphaltWeatherWeight(roadSample(f.roads,0,z+4),0,z+4);assert.ok(a>=0&&a<=1);values.push(Math.abs(a-b));}
 assert.ok(values.reduce((n,x)=>n+x,0)/values.length>.025);assert.equal(relief.asphaltWeatherWeight(null,0,0),0);assert.equal(relief.asphaltWeatherWeight({material:'earth'},0,0),0);
});
test('actual mask carries weather without new textures or geometry and uses mipmapped minification',()=>{
 const f=field(),heights=f.heights.slice(),roads=JSON.stringify(f.roads),scene=new THREE.Scene(),v=relief.createReliefView(scene,f,{loadTextures:false});let disposals=0;
 try{const shader=shaderFor(v),mask=shader.uniforms.terrainMask.value;const textures=new Set([v.mesh.material.map,v.mesh.material.normalMap,v.mesh.material.roughnessMap,...Object.values(shader.uniforms).map(u=>u.value).filter(v=>v?.isTexture)]);assert.equal(textures.size,7);for(const texture of textures)texture.addEventListener('dispose',()=>disposals++);assert.equal(mask.image.width,1024);assert.equal(mask.image.height,1024);assert.equal(mask.generateMipmaps,true);assert.equal(mask.minFilter,THREE.LinearMipmapLinearFilter);assert.equal(mask.magFilter,THREE.LinearFilter);assert.equal(v.diagnostics.drawCalls,1);assert.equal(v.diagnostics.triangles,f.columns*f.rows*2);
 const values=new Set();for(let j=100;j<900;j+=40){const k=(j*1024+512)*4;assert.ok(mask.image.data[k]>.99*255);values.add(mask.image.data[k+3]);}assert.ok(values.size>10,'asphalt A channel must no longer be all-zero');
 assert.match(shader.fragmentShader,/texture2D\(map,terrainUv\)\.rgb\s*\*\s*mix\(\.88,1\.12,terrainMasks\.a\)/);assert.match(shader.fragmentShader,/texture2D\(roughnessMap,terrainUv\)\.g\s*\*\s*mix\(\.92,1\.0,terrainMasks\.a\)/);
 assert.deepEqual(f.heights,heights);assert.equal(JSON.stringify(f.roads),roads);assert.equal(scene.children.length,1);
 }finally{v.dispose();v.dispose();assert.equal(scene.children.length,0);assert.equal(disposals,7);}
});
test('unpaved road shoulders retain their previous soft width',()=>{
 assert.ok(relief.roadMaterialWeight({edge:.3,material:'earth'},0,0)>0);assert.equal(relief.roadMaterialWeight(null,0,0),0);
});
