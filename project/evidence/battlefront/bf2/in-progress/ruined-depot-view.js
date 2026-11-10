import * as THREE from 'three';
import {RUINED_DEPOT_LAYOUT} from './ruined-depot-layout.js';
/** Borrowed art only; no geometry/material/map disposal here. Dispose existing
 * player-occlusion first, then this adapter, then the original campaign view. */
export function createRuinedDepotView(parent,spec,field,library){
 if(!parent?.add||!library?.clone)throw new Error('Ruined depot view requires parent and loaded library');
 const root=new THREE.Group();root.name='ruined-depot-view';
 // Candidate tint owns clones, shared by the borrowed original identity. Textures
 // and geometry remain library-owned. Prepare transactionally before visibility.
 const owned=new Map();
 function tint(material){
  if(owned.has(material))return owned.get(material);
  const clone=material.clone();owned.set(material,clone);
  clone.color?.multiply(new THREE.Color().setRGB(.61,.58,.53));
  clone.roughness=1;clone.metalness=0;return clone;
 }
 try {
 for(const i of spec.ruinedDepotLayout||RUINED_DEPOT_LAYOUT){const holder=new THREE.Group();holder.name=`solid:${i.id}`;holder.position.set(i.x,i.y,i.z);holder.rotation.y=i.yaw;const art=library.clone(i.moduleId);holder.add(art);root.add(holder);
 if(spec.battlefrontDepot)art.traverse(node=>{if(node.isMesh)node.material=Array.isArray(node.material)?node.material.map(tint):tint(node.material);});}
 }catch(error){for(const material of owned.values())material.dispose();root.clear();throw error;}
 const proxyNames=new Set((spec.geometry||[]).filter(c=>c.ruinInstanceId).map(c=>`solid:${c.id}`)),cosmeticNames=new Set(['warfield-fragments','warfield-wall-scars','warfield-ruins']),borrowed=[];
 parent.traverse(node=>{if(proxyNames.has(node.name)||cosmeticNames.has(node.name))borrowed.push({node,visible:node.visible});});
 // The campaign/authored owner restores each solid's visibility every frame.
 // Main calls this adapter after that owner; reassert only our borrowed roots.
 function suppressBorrowed(){for(const {node}of borrowed)node.visible=false;}
 suppressBorrowed();parent.add(root);let disposed=false;
 return {root,diagnostics:{instances:root.children.length,borrowedResources:true,hiddenProxyRoots:borrowed.filter(r=>proxyNames.has(r.node.name)).length,hiddenCosmeticBuckets:borrowed.filter(r=>cosmeticNames.has(r.node.name)).length,fieldShared:true,ownedMaterialClones:owned.size,tint:spec.battlefrontDepot?'mineral-ash':null},update(){if(!disposed)suppressBorrowed();},dispose(){if(disposed)return;disposed=true;for(const {node,visible}of borrowed)node.visible=visible;root.removeFromParent();root.clear();for(const material of owned.values())material.dispose();owned.clear();}};
}
