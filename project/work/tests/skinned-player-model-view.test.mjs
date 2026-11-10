import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {getTankTransform,createTank,stepTank,DEFAULT_CONFIG} from '../src/tank-controller.js';
import {QUATERNIUS_SANDFALCON_RIG as META} from '../assets/armor/quaternius-sandfalcon-rig.js';

// The production factory must exist; this dynamic import makes the initial RED an
// explicit missing-feature assertion rather than a test-runner resolution error.
const implementation=await import('../src/skinned-player-model-view.js').catch(e=>{
 if(e.code==='ERR_MODULE_NOT_FOUND' && e.message.includes('skinned-player-model-view.js'))return {};
 throw e;
});
const create=(...args)=>{assert.equal(typeof implementation.createSkinnedPlayerModelView,'function','new skinned view factory must exist');return implementation.createSkinnedPlayerModelView(...args);};
const raw=fs.readFileSync(new URL('../assets/armor/quaternius-sandfalcon.glb',import.meta.url));
async function asset(){return new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');}
function vertices(view,side){const m=view.root.getObjectByName('TrackMesh'+side);view.root.updateWorldMatrix(true,true);return Array.from({length:m.geometry.attributes.position.count},(_,i)=>m.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(m.matrixWorld));}
const arrays=points=>points.map(v=>v.toArray());
const near=(a,b,eps=1e-6)=>assert.ok(a.distanceTo(b)<eps,`${a.toArray()} != ${b.toArray()}`);
const state=(l=0,r=l)=>({...createTank(),trackL:l,trackR:r});
const rig=META.rig;
function resources(g){const sets={geometry:new Set(),material:new Set(),texture:new Set(),skeleton:new Set()};g.scene.traverse(o=>{if(o.geometry)sets.geometry.add(o.geometry);for(const m of [].concat(o.material||[])){sets.material.add(m);for(const v of Object.values(m))if(v?.isTexture)sets.texture.add(v);}if(o.skeleton)sets.skeleton.add(o.skeleton);});return sets;}

test('fresh actual GLB is adopted, source BIN unchanged, controlled joints remain unit scale',async()=>{
 const g=await asset(),root=g.scene.getObjectByName('TankRoot'),snapshot=Buffer.from(raw),view=create(new THREE.Scene(),g,{vehicle:{id:'sandfalcon'}});
 assert.equal(view.root,root);assert.equal(view.diagnostics.modelKey,'sandfalcon');assert.equal(view.diagnostics.wheelRotation,false);assert.equal(view.diagnostics.trackAnimation,true);
 for(const o of [root,...Object.values(view.joints)])assert.deepEqual(o.scale.toArray(),[1,1,1]);
 assert.deepEqual(raw,snapshot);assert.equal(g.animations.length,4);assert.equal(view.joints.turret.parent,root);assert.equal(view.joints.elevation.parent,view.joints.turret);assert.equal(view.joints.recoil.parent,view.joints.elevation);assert.equal(view.joints.muzzle.parent,view.joints.recoil);
 view.root.traverse(o=>{if(o.isMesh){assert.equal(o.castShadow,true);assert.equal(o.receiveShadow,true);}});view.dispose();
});

test('measured phase distance equals authored one-pitch top-run displacement, not full circumference',async()=>{
 const g=await asset(),root=g.scene.getObjectByName('TankRoot'),clip=g.animations.find(c=>c.name.endsWith('_Forward')),t=clip.tracks.find(t=>t.name==='TankTrack1L.position'),interpolant=t.createInterpolant();root.updateWorldMatrix(true,true);
 const a=new THREE.Vector3().fromArray(interpolant.evaluate(0)).applyMatrix4(root.getObjectByName('TankTrack1L').parent.matrixWorld),b=new THREE.Vector3().fromArray(interpolant.evaluate(clip.duration)).applyMatrix4(root.getObjectByName('TankTrack1L').parent.matrixWorld);
 const view=create(new THREE.Scene(),g);assert.ok(Math.abs(view.diagnostics.trackPhaseDistance-a.distanceTo(b))<1e-8);assert.ok(Math.abs(view.diagnostics.trackPhaseDistance-.3051770070546753)<1e-8);assert.equal(view.diagnostics.clipDuration,clip.duration);assert.ok(b.z<a.z);view.dispose();
});

test('real lower skinned tread vertices move backward (+Z) for positive travel; each side independently follows distance',async()=>{
 const view=create(new THREE.Scene(),await asset()),a=vertices(view,'L'),r=arrays(vertices(view,'R')),d=.025;view.update(state(d,0),.001);const b=vertices(view,'L');
 const lower=a.map((p,i)=>p.y<.05&&Math.abs(p.z)<.7?i:-1).filter(i=>i>=0),upper=a.map((p,i)=>p.y>.5&&Math.abs(p.z)<.7?i:-1).filter(i=>i>=0);
 assert.ok(lower.length>100);assert.ok(upper.length>100);
 for(const i of lower){assert.ok(Math.abs((b[i].z-a[i].z)-d)<2e-6);assert.ok(Math.abs(b[i].y-a[i].y)<2e-6);}
 for(const i of upper)assert.ok(Math.abs((b[i].z-a[i].z)+d)<2e-6);
 assert.deepEqual(arrays(vertices(view,'R')),r);
 view.update(state(d,-d),.04);assert.deepEqual(arrays(vertices(view,'L')),arrays(b));assert.notDeepEqual(arrays(vertices(view,'R')),r);view.dispose();
});

test('reverse, pivot, stop, reset and dt independence evaluate signed cumulative travel absolutely',async()=>{
 const view=create(new THREE.Scene(),await asset()),initial=arrays(vertices(view,'L'));
 view.update(state(.02,-.02),.1);const forwardL=arrays(vertices(view,'L')),reverseR=arrays(vertices(view,'R'));
 for(let i=0;i<20;i++)view.update(state(.02,-.02),i%2?0:100);assert.deepEqual(arrays(vertices(view,'L')),forwardL);assert.deepEqual(arrays(vertices(view,'R')),reverseR);
 view.update(state(),0);assert.deepEqual(arrays(vertices(view,'L')),initial);
 view.update(state(-.02,.02),.01);assert.notDeepEqual(arrays(vertices(view,'L')),forwardL);
 view.update(state(.02,-.02),0);assert.deepEqual(arrays(vertices(view,'L')),forwardL);assert.deepEqual(arrays(vertices(view,'R')),reverseR);
 const p=view.diagnostics.trackPhaseDistance;view.update(state(.02+10*p,-.02-10*p),1);const repeated=vertices(view,'L');forwardL.forEach((v,i)=>near(repeated[i],new THREE.Vector3(...v),1e-6));view.dispose();
});

test('real rig slope basis, yaw, pitch, recoil, capsule endpoints and muzzle match production getTankTransform',async()=>{
 const view=create(new THREE.Scene(),await asset()),s=state(.12,-.04),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(.2,0,-.15)),basis=[[1,0,0],[0,1,0],[0,0,1]].map(a=>new THREE.Vector3(...a).applyQuaternion(q).toArray());
 for(const b of [undefined,{right:basis[0],up:basis[1],forward:basis[2]}])for(const yaw of [0,.8,-2.1])for(const elevation of [-.12,0,.3])for(const recoil of [0,.08]){
  s.pose={x:3,y:1.2,z:-4,yaw,basis:b};s.turret={yawRel:.7,elevation,recoil};const before=structuredClone(s);view.update(s,.016);assert.deepEqual(s,before);const expected=getTankTransform(s,rig);
  near(view.muzzleWorld(),new THREE.Vector3(...Object.values(expected.position)),1e-6);
  for(const [key,out]of [['start','barrelStart'],['end','barrelEnd']]){const p=rig.barrelCapsule[key];near(new THREE.Vector3(p.x,p.y,p.z).applyMatrix4(view.joints.recoil.matrixWorld),new THREE.Vector3(expected[out].x,expected[out].y,expected[out].z));}
  const direction=new THREE.Vector3(0,0,-1).transformDirection(view.joints.muzzle.matrixWorld);near(direction,new THREE.Vector3(expected.direction.x,expected.direction.y,expected.direction.z));
 }
 view.dispose();
});

