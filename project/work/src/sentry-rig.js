import {INTERCEPTOR_RIG} from './interceptor.js';
/** Measured from sentry-turret.glb. Plain-data shared combat/render contract.
 * +Y up, -Z forward; yaw +Y, elevation +X, recoil +Z. No collider change. */
export const SENTRY_RIG=Object.freeze({yawHeight:1.1299999952316284,pitchHeight:.1499999761581421,pitchForward:.20740000903606415,barrelLength:.5489999651908875,minElevation:-.08,maxElevation:.35,maxRecoil:.07});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function sentryAim(entity,target){
 const rig=entity.vehicle==='pz3'?INTERCEPTOR_RIG:SENTRY_RIG;
 const p=entity.pose,dx=target.x-p.x,dz=target.z-p.z;
 return {yaw:Math.atan2(-dx,-dz),elevation:clamp(Math.atan2(target.y-p.y-rig.yawHeight-rig.pitchHeight,Math.max(.001,Math.hypot(dx,dz)-rig.pitchForward)),rig.minElevation,rig.maxElevation)};
}
export function sentryMuzzleTransform(entity,recoil=0){
 const r=entity.vehicle==='pz3'?INTERCEPTOR_RIG:SENTRY_RIG,p=entity.pose,yaw=entity.aimYaw??p.yaw??0,elevation=entity.aimElevation??0;
 const length=r.barrelLength-clamp(recoil,0,r.maxRecoil),forward=r.pitchForward+length*Math.cos(elevation);
 return {position:{x:p.x-Math.sin(yaw)*forward,y:(p.y||0)+r.yawHeight+r.pitchHeight+length*Math.sin(elevation),z:p.z-Math.cos(yaw)*forward},direction:{x:-Math.sin(yaw)*Math.cos(elevation),y:Math.sin(elevation),z:-Math.cos(yaw)*Math.cos(elevation)}};
}
