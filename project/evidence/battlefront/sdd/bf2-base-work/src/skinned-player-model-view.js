import * as THREE from 'three';

const finite=value=>Number.isFinite(value)?value:0;
const POSITION_BONES=[22,11,10,12,9,8,14,13,15,16,6,17,5,4,2,3,19,20,1,21];
const ROTATION_BONES=[8,6,7,18,17,19];
const CLIP_NAMES=['Backwards','Forward','TurningLeft','TurningRight'];
const fail=reason=>{throw new Error('Invalid skinned player: '+reason);};

// One freshly parsed GLTF owns its resource graph. Do not clone a SkinnedMesh
// with Object3D.clone(): that would retain the original Skeleton's bone links.
function ownedResourceDisposer(gltf){
 const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set(),instances=new Set();
 for(const source of new Set([gltf?.scene,...(gltf?.scenes||[])].filter(Boolean)))source.traverse(o=>{
  if(o.geometry)geometries.add(o.geometry);
  if(o.skeleton)skeletons.add(o.skeleton);
  if(o.isInstancedMesh)instances.add(o);
  for(const material of [].concat(o.material||[])){
   materials.add(material);
   for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
  }
 });
 let disposed=false;
 return ()=>{
  if(disposed)return;disposed=true;
  // Bone textures may be lazily allocated by WebGLRenderer AFTER construction.
  // Read them now, not when the view was created. Deduplicate unusual aliases.
  const boneTextures=new Set();
  for(const skeleton of skeletons){
   const texture=skeleton.boneTexture;
   if(texture&&boneTextures.has(texture))skeleton.boneTexture=null;
   else if(texture)boneTextures.add(texture);
   skeleton.dispose();
  }
  for(const texture of textures)if(!boneTextures.has(texture))texture.dispose();
  for(const instance of instances)instance.dispose();
  for(const material of materials)material.dispose();
  for(const geometry of geometries)geometry.dispose();
 };
}

/** Adopt a fresh normalized Quaternius GLTF without cloning or touching game state.
 * Signed cumulative accepted trackL/trackR are in game units, never elapsed time.
 * Borrowed mode mutates the supplied node transforms but never frees resources.
 */
