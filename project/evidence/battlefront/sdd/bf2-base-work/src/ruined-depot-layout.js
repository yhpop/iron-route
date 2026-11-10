import {RUINED_DEPOT_COLLISION} from './ruined-depot-collision-data.js';
// Module transforms are shared verbatim by view, movement and exact shell rays.
// The left L is deliberately a west-route loading bay, not forced onto the ridge.
export const RUINED_DEPOT_LAYOUT=Object.freeze([
 Object.freeze({id:'ruin-west-loading',moduleId:'broken-corner',x:-30,y:0,z:18,yaw:Math.PI}),
 Object.freeze({id:'ruin-ridge-workshop',moduleId:'workshop',x:0,y:3.2,z:2,yaw:Math.PI}),
 Object.freeze({id:'ruin-east-window',moduleId:'window-wall',x:19.5,y:0,z:0,yaw:Math.PI/2})
]);
export const RUINED_DEPOT_FOUNDATIONS=Object.freeze([
 Object.freeze({id:'ridge-workshop-pad',minX:-5,maxX:5,minZ:-4.5,maxZ:8.5,height:3.2,blend:4})
]);
export function ruinedDepotPoint(p,instance){const c=Math.cos(instance.yaw),s=Math.sin(instance.yaw);return {x:instance.x+c*p[0]+s*p[2],y:instance.y+p[1],z:instance.z-s*p[0]+c*p[2]};}
/** Conservative inscribed merged wall spans for movement, never projectile rays.
 * Thin rebar, jagged crowns and tiny fracture mass are intentionally omitted. */
export function ruinedDepotColliders(instances=RUINED_DEPOT_LAYOUT){return instances.flatMap(i=>{
 const module=RUINED_DEPOT_COLLISION.modules[i.moduleId];if(!module)throw new Error(`Unknown ruin module ${i.moduleId}`);
 return module.boxes.map(b=>({...b,...ruinedDepotPoint([b.x,b.y,b.z],i),id:`${i.id}:${b.id}`,ruinInstanceId:i.id,kind:'box',yaw:i.yaw+(b.yaw||0)}));
});}
