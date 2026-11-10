import {playerRig} from '../player-config.js';
import {createWorld} from '../campaign-world.js';
import {sampleGroundContact,terrainSurfaceAt} from './heightfield.js';
import {attachTerrainQueries} from './combat-surface.js';
import {getTankTransform,hullVector} from '../tank-controller.js';
/** Isolated authored gentle-terrain adapter. Tilted body collision uses conservative AABBs,
 * not exact 6DOF rigid-body physics; unsupported map edge remains blocked. */
export function createTerrainCombatWorld(spec,field){
 const groundPose=p=>{const hull=playerRig(spec).hullProxy,c=spec.playerVehicle?sampleGroundContact(field,p.x,p.z,p.yaw,{halfWidth:hull.width/2,halfLength:hull.depth/2}):sampleGroundContact(field,p.x,p.z,p.yaw);return {...p,y:c.height+.008,basis:c.basis};};
 let destroyed=new Set();
 const base=createWorld(spec,{groundPose}),world=attachTerrainQueries(base,field);
 return {...world,groundPose,
  setDestroyed(ids=[]){destroyed=new Set(ids);base.setDestroyed(ids);},
  // Travel-only convenience: lift the real barrel before a low crushable enters
  // its reach. Does not remove colliders, deal damage, rotate yaw or bypass sweeps.
  travelElevationFloor(pose,speed){
   if(Math.abs(speed)<.1)return null;
   for(const c of spec.geometry||[]){
    if(destroyed.has(c.id)||!c.destructible||!c.crush||!(c.height<=.8)||!(c.crush.seconds>0))continue;
    const local=hullVector({x:c.x-pose.x,y:(c.y||0)-pose.y,z:c.z-pose.z},pose,true),ahead=-local.z*Math.sign(speed),radius=Math.hypot(c.width||0,c.depth||0)/2;
    if(ahead>=-1.5&&ahead<=5+radius&&Math.abs(local.x)<=1.3+radius)return .18;
   }
   return null;
  },surfaceAt:p=>terrainSurfaceAt(field,p.x,p.z),
  sweepHullAndAttachedGun(from,to,rig,ignoreIds){
   const b=field.bounds,p=to.pose;
   if(p.x<b.minX+3||p.x>b.maxX-3||p.z<b.minZ+3||p.z>b.maxZ-3)return {accepted:from,forwardDistance:0,blocked:true,contacts:['terrain-boundary']};
   const result=base.sweepHullAndAttachedGun(from,{...to,pose:groundPose(to.pose)},rig,ignoreIds);
   const clearance=world.muzzleContacts(getTankTransform(result.accepted,rig),rig,ignoreIds);if(clearance.contacts.length)return {accepted:from,forwardDistance:0,blocked:true,blockedPart:clearance.blockedPart,contacts:clearance.contacts};
   return result;
  },
  sweepTurretAtHull(pose,from,to,rig){const result=base.sweepTurretAtHull(pose,from,to,rig);const clearance=world.muzzleContacts(getTankTransform({pose,turret:result.accepted},rig),rig);if(clearance.contacts.length)return {accepted:from,blocked:true,contacts:clearance.contacts,blockedPart:clearance.blockedPart};return result;}
 };
}
