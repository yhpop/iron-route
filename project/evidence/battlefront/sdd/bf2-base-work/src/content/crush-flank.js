import {getCraftedMission} from './crafted20/index.js';
import {box} from './geometry.js';
/** Isolated playable experiment; the 20 campaign records and save namespace stay intact. */
const base=JSON.parse(JSON.stringify(getCraftedMission('crafted20-002')));
export const crushFlank={...base,id:'mission-9003',index:9003,optional:true,title:'压开侧翼 · 碾压候选',
 briefing:'前方仓库无法撞穿。西边维修道的低木栅可以用履带顶住压断：保持前进，只有车身真正碰到的栅栏段才会倒下，留下可驶过的碎木。压开西侧缺口可以绕到炮塔侧面；也可走东边较快但暴露的柏油路。此候选只实现分段低栅栏碾压，高杆和房屋坍塌尚未实现。',
 geometry:[...base.geometry,...Array.from({length:6},(_,i)=>box(`crush-fence-${i}`,-14.25+i*1.8,10,1.8,.25,.65,{destructible:true,hp:90,crush:{seconds:.25,mode:'fence'}}))]};
