import {emitEvent,destroyedColliderIds} from './combat.js';
/** Hull contact and deliberate traction are required. Gun hits, steering in place,
 * distant objects, and heavy unmarked buildings cannot trigger crushing. */
export function stepCrushing(state,dt,world) {
 if(!state.mission.geometry?.some(c=>c.crush))return;
 const speed=state.tankFrame.desiredSpeed;
 if(!Number.isFinite(speed)||Math.abs(speed)<.1)return;
 const contacts=new Set(world.hullContacts?.(state.tank)||[]);
 for(const c of state.mission.geometry||[]) {
  const e=state.entities[c.id],seconds=c.crush?.seconds;
  if(!contacts.has(c.id)||!e?.alive||!c.destructible||!Number.isFinite(seconds)||seconds<=0)continue;
  const pose=state.tank.pose;
  const approach=(-(c.x-pose.x)*Math.sin(pose.yaw)-(c.z-pose.z)*Math.cos(pose.yaw))*Math.sign(speed);
  if(approach<=0)continue;
  const damage=e.maxHp*dt/seconds*Math.min(1,Math.abs(speed)/1.2);
  e.hp=Math.max(0,e.hp-damage);e.crushProgress=1-e.hp/e.maxHp;
  if(e.hp>1e-7)continue;
  e.hp=0;e.alive=false;e.destroyed=true;e.status='crushed';e.crushProgress=1;
  e.crushYaw=pose.yaw+(speed<0?Math.PI:0);e.crushedAt=state.elapsed;
  emitEvent(state,'crushed',{entityId:e.id,position:{...e.pose},value:c.crush.mode||'collapse'});
  emitEvent(state,'destroyed',{entityId:e.id,position:{...e.pose}});
  emitEvent(state,'barrier-opened',{entityId:e.id,position:{...e.pose}});
 }
 world.setDestroyed?.(destroyedColliderIds(state));
}
