/** Separate-process deterministic full-state replay of input-only V4 tapes.
 * Long route replays are opt-in; no browser/WebGL claims are made here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCrossfireV4Front} from '../src/crossfire-v4-front.js';
import {withPlayerVehicle} from '../src/player-vehicles-v3.js';
import {createGame,stepGame,retry} from '../src/campaign-simulation.js';
import {createTerrainCombatWorld} from '../src/terrain-candidate/combat-world.js';
const dir=new URL('../qa/crossfire-v4/',import.meta.url),root=new URL('../',import.meta.url);
const hash=x=>createHash('sha256').update(Buffer.isBuffer(x)||typeof x==='string'?x:JSON.stringify(x)).digest('hex');
mkdirSync(dir,{recursive:true});
const rootPath=fileURLToPath(root),closure=new Set();
function visit(file){if(closure.has(file))return;closure.add(file);const source=readFileSync(new URL(file,root),'utf8');for(const m of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g))visit(relative(rootPath,resolve(rootPath,dirname(file),m[1])));}
for(const file of ['src/crossfire-v4-front.js','src/player-vehicles-v3.js','src/campaign-simulation.js','src/terrain-candidate/combat-world.js'])visit(file);
const manifestURL=new URL('acceptance-inputs.json',dir),acceptedFiles=existsSync(manifestURL)?JSON.parse(readFileSync(manifestURL,'utf8')).files:[];
const files=acceptedFiles.filter(f=>!process.env.CROSSFIRE_V4_TAPE||f===process.env.CROSSFIRE_V4_TAPE);
test('V4 acceptance manifest explicitly selects completed tapes, never late diagnostic output',()=>{assert.ok(existsSync(manifestURL),'missing acceptance input manifest');assert.ok(acceptedFiles.length>=2);assert.equal(new Set(acceptedFiles).size,acceptedFiles.length);for(const f of acceptedFiles){assert.match(f,/^[a-z0-9-]+-inputs\.json\.gz$/);assert.ok(!f.endsWith('-03-inputs.json.gz'),'uncertain attempt03 excluded');assert.ok(existsSync(new URL(f,dir)),f);}});
const controls=new Set(['start','throttle','steer','brake','aim','firePressed','convoyOrder','pause','resume','governor']);
for(const file of files){const raw=readFileSync(new URL(file,dir)),tape=JSON.parse(gunzipSync(raw));
 test('V4 tape binds exact mission, physical rig, full source closure and real controls '+file,()=>{
  const {spec}=createCrossfireV4Front();assert.equal(spec.id,'mission-9052');assert.ok(['pz3','vanguard','newc-leichttraktor','newc-tiger','sandfalcon'].includes(tape.vehicleId));assert.equal(tape.missionId,spec.id);assert.equal(tape.dt,1/60);
  assert.equal(hash(withPlayerVehicle(spec,tape.vehicleId)),tape.specHash);assert.equal(hash(tape.spec),tape.specHash);assert.equal(hash(tape.finalState),tape.finalHash);assert.equal(tape.vehicleVersion,tape.spec.playerVehicle.version);
  assert.deepEqual(tape.runs[0],{n:1,input:{start:true}});
  assert.ok(Object.keys(tape.sourceHashes).includes('src/crossfire-v4-front.js'));assert.ok(Object.keys(tape.sourceHashes).includes('src/player-vehicles-v3.js'));
  assert.deepEqual(Object.keys(tape.sourceHashes).sort(),[...closure].sort(),'complete static dependency closure');
  for(const[f,sha]of Object.entries(tape.sourceHashes)){assert.equal(hash(readFileSync(new URL(f,root))),sha,f);assert.equal(hash(tape.sourceSnapshot[f]),sha,f+' snapshot');}
  for(const run of tape.runs){assert.ok(Number.isInteger(run.n)&&run.n>0);for(const key of Object.keys(run.input))assert.ok(controls.has(key),'forbidden non-control '+key);for(const key of ['throttle','steer'])if(key in run.input)assert.ok(Number.isFinite(run.input[key])&&Math.abs(run.input[key])<=1);if(run.input.aim){assert.deepEqual(Object.keys(run.input.aim),['worldPoint']);assert.deepEqual(Object.keys(run.input.aim.worldPoint).sort(),['x','y','z']);for(const n of Object.values(run.input.aim.worldPoint))assert.ok(Number.isFinite(n));}}
 });
 test('V4 complete independent full-state input replay '+file,{skip:process.env.CROSSFIRE_V4_REPLAY_FULL!=='1'},()=>{
  console.log(JSON.stringify({event:'replay-start',file,at:new Date().toISOString()}));const {spec,field}=createCrossfireV4Front(),resolved=withPlayerVehicle(spec,tape.vehicleId);assert.equal(hash(resolved),tape.specHash);const world=createTerrainCombatWorld(resolved,field);let s=createGame(resolved),inputs=0;const mutual={supportShots:0,flankerShots:0,supportDamageEvents:0,flankerDamageEvents:0,friendlyDamageEvents:0};
  try{for(const run of tape.runs)for(let n=0;n<run.n;n++){s=stepGame(s,run.input,tape.dt,world);inputs++;if(inputs%3000===0)console.log(JSON.stringify({event:'replay-progress',file,inputs,tick:s.tick,phase:s.phase}));for(const e of s.events){if(e.type==='shot'&&e.entityId==='allied-support')mutual.supportShots++;if(e.type==='shot'&&e.entityId==='hostile-flanker')mutual.flankerShots++;if(e.type==='damaged'&&e.entityId==='allied-support'&&e.targetId==='hostile-flanker')mutual.supportDamageEvents++;if(e.type==='damaged'&&e.entityId==='hostile-flanker'&&e.targetId==='allied-support')mutual.flankerDamageEvents++;if(e.type==='damaged'&&['tank','allied-support','supply'].includes(e.entityId)&&['tank','allied-support','supply'].includes(e.targetId))mutual.friendlyDamageEvents++;}}
   assert.equal(s.phase,tape.finalPhase);assert.equal(hash(s),tape.finalHash);assert.deepEqual(JSON.parse(JSON.stringify(s)),tape.finalState,'every JSON-serialized retained state value must independently match (-0 serializes as 0)');assert.equal(mutual.friendlyDamageEvents,0);if(tape.finalPhase==='won'){assert.equal(s.entities.supply.arrived,true);assert.equal(s.selectedConvoyChoiceId,tape.route);for(const id of ['allied-support','hostile-flanker'])assert.ok(s.entities[id].travel>1,id+' accepted patrol travel');for(const k of ['supportShots','flankerShots','supportDamageEvents','flankerDamageEvents'])assert.ok(mutual[k]>0,k);}
   const report={evidenceBoundary:'Offline production simulation only; not browser/WebGL acceptance',file,inputSHA256:hash(raw),recordedSourceHashes:tape.sourceHashes,specHash:tape.specHash,vehicleId:tape.vehicleId,inputs,tick:s.tick,phase:s.phase,expectedFinalHash:tape.finalHash,finalHash:hash(s),fullStateExact:true,hp:s.tankCombat.hp,truckHp:s.entities.supply.hp,truckArrived:s.entities.supply.arrived,selectedRoute:s.selectedConvoyChoiceId,patrolTravel:Object.fromEntries(['allied-support','hostile-flanker'].map(id=>[id,s.entities[id].travel])),mutual,at:new Date().toISOString()};writeFileSync(new URL(file.replace('-inputs.json.gz','-independent.json'),dir),JSON.stringify(report,null,2));console.log(JSON.stringify({event:'replay-end',...report}));
  }finally{world.dispose();}
 });
}

test('V4 fifth rig opening has real opposing shots/damage; pause freezes complete state and retry is exact',()=>{
 const {spec:base,field}=createCrossfireV4Front(),spec=withPlayerVehicle(base,'sandfalcon'),world=createTerrainCombatWorld(spec,field);let s=createGame(spec),events=[];
 try{s=stepGame(s,{start:true},1/60,world);for(let n=0;n<360;n++){s=stepGame(s,{},1/60,world);events.push(...s.events);}for(const[a,b]of[['allied-support','hostile-flanker'],['hostile-flanker','allied-support']]){assert.ok(events.some(e=>e.type==='shot'&&e.entityId===a));assert.ok(events.some(e=>e.type==='damaged'&&e.entityId===a&&e.targetId===b));}s=stepGame(s,{pause:true},1/60,world);const paused=hash(s);for(let n=0;n<120;n++)s=stepGame(s,{throttle:1,steer:1,firePressed:true},1/60,world);assert.equal(hash(s),paused);s=stepGame(s,{resume:true},1/60,world);assert.equal(s.phase,'playing');assert.deepEqual(retry(spec),createGame(spec));const initial=createGame(spec);s=stepGame(retry(spec),{start:true},1/60,world);assert.equal(s.tankCombat.hp,initial.tankCombat.hp);assert.equal(s.entities.supply.hp,initial.entities.supply.hp);assert.equal(s.projectiles.length,0);writeFileSync(new URL('opening-pause-retry.json',dir),JSON.stringify({missionId:spec.id,specHash:hash(spec),openingTicks:360,pauseTicks:120,pauseExact:true,retryExact:true,events},null,2));}finally{world.dispose();}
});

test('V4 real terrain friendly-shell collision fixture absorbs without allied damage',()=>{
 // Explicit projectile fixture, NOT an acceptance tape and NOT a claimed player action.
 const {spec:base,field}=createCrossfireV4Front(),spec=withPlayerVehicle(base,'sandfalcon'),world=createTerrainCombatWorld(spec,field);try{let s=stepGame(createGame(spec),{start:true},1/60,world);const p=s.entities['allied-support'].pose,hp=s.entities['allied-support'].hp;s.projectiles=[{id:'friendly-v4-fixture',ownerId:'tank',faction:'allied',position:{x:p.x+3,y:p.y+.6,z:p.z},previousPosition:{x:p.x+3,y:p.y+.6,z:p.z},velocity:{x:-60,y:0,z:0},damage:70,life:4}];s=stepGame(s,{},.1,world);assert.equal(s.entities['allied-support'].hp,hp);assert.equal(s.projectiles.some(p=>p.id==='friendly-v4-fixture'),false);assert.ok(s.events.some(e=>e.type==='impact'&&e.targetId==='allied-support'&&e.value==='friendly-block'));assert.ok(!s.events.some(e=>e.type==='damaged'&&e.targetId==='allied-support'));writeFileSync(new URL('friendly-collision-fixture.json',dir),JSON.stringify({fixture:'Explicit seeded projectile in unmodified V4 terrain; excluded from route tapes',missionId:spec.id,events:s.events,supportHpBefore:hp,supportHpAfter:s.entities['allied-support'].hp},null,2));}finally{world.dispose();}
});

test('V4 lethal isolated fixture reaches real defeat, terminal inputs freeze, retry restores fifth config',()=>{
 // Remove support from a copied fixture so hostile fire targets the player promptly.
 // Enemy weapon/damage, player HP, terrain, collision and simulation remain unchanged.
 const {spec:base,field}=createCrossfireV4Front(),spec=withPlayerVehicle(base,'sandfalcon');spec.entities=spec.entities.filter(e=>e.id!=='allied-support');const world=createTerrainCombatWorld(spec,field);let s=createGame(spec),events=[];try{s=stepGame(s,{start:true},.1,world);let inputs=0;while(s.phase==='playing'&&inputs++<1200){s=stepGame(s,{},.1,world);events.push(...s.events);}assert.equal(s.phase,'lost');assert.ok(s.tankCombat.hp<=0);assert.ok(events.some(e=>e.type==='damaged'&&e.entityId==='hostile-flanker'&&e.targetId==='tank'));s=stepGame(s,{},.1,world);const terminal=hash(s);for(let n=0;n<20;n++)s=stepGame(s,{throttle:1,steer:1,firePressed:true},.1,world);assert.equal(hash(s),terminal);const restored=retry(spec);assert.deepEqual(restored,createGame(spec));assert.equal(restored.phase,'briefing');assert.equal(restored.playerVehicle,undefined);assert.equal(restored.mission.playerVehicle.id,'sandfalcon');assert.equal(restored.tankCombat.hp,spec.playerVehicle.hp);assert.equal(restored.projectiles.length,0);writeFileSync(new URL('defeat-retry-fixture.json',dir),JSON.stringify({fixture:'Copied V4 spec with allied-support removed; not a route tape',specHash:hash(spec),inputs,dt:.1,phase:s.phase,hp:s.tankCombat.hp,terminalExact:true,retryExact:true,events},null,2));}finally{world.dispose();}
});

test('V4 acceptance includes independently replayable wins for both genuine fifth-chassis routes',{skip:process.env.CROSSFIRE_V4_REPLAY_FULL!=='1'},()=>{
 const wins=acceptedFiles.map(file=>JSON.parse(gunzipSync(readFileSync(new URL(file,dir))))).filter(t=>t.vehicleId==='sandfalcon'&&t.finalPhase==='won');for(const route of ['direct','covered'])assert.ok(wins.some(t=>t.route===route),'missing successful '+route+' tape');
});

 test('V4 requires retained fifth-chassis input-only wins on both routes',()=>{const wins=acceptedFiles.map(file=>JSON.parse(gunzipSync(readFileSync(new URL(file,dir))))).filter(t=>t.vehicleId==='sandfalcon'&&t.finalPhase==='won');for(const route of ['direct','covered'])assert.ok(wins.some(t=>t.route===route),'missing successful '+route+' tape');});
