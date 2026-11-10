import test from 'node:test';
import assert from 'node:assert/strict';
import {getMission} from '../src/content/index.js';
import {createWorld} from '../src/campaign-world.js';
import {initializeEntities,syncWorldEntities} from '../src/combat.js';
import {createObjectiveStates,stepObjectives,stepTrucks} from '../src/mission-runtime.js';

// Routing-only replay: guns/barriers are disabled up front and tank is positioned
// alongside the current vehicle. This is not a combat/drive/playthrough claim.
for(const id of ['mission-007','mission-008','mission-012','mission-047','mission-048','mission-052','mission-297','mission-298','mission-302'])test(`${id}: real staged/crossing convoys do not deadlock on parked trucks`,()=>{
 const mission=getMission(id),world=createWorld(mission),s={schema:1,missionId:id,tick:0,elapsed:0,phase:'playing',mission,tank:{pose:{x:0,y:0,z:18,yaw:0}},tankCombat:{hp:100,maxHp:100,damageTaken:0},entities:initializeEntities(mission),objectiveStates:createObjectiveStates(mission),events:[],nextEventId:1,result:null};
 for(const e of Object.values(s.entities))if(e.kind!=='truck'){e.hp=0;e.alive=false;}
 const trucks=Object.values(s.entities).filter(e=>e.kind==='truck');
 for(let tick=0;tick<24000&&!trucks.every(t=>t.arrived);tick++){
  s.tick=tick;
  const moving=trucks.find(t=>!t.arrived&&(!t.activationObjectiveId||s.objectiveStates[t.activationObjectiveId]?.status==='complete'))||trucks.find(t=>!t.arrived);
  s.tank.pose={x:moving.pose.x+9,y:0,z:moving.pose.z-4,yaw:0};
  for(const o of mission.objectives)if(o.type==='reach'&&s.objectiveStates[o.id]?.status==='active'){
   const z=mission.zones.find(z=>z.id===o.zoneId),center=z.polygon.reduce((a,p)=>({x:a.x+p.x/z.polygon.length,z:a.z+p.z/z.polygon.length}),{x:0,z:0});
   s.tank.pose={...center,y:0,yaw:0};stepObjectives(s,1/60);s.tank.pose={x:moving.pose.x+9,y:0,z:moving.pose.z-4,yaw:0};
  }
  syncWorldEntities(s,world);stepTrucks(s,1/60,world);stepObjectives(s,1/60);
 }
 world.dispose();
 assert.ok(trucks.every(t=>t.arrived),JSON.stringify(trucks.map(t=>({id:t.id,pose:t.pose,arrived:t.arrived,reason:t.stoppedReason,routeIndex:t.routeIndex}))));
});
