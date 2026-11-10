/** Behavioral audit only. No writes to or normalization of simulation state. */
import assert from 'node:assert/strict';
export function assertExpectedResult(state,events,expected) {
  assert.deepEqual(state,expected.finalState,'entire final state (strict, including signed zero)');
  assert.deepEqual(events,expected.events,'entire ordered events (strict, including signed zero)');
}
export function assertFrameEvents(state,tracker,areHostile) {
  for(const [i,e] of state.events.entries()) {
    assert.ok(!tracker.eventIds.has(e.id),'duplicate event id '+e.id);
    tracker.eventIds.add(e.id);
    assert.equal(e.tick,state.tick,'event belongs to current tick');
    assert.ok(e.tick>=tracker.lastTick,'event ticks ordered'); tracker.lastTick=e.tick;
    if(e.type==='shot') {
      assert.ok(!tracker.shots.has(e.projectileId),'duplicate projectile id '+e.projectileId);
      tracker.shots.set(e.projectileId,{owner:e.entityId,tick:state.tick});
      const live=state.projectiles.find(p=>p.id===e.projectileId);
      const impact=state.events.find(p=>p.type==='impact' && p.projectileId===e.projectileId && p.entityId===e.entityId);
      assert.ok(live || impact,'shot must create physical projectile or same-tick impact');
      if(live) assert.equal(live.ownerId,e.entityId,'live projectile owner must match shot');
      if(!live) tracker.sameTickImpacts++;
      tracker.projectileChecks++;
    }
    if(e.type==='vehicle-arrived' && e.entityId==='supply') {
      const supply=state.entities.supply;
      assert.ok(supply.arrived && supply.status==='arrived' && supply.alive && supply.hp>0 && !supply.destroyed,'arrival frame status must be alive and arrived');
      assert.deepEqual({x:supply.pose.x,y:supply.pose.y,z:supply.pose.z},{x:e.position.x,y:e.position.y,z:e.position.z},'arrival frame position must agree with physical event');
      assert.deepEqual({x:supply.pose.x,z:supply.pose.z},{x:0,z:-32},'arrival frame destination');
    }
    if(e.type==='impact') {
      const shot=tracker.shots.get(e.projectileId);
      assert.ok(shot && shot.owner===e.entityId && shot.tick<=state.tick,'impact must follow recorded shot');
      assert.ok(!tracker.impacts.has(e.projectileId),'duplicate physical impact for projectile '+e.projectileId);
      tracker.impacts.add(e.projectileId);
    }
    if(e.type==='damaged') {
      assert.ok(areHostile(state,e.entityId,e.targetId),'no friendly damage');
      const impact=state.events[i-1],shot=tracker.shots.get(impact?.projectileId);
      assert.ok(impact?.type==='impact' && impact.value==='hit' && impact.entityId===e.entityId && impact.targetId===e.targetId && shot?.owner===e.entityId && shot.tick<=state.tick,'damage must follow matching physical impact');
      tracker.damageChecks++;
    }
  }
}
export function assertVictory(state,events,definition) {
  assert.equal(state.phase,'won','actual victory');
  assert.ok(state.tankCombat.hp>0,'player alive');
  const supply=state.entities.supply;
  assert.ok(supply.hp>0 && supply.alive && !supply.destroyed,'supply alive');
  assert.equal(supply.arrived,true,'supply arrived');
  assert.equal(supply.status,'arrived','supply arrived status');
  assert.deepEqual({x:supply.pose.x,z:supply.pose.z},{x:0,z:-32},'physical destination');
  assert.equal(state.selectedConvoyChoiceId,definition.selectedRoute,'selected route');
  assert.equal(supply.routeId,definition.selectedRoute==='direct'?'ridge-east':'ridge-west','actual supply route');
  const arrivals=events.filter(e=>e.type==='vehicle-arrived' && e.entityId==='supply');
  assert.equal(arrivals.length,1,'one physical arrival event');
  assert.deepEqual({x:arrivals[0].position.x,z:arrivals[0].position.z},{x:0,z:-32},'arrival event destination');
  const completions=events.filter(e=>e.type==='objective-changed' && e.entityId==='escort-supply' && e.value==='complete');
  assert.equal(completions.length,1,'one completed escort objective');
  const endings=events.filter(e=>e.type==='mission-ended');
  assert.equal(endings.length,1,'one mission end');
  assert.equal(endings[0].value,'won','mission end victory');
  assert.equal(endings[0].cause,'objectives-complete','mission end from objectives');
  assert.ok(events.indexOf(arrivals[0])<events.indexOf(completions[0]) && events.indexOf(completions[0])<events.indexOf(endings[0]),'arrival before escort completion before mission-end event order');
  assert.equal(endings[0].tick,state.tick,'terminal event tick');
  const choices=events.filter(e=>e.type==='convoy-route-selected');
  assert.equal(choices.length,1,'one locked convoy route');
  assert.equal(choices[0].value,definition.selectedRoute,'route selection event');
}
