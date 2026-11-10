/** Input-only campaign playthrough. Never writes poses, health, entities or objectives. */
import {getActions} from './crafted20-plans.mjs';
import {getCraftedMission as getMission} from '../src/content/crafted20/index.js';
import {createWorld} from '../src/campaign-world.js';
import {createGame,stepGame} from '../src/campaign-simulation.js';
import {getTankTransform,DEFAULT_CONFIG} from '../src/tank-controller.js';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const DT=1/60,wrap=x=>Math.atan2(Math.sin(x),Math.cos(x)),clamp=(x,a=-1,b=1)=>Math.max(a,Math.min(b,x));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const outDir=fileURLToPath(new URL('../qa/crafted20-playthrough/',import.meta.url));
await mkdir(outDir,{recursive:true});
const sourceRoot=new URL('../src/',import.meta.url);
const sourcePaths=['campaign-simulation.js','campaign-world.js','tank-controller.js','combat.js','mission-runtime.js','sentry-rig.js','content/geometry.js','content/validate.js',...(await readdir(new URL('content/crafted20/',sourceRoot))).filter(p=>p.endsWith('.js')).map(p=>'content/crafted20/'+p)].sort();
const sourceHashes=Object.fromEntries(await Promise.all(sourcePaths.map(async p=>[p,hash(await readFile(new URL(p,sourceRoot),'utf8'))])));
const driverHash=hash(await readFile(fileURLToPath(import.meta.url),'utf8')),plansHash=hash(await readFile(new URL('./crafted20-plans.mjs',import.meta.url),'utf8'));
const args=process.argv.slice(2),option=k=>args.find(a=>a.startsWith(k+'='))?.slice(k.length+1);
if(option('--replay')){
 const input=JSON.parse(gunzipSync(await readFile(option('--replay'))));
 const spec=getMission(input.missionId),world=createWorld(spec);let state=createGame(spec);
 for(const run of input.runs)for(let i=0;i<run.n;i++)state=stepGame(state,run.input,DT,world);
 const result={missionId:input.missionId,phase:state.phase,tick:state.tick,hash:hash(state),specMatches:hash(spec)===input.specHash,sourceMatches:input.sourceHashes?hash(sourceHashes)===hash(input.sourceHashes):null,matches:hash(state)===input.finalHash};
 world.dispose();console.log(JSON.stringify(result));if(!result.matches)process.exitCode=1;
}else{
 const ids=(option('--ids')??'001,002,003,004,005,006,007,008,009,010,011,012,013,014,015,016,017,018,019,020').split(',').map(id=>id.startsWith('crafted20-')?id:'crafted20-'+id.padStart(3,'0'));
 const tag=option('--tag')??'latest';const reports=[];
 for(const missionId of ids){
  const spec=getMission(missionId);if(!spec)throw new Error('Unknown '+missionId);
  const world=createWorld(spec);let state=createGame(spec),failed=null,metrics={distance:0,movingTicks:0,stationaryTicks:0,contactTicks:0,firstShotTick:null,firstObjectiveTick:null,hostileShots:0,tankTargetedTicks:0,truckTargetedTicks:0,truckWaiting:{}},action='start',lastInput='',runs=[],checkpoints=[],events=[];
  const tick=input=>{
   const encoded=JSON.stringify(input);if(encoded===lastInput)runs.at(-1).n++;else{runs.push({n:1,input});lastInput=encoded;}
   const before=state.tank.pose;state=stepGame(state,input,DT,world);
   const moved=distance(before,state.tank.pose);metrics.distance+=moved;if(moved>.001)metrics.movingTicks++;else metrics.stationaryTicks++;if(state.tankFrame.contacts.length)metrics.contactTicks++;
   for(const e of state.entities?Object.values(state.entities):[])if(e.kind==='truck'&&!e.arrived&&e.stoppedReason){const k=e.id+':'+e.stoppedReason;metrics.truckWaiting[k]=(metrics.truckWaiting[k]||0)+1;}
   if(Object.values(state.entities).some(e=>e.alive&&e.status==='charging'&&e.targetId==='tank'))metrics.tankTargetedTicks++;if(Object.values(state.entities).some(e=>e.alive&&e.status==='charging'&&e.targetId&&e.targetId!=='tank'))metrics.truckTargetedTicks++;
   for(const e of state.events){if(e.type==='shot'){if(e.entityId==='tank'&&metrics.firstShotTick===null)metrics.firstShotTick=state.tick;else if(e.entityId!=='tank')metrics.hostileShots++;}if(e.type==='objective-changed'&&e.value==='complete'&&metrics.firstObjectiveTick===null)metrics.firstObjectiveTick=state.tick;}
   for(const e of state.events)if(['damaged','destroyed','objective-changed','vehicle-arrived','mission-ended','impact'].includes(e.type))events.push({...e,action});
  };
  const snapshot=()=>({tick:state.tick,phase:state.phase,pose:state.tank.pose,turret:state.tank.turret,blocked:state.tank.blocked,contacts:state.tankFrame.contacts,hp:state.tankCombat.hp,shots:state.tankCombat.shotsFired,objectives:state.objectiveStates,entities:Object.values(state.entities).map(e=>({id:e.id,hp:e.hp,pose:e.pose,arrived:e.arrived,routeIndex:e.routeIndex,status:e.status,stoppedReason:e.stoppedReason}))});
  const checkpoint=(kind,extra={})=>{const cp={kind,...extra,...snapshot()};checkpoints.push(cp);console.log(JSON.stringify({missionId,kind,...extra,tick:state.tick,phase:state.phase,hp:state.tankCombat.hp,pose:state.tank.pose,contacts:state.tankFrame.contacts}));};
  const playing=()=>state.phase==='playing'&&!failed;
  const idle=(n=24)=>{for(let i=0;i<n&&playing();i++)tick({brake:true,governor:'travel'});};
  const alignGun=()=>{
   if(!playing())return;idle();let n=0;
   while(playing()&&Math.abs(state.tank.turret.yawRel)>.015&&n++<600){const p=state.tank.pose;tick({brake:true,aim:{worldPoint:{x:p.x-Math.sin(p.yaw)*30,y:1,z:p.z-Math.cos(p.yaw)*30}},governor:'travel'});}
   if(n>=600){failed={kind:'bot-inconclusive',reason:'gun-alignment-blocked',action};checkpoint('failure',failed);}
  };
  const drivenTargets=[{x:spec.spawn.x,z:spec.spawn.z}];
  const mobileTrucks=()=>Object.values(state.entities).filter(e=>e.kind==='truck'&&e.alive&&!e.arrived&&(!e.activationObjectiveId||state.objectiveStates[e.activationObjectiveId]?.status==='complete'));
  function drive(target,{pace=true,reverse=false}={}){
   if(!playing()||distance(target,state.tank.pose)<.45)return;
   action=`drive ${target.x},${target.z}`;alignGun();let n=0,unchanged=0,last={...state.tank.pose};
   const origin={...state.tank.pose},pathHeading=Math.atan2(-(target.x-origin.x),-(target.z-origin.z)),heading=wrap(pathHeading+(reverse?Math.PI:0));
   const headingX=-Math.sin(pathHeading),headingZ=-Math.cos(pathHeading);
   let mode='turn';
   while(playing()&&n++<9000){
    const p=state.tank.pose,dist=distance(target,p),angle=wrap(heading-p.yaw),yawRate=(state.tank.vR-state.tank.vL)/DEFAULT_CONFIG.trackGauge;
    const along=(target.x-p.x)*headingX+(target.z-p.z)*headingZ,speed=(state.tank.vL+state.tank.vR)/2*(reverse?-1:1);
    const lag=pace&&mobileTrucks().find(e=>((e.pose.x-p.x)*headingX+(e.pose.z-p.z)*headingZ)<-1&&distance(e.pose,p)>(e.escortRange??22)-3&&distance(e.pose,target)>distance(e.pose,p)+.2);
    const aheadTruck=mobileTrucks().find(e=>{const dx=e.pose.x-p.x,dz=e.pose.z-p.z;return dx*headingX+dz*headingZ>0&&Math.abs(dx*headingZ-dz*headingX)<2.4&&distance(e.pose,p)<8;});
    let input={governor:'travel'};
    if(mode==='turn'){
     if(Math.abs(angle)<.012&&Math.abs(yawRate)<.035){idle(12);mode='drive';continue;}
     const desiredYaw=Math.sign(angle)*Math.min(.7,Math.sqrt(2*.75*Math.abs(angle)));
     input.steer=-clamp(desiredYaw/.7);
    }else if(mode==='stop'||along<Math.max(.2,speed*speed/(2*3.2)+.2)){
     mode='stop';input.brake=true;
     if(Math.abs(speed)<.015&&Math.abs(yawRate)<.015)break;
    }else if(lag||aheadTruck){input.brake=true;}
    else{input.throttle=reverse?-1:1;input.steer=-clamp(angle*2-yawRate*1.5);}
    tick(input);
    if(distance(last,state.tank.pose)<.0005&&Math.abs(wrap(last.yaw-state.tank.pose.yaw))<.0005&&!lag&&!aheadTruck)unchanged++;else unchanged=0;
    last={...state.tank.pose};
    if(unchanged>180){failed={kind:'bot-inconclusive',reason:'drive-no-motion',target,action,mode};break;}
   }
   if(n>=9000)failed={kind:'bot-inconclusive',reason:'drive-budget',target,action,mode};
   checkpoint('drive',{target,steps:n,...failed?{failure:failed}:{}});if(!failed)drivenTargets.push({x:target.x,z:target.z});
  }
  function rejoinReleasedTruck(){
   const lag=mobileTrucks().find(e=>e.pose.z>state.tank.pose.z+1&&distance(e.pose,state.tank.pose)>(e.escortRange??22));
   if(!lag||!playing())return;
   const history=drivenTargets.map(p=>({...p})),returnPoints=[];const origin={x:state.tank.pose.x,z:state.tank.pose.z};
   checkpoint('rejoin-start',{truckId:lag.id});
   for(const point of history.reverse()){
    if(distance(state.entities[lag.id].pose,state.tank.pose)<17)break;
    if(distance(point,state.tank.pose)>.45){returnPoints.push({x:state.tank.pose.x,z:state.tank.pose.z});drive(point,{pace:false});}
   }
   if(distance(state.entities[lag.id].pose,state.tank.pose)>(lag.escortRange??22)){
    failed={kind:'bot-inconclusive',reason:'no-rejoin-history',truckId:lag.id};return;
   }
   for(const point of returnPoints.reverse())drive(point);
   checkpoint('rejoin-end',{truckId:lag.id});
  }
  function shoot(targetId){
   if(!playing()||!state.entities[targetId]?.alive)return;
   action=`shoot ${targetId}`;idle();const target=state.entities[targetId],aim={worldPoint:{x:target.pose.x,y:1.1,z:target.pose.z}};let n=0,shotsAtLastDamage=state.tankCombat.shotsFired,lastHp=target.hp;
   while(playing()&&state.entities[targetId].alive&&n++<900){
    const m=getTankTransform(state.tank,DEFAULT_CONFIG.rig),dx=aim.worldPoint.x-m.position.x,dy=aim.worldPoint.y-m.position.y,dz=aim.worldPoint.z-m.position.z,l=Math.hypot(dx,dy,dz);
    const dot=(dx*m.direction.x+dy*m.direction.y+dz*m.direction.z)/l;
    const hit=world.raycast(m.position,aim.worldPoint,['tank']);
    tick({governor:'travel',brake:true,aim,firePressed:dot>.9995&&(!hit||hit.id===targetId)});
    if(state.entities[targetId].hp<lastHp){lastHp=state.entities[targetId].hp;shotsAtLastDamage=state.tankCombat.shotsFired;}
    if(state.tankCombat.shotsFired-shotsAtLastDamage>4){failed={kind:'bot-inconclusive',reason:'ineffective-fire',targetId,action};break;}
   }
   if(n>=900)failed={kind:'bot-inconclusive',reason:'aim-or-shot-blocked',targetId,action};
   checkpoint('shoot',{targetId,steps:n,...failed?{failure:failed}:{}});
  }
  function escortWait(targetIds,destination){
   if(!playing()||targetIds.every(id=>state.entities[id].arrived))return;
   drive({x:destination.x,z:destination.z},{pace:true});
   if(targetIds.length===1){const truck=state.entities[targetIds[0]],route=spec.routes.find(r=>r.id===truck.routeId);if(route?.points.length>1&&!truck.arrived){const end=route.points.at(-1),prior=route.points.at(-2),length=distance(end,prior);if(distance(state.tank.pose,end)<4&&length>0)drive({x:end.x+7*(end.x-prior.x)/length,z:end.z+7*(end.z-prior.z)/length},{pace:true});}}
   action='yield '+targetIds.join(',');alignGun();let n=0;
   while(playing()&&!targetIds.every(id=>state.entities[id].arrived)&&n++<9000)tick({governor:'travel',brake:true});
   if(n>=9000)failed={kind:'bot-inconclusive',reason:'escort-wait-budget',targetIds,action};checkpoint('escort-wait',{targetIds,steps:n,...failed?{failure:failed}:{}});
  }
  tick({start:true});
  const custom=getActions(missionId,option('--plan'));
  if(custom)for(const a of custom){if(!playing())break;if(a[0]==='drive')drive({x:a[1],z:a[2]},a[3]);if(a[0]==='shoot')shoot(a[1]);if(a[0]==='idle')idle(a[1]);if(a[0]==='wait')escortWait(a[1],{...state.tank.pose});checkpoint('planned-action',{plan:option('--plan'),instruction:a});}
  else for(const phase of spec.witness.phases){
   if(!playing())break;
   rejoinReleasedTruck();
   const objective=spec.objectives.find(o=>o.id===phase.objectiveId);
   if(state.objectiveStates[objective.id].status==='complete')continue;
   let points=phase.tankWaypoints.filter((v,i,a)=>!i||v.x!==a[i-1].x||v.z!==a[i-1].z).map(v=>({...v}));
   for(const point of points){drive(point);for(const shot of [...(phase.firingPoses??[]),...Object.values(state.entities).filter(e=>spec.objectiveGraphId==='choose-breach-order'&&e.kind==='turret'&&(!e.activationObjectiveId||state.objectiveStates[e.activationObjectiveId]?.status==='complete')).map(e=>({targetId:e.id}))]){const e=state.entities[shot.targetId],p=state.tank.pose;if(!(spec.objectiveGraphId==='rearguard-withdrawal'&&objective.id==='cover-withdrawal'&&state.tank.pose.x<6)&&e?.alive&&e.kind!=='barrier'&&distance(e.pose,p)>5&&distance(e.pose,p)<30){const toward={x:p.x-e.pose.x,z:p.z-e.pose.z},length=Math.hypot(toward.x,toward.z);const shield=(-Math.sin(e.pose.yaw)*toward.x-Math.cos(e.pose.yaw)*toward.z)/length>Math.cos(e.shieldArc/2);const hit=world.raycast({x:p.x,y:1.1,z:p.z},{x:e.pose.x,y:1.1,z:e.pose.z},['tank']);if(!shield&&(!hit||hit.id===e.id))shoot(e.id);}}if(state.objectiveStates[objective.id].status==='complete')break;}
   for(const shot of phase.firingPoses??[])shoot(shot.targetId);
   if(objective.type==='escort')escortWait(objective.targetIds,points.at(-1));
   checkpoint('phase',{objectiveId:objective.id});
  }
  const finalHash=hash(state),stem=`${tag}-${missionId}`,tracePath=`${outDir}${stem}-inputs.json.gz`;
  await writeFile(tracePath,gzipSync(JSON.stringify({schema:2,dt:DT,missionId,specHash:hash(spec),sourceHashes,driverHash,plansHash,runs,finalHash})));
  await writeFile(`${outDir}${stem}-final-state.json`,JSON.stringify(state,null,2));
  const report={schema:2,missionId,specHash:hash(spec),sourceHashes,driverHash,plansHash,metrics,plan:option('--plan')??'witness',blueprintId:spec.blueprintId,objectiveGraphId:spec.objectiveGraphId,status:state.phase==='won'?'won':state.phase==='lost'?'lost':'bot-inconclusive',phase:state.phase,tick:state.tick,simulatedSeconds:state.elapsed,hp:state.tankCombat.hp,result:state.result,failed,finalHash,traceFile:tracePath,checkpoints,events};
  await writeFile(`${outDir}${stem}-report.json`,JSON.stringify(report,null,2));reports.push(report);world.dispose();
  console.log(JSON.stringify({RESULT:missionId,status:report.status,tick:state.tick,hp:state.tankCombat.hp,failed}));
 }
 await writeFile(`${outDir}${tag}-summary.json`,JSON.stringify(reports.map(({checkpoints,events,...r})=>r),null,2));
 if(reports.some(r=>r.status!=='won'))process.exitCode=1;
}
