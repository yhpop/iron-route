/** Diagnostic compatibility check; NEVER changes the retained accepted40 tapes/manifest. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {getCraftedMission} from '../../src/content/crafted20/index.js';
import {createWorld} from '../../src/campaign-world.js';
import {createGame,stepGame} from '../../src/campaign-simulation.js';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const files=['accepted-main-b-crafted20-015-inputs.json.gz','accepted-alt-b-crafted20-017-inputs.json.gz'];
const results=[];
for(const file of files){
 const tape=JSON.parse(gunzipSync(readFileSync(new URL(`../accepted40/${file}`,import.meta.url)))),spec=getCraftedMission(tape.missionId),world=createWorld(spec);let state=createGame(spec);
 try{for(const run of tape.runs)for(let i=0;i<run.n;i++)state=stepGame(state,run.input,tape.dt,world);
 assert.equal(state.phase,'won');assert.equal(hash(spec),tape.specHash);const compatibility=structuredClone(state),metadata=[];
 for(const event of compatibility.events)if(event.type==='impact'){
  assert.ok(event.normal&&['x','y','z'].every(k=>Number.isFinite(event.normal[k])));assert.match(event.projectileId,/^projectile-\d+$/);
  metadata.push({eventId:event.id,normal:event.normal,projectileId:event.projectileId});delete event.normal;delete event.projectileId;
 }
 assert.ok(metadata.length>0);assert.notEqual(hash(state),tape.finalHash);assert.equal(hash(compatibility),tape.finalHash,'only documented extra impact metadata may differ');
 results.push({file,phase:state.phase,tick:state.tick,hp:state.tankCombat.hp,currentHash:hash(state),historicalHash:tape.finalHash,compatibilityHash:hash(compatibility),exactHistoricalMatchAfterRemovingOnlyDocumentedMetadata:true,metadata});
 }finally{world.dispose();}
}
console.log(JSON.stringify({originalAcceptanceStillFails:true,originalTapesAndManifestModified:false,results},null,2));
