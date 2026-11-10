import {createCrossfireV3Front} from './crossfire-v3-front.js';
import {sampleGroundContact} from './terrain-candidate/heightfield.js';
/** Independent opt-in V4: the existing combatants use production collision-swept
 * PzIII patrols. Weapons, terrain, convoy routes and the five chassis are unchanged.
 * Short routes were selected by actual 30-second compound-sweep/combat evidence. */
export function createCrossfireV4Front(){
 const {spec,field}=createCrossfireV3Front();
 spec.id='mission-9052';spec.index=9052;spec.crossfireV4=true;
 spec.title='焦土交叉火线 V4 · 机动接应';
 spec.briefing='护送补给车到达北侧接应区。开局前方的蓝方支援车与敌方侧翼车会真实交火；两车会在装填间歇沿短路线机动，瞄准蓄力时停车，遇到障碍也会停下。支援车不是护送目标，损失它不会直接失败。东侧硬路短但有敌车封锁，西侧绕行可借山脊掩护。按 H 或点车队待命，先侦察再推进。友军会挡住炮弹：不要朝补给车或支援车开火，也不要挡在友军炮口前。无需消灭所有敌人，别让敌车残骸堵住车队路线。';
 const patrols={'allied-support':[{x:-4,z:18},{x:-5,z:16}],'hostile-flanker':[{x:1.2,z:16},{x:0,z:16}]};
 // V4-only relocation avoids the inherited steep ridge: the authored PzIII
 // view is upright, so terrain fit was checked against its real mesh + treads.
 const support=spec.entities.find(e=>e.id==='allied-support').pose,p={x:1.2,z:16},yaw=Math.atan2(-(support.x-p.x),-(support.z-p.z)),ground=sampleGroundContact(field,p.x,p.z,yaw);
 spec.entities=spec.entities.map(e=>patrols[e.id]?{...e,...(e.id==='hostile-flanker'?{pose:{...p,y:ground.height+.008,yaw}}:{}),patrol:patrols[e.id]}:e);
 spec.design={...spec.design,teamEncounter:'visible opening exchange between two real moving off-lane combat vehicles',supportRole:'temporary distraction; collision-swept reload patrols, parked during charge; not an escort objective',newVehiclePositions:'short swept patrols off both convoy corridors; persistent wrecks remain solid',openingEvidence:'offline production simulation, compound sweeps and exact main-camera projections; not a GPU/CSS/device pass'};
 return {spec,field};
}
