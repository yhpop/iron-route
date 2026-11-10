import {saveProgress,recordWin} from './session.js';
/** Query selects an optional record only; it never expands or mutates campaign progress. */
export function resolveLaunch(search,missions,progress,getOptionalMission){
 const queries=new URLSearchParams(search).getAll('sortie');const optional=queries.length===1?getOptionalMission(queries[0]):null;
 if(optional)return {optional:true,spec:optional,progressWritable:false};
 const selected=missions.find(m=>m.id===progress.selectedMissionId&&progress.unlockedIds.includes(m.id))||missions[0];
 return {optional:false,spec:selected,progressWritable:true};
}
export function nextCampaignMission(missions,id){const index=missions.findIndex(m=>m.id===id);return index>=0?missions[index+1]||null:null;}
export function persistLaunchProgress(selection,storage,progress,namespace){return selection.progressWritable&&!selection.optional?saveProgress(storage,progress,namespace):null;}
export function recordLaunchWin(selection,progress,result,missions){return selection.progressWritable&&!selection.optional?recordWin(progress,selection.spec.id,result,missions):progress;}
