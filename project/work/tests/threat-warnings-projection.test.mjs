import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {getCraftedMission} from '../src/content/crafted20/index.js';
import {createWorld} from '../src/campaign-world.js';
import {createGame,stepGame} from '../src/campaign-simulation.js';
import {computeChargeWarnings,projectThreatPoint} from '../src/threat-warnings.js';
import {createProductionCamera} from './helpers/production-camera.mjs';

// These are CPU source-camera projections and injected DOMRect contracts, not
// browser pixels, measured touch comfort or a claim that the physical gun fits.
const viewports = [[390,844,0],[390,664,34],[844,390,0],[820,1180,0],[1280,720,0]];
function recordedRun(name, maxTick) {
 const tape=JSON.parse(gunzipSync(readFileSync(new URL(`../qa/crafted20-playthrough/${name}-inputs.json.gz`,import.meta.url))));
 const spec=getCraftedMission(tape.missionId),world=createWorld(spec), cameras=viewports.map(()=>createProductionCamera());
 let state=createGame(spec), first=null, afterCharge=null;
 try {
  outer:for(const run of tape.runs) for(let i=0;i<run.n;i++) {
   state=stepGame(state,run.input,tape.dt,world);
   const frames=viewports.map(([width,height,bottomInset],index)=>({camera:cameras[index](state.tank,width/height,tape.dt),canvasRect:{left:13,top:21,width,height},bottomInset}));
   const charging=Object.values(state.entities).filter(e=>e.alive&&e.status==='charging'&&e.targetId==='tank');
   if(!first&&charging.length) first={state,frames:frames.map(frame=>({...frame,camera:frame.camera.clone()})),entityId:charging[0].id};
   if(first&&!charging.length&&state.tick>first.state.tick) afterCharge=state;
   if(state.tick>=maxTick) break outer;
  }
  return {first,afterCharge,spec,tape};
 } finally { world.dispose(); }
}
function resultFor(sample,frame) {
 const origin=projectThreatPoint({entity:sample.state.tank,camera:frame.camera,canvasRect:frame.canvasRect,height:.8});
 return computeChargeWarnings({state:sample.state,origin,projectEntity:entity=>projectThreatPoint({entity,camera:frame.camera,canvasRect:frame.canvasRect})});
}

test('real level003 first charge is reported in all five actual source-camera viewport projections',()=>{
 const {first,afterCharge,spec,tape}=recordedRun('release-main-crafted20-003',390);
 assert.ok(first);assert.equal(first.state.tick,272);assert.equal(first.state.entities[first.entityId].targetId,'tank');
 assert.equal(createHash('sha256').update(JSON.stringify(spec)).digest('hex'),tape.specHash);
 for(let i=0;i<viewports.length;i++) {
  const frame=first.frames[i], stateBefore=JSON.stringify(first.state),cameraBefore=JSON.stringify(frame.camera.toJSON()),result=resultFor(first,frame);
  assert.equal(result.total,1,viewports[i].join('x'));assert.equal(result.entries[0].id,'bend-gun');assert.ok(result.entries[0].remaining>1.7&&result.entries[0].remaining<1.8);
  assert.match(result.text,/^瞄你[↑↗→↘↓↙←↖]1\.8秒$/u);assert.equal(JSON.stringify(first.state),stateBefore);assert.equal(JSON.stringify(frame.camera.toJSON()),cameraBefore);
  const shifted={...frame,canvasRect:{...frame.canvasRect,left:0,top:0}};
  assert.equal(resultFor(first,shifted).text,result.text,'canvas viewport offsets must not change relative bearing');
 }
 const portrait=first.frames[0], gun=projectThreatPoint({entity:first.state.entities[first.entityId],camera:portrait.camera,canvasRect:portrait.canvasRect});
 assert.ok(gun.x>portrait.canvasRect.left+390,'real portrait gun remains offscreen: warning is not a visibility claim');
 assert.ok(afterCharge);assert.equal(computeChargeWarnings({state:afterCharge}).total,0,'authoritative cancellation/shot retires the warning');
});
test('level002 UI-overlap charge is still represented, including short portrait with34px inset',()=>{
 const {first,spec,tape}=recordedRun('opening-v5-west-crafted20-002',1393);
 assert.ok(first);assert.equal(first.state.tick,1392);assert.equal(first.entityId,'armored-yard-gun');
 assert.equal(createHash('sha256').update(JSON.stringify(spec)).digest('hex'),tape.specHash);
 for(const frame of first.frames) {
  const r=resultFor(first,frame);assert.equal(r.total,1);assert.equal(r.entries[0].id,'armored-yard-gun');assert.match(r.text,/瞄你/);
 }
 const chrome=first.frames[1];assert.equal(chrome.bottomInset,34);assert.equal(chrome.canvasRect.height,664);
 const oldEvidence=JSON.parse(readFileSync(new URL('../qa/002-opening/hud-counterexample.json',import.meta.url)));
 assert.equal(oldEvidence.tick,first.state.tick);assert.ok(oldEvidence.visibleGunSamplesUnderFireButton>0);
 const paused={...first.state,phase:'paused'};assert.equal(computeChargeWarnings({state:paused}).text,'');
 const resumed={...paused,phase:'playing'};const frame=chrome;
 const active=resultFor({...first,state:resumed},frame);assert.equal(active.text,resultFor(first,frame).text,'pause does not invent elapsed charge time');
 assert.equal(computeChargeWarnings({state:createGame(spec)}).text,'','mission reset cannot retain a warning');
});
