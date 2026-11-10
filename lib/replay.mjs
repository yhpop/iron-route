/** Independent replay; only createGame + recorded ordinary input + stepGame. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadWitness,expandRuns,sha256} from './evidence.mjs';
import {assertFrameEvents,assertVictory,assertExpectedResult} from './invariants.mjs';
function routeProgress(points,p) {
  let total=0,bestDistance=Infinity,best=0;
  for(let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
    const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(length*length)));
    const distance=Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);
    if(distance<bestDistance) {bestDistance=distance;best=total+t*length;} total+=length;
  }
  return best/total;
}
function assertFinite(value,label) {
  if(typeof value==='number') assert.ok(Number.isFinite(value),'finite simulated state: '+label);
  else if(value && typeof value==='object') for(const [key,child] of Object.entries(value)) assertFinite(child,label+'.'+key);
}
export async function replayRoute(routeId,options={}) {
  const {tape,definition,expected,sourceRoot,sourceFiles,dependencyFiles}=loadWitness(routeId,options);
  const module=name=>import(pathToFileURL(path.join(sourceRoot,'src',name)).href);
  const [{createEightNpcCrossfire},{withPlayerVehicle,playerRig},{createGame,stepGame},{createRuinedDepotWorld},{areHostile},{getTankTransform}]=await Promise.all([
    module('eight-npc-crossfire-front.js'),module('player-vehicles-v3.js'),module('campaign-simulation.js'),module('ruined-depot-world-accelerated.js'),module('combat-relations.js'),module('tank-controller.js'),
  ]);
  const {spec:base,field}=createEightNpcCrossfire(),spec=withPlayerVehicle(base,tape.vehicle);
  assert.equal(sha256(spec),tape.specHash,'complete real mission spec hash');
  const rig=playerRig(spec),world=createRuinedDepotWorld(spec,field);
  const route=spec.routes.find(r=>r.id===spec.convoyChoice.options.find(o=>o.id===tape.route).routeByTruck.supply);
  const tracker={shots:new Map(),impacts:new Set(),eventIds:new Set(),lastTick:-1,damageChecks:0,projectileChecks:0,sameTickImpacts:0};
  const stats={muzzleChecks:0,lateNorthernShots:0,lateNorthernDamage:0,alliedContacts:0};
  const events=[]; let state=createGame(spec),count=0;
  try {
    for(const input of expandRuns(tape.runs)) {
      state=stepGame(state,input,tape.dt,world); count++;
      assert.equal(state.tick,count-1,'one real tick per input after normal start');
      assert.equal(state.phase,count===tape.inputs?'won':'playing','no premature terminal state or resurrection');
      assert.ok(state.tankCombat.hp>0 && state.entities.supply.hp>0,'player and escort survive every input');
      assertFinite(state.tank,'tank'); assertFinite(state.entities,'entities'); assertFinite(state.projectiles,'projectiles'); assertFinite(state.events,'events');
      if(count===tape.prefix.inputs) assert.equal(sha256(state),tape.prefix.finalHash,'entire current-controller prefix terminal state');
      assert.deepEqual(world.muzzleContacts(getTankTransform(state.tank,rig),rig).contacts,[],'accepted muzzle clear at tick '+state.tick); stats.muzzleChecks++;
      assertFrameEvents(state,tracker,areHostile); events.push(...state.events);
      stats.alliedContacts+=(state.tankFrame.contacts||[]).filter(id=>['allied-north','allied-far-east'].includes(id)).length;
      if(routeProgress(route.points,state.entities.supply.pose)>=.5) for(const e of state.events) {
        if(!['ridge-gun','hostile-far-east'].includes(e.entityId)) continue;
        if(e.type==='shot' && ['tank','supply'].includes(state.entities[e.entityId].targetId)) stats.lateNorthernShots++;
        if(e.type==='damaged' && ['tank','supply'].includes(e.targetId)) stats.lateNorthernDamage++;
      }
    }
    assert.equal(count,tape.inputs,'complete recorded input consumed');
    assertVictory(state,events,definition);
    assertExpectedResult(state,events,expected);
    assert.equal(sha256(state),definition.finalHash,'complete final hash');
    assert.equal(state.tick,definition.tick,'recorded terminal tick');
    assert.equal(events.length,definition.events,'complete event count');
    assert.equal(state.tankCombat.hp,definition.playerHp,'recorded player HP');
    assert.equal(state.entities.supply.hp,definition.supplyHp,'recorded escort HP');
    return {
      route:routeId,nodeVersion:process.version,boundary:'CPU-only literal-input regression; not historical compatibility or browser/GPU/device/human acceptance.',
      sourceFiles,dependencyFiles,inputs:count,tick:state.tick,phase:state.phase,playerHp:state.tankCombat.hp,supplyHp:state.entities.supply.hp,supplyArrived:state.entities.supply.arrived,
      events:events.length,finalHash:sha256(state),eventsHash:sha256(events),
      stats:{...stats,damageChecks:tracker.damageChecks,projectileChecks:tracker.projectileChecks,sameTickImpacts:tracker.sameTickImpacts},
      retainedHistoricalInputs:tape.prefix.inputs,originalHistoricalInputs:definition.originalHistoricalInputs,completeOldTapeConsumed:definition.completeOldTapeConsumed,
      entireStateAndEventsStrictEqual:true,losslessRawEvidence:Boolean(definition.files.raw),
    };
  } finally {world.dispose();}
}
