import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { getOptionalMission } from '../src/content/optional-records.js';
import { getMission, listMissions, validateMission } from '../src/content/index.js';
import { createGame, stepGame } from '../src/campaign-simulation.js';
import { createWorld } from '../src/campaign-world.js';
import { DEFAULT_CONFIG, getTankTransform } from '../src/tank-controller.js';

const dt = 1 / 60;
const wrap = value => Math.atan2(Math.sin(value), Math.cos(value));
const clamp = value => Math.max(-1, Math.min(1, value));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function mission() {
  const spec = getOptionalMission('breach-cover');
  assert.ok(spec, 'breach-cover must resolve to its own optional MissionSpec');
  return spec;
}
function assertFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.ok(Object.isFrozen(value));
  for (const child of Object.values(value)) assertFrozen(child);
}

// Ordinary InputFrames adapted from the frozen corner-B probe. These helpers
// never assign pose, HP, objective status, entity life or world destruction.
function simulation(t) {
  const spec = mission(), world = createWorld(spec), events = [];
  t.after(() => world.dispose());
  let state = stepGame(createGame(spec), { start: true }, dt, world), distance = 0;
  return {
    world, events,
    get state() { return state; },
    get distance() { return distance; },
    step(input = {}) {
      const before = state.tank.pose;
      state = stepGame(state, { governor: 'cruise', ...input }, dt, world);
      distance += Math.hypot(state.tank.pose.x - before.x, state.tank.pose.z - before.z);
      events.push(...state.events);
      return state;
    }
  };
}
function wait(run, ticks, input = { brake: true }) {
  for (let tick = 0; tick < ticks && run.state.phase === 'playing'; tick++) run.step(input);
}
function drive(run, x, z) {
  for (let tick = 0; tick < 6000 && run.state.phase === 'playing'; tick++) {
    const { pose, vL, vR } = run.state.tank, distance = Math.hypot(x - pose.x, z - pose.z);
    if (distance < .45) { wait(run, 35); return; }
    const angle = wrap(Math.atan2(-(x - pose.x), -(z - pose.z)) - pose.yaw);
    const angularVelocity = (vR - vL) / DEFAULT_CONFIG.trackGauge;
    run.step({ throttle: Math.abs(angle) < .25 ? Math.min(1, distance / 2) : 0,
      steer: -clamp((1.1 * angle - angularVelocity) / .55) });
  }
  assert.equal(run.state.phase, 'won', `ordinary controls did not reach ${x},${z}`);
}
function fireAt(run, id, cap = 900) {
  const target = run.state.entities[id].pose, aim = { x: target.x, y: 1.1, z: target.z };
  for (let tick = 0; tick < cap && run.state.entities[id].alive && run.state.phase === 'playing'; tick++) {
    const muzzle = getTankTransform(run.state.tank);
    const delta = { x: aim.x - muzzle.position.x, y: aim.y - muzzle.position.y, z: aim.z - muzzle.position.z };
    const alignment = (muzzle.direction.x * delta.x + muzzle.direction.y * delta.y + muzzle.direction.z * delta.z) / Math.hypot(delta.x, delta.y, delta.z);
    run.step({ brake: true, aim: { worldPoint: aim }, firePressed: alignment > .998 });
  }
}
function movingBend(run) {
  // The accepted B warehouse puts the two-radius-4m S bend at z=-5.
  const points = [{ x: 0, z: 14.32 }, { x: 0, z: -5 }];
  for (let i = 1; i <= 32; i++) { const a = i / 32 * Math.PI / 2; points.push({ x: 4 - 4 * Math.cos(a), z: -5 - 4 * Math.sin(a) }); }
  for (let i = 1; i <= 32; i++) { const a = i / 32 * Math.PI / 2; points.push({ x: 4 + 4 * Math.sin(a), z: -13 + 4 * Math.cos(a) }); }
  points.push({ x: 8, z: -31 });
  for (let i = 1; i <= 32; i++) { const a = i / 32 * Math.PI / 2; points.push({ x: 4 + 4 * Math.cos(a), z: -31 - 4 * Math.sin(a) }); }
  for (let i = 1; i <= 32; i++) { const a = i / 32 * Math.PI / 2; points.push({ x: 4 - 4 * Math.sin(a), z: -39 + 4 * Math.cos(a) }); }
  points.push({ x: 0, z: -41 });
  let segment = 0;
  for (let tick = 0; tick < 7200 && run.state.phase === 'playing'; tick++) {
    const { pose, vL, vR } = run.state.tank;
    let best = Infinity, progress = segment;
    for (let i = segment; i < Math.min(points.length - 1, segment + 12); i++) {
      const a = points[i], b = points[i + 1], dx = b.x - a.x, dz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((pose.x - a.x) * dx + (pose.z - a.z) * dz) / (dx * dx + dz * dz)));
      const distance = Math.hypot(pose.x - a.x - dx * t, pose.z - a.z - dz * t);
      if (distance < best) { best = distance; progress = i; }
    }
    segment = progress;
    const a = points[segment], b = points[segment + 1], dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((pose.x - a.x) * dx + (pose.z - a.z) * dz) / (dx * dx + dz * dz)));
    let target = { x: a.x + dx * t, z: a.z + dz * t }, remaining = 2.5;
    for (let i = segment; i < points.length - 1; i++) {
      const next = points[i + 1], distance = Math.hypot(next.x - target.x, next.z - target.z);
      if (distance >= remaining) {
        target = { x: target.x + (next.x - target.x) * remaining / distance, z: target.z + (next.z - target.z) * remaining / distance };
        break;
      }
      remaining -= distance; target = next;
    }
    const angle = wrap(Math.atan2(-(target.x - pose.x), -(target.z - pose.z)) - pose.yaw);
    const angularVelocity = (vR - vL) / DEFAULT_CONFIG.trackGauge;
    run.step({ throttle: .85, steer: -clamp((1.1 * angle - .5 * angularVelocity) / .55) });
  }
}
const hostileShots = run => run.events.filter(e => e.type === 'shot' && e.entityId === 'gun');
const gunRay = run => run.world.raycast({ x: 10, y: 1.3, z: -8 },
  { x: run.state.tank.pose.x, y: .8, z: run.state.tank.pose.z }, ['gun', 'tank']);
