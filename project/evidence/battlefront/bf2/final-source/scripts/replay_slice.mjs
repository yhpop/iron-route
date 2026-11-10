import {getMission} from '../src/content/index.js';import {createWorld} from '../src/campaign-world.js';import {createGame,stepGame} from '../src/campaign-simulation.js';import {getTankTransform,DEFAULT_CONFIG} from '../src/tank-controller.js';import {writeFile} from 'node:fs/promises';
const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x)),clamp=x=>Math.max(-1,Math.min(1,x));
const output=[];
for(const id of ['mission-001','mission-002','mission-003']){
 const spec=getMission(id),world=createWorld(spec);let s=stepGame(createGame(spec),{start:true},1/60,world);let aim=null;const checkpoints=[];
 function step(input={}){s=stepGame(s,{governor:'travel',...input,aim:aim?{worldPoint:aim}:undefined},1/60,world);}
 function drive(x,z,{pace=false}={}){let count=0;while(s.phase==='playing'&&count++<9000){const p=s.tank.pose,dist=Math.hypot(x-p.x,z-p.z);if(dist<.5){for(let k=0;k<30;k++)step({brake:true});break;}const a=wrap(Math.atan2(-(x-p.x),-(z-p.z))-p.yaw);const trucks=Object.values(s.entities).filter(e=>e.kind==='truck'&&!e.arrived);const lag=pace&&trucks.some(e=>Math.hypot(e.pose.x-p.x,e.pose.z-p.z)>18);step({throttle:Math.abs(a)<.55&&!lag?Math.min(1,dist/3):0,steer:-clamp(a*2.5),brake:lag});}checkpoints.push({kind:'drive',target:{x,z},ticks:count,pose:s.tank.pose,phase:s.phase,hp:s.tankCombat.hp});}
 function shoot(id){const e=s.entities[id];aim={x:e.pose.x,y:e.kind==='barrier'?1.1:1,z:e.pose.z};let count=0;while(s.phase==='playing'&&s.entities[id].alive&&count++<1200){const m=getTankTransform(s.tank,DEFAULT_CONFIG.rig),dx=aim.x-m.position.x,dy=aim.y-m.position.y,dz=aim.z-m.position.z,l=Math.hypot(dx,dy,dz);const dot=(dx*m.direction.x+dy*m.direction.y+dz*m.direction.z)/l;step({brake:true,firePressed:dot>.998});}checkpoints.push({kind:'shoot',target:id,ticks:count,hp:s.entities[id].hp,phase:s.phase,tankHp:s.tankCombat.hp});}
 if(id==='mission-001'){drive(0,10);shoot('freight-gate');drive(0,-6);drive(4,-10);drive(4,-27);for(let i=0;i<6000&&s.phase==='playing';i++)step({brake:true});}
 if(id==='mission-002'){drive(-14,27);drive(-14,-10);drive(-10,-10);shoot('shielded-turret');drive(-10,-30);drive(0,-30);}
 if(id==='mission-003'){drive(0,14);shoot('west-road-gun');drive(0,-2);shoot('east-road-gun');drive(8,-2);drive(8,6);for(let i=0;i<1800&&s.phase==='playing'&&s.entities['rear-supply'].pose.z>10;i++)step({brake:true});drive(8,-28,{pace:true});for(let i=0;i<6000&&s.phase==='playing'&&!s.entities['rear-supply'].arrived;i++)step({brake:true});drive(0,-28);}
 output.push({id,phase:s.phase,tick:s.tick,hp:s.tankCombat.hp,result:s.result,objectives:s.objectiveStates,entities:Object.values(s.entities).map(e=>({id:e.id,hp:e.hp,pose:e.pose,arrived:e.arrived,stoppedReason:e.stoppedReason})),checkpoints});world.dispose();
}
await writeFile(new URL('../qa/first-three-replay.json',import.meta.url),JSON.stringify(output,null,2));console.log(JSON.stringify(output.map(r=>({id:r.id,phase:r.phase,tick:r.tick,hp:r.hp,stuck:r.entities.filter(e=>e.stoppedReason)})),null,2));

if(output.some(r=>r.phase!=='won'))process.exitCode=1;
