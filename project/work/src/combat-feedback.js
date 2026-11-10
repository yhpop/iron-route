import { isHostileToPlayer } from './combat-relations.js';
// Read-only presentation: consume authoritative events, never infer penetration.
const DISPLAY_SECONDS=2.5;
const sequence=event=>{const n=/^event-([1-9]\d*)$/.exec(event?.id||'');return n?Number(n[1]):0;};
function notice(event,target){
 const name=target.vehicle==='pz3'?'装甲车':'炮位';
 if(event.type==='impact'&&event.value==='shield'&&target.alive===true&&!target.destroyed)return {kind:'blocked',targetId:event.targetId,eventId:event.id,text:`${name}正面挡弹 · 尝试绕侧`,compactText:'挡弹 · 绕侧',minimalText:'挡弹'};
 if(event.type==='damaged'&&Number.isFinite(event.value)&&event.value>0){
  const damage=event.value;return {kind:'damage',targetId:event.targetId,eventId:event.id,damage,text:`命中${name} · 伤害 ${damage}`,compactText:`命中 −${damage}`,minimalText:`−${damage}`};
 }
 return null;
}
/** One bounded notice. Simulation elapsed time freezes while paused; repeated
 * RAFs cannot renew an event. Selection/retry reset is explicit in main.js and
 * defensively recognized by mission identity / a backwards simulation tick. */
export function createCombatFeedback(){
 let mission=null,lastTick=-1,lastSequence=0,active=null,expires=0;
 function reset(){mission=null;lastTick=-1;lastSequence=0;active=null;expires=0;}
 function update(state,events=[]){
  if(!state?.mission?.design?.integratedSlice||!Number.isFinite(state.elapsed)){reset();return null;}
  if(mission!==state.mission||state.tick<lastTick){reset();mission=state.mission;}
  lastTick=state.tick;
  if(state.phase!=='playing')return null;
  for(const event of events){
   const n=sequence(event);if(!Number.isSafeInteger(n)||n<=lastSequence||!Number.isInteger(event.tick)||event.tick>state.tick)continue;
   lastSequence=n;
   if(event.entityId!=='tank'||!isHostileToPlayer(state,state.entities?.[event.targetId]))continue;
   const next=notice(event,state.entities[event.targetId]);if(next){active=next;expires=state.elapsed+DISPLAY_SECONDS;}
  }
  if(active&&(state.elapsed>=expires||(active.kind==='blocked'&&(!state.entities?.[active.targetId]?.alive||state.entities[active.targetId].destroyed))))active=null;
  return active?{...active}:null;
 }
 return {update,reset};
}
