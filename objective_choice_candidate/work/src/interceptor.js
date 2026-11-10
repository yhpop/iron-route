/** Game-scale adapter of konserwa CC0 Panzer III; values are not historical statistics. */
export const INTERCEPTOR_RIG=Object.freeze({yawHeight:1.044,pitchHeight:.182,pitchForward:.56,barrelLength:1.52,minElevation:-.12,maxElevation:.3,maxRecoil:.07});
const wrap=n=>Math.atan2(Math.sin(n),Math.cos(n));
/** Shared measured compound sweep; conservative fallback only for limited adapters.
 * A vehicle parks while aiming, then relocates during its reload window. */
export function stepInterceptors(state,dt,world){
 for(const e of Object.values(state.entities)){
  if(e.vehicle!=='pz3'||!e.alive)continue;
  e.speed=Number.isFinite(e.speed)?e.speed:0;
  if(e.charge>0||e.telegraphTarget){e.speed=0;continue;}
  const points=e.patrol;if(!Array.isArray(points)||points.length<2){e.speed=0;continue;}
  let index=e.patrolIndex??1;const goal=points[index%points.length];
  const dx=goal.x-e.pose.x,dz=goal.z-e.pose.z,remaining=Math.hypot(dx,dz);
  if(remaining<.08){e.patrolIndex=(index+1)%points.length;e.speed=0;continue;}
  const desired=Math.atan2(-dx,-dz),turn=wrap(desired-e.pose.yaw),angle=Math.max(-dt*.6,Math.min(dt*.6,turn));
  const speed=Math.min(1.35,e.speed+.65*dt)*Math.max(0,Math.cos(turn));
  const yaw=wrap(e.pose.yaw+angle),travel=Math.min(remaining,speed*dt);
  let next={...e.pose,yaw,x:e.pose.x-Math.sin(yaw)*travel,z:e.pose.z-Math.cos(yaw)*travel};
  let blocked=false;
  if(world.sweepHullAndAttachedGun){
   const from=interceptorCollider(e),to=interceptorCollider({...e,pose:next});
   const sweep=world.sweepHullAndAttachedGun(from,to,INTERCEPTOR_COLLISION_RIG,[e.id]);
   next=sweep.accepted.pose;blocked=!!sweep.blocked;
   if(blocked&&Math.hypot(next.x-e.pose.x,next.z-e.pose.z)<1e-9&&Math.abs(wrap(next.yaw-e.pose.yaw))<1e-9){e.speed=0;e.patrolBlocked=true;continue;}
  }else{
   if(!world.isRouteClear?.({points:[e.pose,next],width:4.4},{width:4.4,depth:4.4,height:1.7,ignoreIds:[e.id]})){e.speed=0;e.patrolBlocked=true;continue;}
   if(world.groundPose)next=world.groundPose(next);
  }
  const acceptedTravel=Math.hypot(next.x-e.pose.x,next.z-e.pose.z),acceptedTurn=wrap(next.yaw-e.pose.yaw);
  e.pose=next;e.speed=blocked?0:speed;e.travel=(e.travel||0)+acceptedTravel;e.turnTravel=(e.turnTravel||0)+acceptedTurn;e.patrolBlocked=blocked;
  world.setEntities?.([...Object.values(state.entities).filter(x=>x.alive||x.vehicle==='pz3').map(x=>x.vehicle==='pz3'?interceptorCollider(x):x),{id:'tank',kind:'tank',pose:state.tank.pose,turret:state.tank.turret,width:1.9,depth:2.9,height:1.5}]);
 }
}

/** Bounds measured from the shipped GLB, not a shrink-to-feel radius.
 * Turret includes the mantlet envelope; the bore uses a measured capsule. */
export const INTERCEPTOR_COLLISION_RIG=Object.freeze({
 hullProxy:{width:1.921792,height:1.074415,depth:3.532506,offset:{x:-.013286,y:.5372075,z:.140351}},
 turretProxy:{width:1.196418,height:.60125,depth:1.3903,offset:{x:.0061085,y:.30073,z:-.048919}},
 turretPivot:{x:0,y:1.044,z:0},barrelPivot:{x:0,y:.182,z:-.56},
 barrelCapsule:{radius:.065},muzzleLocal:{x:0,y:0,z:-1.52},
});
export function interceptorCollider(e){
 return {...e,kind:'tank',rig:INTERCEPTOR_COLLISION_RIG,turret:{yawRel:(e.aimYaw??e.pose.yaw)-e.pose.yaw,elevation:e.aimElevation||0,recoil:0},
  alive:true,destroyed:false,hp:undefined,width:1.921792,depth:3.532506,height:1.645451};
}
