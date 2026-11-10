import {validateMission} from '../validate.js';
import {pathBlocker,trace,lineBlocker,yawTo,wrap} from '../geometry.js';
export function validateCraftedMission(spec){
 if(!spec||typeof spec!=='object'||Array.isArray(spec))return validateMission(spec);
 // The old validator hard-codes legacy ID syntax. Adapt only its local view; never mutate a record or archived registry.
 const result=validateMission({...spec,id:`mission-${String(spec.index).padStart(3,'0')}`});
 if(!result.valid)return result;
 const errors=[...result.errors];
 if(!/^crafted20-\d{3}$/.test(spec.id))errors.push('invalid crafted20 ID');
 if(spec.design?.proposedMechanics?.length)errors.push('unimplemented mechanics cannot ship as working content');
 for(const alt of spec.design?.alternatives||[]){
  const dead=new Set(alt.destroyedIds||[]);
  const colliders=[...spec.geometry.filter(g=>!dead.has(g.id)),...spec.entities.filter(e=>e.kind==='turret'&&!dead.has(e.id)).map(e=>({id:e.id,kind:'circle',x:e.pose.x,z:e.pose.z,radius:1.1,height:2.2}))];
  const poses=trace(alt.points.map(([x,z])=>({x,z})),spec.spawn.yaw);
  const hit=pathBlocker(poses,colliders,spec.bounds);if(hit)errors.push(`alternative ${alt.id} hits ${hit.id} at ${hit.x},${hit.z}`);
  if(alt.fireTargetId){
   const entity=spec.entities.find(e=>e.id===alt.fireTargetId),barrier=spec.geometry.find(g=>g.id===alt.fireTargetId);
   const e=entity||(barrier?{...barrier,pose:barrier}:null),end=poses.at(-1);
   if(!e)errors.push(`alternative ${alt.id} target missing`);
   else {
    const range=Math.hypot(end.x-e.pose.x,end.z-e.pose.z);
    if(range<4||range>38)errors.push(`alternative ${alt.id} firing range ${range}`);
    const los=lineBlocker(end,e.pose,colliders,[e.id]);if(los)errors.push(`alternative ${alt.id} shot blocked by ${los}`);
    if(e.shieldArc>0&&Math.abs(wrap(yawTo(e.pose,end)-e.pose.yaw))<=e.shieldArc/2+.05)errors.push(`alternative ${alt.id} is inside shield`);
   }
  }
 }
 for(const pose of spec.design?.safePlanningPoses||[]){
  for(const e of spec.entities.filter(e=>e.kind==='turret'&&!e.activationObjectiveId)){
   if(Math.hypot(pose.x-e.pose.x,pose.z-e.pose.z)<=(e.range??30)&&!lineBlocker(e.pose,pose,spec.geometry))errors.push(`planning position ${pose.x},${pose.z} exposed to ${e.id}`);
  }
 }
 return {...result,errors,valid:errors.length===0,audit:{...result.audit,alternateRoutes:spec.design?.alternatives?.length||0}};
}
