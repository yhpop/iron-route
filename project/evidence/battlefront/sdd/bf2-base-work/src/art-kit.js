import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export const ART_ROOTS=Object.freeze({'warehouse-sawtooth':'WarehouseSawtooth','pump-station':'PumpStation','service-workshop':'ServiceWorkshop','cargo-truck':'CargoTruck','sentry-turret':'SentryTurret'});
const slots=['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap'];
function resources(records){const geometries=new Set(),materials=new Set(),textures=new Set();for(const value of Object.values(records))value?.scene?.traverse(n=>{if(n.geometry)geometries.add(n.geometry);for(const m of [].concat(n.material||[])){materials.add(m);for(const key of slots)if(m[key])textures.add(m[key]);}});return {geometries,materials,textures};}
function release(owned){for(const g of owned.geometries)g.dispose();for(const m of owned.materials)m.dispose();for(const t of owned.textures)t.dispose();}
/** One parsed library per application lifetime. Mission instances borrow shared GPU
 * resources and must never dispose them; only the library owns that teardown. */
export function createCampaignArtLibrary(records){
 const roots=new Map();
 for(const [key,name]of Object.entries(ART_ROOTS)){const root=records[key]?.scene?.getObjectByName(name);if(!root)throw new Error(`Missing campaign art root ${name} (${key})`);roots.set(key,root);}
 for(const [key,names]of [['sentry-turret',['TurretYaw','GunPitch','Recoil','Muzzle','Shield']],['cargo-truck',['WheelLFront','WheelLRear','WheelRFront','WheelRRear']]])for(const name of names)if(!roots.get(key).getObjectByName(name))throw new Error(`Missing campaign art rig node ${key}/${name}`);
 const owned=resources(records),sharedMaterials=new Map();let disposed=false;
 // Controlled authored materials use stable names and source image names. Include
 // every PBR value/texture transform so unlike surfaces are never merged by name alone.
 for(const root of roots.values())root.traverse(n=>{if(!n.isMesh)return;n.castShadow=n.receiveShadow=true;const share=m=>{const signature=JSON.stringify([m.name,m.type,m.color?.getHex(),m.emissive?.getHex(),m.roughness,m.metalness,m.opacity,m.transparent,m.side,...slots.map(k=>{const t=m[k];return t?[t.name,t.colorSpace,t.wrapS,t.wrapT,t.channel,t.repeat.toArray(),t.offset.toArray(),t.rotation]:null;})]);if(!sharedMaterials.has(signature))sharedMaterials.set(signature,m);return sharedMaterials.get(signature);};n.material=Array.isArray(n.material)?n.material.map(share):share(n.material);});
 return {clone(key){if(disposed)throw new Error('Campaign art library is disposed');if(!roots.has(key))throw new Error(`Unknown campaign art asset: ${key}`);return roots.get(key).clone(true);},get diagnostics(){return {assets:roots.size,sharedMaterials:sharedMaterials.size,parsedMaterials:owned.materials.size,geometries:owned.geometries.size};},dispose(){if(disposed)return;disposed=true;release(owned);roots.clear();}};
}
/** Embedded shipping bytes only: no URL fallback, CDN, decoder, or silent box art. */
export async function loadCampaignArt(data,{loader=new GLTFLoader()}={}){
 const results=await Promise.allSettled(Object.keys(ART_ROOTS).map(async key=>{const raw=data?.[key];if(!raw)throw new Error(`Missing embedded campaign art bytes: ${key}`);const bytes=ArrayBuffer.isView(raw)?raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength):raw;if(!(bytes instanceof ArrayBuffer))throw new Error(`Invalid campaign art bytes: ${key}`);let gltf;try{gltf=await loader.parseAsync(bytes,'');
 // GLTFLoader can resolve a material after an image decode error with map=null.
 // Treat that as a real boot failure, not a successful flat-color fallback.
 for(const [index,source]of (gltf.parser?.json?.materials||[]).entries()){const material=await gltf.parser.getDependency('material',index);for(const [declared,slot]of [[source.pbrMetallicRoughness?.baseColorTexture,'map'],[source.pbrMetallicRoughness?.metallicRoughnessTexture,'roughnessMap'],[source.normalTexture,'normalMap'],[source.occlusionTexture,'aoMap'],[source.emissiveTexture,'emissiveMap']])if(declared&&!material[slot]){throw new Error(`Missing embedded texture ${source.name||index}/${slot}`);}}
 return [key,gltf];}catch(error){if(gltf)release(resources({[key]:gltf}));throw new Error(`Campaign art failed to load: ${key}: ${error.message}`,{cause:error});}}));
 const records=Object.fromEntries(results.filter(r=>r.status==='fulfilled').map(r=>r.value)),failed=results.find(r=>r.status==='rejected');
 if(failed){release(resources(records));throw failed.reason;}try{return createCampaignArtLibrary(records);}catch(error){release(resources(records));throw error;}
}
