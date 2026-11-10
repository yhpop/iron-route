import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createCrossfireFront} from '../src/crossfire-front.js';
import {createGame,stepGame} from '../src/campaign-simulation.js';
import {createWorld} from '../src/campaign-world.js';
import {createTerrainCombatWorld} from '../src/terrain-candidate/combat-world.js';
import {stepTank,getTankTransform,DEFAULT_CONFIG} from '../src/tank-controller.js';
import {computeBattlefieldGuidance} from '../src/battlefield-guidance.js';
import {projectThreatPoint} from '../src/threat-warnings.js';
import {createProductionCamera,cameraSource} from './helpers/production-camera.mjs';

// CPU/source-camera and actual deterministic combat/collision tests only. These
// are not browser pixels, UI layout measurements or Mac/WebGL acceptance.
test('real crossfire support state and source-camera CSS projections reach the HUD model across viewport shapes',()=>{
 const {spec,field}=createCrossfireFront(),world=createTerrainCombatWorld(spec,field),samples=[];
 try{
  let state=stepGame(createGame(spec),{start:true},1/60,world);
  state=stepGame(state,{},1/60,world);
  assert.equal(state.entities['allied-support'].status,'charging');
  assert.equal(state.entities['allied-support'].targetId,'hostile-flanker');
  for(const [width,height]of [[390,844],[390,664],[844,390],[820,1180],[1280,720]]){
   const camera=createProductionCamera()(state.tank,width/height),canvasRect={left:13,top:21,width,height};
   const before=JSON.stringify(state),cameraBefore=JSON.stringify(camera.toJSON());
   const origin=projectThreatPoint({entity:state.tank,camera,canvasRect,height:.8});
   const projectEntity=entity=>projectThreatPoint({entity,camera,canvasRect});
   const r=computeBattlefieldGuidance({state,origin,projectEntity}),support=r.support.entries[0];
   assert.equal(support.id,'allied-support');assert.equal(support.engagement,'charging');assert.equal(support.alive,true);
   assert.match(r.support.text,/存活.*瞄敌蓄力/);assert.ok(support.distance>30&&support.distance<40);
   assert.equal(support.arrow,'↖','source camera puts western support above-left of actual player origin');
   const shiftedRect={...canvasRect,left:0,top:0};
   const shifted=computeBattlefieldGuidance({state,origin:projectThreatPoint({entity:state.tank,camera,canvasRect:shiftedRect,height:.8}),projectEntity:entity=>projectThreatPoint({entity,camera,canvasRect:shiftedRect})});
   assert.equal(shifted.support.text,r.support.text,'CSS viewport offsets do not change relative bearing');
   assert.equal(JSON.stringify(state),before);assert.equal(JSON.stringify(camera.toJSON()),cameraBefore);
   const p=projectEntity(state.entities['allied-support']);
   samples.push({width,height,projection:p,inside:p.inFront&&p.x>=13&&p.x<=13+width&&p.y>=21&&p.y<=21+height,text:r.support.text});
   const negative=computeBattlefieldGuidance({state,origin,projectEntity:()=>null});
   assert.equal(negative.support.entries[0].arrow,'');assert.match(negative.support.text,/方位未知/);
  }
  // Advance the actual simulator to its cooldown, not a fabricated shot/hit.
  let sawShot=false;
  for(let i=0;i<150;i++){state=stepGame(state,{},1/60,world);sawShot ||= state.events.some(e=>e.type==='shot'&&e.entityId==='allied-support');}
  assert.equal(sawShot,true);assert.equal(state.entities['allied-support'].status,'cooldown');
  const cool=computeBattlefieldGuidance({state});assert.equal(cool.support.entries[0].engagement,'cooldown');assert.match(cool.support.text,/装填中/);assert.doesNotMatch(cool.support.text,/命中|击杀/);
  if(process.env.GUIDANCE_EVIDENCE_DIR)writeFileSync(`${process.env.GUIDANCE_EVIDENCE_DIR}/source-projection.json`,JSON.stringify({kind:'CPU production-source camera, not browser pixels',cameraSourceSha256:cameraSource.sha256,samples},null,2));
 }finally{world.dispose();}
});

test('real controller/world collision IDs distinguish ally, truck and wall and never disable physics',()=>{
 for(const kind of ['friendly','truck','wall']){
  const {spec}=createCrossfireFront();spec.geometry=[];spec.spawn={x:0,y:0,z:0,yaw:0};
  const source=kind==='wall'?{id:'real-wall',kind:'box',x:0,z:-4.5,width:2,depth:3.5,height:2}:kind==='truck'?{id:'real-truck',kind:'truck',team:spec.combatRelations.playerTeam,pose:{x:0,y:0,z:-4.5,yaw:0},width:2,depth:3.5,height:2,hp:100}: {id:'real-ally',kind:'turret',team:spec.combatRelations.playerTeam,pose:{x:0,y:0,z:-4.5,yaw:0},width:2,depth:3.5,height:2,hp:100};
  if(kind==='wall'){spec.geometry=[source];spec.entities=[];}else spec.entities=[source];
  const world=createWorld(spec);
  try{
   let state=createGame(spec);state.phase='playing';world.setEntities(Object.values(state.entities));
   const result=stepTank(state.tank,{throttle:1,aim:{worldPoint:{x:2,y:.8,z:-10}}},1/60,world);
   state={...state,tank:result.state,tankFrame:result.frame};
   const contacts=world.muzzleContacts(getTankTransform(state.tank),DEFAULT_CONFIG.rig).contacts;
   assert.ok(state.tank.blocked.barrel||state.tank.blocked.muzzle,'physical gun obstruction must exist before its hint');
   assert.ok([...state.tankFrame.contacts,...contacts].includes(source.id),'world owns the actual contact ID');
   const before=JSON.stringify(state),r=computeBattlefieldGuidance({state,muzzleContactIds:contacts});
   assert.equal(r.recovery.kind,kind==='wall'?'obstacle':kind);
   assert.ok(r.recovery.contactIds.includes(source.id));
   assert.match(r.recovery.text,/先停稳.*尝试倒车.*侧向间距.*炮管转离/);
   if(kind==='wall')assert.doesNotMatch(r.recovery.text,/友军|补给车/);
   const unknown=computeBattlefieldGuidance({state:{...state,tankFrame:{...state.tankFrame,contacts:[]}}});
   assert.equal(unknown.recovery.kind,'obstacle','no inferred nearest-friendly ID');
   assert.equal(JSON.stringify(state),before);assert.ok(state.tank.blocked.barrel||state.tank.blocked.muzzle);
  }finally{world.dispose();}
 }
});
