import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createBattlefrontDepotFront} from '../src/battlefront-depot-front.js';
import {createGame,stepGame,retry} from '../src/campaign-simulation.js';
import {getActiveTargets} from '../src/campaign-view.js';
import {createObjectiveTracker} from '../src/objective-guidance.js';
import {pointInZone,stepObjectives,stepTrucks} from '../src/mission-runtime.js';
import {createRuinedDepotWorld} from '../src/ruined-depot-world-accelerated.js';
const path=new URL('../src/loading-extraction-front.js',import.meta.url);
async function built(){assert.equal(fs.existsSync(path),true,'loading-extraction builder missing');return (await import(path)).createLoadingExtraction();}
const physical=s=>structuredClone({pose:s.entities.supply.pose,hp:s.entities.supply.hp,arrived:s.entities.supply.arrived});

test('new public builder authors exact defend→escort identity and retains all inherited physical data',async()=>{
 const base=createBattlefrontDepotFront(),before=structuredClone(base),{spec,field}=await built();
 assert.equal(spec.id,'mission-9090');assert.equal(spec.index,9090);assert.equal(spec.slug,'loading-extraction');assert.equal(spec.loadingExtraction,true);assert.equal(spec.optional,true);
 assert.equal(spec.title,'装卸点掩护 · 撤离');assert.match(spec.briefing,/18/);assert.match(spec.briefing,/离开.*重置/);assert.match(spec.briefing,/待命.*炮火/);assert.match(spec.briefing,/失败/);
 assert.deepEqual(spec.objectives,[{id:'prepare-extraction',type:'defend',title:'掩护装卸 18 秒',requires:[],nextIds:['escort-supply'],targetIds:[],zoneId:'loading-area',duration:18},{id:'escort-supply',type:'escort',title:'护送补给车撤离',requires:['prepare-extraction'],nextIds:[],targetIds:['supply'],zoneId:'rendezvous'}]);
 assert.deepEqual(spec.zones,base.spec.zones.map(z=>z.id==='orders'?{...z,id:'loading-area'}:z));assert.equal(spec.convoyChoice.requiresObjectiveId,'prepare-extraction');
 assert.deepEqual(spec.convoyChoice.options,base.spec.convoyChoice.options);
 assert.deepEqual(spec.entities,base.spec.entities.map(e=>e.id==='supply'?{...e,activationObjectiveId:'prepare-extraction'}:e));
 for(const k of Object.keys(base.spec).filter(k=>!['id','index','slug','title','briefing','objectives','zones','entities','convoyChoice'].includes(k)))assert.deepEqual(spec[k],base.spec[k],k);
 assert.deepEqual(field,base.field);assert.notEqual(field,base.field);assert.notEqual(field.heights,base.field.heights);assert.deepEqual(base,before);
 const fresh=await built();spec.entities[0].pose.x=999;spec.zones[0].polygon[0].x=999;assert.notDeepEqual(spec.entities,fresh.spec.entities);assert.deepEqual(createBattlefrontDepotFront(),before);
});

test('UNIT FIXTURE: 18 simulated seconds, leaving resets unfinished hold, inclusive loading boundary',async()=>{
 const {spec}=await built();const s=stepGame(createGame(spec),{start:true}),z=spec.zones.find(z=>z.id==='loading-area');assert.ok(pointInZone(s.tank.pose,z));
 for(let n=0;n<540;n++)stepObjectives(s,1/60);assert.ok(Math.abs(s.objectiveStates['prepare-extraction'].elapsed-9)<1e-8);
 s.tank.pose.x=4.01;stepObjectives(s,1/60);assert.equal(s.objectiveStates['prepare-extraction'].elapsed,0);s.tank.pose.x=4;s.tank.pose.z=20;assert.ok(pointInZone(s.tank.pose,z));
 for(let n=0;n<1079;n++)stepObjectives(s,1/60);assert.equal(s.objectiveStates['prepare-extraction'].status,'active');assert.equal(s.objectiveStates['escort-supply'].status,'locked');
 stepObjectives(s,1/60);assert.equal(s.objectiveStates['prepare-extraction'].status,'complete');assert.equal(s.objectiveStates['escort-supply'].status,'active');assert.equal(s.phase,'playing');
 s.tank.pose.x=99;stepObjectives(s,1/60);assert.equal(s.objectiveStates['prepare-extraction'].status,'complete');
});

