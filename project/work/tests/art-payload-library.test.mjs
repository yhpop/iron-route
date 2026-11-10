/** Real GLTFLoader, material/geometry parsing and art-library lifetime tests.
 * Only createImageBitmap is a metadata boundary double: it checks the real PNG
 * signature/dimensions/hash but does NOT decode pixels or allocate GPU objects.
 * These checks are not browser rendering, performance or iPad acceptance.
 */
import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ART_ROOTS, loadCampaignArt} from '../src/art-kit.js';

const keys=Object.keys(ART_ROOTS);
const source=Object.fromEntries(keys.map(key=>[key,readFileSync(new URL(`../assets/art-kit/${key}.glb`,import.meta.url))]));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const originalGlobals=Object.fromEntries(['self','createImageBitmap','fetch'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
let decoded=[],rejectPng;
before(()=>{
 globalThis.self=globalThis;
 const nativeFetch=globalThis.fetch;
 globalThis.fetch=(url,...args)=>{
  assert.match(String(url),/^blob:/,'art parser must not issue a network request');
  return nativeFetch(url,...args);
 };
 globalThis.createImageBitmap=async blob=>{
  const bytes=Buffer.from(await blob.arrayBuffer());
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const pngSha256=hash(bytes);
  if(pngSha256===rejectPng)throw new Error('Injected image decode rejection');
  decoded.push(pngSha256);
  return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),pngSha256,close(){}};
 };
});
after(()=>{for(const [key,descriptor]of Object.entries(originalGlobals)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});

function sourceImageHashes(){
 return Object.values(source).flatMap(bytes=>{
  const jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength)),binStart=28+jsonLength;
  return json.images.map(image=>{const view=json.bufferViews[image.bufferView],offset=binStart+(view.byteOffset||0);return hash(bytes.subarray(offset,offset+view.byteLength));});
 }).sort();
}
function ownedResources(records){
 const geometries=new Set(),materials=new Set(),textures=new Set();
 for(const gltf of Object.values(records))gltf.scene.traverse(node=>{
  if(node.geometry)geometries.add(node.geometry);
  for(const material of [].concat(node.material||[])){
   materials.add(material);
   for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
  }
 });
 return {geometries,materials,textures};
}
function watchResources(records){
 const owned=ownedResources(records),events=new Map();
 for(const set of Object.values(owned))for(const resource of set){events.set(resource,0);resource.addEventListener('dispose',()=>events.set(resource,events.get(resource)+1));}
 return {owned,events,expectCount(count){for(const [resource,actual]of events)assert.equal(actual,count,`${resource.type||resource.constructor.name}/${resource.name||''} disposal count`);}};
}
function trackingLoader(records,{beforeReturn}={}){
 const loader=new GLTFLoader();let call=0;
 return {async parseAsync(bytes,path){const key=keys[call++],gltf=await loader.parseAsync(bytes,path);records[key]=gltf;if(beforeReturn)await beforeReturn(key,gltf);return gltf;}};
}
async function preparedData(){
 // Dynamic import lets the first test report the missing implementation as the
 // deliberate red-stage failure, while the unchanged library tests remain runnable.
 const {prepareArtPayload}=await import('../scripts/prepare-art-payload.mjs');
 const {restoreArtGlb}=await import('../src/art-kit-payload.js');
 const prepared=await prepareArtPayload();
 return Object.fromEntries(keys.map(key=>[key,restoreArtGlb(prepared.pool,prepared.recipes[key])]));
}
function stable(value){
 if(value===null||typeof value!=='object')return typeof value==='function'?undefined:value;
 if(ArrayBuffer.isView(value))return {arrayType:value.constructor.name,byteLength:value.byteLength,sha256:hash(new Uint8Array(value.buffer,value.byteOffset,value.byteLength))};
 if(Array.isArray(value))return value.map(stable);
 const result={};
 for(const key of Object.keys(value).sort()){
  // Three.js IDs and event listener closures encode instance identity, not art.
  if(['uuid','id','_listeners'].includes(key)||typeof value[key]==='function')continue;
  result[key]=stable(value[key]);
 }
 return result;
}
function geometrySnapshot(geometry){
 return {
  type:geometry.type,name:geometry.name,
  index:geometry.index?attributeSnapshot(geometry.index):null,
  attributes:Object.fromEntries(Object.entries(geometry.attributes).sort().map(([key,attribute])=>[key,attributeSnapshot(attribute)])),
  morphAttributes:Object.fromEntries(Object.entries(geometry.morphAttributes).sort().map(([key,attributes])=>[key,attributes.map(attributeSnapshot)])),
  morphTargetsRelative:geometry.morphTargetsRelative,groups:stable(geometry.groups),drawRange:stable(geometry.drawRange),
  boundingBox:stable(geometry.boundingBox),boundingSphere:stable(geometry.boundingSphere),userData:stable(geometry.userData)
 };
}
function attributeSnapshot(attribute){
 return {name:attribute.name,itemSize:attribute.itemSize,count:attribute.count,normalized:attribute.normalized,gpuType:attribute.gpuType,
  offset:attribute.offset,stride:attribute.data?.stride,usage:attribute.usage||attribute.data?.usage,
  array:stable(attribute.array||attribute.data.array)};
}
function sceneSnapshot(root){
 root.updateWorldMatrix(true,true);
 const nodes=[];
 const walk=(node,parent)=>{
  const index=nodes.length;
  nodes.push({parent,name:node.name,type:node.type,position:node.position.toArray(),quaternion:node.quaternion.toArray(),scale:node.scale.toArray(),
   matrix:node.matrix.toArray(),matrixWorld:node.matrixWorld.toArray(),visible:node.visible,castShadow:node.castShadow,receiveShadow:node.receiveShadow,
   renderOrder:node.renderOrder,userData:stable(node.userData),geometry:node.geometry?geometrySnapshot(node.geometry):null,
   material:node.material?stable(node.material):null});
  for(const child of node.children)walk(child,index);
 };
 walk(root,null);return nodes;
}
function meshes(root){const result=[];root.traverse(node=>{if(node.isMesh)result.push(node);});return result;}

