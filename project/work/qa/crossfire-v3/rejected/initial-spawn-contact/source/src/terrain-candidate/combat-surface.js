import {sampleHeightfield} from './heightfield.js';
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const at=(a,d,t)=>({x:a.x+d.x*t,y:a.y+d.y*t,z:a.z+d.z*t});
const inside=(f,p)=>p.x>=f.bounds.minX&&p.x<=f.bounds.maxX&&p.z>=f.bounds.minZ&&p.z<=f.bounds.maxZ;
function triangle(a,d,p,q,r){const e=sub(q,p),v=sub(r,p),h=cross(d,v),det=dot(e,h);if(Math.abs(det)<1e-12)return null;const s=sub(a,p),u=dot(s,h)/det;if(u< -1e-9||u>1+1e-9)return null;const k=cross(s,e),w=dot(d,k)/det;if(w< -1e-9||u+w>1+1e-9)return null;const t=dot(v,k)/det;return t>=-1e-9&&t<=1+1e-9?Math.max(0,Math.min(1,t)):null;}
/** Exact segment / rendered triangle hit. Grid crossing intervals avoid testing every face. */
export function raycastTerrain(f,from,to){
 if(![from.x,from.y,from.z,to.x,to.y,to.z].every(Number.isFinite))throw new TypeError('Finite segment required');
 const d=sub(to,from),b=f.bounds;let lo=0,hi=1;
 for(const [axis,min,max] of [['x',b.minX,b.maxX],['z',b.minZ,b.maxZ]]){if(Math.abs(d[axis])<1e-12){if(from[axis]<min||from[axis]>max)return null;}else{let a=(min-from[axis])/d[axis],c=(max-from[axis])/d[axis];if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(lo>hi)return null;}}
 const start=at(from,d,lo),startGround=sampleHeightfield(f,Math.max(b.minX,Math.min(b.maxX,start.x)),Math.max(b.minZ,Math.min(b.maxZ,start.z)));
 const result=t=>{const point=at(from,d,t),s=sampleHeightfield(f,Math.max(b.minX,Math.min(b.maxX,point.x)),Math.max(b.minZ,Math.min(b.maxZ,point.z)));return {id:'terrain',colliderId:'terrain',fraction:t,distance:Math.hypot(d.x,d.y,d.z)*t,point,position:point,normal:s.normal};};
 if(start.y<=startGround.height+1e-9)return result(lo);
 const cuts=[lo,hi];for(const [axis,min,step,n] of [['x',b.minX,f.dx,f.columns],['z',b.minZ,f.dz,f.rows]])if(Math.abs(d[axis])>1e-12){const a=from[axis]+d[axis]*lo,c=from[axis]+d[axis]*hi;for(let k=Math.max(1,Math.ceil((Math.min(a,c)-min)/step));k<=Math.min(n-1,Math.floor((Math.max(a,c)-min)/step));k++){const t=(min+k*step-from[axis])/d[axis];if(t>lo&&t<hi)cuts.push(t);}}
 cuts.sort((a,b)=>a-b);const cells=new Set();for(let n=0;n<cuts.length-1;n++){const p=at(from,d,(cuts[n]+cuts[n+1])/2),i=Math.min(f.columns-1,Math.max(0,Math.floor((p.x-b.minX)/f.dx))),j=Math.min(f.rows-1,Math.max(0,Math.floor((p.z-b.minZ)/f.dz)));cells.add(`${i},${j}`);}
 let best=null;const vertex=(i,j)=>({x:b.minX+i*f.dx,y:f.heights[j*(f.columns+1)+i],z:b.minZ+j*f.dz});
 for(const cell of cells){const [i,j]=cell.split(',').map(Number),a=vertex(i,j),c=vertex(i+1,j),e=vertex(i,j+1),g=vertex(i+1,j+1);for(const tri of [[a,c,e],[g,e,c]]){const t=triangle(from,d,...tri);if(t!==null&&t>=lo-1e-9&&t<=hi+1e-9&&(best===null||t<best))best=t;}}
 return best===null?null:result(best);
}
export function attachTerrainQueries(base,field){return {...base,terrain:field,
 raycast(from,to,ignore){const a=base.raycast?.(from,to,ignore),b=raycastTerrain(field,from,to);return a&&(!b||a.fraction<=b.fraction)?a:b;},
 projectileInBounds:p=>inside(field,p)&&p.y>=sampleHeightfield(field,p.x,p.z).height-.02,
 muzzleContacts(t,rig,ignoreIds){
  const baseResult=base.muzzleContacts?.(t,rig,ignoreIds);if(baseResult?.contacts.length)return baseResult;
  if(!baseResult&&base.muzzleClear&&!base.muzzleClear(t,rig))return {contacts:['obstacle'],blockedPart:'barrel'};
  const radius=rig?.barrelCapsule?.radius??.151;
  for(const [a,b,r,part] of [[t.barrelStart,t.barrelEnd,radius,'barrel'],[t.position,at(t.position,t.direction,.22),.045,'muzzle']]){
   if(!inside(field,a)||!inside(field,b))return {contacts:['terrain-boundary'],blockedPart:part};
   const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/Math.min(field.dx,field.dz)*4));
   for(let i=0;i<=n;i++){const p=at(a,sub(b,a),i/n);if(p.y-r<=sampleHeightfield(field,p.x,p.z).height+.015)return {contacts:['terrain'],blockedPart:part};}
  }
  return {contacts:[],blockedPart:null};
 },
 muzzleClear(t,rig){return this.muzzleContacts(t,rig).contacts.length===0;}
};}