export function createSkinnedPlayerModelView(scene,gltf,{vehicle,ownsResources=true}={}){
 const release=ownedResourceDisposer(gltf);
 let root,joints,bindings,phaseDistance,clipDuration;
 try{
  root=gltf?.scene?.getObjectByName('TankRoot');
  if(!root||!scene?.add)fail('expected normalized TankRoot and destination scene');
  const names=['TurretPivot','GunElevationPivot','RecoilPivot','Muzzle'];
  const nodes=names.map(name=>root.getObjectByName(name));
  if(nodes.some(n=>!n))fail('missing controlled joint');
  joints={turret:nodes[0],elevation:nodes[1],recoil:nodes[2],muzzle:nodes[3]};
  const chain=[root,...nodes];
  chain.forEach((node,i)=>{
   if(!node.scale.equals(new THREE.Vector3(1,1,1)))fail('controlled joints require unit scale');
   if(i&&node.parent!==chain[i-1])fail('invalid yaw/elevation/recoil/muzzle chain');
   const q=node.quaternion;
   if(!q.toArray().every(Number.isFinite)||Math.abs(q.lengthSq()-1)>1e-10||Math.abs(q.x)>1e-10||Math.abs(q.y)>1e-10||Math.abs(q.z)>1e-10||Math.abs(Math.abs(q.w)-1)>1e-10)fail('controlled joints require finite unit identity rest quaternion');
   if(!node.position.toArray().every(Number.isFinite))fail('non-finite joint position');
  });
  for(const suffix of CLIP_NAMES)if(!gltf.animations?.some(c=>c.name==='TankArmature|Tank_'+suffix))fail('missing '+suffix+' source clip');
  const clip=gltf.animations.find(c=>c.name==='TankArmature|Tank_Forward');
  clipDuration=clip.duration;
  if(!(Number.isFinite(clipDuration)&&clipDuration>0))fail('invalid Forward clip duration');
  const tracks=new Map();
  for(const track of clip.tracks){if(tracks.has(track.name))fail('duplicate source binding');tracks.set(track.name,track);}
  bindings={L:[],R:[]};
  for(const side of ['L','R'])for(const [property,bones,size]of [['position',POSITION_BONES,3],['quaternion',ROTATION_BONES,4]])for(const index of bones){
   const name='TankTrack'+index+side,node=root.getObjectByName(name),track=tracks.get(name+'.'+property);
   if(!node?.isBone||!track||track.getValueSize()!==size||track.times.length<2||track.times[0]!==0||!track.times.every((time,i)=>Number.isFinite(time)&&(!i||time>track.times[i-1]))||Math.abs(track.times.at(-1)-clipDuration)>1e-7||!track.values.every(Number.isFinite))fail('missing or invalid Forward binding '+name+'.'+property);
   bindings[side].push({node,property,interpolant:track.createInterpolant()});
  }
  if(tracks.size!==bindings.L.length+bindings.R.length)fail('unexpected Forward binding');
  root.updateWorldMatrix(true,true);
  // The source clip advances ONE tread pitch, not the entire belt circuit.
  // TankTrack1 is on the straight upper run. Its endpoint shift in normalized
  // game space is 0.3051770070546753 units. Both sides share this source pitch.
  const pitches=['L','R'].map(side=>{
   const bone=root.getObjectByName('TankTrack1'+side),sample=tracks.get(bone.name+'.position').createInterpolant();
   const start=new THREE.Vector3().fromArray(sample.evaluate(0)).applyMatrix4(bone.parent.matrixWorld);
   const end=new THREE.Vector3().fromArray(sample.evaluate(clipDuration)).applyMatrix4(bone.parent.matrixWorld);
   return start.distanceTo(end);
  });
  phaseDistance=pitches[0];
  if(!(phaseDistance>0)||Math.abs(pitches[0]-pitches[1])>1e-6)fail('inconsistent measured tread pitch');
 }catch(error){if(ownsResources)release();throw error;}
 const turretBase=joints.turret.quaternion.clone(),elevationBase=joints.elevation.quaternion.clone(),recoilBase=joints.recoil.position.clone();
 const axisX=new THREE.Vector3(1,0,0),axisY=new THREE.Vector3(0,1,0),rotation=new THREE.Quaternion(),basisMatrix=new THREE.Matrix4(),right=new THREE.Vector3(),up=new THREE.Vector3(),forward=new THREE.Vector3();
 let disposed=false,previousL,previousR;
 root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 function evaluateSide(side,distance){
  const phase=((distance%phaseDistance)+phaseDistance)%phaseDistance;
  const time=phase/phaseDistance*clipDuration;
  // Original frozen clip arrays/interpolation are retained unmodified. Evaluating
  // only one side's disjoint bone properties cannot advance the other side.
  for(const binding of bindings[side])binding.node[binding.property].fromArray(binding.interpolant.evaluate(time));
 }
 function update(tank={},dt=0){ // dt intentionally irrelevant: no ambient mixer.
  if(disposed)return;
  const pose=tank.pose||{},turret=tank.turret||{};
  root.position.set(finite(pose.x),finite(pose.y),finite(pose.z));
  root.quaternion.setFromAxisAngle(axisY,finite(pose.yaw));
  if(pose.basis){const b=pose.basis;basisMatrix.makeBasis(right.fromArray(b.right),up.fromArray(b.up),forward.fromArray(b.forward));root.quaternion.multiply(rotation.setFromRotationMatrix(basisMatrix));}
  joints.turret.quaternion.copy(turretBase).multiply(rotation.setFromAxisAngle(axisY,finite(turret.yawRel)));
  joints.elevation.quaternion.copy(elevationBase).multiply(rotation.setFromAxisAngle(axisX,finite(turret.elevation)));
  joints.recoil.position.copy(recoilBase);joints.recoil.position.z+=Math.max(0,finite(turret.recoil));
  const left=finite(tank.trackL),r=finite(tank.trackR);
  if(left!==previousL){evaluateSide('L',left);previousL=left;}
  if(r!==previousR){evaluateSide('R',r);previousR=r;}
  root.updateWorldMatrix(true,true);
 }
 scene.add(root);update();
 return {root,joints,update,
  diagnostics:Object.freeze({modelKey:vehicle?.modelKey||vehicle?.id||'sandfalcon',ownsResources,trackAnimation:true,wheelRotation:false,wheelCount:0,trackPhaseDistance:phaseDistance,clipDuration,sourceClips:4,bindingsPerSide:bindings.L.length,evaluator:'source-forward-interpolants',ambientAnimation:false}),
  muzzleWorld(target=new THREE.Vector3()){root.updateWorldMatrix(true,true);return joints.muzzle.getWorldPosition(target);},
  dispose(){if(disposed)return;disposed=true;root.removeFromParent();bindings.L.length=bindings.R.length=0;if(ownsResources)release();}
 };
}
