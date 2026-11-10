import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, retry, stepGame } from '../src/campaign-simulation.js';
import { stepObjectives, stepTrucks } from '../src/mission-runtime.js';
import { createWorld } from '../src/campaign-world.js';
import { rectangle } from '../src/content/geometry.js';

const clone = value => JSON.parse(JSON.stringify(value));
function fixture() {
  return { schema: 1, id: 'mission-9001', spawn: { x: 0, y: 0, z: 26, yaw: 0 },
    bounds: { minX: -30, maxX: 30, minZ: -48, maxZ: 48 }, surfaces: [],
    geometry: [{ id: 'gate', kind: 'box', x: 0, z: 20, yaw: 0, width: 8, depth: 1.2, height: 2.3, destructible: true, hp: 90 }],
    zones: [{ id: 'straight', polygon: rectangle(0, 6, 5, 4) }, { id: 'left', polygon: rectangle(-12, 14, 5, 4) }, { id: 'depot', polygon: rectangle(0, -40, 16, 10) }],
    entities: ['lead', 'rear'].map((id, i) => ({ id, kind: 'truck', pose: { x: 0, z: 32 + i * 8, yaw: 0 }, hp: 180, routeId: `${id}-short`, activationObjectiveId: 'open-fork', escortRange: 36 })),
    routes: ['lead', 'rear'].flatMap((id, i) => ['short', 'covered'].map(branch => ({ id: `${id}-${branch}`, width: 8,
      points: [{ x: 0, z: 32 + i * 8 }, { x: 0, z: 14 }, ...(branch === 'covered' ? [{ x: -12, z: 14 }, { x: -18, z: -34 }] : []), { x: 0, z: -34 }, { x: i ? -4 : 4, z: -40 }] }))),
    objectives: [{ id: 'open-fork', type: 'breach', targetIds: ['gate'], requires: [] }, { id: 'deliver', type: 'escort', targetIds: ['lead', 'rear'], requires: ['open-fork'], zoneId: 'depot' }],
    convoyChoice: { requiresObjectiveId: 'open-fork', options: [
      { id: 'short', zoneId: 'straight', routeByTruck: { lead: 'lead-short', rear: 'rear-short' } },
      { id: 'covered', zoneId: 'left', routeByTruck: { lead: 'lead-covered', rear: 'rear-covered' } }
    ] }
  };
}
function playing(spec = fixture()) { return stepGame(createGame(spec), { start: true }); }
// Controlled unit fixtures test latch causality, not an input-driven playthrough.
function openGate(state, world) {
  state.entities.gate.alive = false; state.entities.gate.hp = 0;
  world.setDestroyed(['gate']); stepObjectives(state, 0);
}
const trucks = state => [state.entities.lead, state.entities.rear];
const physical = state => trucks(state).map(t => ({ pose: { ...t.pose }, hp: t.hp, alive: t.alive, arrived: t.arrived }));

test('choice holds trucks before breach even inside a mouth, then holds until a mouth is entered', () => {
  const s = playing(), world = createWorld(s.mission), before = physical(s);
  assert.equal(s.selectedConvoyChoiceId, null);
  s.tank.pose = { x: -12, y: 0, z: 14, yaw: 0 };
  for (let i = 0; i < 30; i++) stepTrucks(s, .1, world);
  assert.deepEqual(physical(s), before);
  assert.ok(trucks(s).every(t => t.stoppedReason === 'objective' && t.routeIndex === null));
  s.tank.pose = { x: 0, y: 0, z: 14, yaw: 0 }; openGate(s, world);
  for (let i = 0; i < 30; i++) stepTrucks(s, .1, world);
  assert.deepEqual(physical(s), before);
  assert.equal(s.selectedConvoyChoiceId, null);
  assert.ok(trucks(s).every(t => t.stoppedReason === 'route-choice' && t.speed === 0));
  world.dispose();
});

for (const [branch, x, z] of [['short', 0, 6], ['covered', -12, 14]]) test(`${branch} mouth changes both routes atomically once without physical state edits`, () => {
  const s = playing(), world = createWorld(s.mission); openGate(s, world);
  const before = physical(s); s.tank.pose = { x, y: 0, z, yaw: 0 };
  stepTrucks(s, .1, world);
  assert.equal(s.selectedConvoyChoiceId, branch); assert.deepEqual(physical(s), before);
  for (const t of trucks(s)) { assert.equal(t.routeId, `${t.id}-${branch}`); assert.equal(t.routeIndex, 0); assert.equal(t.speed, 0); }
  assert.equal(s.events.filter(e => e.type === 'convoy-route-selected').length, 1);
  assert.equal(s.events.find(e => e.type === 'convoy-route-selected').value, branch);
  s.tank.pose = { x: branch === 'short' ? -12 : 0, y: 0, z: branch === 'short' ? 14 : 6, yaw: 0 };
  for (let i = 0; i < 30; i++) stepTrucks(s, .1, world);
  assert.equal(s.selectedConvoyChoiceId, branch);
  assert.ok(trucks(s).every(t => t.routeId === `${t.id}-${branch}`));
  assert.ok(s.entities.lead.pose.z < before[0].pose.z, 'selected trucks retain ordinary physical movement');
  assert.equal(s.events.filter(e => e.type === 'convoy-route-selected').length, 1);
  world.dispose();
});

