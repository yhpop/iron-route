import {createInterceptorMission} from './interceptor-mission.js';
/** One coherent escort encounter; no changes to the authored campaign registry. */
export function createVerticalSlice(){
 const {spec,field}=createInterceptorMission();
 spec.id='mission-9030';spec.index=9030;spec.livingWorld=true;
 spec.title='林脊伏击 · 补给线';
 spec.briefing='任务是把补给车送到北部接应区，不必消灭所有敌人。先选路线：东侧硬路短，装甲巡逻车会在装填时沿路转移；西侧低地绕远，但中央山脊能挡住炮火，入口木栅可以履带压开。按 H 或点车队待命，先独自侦察，再回到车队附近继续护送。北端固定炮位封锁会合口，留意预警，借掩体绕侧或趁装填通过。不要把敌车残骸打在车队路线上；残骸会挡车挡弹。草地与狐狸不是掩体，也不需要攻击；履带会压弯草，附近炮声会惊走狐狸。';
 spec.design={...spec.design,integratedSlice:true,ecologyRole:'noncombat ambience, no collision or cover',enemyRole:'mobile east-road denial; north fixed overwatch',victoryRule:'escort only, no kill quota'};
 return {spec,field};
}
