import {createVerticalSlice} from './terrain-candidate/vertical-slice.js';
import {sampleHeightfield} from './terrain-candidate/heightfield.js';
/** Isolated optional sortie. No edits to the campaign registry or old builders. */
export function createScorchedFront(){
 const {spec,field}=createVerticalSlice();
 spec.id='mission-9040';spec.index=9040;spec.optional=true;spec.scorchedFront=true;spec.livingWorld=false;
 spec.title='焦土货运站 · 穿越封锁';
 spec.briefing='护送补给车穿过废弃货运站，到达北侧接应区。东侧硬路短，但装甲巡逻车封锁路口；西侧泥路较长，中央山脊可遮挡炮火。东路外沿的混凝土断墙是真实掩体，不能碾碎；西侧木栅仍可履带压开。按 H 或点车队待命，先侦察再让车队前进。远处烟柱只是环境，不会挡住敌人的视线。无需消灭所有敌人，别把敌车残骸堵在车队路线上。';
 const walls=[
  {id:'scorched-east-cover',x:19.5,z:9,width:.7,depth:4,height:1.8},
  {id:'scorched-east-low-wall',x:19.5,z:-4,width:.8,depth:3,height:1.05},
  {id:'scorched-west-remnant',x:-30,z:7,width:5,depth:.8,height:1.65}
 ].map(c=>({...c,kind:'box',y:sampleHeightfield(field,c.x,c.z).height}));
 spec.geometry.push(...walls);
 spec.sceneDressing={...spec.sceneDressing,appearance:'scorched',scorchedSources:[{id:'depot-soot',x:-27,z:29,baseHeight:4},{id:'garage-soot',x:28,z:-31,baseHeight:3.2}]};
 spec.design={...spec.design,ecologyRole:'none: barren industrial ground',environmentRole:'solid cover and cosmetic distant smoke; no smoke occlusion or fire damage',terrainChange:'none; original shared field retained',newCoverIds:walls.map(c=>c.id)};
 return {spec,field};
}