test('UNIT FIXTURE: no early choice/convoy; normal stationary selection then swept release and hold',async()=>{
 const {spec,field}=await built(),world=createRuinedDepotWorld(spec,field),s=stepGame(createGame(spec),{start:true});try{
 const initial=physical(s),zone=spec.zones.find(z=>z.id===spec.convoyChoice.options[0].zoneId),center=zone.polygon.reduce((a,p)=>({x:a.x+p.x/zone.polygon.length,z:a.z+p.z/zone.polygon.length}),{x:0,z:0});s.tank.pose={...s.tank.pose,...center};
 for(let n=0;n<10;n++)stepTrucks(s,1/60,world);assert.equal(s.selectedConvoyChoiceId,null);assert.deepEqual(physical(s),initial);assert.equal(s.entities.supply.stoppedReason,'objective');
 s.tank.pose={...s.tank.pose,...spec.spawn};stepObjectives(s,18);assert.equal(s.objectiveStates['prepare-extraction'].status,'complete');stepTrucks(s,1/60,world);assert.equal(s.selectedConvoyChoiceId,null);assert.deepEqual(physical(s),initial);
 s.tank.pose={...s.tank.pose,...center};stepTrucks(s,1/60,world);assert.equal(s.selectedConvoyChoiceId,spec.convoyChoice.options[0].id);assert.deepEqual(physical(s),initial);assert.equal(s.entities.supply.routeIndex,0);assert.equal(s.entities.supply.speed,0);
 for(let n=0;n<120;n++)stepTrucks(s,1/60,world);assert.notDeepEqual(s.entities.supply.pose,initial.pose);assert.equal(s.entities.supply.hp,initial.hp);
 s.convoyOrder='hold';const held=physical(s);for(let n=0;n<60;n++)stepTrucks(s,1/60,world);assert.deepEqual(physical(s),held);assert.equal(s.entities.supply.stoppedReason,'commander-hold');
 }finally{world.dispose();}
});

test('UNIT FIXTURE: paused and terminal clocks/objectives do not advance',async()=>{
 const {spec}=await built();const initial=createGame(spec);for(const phase of ['briefing','paused','won','lost']){const s={...initial,phase};for(let n=0;n<20;n++){const next=stepGame(s,{firePressed:true,convoyOrder:'hold'},1/60);assert.deepEqual(next,s);}stepObjectives(s,18);assert.equal(s.objectiveStates['prepare-extraction'].elapsed,0);}
 let s=stepGame(initial,{start:true});s=stepGame(s,{pause:true});assert.equal(s.phase,'paused');assert.equal(s.tick,0);assert.equal(s.objectiveStates['prepare-extraction'].elapsed,0);assert.equal(stepGame(s,{resume:true}).tick,0);
});

test('UNIT FIXTURE: losses are real objective defeat paths; public retry restores complete fresh state',async()=>{
 const {spec}=await built();for(const cause of ['tank-destroyed','protected-vehicle-destroyed']){const s=stepGame(createGame(spec),{start:true});if(cause==='tank-destroyed')s.tankCombat.hp=0;else{s.entities.supply.hp=0;s.entities.supply.alive=false;}stepObjectives(s,1/60);assert.equal(s.phase,'lost');assert.equal(s.result.cause,cause);assert.equal(s.objectiveStates['prepare-extraction'].status,'active');assert.equal(s.objectiveStates['prepare-extraction'].elapsed,0);assert.deepEqual(retry(s.mission),createGame(spec));}
 const s=stepGame(createGame(spec),{start:true});s.entities['allied-support'].alive=false;s.entities['allied-support'].hp=0;stepObjectives(s,18);assert.equal(s.phase,'playing');assert.equal(s.objectiveStates['prepare-extraction'].status,'complete');
});

