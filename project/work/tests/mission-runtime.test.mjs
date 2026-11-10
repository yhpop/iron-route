import test from 'node:test';
import assert from 'node:assert/strict';
import { createObjectiveStates, stepObjectives, stepTrucks } from '../src/mission-runtime.js';
import { initializeEntities } from '../src/combat.js';

const zone = { id: 'exit', polygon: [{ x: -3, z: -3 }, { x: 3, z: -3 }, { x: 3, z: 3 }, { x: -3, z: 3 }] };
function state(mission) { return { schema: 1, missionId: 'test', tick: 1, elapsed: 0, phase: 'playing', mission, tank: { pose: { x: 0, y: 0, z: 0, yaw: 0 } }, tankCombat: { hp: 100, maxHp: 100, damageTaken: 0 }, entities: initializeEntities(mission), objectiveStates: createObjectiveStates(mission), events: [], nextEventId: 1, result: null }; }
const clear = { isRouteClear: () => true, raycast: () => null };

test('objective dependencies prevent exit success until a physical barrier opens', () => {
  const s = state({ zones: [zone], geometry: [{ id: 'gate', kind: 'box', x: 5, z: 0, width: 3, depth: 1, height: 2, hp: 45, destructible: true }], objectives: [{ id: 'breach', type: 'breach', targetIds: ['gate'], requires: [] }, { id: 'exit-goal', type: 'reach', targetIds: [], zoneId: 'exit', requires: ['breach'] }] });
  assert.ok(s.objectiveStates);
  stepObjectives(s, 1 / 60);
  assert.equal(s.objectiveStates['exit-goal'].status, 'locked');
  assert.equal(s.phase, 'playing');
  s.entities.gate.alive = false; s.entities.gate.hp = 0;
  stepObjectives(s, 1 / 60);
  assert.equal(s.phase, 'won');
  assert.equal(s.result.outcome, 'won');
  assert.ok(s.events.some(e => e.type === 'mission-ended'));
});

test('escort finishes only when every living target truck has physically reached its final waypoint', () => {
  const s = state({ zones: [zone], routes: [{ id: 'road-a', width: 8, points: [{ x: -2, z: -10 }, { x: -2, z: 0 }] }, { id: 'road-b', width: 8, points: [{ x: 2, z: -17 }, { x: 2, z: 0 }] }], entities: [{ id: 'a', kind: 'truck', pose: { x: -2, z: -10, yaw: Math.PI }, routeId: 'road-a', hp: 70 }, { id: 'b', kind: 'truck', pose: { x: 2, z: -17, yaw: Math.PI }, routeId: 'road-b', hp: 70 }], objectives: [{ id: 'convoy', type: 'escort', targetIds: ['a', 'b'], requires: [], zoneId: 'exit' }] });
  s.tank.pose.x = 10;
  stepObjectives(s, 1 / 60); assert.equal(s.phase, 'playing');
  for (let i = 0; i < 2000 && s.phase === 'playing'; i++) { stepTrucks(s, 1 / 60, clear); stepObjectives(s, 1 / 60); }
  assert.equal(s.phase, 'won');
  assert.ok(s.entities.a.arrived && s.entities.b.arrived);
  assert.ok(s.entities.a.pose.z > -2.5 && s.entities.b.pose.z > -2.5);
});

test('trucks pause at obstacles, maintain spacing and do not weld their transforms to tank', () => {
  const s = state({ routes: [{ id: 'road', points: [{ x: 0, z: 0 }, { x: 0, z: -30 }], width: 7 }], entities: [{ id: 'a', kind: 'truck', pose: { x: 0, z: -8, yaw: 0 }, routeId: 'road' }, { id: 'b', kind: 'truck', pose: { x: 0, z: 0, yaw: 0 }, routeId: 'road' }], objectives: [] });
  s.tank.pose = { x: 7, y: 0, z: -10, yaw: 0 };
  const before = JSON.stringify(s.entities);
  stepTrucks(s, .1, { ...clear, isRouteClear: () => false });
  assert.equal(s.entities.a.pose.z, -8); assert.equal(s.entities.a.stoppedReason, 'obstacle');
  for (let i = 0; i < 50; i++) stepTrucks(s, .1, clear);
  assert.ok(s.entities.a.pose.z < -8);
  assert.ok(s.entities.b.pose.z - s.entities.a.pose.z >= 6);
  assert.equal(s.entities.a.pose.x, 0);
  assert.notEqual(JSON.stringify(s.entities), before);
});

test('defend needs continuous zone presence and living protected targets; protected loss names cause', () => {
  const s = state({ zones: [zone], entities: [{ id: 'supply', kind: 'truck', pose: { x: 0, z: 1, yaw: 0 }, hp: 70 }], objectives: [{ id: 'hold', type: 'defend', targetIds: ['supply'], requires: [], zoneId: 'exit', duration: 2 }] });
  stepObjectives(s, 1); assert.equal(s.objectiveStates.hold.progress, .5);
  s.tank.pose.x = 10; stepObjectives(s, 1); assert.equal(s.objectiveStates.hold.progress, 0);
  s.entities.supply.hp = 0; s.entities.supply.alive = false;
  stepObjectives(s, 1);
  assert.equal(s.phase, 'lost'); assert.equal(s.result.cause, 'protected-vehicle-destroyed'); assert.equal(s.result.entityId, 'supply');
});

