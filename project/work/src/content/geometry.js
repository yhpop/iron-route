// Content-side conservative planar clearance. No renderer/physics dependency.
export const ENVELOPE = Object.freeze({tankWidth:1.9,tankDepth:2.82,gunReach:3.15,gunRadius:0.14,skin:0.06,truckWidth:2.2,truckDepth:4});
export const point = (x,z) => ({x,z});
export const rectangle = (x,z,width,depth) => [point(x-width/2,z-depth/2),point(x+width/2,z-depth/2),point(x+width/2,z+depth/2),point(x-width/2,z+depth/2)];
export function box(id,x,z,width,depth,height=2.8,extra={}) {return {id,kind:'box',x,z,yaw:0,width,depth,height,...extra};}
export function yawTo(a,b) {return Math.atan2(-(b.x-a.x),-(b.z-a.z));}
export function wrap(a) {return Math.atan2(Math.sin(a),Math.cos(a));}
export function trace(points,initialYaw=0) {
  if (!points.length) return [];
  const out=[{...points[0],yaw:initialYaw}]; let yaw=initialYaw;
  for(let i=1;i<points.length;i++) {
    if(Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z)<1e-8)continue;
    const nextYaw=yawTo(points[i-1],points[i]);
    if(Math.abs(wrap(nextYaw-yaw))>1e-6)out.push({...points[i-1],yaw:nextYaw});
    out.push({...points[i],yaw:nextYaw}); yaw=nextYaw;
  }
  return out;
}
export function inside(p,poly) {
  let yes=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const a=poly[i],b=poly[j];
    if(((a.z>p.z)!==(b.z>p.z))&&(p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x))yes=!yes;
  } return yes;
}
function corners(p,w,d) {
  const c=Math.cos(p.yaw||0),s=Math.sin(p.yaw||0);
  return [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([x,z])=>({x:p.x+c*x+s*z,z:p.z-s*x+c*z}));
}
function polygonsOverlap(a,b) {
  for(const poly of [a,b])for(let i=0;i<poly.length;i++){
    const p=poly[i],q=poly[(i+1)%poly.length],axis={x:-(q.z-p.z),z:q.x-p.x};
    const av=a.map(v=>v.x*axis.x+v.z*axis.z),bv=b.map(v=>v.x*axis.x+v.z*axis.z);
    if(Math.max(...av)<Math.min(...bv)||Math.max(...bv)<Math.min(...av))return false;
  }return true;
}
function pointBoxDistance(p,c) {
  const co=Math.cos(c.yaw||0),si=Math.sin(c.yaw||0),dx=p.x-c.x,dz=p.z-c.z;
  const x=dx*co-dz*si,z=dx*si+dz*co;
  return Math.hypot(Math.max(0,Math.abs(x)-c.width/2),Math.max(0,Math.abs(z)-c.depth/2));
}
function shapeDistance(p,c){return c.kind==='circle'?Math.max(0,Math.hypot(p.x-c.x,p.z-c.z)-c.radius):pointBoxDistance(p,c);}
function hullHits(p,w,d,c){
  if(c.kind==='box'&&Math.abs(Math.sin((c.yaw||0)*2))<1e-8&&Math.abs(Math.sin((p.yaw||0)*2))<1e-8){const swap=Math.abs(Math.sin(p.yaw||0))>0.5,cswap=Math.abs(Math.sin(c.yaw||0))>0.5;return Math.abs(p.x-c.x)<((swap?d:w)+(cswap?c.depth:c.width))/2&&Math.abs(p.z-c.z)<((swap?w:d)+(cswap?c.width:c.depth))/2;}
  if(c.kind==='circle') {
    const proxy={...p,width:w,depth:d};return pointBoxDistance(c,proxy)<=c.radius;
  }return polygonsOverlap(corners(p,w,d),corners(c,c.width,c.depth));
}
function segmentHits(a,b,c,radius=0){
 if(c.kind==='circle'){const dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz,t=den?Math.max(0,Math.min(1,((c.x-a.x)*dx+(c.z-a.z)*dz)/den)):0;return Math.hypot(a.x+t*dx-c.x,a.z+t*dz-c.z)<=c.radius+radius;}
 const co=Math.cos(c.yaw||0),si=Math.sin(c.yaw||0),ax=(a.x-c.x)*co-(a.z-c.z)*si,az=(a.x-c.x)*si+(a.z-c.z)*co,bx=(b.x-c.x)*co-(b.z-c.z)*si,bz=(b.x-c.x)*si+(b.z-c.z)*co;
 let lo=0,hi=1;
 for(const [v,d,h] of [[ax,bx-ax,c.width/2+radius],[az,bz-az,c.depth/2+radius]]){if(Math.abs(d)<1e-10){if(Math.abs(v)>h)return false;continue;}let l=(-h-v)/d,r=(h-v)/d;if(l>r)[l,r]=[r,l];lo=Math.max(lo,l);hi=Math.min(hi,r);if(lo>hi)return false;}return true;
}
export function poseBlocker(p,colliders,bounds,{truck=false,turretYaw=p.yaw}={}) {
 const e=ENVELOPE,w=(truck?e.truckWidth:e.tankWidth)+e.skin*2,d=(truck?e.truckDepth:e.tankDepth)+e.skin*2;
 for(const corner of corners(p,w,d))if(corner.x<bounds.minX||corner.x>bounds.maxX||corner.z<bounds.minZ||corner.z>bounds.maxZ)return 'bounds';
 for(const c of colliders)if(hullHits(p,w,d,c))return c.id;
 if(!truck){
  const tip={x:p.x-Math.sin(turretYaw)*e.gunReach,z:p.z-Math.cos(turretYaw)*e.gunReach};
  for(const q of [p,tip])if(q.x<bounds.minX+e.gunRadius||q.x>bounds.maxX-e.gunRadius||q.z<bounds.minZ+e.gunRadius||q.z>bounds.maxZ-e.gunRadius)return 'bounds';
  for(const c of colliders)if(c.height>=1.1&&segmentHits(p,tip,c,e.gunRadius+e.skin))return c.id;
 }return null;
}
export function pathBlocker(poses,colliders,bounds,options={}) {
  for(let i=0;i<poses.length;i++){
    const a=i?poses[i-1]:poses[i],b=poses[i],distance=Math.hypot(b.x-a.x,b.z-a.z),angle=wrap(b.yaw-a.yaw);
    const near=colliders.filter(c=>{const r=c.kind==='circle'?c.radius:Math.hypot(c.width,c.depth)/2;return c.x+r+3.5>=Math.min(a.x,b.x)&&c.x-r-3.5<=Math.max(a.x,b.x)&&c.z+r+3.5>=Math.min(a.z,b.z)&&c.z-r-3.5<=Math.max(a.z,b.z);});
    const steps=Math.max(1,Math.ceil(distance/0.2),Math.ceil(Math.abs(angle)/(Math.PI/90)));
    for(let s=0;s<=steps;s++){
      const t=s/steps,p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,yaw:a.yaw+angle*t};
      const hit=poseBlocker(p,near,bounds,options);if(hit)return {id:hit,segment:i,x:p.x,z:p.z};
    }
  }return null;
}
export function lineBlocker(a,b,colliders,ignoreIds=[]){
 for(const c of colliders)if(!ignoreIds.includes(c.id)&&c.height>=1.1&&segmentHits(a,b,c,0.06))return c.id;return null;
}
