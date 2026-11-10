import * as THREE from 'three';
import {projectileDirection,resolveImpactFrame,shotDirection} from './combat-fx-frame.js';

/** Render-only effects. All transforms borrow plain simulation data; no writes.
 * No lights, postprocessing, camera shake, loaders, timers or custom shaders.
 * Shared batches bound both GPU resources and transparent overdraw. */
export const COMBAT_FX_BUDGET=Object.freeze({desktop:Object.freeze({shells:24,smoke:60,sparks:48,fragments:32,flames:12,scorches:12}),mobile:Object.freeze({shells:12,smoke:28,sparks:20,fragments:16,flames:6,scorches:6})});
const Y=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1),UP={x:0,y:1,z:0};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const point=p=>p&&[p.x,p.y,p.z].every(Number.isFinite);
const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
function random(seed){let n=seed||1;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}

// Authored local alpha masks: non-circular overlapping soot lobes, a tapering
// ragged flame, and broken-edge scorch. No texture request or canvas dependency.
function texture(kind){
 const size=64,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/(size-1)*2-1,v=y/(size-1)*2-1;
  const grain=(Math.sin(x*1.71+y*2.31)+Math.sin(x*.43-y*.81)+Math.sin(x*.19+y*.27))/6+.5;
  let a;
  if(kind==='flame'){
   const along=(v+1)/2,width=.12+.52*(1-along),edge=clamp(1-Math.abs(u+Math.sin(v*13)*.065)/width,0,1);
   a=edge**1.6*clamp((1-v)*2,0,1)*clamp((v+1)*6,0,1)*(.65+grain*.35);
  }else{
   const lobe=(cx,cy,r)=>Math.max(0,1-Math.hypot(u-cx,v-cy)/r);
   a=Math.max(lobe(-.2,-.08,.81)*.85,lobe(.22,.15,.66),lobe(.01,-.25,.66));
   a=clamp(a*(.48+grain*.72),0,1)**(kind==='soot'?1.15:1.45);
  }
  const i=(y*size+x)*4;
  data[i]=kind==='flame'?255:255;data[i+1]=kind==='flame'?Math.round(125+100*(1-Math.abs(u))):255;data[i+2]=kind==='flame'?Math.round(20+140*(1-Math.abs(u))**3):255;data[i+3]=Math.round(a*255);
 }
 const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.needsUpdate=true;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearFilter;t.generateMipmaps=false;t.colorSpace=THREE.SRGBColorSpace;return t;
}
function shardGeometry(){
 const g=new THREE.BufferGeometry();const vertices=[[-.45,-.2,-.3],[.5,-.17,-.25],[.3,.2,.35],[-.27,.32,.2]];
 const faces=[0,2,1,0,1,3,1,2,3,2,0,3];g.setAttribute('position',new THREE.Float32BufferAttribute(faces.flatMap(i=>vertices[i]),3));g.computeVertexNormals();return g;
}