test('disable graph with two targets cannot complete after only one is destroyed', () => {
  const s = state({ entities: ['a', 'b'].map(id => ({ id, kind: 'turret', pose: { x: 10, z: 10, yaw: 0 }, hp: 90 })), objectives: [{ id: 'disable', type: 'disable', targetIds: ['a', 'b'], requires: [] }] });
  s.entities.a.alive = false; s.entities.a.hp = 0;
  stepObjectives(s, 1 / 60); assert.equal(s.phase, 'playing');
  s.entities.b.alive = false; s.entities.b.hp = 0;
  stepObjectives(s, 1 / 60); assert.equal(s.phase, 'won');
});

test('defend completion is order-independent and cannot double-count time while unlocking a dependency', () => {
  const s = state({ zones: [zone], geometry: [{ id: 'gate', kind: 'box', x: 10, z: 0, width: 3, depth: 1, height: 2, hp: 45, destructible: true }], objectives: [
    { id: 'hold', type: 'defend', targetIds: [], zoneId: 'exit', duration: 1, requires: ['breach'] },
    { id: 'breach', type: 'breach', targetIds: ['gate'], requires: [] }
  ] });
  s.entities.gate.alive = false; s.entities.gate.hp = 0;
  stepObjectives(s, .25);
  assert.equal(s.objectiveStates.hold.elapsed, .25); assert.equal(s.phase, 'playing');
  for (let i = 0; i < 3; i++) stepObjectives(s, .25);
  assert.equal(s.phase, 'won');
});

test('real third-mission routes deliver two separately parked trucks without mutual clipping', async () => {
  const { createWorld } = await import('../src/campaign-world.js');
  const { getMission } = await import('../src/content/index.js');
  const { syncWorldEntities } = await import('../src/combat.js');
  const spec = getMission('mission-003'), s = state(spec), world = createWorld(spec);
  for (const e of Object.values(s.entities)) if (e.kind === 'turret') { e.alive = false; e.hp = 0; }
  let minimumDistance = Infinity;
  for (let tick = 0; tick < 10000; tick++) {
    const trucks = Object.values(s.entities).filter(e => e.kind === 'truck');
    const moving = trucks.find(e => !e.arrived); if (!moving) break;
    // Isolate convoy routing: the lead tank stays nearby off the road, never dragging the trucks.
    s.tank.pose = { x: moving.pose.x + 8, y: 0, z: moving.pose.z - 4, yaw: 0 };
    syncWorldEntities(s, world); stepTrucks(s, 1 / 60, world);
    minimumDistance = Math.min(minimumDistance, Math.hypot(trucks[0].pose.x - trucks[1].pose.x, trucks[0].pose.z - trucks[1].pose.z));
  }
  assert.ok(s.entities['lead-supply'].arrived, JSON.stringify(s.entities['lead-supply']));
  assert.ok(s.entities['rear-supply'].arrived, JSON.stringify(s.entities['rear-supply']));
  assert.ok(minimumDistance >= 3.6);
  assert.equal(s.entities['lead-supply'].pose.x, 4); assert.equal(s.entities['rear-supply'].pose.x, -4);
  stepObjectives(s, 1 / 60); assert.equal(s.objectiveStates['deliver-both-trucks'].status, 'complete');
  world.dispose();
});

test('supply truck stops at the actual sideways tank barrel and resumes only after the gun clears', async () => {
  const { createWorld } = await import('../src/campaign-world.js');
  const { createTank } = await import('../src/tank-controller.js');
  const { syncWorldEntities } = await import('../src/combat.js');
  const mission = { geometry: [], routes: [{ id: 'crossing', width: 7, points: [{ x: 0, z: 8 }, { x: 0, z: -8 }] }], entities: [{ id: 'supply', kind: 'truck', pose: { x: 0, z: 8, yaw: 0 }, routeId: 'crossing', hp: 70 }], objectives: [] };
  const s = state(mission), world = createWorld(mission);
  s.tank = createTank({ x: 3, y: 0, z: 0, yaw: Math.PI / 2 });
  for (let tick = 0; tick < 900; tick++) { syncWorldEntities(s, world); stepTrucks(s, 1 / 60, world); }
  assert.ok(s.entities.supply.pose.z > 1.5, `truck crossed a barrel at z=0: ${s.entities.supply.pose.z}`);
  assert.equal(s.entities.supply.arrived, false);
  assert.equal(s.entities.supply.stoppedReason, 'obstacle');
  s.tank.turret.yawRel = Math.PI / 2;
  for (let tick = 0; tick < 900 && !s.entities.supply.arrived; tick++) { syncWorldEntities(s, world); stepTrucks(s, 1 / 60, world); }
  assert.equal(s.entities.supply.arrived, true);
  assert.equal(s.entities.supply.pose.z, -8);
  world.dispose();
});

test('escort distance wait is explicit and resumes immediately, while freight can opt out with a larger range', () => {
  const mission = { routes: [{ id: 'road', points: [{ x: 0, z: 0 }, { x: 0, z: -30 }], width: 7 }], entities: [{ id: 'a', kind: 'truck', pose: { x: 0, z: 0, yaw: 0 }, routeId: 'road' }], objectives: [] };
  const s = state(mission); s.tank.pose = { x: 8, y: 0, z: -25, yaw: 0 };
  stepTrucks(s, .1, clear);
  assert.equal(s.entities.a.stoppedReason, 'tank-away'); assert.equal(s.entities.a.pose.z, 0);
  s.tank.pose.z = -10;
  stepTrucks(s, .1, clear);
  assert.equal(s.entities.a.status, 'moving'); assert.ok(s.entities.a.pose.z < 0);
  s.tank.pose.z = -25; s.entities.a.escortRange = 100;
  stepTrucks(s, .1, clear);
  assert.equal(s.entities.a.status, 'moving'); assert.equal(s.entities.a.stoppedReason, null);
});
