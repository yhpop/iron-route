// Data constructors only. No random source, layout templates, coordinate transforms or runtime generation.
import {box,rectangle,trace,yawTo} from '../geometry.js';
export const p=(x,z)=>({x,z});
export const block=(id,x,z,w,d,h=4)=>box(id,x,z,w,d,h);
export const barrier=(id,x,z,w,d=1.2)=>box(id,x,z,w,d,2.3,{destructible:true,hp:90});
export const zone=(id,x,z,w=9,d=9)=>({id,polygon:rectangle(x,z,w,d)});
export const rubble=(id,x,z,w,d)=>({id,class:'rubble',traction:.74,drag:1.25,polygon:rectangle(x,z,w,d)});
export const gun=(id,x,z,yaw=Math.PI,extra={})=>({id,kind:'turret',pose:{x,z,yaw},hp:90,range:26,chargeTime:1.8,reload:3.2,damage:9,shieldArc:0,...extra});
export const truck=(id,x,z,routeId,activationObjectiveId,extra={})=>({id,kind:'truck',pose:{x,z,yaw:0},hp:220,speed:1.5,escortRange:24,routeId,activationObjectiveId,...extra});
export const route=(id,points,width=8)=>({id,points:points.map(([x,z])=>p(x,z)),width});
export const obj=(id,type,targetIds=[],requires=[],extra={})=>({id,type,targetIds,requires,nextIds:[],...extra});
export const landmark=(geometryId,assetKey,role)=>({geometryId,assetKey,role});
export function authored(spec){
 const objectives=spec.objectives.map(o=>({...o,nextIds:spec.objectives.filter(n=>n.requires.includes(o.id)).map(n=>n.id)}));
 let last={...spec.spawn};
 const phases=spec.steps.map(s=>{
  const points=[last,...(s.via||[]).map(([x,z])=>p(x,z))];
  const tankWaypoints=trace(points,last.yaw);last=tankWaypoints.at(-1);
  const firingPoses=(s.fire||[]).map(targetId=>{
   const t=spec.entities.find(e=>e.id===targetId)?.pose||spec.geometry.find(e=>e.id===targetId);
   return {targetId,x:last.x,z:last.z,turretYaw:yawTo(last,t)};
  });
  return {objectiveId:s.objectiveId,tankWaypoints,...(firingPoses.length?{firingPoses}:{}),...(s.convoys?{convoyRouteIds:s.convoys}:{})};
 });
 const {steps,landmarks,roads,water=[],drains=[],markings,aprons,...rest}=spec;
 return {schema:1,seed:null,...rest,chapter:Math.ceil(spec.index/5),objectives,witness:{phases},
  surfaces:spec.surfaces||[],routes:spec.routes||[],
  design:{...spec.design,proposedMechanics:[],evidence:{clearance:'cpu-check-required',combatBalance:'unverified',pacing:'design-target-only',mobileReadability:'unverified',humanPlaythrough:'unverified'}},
  sceneDressing:{schema:1,districtId:spec.districtId,ground:{material:'concrete'},roads:roads.map(r=>({material:'asphalt',curb:false,...r})),landmarks,props:[],water,drains,...(markings?{markings}:{}),...(aprons?{aprons}:{}),
   visualNotes:['Keep declared roads unobstructed. Geometry is the collision source of truth.','Building shells scale to their referenced collider; details remain inside its footprint.','No cosmetic geometry implies a new gameplay mechanic.']}};
}
