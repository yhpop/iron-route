import {box,rectangle,trace,yawTo} from './geometry.js';
import {canonicalObjectives} from './signatures.js';
const p=(x,z)=>({x,z});
const phase=(id,points,extra={})=>({objectiveId:id,tankWaypoints:trace(points),...extra});
const targetPose=(targetId,x,z,target)=>({targetId,x,z,turretYaw:yawTo({x,z},target)});
const zone=(id,x,z,w=12,d=10)=>({id,polygon:rectangle(x,z,w,d)});
const objective=(id,type,targetIds,requires=[],extra={})=>({id,type,targetIds,requires,nextIds:[],...extra});
function finish(spec){
 for(const o of spec.objectives)o.nextIds=spec.objectives.filter(n=>n.requires.includes(o.id)).map(n=>n.id);
 return {schema:1,chapter:1,seed:20261027,...spec,signature:`authored-topology-not-canonicalized:${canonicalObjectives(spec.objectives,spec.entities,spec.geometry)}`};
}
export function authoredMissions(){return [
finish({id:'mission-001',index:1,title:'货运闸口',briefing:'先减速进入射击位，击破中央混凝土路障。侧面的维修通道提供绕行角度；货车必须沿宽路穿过真实缺口，抵达北侧货场。',blueprintId:'freight-breach',objectiveGraphId:'freight-breach-escort-exit',
 bounds:{minX:-30,maxX:30,minZ:-40,maxZ:42},spawn:{x:0,y:0,z:24,yaw:0},
 geometry:[box('freight-gate',0,0,8,1.2,2.3,{destructible:true,hp:90}),box('west-embankment',-17,0,26,2.4),box('east-gate-shoulder',8.1,0,8.2,2.4),box('east-embankment',23.1,0,13.8,2.4),box('west-loading-cover',-12,16,7,7),box('north-stores',-15,-20,10,10)],
 surfaces:[{id:'maintenance-rubble',class:'rubble',traction:0.7,drag:1.35,polygon:rectangle(14.2,0,3.8,18)}],
 zones:[zone('freight-depot',0,-31,11,10),zone('freight-exit',0,-31,11,10)],
 entities:[{id:'freight-truck',kind:'truck',pose:{x:0,z:34,yaw:0},hp:260,escortRange:100,routeId:'freight-road',activationObjectiveId:'open-freight-gate'}],
 routes:[{id:'freight-road',points:[p(0,34),p(0,10),p(0,-12),p(0,-31)],width:8},{id:'maintenance-flank',points:[p(0,24),p(14.2,24),p(14.2,-10),p(0,-10)],width:3.8,branchGroup:'freight-approach'}],
 objectives:[objective('open-freight-gate','breach',['freight-gate']),objective('deliver-freight','escort',['freight-truck'],['open-freight-gate'],{zoneId:'freight-depot'}),objective('cross-freight-gate','reach',[],['deliver-freight'],{zoneId:'freight-exit'})],
 witness:{phases:[phase('open-freight-gate',[p(0,24),p(0,10)],{firingPoses:[targetPose('freight-gate',0,10,p(0,0))]}),phase('deliver-freight',[p(0,10),p(0,-31)],{convoyRouteIds:['freight-road']}),phase('cross-freight-gate',[p(0,-31)])]}}),
finish({id:'mission-002',index:2,title:'铸造厂侧翼',briefing:'正面装甲会弹开炮弹。短街道暴露在自动炮塔射界内；西侧碎石巷较慢，但能绕到装甲外侧。边移动边转动炮塔，关闭火力点后驶入出口。',blueprintId:'shielded-foundry-flank',objectiveGraphId:'flank-secure',
 bounds:{minX:-32,maxX:32,minZ:-40,maxZ:40},spawn:{x:0,y:0,z:27,yaw:0},
 geometry:[box('foundry-block',0,2,9,12,4),box('west-flank-screen',-7.5,-4,3,6,3),box('east-loading-block',19,11,8,12,3.5),box('west-stack',-23,-4,7,12,3),box('north-furnace',17,-24,12,9,4)],
 surfaces:[{id:'west-rubble-lane',class:'rubble',traction:0.65,drag:1.5,polygon:rectangle(-14,8,9,36)}],
 zones:[zone('foundry-exit',0,-30)],
 entities:[{id:'shielded-turret',kind:'turret',pose:{x:0,z:-10,yaw:Math.PI},hp:90,shieldArc:2.5}],
 routes:[{id:'exposed-street',points:[p(0,27),p(9,22),p(9,-10),p(0,-30)],width:8,branchGroup:'foundry-flank'},{id:'rubble-flank',points:[p(0,27),p(-14,27),p(-14,-10),p(-10,-10),p(-10,-30),p(0,-30)],width:8,branchGroup:'foundry-flank'}],
 objectives:[objective('disable-foundry-gun','disable',['shielded-turret']),objective('secure-foundry-exit','reach',[],['disable-foundry-gun'],{zoneId:'foundry-exit'})],
 witness:{phases:[phase('disable-foundry-gun',[p(0,27),p(-14,27),p(-14,-10),p(-10,-10)],{firingPoses:[targetPose('shielded-turret',-10,-10,p(0,-10))]}),phase('secure-foundry-exit',[p(-10,-10),p(-10,-30),p(0,-30)])]}}),
finish({id:'mission-003',index:3,title:'双车队弯道',briefing:'两辆补给车会保持间距并等待过远的坦克。沿宽阔弯道推进，依次压制相隔的两处自动火力；两侧掩体可暂避，但不要独自冲到终点。两车都必须实际驶入货场。',blueprintId:'convoy-bend',objectiveGraphId:'two-truck-escort',
 bounds:{minX:-34,maxX:34,minZ:-42,maxZ:48},spawn:{x:0,y:0,z:23,yaw:0},
 geometry:[box('western-storage',-24,18,10,10,3),box('eastern-storage',24,-2,10,10,3),box('western-depot',-23,-25,12,10,3),box('east-start-cover',14,28,7,7,3)],
 surfaces:[{id:'covered-shoulder',class:'rubble',traction:0.72,drag:1.3,polygon:rectangle(-11,-10,8,15)}],
 zones:[zone('convoy-depot',0,-32,15,12)],
 entities:[{id:'lead-supply',kind:'truck',pose:{x:0,z:32,yaw:0},hp:300,routeId:'lead-convoy-road'},{id:'rear-supply',kind:'truck',pose:{x:0,z:40,yaw:0},hp:300,routeId:'rear-convoy-road'},{id:'west-road-gun',kind:'turret',pose:{x:-12,z:5,yaw:Math.PI},hp:90,shieldArc:0},{id:'east-road-gun',kind:'turret',pose:{x:12,z:-13,yaw:Math.PI},hp:90,shieldArc:0}],
 routes:[{id:'lead-convoy-road',points:[p(0,32),p(0,16),p(-4,2),p(4,-16),p(4,-32)],width:8},{id:'rear-convoy-road',points:[p(0,40),p(0,16),p(-4,2),p(4,-16),p(-4,-32)],width:8},{id:'covered-tank-approach',points:[p(0,23),p(-8,18),p(-8,-10),p(0,-32)],width:6}],
 objectives:[objective('silence-west-gun','disable',['west-road-gun']),objective('silence-east-gun','disable',['east-road-gun'],['silence-west-gun']),objective('deliver-both-trucks','escort',['lead-supply','rear-supply'],[],{zoneId:'convoy-depot'}),objective('secure-convoy-depot','reach',[],['silence-east-gun','deliver-both-trucks'],{zoneId:'convoy-depot'})],
 witness:{phases:[phase('silence-west-gun',[p(0,23),p(0,14)],{firingPoses:[targetPose('west-road-gun',0,14,p(-12,5))]}),phase('silence-east-gun',[p(0,14),p(0,-2)],{firingPoses:[targetPose('east-road-gun',0,-2,p(12,-13))]}),phase('deliver-both-trucks',[p(0,-2),p(0,-32)],{convoyRouteIds:['lead-convoy-road','rear-convoy-road']}),phase('secure-convoy-depot',[p(0,-32)])]}})
];}
