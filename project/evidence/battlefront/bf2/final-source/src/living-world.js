import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
export function createWildlife(habitat){return {...habitat,home:{...habitat.home},refuge:{...habitat.refuge},x:habitat.home.x,z:habitat.home.z,mode:'walk',time:0,restFor:0};}
export function stepWildlife(a,tank,events,dt){
 if(!Number.isFinite(dt)||dt<=0)return a;dt=Math.min(dt,.1);const b={...a,time:a.time+dt};
 const danger=Math.hypot(tank.x-a.x,tank.z-a.z)<9||events.some(e=>e.type==='shot'&&e.position&&Math.hypot(e.position.x-a.x,e.position.z-a.z)<18);
 if(danger&&a.mode!=='rest')b.mode='run';
 if(b.mode==='rest'){b.restFor+=dt;if(b.restFor<12||danger)return b;b.mode='return';}
 const target=b.mode==='run'?b.refuge:b.mode==='return'?b.home:{x:b.home.x+Math.sin(b.time*.3)*1.2,z:b.home.z+Math.cos(b.time*.3)*1.2};
 const d=Math.hypot(target.x-b.x,target.z-b.z),step=Math.min(d,(b.mode==='run'?3: .55)*dt);
 if(d){b.x+=(target.x-b.x)/d*step;b.z+=(target.z-b.z)/d*step;b.yaw=Math.atan2(target.x-a.x,target.z-a.z);}
 if(d<.12&&b.mode==='run'){b.mode='rest';b.restFor=0;}else if(d<.12&&b.mode==='return')b.mode='walk';return b;
}
function segmentDistance(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);}
export function createMeadow(spec,heightAt,count=1200){let seed=71631;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296,result=[];const b=spec.bounds,patches=[[.35,.81],[.14,.64],[.16,.3],[.78,.76],[.83,.36],[.58,.13]];
 for(let i=0;i<count*12&&result.length<count;i++){const clustered=rand()<.75,patch=patches[Math.floor(rand()*patches.length)],u=clustered?patch[0]+(rand()+rand()-1)*.085:rand(),v=clustered?patch[1]+(rand()+rand()-1)*.075:rand();const p={x:b.minX+u*(b.maxX-b.minX),z:b.minZ+v*(b.maxZ-b.minZ)};
 if((spec.routes||[]).some(r=>r.points.some((v,j)=>j&&segmentDistance(p,r.points[j-1],v)<=r.width/2+1)))continue;
 if((spec.geometry||[]).some(g=>g.kind==='circle'?Math.hypot(p.x-g.x,p.z-g.z)<g.radius+1:Math.abs(p.x-g.x)<(g.width*Math.abs(Math.cos(g.yaw||0))+g.depth*Math.abs(Math.sin(g.yaw||0)))/2+1&&Math.abs(p.z-g.z)<(g.depth*Math.abs(Math.cos(g.yaw||0))+g.width*Math.abs(Math.sin(g.yaw||0)))/2+1))continue;
 const variant=rand(),layer=variant<.55?'groundcover':variant<.88?'meadow':'tall',scale=.7+rand()*.5;result.push({...p,y:heightAt(p.x,p.z),rootBounds:b,scale,widthScale:scale*(layer==='groundcover'?1.6:layer==='tall'?.85:1.25),heightScale:scale*(layer==='groundcover'?.55:layer==='tall'?1.75:1),layer,angle:rand()*Math.PI*2,tint:rand()});}return result;
}
// A tuft is seven independently rooted blades. Instancing blades (rather than
// an identical whole tuft) keeps one draw and 42 triangles per tuft, while each
// root can follow the actual terrain. Uses ordinary Three materials/attributes.
const BLADES_PER_TUFT=7, BLADE_HALF_WIDTH=.014, BLADE_ROOT_HALF_WIDTH=.002;
function meadowRandom(point){
 let seed=(Math.imul(Math.round(point.x*4096),73856093)^Math.imul(Math.round(point.z*4096),19349663)^71631)>>>0;
 return ()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
}
function queueMatrixRanges(attribute,changed){
 // Preserve writes not rendered yet (e.g. several simulation steps in one
 // frame), without accumulating duplicate ranges during a long recovery.
 const ranges=[...attribute.updateRanges,...changed.map(i=>({start:i*BLADES_PER_TUFT*16,count:BLADES_PER_TUFT*16}))].sort((a,b)=>a.start-b.start);
 const merged=[];
 for(const range of ranges){const last=merged.at(-1);if(last&&range.start<=last.start+last.count)last.count=Math.max(last.start+last.count,range.start+range.count)-last.start;else merged.push({...range});}
 attribute.clearUpdateRanges();for(const range of merged)attribute.addUpdateRange(range.start,range.count);
 attribute.needsUpdate=true;
}
export function createVegetationView(scene,points,{groundHeightAt=null}={}){
 const root=new THREE.Group();root.name='living-meadow';scene.add(root);
 const vertices=[],colors=[];
 const bladePoint=(v,side)=>[(v===0?BLADE_ROOT_HALF_WIDTH:BLADE_HALF_WIDTH*(1-v))*side,v,.025*v+.075*v*v];
 for(let j=0;j<3;j++){
  const t=j/3,u=(j+1)/3;
  for(const [v,side] of [[t,-1],[t,1],[u,-1],[t,1],[u,1],[u,-1]]){vertices.push(...bladePoint(v,side));const light=.45+.55*v;colors.push(light*.88,light,light*.78);}
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,vertexColors:true,side:THREE.DoubleSide});
 const mesh=new THREE.InstancedMesh(geometry,material,points.length*BLADES_PER_TUFT);mesh.name='meadow-blades';mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);root.add(mesh);
 const blades=points.map(p=>{
  const rand=meadowRandom(p),width=p.widthScale??p.scale,height=p.heightScale??p.scale;
  const surface=(x,z)=>groundHeightAt?groundHeightAt(x,z):p.y;
  return Array.from({length:BLADES_PER_TUFT},(_,j)=>{
   const rootAngle=rand()*Math.PI*2,radius=(.05+.19*Math.sqrt(rand()))*width;
   let x=p.x+Math.cos(rootAngle)*radius,z=p.z+Math.sin(rootAngle)*radius;
   const angle=p.angle+(rand()-.5)*2.5,sx=width*(.75+.45*rand()),sy=height*(.26+.22*rand());let sz=width*(.55+.9*rand());
   // At maximum crush width both root corners remain at/above the surface.
   // Root positions then stay fixed throughout crush/recovery, rather than
   // sliding sideways across a slope when the tuft expands.
   const halfWidth=BLADE_ROOT_HALF_WIDTH*sx*1.3,dx=Math.cos(angle)*halfWidth,dz=-Math.sin(angle)*halfWidth;
   // Points near the field boundary must not query outside its height domain.
   if(p.rootBounds){const b=p.rootBounds,margin=BLADE_HALF_WIDTH*sx*1.3+.1*sz+.002;x=Math.max(b.minX+margin,Math.min(b.maxX-margin,x));z=Math.max(b.minZ+margin,Math.min(b.maxZ-margin,z));}
   const y=Math.max(surface(x,z),surface(x+dx,z+dz),surface(x-dx,z-dz))+.003;
   // Keep curved silhouettes on flat/downhill ground. Only limit a bend into
   // rising terrain, so short blades cannot put their tips through the slope.
   const bendX=Math.sin(angle)*.01,bendZ=Math.cos(angle)*.01;
   const uphill=(surface(x+bendX,z+bendZ)-surface(x-bendX,z-bendZ))/.02;
   if(uphill>.35)sz=Math.min(sz,sy*3.5/uphill);
   const gradientX=(surface(x+.01,z)-surface(x-.01,z))/.02,gradientZ=(surface(x,z+.01)-surface(x,z-.01))/.02;
   const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle);
   const groundRotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(-gradientX,1,-gradientZ).normalize()).multiply(rotation);
   const tint=Math.max(0,Math.min(1,p.tint+(rand()-.5)*.18));
   return {x,y,z,rotation,groundRotation,sx,sy,sz,tint};
  });
 });
 const dummy=new THREE.Object3D(),compression=new Float32Array(points.length);let disposed=false,initialized=false;
 function update(tank,dt=.1){
  if(disposed)return;
  const elapsed=Math.min(.1,Math.max(0,Number.isFinite(dt)?dt:0)),changed=[];
  points.forEach((p,i)=>{
   const previous=compression[i],flat=Math.hypot(p.x-tank.x,p.z-tank.z)<1.7;
   compression[i]=flat?1:Math.max(0,compression[i]-elapsed/20);
   if(initialized&&previous===compression[i])return;
   for(let j=0;j<BLADES_PER_TUFT;j++){
    const b=blades[i][j];dummy.position.set(b.x,b.y,b.z);
    // Flatten onto the actual slope tangent, not through an uphill surface.
    // Quaternion interpolation retains the varied upright standing silhouettes.
    dummy.quaternion.copy(b.rotation).slerp(b.groundRotation,compression[i]);
    dummy.scale.set(b.sx*(1+compression[i]*.3),b.sy*(1-compression[i]*.88),b.sz);dummy.updateMatrix();mesh.setMatrixAt(i*BLADES_PER_TUFT+j,dummy.matrix);
   }
   changed.push(i);
  });
  if(changed.length){
   if(initialized)queueMatrixRanges(mesh.instanceMatrix,changed);
   else mesh.instanceMatrix.needsUpdate=true; // first GPU allocation already copies the whole buffer
  }
  if(!initialized){mesh.computeBoundingSphere();mesh.boundingSphere.radius+=1;}initialized=true;
 }
 blades.forEach((tuft,i)=>tuft.forEach((b,j)=>mesh.setColorAt(i*BLADES_PER_TUFT+j,new THREE.Color().setHSL(.19+b.tint*.055,.24+b.tint*.2,.22+b.tint*.1))));
 update({x:1e5,z:1e5});
 return {root,update,diagnostics:{drawCalls:1,instances:points.length,bladeInstances:mesh.count,triangles:points.length*42,instanceMatrixBytes:mesh.instanceMatrix.array.byteLength},dispose(){if(disposed)return;disposed=true;scene.remove(root);mesh.dispose();geometry.dispose();material.dispose();}};
}
export async function parseWildlife(data){const bytes=data instanceof ArrayBuffer?data:data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);return new GLTFLoader().parseAsync(bytes,'');}
export function createLivingWorldView(scene,spec,{foxData,groundHeightAt=()=>0,load=parseWildlife}={}){
 const root=new THREE.Group();root.name='living-world';scene.add(root);const vegetation=createVegetationView(root,createMeadow(spec,groundHeightAt,3600),{groundHeightAt});let disposed=false,source=null;const actors=[];const diagnostics={...vegetation.diagnostics,animals:0,colliders:0,loaded:0,failed:0};
 function release(){if(!source)return;const geometries=new Set(),materials=new Set(),textures=new Set();source.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());source=null;}
 const ready=load(foxData).then(gltf=>{source=gltf;if(disposed){release();return {loaded:0,failed:0};}const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3()),scale=.68/size.y;
 for(const habitat of [{id:'west-fox',home:{x:-14,z:29},refuge:{x:-18,z:33}},{id:'east-fox',home:{x:29,z:17},refuge:{x:33,z:20}}]){const model=clone(gltf.scene),holder=new THREE.Group();model.scale.setScalar(scale);model.position.y=-bounds.min.y*scale;model.traverse(o=>{if(o.isMesh)o.castShadow=true;});holder.add(model);holder.position.set(habitat.home.x,groundHeightAt(habitat.home.x,habitat.home.z),habitat.home.z);root.add(holder);const mixer=new THREE.AnimationMixer(model),actions={};for(const clip of gltf.animations)actions[clip.name.toLowerCase()]=mixer.clipAction(clip);actors.push({holder,mixer,actions,state:createWildlife(habitat),active:null});}diagnostics.animals=actors.length;diagnostics.loaded=1;return {loaded:1,failed:0};});
 return {root,ready,diagnostics,update(state,events=[],dt=0){if(disposed||state.phase!=='playing')return;const tank=state.tank.pose;vegetation.update(tank,dt);for(const a of actors){a.state=stepWildlife(a.state,tank,events,dt);a.holder.visible=true;a.holder.position.set(a.state.x,groundHeightAt(a.state.x,a.state.z),a.state.z);a.holder.rotation.y=a.state.yaw||0;const action=a.actions[a.state.mode==='run'?'run':a.state.mode==='rest'?'survey':'walk'];if(action&&a.active!==action){a.active?.fadeOut(.15);action.reset().fadeIn(.15).play();a.active=action;}a.mixer.update(Math.min(Math.max(Number.isFinite(dt)?dt:0,0),.1));}},dispose(){if(disposed)return;disposed=true;for(const a of actors){a.mixer.stopAllAction();a.mixer.uncacheRoot(a.mixer.getRoot());a.holder.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});}actors.length=0;vegetation.dispose();scene.remove(root);release();}};
}
