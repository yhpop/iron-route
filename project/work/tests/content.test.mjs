import test from 'node:test';
import assert from 'node:assert/strict';
import { getMission, listMissions, validateMission } from '../src/content/index.js';

test('first three mission records contain the promised physical outcomes', () => {
  const freight = getMission('mission-001');
  assert.equal(freight.id, 'mission-001');
  assert.ok(freight.geometry.some(c => c.destructible));
  assert.equal(freight.entities.filter(e => e.kind === 'truck').length, 1);
  assert.ok(freight.objectives.some(o => o.type === 'breach'));
  const flank = getMission('mission-002');
  assert.ok(flank.entities.some(e => e.kind === 'turret' && e.shieldArc > 0));
  assert.ok(flank.surfaces.length);
  const convoy = getMission('mission-003');
  assert.equal(convoy.entities.filter(e => e.kind === 'truck').length, 2);
  assert.equal(convoy.entities.filter(e => e.kind === 'turret').length, 2);
  for (const spec of [freight, flank, convoy]) {
    const result = validateMission(spec);
    assert.equal(result.valid, true, `${spec.id}: ${result.errors.join('; ')}`);
    assert.equal(result.audit.phaseWitnesses, spec.objectives.length);
    assert.ok(Object.isFrozen(spec));
  }
});

test('content references are stable, read-only and unknown IDs do not silently alias', () => {
  assert.equal(getMission('does-not-exist'), undefined);
  assert.equal(listMissions()[0], getMission('mission-001'));
  assert.throws(() => {getMission('mission-001').spawn.x = 999;}, TypeError);
});

test('validator rejects broken objective links and closed-gate witness paths', () => {
  const bad = structuredClone(getMission('mission-001'));
  bad.objectives[0].targetIds.push('missing-target');
  assert.equal(validateMission(bad).valid, false);
  const obstructed = structuredClone(getMission('mission-001'));
  obstructed.witness.phases[0].tankWaypoints = [{x:0,z:12,yaw:0},{x:0,z:-10,yaw:0}];
  assert.ok(validateMission(obstructed).errors.some(e => e.includes('witness')));
});

test('validator returns errors rather than throwing for malformed collections and dependencies',()=>{
 const bad=structuredClone(getMission('mission-001'));bad.objectives[0].requires=5;assert.equal(validateMission(bad).valid,false);
 const badItem=structuredClone(getMission('mission-001'));badItem.geometry.push(null);assert.equal(validateMission(badItem).valid,false);
});
