import {createScorchedFront} from './scorched-front.js';
import {sampleGroundContact} from './terrain-candidate/heightfield.js';
/** Optional team encounter; the original sortie and its terrain/routes remain unchanged.
 * Support delays a western flanker, but neither vehicle is an escort objective.
 * Static positions keep live vehicles and persistent wrecks off the convoy lane.
 * Unshielded 110HP/12-damage combat leaves a readable exchange, not an instant kill.
 */
export function createCrossfireFront(){
 const {spec,field}=createScorchedFront();
 spec.id='mission-9050';spec.index=9050;spec.crossfireFront=true;
 spec.title='焦土交叉火线 · 协同护送';
 spec.briefing='护送补给车穿过焦土货运站，到达北侧接应区。蓝方支援车在西路外侧牵制敌方侧翼车，双方会真实交火；支援车不是护送目标，损失它不会直接失败。东侧硬路短但有敌车封锁，西侧绕行可借山脊掩护。按 H 或点车队待命，先侦察再推进。友军会挡住炮弹：不要朝补给车或支援车开火，也不要挡在友军炮口前。无需消灭所有敌人，别让敌车残骸堵住车队路线。';
 spec.combatRelations={version:1,playerTeam:'allied',teams:['allied','hostile'],hostilePairs:[['allied','hostile'],['hostile','allied']],friendlyFire:'absorb'};
 spec.entities=spec.entities.map(e=>({...e,team:e.kind==='truck'?'allied':'hostile'}));
 const vehicle=(id,team,x,z,yaw,chargeTime,reload,range)=>{
  const ground=sampleGroundContact(field,x,z,yaw);
  return {id,kind:'turret',vehicle:'pz3',team,pose:{x,y:ground.height+.008,z,yaw},hp:110,protected:false,damage:12,chargeTime,reload,range,shieldArc:0,radius:2.2,width:1.921792,depth:3.532506,height:1.7,speed:0,travel:0};
 };
 spec.entities.push(vehicle('allied-support','allied',-27,2,0,2.4,5,26),vehicle('hostile-flanker','hostile',-27,-19,Math.PI,2,4.2,22));
 spec.design={...spec.design,teamEncounter:'allied support exchanges fire with hostile western flanker; neither is a victory target',supportRole:'temporary distraction, not invulnerable escort replacement',friendlyFireRule:'allied bodies absorb shells without friendly damage',newVehiclePositions:'stationary west of convoy centreline; persistent wrecks remain off lane'};
 return {spec,field};
}
