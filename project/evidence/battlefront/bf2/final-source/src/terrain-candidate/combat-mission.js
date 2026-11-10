import {crushFlank} from '../content/crush-flank.js';
import {createHeightfield,sampleHeightfield,HEIGHTFIELD_PRESET} from './heightfield.js';
/** Existing mission/asset clone with smooth, level foundations. Original campaign remains untouched. */
export function createTerrainCombatMission(){
 const spec=JSON.parse(JSON.stringify(crushFlank)),raw=createHeightfield(HEIGHTFIELD_PRESET);
 const pads=[...spec.geometry.map(g=>({x:g.x,z:g.z,w:g.width||g.radius*2,d:g.depth||g.radius*2})),...spec.entities.map(e=>({x:e.pose.x,z:e.pose.z,w:3,d:3}))].map(p=>({...p,y:sampleHeightfield(raw,p.x,p.z).height}));
 const field=createHeightfield({...HEIGHTFIELD_PRESET,heightAt(x,z){let h=sampleHeightfield(raw,x,z).height;for(const p of pads){const distance=Math.hypot(Math.max(0,Math.abs(x-p.x)-p.w/2-.75),Math.max(0,Math.abs(z-p.z)-p.d/2-.75));if(distance<3){const t=Math.min(1,distance/3),blend=1-t*t*(3-2*t);h=h*(1-blend)+p.y*blend;}}return h;}});
 for(const g of spec.geometry)g.y=sampleHeightfield(field,g.x,g.z).height;
 for(const e of spec.entities)e.pose.y=sampleHeightfield(field,e.pose.x,e.pose.z).height;
 spec.id='mission-9004';spec.index=9004;spec.title='坡地侧翼 · 战斗整合候选';spec.terrainCombat=true;
 spec.briefing='原坦克与战斗系统的坡地整合候选：炮口、瞄准与弹丸共用坡面坐标，山坡可挡住射线。碾开低木栅，从侧翼攻击炮位后驶入北侧出口。建筑底座为平整地基。采用保守倾斜包围盒，无逐轮悬挂；当前未完成实机验收。';
 return {spec,field};
}
