import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDOM, byControl } from './input-dom.mjs';
import { createInput } from '../src/campaign-input.js';
import { boot, action } from './main-entry-harness.mjs';
import { PROGRESS_NAMESPACE as PROGRESS_KEY } from '../src/content/crafted20/index.js';

function pointer(element, type, pointerId = 1, clientX = 60, clientY = 0, more = {}) {
  element.dispatch(type, { pointerId, pointerType: 'touch', clientX, clientY, button: 0, ...more });
}
function setup(options = {}) {
  const dom = makeDOM();
  return { ...dom, input: createInput(dom.canvas, { ...dom, ...options }) };
}

// Missing the explicit clear must fail even for a quick down/up between samples.
test('explicit clearAim reset forgets a released quick-tap target and accepts fresh aim', t => {
  let calls = 0;
  const { input, mount } = setup({ projectAim: () => ({ x: ++calls, y: 1, z: -30 }) });
  t.after(() => input.dispose());
  const aim = byControl(mount, 'aim');
  pointer(aim, 'pointerdown'); pointer(aim, 'pointerup');
  assert.deepEqual(input.sample().aim, { worldPoint: { x: 1, y: 1, z: -30 } });
  input.reset({ clearAim: true });
  assert.equal(input.sample().aim, undefined, 'new context must not inherit the released target');
  assert.equal(calls, 1, 'clearing does not fabricate a new projection');
  pointer(aim, 'pointerdown', 2); pointer(aim, 'pointerup', 2);
  assert.deepEqual(input.sample().aim, { worldPoint: { x: 2, y: 1, z: -30 } });
  assert.equal(input.sample().firePressed, false);
});

// Clearing lastAim alone is insufficient: an old owned vector could recreate it next sample.
test('explicit clearAim reset drops held projection, keys and queued fire but preserves governor', t => {
  let calls = 0;
  const { input, mount, window } = setup({ projectAim: () => ({ x: ++calls, y: 1, z: -30 }) });
  t.after(() => input.dispose());
  const aim = byControl(mount, 'aim'), drive = byControl(mount, 'drive');
  pointer(aim, 'pointerdown');
  assert.deepEqual(input.sample().aim, { worldPoint: { x: 2, y: 1, z: -30 } });
  pointer(drive, 'pointerdown', 2);
  pointer(byControl(mount, 'fire'), 'pointerdown', 3);
  pointer(byControl(mount, 'brake'), 'pointerdown', 4);
  pointer(byControl(mount, 'boost'), 'pointerdown', 5);
  for (const code of ['KeyW', 'KeyD', 'Space', 'ShiftLeft', 'KeyF', 'Digit3']) window.dispatch('keydown', { code });
  input.reset({ clearAim: true });
  assert.deepEqual(input.sample(), {
    throttle: 0, steer: 0, brake: false, boost: false,
    governor: 'travel', firePressed: false, paused: false,
  });
  assert.equal(calls, 2, 'released held vector cannot reproject the stale target');
  assert.equal(aim.hasPointerCapture(1), false);
  assert.equal(drive.hasPointerCapture(2), false);
  pointer(aim, 'pointermove', 1, 120, 60);
  input.setEnabled(false); input.setEnabled(true);
  assert.equal(input.sample().aim, undefined, 'old pointer and enable cycle cannot restore cleared aim');
  assert.equal(calls, 2);
  pointer(aim, 'pointerdown', 6);
  assert.deepEqual(input.sample().aim, { worldPoint: { x: 4, y: 1, z: -30 } });
  assert.equal(input.sample().governor, 'travel');
  assert.equal(input.sample().firePressed, false);
});

// A truthiness check or unconditional reset would break the established within-world contract.
const retainingResets = [
  ['no argument', input => input.reset()],
  ['undefined', input => input.reset(undefined)],
  ['null', input => input.reset(null)],
  ['false', input => input.reset(false)],
  ['primitive true', input => input.reset(true)],
  ['unknown options', input => input.reset({ unrelated: true })],
  ['clearAim false', input => input.reset({ clearAim: false })],
  ['truthy string', input => input.reset({ clearAim: 'true' })],
  ['truthy number', input => input.reset({ clearAim: 1 })],
  ['DOM blur event', (_input, window) => window.dispatch('blur')],
];
for (const [name, reset] of retainingResets) {
  test(`reset with ${name} retains target while clearing held input`, t => {
    let calls = 0;
    const { input, mount, window } = setup({ projectAim: () => ({ x: ++calls, y: 1, z: -30 }) });
    t.after(() => input.dispose());
    pointer(byControl(mount, 'aim'), 'pointerdown');
    const target = input.sample().aim;
    assert.deepEqual(target, { worldPoint: { x: 2, y: 1, z: -30 } });
    pointer(byControl(mount, 'drive'), 'pointerdown', 2);
    pointer(byControl(mount, 'fire'), 'pointerdown', 3);
    window.dispatch('keydown', { code: 'ShiftLeft' });
    reset(input, window);
    const controls = input.sample();
    assert.deepEqual(controls.aim, target);
    assert.equal(controls.throttle, 0); assert.equal(controls.boost, false); assert.equal(controls.firePressed, false);
    assert.equal(calls, 2, 'default reset stops active reprojection without forgetting the target');
  });
}