test('production throttle/reverse/pivot/aim/fire/pause inputs drive view without altering simulation',async()=>{
 const view=create(new THREE.Scene(),await asset()),config={...DEFAULT_CONFIG,rig,elevationLimits:[-.12,.3]},run=input=>{for(let i=0;i<40;i++){const result=stepTank(s,input,1/60,undefined,config);s=result.state;const snapshot=structuredClone(s);view.update(s,1/60);assert.deepEqual(s,snapshot);const p=getTankTransform(s,rig).position;near(view.muzzleWorld(),new THREE.Vector3(p.x,p.y,p.z));}};let s=createTank();
 run({throttle:1});assert.ok(s.trackL>0&&s.trackR>0);run({throttle:-1});run({throttle:-1});assert.ok(s.vL<0&&s.vR<0);run({brake:true});run({steer:1,aim:{worldPoint:{x:4,y:1,z:-6}},firePressed:true});assert.ok(s.vL*s.vR<0);assert.equal(s.turret.recoil,.08);assert.notEqual(s.turret.yawRel,0);const a=arrays(vertices(view,'L')),before=structuredClone(s);run({paused:true,throttle:1,steer:-1,firePressed:true});assert.deepEqual(s,before);assert.deepEqual(arrays(vertices(view,'L')),a);s=createTank();view.update(s,0);near(view.root.position,new THREE.Vector3());view.dispose();
});