const malformed = [
  ['null choice', s => { s.convoyChoice = null; }],
  ['empty options', s => { s.convoyChoice.options = []; }],
  ['one option', s => { s.convoyChoice.options.pop(); }],
  ['missing prerequisite', s => { s.convoyChoice.requiresObjectiveId = 'missing'; }],
  ['duplicate choice ID', s => { s.convoyChoice.options[1].id = 'short'; }],
  ['missing zone', s => { s.convoyChoice.options[1].zoneId = 'missing'; }],
  ['invalid zone polygon', s => { s.zones[1].polygon = [{ x: -12, z: 14 }]; }],
  ['overlapping zones', s => { s.zones[1].polygon = rectangle(3, 6, 5, 4); }],
  ['touching zones', s => { s.zones[1].polygon = rectangle(5, 6, 5, 4); }],
  ['crossing polygon edges', s => { s.zones[0].polygon = rectangle(0, 6, 10, 2); s.zones[1].polygon = rectangle(0, 6, 2, 10); }],
  ['missing route', s => { s.convoyChoice.options[1].routeByTruck.rear = 'missing'; }],
  ['missing mapped truck', s => { delete s.convoyChoice.options[1].routeByTruck.rear; }],
  ['unknown mapped truck', s => { s.convoyChoice.options[1].routeByTruck.ghost = 'rear-covered'; }],
  ['null route map', s => { s.convoyChoice.options[1].routeByTruck = null; }],
  ['nonfinite route point', s => { s.routes[3].points[1].x = NaN; }],
  ['route does not start at truck', s => { s.routes[3].points[0].z = 5; }],
  ['duplicate route ID', s => { s.routes[3].id = 'rear-short'; }],
];
for (const [name, mutate] of malformed) test(`malformed ${name} fails closed, including faults in the other branch`, () => {
  const spec = fixture(); mutate(spec); const s = playing(spec), world = createWorld(s.mission);
  openGate(s, world); s.tank.pose = { x: 0, y: 0, z: 6, yaw: 0 }; const before = physical(s);
  for (let i = 0; i < 30; i++) stepTrucks(s, .1, world);
  assert.equal(s.selectedConvoyChoiceId, null); assert.deepEqual(physical(s), before);
  assert.ok(trucks(s).every(t => t.stoppedReason === 'route-choice' && t.speed === 0));
  assert.equal(s.events.filter(e => e.type === 'convoy-route-selected').length, 0);
  world.dispose();
});

test('JSON roundtrip preserves selected routes and retry resets only optional state', () => {
  const spec = fixture(), s = playing(spec), world = createWorld(spec); openGate(s, world);
  s.tank.pose = { x: -12, y: 0, z: 14, yaw: 0 }; stepTrucks(s, .1, world);
  const restored = clone(s); assert.deepEqual(restored, s);
  restored.tank.pose = { x: 0, y: 0, z: 6, yaw: 0 }; stepTrucks(restored, .1, world);
  assert.equal(restored.selectedConvoyChoiceId, 'covered');
  assert.ok(trucks(restored).every(t => t.routeId.endsWith('-covered')));
  const fresh = retry(spec); assert.equal(fresh.selectedConvoyChoiceId, null); assert.equal(fresh.entities.gate.alive, true);
  assert.ok(trucks(fresh).every(t => t.routeIndex === null && !t.arrived && t.hp === 180 && t.routeId.endsWith('-short')));
  assert.deepEqual([fresh.entities.lead.pose.z, fresh.entities.rear.pose.z], [32, 40]);
  world.dispose();
});

test('ordinary missions do not gain choice state or wait for a choice', () => {
  const spec = fixture(); delete spec.convoyChoice;
  const s = playing(spec), world = createWorld(spec); openGate(s, world);
  assert.equal(Object.hasOwn(s, 'selectedConvoyChoiceId'), false);
  for (let i = 0; i < 30; i++) stepTrucks(s, .1, world);
  assert.ok(s.entities.lead.pose.z < 32); assert.equal(Object.hasOwn(clone(s), 'selectedConvoyChoiceId'), false);
  assert.equal(Object.hasOwn(retry(spec), 'selectedConvoyChoiceId'), false);
  world.dispose();
});