const passage = run => run.world.isRouteClear({ points: [{ x: 0, z: 14 }, { x: 0, z: 0 }] },
  { width: 1.9, depth: 2.9, height: 1.5 }, ['tank', 'gun']);

test('breach-cover lookup is optional, immutable and isolated from ordinary mission lookup', () => {
  const spec = mission();
  assert.equal(spec.id, 'mission-9002'); assert.equal(spec.index, 9002); assert.equal(spec.optional, true);
  assert.equal(getOptionalMission('breach-cover'), spec);
  assert.equal(getMission(spec.id), undefined);
  for (const slug of ['missing', '__proto__', 'constructor', '', undefined, null, 9002]) assert.equal(getOptionalMission(slug), null);
  assertFrozen(spec);
  assert.throws(() => { spec.geometry[0].hp = 1; }, TypeError);
  assert.throws(() => { spec.witness.phases[0].tankWaypoints[0].x = 99; }, TypeError);
});

test('the accepted corner B has one actual warehouse and retains its unretuned wall, rubble and hostile', () => {
  const spec = mission();
  assert.deepEqual(spec.bounds, { minX: -36, maxX: 34, minZ: -48, maxZ: 34 });
  assert.deepEqual(spec.spawn, { x: 0, y: 0, z: 24, yaw: 0 });
  assert.deepEqual(spec.geometry, [
    { id: 'dual-wall', kind: 'box', x: 0, z: 6, yaw: 0, width: 10, depth: 1.2, height: 2.3, destructible: true, hp: 90 },
    { id: 'west-shoulder', kind: 'box', x: -11.5, z: 6, yaw: 0, width: 13, depth: 1.2, height: 3 },
    { id: 'east-shoulder', kind: 'box', x: 19.5, z: 6, yaw: 0, width: 29, depth: 1.2, height: 3 },
    { id: 'west-screen', kind: 'box', x: -8, z: -10, yaw: 0, width: 4, depth: 32, height: 3.2 },
    { id: 'warehouse', kind: 'box', x: 0, z: -20, yaw: 0, width: 8, depth: 12, height: 3.2 }
  ]);
  assert.deepEqual(spec.entities, [{ id: 'gun', kind: 'turret', pose: { x: 10, z: -8, yaw: Math.PI }, hp: 90, shieldArc: 2.5 }]);
  assert.deepEqual(spec.surfaces, [{ id: 'west-rubble', class: 'rubble', traction: .66, drag: 1.4,
    polygon: [{ x: -30, z: -20 }, { x: -20, z: -20 }, { x: -20, z: 20 }, { x: -30, z: 20 }] }]);
});

test('reach is the only objective: neither wall destruction nor gun elimination is compulsory', () => {
  const spec = mission();
  assert.deepEqual(spec.objectives, [{ id: 'escape', type: 'reach', targetIds: [], requires: [], nextIds: [], zoneId: 'exit' }]);
  assert.deepEqual(spec.routes, []); assert.ok(!spec.entities.some(e => e.kind === 'truck'));
  assert.equal(Object.hasOwn(spec, 'convoyChoice'), false);
  const state = stepGame(createGame(spec), { start: true });
  assert.equal(state.objectiveStates.escape.status, 'active');
  assert.equal(state.entities['dual-wall'].alive, true); assert.equal(state.entities.gun.alive, true);
});