test('fresh instances isolate skeletons, bone textures, materials and actual skinned motion; owned dispose once',async()=>{
 const scene=new THREE.Scene(),ga=await asset(),gb=await asset(),ra=resources(ga),rb=resources(gb),a=create(scene,ga),b=create(scene,gb),count={geometry:0,material:0,texture:0,skeleton:0};
 for(const kind of ['geometry','material'])for(const x of ra[kind])x.addEventListener('dispose',()=>count[kind]++);
 for(const skeleton of ra.skeleton){skeleton.computeBoneTexture();const tex=skeleton.boneTexture;tex.addEventListener('dispose',()=>count.texture++);const dispose=skeleton.dispose.bind(skeleton);skeleton.dispose=()=>{count.skeleton++;dispose();};assert.ok(!rb.skeleton.has(skeleton));}
 for(const skeleton of rb.skeleton)skeleton.computeBoneTexture();
 const textures=[...rb.skeleton].map(s=>s.boneTexture),geometry=[...rb.geometry];assert.ok([...ra.geometry].every(x=>!rb.geometry.has(x)));assert.ok([...ra.material].every(x=>!rb.material.has(x)));
 b.update(state(.03,-.01),.01);const saved=arrays(vertices(b,'L'));a.update(state(.1,.2),.01);assert.deepEqual(arrays(vertices(b,'L')),saved);a.dispose();a.dispose();assert.equal(a.root.parent,null);assert.equal(scene.children.length,1);assert.deepEqual(count,{geometry:ra.geometry.size,material:ra.material.size,texture:ra.skeleton.size,skeleton:ra.skeleton.size});
 assert.deepEqual([...rb.skeleton].map(s=>s.boneTexture),textures);assert.ok(textures.every(t=>t.image.data.length>0));assert.deepEqual([...rb.geometry],geometry);assert.deepEqual(arrays(vertices(b,'L')),saved);b.update(state(.04,.03),.01);assert.notDeepEqual(arrays(vertices(b,'L')),saved);const frozen=a.root.position.clone();a.update({pose:{x:999}},1);near(a.root.position,frozen);b.dispose();
});

