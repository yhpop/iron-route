export const PROGRESS_KEY='tank-campaign:progress:v1';
export function createClock(step){
 const dt=1/60;let accumulator=0,paused=false,dropped=0;
 return {advance(seconds){if(paused)return 0;const elapsed=Number.isFinite(seconds)?Math.max(0,seconds):0;const admitted=Math.min(.1,elapsed);dropped+=elapsed-admitted;accumulator+=admitted;let count=0;while(accumulator+1e-10>=dt&&count<6){step(dt);accumulator=Math.max(0,accumulator-dt);count++;}return accumulator/dt;},pause(){paused=true;accumulator=0;},resume(){paused=false;accumulator=0;},get droppedSeconds(){return dropped;}};
}
export function loadProgress(storage,missions,namespace=PROGRESS_KEY){
 const ids=missions.map(m=>m.id),first=ids[0],valid=new Set(ids);let raw;
 try{raw=JSON.parse(storage?.getItem(namespace)||'null');}catch{}
 const unlockedIds=raw?.schema===1&&Array.isArray(raw.unlockedIds)?ids.filter(id=>id===first||raw.unlockedIds.includes(id)):[first];
 const bestResults={};if(raw?.schema===1&&raw.bestResults&&typeof raw.bestResults==='object')for(const [id,r]of Object.entries(raw.bestResults)){if(valid.has(id)&&Number.isFinite(r?.ticks)&&r.ticks>=0&&Number.isFinite(r.hp))bestResults[id]={ticks:r.ticks,hp:r.hp};}
 return {schema:1,unlockedIds,bestResults,selectedMissionId:unlockedIds.includes(raw?.selectedMissionId)?raw.selectedMissionId:first};
}
export function recordWin(progress,id,result,missions){
 const index=missions.findIndex(m=>m.id===id);if(index<0||!progress.unlockedIds.includes(id))return progress;
 const unlocked=new Set(progress.unlockedIds);if(missions[index+1])unlocked.add(missions[index+1].id);
 const prior=progress.bestResults[id],r={ticks:Math.max(0,Number(result.ticks)||0),hp:Math.max(0,Number(result.hp)||0)};
 return {...progress,unlockedIds:missions.map(m=>m.id).filter(id=>unlocked.has(id)),bestResults:{...progress.bestResults,[id]:!prior||r.ticks<prior.ticks?r:prior}};
}
export function saveProgress(storage,progress,namespace=PROGRESS_KEY){
 try{
  // A stale tab must merge with the latest completed save, not replace its wins.
  // Keep read failures outside the parse fallback: never blindly overwrite unreadable data.
  const bytes=storage.getItem(namespace);let stored;try{stored=JSON.parse(bytes||'null');}catch{}
  const unlocked=new Set(),bestResults=Object.create(null);
  for(const snapshot of [stored,progress]){
   if(snapshot?.schema!==1)continue;
   if(Array.isArray(snapshot.unlockedIds))for(const id of snapshot.unlockedIds)if(typeof id==='string'&&id)unlocked.add(id);
   if(snapshot.bestResults&&typeof snapshot.bestResults==='object'&&!Array.isArray(snapshot.bestResults))for(const [id,r]of Object.entries(snapshot.bestResults)){
    if(!id||!Number.isFinite(r?.ticks)||r.ticks<0||!Number.isFinite(r.hp))continue;
    // Match recordWin: faster ticks win as one record; an equal time keeps the prior result.
    if(!bestResults[id]||r.ticks<bestResults[id].ticks)bestResults[id]={ticks:r.ticks,hp:r.hp};
   }
  }
  const unlockedIds=[...unlocked],selectedMissionId=[progress?.selectedMissionId,stored?.selectedMissionId,unlockedIds[0]].find(id=>unlocked.has(id));
  // This synchronous read/merge/write is not atomic across genuinely concurrent processes.
  storage.setItem(namespace,JSON.stringify({schema:1,unlockedIds,bestResults,selectedMissionId}));return true;
 }catch{return false;}
}
export function interpolateTank(previous,current,alpha){
 const t=Math.max(0,Math.min(1,alpha));const lerp=(a,b)=>a+(b-a)*t;const angle=(a,b)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
 return {...current,pose:{...current.pose,x:lerp(previous.pose.x,current.pose.x),y:lerp(previous.pose.y,current.pose.y),z:lerp(previous.pose.z,current.pose.z),yaw:angle(previous.pose.yaw,current.pose.yaw)},trackL:lerp(previous.trackL,current.trackL),trackR:lerp(previous.trackR,current.trackR),turret:{...current.turret,yawRel:angle(previous.turret.yawRel,current.turret.yawRel),elevation:lerp(previous.turret.elevation,current.turret.elevation),recoil:lerp(previous.turret.recoil,current.turret.recoil)}};
}
export function boundAim(point,pose,range=50){if(!point||!pose||![point.x,point.y,point.z,pose.x,pose.z,range].every(Number.isFinite)||range<=0)return null;const dx=point.x-pose.x,dz=point.z-pose.z,scale=Math.min(1,range/Math.max(1e-8,Math.hypot(dx,dz)));return {x:pose.x+dx*scale,y:point.y,z:pose.z+dz*scale};}
export function bindPageLifecycle(target,{pause,dispose,restore}){let closed=false;const hide=event=>{pause();if(!event.persisted&&!closed){closed=true;detach();dispose();}},show=event=>{if(event.persisted&&!closed)restore();};function detach(){target.removeEventListener('pagehide',hide);target.removeEventListener('pageshow',show);}target.addEventListener('pagehide',hide);target.addEventListener('pageshow',show);return detach;}