// Break caught: a changed PNG byte/span, geometry, material or named pivot may
// still parse, but cannot match both the original GLBs and complete library.
test('restored shipping GLBs give exactly equivalent complete textured libraries and articulated rigs',async()=>{
 const reconstructed=await preparedData();
 for(const key of keys)assert.deepEqual(Buffer.from(reconstructed[key]),source[key],`${key}: exact shipping GLB bytes`);
 decoded=[];
 const beforeRecords={},original=await loadCampaignArt(source,{loader:trackingLoader(beforeRecords)});
 const originalImages=[...decoded].sort();
 decoded=[];
 const afterRecords={},restored=await loadCampaignArt(reconstructed,{loader:trackingLoader(afterRecords)});
 try{
  assert.deepEqual(originalImages,sourceImageHashes(),'every original embedded PNG reaches ImageBitmap boundary unmodified');
  assert.deepEqual([...decoded].sort(),originalImages,'restored PNG bytes and occurrence counts');
  assert.deepEqual(restored.diagnostics,original.diagnostics);
  for(const key of keys){
   const before=original.clone(key),after=restored.clone(key);
   assert.deepEqual(afterRecords[key].parser.json,beforeRecords[key].parser.json,`${key}: complete glTF declarations and accessors`);
   assert.deepEqual(sceneSnapshot(after),sceneSnapshot(before),`${key}: full authored scene`);
   assert.ok(meshes(after).length>0);
   for(const mesh of meshes(after)){assert.ok(mesh.geometry.attributes.normal);assert.ok(mesh.geometry.attributes.uv);}
  }
  for(const [key,names]of [['sentry-turret',['TurretYaw','GunPitch','Recoil','Muzzle','Shield']],['cargo-truck',['WheelLFront','WheelLRear','WheelRFront','WheelRRear']]]){
   const before=original.clone(key),after=restored.clone(key);
   for(const root of [before,after]){
    for(const name of names)assert.ok(root.getObjectByName(name),`${key}/${name}`);
    if(key==='sentry-turret'){root.getObjectByName('TurretYaw').rotation.y=.8;root.getObjectByName('GunPitch').rotation.x=.12;root.getObjectByName('Recoil').position.z+=.045;}
    else for(const name of names)root.getObjectByName(name).rotation.x-=1;
   }
   assert.deepEqual(sceneSnapshot(after),sceneSnapshot(before),`${key}: articulated state`);
  }
 }finally{original.dispose();restored.dispose();}
});