test('borrowed mode leaves all borrowed geometry/material/texture/skeleton resources alive',async()=>{
 const g=await asset(),r=resources(g);let disposed=0;const texture=new THREE.Texture();[...r.material][0].map=texture;texture.addEventListener('dispose',()=>disposed++);
 for(const kind of ['geometry','material'])for(const x of r[kind])x.addEventListener('dispose',()=>disposed++);
 for(const s of r.skeleton){s.computeBoneTexture();s.boneTexture.addEventListener('dispose',()=>disposed++);}
 const view=create(new THREE.Scene(),g,{ownsResources:false});view.update(state(.1,-.1),.016);view.dispose();view.dispose();assert.equal(disposed,0);assert.ok([...r.skeleton].every(s=>s.boneTexture));for(const s of r.skeleton)s.dispose();texture.dispose();
});

test('owned shared texture cleanup deduplicates slots and materials',async()=>{
 const g=await asset(),r=resources(g),t=new THREE.Texture();let freed=0;t.addEventListener('dispose',()=>freed++);for(const m of r.material){m.map=t;m.roughnessMap=t;}const view=create(new THREE.Scene(),g);view.dispose();view.dispose();assert.equal(freed,1);
});

test('missing joints, malformed Forward binding and missing clip fail before attach and clean owned resources',async()=>{
 for(const broken of ['joint','clip','binding','scale']){const g=await asset(),scene=new THREE.Scene(),r=resources(g);let disposed=0;for(const x of r.geometry)x.addEventListener('dispose',()=>disposed++);
 if(broken==='joint')g.scene.getObjectByName('Muzzle').name='NoMuzzle';
 if(broken==='clip')g.animations=g.animations.filter(c=>!c.name.endsWith('_Forward'));
 if(broken==='binding')g.animations.find(c=>c.name.endsWith('_Forward')).tracks[0].name='NoBone.position';
 if(broken==='scale')g.scene.getObjectByName('RecoilPivot').scale.setScalar(2);
 assert.throws(()=>create(scene,g),/skinned player/i);assert.equal(scene.children.length,0);assert.equal(disposed,r.geometry.size,broken);
 }
 const g=await asset(),r=resources(g);let disposed=0;for(const x of r.geometry)x.addEventListener('dispose',()=>disposed++);g.animations=[];assert.throws(()=>create(new THREE.Scene(),g,{ownsResources:false}),/skinned player/i);assert.equal(disposed,0);
});

test('both physical lower runs reverse direction on signed distance decrease and pivot in opposite directions',async()=>{
 const view=create(new THREE.Scene(),await asset());view.update(state(.08,.08));const a={L:vertices(view,'L'),R:vertices(view,'R')};view.update(state(.06,.1));
 for(const side of ['L','R']){const b=vertices(view,side),delta=side==='L'?-.02:.02,indices=a[side].map((p,i)=>p.y<.05&&Math.abs(p.z)<.6?i:-1).filter(i=>i>=0);assert.ok(indices.length>70);for(const i of indices)assert.ok(Math.abs(b[i].z-a[side][i].z-delta)<2e-6);}
 view.dispose();
});

test('actual rigid gun vertices recoil along accepted barrel axis while authored body/wheel geometry stays fixed',async()=>{
 const g=await asset(),clipData=g.animations.map(c=>c.tracks.map(t=>[Array.from(t.times),Array.from(t.values)])),sourceBasis=g.scene.getObjectByName('SourceBasis_PreserveSkin').matrix.clone(),view=create(new THREE.Scene(),g),s=state();s.pose={x:1,y:2,z:3,yaw:.8};s.turret={yawRel:-.4,elevation:.2,recoil:0};view.update(s);
 const gun=view.root.getObjectByName('Tank_Gun'),gunPoint=()=>gun.getVertexPosition(0,new THREE.Vector3()).applyMatrix4(gun.matrixWorld),a=gunPoint(),bodies=[];view.root.traverse(o=>{if(o.isSkinnedMesh&&o.name.startsWith('Tank_body'))bodies.push(o);});
 const bodyPoints=()=>bodies.map(o=>Array.from({length:o.geometry.attributes.position.count},(_,i)=>o.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(o.matrixWorld).toArray())),bodyBefore=bodyPoints();
 s.turret.recoil=.08;s.trackL=.1;s.trackR=-.1;view.update(s,.1);const direction=getTankTransform(s,rig).direction,expected=new THREE.Vector3(direction.x,direction.y,direction.z).multiplyScalar(-.08);near(gunPoint().sub(a),expected);assert.deepEqual(bodyPoints(),bodyBefore);
 assert.ok(g.scene!==view.root);assert.ok(view.root.getObjectByName('SourceBasis_PreserveSkin').matrix.equals(sourceBasis));assert.deepEqual(g.animations.map(c=>c.tracks.map(t=>[Array.from(t.times),Array.from(t.values)])),clipData);view.dispose();
});

