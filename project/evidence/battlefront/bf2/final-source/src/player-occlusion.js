import * as THREE from 'three';
/** View-only cutaway. Uses Three raycasting; never changes collision or shared art materials. */
export function createPlayerOcclusion(scene){
 const ray=new THREE.Raycaster(),faded=new Map(),bounds=new WeakMap();let disposed=false;
 const restore=group=>{const records=faded.get(group)||[];for(const {mesh,original,clones} of records){mesh.material=original;for(const m of clones)m.dispose();}faded.delete(group);};
 function update(camera,pose){
  if(disposed)return;
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const groups=[];scene.traverse(o=>{if(o.name.startsWith('solid:')&&o.visible&&o.userData.staticOcclusion!==false)groups.push(o);});
  const selected=new Set();const origin=camera.getWorldPosition(new THREE.Vector3());
  for(const offset of [[0,1,0],[-.7,.65,0],[.7,.65,0],[0,.65,-1],[0,.65,1]]){
   const point=new THREE.Vector3(pose.x+offset[0],(pose.y||0)+offset[1],pose.z+offset[2]);const direction=point.sub(origin);const distance=direction.length();if(distance<.01)continue;
   ray.set(origin,direction.normalize());ray.near=.01;ray.far=Math.max(.01,distance-.05);
   for(const group of groups){let box=bounds.get(group);if(!box){box=new THREE.Box3().setFromObject(group);bounds.set(group,box);}if(!ray.ray.intersectsBox(box))continue;if(ray.intersectObject(group,true).some(hit=>{for(let p=hit.object;p;p=p.parent)if(!p.visible)return false;return true;}))selected.add(group);}
  }
  for(const group of [...faded.keys()])if(!selected.has(group))restore(group);
  for(const group of selected)if(!faded.has(group)){
   const records=[];group.traverse(mesh=>{if(!mesh.isMesh)return;const original=mesh.material;const clones=(Array.isArray(original)?original:[original]).map(m=>{const clone=m.clone();clone.transparent=true;clone.opacity=Math.min(m.opacity,.22);clone.depthWrite=false;return clone;});mesh.material=Array.isArray(original)?clones:clones[0];records.push({mesh,original,clones});});faded.set(group,records);
  }
  return selected.size;
 }
 return {update,dispose(){if(disposed)return;for(const group of [...faded.keys()])restore(group);disposed=true;}};
}
