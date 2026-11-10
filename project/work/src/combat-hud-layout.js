import {getTankTransform,hullVector,rotateYaw} from './tank-controller.js';
import {INTERCEPTOR_COLLISION_RIG} from './interceptor.js';
const finiteRect = b => b && ['left','top','width','height'].every(k=>Number.isFinite(b[k])) && b.width>0 && b.height>0;
const intersect = (a,b) => Math.max(0,Math.min(a.left+a.width,b.left+b.width)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.top+a.height,b.top+b.height)-Math.max(a.top,b.top));
export function combatHudOverlap(panel,actors,viewport){return (actors||[]).filter(b=>finiteRect(b)&&intersect(b,viewport)>0).reduce((sum,b)=>sum+intersect(panel,{left:b.left-12,top:b.top-12,width:b.width+24,height:b.height+24}),0);}
const add=(a,b)=>({x:a.x+b.x,y:(a.y||0)+b.y,z:a.z+b.z});
function boxPoints(pose,box,pivot={x:0,y:0,z:0},yaw=0){const points=[],o=box.offset||{x:0,y:box.height/2,z:0};for(let i=0;i<8;i++)points.push(add(pose,hullVector(add(pivot,rotateYaw({x:o.x+(i&1?1:-1)*box.width/2,y:o.y+(i&2?1:-1)*box.height/2,z:o.z+(i&4?1:-1)*box.depth/2},yaw)),pose)));return points;}
function tankPoints(tank,rig){const m=getTankTransform(tank,rig),r=(rig.barrelCapsule?.radius||0)+.12,points=[...boxPoints(tank.pose,rig.hullProxy),...boxPoints(tank.pose,rig.turretProxy,rig.turretPivot,tank.turret.yawRel)];for(const p of[m.barrelStart,m.barrelEnd])for(let i=0;i<8;i++)points.push({x:p.x+(i&1?1:-1)*r,y:p.y+(i&2?1:-1)*r,z:p.z+(i&4?1:-1)*r});return points;}
/** Small conservative presentation envelopes. No mesh traversal, state writes or
 * camera construction. project uses the owner's already updated render camera. */
export function projectCombatHudActors({state,renderTank,playerRig,project,viewport}={}){
 if(state?.mission?.eightNpcReconstruction!==true||!finiteRect(viewport)||typeof project!=='function')return[];
 const records=[];if(renderTank&&playerRig)records.push({id:'tank',points:tankPoints(renderTank,playerRig)});
 for(const e of Object.values(state.entities||{})){
  if(!e.alive||!e.pose||!['turret','drone','truck'].includes(e.kind))continue;
  let points;if(e.vehicle==='pz3')points=tankPoints({pose:e.pose,turret:{yawRel:(e.aimYaw??e.pose.yaw)-e.pose.yaw,elevation:e.aimElevation||0,recoil:0}},INTERCEPTOR_COLLISION_RIG);
  else points=boxPoints(e.pose,e.kind==='truck'?{width:1.82,depth:3.62,height:2.18}:{width:2.4,depth:2.4,height:2.3});
  records.push({id:e.id,points});
 }
 return records.flatMap(({id,points})=>{const screen=points.map(project);if(screen.some(p=>!p||p.inFront===false||!Number.isFinite(p.x)||!Number.isFinite(p.y)))return[];const left=Math.min(...screen.map(p=>p.x))-8,top=Math.min(...screen.map(p=>p.y))-8,right=Math.max(...screen.map(p=>p.x))+8,bottom=Math.max(...screen.map(p=>p.y))+8;const rect={id,left,top,width:right-left,height:bottom-top};return intersect(rect,viewport)>0?[rect]:[];});
}
/** Keep a clear slot. Move only for a substantial improvement; never conceal
 * content if the screen is crowded. All returned coordinates are CSS pixels. */
export function chooseCombatHudPlacement({viewport,panel,current,actors=[],blockers=[],safe={left:14,top:12,right:14,bottom:14}}){
 if(!finiteRect(viewport)||!finiteRect(panel))return null;
 const left=viewport.left+safe.left,right=viewport.left+viewport.width-safe.right-panel.width,top=viewport.top+safe.top,bottom=viewport.top+viewport.height-safe.bottom-panel.height;
 const fixed=blockers.filter(finiteRect),fits=b=>b.left>=left&&b.top>=top&&b.left+b.width<=viewport.left+viewport.width-safe.right&&b.top+b.height<=viewport.top+viewport.height-safe.bottom&&!fixed.some(f=>intersect(b,f)>0);
 const area=b=>combatHudOverlap(b,actors,viewport),at=(x,y)=>({left:x,top:y,width:panel.width,height:panel.height});
 const previous=at(current?.left??panel.left,current?.top??panel.top),before=area(previous);
 if(fits(previous)&&before===0)return{...previous,reason:'clear',overlap:0};
 const nav=fixed[0],governor=fixed.find(b=>b.top>viewport.top+viewport.height/2&&b.left<viewport.left+viewport.width/2);
 const candidates=[at(viewport.left+viewport.width/2-15,top),at(left,(nav?.top??top)+(nav?.height??44)+12),at(right,top),at(right,bottom),at(governor?governor.left+governor.width+12:left+176,bottom),at(nav?nav.left+nav.width+12:left+222,top)].filter(fits).map(b=>({...b,overlap:area(b)})).sort((a,b)=>a.overlap-b.overlap);
 const best=candidates[0];if(!best)return{...previous,reason:'no-fitting-slot',overlap:before};
 if(fits(previous)&&before>0&&best.overlap>0&&best.overlap>=before*.75)return{...previous,reason:'no-clear-slot',overlap:before};
 return{...best,reason:best.overlap===0?'clear-slot':'no-clear-slot',forced:!fits(previous)};
}
