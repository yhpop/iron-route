/** Presentation only: route identity comes from authored choice records, never screen-side guesses. */
export function routeChoiceName(spec,{zoneId,choiceId}={}){
 const option=spec?.convoyChoice?.options?.find(o=>choiceId!==undefined?o.id===choiceId:o.zoneId===zoneId);
 return typeof option?.title==='string'&&option.title.trim()?option.title:null;
}
export function routeChoiceLabels(state,spec,project,rect){
 const choice=spec?.convoyChoice;
 if(state?.phase!=='playing'||!choice||state.selectedConvoyChoiceId||state.objectiveStates?.[choice.requiresObjectiveId]?.status!=='complete'||!rect)return [];
 return (choice.options||[]).flatMap(option=>{
  const title=routeChoiceName(spec,{choiceId:option.id}),zone=spec.zones?.find(z=>z.id===option.zoneId);
  if(!title||!zone?.polygon?.length)return [];
  const x=zone.polygon.reduce((n,p)=>n+p.x,0)/zone.polygon.length,z=zone.polygon.reduce((n,p)=>n+p.z,0)/zone.polygon.length,p=project({x,z});
  if(!p?.inFront||![p.x,p.y].every(Number.isFinite)||p.x<rect.left+80||p.x>rect.left+rect.width-80||p.y<rect.top+90||p.y>rect.top+rect.height-130)return [];
  return [{id:zone.id,title,x:p.x,y:p.y}];
 });
}
