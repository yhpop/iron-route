import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import * as relief from '../src/terrain-candidate/relief-view.js';
import {createHeightfield} from '../src/terrain-candidate/heightfield.js';
const shader=(appearance)=>{const s={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};relief.patchReliefShader(s,{}, {appearance});return s;};
const digest=s=>createHash('sha256').update(s.vertexShader+'\n'+s.fragmentShader).digest('hex');
test('default and previously device-tested scorched shader sources stay byte-identical',()=>{
 assert.equal(digest(shader('default')),'4436790cf78f1c475b42d99b0781b976f903af2e443ed67b9c9c7469e68b2daa');
 assert.equal(digest(shader('scorched')),'04fdebe6ce70a81f0b53610d6f228e3279bae38acd220ece730a35b7276acb4f');
});
test('crossfire shallow weather is bounded, deterministic, spatially varied and not four metre periodic',()=>{
 assert.equal(typeof relief.crossfireWeatherWeight,'function');
 const values=[];let shiftDifference=0;
 for(let z=-36;z<=36;z+=2)for(let x=-36;x<=36;x+=2){const n=relief.crossfireWeatherWeight(x,z);assert.equal(n,relief.crossfireWeatherWeight(x,z));assert.ok(n>=0&&n<=1);values.push(n);shiftDifference+=Math.abs(n-relief.crossfireWeatherWeight(x+4,z));}
 assert.ok(Math.max(...values)-Math.min(...values)>.6);assert.ok(shiftDifference/values.length>.045);
});
test('crossfire shader uses existing channels and samples without geometry displacement or added sampler',()=>{
 const old=shader('scorched'),war=shader('crossfire');assert.notEqual(digest(war),digest(old));assert.equal(war.vertexShader,old.vertexShader);
 assert.match(war.fragmentShader,/crossfire shallow battle weather/);assert.match(war.fragmentShader,/warSoot/);assert.match(war.fragmentShader,/warAsh/);
 assert.equal((war.fragmentShader.match(/texture2D\(/g)||[]).length,(old.fragmentShader.match(/texture2D\(/g)||[]).length);
 assert.equal((war.fragmentShader.match(/uniform sampler2D/g)||[]).length,(old.fragmentShader.match(/uniform sampler2D/g)||[]).length);
});
test('crossfire view preserves field, roads and contact geometry; fixed mask has no frame upload and disposes once',async()=>{
 const field=createHeightfield({bounds:{minX:-40,maxX:40,minZ:-40,maxZ:40},cellSize:20,roads:[{width:6,material:'asphalt',points:[[-40,0],[40,0]]}]}),before=JSON.stringify(field),scene=new THREE.Scene();
 const old=relief.createReliefView(scene,field,{loadTextures:false,appearance:'scorched'}),war=relief.createReliefView(scene,field,{loadTextures:false,appearance:'crossfire'});
 await war.ready;assert.equal(JSON.stringify(field),before);assert.deepEqual(war.mesh.geometry.attributes.position.array,old.mesh.geometry.attributes.position.array);assert.deepEqual(war.mesh.geometry.index.array,old.mesh.geometry.index.array);assert.notEqual(war.mesh.material.customProgramCacheKey(),old.mesh.material.customProgramCacheKey());
 const shaders=[old,war].map(v=>{const s={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};v.mesh.material.onBeforeCompile(s);return s;});
 const a=shaders[0].uniforms.terrainMask.value.image.data,b=shaders[1].uniforms.terrainMask.value.image.data;let changes=0;
 for(let i=0;i<a.length;i+=4){assert.equal(a[i],b[i]);assert.equal(a[i+1],b[i+1]);assert.equal(a[i+3],b[i+3]);if(a[i+2]!==b[i+2])changes++;}assert.ok(changes>100000);
 const resources=new Set([war.mesh.geometry,war.mesh.material,war.mesh.material.map,war.mesh.material.normalMap,war.mesh.material.roughnessMap,...Object.values(shaders[1].uniforms).map(u=>u.value).filter(v=>v?.isTexture)]),counts=new Map();for(const r of resources){counts.set(r,0);r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));}
 const texture=shaders[1].uniforms.terrainMask.value,version=texture.version,bytes=texture.image.data.slice();for(let i=0;i<120;i++)war.update({phase:'playing'},[],1/60);assert.equal(texture.version,version);assert.deepEqual(texture.image.data,bytes);assert.equal(war.diagnostics.maskBaseBytes,4194304);assert.equal(war.diagnostics.additionalTextureBytes,0);
 war.dispose();war.dispose();for(const n of counts.values())assert.equal(n,1);old.dispose();assert.equal(scene.children.length,0);
});
// Evaluate the actual straight-line GLSL crossfire color block channel by channel.
// This is an arithmetic/dataflow negative control, not a GPU compilation test.
function evaluateWarColor({dirt=0,ruts=0,weather=.1,asphalt=0}={}){
 const source=shader('crossfire').fragmentShader.split('// crossfire shallow battle weather:')[1].split('diffuseColor.rgb*=terrainColor;')[0];
 const earth=[.32,.27,.19],earthLuma=earth.reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const mix=(a,b,t)=>a*(1-t)+b*t,smoothstep=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
 return earth.map((detail,channel)=>{
  let body=source.slice(source.indexOf('float warLuma='))
   .replace(/dot\(earthDetail,vec3\(\.2126,\.7152,\.0722\)\)/g,'earthLuma')
   .replace(/vec3\(([^()]*)\)/g,(_,values)=>{const v=values.split(',');return '('+(v.length===1?v[0]:v[channel])+')';})
   .replace(/\b(?:float|vec3)\s+/g,'let ')
   .replaceAll('terrainMasks.b','weather').replaceAll('terrainMasks.g','dirt').replaceAll('terrainMasks.a','ruts');
  return new Function('mix','smoothstep','earthDetail','earthLuma','weather','dirt','ruts','coarseLuma','asphaltColor','terrainBlend',`let terrainColor=0;${body};return terrainColor;`)(mix,smoothstep,detail,earthLuma,weather,dirt,ruts,.32,.10,asphalt);
 });
}
test('actual crossfire final color consumes dirt and rut channels before ash/soot, with off-road and asphalt negative controls',()=>{
 const fragment=shader('crossfire').fragmentShader.split('// crossfire shallow battle weather:')[1];
 assert.match(fragment,/warCompacted\*=1\.0-terrainMasks\.a\*/);
 assert.match(fragment,/warSoil=mix\(warSoil,warCompacted,terrainMasks\.g\*/);
 for(const weather of [.1,.44,.69,.95]){
  const bare=evaluateWarColor({weather}),road=evaluateWarColor({weather,dirt:1}),rut=evaluateWarColor({weather,dirt:1,ruts:1});
  assert.ok(road.some((v,i)=>Math.abs(v-bare[i])>.0005),'dirt still changes final output under weather '+weather);
  assert.ok(rut.every((v,i)=>v<road[i]),'ruts darken actual final dirt output '+weather);
  assert.deepEqual(evaluateWarColor({weather,dirt:0,ruts:1}),bare,'no soil-road channel means no phantom dirt rut');
  assert.deepEqual(evaluateWarColor({weather,dirt:0,asphalt:1}),evaluateWarColor({weather,dirt:1,asphalt:1}),'asphalt branch does not inherit dirt compaction');
 }
});