export function createCombatFx(scene,spec,{mobile=globalThis.matchMedia?.('(pointer: coarse)')?.matches??false,reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false}={}){
 const budget=COMBAT_FX_BUDGET[mobile?'mobile':'desktop'],root=new THREE.Group();root.name='combat-fx';scene.add(root);
 const geometries=new Set(),materials=new Set(),textures=new Set();
 const ownG=g=>(geometries.add(g),g),ownM=m=>(materials.add(m),m),ownT=t=>(textures.add(t),t);
 const smokeMap=ownT(texture('smoke')),flameMap=ownT(texture('flame')),sootMap=ownT(texture('soot'));
 const transform=new THREE.Object3D(),vector=new THREE.Vector3(),quaternion=new THREE.Quaternion(),color=new THREE.Color();
 const seen=new Set(),seenObjects=new WeakSet(),tracks=new Map();let disposed=false,time=0;
 function batch(name,geometry,material,capacity){const mesh=new THREE.InstancedMesh(ownG(geometry),ownM(material),capacity);mesh.name=name;mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=false;mesh.receiveShadow=false;root.add(mesh);return mesh;}
 const body=batch('shell-cores',new THREE.CylinderGeometry(.082,.085,.38,8),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.45,metalness:.7,emissive:0x251300,emissiveIntensity:.28}),budget.shells);
 const nose=batch('shell-hot-noses',new THREE.ConeGeometry(.084,.15,8).translate(0,.265,0),new THREE.MeshBasicMaterial({color:0xffe9a4,toneMapped:false}),budget.shells);
 const tail=batch('shell-short-tails',new THREE.ConeGeometry(.075,.5,7).rotateZ(Math.PI).translate(0,-.44,0),new THREE.MeshBasicMaterial({color:0xff9b3d,transparent:true,opacity:.34,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}),budget.shells);
 const shellSlots=Array.from({length:budget.shells},(_,i)=>{const o=new THREE.Object3D();o.name=`shell-pool:${i}`;o.visible=false;root.add(o);return o;});
 const flames=batch('muzzle-flame-cards',new THREE.PlaneGeometry(1,1).translate(0,.5,0),new THREE.MeshBasicMaterial({map:flameMap,transparent:true,opacity:.86,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false}),budget.flames);
 const sparks=batch('impact-short-sparks',new THREE.BoxGeometry(.023,.16,.023),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),budget.sparks);
 const fragments=batch('impact-gravity-fragments',shardGeometry(),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.95,metalness:.08,flatShading:true}),budget.fragments);
 const scorches=batch('impact-static-scorches',new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0x151411,map:sootMap,transparent:true,opacity:.57,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2}),budget.scorches);
 const smokeGeometry=ownG(new THREE.BufferGeometry()),positions=new Float32Array(budget.smoke*3),colors=new Float32Array(budget.smoke*4);
 smokeGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));smokeGeometry.setAttribute('color',new THREE.BufferAttribute(colors,4).setUsage(THREE.DynamicDrawUsage));smokeGeometry.setDrawRange(0,0);
 const smoke=new THREE.Points(smokeGeometry,ownM(new THREE.PointsMaterial({map:smokeMap,size:.75,transparent:true,depthWrite:false,vertexColors:true,sizeAttenuation:true,opacity:1})));smoke.name='impact-and-muzzle-smoke';smoke.visible=false;smoke.frustumCulled=false;root.add(smoke);
 // Ground dust has a wider world-space footprint than muzzle smoke; both
 // batches share the existing bounded particle pool and authored alpha map.
 const dustGeometry=ownG(smokeGeometry.clone());
 const dustPositions=new Float32Array(budget.smoke*3),dustColors=new Float32Array(budget.smoke*4);
 dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustPositions,3).setUsage(THREE.DynamicDrawUsage));
 dustGeometry.setAttribute('color',new THREE.BufferAttribute(dustColors,4).setUsage(THREE.DynamicDrawUsage));dustGeometry.setDrawRange(0,0);
 const dustCloud=new THREE.Points(dustGeometry,ownM(new THREE.PointsMaterial({map:smokeMap,size:1.5,transparent:true,depthWrite:false,vertexColors:true,sizeAttenuation:true,opacity:1})));
 dustCloud.name='ground-impact-dust';dustCloud.visible=false;dustCloud.frustumCulled=false;root.add(dustCloud);
 const pools={smoke:Array.from({length:budget.smoke},()=>({life:0})),sparks:Array.from({length:budget.sparks},()=>({life:0})),fragments:Array.from({length:budget.fragments},()=>({life:0})),flames:Array.from({length:budget.flames},()=>({life:0})),scorches:Array.from({length:budget.scorches},()=>({life:0}))};
 const cursors={smoke:0,sparks:0,fragments:0,flames:0,scorches:0};
 function emit(kind,p,v,life,extra={}){const pool=pools[kind];const i=cursors[kind]++%pool.length;Object.assign(pool[i],{x:p.x,y:p.y,z:p.z,vx:v.x,vy:v.y,vz:v.z,life,maxLife:life,age:0,gravity:0,size:1,...extra});return pool[i];}
 const smokePuff=(p,v,life,tint,alpha=.27,groundDust=false)=>emit('smoke',p,v,reducedMotion?Math.min(.2,life):life,{tint,alpha,groundDust});
 function muzzle(event,state,events,rnd){
  const dir=shotDirection(event,state,events,[...tracks.values()]);
  // Unknown direction gets a compact static glow at the true muzzle rather than
  // borrowing current aim after a delayed event. No beam is emitted.
  const direction=dir||UP;
  for(let i=0;i<(reducedMotion?1:2);i++)emit('flames',event.position,{x:0,y:0,z:0},reducedMotion?.035:.052,{direction,roll:i*Math.PI/2,size:reducedMotion?.2:.43,wide:dir?.25:.18});
  for(let i=0;i<(reducedMotion?1:3);i++)smokePuff({x:event.position.x+direction.x*.18,y:event.position.y+direction.y*.18,z:event.position.z+direction.z*.18},{x:direction.x*(.35+rnd()*.25),y:.55+direction.y*.4,z:direction.z*(.35+rnd()*.25)},.34+rnd()*.24,0x797b75,.22);
 }
 function impact(event,state,rnd){
  const frame=resolveImpactFrame(event,state,spec,[...tracks.values()]);const n=frame.normal,p=event.position,terrainHit=event.targetId==='terrain';
  const tangent=new THREE.Vector3(n.z,0,-n.x);if(tangent.lengthSq()<.1)tangent.set(1,0,0);tangent.normalize();
  const cross=new THREE.Vector3().crossVectors(new THREE.Vector3(n.x,n.y,n.z),tangent).normalize();
  const origin={x:p.x+n.x*.035,y:p.y+n.y*.035,z:p.z+n.z*.035};
  const fan=(speed,spread)=>{const a=(rnd()-.5)*spread,b=(rnd()-.5)*spread;return {x:n.x*speed+tangent.x*a+cross.x*b,y:n.y*speed+tangent.y*a+cross.y*b,z:n.z*speed+tangent.z*a+cross.z*b};};
  if(!reducedMotion){
   if(frame.surface==='metal')for(let i=0;i<(mobile?5:9);i++)emit('sparks',origin,fan(2.4+rnd()*3.8,3.8),.12+rnd()*.13,{gravity:5,size:.8+rnd()*.7,tint:0xffc36c});
   const count=frame.surface==='metal'?2:mobile?4:6;
   for(let i=0;i<count;i++)emit('fragments',origin,fan(.8+rnd()*2.5,3),.38+rnd()*.44,{gravity:9.4,size:frame.surface==='metal'?.1+rnd()*.12:.16+rnd()*.22,spin:rnd()*9,roll:rnd()*6.28,tint:frame.surface==='metal'?0x61666a:frame.surface==='ground'?0x6e6048:0xa99a7f});
  }
  const dust=frame.surface==='metal'?(reducedMotion?1:2):(reducedMotion?2:mobile?4:7);
  for(let i=0;i<dust;i++){const v=fan(frame.surface==='ground'?.45:1.0,1.4);v.y+=.35;smokePuff(origin,v,(terrainHit?1.65+rnd()*.45:.3+rnd()*.4),frame.surface==='metal'?0x85857c:frame.surface==='ground'?0x887657:0xb4a58c,frame.surface==='metal'?.2:terrainHit?.48:.34,terrainHit);}
  if(frame.staticSurface&&state.entities?.[event.targetId]?.alive!==false)emit('scorches',origin,{x:0,y:0,z:0},6,{direction:n,size:terrainHit?1.55:frame.surface==='metal'?.32:.52,roll:rnd()*6.28,targetId:event.targetId});
 }
 function breakup(event,state,rnd){
  // These positions are entity origins, not contact points. A low breakup cloud
  // must not pretend that another damaging hit occurred there.
  const entity=state.entities?.[event.entityId],collider=(spec.geometry||[]).find(c=>c.id===event.entityId),masonry=entity?.kind==='barrier'||!!collider;
  const p={x:event.position.x,y:(event.position.y||0)+Math.min(.6,(entity?.height||collider?.height||1)*.35),z:event.position.z};
  for(let i=0;i<(reducedMotion?2:mobile?4:7);i++)smokePuff(p,{x:(rnd()-.5)*1.2,y:.6+rnd()*.7,z:(rnd()-.5)*1.2},reducedMotion?.2:.65+rnd()*.35,masonry?0x9e927c:0x555c58,.3);
  if(!reducedMotion)for(let i=0;i<(mobile?4:7);i++)emit('fragments',p,{x:(rnd()-.5)*3,y:1+rnd()*2,z:(rnd()-.5)*3},.5+rnd()*.35,{gravity:9.4,size:.2+rnd()*.18,spin:rnd()*7,roll:rnd()*6.28,tint:masonry?0x998d77:0x59615e});
 }
 function age(dt,state){
  for(const [kind,pool]of Object.entries(pools))for(const p of pool){
   if(p.life<=0)continue;p.life-=dt;p.age+=dt;if(p.life<=0)continue;
   if(kind==='scorches'){
    if(p.targetId&&state.entities?.[p.targetId]?.alive===false)p.life=0;
    continue;
   }
   if(reducedMotion)continue;
   p.x+=p.vx*dt;p.y+=p.vy*dt-.5*p.gravity*dt*dt;p.z+=p.vz*dt;p.vy-=p.gravity*dt;
   if(kind==='smoke'){const drag=Math.exp(-dt*2.3);p.vx*=drag;p.vz*=drag;p.vy*=Math.exp(-dt*.5);}
   if((kind==='fragments'||kind==='sparks')&&p.y<.035){p.y=.035;p.vx=0;p.vy=0;p.vz=0;p.life=Math.min(p.life,.1);}
  }
 }
 function pack(mesh,pool,kind){
  let count=0;
  for(const p of pool){if(p.life<=0)continue;const f=p.life/p.maxLife;transform.position.set(p.x,p.y,p.z);transform.rotation.set(0,0,0);transform.scale.set(1,1,1);
   if(kind==='flames'){
    vector.set(p.direction.x,p.direction.y,p.direction.z);transform.quaternion.setFromUnitVectors(Y,vector);quaternion.setFromAxisAngle(Y,p.roll);transform.quaternion.multiply(quaternion);transform.scale.set(p.wide,p.size*(.65+.35*f),1);
   }else if(kind==='scorches'){
    vector.set(p.direction.x,p.direction.y,p.direction.z);transform.quaternion.setFromUnitVectors(Z,vector);quaternion.setFromAxisAngle(Z,p.roll);transform.quaternion.multiply(quaternion);transform.scale.setScalar(p.size);
   }else{
    if(kind==='sparks'){vector.set(p.vx,p.vy,p.vz);if(vector.lengthSq()>.001)transform.quaternion.setFromUnitVectors(Y,vector.normalize());transform.scale.set(f,p.size*f,Math.max(.15,f));}
    else{transform.rotation.set(p.roll+p.age*p.spin,p.age*p.spin*.7,p.roll*.5);transform.scale.setScalar(p.size);}
    color.set(p.tint);if(kind==='sparks')color.multiplyScalar(.45+.55*f);mesh.setColorAt(count,color);
   }
   transform.updateMatrix();mesh.setMatrixAt(count++,transform.matrix);
  }
  mesh.count=count;mesh.visible=count>0;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
 }
 function drawSmoke(){
  let count=0,dustCount=0;
  for(const p of pools.smoke){
   if(p.life<=0)continue;
   const ground=p.groundDust,f=p.life/p.maxLife,index=ground?dustCount++:count++;
   const pos=ground?dustPositions:positions,col=ground?dustColors:colors;
   pos[index*3]=p.x;pos[index*3+1]=p.y;pos[index*3+2]=p.z;color.set(p.tint);
   col[index*4]=color.r;col[index*4+1]=color.g;col[index*4+2]=color.b;
   col[index*4+3]=p.alpha*Math.min(1,p.age/.035+.35)*(ground?Math.sqrt(f):f*f);
  }
  for(const [geometry,mesh,n] of [[smokeGeometry,smoke,count],[dustGeometry,dustCloud,dustCount]]){
   geometry.setDrawRange(0,n);geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;mesh.visible=n>0;
  }
 }
 function drawShells(state,dt){
  for(let i=0;i<shellSlots.length;i++){shellSlots[i].visible=false;shellSlots[i].name=`shell-pool:${i}`;}
  let count=0;
  for(const p of state.projectiles||[]){
   if(!point(p.position))continue;
   const previous=tracks.get(p.id),direction=projectileDirection(p);
   tracks.set(p.id,{id:p.id,ownerId:p.ownerId,position:{...p.position},previousPosition:point(p.previousPosition)?{...p.previousPosition}:{...p.position},velocity:p.velocity?{...p.velocity}:undefined,lastTime:time,window:Math.max(.05,dt)});
   if(count>=budget.shells)continue;
   const slot=shellSlots[count];slot.name=`projectile:${p.id}`;slot.visible=true;slot.position.set(p.position.x,p.position.y,p.position.z);slot.quaternion.identity();
   if(direction)slot.quaternion.setFromUnitVectors(Y,vector.set(direction.x,direction.y,direction.z));slot.updateMatrix();body.setMatrixAt(count,slot.matrix);nose.setMatrixAt(count,slot.matrix);tail.setMatrixAt(count,slot.matrix);color.set((spec.combatRelations?.version===1?p.faction===spec.combatRelations.playerTeam:p.faction==='player')?0xc8a15a:0xbb704d);body.setColorAt(count,color);
   if(!reducedMotion&&previous&&time-(previous.lastSmoke||0)>.075){smokePuff(p.position,{x:0,y:.12,z:0},.19,0x777970,.15);tracks.get(p.id).lastSmoke=time;}else if(previous)tracks.get(p.id).lastSmoke=previous.lastSmoke;
   count++;
  }
  for(const mesh of [body,nose,tail]){mesh.count=count;mesh.visible=count>0;mesh.instanceMatrix.needsUpdate=true;}body.instanceColor&&(body.instanceColor.needsUpdate=true);tail.visible=tail.visible&&!reducedMotion;
  for(const [id,t]of tracks)if(time-t.lastTime>.35)tracks.delete(id);
  while(tracks.size>budget.shells*3)tracks.delete(tracks.keys().next().value);
 }
 function update(state={},events=[],dt=0){
  if(disposed)return;dt=Number.isFinite(dt)?clamp(dt,0,.25):0;time+=dt;age(dt,state);drawShells(state,dt);
  const incoming=Array.isArray(events)?events:[],unique=[];
  for(const e of incoming){if(!e||!point(e.position))continue;if(e.id!==undefined){if(seen.has(e.id))continue;seen.add(e.id);if(seen.size>512)seen.delete(seen.values().next().value);}else{if(seenObjects.has(e))continue;seenObjects.add(e);}unique.push(e);}
  // Limit work as well as storage. Prefer real firing/hit cues over breakup if
  // a caller supplies a storm; events are consumed rather than deferred/replayed.
  const broken=new Set();let emitted=0;
  for(const e of unique){if(emitted>=48)break;const rnd=random(hash(e.id??`${e.type}:${time}:${emitted}`));
   if(e.type==='shot'){muzzle(e,state,unique,rnd);emitted++;}
   else if(e.type==='impact'){impact(e,state,rnd);emitted++;}
   else if((e.type==='destroyed'||e.type==='barrier-opened')&&!broken.has(e.entityId)){broken.add(e.entityId);breakup(e,state,rnd);emitted++;}
  }
  pack(flames,pools.flames,'flames');pack(sparks,pools.sparks,'sparks');pack(fragments,pools.fragments,'fragments');pack(scorches,pools.scorches,'scorches');drawSmoke();
 }
 function dispose(){if(disposed)return;disposed=true;scene.remove(root);root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});root.clear();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();tracks.clear();seen.clear();for(const pool of Object.values(pools))pool.length=0;}
 return {update,dispose,getStats(){return {reducedMotion,mobile,budget,visibleShells:body.count,smoke:smokeGeometry.drawRange.count+dustGeometry.drawRange.count,sparks:sparks.count,fragments:fragments.count,flames:flames.count,scorches:scorches.count,disposed};}};
}
