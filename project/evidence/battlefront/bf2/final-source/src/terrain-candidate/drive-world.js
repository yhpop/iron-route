import {sampleGroundContact,terrainSurfaceAt} from './heightfield.js';

/** Isolated terrain-drive candidate: no shooting or campaign collision semantics are claimed. */
export function createTerrainDriveWorld(field){return {surfaceAt:({x,z})=>terrainSurfaceAt(field,x,z),muzzleClear:()=>false,sweepHullAndAttachedGun(from,to){const {x,z,yaw}=to.pose,b=field.bounds;
if(x<b.minX+3||x>b.maxX-3||z<b.minZ+3||z>b.maxZ-3)return {accepted:from,forwardDistance:0,blocked:true,contacts:['terrain-boundary']};
const contact=sampleGroundContact(field,x,z,yaw),angle=((yaw-from.pose.yaw+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI,mid=from.pose.yaw+angle/2,projected=-(x-from.pose.x)*Math.sin(mid)-(z-from.pose.z)*Math.cos(mid),d=Math.abs(angle)<1e-8?projected:projected/(Math.sin(angle/2)/(angle/2));
return {accepted:{...to,pose:{...to.pose,y:contact.height}},forwardDistance:d,blocked:false,contacts:[]};
}};
}
