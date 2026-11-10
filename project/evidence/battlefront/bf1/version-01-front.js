import {createScannedCoverFront} from './scanned-cover-front.js';
import {sampleGroundContact} from './terrain-candidate/heightfield.js';
import {ruinedDepotColliders} from './ruined-depot-layout.js';
/** Independent damaged freight yard. No field edits or hidden intact workshop.
 * The exact instance array is consumed by view, movement proxies and shell rays. */
export function createBattlefrontDepotFront(){
 const {spec,field}=createScannedCoverFront();
 spec.id='mission-9080';spec.index=9080;spec.slug='battlefront-depot';spec.optional=true;spec.battlefrontDepot=true;spec.ruinedDepot=true;
 spec.title='破损货场 · 双线接应';
 spec.briefing='护送补给车穿过破损货场，到达北侧接应区。东侧硬路短，窗墙和装甲巡逻车封锁侧翼；西侧绕行可借中央山脊与装卸区断墙遮挡炮火。南侧支援车会真实交火，敌方侧翼车在装填间隙转移。按 H 或点车队待命，先侦察再推进。窗口可通炮弹，人行破口不是坦克通道。友军和残骸会挡住炮弹与车辆；不要把敌车残骸留在车队路线上。无需消灭所有敌人。';
 spec.ruinedDepotLayout=[{id:'ruin-west-loading',moduleId:'broken-corner',x:-30,y:0,z:18,yaw:Math.PI},{id:'ruin-west-workshop',moduleId:'workshop',x:-32,y:0,z:-5,yaw:Math.PI},{id:'ruin-east-window',moduleId:'window-wall',x:19.5,y:0,z:0,yaw:Math.PI/2}];
 spec.ruinedDepotFoundations=[];
 spec.geometry=[...spec.geometry.filter(c=>!['west-workshop','scorched-east-low-wall'].includes(c.id)),...ruinedDepotColliders(spec.ruinedDepotLayout)];
 spec.sceneDressing={...spec.sceneDressing,landmarks:spec.sceneDressing.landmarks.filter(l=>l.geometryId!=='west-workshop')};
 spec.entities=spec.entities.map(e=>{
  if(e.id==='allied-support')return {...e,patrol:[]}; // Honest stationary firebase; no tiny reciprocal motion.
  if(e.id!=='hostile-flanker')return e;
  const p={x:2,z:17},yaw=Math.atan2(-(spec.entities.find(e=>e.id==='allied-support').pose.x-p.x),-(18-p.z)),g=sampleGroundContact(field,p.x,p.z,yaw);
  return {...e,pose:{...p,y:g.height+.008,yaw},patrol:[{x:2,z:17},{x:8,z:17},{x:8,z:24},{x:2,z:24}]};
 });
 spec.design={...spec.design,terrainChange:'none; exact scanned-cover field/roads/spawn/routes retained',ruinComposition:'Damaged west repair workshop replaces matching intact building; loading corner and eastern window-wall retain shared exact transforms',teamEncounter:'Stationary support firebase, closed southern-apron flanker patrol, eastern road patrol and northern overwatch; no target or weapon changes',ruinCollision:'757 exported shell triangles; 61 movement spans; three existing modules, no foundations'};
 return {spec,field};
}
