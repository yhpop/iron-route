/** Height-aware deterministic collision queries. No renderer, wall clock, mutable GameState or physics worker. */
import {conservativeShapeBounds,boundsMayContact} from './collision-broadphase.js';
import { DEFAULT_CONFIG, getTankTransform, integrateArc, rotateYaw, hullVector, wrapAngle } from './tank-controller.js';
const SKIN=.015, SAMPLE_MARGIN=SKIN*2, EPS=1e-9, MAX_ANGLE=Math.PI/90;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const point=(p={})=>({x:p.x??0,y:p.y??0,z:p.z??0});
const plus=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const norm=v=>{const n=Math.hypot(v.x,v.y,v.z)||1;return {x:v.x/n,y:v.y/n,z:v.z/n};};
const local=(p,b)=>rotateYaw({x:p.x-b.x,y:p.y-b.y,z:p.z-b.z},-b.yaw);
const sizeRadius=box=>Math.hypot(box.width/2,box.height/2,box.depth/2);
function makeBox(origin,yaw,proxy) {return {kind:'box',...plus(origin,rotateYaw(point(proxy.offset),yaw)),yaw,width:proxy.width,depth:proxy.depth,height:proxy.height};}
function tiltedBox(pose,proxy,origin,yawRel=0){
 const corners=[];for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5]){const p={x:proxy.offset.x+x*proxy.width,y:proxy.offset.y+y*proxy.height,z:proxy.offset.z+z*proxy.depth};corners.push(plus(pose,hullVector(plus(origin,rotateYaw(p,yawRel)),pose)));}
 const range=k=>[Math.min(...corners.map(p=>p[k])),Math.max(...corners.map(p=>p[k]))];const [x,X]=range('x'),[y,Y]=range('y'),[z,Z]=range('z');
 return {kind:'box',x:(x+X)/2,y:(y+Y)/2,z:(z+Z)/2,yaw:0,width:X-x,height:Y-y,depth:Z-z};
}
function partsAt(transform,rig) {
  const t=getTankTransform(transform,rig),yaw=transform.pose.yaw+transform.turret.yawRel;
  return [
    {...(transform.pose.basis?tiltedBox(transform.pose,rig.hullProxy,{x:0,y:0,z:0}):makeBox(transform.pose,transform.pose.yaw,rig.hullProxy)),part:'body'},
    {...(transform.pose.basis?tiltedBox(transform.pose,rig.turretProxy,rig.turretPivot,transform.turret.yawRel):makeBox(t.turretOrigin,yaw,rig.turretProxy)),part:'turret'},
    {kind:'capsule',a:t.barrelStart,b:t.barrelEnd,radius:rig.barrelCapsule.radius,part:'barrel'},
  ];
}
function boxBoxGap(a,b) {
  const dx=b.x-a.x,dz=b.z-a.z;
  let gap=Math.abs(b.y-a.y)-(a.height+b.height)/2;
  for(const yaw of [a.yaw,b.yaw]) for(const offset of [0,Math.PI/2]) {
    const x=Math.cos(yaw+offset),z=-Math.sin(yaw+offset);
    const radius=q=>Math.abs(x*Math.cos(q.yaw)-z*Math.sin(q.yaw))*q.width/2+Math.abs(x*Math.sin(q.yaw)+z*Math.cos(q.yaw))*q.depth/2;
    gap=Math.max(gap,Math.abs(dx*x+dz*z)-radius(a)-radius(b));
  }
  return gap;
}
function boxCylinderGap(box,cylinder) {
  const p=local(cylinder,box);
  const horizontal=Math.hypot(Math.max(Math.abs(p.x)-box.width/2,0),Math.max(Math.abs(p.z)-box.depth/2,0))-cylinder.radius;
  const vertical=Math.abs(box.y-cylinder.y)-(box.height+cylinder.height)/2;
  return Math.max(horizontal,vertical);
}
/** Exact segment-to-AABB distance: squared distance is quadratic between slab breakpoints. */
function segmentBoxDistance(a,b,box) {
  const p=local(a,box),q=local(b,box),half={x:box.width/2,y:box.height/2,z:box.depth/2};
  const delta={x:q.x-p.x,y:q.y-p.y,z:q.z-p.z};
  const breaks=[0,1];
  for(const k of ['x','y','z']) if(Math.abs(delta[k])>EPS) for(const side of [-half[k],half[k]]) {
    const t=(side-p[k])/delta[k];if(t>0&&t<1)breaks.push(t);
  }
  breaks.sort((a,b)=>a-b);
  const evaluate=t=>['x','y','z'].reduce((sum,k)=>sum+Math.max(Math.abs(p[k]+delta[k]*t)-half[k],0)**2,0);
  let best=Math.min(evaluate(0),evaluate(1));
  for(let i=0;i<breaks.length-1;i++) {
    const lo=breaks[i],hi=breaks[i+1],mid=(lo+hi)/2;
    let a2=0,b2=0;
    for(const k of ['x','y','z']) {
      const at=p[k]+delta[k]*mid;
      if(Math.abs(at)<=half[k])continue;
      const c=p[k]-Math.sign(at)*half[k];a2+=delta[k]**2;b2+=c*delta[k];
    }
    best=Math.min(best,evaluate(lo),evaluate(hi),evaluate(a2?clamp(-b2/a2,lo,hi):mid));
  }
  return Math.sqrt(best);
}
function segmentCylinderDistance(a,b,c) {
  // Distance to a closed convex cylinder is convex along a line. Ternary minimization is deterministic.
  const sq=t=>{
    const x=lerp(a.x,b.x,t)-c.x,z=lerp(a.z,b.z,t)-c.z,y=lerp(a.y,b.y,t)-c.y;
    return Math.max(Math.hypot(x,z)-c.radius,0)**2+Math.max(Math.abs(y)-c.height/2,0)**2;
  };
  let lo=0,hi=1;
  for(let i=0;i<48;i++){const p=lo+(hi-lo)/3,q=hi-(hi-lo)/3;if(sq(p)<sq(q))hi=q;else lo=p;}
  return Math.sqrt(Math.min(sq(0),sq(1),sq((lo+hi)/2)));
}
const minus=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const along=(a,d,t)=>({x:a.x+d.x*t,y:a.y+d.y*t,z:a.z+d.z*t});
function segmentSegmentDistance(p1,q1,p2,q2) {
  const d1=minus(q1,p1),d2=minus(q2,p2),r=minus(p1,p2),a=dot(d1,d1),e=dot(d2,d2),f=dot(d2,r);
  let t=0,u=0;
  if(a<=EPS&&e<=EPS)return distance(p1,p2);
  if(a<=EPS)u=clamp(f/e,0,1);
  else {
    const c=dot(d1,r);
    if(e<=EPS)t=clamp(-c/a,0,1);
    else {
      const b=dot(d1,d2),denom=a*e-b*b;
      t=denom>EPS?clamp((b*f-c*e)/denom,0,1):0;
      u=(b*t+f)/e;
      if(u<0){u=0;t=clamp(-c/a,0,1);}else if(u>1){u=1;t=clamp((b-c)/a,0,1);}
    }
  }
  return distance(along(p1,d1,t),along(p2,d2,u));
}
function shapeGap(part,collider) {
  if(collider.kind==='capsule')return part.kind==='capsule'
    ? segmentSegmentDistance(part.a,part.b,collider.a,collider.b)-part.radius-collider.radius
    : segmentBoxDistance(collider.a,collider.b,part)-collider.radius;
  if(part.kind==='capsule')return (collider.kind==='circle'?segmentCylinderDistance(part.a,part.b,collider):segmentBoxDistance(part.a,part.b,collider))-part.radius;
  return collider.kind==='circle'?boxCylinderGap(part,collider):boxBoxGap(part,collider);
}
function extents(part) {
  if(part.kind==='capsule')return {minX:Math.min(part.a.x,part.b.x)-part.radius,maxX:Math.max(part.a.x,part.b.x)+part.radius,minZ:Math.min(part.a.z,part.b.z)-part.radius,maxZ:Math.max(part.a.z,part.b.z)+part.radius};
  const dx=Math.abs(Math.cos(part.yaw))*part.width/2+Math.abs(Math.sin(part.yaw))*part.depth/2;
  const dz=Math.abs(Math.sin(part.yaw))*part.width/2+Math.abs(Math.cos(part.yaw))*part.depth/2;
  return {minX:part.x-dx,maxX:part.x+dx,minZ:part.z-dz,maxZ:part.z+dz};
}
function blendTurret(a,b,t) {return {yawRel:wrapAngle(a.yawRel+wrapAngle(b.yawRel-a.yawRel)*t),elevation:lerp(a.elevation,b.elevation,t),recoil:lerp(a.recoil,b.recoil,t),recoilVelocity:lerp(a.recoilVelocity??0,b.recoilVelocity??0,t)};}
function signedArc(from,to) {
  const angle=wrapAngle(to.yaw-from.yaw),mid=from.yaw+angle/2;
  const projected=-(to.x-from.x)*Math.sin(mid)-(to.z-from.z)*Math.cos(mid);
  return Math.abs(projected)<1e-12?0:(Math.abs(angle)<1e-8?projected:projected/(Math.sin(angle/2)/(angle/2)));
}
function rigReach(rig) {
  return Math.max(
    Math.hypot(...Object.values(point(rig.hullProxy.offset)))+sizeRadius(rig.hullProxy),
    Math.hypot(...Object.values(point(rig.turretPivot)))+Math.hypot(...Object.values(point(rig.turretProxy.offset)))+sizeRadius(rig.turretProxy),
    Math.hypot(...Object.values(point(rig.turretPivot)))+Math.hypot(...Object.values(point(rig.barrelPivot)))+Math.hypot(...Object.values(point(rig.muzzleLocal)))+rig.barrelCapsule.radius+.1,
  );
}
function rayBox(from,to,box) {
  const a=local(from,box),b=local(to,box),half={x:box.width/2,y:box.height/2,z:box.depth/2};
  let enter=0,exit=1,normal={x:0,y:0,z:0};
  for(const k of ['x','y','z']) {
    const d=b[k]-a[k];if(Math.abs(d)<EPS){if(Math.abs(a[k])>half[k])return null;continue;}
    let near=(-half[k]-a[k])/d,far=(half[k]-a[k])/d,sign=-1;
    if(near>far){[near,far]=[far,near];sign=1;}
    if(near>enter){enter=near;normal={x:0,y:0,z:0};normal[k]=sign;}
    exit=Math.min(exit,far);if(enter>exit)return null;
  }
  return enter>=0&&enter<=1?{fraction:enter,normal:rotateYaw(normal,box.yaw)}:null;
}
function rayCylinder(from,to,c) {
  const ax=from.x-c.x,az=from.z-c.z,ay=from.y-c.y,dx=to.x-from.x,dz=to.z-from.z,dy=to.y-from.y;
  let enter=0,exit=1,normal={x:0,y:0,z:0};
  const A=dx*dx+dz*dz,B=2*(ax*dx+az*dz),C=ax*ax+az*az-c.radius*c.radius;
  if(A<EPS){if(C>0)return null;}else{
    const disc=B*B-4*A*C;if(disc<0)return null;
    const n=(-B-Math.sqrt(disc))/(2*A),f=(-B+Math.sqrt(disc))/(2*A);
    if(n>enter){enter=n;normal=norm({x:ax+dx*n,y:0,z:az+dz*n});}exit=Math.min(exit,f);
  }
  if(Math.abs(dy)<EPS){if(Math.abs(ay)>c.height/2)return null;}else{
    let n=(-c.height/2-ay)/dy,f=(c.height/2-ay)/dy,sign=-1;
    if(n>f){[n,f]=[f,n];sign=1;}
    if(n>enter){enter=n;normal={x:0,y:sign,z:0};}exit=Math.min(exit,f);
  }
  return enter<=exit&&enter>=0&&enter<=1?{fraction:enter,normal}:null;
}

