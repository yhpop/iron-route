import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const slots=['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap'];
function resources(root){const geometries=new Set(),materials=new Set(),textures=new Set();root?.traverse(n=>{if(n.geometry)geometries.add(n.geometry);for(const m of [].concat(n.material||[])){materials.add(m);for(const s of slots)if(m[s])textures.add(m[s]);}});return [...geometries,...materials,...textures];}
/** Shared scan resources belong exclusively to this application-lifetime library.
 * Every load validates source geometry and all declared PBR maps. */
export async function loadScannedCoverArt(data,{loader=new GLTFLoader()}={}){
 const bytes=ArrayBuffer.isView(data)?data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength):data;
 if(!(bytes instanceof ArrayBuffer)||bytes.byteLength<20)throw new Error('Invalid scanned cover GLB bytes');
 let gltf,owned=[];
 try{
  const header=new DataView(bytes);if(header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2||header.getUint32(8,true)!==bytes.byteLength)throw new Error('Invalid scanned cover GLB header');
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,header.getUint32(12,true))));
  if(json.images?.length!==3||json.images.some(i=>i.mimeType!=='image/jpeg'||!Number.isInteger(i.bufferView))||json.buffers?.some(b=>b.uri))throw new Error('Scanned cover requires three embedded JPEG textures');
  gltf=await loader.parseAsync(bytes,'');owned=resources(gltf.scene);
  const meshes=[];gltf.scene.traverse(n=>{if(n.isMesh)meshes.push(n);});
  if(meshes.length!==1||meshes[0].geometry.index?.count!==71466||!meshes[0].geometry.attributes.position||!meshes[0].geometry.attributes.normal||!meshes[0].geometry.attributes.uv)throw new Error('Invalid scanned cover geometry');
  {const m=meshes[0].material;if(!m.map||!m.normalMap||!m.roughnessMap||!m.metalnessMap)throw new Error('Missing scanned cover texture');if(m.map.colorSpace!==THREE.SRGBColorSpace||m.normalMap.colorSpace!==THREE.NoColorSpace||m.roughnessMap.colorSpace!==THREE.NoColorSpace)throw new Error('Invalid scanned cover texture color space');}
  gltf.scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3());
  if([size.x-1.56540936,size.y-1.11195294,size.z-.44214198].some(n=>Math.abs(n)>1e-6))throw new Error('Unexpected scanned cover bounds');
  const root=new THREE.Group();root.name='scanned-cover-model';gltf.scene.position.sub(new THREE.Vector3((bounds.min.x+bounds.max.x)/2,bounds.min.y,(bounds.min.z+bounds.max.z)/2));root.add(gltf.scene);
  meshes[0].castShadow=meshes[0].receiveShadow=true;
  let disposed=false;return {clone(){if(disposed)throw new Error('Scanned cover library disposed');return root.clone(true);},diagnostics:Object.freeze({triangles:23822,geometries:1,materials:1,embeddedImages:3}),dispose(){if(disposed)return;disposed=true;for(const r of owned)r.dispose();root.clear();}};
 }catch(error){for(const r of owned)r.dispose();throw new Error(`Scanned cover load failed: ${error.message}`,{cause:error});}
}
