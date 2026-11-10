/** Sweep-only conservative rejection, NOT collision geometry or a replacement skin.
 * Bounds deliberately over-enclose the oracle's SAT/distance threshold regions.
 * Invalid/oversized numeric records fail open. See evidence/performance/kernel/PROOF.md.
 */
const LIMIT=2**20, RESERVE=2**-16;
const bounded=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=LIMIT;
const dimension=v=>bounded(v)&&v>=0;
const position=p=>p&&bounded(p.x)&&bounded(p.y)&&bounded(p.z);
// Validate the actual floating matrices, rather than assuming libm trig is exact
// or yaw+PI/2 remains distinct for very large angles. The 1.5 bound has margin.
function usableRotation(yaw){
 if(!bounded(yaw))return false;
 const c=Math.cos(yaw),s=Math.sin(yaw),d=Math.cos(yaw+Math.PI/2),t=Math.sin(yaw+Math.PI/2);
 const C=Math.cos(-yaw),S=Math.sin(-yaw);
 if(![c,s,d,t,C,S].every(v=>Number.isFinite(v)&&Math.abs(v)<=1))return false;
 const det=Math.abs(s*d-c*t),localDet=C*C+S*S;
 if(c*c+s*s>1.01||d*d+t*t>1.01||localDet>1.01)return false;
 return det>=.99&&localDet>=.99&&Math.max(Math.abs(t)+Math.abs(s),Math.abs(d)+Math.abs(c))<=1.48*det&&(Math.abs(C)+Math.abs(S))<=1.48*localDet;
}
/** Private numeric primitive -> loose AABB or null (mandatory original scan).
 * Box horizontal half-extent is width+depth, not the ordinary rotated extent;
 * this encloses SAT threshold contacts without a threshold-only pad assumption.
 * Capsule/cylinder radii are doubled to cover inverse local-axis conversion.
 */
export function conservativeShapeBounds(shape){
 if(!shape||typeof shape!=='object')return null;
 let minX,maxX,minY,maxY,minZ,maxZ;
 if(shape.kind==='capsule'){
  if(!position(shape.a)||!position(shape.b)||!dimension(shape.radius))return null;
  const r=2*shape.radius;
  minX=Math.min(shape.a.x,shape.b.x)-r;maxX=Math.max(shape.a.x,shape.b.x)+r;
  minY=Math.min(shape.a.y,shape.b.y)-r;maxY=Math.max(shape.a.y,shape.b.y)+r;
  minZ=Math.min(shape.a.z,shape.b.z)-r;maxZ=Math.max(shape.a.z,shape.b.z)+r;
 }else{
  if(!position(shape)||!dimension(shape.height))return null;
  let horizontal;
  if(shape.kind==='box'){
   if(!dimension(shape.width)||!dimension(shape.depth)||!usableRotation(shape.yaw))return null;
   horizontal=shape.width+shape.depth;
  }else if(shape.kind==='circle'){
   if(!dimension(shape.radius))return null;
   horizontal=2*shape.radius;
  }else return null;
  minX=shape.x-horizontal;maxX=shape.x+horizontal;minZ=shape.z-horizontal;maxZ=shape.z+horizontal;
  minY=shape.y-shape.height/2;maxY=shape.y+shape.height/2;
 }
 return {minX:minX-RESERVE,maxX:maxX+RESERVE,minY:minY-RESERVE,maxY:maxY+RESERVE,minZ:minZ-RESERVE,maxZ:maxZ+RESERVE};
}
/** false proves the pair cannot satisfy original shapeGap < threshold-EPS.
 * true includes all uncertainty; only unchanged narrowphase may accept contact.
 */
export function boundsMayContact(a,b,threshold){
 if(!a||!b||!bounded(threshold)||threshold<0||threshold>1)return true;
 const pad=2*threshold;
 return !(a.minX>b.maxX+pad||b.minX>a.maxX+pad||a.minY>b.maxY+pad||b.minY>a.maxY+pad||a.minZ>b.maxZ+pad||b.minZ>a.maxZ+pad);
}
