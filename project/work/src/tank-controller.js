/** Deterministic, planar tracked drivetrain. Metres / seconds / radians; yaw 0 is -Z. */
const TAU = Math.PI * 2;
export const wrapAngle = value => ((value + Math.PI) % TAU + TAU) % TAU - Math.PI;
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const approach = (value, target, amount) => value + clamp(target - value, -amount, amount);
const vec = p => ({ x: finite(p?.x), y: finite(p?.y), z: finite(p?.z) });
const add = (a,b) => ({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
export const rotateYaw = (p, yaw) => ({x:Math.cos(yaw)*p.x+Math.sin(yaw)*p.z,y:p.y,z:-Math.sin(yaw)*p.x+Math.cos(yaw)*p.z});
const rotateElevation = (p,a) => ({x:p.x,y:Math.cos(a)*p.y-Math.sin(a)*p.z,z:Math.sin(a)*p.y+Math.cos(a)*p.z});
const deepFreeze = value => { for (const child of Object.values(value)) if (child && typeof child === 'object') deepFreeze(child); return Object.freeze(value); };

/** Conservative game-scale tuning, not claimed real-vehicle measurements. Proxies match the derivative V5 rig. */
export const DEFAULT_CONFIG = deepFreeze({
  trackGauge:1.5288, governorCaps:{crawl:1.2,cruise:2.2,travel:3},reverseCap:1.1,boostCap:3.5,
  accel:1.3,coastDecel:1.2,brakeDecel:3.2,maxYawRate:.7,maxYawAccel:1.2,
  turretYawRate:1.1,elevationRate:.6,elevationLimits:[-8*Math.PI/180,25*Math.PI/180],
  recoilDistance:.08,recoilReturnSeconds:.2,
  rig:{
    hullProxy:{width:1.899625521,height:.784913416,depth:2.819320527,offset:{x:0,y:.392456705,z:-.000306512}},
    turretProxy:{width:1.547120,height:.637020,depth:1.502752,offset:{x:0,y:.277092,z:-.033338}},
    turretPivot:{x:0,y:1.6725492477416992*.455,z:-.11995315551757812*.455},
    barrelPivot:{x:0,y:.4000358581542969*.455,z:-1.2879886627197266*.455},
    barrelCapsule:{radius:.151},
    muzzleLocal:{x:0,y:.0091644287109375,z:-2.3247964334487916},
    trackLoopMeters:5.977439374291054,wheelRadius:.16835,
  },
});

export function createTank(spawn = {}) {
  const p=spawn.pose || spawn;
  return {
    pose:{...vec(p),yaw:wrapAngle(finite(p.yaw))},vL:0,vR:0,governor:'cruise',trackL:0,trackR:0,
    turret:{yawRel:0,elevation:0,recoil:0,recoilVelocity:0},
    blocked:{body:false,barrel:false,muzzle:false},tick:0,
  };
}

export function hullVector(v,pose,inverse=false){
 const b=pose.basis;if(!b)return rotateYaw(v,inverse?-pose.yaw:pose.yaw);
 if(inverse){const q=rotateYaw(v,-pose.yaw);return {x:q.x*b.right[0]+q.y*b.right[1]+q.z*b.right[2],y:q.x*b.up[0]+q.y*b.up[1]+q.z*b.up[2],z:q.x*b.forward[0]+q.y*b.forward[1]+q.z*b.forward[2]};}
 return rotateYaw({x:b.right[0]*v.x+b.up[0]*v.y+b.forward[0]*v.z,y:b.right[1]*v.x+b.up[1]*v.y+b.forward[1]*v.z,z:b.right[2]*v.x+b.up[2]*v.y+b.forward[2]*v.z},pose.yaw);
}
/** The same hull -> yaw pivot -> elevation hinge -> recoil slide chain used by the visual rig. */
export function getTankTransform(tank, rig = DEFAULT_CONFIG.rig) {
  const pose=tank.pose, turret=tank.turret;
  if(pose.basis){
   const localTurret=vec(rig.turretPivot),localHinge=add(localTurret,rotateYaw(vec(rig.barrelPivot),turret.yawRel));
   const barrelPoint=p=>add(pose,hullVector(add(localHinge,rotateYaw(rotateElevation({...vec(p),z:finite(p?.z)+turret.recoil},turret.elevation),turret.yawRel)),pose));
   return {position:barrelPoint(rig.muzzleLocal),direction:hullVector(rotateYaw(rotateElevation({x:0,y:0,z:-1},turret.elevation),turret.yawRel),pose),barrelStart:barrelPoint(rig.barrelCapsule.start||{x:0,y:0,z:0}),barrelEnd:barrelPoint(rig.barrelCapsule.end||rig.muzzleLocal),turretOrigin:add(pose,hullVector(localTurret,pose)),hinge:add(pose,hullVector(localHinge,pose)),pose:{...pose},turret:{...turret}};
  }
  const yaw=pose.yaw+turret.yawRel;
  const turretOrigin=add(pose,rotateYaw(vec(rig.turretPivot),pose.yaw));
  const hinge=add(turretOrigin,rotateYaw(vec(rig.barrelPivot),yaw));
  const barrelPoint=point=>add(hinge,rotateYaw(rotateElevation({...vec(point),z:finite(point?.z)+turret.recoil},turret.elevation),yaw));
  const position=barrelPoint(rig.muzzleLocal);
  return {
    position,direction:rotateYaw(rotateElevation({x:0,y:0,z:-1},turret.elevation),yaw),
    barrelStart:barrelPoint(rig.barrelCapsule.start || {x:0,y:0,z:0}),
    barrelEnd:barrelPoint(rig.barrelCapsule.end || rig.muzzleLocal),
    turretOrigin,hinge,pose:{...pose},turret:{...turret},
  };
}

/** Exact constant-curvature integration: no independent world-axis velocity and therefore no strafing. */
export function integrateArc(pose, distance, angle) {
  if(Math.abs(angle)<1e-9) return {...pose,x:pose.x-Math.sin(pose.yaw)*distance,z:pose.z-Math.cos(pose.yaw)*distance,yaw:wrapAngle(pose.yaw+angle)};
  const end=pose.yaw+angle,r=distance/angle;
  return {...pose,x:pose.x+r*(Math.cos(end)-Math.cos(pose.yaw)),z:pose.z-r*(Math.sin(end)-Math.sin(pose.yaw)),yaw:wrapAngle(end)};
}

function frameFor(state, rig, dt, deltaTrackL, deltaTrackR, canFire, contacts, desiredSpeed, boostActive, surface) {
  return {
    pose:{...state.pose},turretYawRel:state.turret.yawRel,elevation:state.turret.elevation,recoil:state.turret.recoil,
    muzzleWorld:getTankTransform(state,rig),deltaTrackL,deltaTrackR,trackL:state.trackL,trackR:state.trackR,
    speedForward:(state.vL+state.vR)/2,yawRate:dt>0?wrapAngle(state.pose.yaw-(state._previousYaw??state.pose.yaw))/dt:0,
    canFire,contacts:[...new Set(contacts)],desiredSpeed,governor:state.governor,boostActive,surface,
  };
}

export function stepTank(previous, rawInput = {}, dt = 1/60, env, config = DEFAULT_CONFIG) {
  if(!Number.isFinite(dt) || dt<=0 || dt>.1) throw new RangeError('Tank dt must be finite, positive, and <= 0.1 seconds; use a fixed-step accumulator');
  const state={...previous,pose:{...previous.pose},turret:{...previous.turret},blocked:{...previous.blocked}};
  const input=rawInput || {};
  const clearance = transform => env?.muzzleClear ? env.muzzleClear(transform,config.rig) : true;
  const isClear = result => typeof result==='boolean'?result:(result?.clear??!result?.blocked);
  // Centre-point polygon sampling is deliberately game-scale, not simulated track slip.
  // Surface transitions change targets and slew limits; they never assign stored speed.
  const sampled=env?.surfaceAt?.(state.pose)||{id:null,class:'road',traction:1,drag:1};
  const traction=clamp(finite(sampled.traction,1),.35,1),drag=clamp(finite(sampled.drag,1),1,2.5);
  const speedMultiplier=clamp(traction/Math.sqrt(drag),.45,1),turnMultiplier=.7+.3*traction;
  const surface={id:sampled.id??null,class:sampled.class||'road',traction,drag,speedMultiplier,accelerationMultiplier:traction,turnMultiplier};
  if(input.paused) return {state,frame:frameFor(state,config.rig,dt,0,0,isClear(clearance(getTankTransform(state,config.rig))),[],0,false,surface),events:[]};
  if(Object.hasOwn(config.governorCaps,input.governor)) state.governor=input.governor;
  const throttle=clamp(finite(input.throttle),-1,1),steer=clamp(finite(input.steer),-1,1);
  const braking=Boolean(input.brake);
  const oldMean=(previous.vL+previous.vR)/2,oldYaw=(previous.vR-previous.vL)/config.trackGauge;
  const reversing=throttle*oldMean<0 && Math.abs(oldMean)>1e-10;
  const boostActive=Boolean(input.boost)&&throttle>0&&Math.abs(steer)<.45&&!braking&&!reversing;
  const forwardCap=(boostActive?config.boostCap:config.governorCaps[state.governor])*speedMultiplier;
  const reverseCap=config.reverseCap*speedMultiplier;
  const trackCap=throttle<0?reverseCap:forwardCap;
  const desiredSpeed=(braking||reversing)?0:throttle*(throttle<0?reverseCap:forwardCap);
  const yawCap=(config.maxYawRate-(config.maxYawRate-.45)*clamp(Math.abs(oldMean)/config.governorCaps.travel,0,1))*turnMultiplier;
  let desiredYaw=(braking||reversing)?0:-steer*yawCap;
  let targetL=desiredSpeed-config.trackGauge*desiredYaw/2,targetR=desiredSpeed+config.trackGauge*desiredYaw/2;
  const scale=Math.max(1,Math.abs(targetL)/trackCap,Math.abs(targetR)/trackCap);
  targetL/=scale;targetR/=scale;
  const limit=(braking||reversing)?config.brakeDecel:((throttle===0&&steer===0)?config.coastDecel*drag:config.accel*traction);
  let vL=approach(previous.vL,targetL,limit*dt),vR=approach(previous.vR,targetR,limit*dt);
  const deltaL=targetL-previous.vL,deltaR=targetR-previous.vR;
  // Equal independent increments erase steering while both tracks accelerate.
  // Approach the existing track targets together, within both slew budgets.
  // Keep braking, coasting, pivots and mixed acceleration/deceleration unchanged.
  // Build missing signed yaw only; retain inherited reduction of existing turn.
  const targetYaw=(targetR-targetL)/config.trackGauge;
  if(steer*(targetYaw-oldYaw)<0&&!braking&&!reversing&&throttle*deltaL>0&&throttle*deltaR>0){
    const yawDelta=(deltaR-deltaL)/config.trackGauge;
    const fraction=Math.min(1,limit*dt/Math.max(Math.abs(deltaL),Math.abs(deltaR)),
      yawDelta===0?1:config.maxYawAccel*turnMultiplier*dt/Math.abs(yawDelta));
    vL=previous.vL+deltaL*fraction;vR=previous.vR+deltaR*fraction;
  }
  const mean=(vL+vR)/2;
  const yaw=approach(oldYaw,(vR-vL)/config.trackGauge,config.maxYawAccel*turnMultiplier*dt);
  vL=mean-config.trackGauge*yaw/2;vR=mean+config.trackGauge*yaw/2;
  // When both tracks are braking, reaching zero is a real tick before reverse traction begins.
  if(reversing && Math.abs(mean)<1e-12 && Math.abs(yaw)<1e-12) vL=vR=0;
  const requestedDistance=(vL+vR)/2*dt,requestedAngle=(vR-vL)/config.trackGauge*dt;
  const from={pose:{...state.pose},turret:{...state.turret}};
  const to={pose:integrateArc(state.pose,requestedDistance,requestedAngle),turret:{...state.turret}};
  const body=env?.sweepHullAndAttachedGun?env.sweepHullAndAttachedGun(from,to,config.rig):{accepted:to,forwardDistance:requestedDistance,blocked:false,contacts:[]};
  state.pose={...(body.accepted.pose||body.accepted)};
  const acceptedAngle=wrapAngle(state.pose.yaw-previous.pose.yaw);
  const d=finite(body.forwardDistance,requestedDistance);
  const dL=d-config.trackGauge*acceptedAngle/2,dR=d+config.trackGauge*acceptedAngle/2;
  state.vL=dL/dt;state.vR=dR/dt;state.trackL+=dL;state.trackR+=dR;
  let contacts=[...(body.contacts||[])];
  const desiredTurret={...state.turret};
  // Critically damp the cosmetic return; it is swept just like any other joint motion.
  const omega=6/config.recoilReturnSeconds,term=desiredTurret.recoilVelocity+omega*desiredTurret.recoil,decay=Math.exp(-omega*dt);
  desiredTurret.recoil=(desiredTurret.recoil+term*dt)*decay;
  desiredTurret.recoilVelocity=(desiredTurret.recoilVelocity-omega*term*dt)*decay;
  if(desiredTurret.recoil<.00001) desiredTurret.recoil=desiredTurret.recoilVelocity=0;
  const target=input.aim?.worldPoint;
  if(target && state.pose.basis && ['x','y','z'].every(k=>Number.isFinite(target[k]))){
    const relative=hullVector({x:target.x-state.pose.x,y:target.y-state.pose.y,z:target.z-state.pose.z},state.pose,true),pivot=config.rig.turretPivot;
    const yaw=Math.atan2(-(relative.x-pivot.x),-(relative.z-pivot.z));
    desiredTurret.yawRel=wrapAngle(state.turret.yawRel+clamp(wrapAngle(yaw-state.turret.yawRel),-config.turretYawRate*dt,config.turretYawRate*dt));
    const hinge=add(pivot,rotateYaw(config.rig.barrelPivot,yaw));
    desiredTurret.elevation=approach(state.turret.elevation,clamp(Math.atan2(relative.y-hinge.y,Math.hypot(relative.x-hinge.x,relative.z-hinge.z)),...config.elevationLimits),config.elevationRate*dt);
  } else if(target && ['x','y','z'].every(k=>Number.isFinite(target[k]))) {
    const transform=getTankTransform(state,config.rig),origin=transform.turretOrigin;
    if(Math.hypot(target.x-origin.x,target.z-origin.z)>1e-8) {
      const worldYaw=Math.atan2(-(target.x-origin.x),-(target.z-origin.z));
      const targetRelative=wrapAngle(worldYaw-state.pose.yaw);
      desiredTurret.yawRel=wrapAngle(state.turret.yawRel+clamp(wrapAngle(targetRelative-state.turret.yawRel),-config.turretYawRate*dt,config.turretYawRate*dt));
      const hinge=add(origin,rotateYaw(vec(config.rig.barrelPivot),worldYaw));
      const elevation=clamp(Math.atan2(target.y-hinge.y,Math.hypot(target.x-hinge.x,target.z-hinge.z)),...config.elevationLimits);
      desiredTurret.elevation=approach(state.turret.elevation,elevation,config.elevationRate*dt);
    }
  }
  const travelFloor=env?.travelElevationFloor?.(state.pose,desiredSpeed);
  const travelClearance=Number.isFinite(travelFloor)&&desiredTurret.elevation<travelFloor;
  if(travelClearance)desiredTurret.elevation=approach(state.turret.elevation,clamp(travelFloor,...config.elevationLimits),config.elevationRate*dt);
  // Recover only from a real terrain/gun drive rejection. Retain the recovered
  // elevation while driving so a held low aim cannot re-ground it every tick.
  // A 150 ms target reserve avoids re-stopping the tracks at every tiny rise.
  // Release/brake gives depression back; all joint and body sweeps still apply.
  if(throttle===0||braking)delete state.terrainTravelElevation;
  else if(desiredSpeed!==0&&body.blocked&&['barrel','muzzle'].includes(body.blockedPart)&&body.contacts?.length&&body.contacts.every(id=>id==='terrain'))
    state.terrainTravelElevation=clamp(Math.max(finite(state.terrainTravelElevation,state.turret.elevation),state.turret.elevation+config.elevationRate*.15),...config.elevationLimits);
  const terrainTravelClearance=Number.isFinite(state.terrainTravelElevation);
  if(terrainTravelClearance&&desiredTurret.elevation<state.terrainTravelElevation)
    desiredTurret.elevation=approach(state.turret.elevation,state.terrainTravelElevation,config.elevationRate*dt);
  let joint=env?.sweepTurretAtHull?env.sweepTurretAtHull(state.pose,state.turret,desiredTurret,config.rig):{accepted:desiredTurret,blocked:false,contacts:[]};
  // A simultaneous yaw or recoil return can intersect terrain even when raising
  // alone is clear. Do not let that rejected joint cancel the physical recovery.
  // Hold the other joints for one bounded step; the same real sweep must accept it.
  if(terrainTravelClearance&&joint.blocked&&joint.contacts?.length&&joint.contacts.every(id=>id==='terrain')&&desiredTurret.elevation>state.turret.elevation&&env?.sweepTurretAtHull){
    const lift=env.sweepTurretAtHull(state.pose,state.turret,{...state.turret,elevation:desiredTurret.elevation},config.rig);
    if(lift.accepted.elevation>joint.accepted.elevation)
      joint={...joint,accepted:lift.accepted,contacts:[...joint.contacts,...(lift.contacts||[])]};
  }
  state.turret={...joint.accepted};
  if(joint.blocked) state.turret.recoilVelocity=(state.turret.recoil-previous.turret.recoil)/dt;
  contacts.push(...(joint.contacts||[]));
  let muzzle=getTankTransform(state,config.rig),clear=clearance(muzzle),canFire=isClear(clear);
  const events=[];
  if(input.firePressed) {
    if(canFire) {
      const firedTurret={...state.turret,recoil:config.recoilDistance,recoilVelocity:0};
      const kick=env?.sweepTurretAtHull?env.sweepTurretAtHull(state.pose,state.turret,firedTurret,config.rig):{accepted:firedTurret,blocked:false,contacts:[]};
      state.turret={...kick.accepted};contacts.push(...(kick.contacts||[]));
      muzzle=getTankTransform(state,config.rig);
      events.push({type:'fire',muzzle:{position:{...muzzle.position},direction:{...muzzle.direction}}});
    } else events.push({type:'fire-blocked',reason:'muzzle-obstructed'});
  }
  state.blocked={body:Boolean(body.blocked && body.blockedPart!=='barrel' && body.blockedPart!=='turret' && body.blockedPart!=='muzzle'),barrel:Boolean(joint.blocked || (body.blocked && (body.blockedPart==='barrel'||body.blockedPart==='turret'||body.blockedPart==='muzzle'))),muzzle:!canFire};
  state.tick=previous.tick+1;
  const frame=frameFor(state,config.rig,dt,dL,dR,canFire,contacts,desiredSpeed,boostActive,surface);
  frame.yawRate=acceptedAngle/dt;
  if(travelClearance)frame.travelClearance=true;
  if(terrainTravelClearance)frame.terrainTravelClearance=true;
  return {state,frame,events};
}
