import {getCraftedMission} from './content/crafted20/index.js';

// Entry/presentation metadata only. Gameplay always uses the original frozen record.
const entries=Object.freeze([
 Object.freeze({slug:'showcase-flank',label:'侧击',spec:getCraftedMission('crafted20-002')}),
 Object.freeze({slug:'showcase-escort',label:'护送',spec:getCraftedMission('crafted20-003')}),
 Object.freeze({slug:'showcase-breach',label:'破障',spec:getCraftedMission('crafted20-007'),hint:'可选破障路线：击毁前方修理便道的围栏，穿过缺口走近路；也可保持围栏完整，从西侧绕行。破障不是必做目标。'})
]);
export function listShowcaseMissions(){return entries;}
export function getShowcaseMission(slug){return entries.find(entry=>entry.slug===slug)?.spec;}