function mouseAim(app, clientX = 512, clientY = 700) {
  pointer(app.canvas, 'pointermove', 90, clientX, clientY, { pointerType: 'mouse' });
}
async function aimedMain(t, search = '?keep=a%20b#stay') {
  const app = await boot(search);
  t.after(() => app.dispose());
  action(app, 'start').dispatch('click'); app.frame();
  assert.equal(app.metrics.lastControls.aim, undefined, 'boot starts without a fabricated aim');
  assert.equal(app.latest.state.tank.turret.yawRel, 0);
  mouseAim(app); app.frame();
  assert.ok(app.metrics.lastControls.aim, 'real main raycaster must produce a valid mouse target');
  assert.ok(Math.abs(app.latest.state.tank.turret.yawRel) > 0, 'real simulation must turn the turret before the reset');
  return app;
}
function chooseNormal(app, id) {
  action(app, 'missions').dispatch('click');
  const card = app.mount.querySelector(`[data-mission-id="${id}"]`);
  assert.ok(card); card.dispatch('click');
}
function chooseOptional(app, slug) {
  action(app, 'missions').dispatch('click');
  const card = app.mount.querySelector(`[data-optional-slug="${slug}"]`);
  assert.ok(card); card.dispatch('click');
}
function retry(app) {
  action(app, 'pause').dispatch('click'); action(app, 'retry').dispatch('click');
}

// No synthetic terminal override is used: actual main, raycaster, input, world and simulation.
// Omitting the loadSelection clear option must make every new-world case fail.
const transitions = [
  { name: 'normal retry', from: '', change: retry, id: 'crafted20-002', sortie: null, writes: 1, history: 0 },
  { name: 'normal to normal', from: '', change: app => chooseNormal(app, 'crafted20-001'), id: 'crafted20-001', sortie: null, writes: 1, history: 0 },
  { name: 'normal to warehouse optional', from: '', change: app => chooseOptional(app, 'warehouse-fork'), id: 'mission-9001', sortie: 'warehouse-fork', writes: 0, history: 1 },
  { name: 'normal to breach optional', from: '', change: app => chooseOptional(app, 'breach-cover'), id: 'mission-9002', sortie: 'breach-cover', writes: 0, history: 1 },
  { name: 'optional retry', from: '&sortie=breach-cover', change: retry, id: 'mission-9002', sortie: 'breach-cover', writes: 0, history: 0 },
  { name: 'optional to normal', from: '&sortie=warehouse-fork', change: app => chooseNormal(app, 'crafted20-001'), id: 'crafted20-001', sortie: null, writes: 1, history: 1 },
  { name: 'optional to optional', from: '&sortie=warehouse-fork', change: app => chooseOptional(app, 'breach-cover'), id: 'mission-9002', sortie: 'breach-cover', writes: 0, history: 1 },
];
for (const transition of transitions) {
  test(`actual main ${transition.name}: fresh world has no old aim or unsolicited turret turn`, async t => {
    const app = await aimedMain(t, `?keep=a%20b${transition.from}#stay`);
    const oldAim = app.metrics.lastControls.aim;
    const oldState = app.latest.state, creates = app.metrics.worldCreates, disposes = app.metrics.worldDisposes;
    const writes = app.storage.writes.length, history = app.historyCalls.length;
    const unlocked = [...app.latest.progress.unlockedIds], results = { ...app.latest.progress.bestResults };
    const storedBefore = app.storage.values.get(PROGRESS_KEY);
    app.window.dispatch('keydown', { code: 'Digit3' });
    app.window.dispatch('keydown', { code: 'KeyW' });
    app.window.dispatch('keydown', { code: 'ShiftLeft' });
    app.window.dispatch('keydown', { code: 'KeyF' });
    transition.change(app);
    assert.notEqual(app.latest.state, oldState);
    assert.equal(app.latest.spec.id, transition.id); assert.equal(app.latest.state.phase, 'briefing');
    assert.equal(app.latest.state.tank.turret.yawRel, 0);
    assert.equal(app.metrics.worldCreates, creates + 1); assert.equal(app.metrics.worldDisposes, disposes + 1);
    assert.equal(app.storage.writes.length, writes + transition.writes);
    assert.equal(app.historyCalls.length, history + transition.history);
    assert.deepEqual(app.latest.progress.unlockedIds, unlocked); assert.deepEqual(app.latest.progress.bestResults, results);
    assert.equal(app.storage.values.get('legacy-unrelated'), ' exact legacy bytes \n');
    if (transition.writes === 0) assert.equal(app.storage.values.get(PROGRESS_KEY), storedBefore, 'optional transition preserves exact normal progress bytes');
    else assert.equal(JSON.parse(app.storage.values.get(PROGRESS_KEY)).selectedMissionId, transition.id);
    assert.equal(app.location.search, `?keep=a%20b${transition.sortie ? `&sortie=${transition.sortie}` : ''}`);
    assert.equal(app.location.hash, '#stay');
    action(app, 'start').dispatch('click');
    for (let frame = 0; frame < 3; frame++) {
      app.frame();
      assert.equal(app.metrics.lastControls.aim, undefined, `fresh world frame ${frame} must not inherit ${JSON.stringify(oldAim)}`);
      assert.equal(app.latest.state.tank.turret.yawRel, 0, 'no unsolicited turn without new aim');
      assert.equal(app.metrics.lastControls.throttle, 0); assert.equal(app.metrics.lastControls.boost, false);
      assert.equal(app.metrics.lastControls.firePressed, false); assert.equal(app.metrics.lastControls.governor, 'travel');
    }
    assert.ok(app.latest.state.tick > 0, 'neutral turret assertion must follow actual simulation ticks');
    mouseAim(app, 768, 700); app.frame();
    assert.ok(app.metrics.lastControls.aim, 'new world still accepts subsequent aim');
    assert.notDeepEqual(app.metrics.lastControls.aim, oldAim);
    assert.ok(Math.abs(app.latest.state.tank.turret.yawRel) > 0, 'subsequent fresh aim turns the real turret');
  });
}

