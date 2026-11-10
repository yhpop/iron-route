/** Local presentation state only. Never writes mission, simulation or save data. */
const PRIORITY={breach:0,disable:0,escort:1,reach:2,defend:2};
const position=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const centre=zone=>zone?.polygon?.length&&zone.polygon.every(position)?{x:zone.polygon.reduce((n,p)=>n+p.x,0)/zone.polygon.length,z:zone.polygon.reduce((n,p)=>n+p.z,0)/zone.polygon.length}:null;
function pointsFor(objective,state,spec){
 const points=[];
 for(const id of objective.targetIds||[]){const e=state.entities?.[id];if(e?.alive&&!e.arrived&&position(e.pose))points.push({id,x:e.pose.x,z:e.pose.z,type:objective.type});}
 if(objective.zoneId&&!objective.targetIds?.length){const p=centre(spec.zones?.find(z=>z.id===objective.zoneId));if(p)points.push({id:objective.zoneId,...p,type:objective.type});}
 return points;
}
export function createObjectiveTracker(){
 let missionId=null,pinnedId=null,last=null;
 function reset(){missionId=null;pinnedId=null;last=null;}
 function update(state,spec,origin=state?.tank?.pose){
  if(missionId!==spec?.id){reset();missionId=spec?.id;}
  const active=(spec?.objectives||[]).filter(o=>state?.objectiveStates?.[o.id]?.status==='active');
  if(!active.some(o=>o.id===pinnedId))pinnedId=null;
  const p=position(origin)?origin:{x:0,z:0},distance=t=>Math.hypot(t.x-p.x,t.z-p.z);
  const ranked=active.flatMap(objective=>pointsFor(objective,state,spec).map(target=>({objective,target}))).sort((a,b)=>((PRIORITY[a.objective.type]??3)-(PRIORITY[b.objective.type]??3))||distance(a.target)-distance(b.target));
  const choice=spec?.convoyChoice,routeChoicePending=!!choice&&!state.selectedConvoyChoiceId&&state.objectiveStates?.[choice.requiresObjectiveId]?.status==='complete';
  let objective=active.find(o=>o.id===pinnedId)||ranked[0]?.objective||active[0]||null;
  let target=objective?ranked.find(item=>item.objective.id===objective.id)?.target||null:null;
  let targetObjectiveId=target?objective.id:null;
  if(routeChoicePending){
   target=(choice.options||[]).flatMap(option=>{const p=centre(spec.zones?.find(z=>z.id===option.zoneId));return p?[{id:option.zoneId,...p,type:'route-choice'}]:[];}).sort((a,b)=>distance(a)-distance(b))[0]||null;
   targetObjectiveId=null;
  }
  last={objective,target,targetObjectiveId,activeObjectives:active,activeCount:active.length,selectedIndex:objective?active.indexOf(objective):-1,manual:!!pinnedId,freeOrder:active.length>1&&active.every(o=>['disable','breach'].includes(o.type)),routeChoicePending,canCycle:state?.phase==='playing'&&!routeChoicePending&&active.length>1};
  return last;
 }
 function selectNext(){if(!last?.canCycle)return false;pinnedId=last.activeObjectives[(last.selectedIndex+1)%last.activeCount].id;return true;}
 return {update,selectNext,reset};
}
