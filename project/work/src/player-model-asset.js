import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createPlayerModelView} from './player-model-view.js';
import {createSkinnedPlayerModelView} from './skinned-player-model-view.js';
function release(root){const items=new Set(),skeletons=new Set();root.traverse(o=>{if(o.geometry)items.add(o.geometry);if(o.skeleton)skeletons.add(o.skeleton);for(const m of [].concat(o.material||[])){items.add(m);for(const v of Object.values(m))if(v?.isTexture)items.add(v);}});for(const skeleton of skeletons){if(skeleton.boneTexture)items.add(skeleton.boneTexture);skeleton.boneTexture=null;}for(const item of items)item.dispose();for(const skeleton of skeletons)skeleton.dispose();}
/** Owns a freshly parsed player model, including failure cleanup. No silent texture fallback. */
export async function loadPlayerAsset(scene,vehicle,data,{loader=new GLTFLoader()}={}){
 const bytes=ArrayBuffer.isView(data)?data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength):data;
 if(!(bytes instanceof ArrayBuffer))throw new TypeError('Player asset bytes must be an ArrayBuffer or typed array');
 const gltf=await loader.parseAsync(bytes,'');
 let delegated=false;
 try{
  for(const [index,source]of (gltf.parser?.json?.materials||[]).entries()){
   const material=await gltf.parser.getDependency('material',index);
   for(const [declared,slot]of [[source.pbrMetallicRoughness?.baseColorTexture,'map'],[source.pbrMetallicRoughness?.metallicRoughnessTexture,'roughnessMap'],[source.normalTexture,'normalMap'],[source.occlusionTexture,'aoMap'],[source.emissiveTexture,'emissiveMap']])if(declared&&!material[slot])throw new Error(`Missing embedded texture ${source.name||index}/${slot}`);
  }
  if(vehicle?.modelKey==='quaternius-sandfalcon'){delegated=true;return createSkinnedPlayerModelView(scene,gltf,{vehicle,ownsResources:true});}
  return createPlayerModelView(scene,gltf.scene,{vehicle,ownsResources:true,disposeResources:release});
 }catch(error){if(!delegated)release(gltf.scene);throw error;}
}
