import panzerBytes from '../assets/pz3-interceptor.glb';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createInterceptorLibrary} from './interceptor-art.js';
export async function attachInterceptorArt(base,ownerTankRoot){
 let extra;
 try{let surfaceMaterial;ownerTankRoot.traverse(o=>{for(const m of [].concat(o.material||[]))if(m.name==='Tank_V5_Baked_Paint')surfaceMaterial=m;});if(!surfaceMaterial)throw new Error('Missing reusable owner tank camouflage surface');extra=createInterceptorLibrary(await new GLTFLoader().parseAsync(panzerBytes.buffer.slice(panzerBytes.byteOffset,panzerBytes.byteOffset+panzerBytes.byteLength),''),{surfaceMaterial,uvRegion:{u0:.04,u1:.18,v0:.39,v1:.54}});}
 catch(error){extra?.dispose();throw error;}
 return {clone:key=>key==='pz3'?extra.clone():base.clone(key),get diagnostics(){return {...base.diagnostics,communityVehicles:1};},dispose(){extra.dispose();base.dispose();}};
}
