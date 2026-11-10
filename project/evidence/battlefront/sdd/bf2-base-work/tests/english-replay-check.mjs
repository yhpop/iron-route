/** Reconstruction verification. Read original accepted40 tapes without rebinding them.
 * Compare every English simulation state to current Chinese state; only embedded
 * mission title/briefing are omitted after proving all other spec fields equal.
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {englishModules as modules} from './english-test-modules.mjs';
import {getCraftedMission} from '../src/content/crafted20/index.js';
import {createGame,stepGame} from '../src/campaign-simulation.js';
import {createWorld} from '../src/campaign-world.js';
const english=modules['./content/crafted20/index.js'],simulation=modules['./campaign-simulation.js'],worlds=modules['./campaign-world.js'];
const hash=value=>createHash('sha256').update(Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const strip=value=>Array.isArray(value)?value.map(strip):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([k])=>!['title','briefing'].includes(k)).map(([k,v])=>[k,strip(v)])):value;
const manifest=JSON.parse(await readFile(new URL('../qa/accepted40/manifest.json',import.meta.url),'utf8')),reports=[];
for(const mission of manifest.missions)for(const route of ['main','alternative']){
 const expected=mission[route],url=new URL('../qa/accepted40/'+expected.tape,import.meta.url),bytes=await readFile(url),tape=JSON.parse(gunzipSync(bytes));
 assert.equal(hash(bytes),expected.tapeSHA256);assert.equal(tape.missionId,mission.id);
 const zh=getCraftedMission(mission.id),en=english.getCraftedMission(mission.id);assert.equal(hash(zh),tape.specHash,'original tape must match current Chinese spec');assert.deepEqual(strip(en),strip(zh));
 const zhWorld=createWorld(zh),enWorld=worlds.createWorld(en);let a=createGame(zh),b=simulation.createGame(en),snapshots=0;
 try{for(const run of tape.runs)for(let i=0;i<run.n;i++){a=stepGame(a,run.input,tape.dt,zhWorld);b=simulation.stepGame(b,run.input,tape.dt,enWorld);assert.deepEqual({...b,mission:null},{...a,mission:null},`${mission.id} ${route} input ${snapshots}`);snapshots++;}}finally{zhWorld.dispose();enWorld.dispose();}
 assert.equal(hash(a),tape.finalHash);assert.equal(a.phase,'won');assert.equal(b.phase,'won');assert.equal(a.tick,expected.tick);assert.equal(hash(await readFile(url)),hash(bytes));
 const report={missionId:mission.id,route,tape:expected.tape,tapeSHA256:hash(bytes),snapshots,phase:b.phase,tick:b.tick,recordedSpecHash:tape.specHash,englishSpecHash:hash(en),recordedFinalHash:tape.finalHash,englishFinalHash:hash(b),originalChineseSpecAndStateHashesMatch:true,allNonPresentationStatesEqual:true,originalTapeUnchanged:true};reports.push(report);console.log(JSON.stringify(report));
}
console.log(JSON.stringify({missions:new Set(reports.map(r=>r.missionId)).size,tapes:reports.length,snapshots:reports.reduce((n,r)=>n+r.snapshots,0),won:reports.filter(r=>r.phase==='won').length,allOriginalChineseHashesMatch:true,allEnglishSimulationSnapshotsMatch:true,browserOrHumanPlaythrough:false}));
