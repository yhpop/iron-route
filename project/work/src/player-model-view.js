import * as THREE from 'three';
import {ARMOR_RIGS} from '../assets/armor/rigs.js';
const finite=n=>Number.isFinite(n)?n:0;
/** Adapts already parsed/cloned game-scale assets. No loading or simulation side effects.
 * Caller retains shared resources unless ownsResources is explicitly true.
 * updateRunningGear(root, {travel,turnTravel,trackL,trackR},dt) is optional for PzIII.
 */
export function createPlayerModelView(scene,source,{vehicle,ownsResources=false,disposeResources,updateRunningGear}={}){
 const root=source?.name==='PanzerIII'||source?.name==='TankRoot'?source:source?.getObjectByName('PanzerIII')||source?.getObjectByName('TankRoot');
 if(!root)throw new Error('Unsupported player asset: expected PanzerIII or TankRoot');
 const pz3=root.name==='PanzerIII',names=pz3?['TurretYaw','GunPitch','Recoil','Muzzle']:['TurretPivot','GunElevationPivot','RecoilPivot','Muzzle'];
 const nodes=names.map(name=>{const n=root.getObjectByName(name);if(!n)throw new Error('Missing player joint '+name);return n;});
 const joints={turret:nodes[0],elevation:nodes[1],recoil:nodes[2],muzzle:nodes[3]},metadata=ARMOR_RIGS[vehicle?.modelKey||vehicle?.id];
 if(!pz3&&!metadata)throw new Error('Newc model requires matching vehicle modelKey/id');
 const wheels=pz3?[]:metadata.wheelNodes.map(name=>{const node=root.getObjectByName(name),radius=metadata.wheelRadii[name];if(!node||!(radius>0))throw new Error('Missing measured wheel '+name);return {node,radius,base:node.quaternion.clone(),left:node.position.x<0};});
 const turretBase=joints.turret.quaternion.clone(),elevationBase=joints.elevation.quaternion.clone(),recoilBase=joints.recoil.position.clone(),axisX=new THREE.Vector3(1,0,0),axisY=new THREE.Vector3(0,1,0),rotation=new THREE.Quaternion(),basisMatrix=new THREE.Matrix4(),basisRight=new THREE.Vector3(),up=new THREE.Vector3(),forward=new THREE.Vector3();
 let disposed=false,previousL,previousR;
 root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 scene.add(root);
 function update(tank={},dt=0){
  if(disposed)return;
  const pose=tank.pose||{},turret=tank.turret||{};
  root.position.set(finite(pose.x),finite(pose.y),finite(pose.z));root.quaternion.setFromAxisAngle(axisY,finite(pose.yaw));
  if(pose.basis){const b=pose.basis;basisMatrix.makeBasis(basisRight.fromArray(b.right),up.fromArray(b.up),forward.fromArray(b.forward));root.quaternion.multiply(rotation.setFromRotationMatrix(basisMatrix));}
  joints.turret.quaternion.copy(turretBase).multiply(rotation.setFromAxisAngle(axisY,finite(turret.yawRel)));
  joints.elevation.quaternion.copy(elevationBase).multiply(rotation.setFromAxisAngle(axisX,finite(turret.elevation)));
  joints.recoil.position.copy(recoilBase);joints.recoil.position.z+=Math.max(0,finite(turret.recoil));
  const left=finite(tank.trackL),right=finite(tank.trackR);
  if(left!==previousL||right!==previousR){
   if(pz3)updateRunningGear?.(root,{travel:(left+right)/2,turnTravel:(right-left)/1.6,trackL:left,trackR:right},dt);
   else for(const w of wheels)w.node.quaternion.copy(w.base).multiply(rotation.setFromAxisAngle(axisX,-(w.left?left:right)/w.radius));
   previousL=left;previousR=right;
  }
  root.updateWorldMatrix(true,true);
 }
 update();
 return {root,joints,update,diagnostics:Object.freeze({modelKey:vehicle?.modelKey||vehicle?.id||(pz3?'pz3':null),wheelCount:wheels.length,trackAnimation:pz3&&typeof updateRunningGear==='function',ownsResources}),
  muzzleWorld(target=new THREE.Vector3()){root.updateWorldMatrix(true,true);return joints.muzzle.getWorldPosition(target);},
  dispose(){if(disposed)return;disposed=true;root.removeFromParent();root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});if(!ownsResources)return;if(disposeResources){disposeResources(root);return;}
   const geometries=new Set(),materials=new Set(),textures=new Set();root.traverse(o=>{if(!o.isMesh)return;geometries.add(o.geometry);for(const m of [].concat(o.material||[])){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});for(const t of textures)t.dispose();for(const m of materials)m.dispose();for(const g of geometries)g.dispose();
  }
 };
}
