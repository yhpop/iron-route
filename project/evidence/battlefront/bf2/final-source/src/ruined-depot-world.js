import {createTerrainCombatWorld} from './terrain-candidate/combat-world.js';
import {RUINED_DEPOT_COLLISION} from './ruined-depot-collision-data.js';
import {RUINED_DEPOT_LAYOUT,ruinedDepotPoint} from './ruined-depot-layout.js';
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
function intersectsBounds(a,d,b){let lo=0,hi=1;for(const k of ['x','y','z']){if(Math.abs(d[k])<1e-12){if(a[k]<b.min[k]-1e-9||a[k]>b.max[k]+1e-9)return false;}else{let n=(b.min[k]-a[k])/d[k],f=(b.max[k]-a[k])/d[k];if(n>f)[n,f]=[f,n];lo=Math.max(lo,n);hi=Math.min(hi,f);if(lo>hi+1e-9)return false;}}return true;}
function triangleHit(a,d,tri){const [p,q,r]=tri,e=sub(q,p),v=sub(r,p),h=cross(d,v),det=dot(e,h);if(Math.abs(det)<1e-12)return null;const s=sub(a,p),u=dot(s,h)/det;if(u< -1e-9||u>1+1e-9)return null;const k=cross(s,e),w=dot(d,k)/det;if(w< -1e-9||u+w>1+1e-9)return null;const t=dot(v,k)/det;if(t< -1e-9||t>1+1e-9)return null;const normal=cross(e,v),length=Math.hypot(normal.x,normal.y,normal.z);if(length<1e-12)return null;const sign=dot(normal,d)>0?-1:1;return {fraction:Math.max(0,Math.min(1,t)),normal:{x:sign*normal.x/length,y:sign*normal.y/length,z:sign*normal.z/length}};}
/** New-mission composition only. Movement remains original production queries.
 * Approximate NEW proxy IDs are ignored only by the base projectile query. */
export function createRuinedDepotWorld(spec,field){
 const base=createTerrainCombatWorld(spec,field),proxyIds=(spec.geometry||[]).filter(c=>c.ruinInstanceId).map(c=>c.id),instances=(spec.ruinedDepotLayout||RUINED_DEPOT_LAYOUT).map(i=>{
  const module=RUINED_DEPOT_COLLISION.modules[i.moduleId];if(!module)throw new Error(`Unknown ruin module ${i.moduleId}`);
  const triangles=module.triangles.map(t=>t.map(p=>ruinedDepotPoint(p,i))),points=triangles.flat(),bounds={min:{},max:{}};for(const k of ['x','y','z']){bounds.min[k]=Math.min(...points.map(p=>p[k]));bounds.max[k]=Math.max(...points.map(p=>p[k]));}return {id:i.id,triangles,bounds};
 });let disposed=false,destroyed=new Set();
 return {...base,diagnostics:{exactTriangles:instances.reduce((s,i)=>s+i.triangles.length,0),instances:instances.length,movementSpanCount:proxyIds.length,instanceAABBBroadphase:true},
  raycast(from,to,ignoreIds=[]){
   if(disposed)throw new Error('Ruined depot world is disposed');if(![from.x,from.y,from.z,to.x,to.y,to.z].every(Number.isFinite))throw new TypeError('Finite segment required');
   const ignored=new Set(ignoreIds),d=sub(to,from),length=Math.hypot(d.x,d.y,d.z);let best=base.raycast(from,to,[...ignoreIds,...proxyIds]);
   for(const instance of instances){if(ignored.has(instance.id)||destroyed.has(instance.id)||!intersectsBounds(from,d,instance.bounds))continue;for(let triangleIndex=0;triangleIndex<instance.triangles.length;triangleIndex++){
    const hit=triangleHit(from,d,instance.triangles[triangleIndex]);if(!hit||best&&hit.fraction>=best.fraction-1e-12)continue;
    const position={x:from.x+d.x*hit.fraction,y:from.y+d.y*hit.fraction,z:from.z+d.z*hit.fraction};best={...hit,id:instance.id,colliderId:instance.id,triangleIndex,fraction:hit.fraction,distance:length*hit.fraction,point:position,position};
   }}return best;
  },setDestroyed(ids=[]){if(disposed)throw new Error('Ruined depot world is disposed');destroyed=new Set(ids);const ownerSpans=(spec.geometry||[]).filter(c=>destroyed.has(c.ruinInstanceId)).map(c=>c.id);base.setDestroyed([...ids,...ownerSpans]);},
  dispose(){if(disposed)return;disposed=true;base.dispose();destroyed.clear();instances.length=0;}
 };
}
