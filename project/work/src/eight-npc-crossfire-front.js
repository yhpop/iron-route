import {createLoadingExtraction} from './loading-extraction-front.js';
import {sampleGroundContact} from './terrain-candidate/heightfield.js';
/** New source reconstruction, not recovered original eight-NPC code.
 * Eight armed NPCs (seven PzIII instances and one fixed sentry), not eight models.
 * Uses unchanged production targeting, projectile collision and damage. */
export function createEightNpcCrossfire(){
 const {spec,field}=createLoadingExtraction();
 spec.id='mission-9102';spec.index=9102;spec.slug='eight-npc-reconstruction';spec.optional=true;spec.eightNpcReconstruction=true;
 spec.title='八名武装 NPC · 撤离重建';
 spec.briefing='新重建试验关：四名友方与四名敌方武装 NPC 使用真实视线、炮弹和伤害，其中七辆装甲车与一座固定炮台，不是八种新车型。掩护装卸 18 秒后选择东路或西路撤离。友军和残骸会阻挡炮弹与车辆；无需消灭全部敌人。';
 const template=spec.entities.find(e=>e.id==='allied-support');
 const add=(id,team,x,z,targetX,targetZ)=>{
  const yaw=Math.atan2(-(targetX-x),-(targetZ-z))||0,ground=sampleGroundContact(field,x,z,yaw);
  return {...structuredClone(template),id,team,pose:{x,z,y:ground.height+.008,yaw},patrol:[]};
 };
 // Rear/east guards engage the southern fight; northern threats wait for real LOS/range.
 spec.entities.push(add('allied-east','allied',30,20,23,16),add('allied-north','allied',10,30,2,16),add('allied-far-east','allied',30,8,23,16),add('hostile-far-east','hostile',30,-20,30,-8));
 spec.design={...spec.design,openingEvidence:'new 30-second headless production-simulation and conservative footprint checks; no actual mesh, camera, GPU or device acceptance',teamEncounter:'eight armed NPCs with unchanged targeting and real projectiles; four per team',newVehiclePositions:'four new stationary off-route emplacements; two inherited patrols; initial production compound checks',reconstruction:'2026-11-02 new optional source reconstruction; original eight-NPC layout not recovered',npcCount:'8 armed NPCs, 4 allied and 4 hostile; supply truck and player excluded',npcGeometry:'7 existing licensed PzIII instances and 1 existing sentry; no new tank models'};
 return {spec,field};
}
