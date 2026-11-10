import * as THREE from 'three';
import {sampleTrackTransform} from './tank-view.js';
/** CC0 community geometry is shared; cloned joints are independent. */
export function createInterceptorLibrary(gltf,{surfaceMaterial,uvRegion}={}){
 const source=gltf.scene.getObjectByName('PanzerIII');if(!source)throw new Error('Missing PanzerIII community asset');const root=source.clone(true);
 for(const name of ['TurretYaw','GunPitch','Recoil','Muzzle'])if(!root.getObjectByName(name))throw new Error('Missing PanzerIII joint '+name);
 const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;geometries.add(o.geometry);for(const m of [].concat(o.material))materials.add(m);}});
 if(surfaceMaterial){
  const paint=surfaceMaterial.clone();paint.name=uvRegion?'Pz3 Reused Owner Camouflage':'Pz3 Reused SagePaint';paint.vertexColors=true;paint.color.multiplyScalar(uvRegion ? .95 : .83);paint.metalness=.2;paint.roughness=.9;materials.add(paint);
  root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert();
  root.traverse(o=>{if(!o.isMesh||!o.material?.name?.includes('Weathered'))return;
   const g=o.geometry.clone(),a=g.attributes.position,n=g.attributes.normal,uv=[],colors=[],m=inverse.clone().multiply(o.matrixWorld),p=new THREE.Vector3(),normal=new THREE.Vector3();
   for(let i=0;i<a.count;i++){
    p.fromBufferAttribute(a,i).applyMatrix4(m);normal.fromBufferAttribute(n,i).transformDirection(m);
    const ax=Math.abs(normal.x),ay=Math.abs(normal.y),az=Math.abs(normal.z);
    const u=ax>ay&&ax>az?p.z:p.x,v=ay>ax&&ay>az?p.z:p.y;
    if(uvRegion){const unit=n=>Math.max(0,Math.min(1,n));uv.push(uvRegion.u0+(uvRegion.u1-uvRegion.u0)*unit((u+2.2)/4.4),uvRegion.v0+(uvRegion.v1-uvRegion.v0)*unit(ay>ax&&ay>az?(v+2.2)/4.4:v/1.7));}
    else uv.push(u/1.2,v/1.2);
    const dirt=Math.max(0,Math.min(1,(.7-p.y)/.7))*.48,coat=.96+.04*Math.sin(p.x*3+p.z*2)*Math.sin(p.y*5);
    colors.push(coat*(1-.25*dirt),coat*(1-.34*dirt),coat*(1-.5*dirt));
   }
   g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometries.add(g);o.geometry=g;o.material=paint;
  });
 }
 const treadGeometry=new THREE.BoxGeometry(.27,.027,.065),treadMaterial=new THREE.MeshStandardMaterial({color:0x4f5148,metalness:.6,roughness:.74});geometries.add(treadGeometry);materials.add(treadMaterial);
 const treads=new THREE.InstancedMesh(treadGeometry,treadMaterial,112);treads.name='Pz3Treads';treads.castShadow=treads.receiveShadow=true;treads.frustumCulled=false;root.add(treads);
 let disposed=false;return {clone(){if(disposed)throw new Error('PanzerIII library disposed');return root.clone(true);},dispose(){if(disposed)return;disposed=true;for(const x of geometries)x.dispose();for(const x of materials)x.dispose();}};
}

const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),matrix=new THREE.Matrix4(),one=new THREE.Vector3(1,1,1),axis=new THREE.Vector3(1,0,0);
/** Reuses the preserved source tank's belt path; scales it to the community hull's measured belt bounds. */
export function updateInterceptorRunningGear(root,entity){
 const travel=Number.isFinite(entity.travel)?entity.travel:0,turn=Number.isFinite(entity.turnTravel)?entity.turnTravel:0;
 for(const node of root.children)if(node.name.startsWith('Wheel_')){const side=node.position.x<0?-1:1;const radius=[8,9,10,11].includes(Number(node.name.slice(6)))?.236:.168;node.rotation.x=-(travel+side*turn*.8)/radius;}
 const treads=root.getObjectByName('Pz3Treads');if(!treads)return;
 for(const [side,sign,offset]of [['L',-1,0],['R',1,56]])for(let i=0;i<56;i++){
  const raw=sampleTrackTransform(side,i,(travel+sign*turn*.8)/.554*.455);
  position.set(sign<0?-.827:.783,(raw.y-.0925)*(.8/1.21),raw.z*.554+.116);
  rotation.setFromAxisAngle(axis,Math.atan2(Math.sin(raw.angle)*(.8/1.21),Math.cos(raw.angle)*.554));
  matrix.compose(position,rotation,one);treads.setMatrixAt(offset+i,matrix);
 }
 treads.instanceMatrix.needsUpdate=true;
}

/** Material-only wreck transition: preserves the measured geometry and frozen joints. */
export function updateInterceptorWreck(root,entity,owned){
 if(entity.alive!==false||root.userData.wreckApplied)return;
 root.userData.wreckApplied=true;const copies=new Map();
 root.traverse(o=>{if(!o.isMesh)return;const scorch=m=>{if(!copies.has(m)){const burnt=m.clone();burnt.color.multiplyScalar(.22);burnt.roughness=1;burnt.metalness=.08;burnt.emissive?.setHex(0);copies.set(m,burnt);owned.push(burnt);}return copies.get(m);};o.material=Array.isArray(o.material)?o.material.map(scorch):scorch(o.material);});
}