test('the 303 ordinary specs and legacy warehouse fork retain their pre-change payloads', () => {
  mission();
  assert.equal(listMissions().length, 303);
  assert.equal(hash(listMissions()), '8f2bb9a3f4b780a3f3087a4b1c3a14882c607df5f3221e4c2cb9eb9c1d6030f2');
  assert.equal(hash(getOptionalMission('warehouse-fork')), '5de94f6faec665e88085c7ba7924bdae16d32a2eae4732bd5eba426b9d85f674');
});

test('the static witness validates the intact sheltered path without inventing a mandatory breach', () => {
  const spec = mission(), validation = validateMission(spec);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.equal(validation.audit.phaseWitnesses, 1); assert.equal(validation.audit.firingPoses, 0);
  assert.equal(validation.audit.convoyRoutes, 0);
  assert.ok(spec.witness.phases[0].tankWaypoints.some(p => p.x < -20));
});

test('retaining the wall physically blocks forward motion, not just objective completion', t => {
  const run = simulation(t); drive(run, 0, 14);
  wait(run, 900, { throttle: 1 });
  assert.equal(run.state.phase, 'playing'); assert.equal(run.state.entities['dual-wall'].alive, true);
  assert.ok(run.state.tank.pose.z > 6.6);
  assert.ok(run.state.tankFrame.contacts.includes('dual-wall'));
  assert.equal(run.state.tankCombat.shotsFired, 0); assert.equal(hostileShots(run).length, 0);
});

test('real two-shell demolition removes the same passage collider and gunfire cover at the same bay', t => {
  const intact = simulation(t), breached = simulation(t);
  drive(intact, 0, 14); drive(breached, 0, 14);
  assert.deepEqual(intact.state.tank.pose, breached.state.tank.pose);
  assert.equal(gunRay(intact)?.id, 'dual-wall'); assert.equal(passage(intact), false);
  fireAt(breached, 'dual-wall');
  assert.equal(breached.state.entities['dual-wall'].alive, false);
  assert.equal(breached.state.tankCombat.shotsFired, 2);
  assert.deepEqual(intact.state.tank.pose, breached.state.tank.pose);
  assert.equal(breached.events.filter(e => e.type === 'barrier-opened' && e.entityId === 'dual-wall').length, 1);
  assert.equal(gunRay(breached), null); assert.equal(passage(breached), true);
  wait(intact, 3000); wait(breached, 3000);
  assert.equal(intact.state.phase, 'playing'); assert.equal(intact.state.tankCombat.hp, 100);
  assert.equal(hostileShots(intact).length, 0);
  assert.equal(breached.state.phase, 'lost'); assert.equal(breached.state.tankCombat.hp, 0);
  assert.ok(hostileShots(breached).length > 0);
  assert.ok(breached.events.some(e => e.type === 'damaged' && e.targetId === 'tank' && e.entityId === 'gun' && e.value > 0));
  assert.equal(breached.state.entities.gun.alive, true);
});

test('ordinary inputs can cross the opened wall and reverse fully back to the firing bay', t => {
  const run = simulation(t); drive(run, 0, 14); fireAt(run, 'dual-wall'); drive(run, 0, 2);
  assert.ok(run.state.tank.pose.z < 5.4, 'tank actually crossed the former wall');
  for (let tick = 0; tick < 1200 && run.state.phase === 'playing' && run.state.tank.pose.z < 14; tick++) run.step({ throttle: -1 });
  wait(run, 35);
  assert.equal(run.state.phase, 'playing'); assert.ok(run.state.tank.pose.z >= 14);
  assert.equal(run.state.entities.gun.alive, true); assert.equal(run.state.entities['dual-wall'].alive, false);
});

test('both physical routes can win with the gun alive using only ordinary controls', t => {
  const short = simulation(t), sheltered = simulation(t);
  drive(short, 0, 14); fireAt(short, 'dual-wall'); movingBend(short);
  drive(sheltered, -20.5, 24); drive(sheltered, -20.5, -32); drive(sheltered, 0, -36);
  for (const run of [short, sheltered]) {
    assert.equal(run.state.phase, 'won'); assert.equal(run.state.objectiveStates.escape.status, 'complete');
    assert.equal(run.state.entities.gun.alive, true); assert.equal(run.state.entities.gun.hp, 90);
    assert.ok(run.state.tankCombat.hp > 0);
  }
  assert.equal(short.state.entities['dual-wall'].alive, false); assert.equal(short.state.tankCombat.shotsFired, 2);
  assert.ok(hostileShots(short).length > 0);
  assert.equal(sheltered.state.entities['dual-wall'].alive, true); assert.equal(sheltered.state.tankCombat.shotsFired, 0);
  assert.equal(hostileShots(sheltered).length, 0);
  assert.ok(sheltered.distance > short.distance); assert.ok(sheltered.state.elapsed > short.state.elapsed);
});
