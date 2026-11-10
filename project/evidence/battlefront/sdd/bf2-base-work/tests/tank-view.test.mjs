import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const rendererUrl=new URL('../src/tank-view.js',import.meta.url);
const rigUrl=new URL('../assets/tank-rig.js',import.meta.url);
const approx=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
async function module(){assert.ok(fs.existsSync(rendererUrl),'tank renderer is not implemented');return import(rendererUrl);}
async function assetModule(){assert.ok(fs.existsSync(rigUrl),'importable measured rig metadata is not implemented');return import(rigUrl);}
const trackMatrices=(view,side)=>Array.from({length:56},(_,i)=>{const m=new THREE.Matrix4();view.root.getObjectByName('AnimatedTracks_0').getMatrixAt((side==='L'?0:56)+i,m);return m;});
const state=(extras={})=>({pose:{x:0,y:0,z:0,yaw:0},trackL:0,trackR:0,turret:{yawRel:0,elevation:0,recoil:0},...extras});

// Read the actual exported mesh bytes. Node has no image decoder: omit only texture
// references for these CPU geometry/joint tests; the separate asset tests inspect atlas bytes.
async function parsedGeometry(){
 const original=fs.readFileSync(new URL('../assets/tank_v5_articulated.glb',import.meta.url));
 const jsonLength=original.readUInt32LE(12);const json=JSON.parse(original.subarray(20,20+jsonLength).toString());
 for(const m of json.materials){delete m.pbrMetallicRoughness?.baseColorTexture;delete m.pbrMetallicRoughness?.metallicRoughnessTexture;delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;}
 delete json.images;delete json.textures;delete json.samplers;
 const bytes=Buffer.from(JSON.stringify(json));const padded=Buffer.concat([bytes,Buffer.alloc((4-bytes.length%4)%4,32)]);
 const bin=original.subarray(20+jsonLength);const out=Buffer.alloc(20+padded.length+bin.length);
 out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(padded.length,12);out.writeUInt32LE(0x4e4f534a,16);padded.copy(out,20);bin.copy(out,20+padded.length);
 return new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');
}