/** Exact finite ray/capsule intersection: cylinder flank plus two spherical caps. */
function rayCapsule(from,to,c) {
  const direction=minus(to,from),axis=minus(c.b,c.a),length=Math.hypot(axis.x,axis.y,axis.z);
  const unit=length>EPS?{x:axis.x/length,y:axis.y/length,z:axis.z/length}:{x:0,y:1,z:0};
  const relative=minus(from,c.a),parallel=dot(relative,unit),rate=dot(direction,unit);
  const closest=along(c.a,unit,clamp(parallel,0,length));
  if(distance(from,closest)<=c.radius)return {fraction:0,normal:norm(minus(from,closest))};
  let best=null;
  const accept=(fraction,normal)=>{if(fraction>=0&&fraction<=1&&(!best||fraction<best.fraction))best={fraction,normal};};
  const radial=minus(relative,along({x:0,y:0,z:0},unit,parallel));
  const radialRate=minus(direction,along({x:0,y:0,z:0},unit,rate));
  const A=dot(radialRate,radialRate),B=2*dot(radial,radialRate),C=dot(radial,radial)-c.radius*c.radius;
  const disc=B*B-4*A*C;
  if(A>EPS&&disc>=0)for(const t of [(-B-Math.sqrt(disc))/(2*A),(-B+Math.sqrt(disc))/(2*A)]) {
    const at=parallel+rate*t;
    if(at>=0&&at<=length)accept(t,norm(along(radial,radialRate,t)));
  }
  const dd=dot(direction,direction);
  if(dd>EPS)for(const center of [c.a,c.b]) {
    const m=minus(from,center),b=2*dot(m,direction),cc=dot(m,m)-c.radius*c.radius,discriminant=b*b-4*dd*cc;
    if(discriminant<0)continue;
    for(const t of [(-b-Math.sqrt(discriminant))/(2*dd),(-b+Math.sqrt(discriminant))/(2*dd)])accept(t,norm(minus(along(from,direction,t),center)));
  }
  return best;
}

