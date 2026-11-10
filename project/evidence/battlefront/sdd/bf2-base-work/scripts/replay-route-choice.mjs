/** Input-only physical-fork proof. All gameplay state changes come from createGame/stepGame. */
import {getOptionalMission} from '../src/content/optional-records.js';
import {createWorld} from '../src/campaign-world.js';
import {createGame,stepGame,retry} from '../src/campaign-simulation.js';
import {pointInZone} from '../src/mission-runtime.js';
import {getTankTransform,DEFAULT_CONFIG} from '../src/tank-controller.js';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const DT=1/60,wrap=x=>Math.atan2(Math.sin(x),Math.cos(x)),clamp=(x,a=-1,b=1)=>Math.max(a,Math.min(b,x));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const outDir=fileURLToPath(new URL('../qa/route-choice/',import.meta.url));
await mkdir(outDir,{recursive:true});
const args=process.argv.slice(2),option=k=>args.find(a=>a.startsWith(k+'='))?.slice(k.length+1);
const authoredSpec=getOptionalMission('warehouse-fork'),variant=option('--variant')??null;
if(variant&&!['entry-screen'].includes(variant))throw new Error('Unknown counterfactual variant '+variant);
if(variant&&!option('--tag'))throw new Error('Counterfactual variants require an explicit --tag to protect accepted baseline artifacts');
const spec=variant?JSON.parse(JSON.stringify(authoredSpec)):authoredSpec;
if(variant==='entry-screen'){const wall=spec.geometry.find(c=>c.id==='warehouse-screen');wall.z=-8;wall.depth=40;}
const allowedInputs=new Set(['start','throttle','steer','brake','aim','firePressed']);
if(option('--replay')){
 const data=JSON.parse(gunzipSync(await readFile(option('--replay'))));
 const replaySpec=data.counterfactual?data.spec:spec;
 if(hash(replaySpec)!==data.specHash)throw new Error('Trace spec mismatch');
 const world=createWorld(replaySpec);let state=createGame(replaySpec);
 for(const run of data.runs)for(let i=0;i<run.n;i++)state=stepGame(state,run.input,DT,world);
 const result={strategy:data.strategy,phase:state.phase,tick:state.tick,finalHash:hash(state),matches:hash(state)===data.finalHash};
 world.dispose();console.log(JSON.stringify(result));if(!result.matches)process.exitCode=1;
}else{
 const reports=[];
 for(const strategy of (option('--strategies')??'short,covered').split(',')){
  const world=createWorld(spec);let state=createGame(spec),failed=null,action='start',lastInput='',runs=[],checkpoints=[],events=[],frames=[];
  const metrics={choiceTick:null,releaseTick:null,arrivalTicks:{},distance:{lead:0,rear:0},actualExposedTicks:{lead:0,rear:0},potentialExposedTicks:{lead:0,rear:0},warehouseOccludedTicks:{lead:0,rear:0},middleWarehouseSamples:[],stopTicks:{lead:{},rear:{}},minimumTruckCenterSpacing:Infinity,minimumConservativeEnvelopeGap:Infinity,hostileShots:0,telegraphStarts:0,leadPassedGunTick:null,gunDestroyedTick:null,tankAwayResumed:[],crossedOtherZoneAfterChoice:false,driverPaceTicks:0,driverTurnTicks:0,driverBrakeTicks:0,driverMovingTicks:0,truckCollisionTicks:0};
  const initialSnapshot=()=>({phase:state.phase,tick:state.tick,selected:state.selectedConvoyChoiceId,gateAlive:state.entities['fork-gate'].alive,gateHp:state.entities['fork-gate'].hp,trucks:['lead','rear'].map(id=>({id,pose:state.entities[id].pose,hp:state.entities[id].hp,arrived:state.entities[id].arrived}))});
  const initial=initialSnapshot();
  const snapshot=()=>({tick:state.tick,phase:state.phase,pose:state.tank.pose,turret:state.tank.turret,blocked:state.tank.blocked,contacts:state.tankFrame.contacts,hp:state.tankCombat.hp,shots:state.tankCombat.shotsFired,selected:state.selectedConvoyChoiceId,objectives:state.objectiveStates,entities:Object.values(state.entities).map(e=>({id:e.id,hp:e.hp,pose:e.pose,alive:e.alive,arrived:e.arrived,routeIndex:e.routeIndex,routeId:e.routeId,status:e.status,stoppedReason:e.stoppedReason}))});
  const checkpoint=(kind,extra={})=>{checkpoints.push({kind,...extra,...snapshot()});console.log(JSON.stringify({strategy,kind,...extra,tick:state.tick,phase:state.phase,hp:state.tankCombat.hp,pose:state.tank.pose,contacts:state.tankFrame.contacts}));};
  const tick=input=>{
   for(const key of Object.keys(input))if(!allowedInputs.has(key))throw new Error('Non-control input '+key);
   const encoded=JSON.stringify(input);if(encoded===lastInput)runs.at(-1).n++;else{runs.push({n:1,input});lastInput=encoded;}
   const previous=state;state=stepGame(state,input,DT,world);
   if(state.tick===previous.tick)return;
   const gun=state.entities['street-gun'];
   if(gun.status==='charging'&&(previous.entities['street-gun'].status!=='charging'||previous.entities['street-gun'].targetId!==gun.targetId))metrics.telegraphStarts++;
   for(const e of state.events){events.push({...e,action,targetId:e.type==='shot'&&e.entityId==='street-gun'?gun.targetId:e.targetId});if(e.type==='convoy-route-selected')metrics.choiceTick=e.tick;if(e.type==='vehicle-arrived')metrics.arrivalTicks[e.entityId]=e.tick;if(e.type==='shot'&&e.entityId==='street-gun')metrics.hostileShots++;if(e.type==='destroyed'&&e.entityId==='street-gun')metrics.gunDestroyedTick=e.tick;}
   if(state.selectedConvoyChoiceId&&spec.convoyChoice.options.some(o=>o.id!==state.selectedConvoyChoiceId&&pointInZone(state.tank.pose,spec.zones.find(z=>z.id===o.zoneId))))metrics.crossedOtherZoneAfterChoice=true;
   if(metrics.leadPassedGunTick===null&&state.entities.lead.pose.z<gun.pose.z)metrics.leadPassedGunTick=state.tick;
   const rays={};
   for(const id of ['lead','rear']){
    const truck=state.entities[id],before=previous.entities[id],delta=distance(truck.pose,before.pose);metrics.distance[id]+=delta;
    if(delta>1e-9&&metrics.releaseTick===null)metrics.releaseTick=state.tick;
    if(metrics.choiceTick!==null&&!truck.arrived){const reason=truck.stoppedReason??truck.status;metrics.stopTicks[id][reason]=(metrics.stopTicks[id][reason]??0)+1;}
    if(before.stoppedReason==='tank-away'&&truck.status==='moving')metrics.tankAwayResumed.push({tick:state.tick,truckId:id});
    const from={x:gun.pose.x,y:gun.pose.y+1.3,z:gun.pose.z},to={x:truck.pose.x,y:truck.pose.y+.8,z:truck.pose.z},range=Math.hypot(from.x-to.x,from.y-to.y,from.z-to.z),hit=world.raycast(from,to,[gun.id,id]);
    const inRange=range<=gun.range,clear=!hit;rays[id]={inRange,hitId:hit?.id??null,range};
    if(metrics.choiceTick!==null&&!truck.arrived){
     if(inRange&&clear){metrics.potentialExposedTicks[id]++;if(gun.alive)metrics.actualExposedTicks[id]++;}
     if(inRange&&hit?.id==='warehouse-screen'&&gun.alive){metrics.warehouseOccludedTicks[id]++;if(Math.abs(truck.pose.x+18)<.2&&truck.pose.z<0&&truck.pose.z>-20&&state.tick%60===0)metrics.middleWarehouseSamples.push({tick:state.tick,truckId:id,pose:{...truck.pose},hp:truck.hp,ray:rays[id]});}
    }
   }
   const lead=state.entities.lead,rear=state.entities.rear,spacing=distance(lead.pose,rear.pose);
   metrics.minimumTruckCenterSpacing=Math.min(metrics.minimumTruckCenterSpacing,spacing);
   metrics.minimumConservativeEnvelopeGap=Math.min(metrics.minimumConservativeEnvelopeGap,spacing-(Math.hypot(lead.width,lead.depth)+Math.hypot(rear.width,rear.depth))/2);
   if(state.tankFrame.contacts.some(id=>id==='lead'||id==='rear'))metrics.truckCollisionTicks++;
   frames.push({tick:state.tick,action,tank:{pose:state.tank.pose,hp:state.tankCombat.hp,contacts:state.tankFrame.contacts},choice:state.selectedConvoyChoiceId,gun:{alive:gun.alive,hp:gun.hp,status:gun.status,targetId:gun.targetId},trucks:['lead','rear'].map(id=>{const e=state.entities[id];return{id,pose:e.pose,hp:e.hp,routeId:e.routeId,routeIndex:e.routeIndex,arrived:e.arrived,status:e.status,stoppedReason:e.stoppedReason,acceptedDistance:metrics.distance[id],ray:rays[id]};})});
  };
  const playing=()=>state.phase==='playing'&&!failed;
  const brakeToStop=()=>{let n=0;while(playing()&&(Math.abs(state.tank.vL)>.01||Math.abs(state.tank.vR)>.01)&&n++<180)tick({brake:true});};
  function drive(target,{pace=true}={}){
   if(!playing()||distance(target,state.tank.pose)<.4)return;
   action=`drive ${target.x},${target.z}`;brakeToStop();let n=0,unchanged=0,last={...state.tank.pose};
   const origin={...state.tank.pose},heading=Math.atan2(-(target.x-origin.x),-(target.z-origin.z));
   const headingX=-Math.sin(heading),headingZ=-Math.cos(heading);let mode='turn';
   while(playing()&&n++<7200){
    const p=state.tank.pose,angle=wrap(heading-p.yaw),yawRate=(state.tank.vR-state.tank.vL)/DEFAULT_CONFIG.trackGauge;
    const along=(target.x-p.x)*headingX+(target.z-p.z)*headingZ,speed=(state.tank.vL+state.tank.vR)/2;
    const activeTrucks=Object.values(state.entities).filter(e=>e.kind==='truck'&&e.alive&&!e.arrived&&state.selectedConvoyChoiceId);
    const lag=pace&&activeTrucks.find(e=>distance(e.pose,p)>31&&distance(e.pose,target)>distance(e.pose,p)+.1);
    const aheadTruck=activeTrucks.find(e=>{const dx=e.pose.x-p.x,dz=e.pose.z-p.z;return dx*headingX+dz*headingZ>0&&Math.abs(dx*headingZ-dz*headingX)<2.5&&distance(e.pose,p)<7;});
    let input={};
    if(mode==='turn'){
     if(Math.abs(angle)<.012&&Math.abs(yawRate)<.035){mode='drive';continue;}
     const desiredYaw=Math.sign(angle)*Math.min(.7,Math.sqrt(2*.75*Math.abs(angle)));input.steer=-clamp(desiredYaw/.7);metrics.driverTurnTicks++;
    }else if(mode==='stop'||along<Math.max(.18,speed*speed/(2*3.2)+.18)){
     mode='stop';input.brake=true;metrics.driverBrakeTicks++;
     if(Math.abs(speed)<.015&&Math.abs(yawRate)<.015)break;
    }else if(lag||aheadTruck){input.brake=true;metrics.driverPaceTicks++;}
    else{input.throttle=1;input.steer=-clamp(angle*2-yawRate*1.5);metrics.driverMovingTicks++;}
    tick(input);
    if(distance(last,state.tank.pose)<.0005&&Math.abs(wrap(last.yaw-state.tank.pose.yaw))<.0005&&!lag&&!aheadTruck)unchanged++;else unchanged=0;
    last={...state.tank.pose};if(unchanged>180){failed={kind:'bot-inconclusive',reason:'drive-no-motion',target,action,mode};break;}
   }
   if(n>=7200)failed={kind:'bot-inconclusive',reason:'drive-budget',target,action,mode};
   checkpoint('drive',{target,steps:n,...failed?{failure:failed}:{}});
  }
  function shoot(targetId){
   if(!playing()||!state.entities[targetId]?.alive)return;
   action=`shoot ${targetId}`;brakeToStop();const target=state.entities[targetId],aim={worldPoint:{x:target.pose.x,y:1.1,z:target.pose.z}};let n=0,shotsAtLastDamage=state.tankCombat.shotsFired,lastHp=target.hp;
   while(playing()&&state.entities[targetId].alive&&n++<900){
    const m=getTankTransform(state.tank,DEFAULT_CONFIG.rig),dx=aim.worldPoint.x-m.position.x,dy=aim.worldPoint.y-m.position.y,dz=aim.worldPoint.z-m.position.z,l=Math.hypot(dx,dy,dz),dot=(dx*m.direction.x+dy*m.direction.y+dz*m.direction.z)/l;
    const hit=world.raycast(m.position,aim.worldPoint,['tank']);tick({brake:true,aim,firePressed:dot>.9995&&(!hit||hit.id===targetId)});
    if(state.entities[targetId].hp<lastHp){lastHp=state.entities[targetId].hp;shotsAtLastDamage=state.tankCombat.shotsFired;}
    if(state.tankCombat.shotsFired-shotsAtLastDamage>4){failed={kind:'bot-inconclusive',reason:'ineffective-fire',targetId,action};break;}
   }
   if(n>=900)failed={kind:'bot-inconclusive',reason:'aim-or-shot-blocked',targetId,action};checkpoint('shoot',{targetId,steps:n,...failed?{failure:failed}:{}});
  }
  tick({start:true});shoot('fork-gate');
  if(strategy==='short'||strategy==='short-flank'){
   drive({x:0,z:6});drive({x:4,z:0});drive({x:4,z:-34});
   if(playing()&&state.entities.lead.pose.z>=state.entities['street-gun'].pose.z)failed={kind:'bot-inconclusive',reason:'lead-not-yet-passed-gun',action};
   if(playing()&&strategy==='short-flank')shoot('street-gun');
   drive({x:0,z:-43});
  }else if(strategy==='covered'){
   drive({x:0,z:14});drive({x:-12,z:14});drive({x:-22,z:14});drive({x:-22,z:-34});drive({x:0,z:-43});
  }else if(strategy==='short-probes'){
   drive({x:0,z:6},{pace:false});drive({x:0,z:-34},{pace:false});checkpoint('intentional-overextension');
   drive({x:18,z:-34},{pace:false});if(state.entities.lead.pose.z<state.entities['street-gun'].pose.z)shoot('street-gun');
   drive({x:18,z:12},{pace:false});checkpoint('escort-return');
   drive({x:-12,z:14},{pace:false});checkpoint('cross-other-choice-zone');
  }else throw new Error('Unknown strategy '+strategy);
  if(playing()&&strategy!=='short-probes'){
   action='hold depot clear for physical arrivals';let n=0;
   while(playing()&&n++<6000)tick({brake:true});
   if(n>=6000)failed={kind:'bot-inconclusive',reason:'depot-arrival-budget',action};checkpoint('depot-arrivals',{steps:n});
  }
  metrics.lastArrivalTick=Object.keys(metrics.arrivalTicks).length===2?Math.max(...Object.values(metrics.arrivalTicks)):null;
  metrics.releaseToLastArrivalTicks=metrics.lastArrivalTick!==null&&metrics.releaseTick!==null?metrics.lastArrivalTick-metrics.releaseTick:null;
  const retryState=retry(spec),retryChecks={freshMatchesInitial:hash(retryState)===hash(createGame(spec)),latchReset:retryState.selectedConvoyChoiceId===null,gateRestored:retryState.entities['fork-gate'].alive&&retryState.entities['fork-gate'].hp===90,truckStartsRestored:['lead','rear'].every(id=>retryState.entities[id].pose.x===spec.entities.find(e=>e.id===id).pose.x&&retryState.entities[id].pose.z===spec.entities.find(e=>e.id===id).pose.z&&!retryState.entities[id].arrived)};
  const stem=option('--tag')?`${option('--tag')}-${strategy}`:strategy,finalHash=hash(state);
  const report={schema:1,strategy,variant,counterfactual:Boolean(variant),authoredSpecHash:hash(authoredSpec),missionId:spec.id,specHash:hash(spec),phase:state.phase,status:strategy==='short-probes'&&!failed&&metrics.tankAwayResumed.length>0&&metrics.crossedOtherZoneAfterChoice?'diagnostic-passed':state.phase==='won'?'won':state.phase==='lost'?'lost':'bot-inconclusive',tick:state.tick,simulatedSeconds:state.elapsed,tankHp:state.tankCombat.hp,truckHp:{lead:state.entities.lead.hp,rear:state.entities.rear.hp},gunAliveAtEnd:state.entities['street-gun'].alive,result:state.result,failed,metrics,retryChecks,initial,finalHash,traceFile:`${stem}-inputs.json.gz`,framesFile:`${stem}-frames.json.gz`,checkpoints,events};
  await writeFile(`${outDir}${stem}-inputs.json.gz`,gzipSync(JSON.stringify({schema:1,dt:DT,strategy,variant,counterfactual:Boolean(variant),...(variant?{spec}:{}),missionId:spec.id,specHash:hash(spec),runs,finalHash})));
  await writeFile(`${outDir}${stem}-frames.json.gz`,gzipSync(JSON.stringify({schema:1,frames})));
  await writeFile(`${outDir}${stem}-final-state.json`,JSON.stringify(state,null,2));
  await writeFile(`${outDir}${stem}-report.json`,JSON.stringify(report,null,2));reports.push(report);world.dispose();
  console.log(JSON.stringify({RESULT:strategy,status:report.status,tick:state.tick,tankHp:report.tankHp,truckHp:report.truckHp,failed,metrics}));
 }
 const short=reports.find(r=>r.strategy==='short'),covered=reports.find(r=>r.strategy==='covered');
 const comparison=short&&covered?{distanceRatio:(covered.metrics.distance.lead+covered.metrics.distance.rear)/(short.metrics.distance.lead+short.metrics.distance.rear),releaseTimeRatio:covered.metrics.releaseToLastArrivalTicks/short.metrics.releaseToLastArrivalTicks,actualExposureRatio:(covered.metrics.actualExposedTicks.lead+covered.metrics.actualExposedTicks.rear)/(short.metrics.actualExposedTicks.lead+short.metrics.actualExposedTicks.rear),potentialExposureRatio:(covered.metrics.potentialExposedTicks.lead+covered.metrics.potentialExposedTicks.rear)/(short.metrics.potentialExposedTicks.lead+short.metrics.potentialExposedTicks.rear)}:null;
 const summary={schema:1,variant,counterfactual:Boolean(variant),reports:reports.map(({checkpoints,events,...r})=>r),comparison,limitations:['Headless deterministic simulation only; visual clarity and human playability remain unverified.','Depot holds wait only for genuinely moving convoy; pacing and steering overhead are measured, not subtracted.']};
 await writeFile(`${outDir}${option('--tag')?option('--tag')+'-':''}summary.json`,JSON.stringify(summary,null,2));
 if(reports.some(r=>!['won','diagnostic-passed'].includes(r.status)))process.exitCode=1;
}
