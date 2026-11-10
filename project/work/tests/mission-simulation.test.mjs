import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, retry } from '../src/campaign-simulation.js';
import { createWorld } from '../src/campaign-world.js';
import { getMission } from '../src/content/index.js';
const dt = 1 / 60;
const empty = { schema: 1, id: 'test', seed: 7, spawn: { x: 0, y: 0, z: 10, yaw: 0 }, geometry: [], entities: [], routes: [], zones: [], objectives: [] };

test('briefing, start, pause and resume never advance motion or tick themselves', () => {
  const world = createWorld(empty); let s = createGame(empty); assert.ok(s);
  assert.equal(s.phase, 'briefing'); assert.equal(s.tick, 0);
  assert.deepEqual(stepGame(s, { throttle: 1 }, dt, world), s);
  s = stepGame(s, { start: true, throttle: 1 }, dt, world);
  assert.equal(s.phase, 'playing'); assert.equal(s.tick, 0);
  s = stepGame(s, { throttle: 1 }, dt, world); assert.equal(s.tick, 1); assert.ok(s.tank.pose.z < 10);
  const before = s.tank;
  s = stepGame(s, { pause: true, throttle: 1 }, dt, world); assert.equal(s.tick, 1); assert.deepEqual(s.tank, before);
  s = stepGame(s, { throttle: 1, firePressed: true }, dt, world); assert.equal(s.tick, 1); assert.equal(s.projectiles.length, 0);
  s = stepGame(s, { resume: true }, dt, world); assert.equal(s.phase, 'playing'); assert.equal(s.tick, 1);
  world.dispose();
});

test('playing steps are immutable, serializable, store real TankFrame and gate cosmetic recoil with reload', () => {
  const world = createWorld(empty); let s = stepGame(createGame(empty), { start: true }, dt, world);
  const previous = JSON.stringify(s);
  let next = stepGame(s, { firePressed: true }, dt, world);
  assert.equal(JSON.stringify(s), previous); assert.ok(next.tankFrame.muzzleWorld);
  assert.equal(next.tankCombat.shotsFired, 1); assert.equal(next.events.filter(e => e.type === 'shot').length, 1);
  for (let i = 0; i < 30; i++) next = stepGame(next, { firePressed: true }, dt, world);
  assert.equal(next.tankCombat.shotsFired, 1); assert.ok(next.tank.turret.recoil < .01);
  assert.deepEqual(JSON.parse(JSON.stringify(next)), next);
  assert.equal(next.events.filter(e => e.type === 'shot').length, 0);
  world.dispose();
});

test('real controller and world allow cannon fire to destroy freight gate and retry restores all state', () => {
  const spec = getMission('mission-001'), world = createWorld(spec);
  let s = stepGame(createGame(spec), { start: true }, dt, world);
  for (let i = 0; i < 200; i++) s = stepGame(s, { firePressed: i === 0 || i === 60, aim: { worldPoint: { x: 0, y: 1, z: 0 } } }, dt, world);
  assert.equal(s.entities['freight-gate'].alive, false);
  assert.equal(s.objectiveStates['open-freight-gate'].status, 'complete');
  assert.ok(s.entities['freight-truck'].pose.z < 34);
  assert.equal(world.raycast({ x: 0, y: 1, z: 2 }, { x: 0, y: 1, z: -2 }), null);
  s = retry(spec); s = stepGame(s, { start: true }, dt, world); s = stepGame(s, {}, dt, world);
  assert.equal(s.entities['freight-gate'].hp, 90); assert.equal(s.tankCombat.hp, 100); assert.equal(s.projectiles.length, 0);
  assert.equal(s.entities['freight-truck'].pose.z, 34);
  assert.equal(world.raycast({ x: 0, y: 1, z: 2 }, { x: 0, y: 1, z: -2 }).id, 'freight-gate');
  world.dispose();
});

test('serialization restores deterministic combat and identical fixed-tick results across render batching', () => {
  const makeWorld = () => createWorld(empty);
  const replay = batches => {
    const world = makeWorld(); let state = stepGame(createGame(empty), { start: true }, dt, world), tick = 0;
    for (const batch of batches) for (let j = 0; j < batch; j++, tick++) state = stepGame(state, { throttle: tick < 70 ? .8 : 0, steer: tick < 35 ? .3 : -.2, firePressed: tick % 55 === 0, aim: { worldPoint: { x: -5, y: 1, z: -30 } } }, dt, world);
    world.dispose(); return state;
  };
  assert.deepEqual(replay(Array(60).fill(2)), replay(Array(120).fill(1)));
  let a = replay([60]), b = JSON.parse(JSON.stringify(a));
  const wa = makeWorld(), wb = makeWorld();
  for (let i = 0; i < 60; i++) { a = stepGame(a, { firePressed: true, throttle: -.3 }, dt, wa); b = stepGame(b, { firePressed: true, throttle: -.3 }, dt, wb); }
  assert.deepEqual(a, b); wa.dispose(); wb.dispose();
});
