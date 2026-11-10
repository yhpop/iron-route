import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDOM, byControl } from './input-dom.mjs';
import { createInput } from '../src/campaign-input.js';
import { createTank, stepTank, wrapAngle } from '../src/tank-controller.js';

function setup(options = {}) {
  const dom = makeDOM();
  const input = createInput(dom.canvas, { ...dom, ...options });
  return { ...dom, input, aim: byControl(dom.mount, 'aim') };
}
function pointer(element, type, id = 1, x = 60, y = 0, more = {}) {
  element.dispatch(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, button: 0, ...more });
}
function near(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} vs ${expected}`);
}

// Removing sample-time projection must break this: no new pointer event accompanies camera motion.
test('stationary held aim follows current camera translation and current canvas bounds', t => {
  let base = { x: 0, z: 0 };
  const calls = [];
  const { input, canvas, aim } = setup({ projectAim: (x, y) => {
    calls.push({ x, y });
    return { x: base.x + x, y: 0.7, z: base.z + y };
  } });
  t.after(() => input.dispose());
  pointer(aim, 'pointerdown');
  assert.deepEqual(calls, [{ x: 512, y: 30.71999999999997 }], 'pointerdown projects immediately');
  const first = input.sample();
  base = { x: 20, z: -40 };
  const moved = input.sample();
  near(moved.aim.worldPoint.x, first.aim.worldPoint.x + 20, 'camera x translation');
  near(moved.aim.worldPoint.z, first.aim.worldPoint.z - 40, 'camera z translation');
  canvas.rect = { left: 100, top: 200, width: 800, height: 600 };
  const resized = input.sample();
  assert.deepEqual(calls.at(-1), { x: 500, y: 224 });
  assert.deepEqual(resized.aim, { worldPoint: { x: 520, y: 0.7, z: 184 } });
  assert.equal(calls.length, 4, 'one projection on down and each of three samples');
  assert.equal(resized.firePressed, false, 'reprojection never queues a shot');
});

// Response-scaled storage would shrink partial-stick projections and changing aim-pad bounds
// must not reinterpret the stationary finger; only the current canvas projection changes.
test('held partial aim stores raw vector independently of response and later aim-pad bounds', t => {
  const { input, canvas, aim } = setup({ projectAim: (x, y) => ({ x, y: 1, z: y }) });
  t.after(() => input.dispose());
  pointer(aim, 'pointerdown', 1, 90, 60); // Raw x = 0.5; response is much smaller.
  near(input.sample().aim.worldPoint.x, 688.64, 'original partial projection');
  aim.rect = { left: 200, top: 300, width: 240, height: 240 };
  canvas.rect = { left: 10, top: 20, width: 600, height: 400 };
  assert.deepEqual(input.sample().aim, { worldPoint: { x: 402, y: 1, z: 220 } });
});

test('held out-of-radius diagonal uses the radial-clamped raw direction', t => {
  const { input, canvas, aim } = setup({ projectAim: (x, y) => ({ x, y: 1, z: y }) });
  t.after(() => input.dispose());
  pointer(aim, 'pointerdown', 1, 180, -60); // (2,-2) clamps to (1/sqrt(2),-1/sqrt(2)).
  canvas.rect = { left: 0, top: 0, width: 400, height: 400 };
  const target = input.sample().aim.worldPoint;
  near(target.x, 330.1076477383248, 'clamped diagonal x');
  near(target.z, 69.89235226167525, 'clamped diagonal z');
});

test('held fallback aim reads current tank pose without a new pointer event', t => {
  let pose = { x: 4, y: 2, z: 10 };
  let reads = 0;
  const { input, aim } = setup({ getTankPose: () => { reads++; return pose; } });
  t.after(() => input.dispose());
  pointer(aim, 'pointerdown', 1, 90, 30); // Raw vector (0.5,-0.5).
  assert.deepEqual(input.sample().aim, { worldPoint: { x: 20, y: 2.7, z: -6 } });
  pose = { x: -5, y: 3, z: -20 };
  assert.deepEqual(input.sample().aim, { worldPoint: { x: 11, y: 3.7, z: -36 } });
  assert.equal(reads, 3);
});

test('failed held projection retains last valid target and recovers without pointer motion', t => {
  let result;
  const { input, aim } = setup({ projectAim: () => result });
  t.after(() => input.dispose());
  pointer(aim, 'pointerdown');
  assert.equal(input.sample().aim, undefined, 'no fabricated origin target when projection is unavailable');
  result = { x: 8, y: 0.7, z: -20 };
  assert.deepEqual(input.sample().aim, { worldPoint: { x: 8, y: 0.7, z: -20 } });
  for (const invalid of [null, undefined, {}, { x: NaN, y: 0.7, z: -30 }, { x: 1, y: Infinity, z: -30 }, { x: 1, y: 0.7, z: -Infinity }]) {
    result = invalid;
    assert.deepEqual(input.sample().aim, { worldPoint: { x: 8, y: 0.7, z: -20 } });
  }
  result = { x: 9, y: 1, z: -50 };
  assert.deepEqual(input.sample().aim, { worldPoint: { x: 9, y: 1, z: -50 } });
});

test('unavailable or invalid current fallback pose retains target and recovers while held', t => {
  let pose;
  const { input, aim } = setup({ getTankPose: () => pose });
  t.after(() => input.dispose());
  pointer(aim, 'pointerdown');
  assert.equal(input.sample().aim, undefined);
  pose = { x: 2, z: 3 };
  assert.deepEqual(input.sample().aim, { worldPoint: { x: 2, y: 0.7, z: -29 } });
  for (const invalid of [null, { x: NaN, z: 0 }, { x: 1, y: Infinity, z: 0 }, { x: 1, z: Infinity }]) {
    pose = invalid;
    assert.deepEqual(input.sample().aim, { worldPoint: { x: 2, y: 0.7, z: -29 } });
  }
  pose = { x: -4, y: 5, z: 12 };
  assert.deepEqual(input.sample().aim, { worldPoint: { x: -4, y: 5.7, z: -20 } });
});

test('neutral aim never projects, neutralization stops updates, and renewed motion resumes', t => {
  let offset = 0, calls = 0;
  const { input, aim } = setup({ projectAim: () => ({ x: ++calls, y: 1, z: offset }) });
  t.after(() => input.dispose());
  pointer(aim, 'pointerdown', 1, 60, 60);
  assert.equal(input.sample().aim, undefined);
  pointer(aim, 'pointermove', 1, 66, 60); // Inside the existing radial deadzone.
  assert.equal(input.sample().aim, undefined);
  assert.equal(calls, 0);
  pointer(aim, 'pointermove', 1, 90, 60);
  const active = input.sample();
  assert.equal(active.aim.worldPoint.x, 2);
  pointer(aim, 'pointermove', 1, 60, 60);
  offset = 100;
  assert.deepEqual(input.sample().aim, active.aim);
  assert.equal(calls, 2, 'centered held pointer does not project');
  pointer(aim, 'pointermove', 1, 60, 0);
  assert.deepEqual(input.sample().aim, { worldPoint: { x: 4, y: 1, z: 100 } });
});

test('quick aim tap retains immediate event projection after release before any sample', t => {
  let calls = 0;
  const { input, aim } = setup({ projectAim: () => ({ x: ++calls, y: 1, z: -30 }) });
  t.after(() => input.dispose());
  pointer(aim, 'pointerdown');
  pointer(aim, 'pointerup');
  assert.deepEqual(input.sample().aim, { worldPoint: { x: 1, y: 1, z: -30 } });
  assert.equal(calls, 1);
});

test('drive, fire and aim pointer ownership stay independent during continuous projection', t => {
  let offset = 0;
  const { input, mount, aim } = setup({ projectAim: () => ({ x: offset, y: 1, z: -30 }) });
  t.after(() => input.dispose());
  const drive = byControl(mount, 'drive'), fire = byControl(mount, 'fire');
  pointer(drive, 'pointerdown', 1);
  pointer(aim, 'pointerdown', 2);
  pointer(fire, 'pointerdown', 3, 0, 0);
  const first = input.sample();
  assert.equal(first.throttle, 1); assert.equal(first.firePressed, true);
  pointer(aim, 'pointermove', 99, 60, 120); // Not the owned pointer.
  pointer(aim, 'pointerdown', 4, 60, 120); // Cannot steal an occupied stick.
  pointer(aim, 'pointerup', 4); // Nor release its owner.
  pointer(fire, 'pointerup', 3, 0, 0);
  pointer(fire, 'lostpointercapture', 3, 0, 0); // Expected capture release is not a reset.
  offset = 10;
  const held = input.sample();
  assert.equal(held.throttle, 1); assert.equal(held.firePressed, false);
  assert.deepEqual(held.aim, { worldPoint: { x: 10, y: 1, z: -30 } });
  pointer(drive, 'pointerup', 1);
  offset = 20;
  assert.equal(input.sample().throttle, 0);
  assert.deepEqual(input.sample().aim, { worldPoint: { x: 20, y: 1, z: -30 } });
  pointer(aim, 'pointerup', 2);
  offset = 30;
  assert.deepEqual(input.sample().aim, { worldPoint: { x: 20, y: 1, z: -30 } });
  assert.equal(input.sample().firePressed, false);
});

const stopCases = [
  ['element pointerup', ({ aim }) => pointer(aim, 'pointerup'), false],
  ['window pointerup', ({ window }) => pointer(window, 'pointerup'), false],
  ['element pointercancel', ({ aim }) => pointer(aim, 'pointercancel'), true],
  ['window pointercancel', ({ window }) => pointer(window, 'pointercancel'), true],
  ['lost pointer capture', ({ aim }) => pointer(aim, 'lostpointercapture'), true],
  ['window blur', ({ window }) => window.dispatch('blur'), true],
  ['document hidden', ({ document }) => { document.hidden = true; document.dispatch('visibilitychange'); }, true],
  ['visibility state hidden', ({ document }) => { document.visibilityState = 'hidden'; document.dispatch('visibilitychange'); }, true],
  ['explicit reset', ({ input }) => input.reset(), true],
  ['disable and resume', ({ input }) => { input.setEnabled(false); assert.equal(input.sample().paused, true); input.setEnabled(true); }, true],
  ['dispose', ({ input }) => input.dispose(), true],
];
for (const [name, stop, clearsAll] of stopCases) {
  test(`${name} stops held reprojection and retains last valid world target`, t => {
    let offset = 0, calls = 0;
    const env = setup({ projectAim: () => { calls++; return { x: offset, y: 1, z: -30 }; } });
    const { input, aim, mount } = env;
    t.after(() => input.dispose());
    pointer(aim, 'pointerdown');
    const active = input.sample();
    assert.equal(calls, 2, 'fixture was actively reprojecting before stopping');
    const drive = byControl(mount, 'drive'), fire = byControl(mount, 'fire');
    pointer(drive, 'pointerdown', 2);
    pointer(fire, 'pointerdown', 3, 0, 0);
    stop(env);
    offset = 50;
    const after = input.sample();
    assert.deepEqual(after.aim, active.aim);
    assert.equal(calls, 2, 'stopped pointer must not project');
    assert.equal(after.throttle, clearsAll ? 0 : 1);
    assert.equal(after.firePressed, !clearsAll, 'stop/reset does not manufacture or preserve an invalid fire edge');
    assert.equal(input.sample().firePressed, false);
    assert.deepEqual(input.sample().aim, active.aim);
    assert.equal(calls, 2);
  });
}

test('disabled and disposed inputs cannot acquire a new held aim pointer', t => {
  let calls = 0;
  const { input, aim } = setup({ projectAim: () => ({ x: ++calls, y: 1, z: -30 }) });
  t.after(() => input.dispose());
  input.setEnabled(false);
  pointer(aim, 'pointerdown');
  assert.equal(input.sample().aim, undefined);
  input.setEnabled(true);
  assert.equal(input.sample().aim, undefined, 'resume must not restore the rejected pointer');
  pointer(aim, 'pointerdown', 2);
  const active = input.sample();
  assert.equal(active.aim.worldPoint.x, 2);
  input.dispose(); input.setEnabled(true);
  pointer(aim, 'pointerdown', 3);
  assert.deepEqual(input.sample().aim, active.aim);
  assert.equal(input.sample().paused, true);
  assert.equal(calls, 2);
});

test('desktop mouse aim remains event-driven and does not reproject between events', t => {
  let offset = 0, calls = 0;
  const { input, canvas } = setup({ projectAim: (x, y) => { calls++; return { x: x + offset, y: 1, z: y }; } });
  t.after(() => input.dispose());
  pointer(canvas, 'pointermove', 1, 20, 30, { pointerType: 'mouse' });
  const first = input.sample();
  offset = 100;
  assert.deepEqual(input.sample().aim, first.aim);
  assert.equal(calls, 1);
  pointer(canvas, 'pointerdown', 1, 50, 60, { pointerType: 'mouse' });
  const shot = input.sample();
  assert.deepEqual(shot.aim, { worldPoint: { x: 150, y: 1, z: 60 } });
  assert.equal(shot.firePressed, true); assert.equal(input.sample().firePressed, false);
  assert.equal(calls, 2);
});

// Real controller, controlled camera-following projection: catches the historical 180-degree
// reversal without claiming Three.js/browser/iPad or subjective feel validation.
test('real controller keeps stationary held north aim ahead through 20 seconds of drive, then freezes released aim', t => {
  let tank = createTank({ x: 0, y: 0, z: 0, yaw: 0 }), calls = 0;
  const { input, mount, aim } = setup({ projectAim: () => {
    calls++;
    return { x: tank.pose.x, y: 0.7, z: tank.pose.z - 30 };
  } });
  t.after(() => input.dispose());
  pointer(byControl(mount, 'drive'), 'pointerdown', 1);
  pointer(aim, 'pointerdown', 2);
  for (let tick = 0; tick < 1200; tick++) {
    const controls = input.sample();
    near(controls.aim.worldPoint.z, tank.pose.z - 30, `held target at tick ${tick}`);
    assert.equal(controls.firePressed, false);
    tank = stepTank(tank, controls, 1 / 60).state;
    near(wrapAngle(tank.pose.yaw + tank.turret.yawRel), 0, `turret world yaw at tick ${tick}`);
  }
  near(tank.pose.z, -42.15675, '20 seconds of real cruise drive');
  const held = input.sample();
  near(held.aim.worldPoint.z, -72.15675, 'target remains 30 m ahead at 20 seconds');
  assert.equal(calls, 1202);
  pointer(aim, 'pointerup', 2);
  for (let tick = 0; tick < 120; tick++) {
    const controls = input.sample();
    assert.deepEqual(controls.aim, held.aim);
    tank = stepTank(tank, controls, 1 / 60).state;
  }
  assert.equal(calls, 1202, 'released world target stays fixed while hull continues moving');
});
