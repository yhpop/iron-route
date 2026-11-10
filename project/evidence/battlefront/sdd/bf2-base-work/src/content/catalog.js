import {BLUEPRINTS,auditBlueprints,navigationPath} from './blueprints.js';
import {box,rectangle,trace,yawTo} from './geometry.js';
import {canonicalObjectives} from './signatures.js';
const p=(x,z)=>({x,z});
const objective=(id,type,targetIds=[],requires=[],extra={})=>({id,type,targetIds,requires,nextIds:[],...extra});
const GRAPH_IDS=['breach-exit','flank-secure','escort-depot','two-stop-transfer','two-lane-defense','choose-target-order','relieve-convoy','choose-breach-order','rearguard-withdrawal','breach-disable-convoy'];
const TITLES=['打开封锁线','侧翼关闭火力','补给护送','中转站接力','双路掩护','自选火力顺序','解救受阻车队','自选破障顺序','分段后卫撤离','破障与护送'];
function compile(b,variant,index){
 const entities=[],geometry=b.geometry.map(c=>({...c})),routes=b.routes.map(r=>({...r,points:r.points.map(p=>({...p}))})),objectives=[],phases=[],destroyed=new Set();
 const spawn={x:0,y:0,z:18,yaw:0},exit=p(0,b.roomZ[b.blocks]),relayIndex=Math.max(1,Math.floor(b.blocks/2)),relay=p(0,b.roomZ[relayIndex]);
 const zones=[{id:'exit-zone',polygon:rectangle(0,exit.z,18,12)},{id:'relay-zone',polygon:rectangle(0,relay.z,20,12)},{id:'start-zone',polygon:rectangle(0,12,20,14)}];
 const gateData=[];
 const gate=(label,block,lane)=>{
  const c=b.corridors.filter(c=>c.block===block)[lane],id=`gate-${label}`,target=box(id,c.x,c.front-22,c.width,1.2,2.4,{destructible:true,hp:90});geometry.push(target);
  const data={id,target,pose:p(c.x,c.front-12)};gateData.push(data);return data;
 };
 const gun=(label,room,side=1,activationObjectiveId)=>{
  const id=`gun-${label}`,pose={x:side*14,z:b.roomZ[room]+5.5,yaw:Math.PI};
  entities.push({id,kind:'turret',pose,hp:90,shieldArc:2.25,...activationObjectiveId?{activationObjectiveId}:{}});
  return {id,target:pose,pose:p(0,b.roomZ[room])};
 };
 const convoy=(id,{startRoom=0,endRoom=b.blocks,startOffset=14,endX=4,activationObjectiveId,branchOffset=0,laneOverrides={},laneSide=0,escortRange}={})=>{
  const start=startRoom===0?p(0,12+startOffset):p(0,b.roomZ[startRoom]-5);
  const points=[start,p(0,b.roomZ[startRoom])];
  for(let i=startRoom;i<endRoom;i++){
   const choices=b.corridors.filter(c=>c.block===i),lane=choices[laneOverrides[i]??(laneSide<0?0:laneSide>0?choices.length-1:((i+variant+branchOffset)%choices.length))];
   points.push(p(lane.x,b.roomZ[i]),p(lane.x,b.roomZ[i+1]));
  }
  points.push(p(endX,b.roomZ[endRoom]));
  const routeId=`${id}-route`;routes.push({id:routeId,points:points.filter((a,i,arr)=>!i||a.x!==arr[i-1].x||a.z!==arr[i-1].z),width:8});
  entities.push({id,kind:'truck',pose:{...start,yaw:0},hp:360,routeId,...activationObjectiveId?{activationObjectiveId}:{},...escortRange?{escortRange}:{}});return id;
 };
 const plan=[];
 const add=(o,destination,fire,convoyIds=[])=>{objectives.push(o);plan.push({o,destination,fire,convoyIds});};
 if(variant===0){const a=gate('primary',0,0);add(objective('breach','breach',[a.id]),a.pose,[a]);add(objective('exit','reach',[],['breach'],{zoneId:'exit-zone'}),exit);}
 if(variant===1){const a=gun('shield',1,1);add(objective('flank','disable',[a.id]),a.pose,[a]);add(objective('exit','reach',[],['flank'],{zoneId:'exit-zone'}),exit);}
 if(variant===2){const a=gun('overwatch',b.blocks-1,-1),truck=convoy('supply');add(objective('clear-overwatch','disable',[a.id]),a.pose,[a]);add(objective('escort','escort',[truck],[],{zoneId:'exit-zone'}),exit,null,[truck]);add(objective('exit','reach',[],['clear-overwatch','escort'],{zoneId:'exit-zone'}),exit);}
 if(variant===3){
  const a=gun('transfer',relayIndex,-1),c=gun('second-leg',b.blocks-1,1,'first-stop');
  const first=convoy('first-leg',{endRoom:relayIndex,endX:-8}),second=convoy('second-leg',{startRoom:relayIndex,activationObjectiveId:'first-stop',endX:4,laneOverrides:{[relayIndex]:b.lanesPerBlock[relayIndex]-1}});
  add(objective('clear-transfer','disable',[a.id]),a.pose,[a]);
  add(objective('first-stop','escort',[first],[],{zoneId:'relay-zone'}),relay,null,[first]);
  add(objective('cover-second-leg','disable',[c.id],['first-stop']),c.pose,[c]);
  add(objective('second-stop','escort',[second],['first-stop'],{zoneId:'exit-zone'}),exit,null,[second]);
  add(objective('exit','reach',[],['clear-transfer','cover-second-leg','second-stop'],{zoneId:'exit-zone'}),exit);
 }
 if(variant===4){
  const a=gun('east',1,1),c=gun('west',1,-1),first=convoy('east-supply',{startOffset:14,endX:8,laneSide:1,escortRange:2*b.maxLane+22}),second=convoy('west-supply',{startOffset:21,endX:-8,laneSide:-1,escortRange:2*b.maxLane+22});
  add(objective('east-lane','disable',[a.id]),a.pose,[a]);add(objective('west-lane','disable',[c.id]),c.pose,[c]);
  add(objective('east-crossing','escort',[first],[],{zoneId:'exit-zone'}),exit,null,[first]);
  add(objective('west-crossing','escort',[second],[],{zoneId:'exit-zone'}),exit,null,[second]);
  add(objective('exit','reach',[],['east-lane','west-lane','east-crossing','west-crossing'],{zoneId:'exit-zone'}),exit);
 }
 if(variant===5){
  const a=gun('short-road',1,1),c=gun('truck-approach',b.blocks-1,-1),truck=convoy('exposed-supply');
  add(objective('near-position','disable',[a.id]),a.pose,[a]);add(objective('far-position','disable',[c.id]),c.pose,[c]);
  add(objective('protect-approach','escort',[truck],[],{zoneId:'exit-zone'}),exit,null,[truck]);
  add(objective('exit','reach',[],['near-position','far-position','protect-approach'],{zoneId:'exit-zone'}),exit);
 }
 if(variant===6){const a=gate('blocked',0,0),c=gun('ambush',1,-1,'open-road'),truck=convoy('blocked-supply',{activationObjectiveId:'open-road',branchOffset:-variant});add(objective('open-road','breach',[a.id]),a.pose,[a]);add(objective('counter-ambush','disable',[c.id],['open-road']),c.pose,[c]);add(objective('escort','escort',[truck],['open-road'],{zoneId:'exit-zone'}),exit,null,[truck]);add(objective('exit','reach',[],['counter-ambush','escort'],{zoneId:'exit-zone'}),exit);}
 if(variant===7){
  const a=gate('launch',0,0),c=gate('covered-exit',b.blocks-1,1),g=gun('released-ambush',b.blocks-1,1,'launch-gate');
  const truck=convoy('gate-order-supply',{activationObjectiveId:'launch-gate',laneOverrides:{0:0,[b.blocks-1]:1}});
  add(objective('launch-gate','breach',[a.id]),a.pose,[a]);add(objective('exit-gate','breach',[c.id]),c.pose,[c]);
  add(objective('cover-launch','disable',[g.id],['launch-gate']),g.pose,[g]);
  add(objective('gate-order-escort','escort',[truck],['launch-gate'],{zoneId:'exit-zone'}),exit,null,[truck]);
  add(objective('exit','reach',[],['launch-gate','exit-gate','cover-launch','gate-order-escort'],{zoneId:'exit-zone'}),exit);
 }
 if(variant===8){
  const a=gun('entry-pursuit',0,1),c=gun('rear-pursuit',relayIndex,-1,'withdraw-convoy');
  geometry.push(box('entry-shot-screen',7,19,2,7,3));
  const first=convoy('withdrawing-supply',{endRoom:relayIndex,endX:-8}),second=convoy('relay-supply',{startRoom:relayIndex,activationObjectiveId:'regroup',endX:4,laneOverrides:{[relayIndex]:b.lanesPerBlock[relayIndex]-1}});
  add(objective('cover-withdrawal','disable',[a.id]),a.pose,[a]);
  add(objective('withdraw-convoy','escort',[first],[],{zoneId:'relay-zone'}),relay,null,[first]);
  add(objective('regroup','reach',[],['withdraw-convoy'],{zoneId:'relay-zone'}),relay);
  add(objective('silence-pursuit','disable',[c.id],['withdraw-convoy']),c.pose,[c]);
  add(objective('final-withdrawal','escort',[second],['regroup'],{zoneId:'exit-zone'}),exit,null,[second]);
  add(objective('exit','reach',[],['cover-withdrawal','silence-pursuit','final-withdrawal'],{zoneId:'exit-zone'}),exit);
 }
 if(variant===9){const a=gate('entry',0,1),c=gun('depot',b.blocks-1,1,'breach'),truck=convoy('depot-supply',{activationObjectiveId:'disable'});add(objective('breach','breach',[a.id]),a.pose,[a]);add(objective('disable','disable',[c.id],['breach']),c.pose,[c]);add(objective('escort','escort',[truck],['disable'],{zoneId:'exit-zone'}),exit,null,[truck]);add(objective('exit','reach',[],['escort'],{zoneId:'exit-zone'}),exit);}
 for(const o of objectives)o.nextIds=objectives.filter(n=>n.requires.includes(o.id)).map(n=>n.id);
 let current=spawn;
 for(const step of plan){
  const blockers=[...geometry.filter(c=>c.destructible&&!destroyed.has(c.id)),...entities.filter(e=>e.kind==='turret'&&!destroyed.has(e.id)).map(e=>({id:e.id,kind:'circle',x:e.pose.x,z:e.pose.z,radius:1.1,height:2.1}))];
  const points=navigationPath(b,current,step.destination,blockers),tankWaypoints=trace(points,current.yaw||0);
  const phase={objectiveId:step.o.id,tankWaypoints};
  if(step.fire)phase.firingPoses=step.fire.map(f=>({targetId:f.id,...f.pose,turretYaw:yawTo(f.pose,f.target)}));
  if(step.convoyIds.length)phase.convoyRouteIds=step.convoyIds.map(id=>entities.find(e=>e.id===id).routeId);
  phases.push(phase);current=tankWaypoints.at(-1);
  if(['breach','disable'].includes(step.o.type))step.o.targetIds.forEach(id=>destroyed.add(id));
 }
 const signature=JSON.stringify({topology:b.canonicalTopology,objective:canonicalObjectives(objectives,entities,geometry)});
 return {schema:1,id:`mission-${String(index).padStart(3,'0')}`,chapter:b.chapter,index,title:`${TITLES[variant]} · ${b.blocks}区段${b.extra+1}分路`,briefing:`${b.blocks}个相连路口，关键路口有${b.extra+1}条实体通路。混凝土隔墙改变射界，碎石道降低牵引。${['破开指定封锁，再选择通路抵达终点。','绕过正面装甲，利用侧向射击位关闭火力。','先压制沿线火力，同时与补给车保持可跟随距离。','护送第一车到中转站，完成交接后引导第二车出发。','两辆车选择不同通路并真实穿过交叉路口；两侧火力同时威胁它们，不需要清场后原地等计时。','近端火力控制短街，远端火力威胁补给车进场；选择先保障自己的通路还是车队的接近线。','开路会激活伏击火力；不要只顾货车或只顾射击。','先开入口会提前放行货车并唤醒伏击；先清远端出口更慢，但避免车队在火力前等路。','掩护第一辆车撤入中转站；第二辆车出发时压制侧后方追击，完成实际撤离。','依次开路、关闭火力，再带领补给车到货场。'][variant]}`,seed:2026102700+index,blueprintId:b.id,objectiveGraphId:GRAPH_IDS[variant],bounds:{...b.bounds},spawn,geometry,surfaces:b.surfaces.map(s=>({...s})),zones,entities,routes,objectives,witness:{phases},signature};
}
let cache;
export function compiledCatalog(){if(!cache)cache=BLUEPRINTS.flatMap((b,i)=>GRAPH_IDS.map((_,j)=>compile(b,j,4+i*10+j)));return cache;}
export function blueprintAudits(){return auditBlueprints();}
export function auditCatalog(){const specs=compiledCatalog();return {structuralVariants:specs.length,uniqueCombinedSignatures:new Set(specs.map(s=>s.signature)).size,blueprints:blueprintAudits(),humanPlaythrough:'unverified',combatSurvivability:'unverified',limits:['Planar conservative geometry, not proof of runtime success or enjoyable diversity.','Series-theta family has 30 structural graphs but may still feel repetitive; representative human playthrough remains required.','No tank-only width claim: runtime trucks are narrower than the tank.','Protection phases use actual truck traversal, not empty timer holds; combat pressure and pacing still require runtime playthrough.']};}