function inPolygon(p,polygon) {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[j],b=polygon[i],dx=b.x-a.x,dz=b.z-a.z;
    const cross=(p.x-a.x)*dz-(p.z-a.z)*dx;
    if(Math.abs(cross)<EPS&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.z>=Math.min(a.z,b.z)-EPS&&p.z<=Math.max(a.z,b.z)+EPS)return true;
    if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)inside=!inside;
  }
  return inside;
}

export function createWorld(spec = {}, {groundPose=null} = {}) {
  let disposed=false,destroyed=new Set(),dynamic=[];
  const colliders=(spec.geometry||[]).map(c=>{
    if(!c.id || !['box','circle'].includes(c.kind) || ![c.x,c.z,c.height].every(Number.isFinite) || c.height<=0)throw new TypeError('Invalid world collider');
    if(c.kind==='box'&&(!Number.isFinite(c.width)||!Number.isFinite(c.depth)||c.width<=0||c.depth<=0))throw new TypeError('Invalid box dimensions');
    if(c.kind==='circle'&&(!Number.isFinite(c.radius)||c.radius<=0))throw new TypeError('Invalid circle radius');
    return {...c,y:(c.y??0)+c.height/2,yaw:c.yaw??0};
  });
  const staticBounds=colliders.map(conservativeShapeBounds);
  let dynamicBounds=[];
  const surfaces=(spec.surfaces||[]).map(surface=>({
    id:surface.id??null,class:surface.class||'rubble',
    traction:clamp(Number.isFinite(surface.traction)?surface.traction:1,.35,1),
    drag:clamp(Number.isFinite(surface.drag)?surface.drag:1,1,2.5),
    polygon:(surface.polygon||[]).map(p=>({x:p.x,z:p.z})),
  }));
  const bounds=spec.bounds;
  const live=()=>{if(disposed)throw new Error('Collision world is disposed');};
  function inspect(parts,threshold=SAMPLE_MARGIN,ignoreIds=[]) {
    const ignored=new Set(ignoreIds);
    let gap=Infinity,blockedPart=null;const contacts=[];
    for(const part of parts) {
      for(const c of [...colliders,...dynamic])if(!ignored.has(c.id)&&(c.dynamic||!destroyed.has(c.id))) {
        const g=shapeGap(part,c);if(g<gap){gap=g;blockedPart=part.part;}
        if(g<threshold-EPS)contacts.push(c.id);
      }
      if(bounds) {
        const e=extents(part);
        for(const [g,id] of [[e.minX-bounds.minX,'bounds:west'],[bounds.maxX-e.maxX,'bounds:east'],[e.minZ-bounds.minZ,'bounds:north'],[bounds.maxZ-e.maxZ,'bounds:south']]) {
          if(g<gap){gap=g;blockedPart=part.part;}if(g<threshold-EPS)contacts.push(id);
        }
      }
    }
    return {gap,contacts:[...new Set(contacts)],blockedPart};
  }
  function inspectSweep(parts,threshold=SAMPLE_MARGIN,ignoreIds=[]) {
    const ignored=new Set(ignoreIds);
    let gap=Infinity,blockedPart=null;const contacts=[];
    for(const part of parts) {
      const partBounds=conservativeShapeBounds(part);
      for(const [records,boxes] of [[colliders,staticBounds],[dynamic,dynamicBounds]])for(let i=0;i<records.length;i++){
        const c=records[i];
        if(ignored.has(c.id)||(!c.dynamic&&destroyed.has(c.id))||!boundsMayContact(partBounds,boxes[i],threshold))continue;
        const g=shapeGap(part,c);if(g<gap){gap=g;blockedPart=part.part;}
        if(g<threshold-EPS)contacts.push(c.id);
      }
      if(bounds) {
        const e=extents(part);
        for(const [g,id] of [[e.minX-bounds.minX,'bounds:west'],[bounds.maxX-e.maxX,'bounds:east'],[e.minZ-bounds.minZ,'bounds:north'],[bounds.maxZ-e.maxZ,'bounds:south']]) {
          if(g<gap){gap=g;blockedPart=part.part;}if(g<threshold-EPS)contacts.push(id);
        }
      }
    }
    return {gap,contacts:[...new Set(contacts)],blockedPart};
  }
  /** Every proxy point moves <= SKIN between samples. Samples require 2*SKIN clearance,
   * so even an arbitrarily thin obstruction missed between samples still has >= SKIN
   * separation. This is an envelope bound, not an unprotected endpoint collision test.
   * First contact is then refined to a prefix; accepted poses never slide or teleport. */
  function sweep(at,motionBound,angleBound,parts,arcDistance=0,ignoreIds=[]) {
    live();
    const count=Math.max(1,Math.ceil(motionBound/SKIN),Math.ceil(angleBound/MAX_ANGLE));
    const initial=inspectSweep(parts(at(0)),SAMPLE_MARGIN,ignoreIds);
    if(initial.contacts.length)return {accepted:at(0),forwardDistance:0,contacts:initial.contacts,blocked:true,blockedPart:initial.blockedPart,fraction:0};
    let last=0;
    for(let i=1;i<=count;i++) {
      const t=i/count,query=inspectSweep(parts(at(t)),SAMPLE_MARGIN,ignoreIds);
      if(!query.contacts.length){last=t;continue;}
      let lo=last,hi=t;
      for(let j=0;j<24;j++){const m=(lo+hi)/2;if(inspectSweep(parts(at(m)),SAMPLE_MARGIN,ignoreIds).contacts.length)hi=m;else lo=m;}
      // A tiny numerical clearance reserve also lets the next tick retreat from contact.
      const safe=Math.max(0,lo-1e-8/Math.max(motionBound,1));
      return {accepted:at(safe),forwardDistance:arcDistance*safe,contacts:query.contacts,blocked:true,blockedPart:query.blockedPart,fraction:safe};
    }
    return {accepted:at(1),forwardDistance:arcDistance,contacts:[],blocked:false,blockedPart:null,fraction:1};
  }
  function sweepHullAndAttachedGun(from,to,rig=DEFAULT_CONFIG.rig,ignoreIds=['tank']) {
    live();const angle=wrapAngle(to.pose.yaw-from.pose.yaw),d=signedArc(from.pose,to.pose),reach=rigReach(rig);
    const jointYaw=Math.abs(wrapAngle(to.turret.yawRel-from.turret.yawRel)),elevation=Math.abs(to.turret.elevation-from.turret.elevation),recoil=Math.abs(to.turret.recoil-from.turret.recoil);
    const arcEnd=integrateArc(from.pose,d,angle),residual={x:to.pose.x-arcEnd.x,y:to.pose.y-from.pose.y,z:to.pose.z-arcEnd.z};
    const at=t=>{const pose=integrateArc(from.pose,d*t,angle*t);pose.x+=residual.x*t;pose.y+=residual.y*t;pose.z+=residual.z*t;return {pose:groundPose?groundPose(pose):pose,turret:blendTurret(from.turret,to.turret,t)};};
    return sweep(at,Math.abs(d)+(groundPose?29*(Math.abs(d)+Math.abs(angle)*reach):0)+Math.hypot(residual.x,residual.y,residual.z)+(Math.abs(angle)+jointYaw+elevation)*reach+recoil,Math.abs(angle)+jointYaw+elevation,t=>partsAt(t,rig),d,ignoreIds);
  }
  function sweepTurretAtHull(hull,from,to,rig=DEFAULT_CONFIG.rig) {
    live();const yaw=Math.abs(wrapAngle(to.yawRel-from.yawRel)),elevation=Math.abs(to.elevation-from.elevation),recoil=Math.abs(to.recoil-from.recoil);
    return sweep(t=>blendTurret(from,to,t),(yaw+elevation)*rigReach(rig)+recoil,yaw+elevation,t=>partsAt({pose:hull,turret:t},rig).filter(p=>p.part!=='body'),0,['tank']);
  }
  function muzzleContacts(transform,rig=DEFAULT_CONFIG.rig,ignoreIds=['tank']) {
    live();const t=transform.barrelStart?transform:getTankTransform(transform,rig);
    const barrel={kind:'capsule',a:t.barrelStart,b:t.barrelEnd,radius:rig.barrelCapsule.radius,part:'barrel'};
    const tip={kind:'capsule',a:t.position,b:plus(t.position,{x:t.direction.x*.22,y:t.direction.y*.22,z:t.direction.z*.22}),radius:.045,part:'muzzle'};
    return inspect([barrel,tip],SKIN,ignoreIds);
  }
  function muzzleClear(transform,rig=DEFAULT_CONFIG.rig){return muzzleContacts(transform,rig).contacts.length===0;}
  function raycast(from,to,ignoreIds=[]) {
    live();const a=point(from),b=point(to),ignored=new Set(ignoreIds);let result=null;
    for(const collider of [...colliders,...dynamic]) {
      if((!collider.dynamic&&destroyed.has(collider.id))||ignored.has(collider.id))continue;
      const hit=collider.kind==='capsule'?rayCapsule(a,b,collider):(collider.kind==='circle'?rayCylinder(a,b,collider):rayBox(a,b,collider));
      if(!hit||result&&hit.fraction>=result.fraction)continue;
      const position={x:lerp(a.x,b.x,hit.fraction),y:lerp(a.y,b.y,hit.fraction),z:lerp(a.z,b.z,hit.fraction)};
      result={id:collider.id,colliderId:collider.id,fraction:hit.fraction,distance:distance(a,b)*hit.fraction,point:position,position,normal:hit.normal};
    }
    return result;
  }
  function isRouteClear(route,envelope={},ignoreIds=[]) {
    const ignored=[...(envelope.ignoreIds||[]),...ignoreIds];
    live();const points=route.points||route,width=envelope.width??1.8,depth=envelope.depth??3,height=envelope.height??1.5;
    for(let i=1;i<points.length;i++) {
      const a=point(points[i-1]),b=point(points[i]),tangent=Math.atan2(-(b.x-a.x),-(b.z-a.z));
      const explicitYaw=Number.isFinite(points[i-1].yaw)&&Number.isFinite(points[i].yaw);
      const fromYaw=explicitYaw?points[i-1].yaw:tangent,toYaw=explicitYaw?points[i].yaw:tangent,angle=wrapAngle(toYaw-fromYaw);
      const radius=Math.hypot(width/2,depth/2);
      const result=sweep(t=>({pose:{x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),z:lerp(a.z,b.z,t)},yaw:fromYaw+angle*t}),
        distance(a,b)+Math.abs(angle)*radius,Math.abs(angle),t=>[{...makeBox(t.pose,t.yaw,{width,depth,height,offset:{x:0,y:height/2,z:0}}),part:'body'}],0,ignored);
      if(result.blocked)return false;
      // Authored point-only routes turn their full envelope at corners. Live pose routes
      // already supply actual slew-limited yaw, including a stationary in-place turn.
      if(i<points.length-1){
        const c=point(points[i+1]);
        const nextYaw=Number.isFinite(points[i].yaw)&&Number.isFinite(points[i+1].yaw)?points[i].yaw:Math.atan2(-(c.x-b.x),-(c.z-b.z));
        const turn=wrapAngle(nextYaw-toYaw);
        if(sweep(t=>toYaw+turn*t,Math.abs(turn)*radius,Math.abs(turn),yaw=>[{...makeBox(b,yaw,{width,depth,height,offset:{x:0,y:height/2,z:0}}),part:'body'}],0,ignored).blocked)return false;
      }
    }
    return true;
  }
  function setEntities(list=[]) {
    live();
    dynamic=list.filter(e=>e && e.hp!==0 && !(Number.isFinite(e.hp)&&e.hp<0) && !e.destroyed && e.alive!==false && e.kind!=='barrier').flatMap(e=>{
      const p=point(e.pose||e);
      if(!e.id || !Object.values(p).every(Number.isFinite))throw new TypeError('Invalid dynamic entity');
      // Other moving bodies see the SAME articulated proxy as the player's own sweeps.
      // Keep every part's owner ID identical so ignoring self removes the whole compound.
      if(e.kind==='tank'&&e.turret) {
        const tank={pose:{...p,yaw:e.pose?.yaw??e.yaw??0,...(e.pose?.basis?{basis:e.pose.basis}:{})},turret:{yawRel:0,elevation:0,recoil:0,recoilVelocity:0,...e.turret}};
        return partsAt(tank,e.rig||DEFAULT_CONFIG.rig).map(part=>({...part,id:e.id,dynamic:true}));
      }
      const isBox=e.kind==='truck'||e.kind==='tank'||(e.width&&e.depth);
      const height=e.height??(e.kind==='truck'||e.kind==='turret'?2.2:1.5);
      return {id:e.id,kind:isBox?'box':'circle',...p,y:p.y+height/2,yaw:e.pose?.yaw??e.yaw??0,
        width:e.width??(e.kind==='tank'?1.9:1.8),depth:e.depth??(e.kind==='tank'?2.9:3.6),
        radius:e.radius??(e.kind==='turret'?.8:.45),height,dynamic:true};
    });
    dynamicBounds=dynamic.map(conservativeShapeBounds);
  }
  function surfaceAt(pose) {
    live();
    let result={id:null,class:'road',traction:1,drag:1},score=1;
    for(const surface of surfaces)if(surface.polygon.length>=3&&inPolygon(pose,surface.polygon)) {
      const nextScore=surface.traction/Math.sqrt(surface.drag);
      if(nextScore<score){result.id=surface.id;result.class=surface.class;score=nextScore;}
      result.traction=Math.min(result.traction,surface.traction);
      result.drag=Math.max(result.drag,surface.drag);
    }
    return result;
  }
  function hullContacts(tank,rig=DEFAULT_CONFIG.rig){live();return inspect(partsAt(tank,rig).filter(p=>p.part==='body'),SAMPLE_MARGIN+.002,['tank']).contacts;}
  return {hullContacts,sweepHullAndAttachedGun,sweepTurretAtHull,muzzleClear,muzzleContacts,raycast,isRouteClear,setEntities,surfaceAt,
    setDestroyed(ids=[]){live();destroyed=new Set(ids);},dispose(){disposed=true;destroyed.clear();}};
}
