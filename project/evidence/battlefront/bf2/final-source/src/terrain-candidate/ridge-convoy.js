import {createHeightfield,roadSample,sampleHeightfield} from './heightfield.js';
const rect=(id,x,z,w,d)=>({id,polygon:[{x:x-w/2,z:z-d/2},{x:x+w/2,z:z-d/2},{x:x+w/2,z:z+d/2},{x:x-w/2,z:z+d/2}]});
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
/** Original authored sortie. Existing convoy choice, combat, crushing and art remain authoritative. */
export function createRidgeConvoyMission(){
 const direct=[[0,28],[14,18],[14,-24],[0,-32]],covered=[[0,28],[-18,18],[-22,4],[-22,-20],[0,-32]];
 const roads=[{id:'ridge-east',material:'asphalt',width:7,points:direct},{id:'ridge-west',material:'earth',width:6,points:covered}];
 const geometry=[
  {id:'south-depot',kind:'box',x:-25,z:28,width:8,depth:9,height:4},
  {id:'west-workshop',kind:'box',x:-32,z:-5,width:6,depth:10,height:3.5},
  {id:'north-garage',kind:'box',x:25,z:-30,width:8,depth:7,height:3.2},
  ...Array.from({length:5},(_,i)=>({id:`ridge-fence-${i}`,kind:'box',x:-22.6+i*1.8,z:14,width:1.8,depth:.25,height:.65,destructible:true,hp:90,crush:{seconds:.25,mode:'fence'}}))
 ];
 const bounds={minX:-40,maxX:40,minZ:-42,maxZ:42};
 const entities=[{id:'supply',kind:'truck',yieldForTankTurn:true,pose:{x:0,y:0,z:28,yaw:0},hp:100,protected:true,routeId:'ridge-east',speed:1.15,escortRange:19},
  {id:'road-gun',kind:'turret',pose:{x:23,y:0,z:3,yaw:Math.PI},hp:90,range:23,chargeTime:2.1,reload:3.6,damage:8,shieldArc:2.5},
  {id:'ridge-gun',kind:'turret',pose:{x:0,y:0,z:-18,yaw:Math.PI},hp:90,range:28,chargeTime:2.2,reload:3.8,damage:8,shieldArc:2.5}];
 const pads=[...geometry.map(c=>({x:c.x,z:c.z,w:c.width,d:c.depth})),...entities.filter(e=>e.kind!=='truck').map(e=>({x:e.pose.x,z:e.pose.z,w:4,d:4}))];
 const field=createHeightfield({bounds,cellSize:.5,roads,heightAt(x,z){let h=4.2*Math.exp(-((x/11)**4)-(((z-1)/10)**4));const r=roadSample(roads,x,z);if(r)h*=smooth((r.distance-6)/4);for(const p of pads){const d=Math.hypot(Math.max(0,Math.abs(x-p.x)-p.w/2),Math.max(0,Math.abs(z-p.z)-p.d/2));h*=smooth((d-1)/3);}return h;}});
 for(const c of geometry)c.y=sampleHeightfield(field,c.x,c.z).height;
 for(const e of entities)e.pose.y=sampleHeightfield(field,e.pose.x,e.pose.z).height;
 const spec={schema:1,id:'mission-9005',index:9005,optional:true,terrainCombat:true,districtId:'south-wharf',title:'堤路护送 · 山脊与双线',
 briefing:'把补给车带到北部接应区，而不是清空所有炮位。驶入东侧金圈选硬路：路短，但会暴露在炮位前；驶入西侧金圈选低地土路：路长，中央山脊能挡弹，入口木栅须用履带压开。选路后锁定。可点“车队待命”或按 H 把车留在掩体后，绕侧清炮后再按“继续护送”；待命时敌火不会暂停。补给车会等待你靠近，也会停在未清障碍或你的车身后。可先清炮位，再回车队，也可边走边护送。山脊后的北炮位需绕侧才能击中，正面装甲会挡弹。',
 bounds,spawn:{x:0,y:0,z:23,yaw:0},geometry,entities,
 routes:roads.map(r=>({id:r.id,width:r.width,points:r.points.map(([x,z])=>({x,z}))})),
 zones:[rect('orders',0,23,8,6),rect('choose-east',8,19,5,6),rect('choose-west',-8,19,5,6),rect('rendezvous',0,-32,10,8)],
 objectives:[{id:'receive-orders',type:'reach',requires:[],nextIds:['escort-supply'],targetIds:[],zoneId:'orders',title:'接应补给车，驶入东西集结圈选路'},
 {id:'escort-supply',type:'escort',requires:['receive-orders'],nextIds:[],targetIds:['supply'],zoneId:'rendezvous',title:'护送补给车进入北部接应区'}],
 convoyCommands:true,
 convoyChoice:{requiresObjectiveId:'receive-orders',prompt:'右侧硬路：短但暴露；左侧低地：长但有山脊掩护。驶入金圈锁定路线',options:[{id:'direct',title:'东侧硬路',zoneId:'choose-east',routeByTruck:{supply:'ridge-east'}},{id:'covered',title:'西侧低地土路',zoneId:'choose-west',routeByTruck:{supply:'ridge-west'}}]},
 sceneDressing:{schema:1,districtId:'south-wharf',ground:{material:'concrete'},roads,landmarks:[{geometryId:'south-depot',assetKey:'warehouse-sawtooth',role:'Departure depot'},{geometryId:'west-workshop',assetKey:'service-workshop',role:'Low road marker'},{geometryId:'north-garage',assetKey:'service-workshop',role:'Rendezvous landmark'}],props:[],water:[],drains:[]},
 design:{targetSeconds:[150,300],evidence:{humanPlaythrough:'unverified',combatBalance:'unverified'},terrainProof:{blockedPose:{x:8,z:-2,yaw:0},exposedPose:{x:14,z:-18,yaw:0},targetId:'ridge-gun'}}};
 return {spec,field};
}