test('corrupt animation time input is rejected with complete owned cleanup',async()=>{
 const g=await asset(),r=resources(g);let freed=0;for(const geometry of r.geometry)geometry.addEventListener('dispose',()=>freed++);const track=g.animations.find(c=>c.name.endsWith('_Forward')).tracks[0];track.times=new Float32Array(track.times);track.times[1]=NaN;assert.throws(()=>create(new THREE.Scene(),g),/skinned player/i);assert.equal(freed,r.geometry.size);
});

test('reject malformed controlled quaternions before attach; owned failures free once, borrowed failures free nothing',async()=>{
 const cases=[['TurretPivot',[NaN,0,0,1]],['GunElevationPivot',[1,0,0,1]],['RecoilPivot',[0,0,0,NaN]],['Muzzle',[0,Infinity,0,1]],['TurretPivot',[0,Math.sin(.1),0,Math.cos(.1)]],['GunElevationPivot',[0,0,0,2]],['TankRoot',[NaN,0,0,1]],['RecoilPivot',[1e-8,0,0,1]]];
 for(const [joint,values]of cases)for(const ownsResources of [true,false]){
  const g=await asset(),r=resources(g),scene=new THREE.Scene(),count={geometry:0,material:0,texture:0,skeleton:0},texture=new THREE.Texture();[...r.material][0].map=texture;r.texture.add(texture);
  for(const kind of ['geometry','material','texture'])for(const value of r[kind])value.addEventListener('dispose',()=>count[kind]++);
  for(const skeleton of r.skeleton){skeleton.computeBoneTexture();skeleton.boneTexture.addEventListener('dispose',()=>count.texture++);const original=skeleton.dispose.bind(skeleton);skeleton.dispose=()=>{count.skeleton++;original();};}
  const root=g.scene.getObjectByName('TankRoot');g.scene.getObjectByName(joint).quaternion.fromArray(values);
  assert.throws(()=>create(scene,g,{ownsResources}),/Invalid skinned player:.*quaternion/i,`${joint} ${values} owned=${ownsResources}`);assert.equal(scene.children.length,0);assert.equal(root.parent,g.scene);
  assert.deepEqual(count,ownsResources?{geometry:r.geometry.size,material:r.material.size,texture:r.texture.size+r.skeleton.size,skeleton:r.skeleton.size}:{geometry:0,material:0,texture:0,skeleton:0});
  if(!ownsResources){for(const skeleton of r.skeleton)skeleton.dispose();for(const value of r.texture)value.dispose();for(const value of r.material)value.dispose();for(const value of r.geometry)value.dispose();}
 }
});

test('positive and negative identity quaternion signs remain valid on all controlled nodes',async()=>{
 for(const sign of [1,-1]){
  const g=await asset();for(const name of ['TankRoot','TurretPivot','GunElevationPivot','RecoilPivot','Muzzle'])g.scene.getObjectByName(name).quaternion.set(0,0,0,sign);
  const view=create(new THREE.Scene(),g),s=state(.05,-.03);s.pose={x:1,y:2,z:3,yaw:.7};s.turret={yawRel:-.3,elevation:.2,recoil:.08};view.update(s);const p=getTankTransform(s,rig).position;near(view.muzzleWorld(),new THREE.Vector3(p.x,p.y,p.z));view.dispose();
 }
});