async function optionalRecord() {
  const module = await import('../src/content/optional-records.js').catch(() => null);
  assert.equal(typeof module?.getOptionalMission, 'function', 'the isolated optional record provider must exist');
  return module;
}

test('optional provider is immutable, unknown slugs return null, and registry remains separate', async () => {
  const { getOptionalMission } = await optionalRecord();
  const { listMissions } = await import('../src/content/index.js');
  const spec = getOptionalMission('warehouse-fork');
  assert.equal(spec.id, 'mission-9001');
  assert.equal(getOptionalMission('missing'), null); assert.equal(getOptionalMission('__proto__'), null);
  assert.equal(getOptionalMission(undefined), null);
  assert.equal(listMissions().length, 303); assert.ok(!listMissions().some(m => m.id === spec.id));
  assert.throws(() => { spec.convoyChoice.options[0].routeByTruck.lead = 'bad'; }, TypeError);
  assert.throws(() => { spec.routes[0].points[0].x = 100; }, TypeError);
  assert.equal(createGame(spec).entities.lead.pose.x, 0);
});

for (const branch of ['short', 'covered']) test(`optional ${branch} projection validates every full-envelope route, spawn, parking bay and phase witness`, async () => {
  const { getOptionalMission } = await optionalRecord();
  const { validateMission } = await import('../src/content/validate.js');
  const spec = clone(getOptionalMission('warehouse-fork'));
  const option = spec.convoyChoice.options.find(o => o.id === branch);
  assert.ok(option); assert.equal(Object.keys(option.routeByTruck).length, 2);
  for (const truck of spec.entities.filter(e => e.kind === 'truck')) truck.routeId = option.routeByTruck[truck.id];
  spec.witness = spec.convoyChoiceWitnesses[branch];
  const validation = validateMission(spec);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.equal(validation.audit.convoyRoutes, 2); assert.equal(validation.audit.phaseWitnesses, 3);
  const world = createWorld(spec); world.setDestroyed(['fork-gate']);
  world.setEntities(spec.entities.filter(e => e.kind !== 'truck'));
  const ends = [];
  for (const truck of spec.entities.filter(e => e.kind === 'truck')) {
    const route = spec.routes.find(r => r.id === truck.routeId);
    assert.deepEqual(route.points[0], { x: truck.pose.x, z: truck.pose.z });
    assert.equal(world.isRouteClear(route, { width: 2.2, depth: 4, height: 2.2 }), true, route.id);
    assert.equal(world.isRouteClear({ points: [{ ...route.points[0], yaw: truck.pose.yaw }, { ...route.points[0], yaw: truck.pose.yaw }] }, { width: 2.2, depth: 4, height: 2.2 }), true, `${route.id} start`);
    ends.push(route.points.at(-1));
  }
  assert.deepEqual(ends, [{ x: 4, z: -40 }, { x: -4, z: -40 }]);
  world.dispose();
});

test('optional warehouse blocks the covered lane gun ray but not the short street, and covered routes are at least 30% longer', async () => {
  const { getOptionalMission } = await optionalRecord(), spec = getOptionalMission('warehouse-fork'), world = createWorld(spec);
  const gun = spec.entities.find(e => e.kind === 'turret');
  const origin = { x: gun.pose.x, y: 1.3, z: gun.pose.z };
  assert.equal(world.raycast(origin, { x: -18, y: 1, z: -8 })?.id, 'warehouse-screen');
  assert.equal(world.raycast(origin, { x: 0, y: 1, z: -8 }), null);
  assert.ok(Math.hypot(origin.x + 18, origin.z + 8) < gun.range, 'screen, not range, provides protection');
  const length = route => route.points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - route.points[i].x, p.z - route.points[i].z), 0);
  for (const id of ['lead', 'rear']) assert.ok(length(spec.routes.find(r => r.id === `${id}-covered`)) / length(spec.routes.find(r => r.id === `${id}-short`)) >= 1.3);
  world.dispose();
});

test('stepGame commits a choice on its next draft, leaving the input state untouched', () => {
  const s = playing(), world = createWorld(s.mission); openGate(s, world);
  s.tank.pose = { x: -12, y: 0, z: 14, yaw: 0 };
  const snapshot = clone(s), next = stepGame(s, {}, 1 / 60, world);
  assert.deepEqual(s, snapshot);
  assert.equal(next.selectedConvoyChoiceId, 'covered');
  assert.deepEqual(physical(next), physical(s));
  assert.equal(next.entities.lead.routeIndex, 0); assert.equal(next.entities.rear.routeIndex, 0);
  assert.equal(next.events.filter(e => e.type === 'convoy-route-selected').length, 1);
  const restoredWorld = createWorld(next.mission), restored = clone(next);
  assert.deepEqual(stepGame(restored, {}, 1 / 60, restoredWorld), stepGame(next, {}, 1 / 60, world));
  world.dispose(); restoredWorld.dispose();
});
