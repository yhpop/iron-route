import {createRidgeConvoyMission} from './ridge-convoy.js';
/** Separate experiment; no default campaign or player asset is replaced. */
export function createInterceptorMission(){
 const {spec,field}=createRidgeConvoyMission();spec.id='mission-9006';spec.index=9006;spec.title='堤路护送 · 装甲巡逻队';
 spec.briefing='东路出现装甲巡逻车：它在装填时转移阵地，发现目标后停车瞄准，炮口预警锁定后可以闪避。不要正面对射；利用山脊断开视线，或趁它装填绕到侧后。车队可以待命，先侦察再决定走东侧硬路还是西侧低地。玩家仍驾驶原有坦克。';
 const e=spec.entities.find(e=>e.id==='road-gun');Object.assign(e,{vehicle:'pz3',radius:2.2,width:1.921792,depth:3.532506,height:1.7,hp:90,shieldArc:1.7,range:19,chargeTime:1.9,reload:4.5,damage:14,patrol:[{x:23,z:3},{x:23,z:-12}],patrolIndex:1,speed:0,travel:0});e.pose.yaw=0;
 return {spec,field};
}