test('real marker and tracker lead preparation into loading area, never the outside protected truck',async()=>{
 const {spec}=await built(),s=stepGame(createGame(spec),{start:true}),tracker=createObjectiveTracker();
 const marker=getActiveTargets(s,spec);assert.deepEqual(marker,[{id:'loading-area',x:0,z:23,type:'defend'}]);
 const guidance=tracker.update(s,spec);assert.deepEqual(guidance.target,marker[0]);assert.ok(pointInZone(guidance.target,spec.zones.find(z=>z.id==='loading-area')));assert.equal(guidance.routeChoicePending,false);assert.equal(s.entities.supply.protected,true);
 // Labeled runtime-unit fixture: prepare directly, then normal route-selection guidance.
 stepObjectives(s,18);assert.equal(tracker.update(s,spec).routeChoicePending,true);assert.deepEqual(getActiveTargets(s,spec).map(t=>t.id),['choose-east','choose-west']);
});

// RECORD CONSISTENCY only: reads saved input-only recordings. Never simulates a
// route, launches a job, runs a planner or replaces the explicit bounded replay.
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {dirname,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {withPlayerVehicle} from '../src/player-vehicles-v3.js';
const evidence=new URL('../../evidence/extraction/e1/',import.meta.url),work=fileURLToPath(new URL('../',import.meta.url));
const hash=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
function physicalClosure(){const files=new Set();function visit(file){if(files.has(file))return;files.add(file);const code=fs.readFileSync(resolve(work,file),'utf8');for(const m of code.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g))visit(relative(work,resolve(work,dirname(file),m[1])));}for(const file of ['src/loading-extraction-front.js','src/ruined-depot-world-accelerated.js','src/player-vehicles-v3.js','src/campaign-simulation.js'])visit(file);return Object.fromEntries([...files].sort().map(file=>[file,fs.readFileSync(resolve(work,file),'utf8')]));}
const rawPins={'win-direct-01':'458c5034670c74e924d5740c11093c6f548c5e2b73c46d48e409158740bd7a79','win-direct-01-fresh':'458c5034670c74e924d5740c11093c6f548c5e2b73c46d48e409158740bd7a79','playerloss-01':'31da743a02c1dbd911fe85cd90966e197b6f182e4880884f746bd1062822092e','truckloss-02':'58032bdd11727a1820207a115f67cfa1e328f55191785a3a2133b1969a12bc53'};
function readRaw(name){const bytes=fs.readFileSync(new URL(name+'-result.json.gz',evidence));assert.equal(hash(bytes),rawPins[name],'pinned entire raw bytes');return JSON.parse(gunzipSync(bytes));}
async function assertRecord(raw){const {spec}=await built(),current=withPlayerVehicle(spec,'sandfalcon'),sources=physicalClosure();assert.deepEqual(raw.spec,current);assert.equal(raw.specHash,hash(current));assert.deepEqual(raw.finalState.mission,current);assert.deepEqual(raw.sourceSnapshot,sources);assert.deepEqual(raw.sourceHashes,Object.fromEntries(Object.entries(sources).map(([f,s])=>[f,hash(s)])));assert.equal(raw.inputs,raw.runs.reduce((n,r)=>n+r.n,0));assert.equal(raw.tickStateHashes.length,raw.inputs);assert.ok(raw.tickStateHashes.every(s=>/^[0-9a-f]{64}$/.test(s)));assert.equal(raw.finalHash,hash(raw.finalState));assert.equal(raw.tickStateHashes.at(-1),raw.finalHash);assert.deepEqual(raw.runs[0],{n:1,input:{start:true}});assert.equal(raw.failure,null);const helper=raw.retryProof?.fresh.missionId==='mission-9090'&&raw.finalState.result?.cause==='protected-vehicle-destroyed'?'input-acceptance.mjs':'input-acceptance-v1.mjs';assert.equal(raw.helperSHA256,hash(fs.readFileSync(new URL(helper,evidence))));}
function preparationChain(raw,target='tank'){const damage=raw.events.find(e=>e.type==='damaged'&&e.targetId===target&&raw.frames.find(f=>f.tick===e.tick)?.objectiveStates['prepare-extraction'].status==='active');assert.ok(damage,'real hostile preparation damage');const i=raw.events.indexOf(damage),impact=raw.events[i-1],shot=raw.events.find(e=>e.type==='shot'&&e.projectileId===impact.projectileId),frame=raw.frames.find(f=>f.tick===damage.tick);assert.ok(['hostile-flanker','road-gun','ridge-gun'].includes(damage.entityId));assert.equal(shot.entityId,damage.entityId);assert.ok(shot.tick<impact.tick);assert.equal(impact.type,'impact');assert.equal(impact.entityId,damage.entityId);assert.equal(impact.targetId,target);assert.equal(impact.tick,damage.tick);assert.deepEqual(impact.position,damage.position);assert.ok(damage.value>0);const before=target==='tank'?frame.before.playerHp:frame.before.supplyHp,after=target==='tank'?frame.tankCombat.hp:frame.entities.supply.hp;assert.equal(before-after,damage.value);return {shot,impact,damage,frame};}

