import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Exact contract of the three attributable LFA source meshes, at .8 metres/unit.
const MODULES=Object.freeze({
 'workshop':Object.freeze({triangles:291,size:[9.599978638,3.299938583,12.531077576]}),
 'broken-corner':Object.freeze({triangles:308,size:[10.028051758,3.299937820,10.470709229]}),
 'window-wall':Object.freeze({triangles:158,size:[9.6,3.299937820,.453320313]})
});
const slots=['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap'];
function resources(root){
 const owned=new Set();
 root?.traverse(node=>{
  if(node.geometry)owned.add(node.geometry);
  for(const material of [].concat(node.material||[])){
   owned.add(material);
   for(const slot of slots)if(material[slot])owned.add(material[slot]);
  }
 });
 return owned;
}
function parseClosedGLB(bytes){
 const view=new DataView(bytes);
 if(bytes.byteLength<28||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.byteLength)throw new Error('Invalid ruined depot GLB header');
 const n=view.getUint32(12,true);
 if(n%4||n+28>bytes.byteLength||view.getUint32(16,true)!==0x4e4f534a||view.getUint32(n+24,true)!==0x004e4942||view.getUint32(n+20,true)+n+28!==bytes.byteLength)throw new Error('Invalid ruined depot GLB chunks');
 const json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,n)));
 if(json.asset?.version!=='2.0'||json.buffers?.length!==1||json.buffers.some(b=>b.uri)||json.images?.length!==3||json.images.some(i=>i.uri||i.mimeType!=='image/png'||!Number.isInteger(i.bufferView)))throw new Error('Ruined depot requires a closed GLB with three embedded PNG maps; no external URI');
 for(const image of json.images){
  const range=json.bufferViews?.[image.bufferView];
  if(!range||range.buffer!==0||!Number.isInteger(range.byteLength)||range.byteLength<24)throw new Error('Invalid embedded texture range');
  const offset=n+28+(range.byteOffset||0);
  if(offset+range.byteLength>bytes.byteLength||view.getUint32(offset,false)!==0x89504e47||view.getUint32(offset+4,false)!==0x0d0a1a0a||view.getUint32(offset+16,false)!==2048||view.getUint32(offset+20,false)!==2048)throw new Error('Invalid embedded 2048 PNG texture');
 }
 if(json.materials?.length!==1)throw new Error('Unexpected ruined depot material count');
 const material=json.materials[0],pbr=material.pbrMetallicRoughness;
 const refs=[pbr?.baseColorTexture,pbr?.metallicRoughnessTexture,material.normalTexture];
 if(pbr?.metallicFactor!==0||refs.some(ref=>!ref||!Number.isInteger(ref.index)||!Number.isInteger(json.textures?.[ref.index]?.source)||!json.images[json.textures[ref.index].source]))throw new Error('Missing required ruined depot PBR map');
 if(new Set(refs.map(ref=>json.textures[ref.index].source)).size!==3)throw new Error('Ruined depot requires distinct colour, roughness and normal maps');
 const nodes=json.nodes?.filter(node=>node.mesh!==undefined)||[];
 if(nodes.length!==3||new Set(nodes.map(node=>node.name)).size!==3||nodes.some(node=>!MODULES[node.name]))throw new Error('Missing or unexpected ruined depot module');
 for(const node of nodes){
  const primitives=json.meshes?.[node.mesh]?.primitives;
  if(!primitives?.length)throw new Error('Missing module geometry');
  let triangles=0;
  for(const p of primitives){
   if((p.mode??4)!==4||p.material!==0||p.attributes?.POSITION===undefined||p.attributes.NORMAL===undefined||p.attributes.TEXCOORD_0===undefined||!json.accessors?.[p.indices])throw new Error('Invalid module triangles or map coordinates');
   if(refs.some(ref=>!Number.isInteger(ref.texCoord??0)||(ref.texCoord??0)<0||p.attributes[`TEXCOORD_${ref.texCoord??0}`]===undefined))throw new Error('Missing bound texture map coordinates');
   triangles+=json.accessors[p.indices].count/3;
  }
  if(triangles!==MODULES[node.name].triangles)throw new Error('Unexpected source module triangle count');
 }
 return json;
}

/** Application-lifetime owner. Clones borrow geometry/materials/maps: never dispose
 * resources from an instance. A failed validation releases only this load's data.
 * Browser GLTFLoader performs real image decoding; no fallback/test flag exists. */
export async function loadRuinedDepotArt(data,{loader=new GLTFLoader()}={}){
 const bytes=ArrayBuffer.isView(data)?data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength):data;
 if(!(bytes instanceof ArrayBuffer)||bytes.byteLength<28)throw new Error('Invalid ruined depot GLB bytes');
 let owned=new Set();
 try{
  const json=parseClosedGLB(bytes);
  const gltf=await loader.parseAsync(bytes,'');
  owned=resources(gltf?.scene);
  if(!gltf?.scene)throw new Error('Missing parsed module scene');
  gltf.scene.updateMatrixWorld(true);
  const modules=new Map(),geometries=new Set(),materials=new Set();
  for(const [id,contract]of Object.entries(MODULES)){
   const root=gltf.scene.getObjectByName(id);
   if(!root)throw new Error(`Missing module ${id}`);
   let triangles=0;
   root.traverse(node=>{
    if(!node.isMesh)return;
    const g=node.geometry,m=node.material;
    if(!g.index||!g.attributes.position||!g.attributes.normal||!g.attributes.uv||Array.isArray(m))throw new Error('Invalid parsed module geometry');
    triangles+=g.index.count/3;geometries.add(g);materials.add(m);
    if(!m?.map?.isTexture||!m.normalMap?.isTexture||!m.roughnessMap?.isTexture)throw new Error('Missing decoded ruined depot texture map');
    if([m.map,m.normalMap,m.roughnessMap].some(t=>!g.getAttribute(t.channel===0?'uv':`uv${t.channel}`)))throw new Error('Missing decoded texture map coordinates');
    if(m.map.colorSpace!==THREE.SRGBColorSpace||m.normalMap.colorSpace!==THREE.NoColorSpace||m.roughnessMap.colorSpace!==THREE.NoColorSpace)throw new Error('Invalid ruined depot texture color space');
    node.castShadow=node.receiveShadow=true;
   });
   if(triangles!==contract.triangles)throw new Error(`Unexpected module triangles ${id}`);
   const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3());
   const deltas=[size.x-contract.size[0],size.y-contract.size[1],size.z-contract.size[2],box.min.y,(box.min.x+box.max.x)/2,(box.min.z+box.max.z)/2];
   if(deltas.some(v=>!Number.isFinite(v)||Math.abs(v)>2e-5)||root.scale.distanceTo(new THREE.Vector3(1,1,1))>1e-6||root.position.length()>1e-6)throw new Error(`Unexpected metre bounds/origin for module ${id}`);
   modules.set(id,root);
  }
  let disposed=false;
  return {
   clone(moduleId){if(disposed)throw new Error('Ruined depot library disposed');const root=modules.get(moduleId);if(!root)throw new Error(`Unknown ruined depot module ${moduleId}`);return root.clone(true);},
   diagnostics:Object.freeze({triangles:757,moduleIds:Object.freeze([...modules.keys()]),geometries:geometries.size,materials:materials.size,embeddedImages:json.images.length}),
   dispose(){if(disposed)return;disposed=true;for(const resource of owned)resource.dispose();modules.clear();gltf.scene.clear();}
  };
 }catch(error){for(const resource of owned)resource.dispose();throw new Error(`Ruined depot load failed: ${error.message}`,{cause:error});}
}
