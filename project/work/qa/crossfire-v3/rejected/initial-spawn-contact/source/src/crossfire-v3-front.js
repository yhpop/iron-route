import {createCrossfireFront} from './crossfire-front.js';
import {sampleGroundContact} from './terrain-candidate/heightfield.js';
/** Independent V3 encounter. Static support/flanker use the unchanged real combat
 * system; this builder adds neither mobile AI nor scripted/fake fire. V2 stays frozen. */
export function createCrossfireV3Front(){
 const {spec,field}=createCrossfireFront();
 spec.id='mission-9051';spec.index=9051;spec.crossfireV3=true;
 spec.title='焦土交叉火线 V3 · 前沿接应';
 spec.briefing='护送补给车到达北侧接应区。开局左前方的蓝方支援车与敌方侧翼车会真实交火；两车在路外固定阵位，支援车不是护送目标，损失它不会直接失败。东侧硬路短但有敌车封锁，西侧绕行可借山脊掩护。按 H 或点车队待命，先侦察再推进。友军会挡住炮弹：不要朝补给车或支援车开火，也不要挡在友军炮口前。无需消灭所有敌人，别让敌车残骸堵住车队路线。';
 const positions={'allied-support':{x:-1,z:20},'hostile-flanker':{x:-9,z:12}};
 spec.entities=spec.entities.map(e=>{const p=positions[e.id];if(!p)return e;const other=positions[e.id==='allied-support'?'hostile-flanker':'allied-support'],yaw=Math.atan2(-(other.x-p.x),-(other.z-p.z)),ground=sampleGroundContact(field,p.x,p.z,yaw);return {...e,pose:{...p,y:ground.height+.008,yaw}};});
 spec.design={...spec.design,teamEncounter:'visible opening exchange between two stationary off-lane real combat vehicles',supportRole:'static temporary distraction; no mobile AI or escort objective',newVehiclePositions:'opening southwest shoulder clear of both convoy route corridors; persistent wrecks stay off lane',openingEvidence:'offline production simulation and exact main-camera projections; not a device render pass'};
 return {spec,field};
}
