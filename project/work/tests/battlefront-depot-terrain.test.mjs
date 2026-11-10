/** Shader text and CPU mask parity, not GPU render or measured palette acceptance. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import * as THREE from 'three';
import {createReliefView,patchReliefShader} from '../src/terrain-candidate/relief-view.js';import {createBattlefrontDepotFront} from '../src/battlefront-depot-front.js';import {terrainSurfaceAt,roadSample} from '../src/terrain-candidate/heightfield.js';import {noise} from '../src/terrain-candidate/vendor/three-terrain/noise.js';import {TERRAIN_TEXTURE_URLS} from '../assets/terrain/runtime-textures.js';
const oldText=readFileSync(new URL('../../evidence/battlefront/sdd/bf2-base-work/src/terrain-candidate/relief-view.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replaceAll('export function','function');
const old=new Function('THREE','TERRAIN_TEXTURE_URLS','terrainSurfaceAt','roadSample','noise',oldText+'\nreturn {createReliefView,patchReliefShader};')(THREE,TERRAIN_TEXTURE_URLS,terrainSurfaceAt,roadSample,noise);
function shader(){return {uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <map_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>'};}
const hash=b=>createHash('sha256').update(b).digest('hex');
test('old default/scorched/crossfire shader text is byte-exact; candidate adds no sampler and unique cache key',()=>{
 for(const appearance of ['default','scorched','crossfire']){const a=shader(),b=shader();patchReliefShader(a,{}, {appearance});old.patchReliefShader(b,{}, {appearance});assert.deepEqual(a,b);}
 const a=shader(),b=shader();patchReliefShader(a,{}, {appearance:'battlefront'});patchReliefShader(b,{}, {appearance:'crossfire'});assert.equal((a.fragmentShader.match(/sampler2D/g)||[]).length,(b.fragmentShader.match(/sampler2D/g)||[]).length);assert.match(a.fragmentShader,/mineralSoil/);assert.match(a.fragmentShader,/battleChar/);assert.match(a.fragmentShader,/terrainOutside/);
});
test('old mask/geometry remain exact, candidate uses same six maps and existing B weather channel without geometry or map URL changes',()=>{
 const {field}=createBattlefrontDepotFront();let candidate;
 for(const appearance of ['default','scorched','crossfire']){
  const a=createReliefView(new THREE.Group(),field,{loadTextures:false,appearance}),b=old.createReliefView(new THREE.Group(),field,{loadTextures:false,appearance});
  try{const sa=shader(),sb=shader();a.mesh.material.onBeforeCompile(sa);b.mesh.material.onBeforeCompile(sb);assert.equal(hash(sa.uniforms.terrainMask.value.image.data),hash(sb.uniforms.terrainMask.value.image.data));assert.deepEqual(a.mesh.geometry.attributes.position.array,b.mesh.geometry.attributes.position.array);assert.deepEqual(a.mesh.geometry.index.array,b.mesh.geometry.index.array);
   if(appearance==='crossfire'){
    candidate=createReliefView(new THREE.Group(),field,{loadTextures:false,appearance:'battlefront'});const sc=shader();candidate.mesh.material.onBeforeCompile(sc);const ca=sc.uniforms.terrainMask.value.image.data,oa=sa.uniforms.terrainMask.value.image.data;let bChanges=0;for(let i=0;i<ca.length;i+=4){assert.equal(ca[i],oa[i]);assert.equal(ca[i+1],oa[i+1]);assert.equal(ca[i+3],oa[i+3]);bChanges+=ca[i+2]!==oa[i+2];}assert.ok(bChanges>900000);assert.equal(candidate.mesh.material.customProgramCacheKey(),'relief-pbr-world-weather-v6-battlefront-grounded');assert.notEqual(candidate.mesh.material.customProgramCacheKey(),a.mesh.material.customProgramCacheKey());assert.deepEqual(candidate.mesh.geometry.attributes.position.array,a.mesh.geometry.attributes.position.array);assert.deepEqual(candidate.mesh.geometry.index.array,a.mesh.geometry.index.array);assert.equal(Object.values(sc.uniforms).filter(u=>u.value?.isTexture).length+3,7);assert.equal(candidate.diagnostics.additionalTextureBytes,0);assert.equal(candidate.diagnostics.maskResolution,1024);
   }
  }finally{a.dispose();b.dispose();candidate?.dispose();}
 }
});
