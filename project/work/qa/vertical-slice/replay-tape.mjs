/** Independent exact-control replay. Contains no pilot, teleports or state repair. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createVerticalSlice} from '../../src/terrain-candidate/vertical-slice.js';
import {createTerrainCombatWorld} from '../../src/terrain-candidate/combat-world.js';
import {createGame,stepGame} from '../../src/campaign-simulation.js';
export const hash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const allowed=new Set(['start','throttle','steer','brake','aim','firePressed','convoyOrder','pause','resume']);
export function validateTape(tape){
 assert.equal(tape.schema,1);assert.equal(tape.missionId,'mission-9030');assert.equal(tape.dt,1/60);
 assert.ok(['direct','covered'].includes(tape.route));assert.ok(Array.isArray(tape.runs));
 let count=0,starts=0;
 for(const run of tape.runs){assert.ok(Number.isInteger(run.n)&&run.n>0);count+=run.n;
  assert.ok(run.input&&typeof run.input==='object'&&!Array.isArray(run.input));
  for(const key of Object.keys(run.input))assert.ok(allowed.has(key),`Non-control tape key: ${key}`);
  for(const key of ['throttle','steer'])if(key in run.input)assert.ok(Number.isFinite(run.input[key])&&Math.abs(run.input[key])<=1);
  for(const key of ['start','brake','firePressed','pause','resume'])if(key in run.input)assert.equal(typeof run.input[key],'boolean');
  if(run.input.start)starts+=run.n;
  if(run.input.convoyOrder)assert.ok(['hold','advance'].includes(run.input.convoyOrder));
  if(run.input.aim){assert.deepEqual(Object.keys(run.input.aim),['worldPoint']);assert.deepEqual(Object.keys(run.input.aim.worldPoint).sort(),['x','y','z']);for(const value of Object.values(run.input.aim.worldPoint))assert.ok(Number.isFinite(value));}
 }
 assert.equal(starts,1);assert.deepEqual(tape.runs[0],{n:1,input:{start:true}});assert.ok(count<30000);
 return count;
}
export function replayTape(tape){
 const inputs=validateTape(tape),{spec,field}=createVerticalSlice();assert.equal(hash(spec),tape.specHash,'mission changed since tape recorded');
 const world=createTerrainCombatWorld(spec,field);let state=createGame(spec),heldTicks=0,shots={tank:0,'road-gun':0,'ridge-gun':0},crushed=new Set(),destroyed=new Set();
 try{for(const run of tape.runs)for(let i=0;i<run.n;i++){
  const previous=state;state=stepGame(state,run.input,tape.dt,world);
  if(state.tick===previous.tick)continue;
  if(state.entities.supply.stoppedReason==='commander-hold')heldTicks++;
  for(const event of state.events){if(event.type==='shot')shots[event.entityId]=(shots[event.entityId]||0)+1;if(event.type==='destroyed')destroyed.add(event.entityId);if(event.type==='crushed'||event.type==='barrier-crushed')crushed.add(event.entityId);}
 }
 const result={route:tape.route,inputs,tick:state.tick,phase:state.phase,hash:hash(state),expectedHash:tape.finalHash,stateMatches:hash(state)===tape.finalHash,hp:state.tankCombat.hp,truckHp:state.entities.supply.hp,truckArrived:state.entities.supply.arrived,choice:state.selectedConvoyChoiceId,heldTicks,shots,destroyed:[...destroyed],crushed:Object.values(state.entities).filter(e=>e.status==='crushed').map(e=>e.id),roadGunAlive:state.entities['road-gun'].alive};
 assert.equal(result.phase,'won');assert.equal(result.stateMatches,true);assert.equal(result.truckArrived,true);assert.equal(result.choice,tape.route);assert.ok(result.heldTicks>60);assert.ok(result.shots.tank>=2);
 if(tape.route==='direct'){assert.equal(result.roadGunAlive,false);assert.ok(result.shots['road-gun']>0);}else{assert.equal(result.roadGunAlive,true);assert.ok(result.crushed.length>0);}
 return result;
 }finally{world.dispose();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const file=process.argv[2];if(!file)throw new Error('Usage: node qa/vertical-slice/replay-tape.mjs <inputs.json.gz>');
 console.log(JSON.stringify(replayTape(JSON.parse(gunzipSync(readFileSync(file))))));
}