// Broad clearing on commands/lifecycle instead of only loadSelection must fail these controls.
const sameWorldPauses = [
  ['pause/resume', app => action(app, 'pause').dispatch('click')],
  ['window blur/resume', app => app.window.dispatch('blur')],
  ['hidden/visible/resume', app => {
    app.document.hidden = true; app.document.visibilityState = 'hidden'; app.document.dispatch('visibilitychange');
    app.document.hidden = false; app.document.visibilityState = 'visible'; app.document.dispatch('visibilitychange');
  }],
  ['persisted pagehide/pageshow/resume', app => {
    app.window.dispatch('pagehide', { persisted: true }); app.window.dispatch('pageshow', { persisted: true });
  }],
];
for (const [name, pause] of sameWorldPauses) {
  test(`actual main ${name} retains aim in the same world`, async t => {
    const app = await aimedMain(t);
    const aim = app.metrics.lastControls.aim, tick = app.latest.state.tick;
    const creates = app.metrics.worldCreates, disposes = app.metrics.worldDisposes;
    const writes = app.storage.writes.length, history = app.historyCalls.length;
    pause(app);
    assert.equal(app.latest.state.phase, 'paused');
    action(app, 'resume').dispatch('click'); app.frame();
    assert.equal(app.latest.state.phase, 'playing'); assert.ok(app.latest.state.tick > tick);
    assert.deepEqual(app.metrics.lastControls.aim, aim, 'same-world pause must not forget the last valid target');
    assert.equal(app.metrics.worldCreates, creates); assert.equal(app.metrics.worldDisposes, disposes);
    assert.equal(app.storage.writes.length, writes); assert.equal(app.historyCalls.length, history);
  });
}

test('actual main invalid or locked selections preserve the current aim and have no world/storage/history effects', async t => {
  const app = await aimedMain(t, '?keep=a%20b&sortie=breach-cover#stay');
  const current = app.latest, aim = app.metrics.lastControls.aim;
  const creates = app.metrics.worldCreates, disposes = app.metrics.worldDisposes, resets = app.metrics.inputResets;
  const writes = app.storage.writes.length, stored = [...app.storage.values], location = app.location.href;
  for (const id of ['crafted20-003', 'missing', 'mission-9001', null]) app.uiActions.selectMission(id);
  for (const slug of ['missing', '__proto__', 'constructor', '', null]) app.uiActions.selectOptionalMission(slug);
  assert.equal(app.latest, current); assert.equal(app.metrics.inputResets, resets);
  assert.equal(app.metrics.worldCreates, creates); assert.equal(app.metrics.worldDisposes, disposes);
  assert.equal(app.storage.writes.length, writes); assert.deepEqual([...app.storage.values], stored);
  assert.equal(app.historyCalls.length, 0); assert.equal(app.location.href, location);
  app.frame();
  assert.deepEqual(app.metrics.lastControls.aim, aim, 'rejected choices must not clear input aim');
  assert.equal(app.latest.state.phase, 'playing');
});