test('RECORD CONSISTENCY: unmodified Sandfalcon direct win, actual18s, hostile chain, stationary choice and physical arrival',async()=>{
 const raw=readRaw('win-direct-01');await assertRecord(raw);const tape=JSON.parse(fs.readFileSync(new URL('win-direct-01-inputs.json',evidence)));assert.deepEqual(tape.runs,raw.runs);assert.equal(raw.inputs,9190);assert.equal(raw.finalState.phase,'won');assert.equal(raw.finalState.selectedConvoyChoiceId,'direct');assert.equal(raw.finalState.tankCombat.hp,52);assert.equal(raw.finalState.entities.supply.hp,100);assert.equal(raw.finalState.entities.supply.arrived,true);assert.deepEqual(raw.finalState.entities.supply.pose,{x:0,y:0,z:-32,yaw:1.0516502125483707});
 const chain=preparationChain(raw);assert.deepEqual([chain.shot.id,chain.shot.projectileId,chain.shot.tick,chain.impact.id,chain.impact.tick,chain.damage.id],['event-1','projectile-1',121,'event-2',140,'event-3']);
 const prep=raw.finalState.objectiveStates['prepare-extraction'];assert.equal(prep.completedTick,1080);assert.ok(Math.abs(prep.elapsed-18)<1e-8);const chosen=raw.events.filter(e=>e.type==='convoy-route-selected');assert.equal(chosen.length,1);assert.equal(chosen[0].tick,1427);const f=raw.frames.find(f=>f.tick===chosen[0].tick);assert.deepEqual(f.entities.supply.pose,{x:0,y:0,z:28,yaw:0});assert.equal(f.entities.supply.speed,0);assert.equal(f.entities.supply.routeIndex,0);assert.equal(raw.events.find(e=>e.type==='vehicle-arrived'&&e.entityId==='supply').tick,9189);
 assert.ok(raw.frames.filter(f=>f.tick<=1080).every(f=>f.selectedConvoyChoiceId===null&&f.entities.supply.pose.x===0&&f.entities.supply.pose.z===28));
});

test('RECORD CONSISTENCY: single fresh-process literal replay has ENTIRE persisted output equality; 07 failure remains explicit',async()=>{
 const original=readRaw('win-direct-01'),fresh=readRaw('win-direct-01-fresh');await assertRecord(fresh);assert.deepEqual(fresh,original);const terminal=JSON.parse(fs.readFileSync(new URL('07-replay-terminal.json',evidence))),comparison=JSON.parse(fs.readFileSync(new URL('saved-replay-comparison.json',evidence)));assert.equal(terminal.exitCode,1);assert.equal(terminal.timedOut,false);assert.equal(comparison.entireSerializedByteEqual,true);assert.equal(comparison.entireParsedDeepStrictEqual,true);assert.equal(comparison.originalJobExit,1);assert.equal(comparison.freshSHA256,rawPins['win-direct-01']);
});