test('exact original belt path wraps for large positive/negative travel and advances the silhouettes',async()=>{
 const {sampleTrackTransform,beltPath}=await module();const {TANK_ASSET}=await assetModule();
 const a=sampleTrackTransform('L',8,0),b=sampleTrackTransform('L',8,.02);
 approx(a.x,-1.68);approx(a.y,.0925);approx(b.z-a.z,.02/TANK_ASSET.gameScale);assert.notDeepEqual(a,b);
 for(const travel of [0,.1,-.1,8.3,-9.2]){
  const p=sampleTrackTransform('R',33,travel),q=sampleTrackTransform('R',33,travel+TANK_ASSET.trackLoopMeters*4);
  for(const key of ['x','y','z'])approx(p[key],q[key],1e-9);approx(Math.sin(p.angle),Math.sin(q.angle),1e-9);
 }
 const p=beltPath(0),q=beltPath(TANK_ASSET.trackLoopRaw);assert.deepEqual(p,q);
});
test('source link transforms and sampled neutral path agree at all 112 exported pivots',async()=>{
 const {sampleTrackTransform}=await module();const gltf=await parsedGeometry();
 for(const side of ['L','R'])for(let i=0;i<56;i++){
  const n=gltf.scene.getObjectByName(`Track_${side}_${String(i).padStart(2,'0')}`),p=sampleTrackTransform(side,i,0);
  for(const key of ['x','y','z'])approx(n.position[key],p[key],4e-6);
  const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),p.angle);
  approx(Math.abs(q.dot(n.quaternion.clone().normalize())),1,1e-7);
 }
});
test('actual renderer uses instancing, signed accepted totals, independent yaw/elevation and nested recoil',async()=>{
 const {createTankView,sampleTrackTransform}=await module();const sampleNeutralLinkZ=i=>sampleTrackTransform('L',i,0).z;const {TANK_ASSET}=await assetModule();const scene=new THREE.Scene(),gltf=await parsedGeometry();
 const view=createTankView(scene,gltf);assert.equal(view.diagnostics.links,112);assert.equal(view.diagnostics.wheels,12);assert.equal(view.diagnostics.guides,4);assert.equal(view.diagnostics.trackBatches,2);assert.equal(view.diagnostics.runningGearBatches,9);
 let triangles=0;view.root.traverse(n=>{if(n.isMesh)triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3*(n.isInstancedMesh?n.count:1);});assert.equal(triangles,49748,'runtime must retain original triangle/part completeness after batching');
 assert.equal(view.root.getObjectByName('Track_L_00'),undefined,'stationary source shoes must be removed');
 assert.equal(view.root.getObjectByName('Wheel_L_0'),undefined,'stationary source wheel sets must be removed');
 view.update(state(),1/60);const neutral=view.muzzleWorld(new THREE.Vector3()).clone();
 const rig=view.joints;const mantlet=new THREE.Vector3();rig.elevation.getWorldPosition(mantlet);
 const gun=state({pose:{x:5,y:0,z:8,yaw:.6},turret:{yawRel:-.6,elevation:.3,recoil:.08},trackL:.12,trackR:-.12});
 view.update(gun,1/60);approx(view.root.rotation.y,.6);approx(rig.turret.rotation.y,-.6);approx(rig.elevation.rotation.x,.3);approx(rig.recoil.position.z,.08/TANK_ASSET.gameScale);
 const t1=trackMatrices(view,'L')[8],r1=trackMatrices(view,'R')[8];
 const neutralZ=sampleNeutralLinkZ(8);assert.ok(t1.elements[14]>neutralZ && r1.elements[14]<neutralZ,'pivot accepted totals must move the two bottom spans in opposite directions');
 const wheelL=new THREE.Matrix4(),wheelR=new THREE.Matrix4();
 view.root.getObjectByName('AnimatedWheels_L_0').getMatrixAt(0,wheelL);view.root.getObjectByName('AnimatedWheels_R_0').getMatrixAt(0,wheelR);
 assert.ok(wheelL.elements[6]<0 && wheelR.elements[6]>0,'complete wheel sets/bolts must counter-rotate from accepted travel');
 const before=trackMatrices(view,'L').map(m=>m.elements.slice());
 for(let i=0;i<20;i++)view.update(gun,i*.1);
 assert.deepEqual(trackMatrices(view,'L').map(m=>m.elements.slice()),before,'dt/time/throttle must never drift tracks');
 const hingeBefore=rig.elevation.getWorldPosition(new THREE.Vector3());const rear=view.muzzleWorld(new THREE.Vector3());
 view.update({...gun,turret:{...gun.turret,recoil:0}},1/60);const forward=view.muzzleWorld(new THREE.Vector3());
 approx(rear.distanceTo(forward),.08);assert.ok(rig.elevation.getWorldPosition(new THREE.Vector3()).distanceTo(hingeBefore)<1e-10,'recoil must not move mantlet');
 assert.ok(neutral.z< -2.9);approx(neutral.y,2.092726707458496*.455);
 view.dispose();view.dispose();assert.equal(scene.children.length,0,'dispose is idempotent and removes its owned hierarchy');
});
test('half-pitch/full-pitch motion, reverse and zero travel are deterministic with no render-frame dependency',async()=>{
 const {sampleTrackTransform}=await module();const {TANK_ASSET}=await assetModule();const pitch=TANK_ASSET.trackLoopMeters/56;
 for(let i=0;i<56;i++){
  const a=sampleTrackTransform('L',i,pitch),b=sampleTrackTransform('L',(i+55)%56,0);
  for(const key of ['x','y','z'])approx(a[key],b[key],1e-10);
 }
 const half=sampleTrackTransform('L',8,pitch/2),zero=sampleTrackTransform('L',8,0),reverse=sampleTrackTransform('L',8,-pitch/2);
 assert.ok(half.z>zero.z&&reverse.z<zero.z);approx(half.z-zero.z,zero.z-reverse.z,1e-10);
});

test('rendered muzzle matches collision/fire transform across hull yaw, turret yaw, elevation and recoil',async()=>{
 const {createTankView}=await module();const {getTankTransform,DEFAULT_CONFIG}=await import('../src/tank-controller.js');
 const {TANK_ASSET}=await assetModule();
 assert.deepEqual(DEFAULT_CONFIG.rig.turretPivot,TANK_ASSET.turretPivot);
 assert.deepEqual(DEFAULT_CONFIG.rig.barrelPivot,TANK_ASSET.barrelPivot);
 assert.deepEqual(DEFAULT_CONFIG.rig.muzzleLocal,TANK_ASSET.muzzleLocal);
 const view=createTankView(new THREE.Scene(),await parsedGeometry());
 for(const yaw of [0,.4,-2.7,Math.PI])for(const yawRel of [-2.1,0,1.9])for(const elevation of [-.12,0,.42])for(const recoil of [0,.08]){
  const tank=state({pose:{x:4,y:.2,z:-3,yaw},turret:{yawRel,elevation,recoil}});
  view.update(tank,1/60);const actual=view.muzzleWorld(new THREE.Vector3()),expected=getTankTransform(tank).position;
  for(const axis of ['x','y','z'])approx(actual[axis],expected[axis],1e-10);
 }
 view.dispose();
});
