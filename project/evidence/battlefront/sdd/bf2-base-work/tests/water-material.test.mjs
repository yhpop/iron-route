import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import {createWaterMaterial,createWaterPixels,sampleWaterField} from '../src/water-material.js';

test('water texture field is original non-flat, periodic in both axes and repeatable',()=>{
 for(const [u,v] of [[0,0],[.132,.879],[-.31,1.45]]){const a=sampleWaterField(u,v);for(const b of [sampleWaterField(u+1,v),sampleWaterField(u,v+1)])for(const k of Object.keys(a))assert.ok(Math.abs(a[k]-b[k])<1e-9,k);}
 const p=createWaterPixels(),q=createWaterPixels();assert.equal(p.size,256);
 for(const key of ['baseColor','normal','roughness']){assert.deepEqual(p[key],q[key]);assert.equal(p[key].length,256*256*4);let lo=255,hi=0;for(let i=0;i<p[key].length;i+=4){lo=Math.min(lo,p[key][i]);hi=Math.max(hi,p[key][i]);assert.equal(p[key][i+3],255);}assert.ok(hi-lo>8,`${key} must not be flat`);}
});
test('opaque nonmetal water is standard PBR, colour-correct and has no displacement or geometry side effects',async()=>{
 const w=createWaterMaterial();assert.deepEqual(await w.ready,{loaded:3,failed:0});const m=w.material;
 assert.ok(m.isMeshStandardMaterial);assert.equal(m.metalness,0);assert.equal(m.transparent,false);assert.equal(m.displacementMap,null);assert.equal(m.userData.collision,'none-material-only');
 assert.equal(m.map.colorSpace,THREE.SRGBColorSpace);for(const t of [m.normalMap,m.roughnessMap])assert.equal(t.colorSpace,THREE.NoColorSpace);
 for(const t of [m.map,m.normalMap,m.roughnessMap]){assert.equal(t.wrapS,THREE.RepeatWrapping);assert.equal(t.wrapT,THREE.RepeatWrapping);assert.ok(t.isDataTexture);}
 assert.equal(w.diagnostics.externalRequests,0);assert.ok(w.diagnostics.textureGpuMiB<=1.01);w.dispose();
});
test('only the normal map moves slowly, offsets stay finite/wrapped, and reduced motion freezes them',()=>{
 const w=createWaterMaterial(),{map,normalMap,roughnessMap}=w.material,base=map.offset.clone(),rough=roughnessMap.offset.clone();w.update(.1);assert.ok(normalMap.offset.length()>0&&normalMap.offset.length()<.002);
 const before=normalMap.offset.clone();w.update(100000,{reducedMotion:true});assert.deepEqual(normalMap.offset,before);
 for(const dt of [NaN,Infinity,-3,0])w.update(dt);assert.deepEqual(normalMap.offset,before);
 for(let i=0;i<100000;i++)w.update(20);assert.ok(normalMap.offset.x>=0&&normalMap.offset.x<1);assert.ok(normalMap.offset.y>=0&&normalMap.offset.y<1);assert.deepEqual(map.offset,base);assert.deepEqual(roughnessMap.offset,rough);
 const still=createWaterMaterial({reducedMotion:true});still.update(.1);assert.equal(still.material.normalMap.offset.length(),0);w.dispose();still.dispose();
});
test('water owns and disposes its 3 maps/material exactly once and stops updating after disposal',()=>{
 const w=createWaterMaterial(),resources=[w.material,w.material.map,w.material.normalMap,w.material.roughnessMap],counts=new Map(resources.map(r=>[r,0]));for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));const before=w.material.normalMap.offset.clone();w.dispose();w.dispose();w.update(.1);assert.deepEqual(w.material.normalMap.offset,before);for(const count of counts.values())assert.equal(count,1);
});
test('shipping offline PNG mirrors have exactly the runtime pixels in Blender UV orientation',async()=>{
 const pixels=createWaterPixels();for(const [key,name] of [['baseColor','basecolor'],['normal','normal'],['roughness','roughness']]){const png=await readFile(new URL(`../assets/terrain/water-${name}.png`,import.meta.url));assert.equal(png.readUInt32BE(16),256);assert.equal(png.readUInt32BE(20),256);const parts=[];let at=8;while(at<png.length){const n=png.readUInt32BE(at),type=png.toString('ascii',at+4,at+8);if(type==='IDAT')parts.push(png.subarray(at+8,at+8+n));at+=12+n;}const decoded=inflateSync(Buffer.concat(parts)),stride=256*4;for(let y=0;y<256;y++){assert.equal(decoded[y*(stride+1)],0);assert.deepEqual(new Uint8Array(decoded.subarray(y*(stride+1)+1,(y+1)*(stride+1))),pixels[key].subarray((255-y)*stride,(256-y)*stride));}}
});