test('RECORD CONSISTENCY: natural player projectile death and real public retry restore fresh state',async()=>{
 const raw=readRaw('playerloss-01');await assertRecord(raw);preparationChain(raw);assert.equal(raw.finalState.phase,'lost');assert.equal(raw.finalState.result.cause,'tank-destroyed');assert.equal(raw.finalState.tick,3124);assert.equal(raw.finalState.tankCombat.hp,0);assert.equal(raw.finalState.tankCombat.shotsFired,0);assert.deepEqual(raw.retryProof.fresh,createGame(raw.spec));assert.equal(raw.retryProof.started.phase,'playing');assert.equal(raw.retryProof.first.tick,1);assert.equal(raw.retryProof.first.selectedConvoyChoiceId,null);assert.equal(raw.retryProof.first.entities.supply.routeIndex,null);assert.deepEqual(raw.retryProof.first.entities.supply.pose,raw.retryProof.fresh.entities.supply.pose);assert.equal(raw.retryProof.first.objectiveStates['prepare-extraction'].elapsed,1/60);
});

test('RECORD CONSISTENCY mutation negatives reject stale spec/source and missing actual damage chain',async()=>{
 const raw=readRaw('win-direct-01'),stale=structuredClone(raw);stale.spec.objectives[0].duration=17;stale.specHash=hash(stale.spec);await assert.rejects(()=>assertRecord(stale));const missing=structuredClone(raw);delete missing.sourceSnapshot['src/loading-extraction-front.js'];delete missing.sourceHashes['src/loading-extraction-front.js'];await assert.rejects(()=>assertRecord(missing));const noDamage=structuredClone(raw);noDamage.events=noDamage.events.filter(e=>!(e.type==='damaged'&&e.tick<1080&&e.targetId==='tank'));assert.throws(()=>preparationChain(noDamage));
});

test('RECORD CONSISTENCY: natural hostile truck destruction during unfinished preparation and actual public retry',async()=>{
 const raw=readRaw('truckloss-02');await assertRecord(raw);preparationChain(raw,'supply');assert.equal(raw.inputs,3888);assert.equal(raw.finalState.tick,3887);assert.equal(raw.finalState.phase,'lost');assert.equal(raw.finalState.result.cause,'protected-vehicle-destroyed');assert.equal(raw.finalState.result.entityId,'supply');assert.equal(raw.finalState.tankCombat.hp,88);assert.equal(raw.finalState.tankCombat.shotsFired,0);assert.equal(raw.finalState.entities.supply.hp,0);assert.equal(raw.finalState.entities.supply.alive,false);assert.equal(raw.finalState.selectedConvoyChoiceId,null);assert.deepEqual(raw.finalState.objectiveStates['prepare-extraction'],{id:'prepare-extraction',status:'active',progress:0,elapsed:0,completedTick:null});assert.equal(raw.finalState.objectiveStates['escort-supply'].status,'locked');assert.deepEqual(raw.retryProof.fresh,createGame(raw.spec));assert.equal(raw.retryProof.started.phase,'playing');assert.equal(raw.retryProof.first.tick,1);assert.equal(raw.retryProof.first.tankCombat.hp,100);assert.equal(raw.retryProof.first.entities.supply.hp,100);assert.equal(raw.retryProof.first.entities.supply.alive,true);assert.equal(raw.retryProof.first.entities.supply.arrived,false);assert.equal(raw.retryProof.first.entities.supply.routeIndex,null);assert.equal(raw.retryProof.first.selectedConvoyChoiceId,null);assert.deepEqual(raw.retryProof.first.entities.supply.pose,{x:0,y:0,z:28,yaw:0});assert.equal(raw.retryProof.first.objectiveStates['prepare-extraction'].elapsed,1/60);assert.equal(raw.retryProof.first.objectiveStates['escort-supply'].status,'locked');assert.equal(raw.retryProof.first.projectiles.length,0);
});