test('source and restored libraries preserve ownership including superseded scene materials and parser-only prototypes',async()=>{
 const censuses=[];
 for(const data of [source,await preparedData()]){
  const records={},watchers=[],parserMaterials=new Set(),prototypeEvents=new Map();
  const library=await loadCampaignArt(data,{loader:trackingLoader(records,{async beforeReturn(key,gltf){
   watchers.push(watchResources({[key]:gltf}));
   for(let index=0;index<gltf.parser.json.materials.length;index++){
    const material=await gltf.parser.getDependency('material',index);parserMaterials.add(material);prototypeEvents.set(material,0);
    material.addEventListener('dispose',()=>prototypeEvents.set(material,prototypeEvents.get(material)+1));
   }
  }})});
  const allMaterials=new Set(watchers.flatMap(w=>[...w.owned.materials]));
  const remaining=ownedResources(records);
  assert.ok(allMaterials.size>remaining.materials.size,'sharing actually supersedes original parsed scene materials');
  const parserOnly=[...parserMaterials].filter(material=>!allMaterials.has(material));
  assert.ok(parserOnly.length>0,'exercise GLTFLoader material prototypes as distinct from rendered scene materials');
  for(const key of keys){
   const a=library.clone(key),b=library.clone(key),ma=meshes(a),mb=meshes(b);
   assert.notEqual(a,b);assert.equal(ma.length,mb.length);
   for(let i=0;i<ma.length;i++){assert.equal(ma[i].geometry,mb[i].geometry);assert.equal(ma[i].material,mb[i].material);}
  }
  for(const watcher of watchers)watcher.expectCount(0);
  library.dispose();library.dispose();
  for(const watcher of watchers)watcher.expectCount(1);
  assert.throws(()=>library.clone('cargo-truck'),/disposed/);
  censuses.push({
   geometries:watchers.reduce((count,w)=>count+w.owned.geometries.size,0),sceneMaterials:allMaterials.size,
   sharedMaterials:remaining.materials.size,textures:watchers.reduce((count,w)=>count+w.owned.textures.size,0),
   parserOnlyMaterials:parserOnly.length,parserOnlyDisposalCounts:parserOnly.map(material=>prototypeEvents.get(material)).sort()
  });
 }
 assert.deepEqual(censuses[1],censuses[0],'derived payload keeps original GPU ownership and parser-cache lifecycle');
 // Parser-only source materials were never rendered. The existing library owns
 // scene resources, not GLTFLoader cache prototypes; preserve that boundary.
});

test('late parse failure releases every already-parsed textured resource for source and restored bytes',async()=>{
 for(const data of [source,await preparedData()]){
  const records={},watchers=[],loader=new GLTFLoader();let call=0,completed=0,resolveFour;
  const fourReady=new Promise(resolve=>{resolveFour=resolve;});
  await assert.rejects(loadCampaignArt(data,{loader:{async parseAsync(bytes,path){
   const key=keys[call++];
   if(key==='sentry-turret'){await fourReady;throw new Error('Injected late parse failure');}
   const gltf=await loader.parseAsync(bytes,path);records[key]=gltf;watchers.push(watchResources({[key]:gltf}));if(++completed===4)resolveFour();return gltf;
  }}}),/Campaign art failed to load: sentry-turret: Injected late parse failure/);
  assert.equal(Object.keys(records).length,4);
  for(const watcher of watchers)watcher.expectCount(1);
 }
});

test('real GLTFLoader missing-texture results reject readiness and clean up source and restored libraries',async()=>{
 for(const data of [source,await preparedData()]){
  // canvas_base exists only on CargoTruck; all other GLBs finish normally.
  rejectPng='2ec6305d857c221308e70ef6b7bf10d844249b29d97ad73341d0a31ef66b9b77';
  const records={},watchers=[],errors=[],originalError=console.error;
  console.error=(...args)=>{if(String(args[0]).startsWith("THREE.GLTFLoader: Couldn't load texture"))errors.push(args);else originalError(...args);};
  try{
   await assert.rejects(loadCampaignArt(data,{loader:trackingLoader(records,{beforeReturn(key,gltf){watchers.push(watchResources({[key]:gltf}));}})}),/Campaign art failed to load: cargo-truck: Missing embedded texture .*\/map/);
   assert.equal(Object.keys(records).length,5);assert.equal(errors.length,1);
   for(const watcher of watchers)watcher.expectCount(1);
  }finally{rejectPng=undefined;console.error=originalError;}
 }
});

test('required-rig validation failure releases all source and restored library resources',async()=>{
 for(const data of [source,await preparedData()]){
  const watchers=[];
  await assert.rejects(loadCampaignArt(data,{loader:trackingLoader({},{beforeReturn(key,gltf){
   watchers.push(watchResources({[key]:gltf}));
   if(key==='sentry-turret'){const muzzle=gltf.scene.getObjectByName('Muzzle');muzzle.parent.remove(muzzle);}
  }})}),/Missing campaign art rig node sentry-turret\/Muzzle/);
  for(const watcher of watchers)watcher.expectCount(1);
 }
});
