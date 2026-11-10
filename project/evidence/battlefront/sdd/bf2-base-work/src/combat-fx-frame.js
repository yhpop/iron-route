/** Read-only presentation adapters. Never trace a new gameplay hit here. */
export function unitVector(v) {
 if(!v||![v.x,v.y,v.z].every(Number.isFinite))return null;
 const length=Math.hypot(v.x,v.y,v.z);return length>1e-8?{x:v.x/length,y:v.y/length,z:v.z/length}:null;
}
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const validPoint=p=>p&&[p.x,p.y,p.z].every(Number.isFinite);
export function projectileDirection(projectile) {
 return unitVector(projectile?.velocity)||(validPoint(projectile?.position)&&validPoint(projectile?.previousPosition)?unitVector(sub(projectile.position,projectile.previousPosition)):null);
}

// Existing impact events have no projectileId. Prefer an ID when one is added
// by a future caller; otherwise accept only one nearby forward trajectory from
// the event owner. Multiple plausible shots mean "unknown", not a guessed hit.
function incomingDirection(event,tracks) {
 const candidates=[];
 for(const t of tracks){
  if(event.projectileId?t.id!==event.projectileId:t.ownerId!==event.entityId)continue;
  const direction=projectileDirection(t);if(!direction)continue;
  const origin=t.previousPosition||t.position;if(!validPoint(origin))continue;
  const delta=sub(event.position,origin),along=dot(delta,direction);
  const speed=Math.hypot(t.velocity?.x||0,t.velocity?.y||0,t.velocity?.z||0);
  if(along<-.1||along>Math.max(.7,speed*(t.window??.25)+.7))continue;
  const error=Math.hypot(delta.x-direction.x*along,delta.y-direction.y*along,delta.z-direction.z*along);
  if(error<.18)candidates.push({direction,error});
 }
 candidates.sort((a,b)=>a.error-b.error);
 if(candidates.length===1)return candidates[0].direction;
 if(candidates.length>1&&candidates[1].error-candidates[0].error>.12)return candidates[0].direction;
 return null;
}
function boxNormal(point,pose,width,depth,height,incoming) {
 const c=Math.cos(pose.yaw||0),s=Math.sin(pose.yaw||0),dx=point.x-pose.x,dz=point.z-pose.z;
 const local={x:c*dx-s*dz,y:point.y-(pose.y||0),z:s*dx+c*dz};
 const candidates=[
  {d:Math.abs(local.x-width/2),n:{x:c,y:0,z:-s}},
  {d:Math.abs(local.x+width/2),n:{x:-c,y:0,z:s}},
  {d:Math.abs(local.z-depth/2),n:{x:s,y:0,z:c}},
  {d:Math.abs(local.z+depth/2),n:{x:-s,y:0,z:-c}},
  {d:Math.abs(local.y-height),n:{x:0,y:1,z:0}},
  {d:Math.abs(local.y),n:{x:0,y:-1,z:0}},
 ];
 candidates.sort((a,b)=>(a.d-b.d)||(incoming?dot(a.n,incoming)-dot(b.n,incoming):0));return candidates[0].n;
}
function cylinderNormal(point,pose,radius,height,incoming) {
 const dx=point.x-pose.x,dz=point.z-pose.z,r=Math.hypot(dx,dz),y=point.y-(pose.y||0);
 const candidates=[{d:Math.abs(r-radius),n:r>1e-8?{x:dx/r,y:0,z:dz/r}:{x:0,y:1,z:0}},{d:Math.abs(y-height),n:{x:0,y:1,z:0}},{d:Math.abs(y),n:{x:0,y:-1,z:0}}];
 candidates.sort((a,b)=>(a.d-b.d)||(incoming?dot(a.n,incoming)-dot(b.n,incoming):0));return candidates[0].n;
}
export function resolveImpactFrame(event,state,spec,tracks=[]) {
 const incoming=incomingDirection(event,tracks);
 const collider=(spec.geometry||[]).find(c=>c.id===event.targetId);
 const entity=event.targetId==='tank'?{kind:'tank',pose:state.tank?.pose,width:1.9,depth:2.9,height:1.5}:state.entities?.[event.targetId];
 let normal,surface='ground',staticSurface=false;
 if(event.targetId==='terrain'&&unitVector(event.normal)){normal=unitVector(event.normal);staticSurface=true;}else if(collider){
  const pose={x:collider.x,y:collider.y||0,z:collider.z,yaw:collider.yaw||0};
  normal=collider.kind==='circle'?cylinderNormal(event.position,pose,collider.radius,collider.height,incoming):boxNormal(event.position,pose,collider.width,collider.depth,collider.height,incoming);
  surface=collider.material==='metal'?'metal':'masonry';staticSurface=true;
 }else if(entity?.pose){
  normal=['truck','tank'].includes(entity.kind)?boxNormal(event.position,entity.pose,entity.width||1.8,entity.depth||3.6,entity.height||2.2,incoming):cylinderNormal(event.position,entity.pose,entity.radius||.8,entity.height||2.2,incoming);
  surface='metal';
 }else{
  normal=event.position.y<.15?{x:0,y:1,z:0}:incoming?{x:-incoming.x,y:-incoming.y,z:-incoming.z}:{x:0,y:1,z:0};
  // Unknown elevated target: generic dust, but do not float a decal in midair.
  staticSurface=event.position.y<.15;
 }
 if(event.value==='shield')surface='metal';
 return {normal,incoming,surface,staticSurface};
}

export function shotDirection(event,state,events,tracks=[]) {
 const projectile=(state.projectiles||[]).find(p=>p.id===event.projectileId)||tracks.find(p=>p.id===event.projectileId);
 const direction=projectileDirection(projectile);if(direction)return direction;
 // A shell may be born and hit within a single fixed tick. Only an unambiguous
 // new shot/impact pair can reveal its direction from actual reported positions.
 const shots=events.filter(e=>e.type==='shot'&&e.entityId===event.entityId);
 const impacts=events.filter(e=>e.type==='impact'&&e.entityId===event.entityId&&validPoint(e.position));
 if(shots.length===1&&impacts.length===1&&!tracks.some(p=>p.ownerId===event.entityId))return unitVector(sub(impacts[0].position,event.position));
 return null;
}
