import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeContext, PageTarget } from './audio-fake.mjs';

const { createTankAudio } = await import('../src/tank-audio.js').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});
const snapshot = (overrides = {}) => ({ missionId: 'mission-001', phase: 'playing', tick: 10,
  tank: { vL: 0, vR: 0, blocked: { body: false }, turret: { recoil: 0 } },
  tankFrame: { desiredSpeed: 0, boostActive: false }, tankCombat: { hp: 100, reload: 0, shotsFired: 0 }, events: [], ...overrides });
const event = (type, extra = {}) => ({ id: 'event-1', tick: 10, type, entityId: 'tank', ...extra });
function fixture(options = {}) {
  const context = new FakeContext(), documentTarget = new PageTarget(), windowTarget = new PageTarget();
  const audio = createTankAudio({ createContext: () => context, documentTarget, windowTarget, ...options });
  return { audio, context, documentTarget, windowTarget };
}
async function playing(options) { const f = fixture(options); assert.equal(await f.audio.unlock(), true); f.audio.update(snapshot()); return f; }
function assertSilent(context) {
  assert.equal(context.connectedVoices.length, 0, 'all sources disconnected immediately');
  for (const node of context.allSources.filter(node => node.started)) assert.ok(node.stopAt <= context.currentTime);
  if (context.gains.length) assert.equal(context.gains[0].gain.value, 0);
}
const targetOf = param => param.calls.filter(call => call.method === 'target').at(-1)?.value;

test('tank audio is an optional lazy service with the requested public API', () => {
  assert.equal(typeof createTankAudio, 'function');
  let creations = 0;
  const audio = createTankAudio({ createContext() { creations++; throw Error('not yet'); } });
  for (const name of ['unlock', 'update', 'setPaused', 'setMuted', 'dispose']) assert.equal(typeof audio[name], 'function');
  audio.update(snapshot(), [event('shot')]); audio.setPaused(true); audio.setMuted(true); audio.dispose();
  assert.equal(creations, 0);
});

test('unlock resumes synchronously within the gesture and shares pending work without autoplay', async () => {
  const { audio, context } = fixture(); let resolve;
  context.resume = () => { context.resumeCalls++; return new Promise(r => { resolve = r; }); };
  const a = audio.unlock(), b = audio.unlock();
  assert.equal(context.resumeCalls, 1); assert.equal(a, b);
  audio.update(snapshot(), [event('shot')]); assert.equal(context.allSources.length, 0);
  context.changeState('running'); resolve();
  assert.equal(await a, true); assert.equal(context.allSources.length, 0);
  audio.dispose();
});

test('unsupported contexts and denied resume are optional, with a later genuine gesture retry', async () => {
  for (const createContext of [() => null, () => { throw Error('not supported'); }]) {
    const { audio } = fixture({ createContext });
    assert.equal(await audio.unlock(), false);
    assert.doesNotThrow(() => { audio.update(snapshot()); audio.setPaused(true); audio.dispose(); });
  }
  const { audio, context } = fixture(); context.resume = () => Promise.reject(Error('autoplay denied'));
  assert.equal(await audio.unlock(), false); assertSilent(context);
  context.resume = FakeContext.prototype.resume.bind(context);
  assert.equal(await audio.unlock(), true); audio.update(snapshot());
  assert.equal(context.connectedVoices.length, 3); audio.dispose();
});

test('three bounded soft engine and tread layers are reused without per-frame allocation', async () => {
  const { audio, context } = await playing({ volume: 999 });
  for (const speed of [0, 3.5, -3.5, 1e9, NaN, Infinity, undefined]) {
    for (let i = 0; i < 30; i++) audio.update(snapshot({ tank: { vL: speed, vR: speed }, tankFrame: { desiredSpeed: speed } }));
  }
  assert.equal(context.allSources.length, 3); assert.equal(context.buffers.length, 1);
  for (const oscillator of context.oscillators) {
    assert.ok(['triangle', 'sine'].includes(oscillator.type));
    assert.ok(oscillator.startFrequency < 100, 'no 440 Hz startup whistle');
    for (const call of oscillator.frequency.calls) assert.ok(call.value >= 20 && call.value <= 200);
  }
  for (const gain of context.gains) for (const call of gain.gain.calls) assert.ok(call.value >= 0 && call.value <= .3);
  for (const call of context.sources[0].playbackRate.calls) assert.ok(call.value > 0 && call.value <= 3);
  audio.dispose(); assertSilent(context);
});

test('accepted track movement drives rumble for forward, reverse and counter-rotating pivot', async () => {
  const { audio, context } = await playing(); const trackGain = context.gains[3].gain;
  assert.equal(targetOf(trackGain), 0, 'idle tracks are silent');
  for (const [vL, vR] of [[2, 2], [-2, -2], [-.5, .5]]) {
    audio.update(snapshot({ tank: { vL, vR } }));
    assert.ok(targetOf(trackGain) > 0, 'pivot must not cancel to zero average velocity');
  }
  audio.update(snapshot({ tank: { vL: 0, vR: 0, blocked: { body: true } }, tankFrame: { desiredSpeed: 3.5, boostActive: true } }));
  assert.equal(targetOf(trackGain), 0, 'blocked tracks do not sound as though moving');
  audio.dispose();
});

test('engine load rises under acceleration demand but stays below a restrained gain ceiling', async () => {
  const { audio, context } = await playing();
  const engine = context.oscillators[0], gain = context.gains[1].gain;
  const idlePitch = targetOf(engine.frequency), idleGain = targetOf(gain);
  audio.update(snapshot({ tankFrame: { desiredSpeed: 2.2, boostActive: false } }));
  assert.ok(targetOf(engine.frequency) > idlePitch); assert.ok(targetOf(gain) > idleGain);
  assert.ok(targetOf(gain) <= .08); audio.dispose();
});

test('fresh idle startup keeps the rumble quiet throughout parameter cancellation', async () => {
  const { audio, context } = await playing();
  for (const dt of [0, .001, .01, .08, .3]) {
    context.advance(dt);
    assert.ok(context.gains[1].gain.value <= .02); assert.ok(context.gains[2].gain.value <= .015);
    assert.equal(context.gains[3].gain.value, 0); audio.update(snapshot());
  }
  audio.dispose();
});

test('confirmed player shots and impacts make short cues without mutating state or borrowed events', async () => {
  for (const type of ['shot', 'impact']) {
    const { audio, context } = await playing();
    const events = Object.freeze([Object.freeze(event(type))]); const state = Object.freeze(snapshot());
    audio.update(state, events);
    const cues = context.allSources.filter(node => Number.isFinite(node.stopAt));
    assert.ok(cues.length >= 1 && cues.length <= 2);
    assert.ok(cues.every(node => node.stopAt > node.startAt && node.stopAt <= context.currentTime + .5));
    assert.deepEqual(events, [event(type)]);
    context.advance(1); assert.equal(context.connectedVoices.length, 3, 'finished cues release their nodes');
    audio.dispose();
  }
});

test('fire intent, blocked fire, reload and recoil snapshots cannot manufacture gunshots', async () => {
  const { audio, context } = await playing();
  audio.update(snapshot({ tank: { vL: 0, vR: 0, turret: { recoil: .08 } }, tankCombat: { hp: 100, reload: .9, shotsFired: 20 } }),
    [event('fire'), event('fire-blocked'), event('constructor'), null, {}, 'shot']);
  assert.equal(context.allSources.length, 3); audio.dispose();
});

test('combat event IDs are consumed once, including events suppressed by rate limiting', async () => {
  const { audio, context } = await playing();
  const shot = event('shot'); audio.update(snapshot(), [shot]); const firstCount = context.allSources.length;
  context.advance(1); audio.update(snapshot(), [{ ...shot }]); assert.equal(context.allSources.length, firstCount);
  const next = event('impact', { id: 'event-2' }); audio.update(snapshot(), [next]);
  const suppressed = event('impact', { id: 'event-3' }); audio.update(snapshot(), [suppressed]);
  const count = context.allSources.length; context.advance(1); audio.update(snapshot(), [suppressed]);
  assert.equal(context.allSources.length, count, 'no deferred stale cue burst'); audio.dispose();
});

test('event storms coalesce and retain no more than eight connected sources', async () => {
  const { audio, context } = await playing();
  for (let frame = 0; frame < 30; frame++) {
    const events = Array.from({ length: 2000 }, (_, i) => event(i % 2 ? 'impact' : 'shot', { id: `${frame}-${i}` }));
    const before = context.allSources.length; audio.update(snapshot(), events);
    assert.ok(context.allSources.length - before <= 2, 'at most one chosen cue per update');
    assert.ok(context.connectedVoices.length <= 8);
    context.advance(.08);
  }
  audio.dispose(); assertSilent(context);
});

test('stale events older than the fixed-step render window never play', async () => {
  const { audio, context } = await playing();
  audio.update(snapshot({ tick: 100 }), [event('shot', { tick: 10 })]);
  assert.equal(context.allSources.length, 3); audio.dispose();
});

test('pause immediately kills cues and sources; unpause requires unlock and drops the first event batch', async () => {
  const { audio, context } = await playing(); audio.update(snapshot(), [event('shot')]);
  audio.setPaused(true); assertSilent(context); const count = context.allSources.length;
  audio.update(snapshot(), [event('impact')]); assert.equal(context.allSources.length, count, 'playing snapshot cannot override explicit pause');
  audio.setPaused(false); audio.update(snapshot()); assert.equal(context.allSources.length, count);
  assert.equal(await audio.unlock(), true); audio.update(snapshot(), [event('shot', { id: 'stale' })]);
  assert.equal(context.allSources.length, count + 3); context.advance(1);
  audio.update(snapshot(), [event('shot', { id: 'stale' })]); assert.equal(context.allSources.length, count + 3);
  audio.dispose();
});

test('muting and phase exit silence immediately and unmuting never auto-resumes', async () => {
  for (const phase of ['briefing', 'paused', 'won', 'lost']) {
    const { audio, context } = await playing(); audio.update(snapshot({ phase })); assertSilent(context); audio.dispose();
  }
  const { audio, context } = await playing(); audio.setMuted(true); assertSilent(context);
  assert.equal(await audio.unlock(), false); const count = context.allSources.length;
  audio.setMuted(false); audio.update(snapshot()); assert.equal(context.allSources.length, count);
  assert.equal(await audio.unlock(), true); audio.update(snapshot()); assert.equal(context.connectedVoices.length, 3); audio.dispose();
});

test('a destroyed tank cannot keep its engine or tracks running', async () => {
  const { audio, context } = await playing();
  audio.update(snapshot({ tank: { vL: 2, vR: 2 }, tankCombat: { hp: 0 } }));
  assert.equal(targetOf(context.gains[1].gain), 0); assert.equal(targetOf(context.gains[2].gain), 0); assert.equal(targetOf(context.gains[3].gain), 0);
  audio.dispose();
});

test('blur, visibility hide and pagehide silence without another animation frame', async () => {
  for (const kind of ['blur', 'visibilitychange', 'pagehide']) {
    const { audio, context, documentTarget, windowTarget } = await playing();
    if (kind === 'visibilitychange') { documentTarget.hidden = true; documentTarget.dispatchEvent(new Event(kind)); }
    else windowTarget.dispatchEvent(new Event(kind));
    assertSilent(context); assert.equal(await audio.unlock(), false);
    documentTarget.hidden = false; documentTarget.dispatchEvent(new Event('visibilitychange'));
    windowTarget.dispatchEvent(new Event('focus')); windowTarget.dispatchEvent(new Event('pageshow'));
    const count = context.allSources.length; audio.update(snapshot()); assert.equal(context.allSources.length, count);
    assert.equal(await audio.unlock(), true); audio.update(snapshot()); assert.equal(context.connectedVoices.length, 3); audio.dispose();
  }
});

test('interruption requires a new gesture even if the browser later reports running', async () => {
  const { audio, context } = await playing(); context.changeState('interrupted'); assertSilent(context);
  const count = context.allSources.length; context.changeState('running'); audio.update(snapshot(), [event('shot')]);
  assert.equal(context.allSources.length, count); assert.equal(await audio.unlock(), true); audio.update(snapshot());
  assert.equal(context.connectedVoices.length, 3); audio.dispose();
});

test('late resume resolution cannot revive paused, blurred or disposed audio', async () => {
  for (const action of ['pause', 'blur', 'dispose']) {
    const { audio, context, windowTarget } = fixture(); let resolve;
    context.resume = () => new Promise(r => { resolve = r; }); const pending = audio.unlock();
    if (action === 'pause') audio.setPaused(true); else if (action === 'blur') windowTarget.dispatchEvent(new Event('blur')); else audio.dispose();
    context.changeState('running'); resolve(); assert.equal(await pending, false);
    audio.update(snapshot()); assertSilent(context);
    if (action !== 'dispose') assert.equal(context.state, 'suspended'); audio.dispose();
  }
});

test('new unlock survives an older asynchronous suspend and resume', async () => {
  const { audio, context } = await playing(); let oldResume, latestResume;
  context.suspend = () => Promise.resolve(); audio.setPaused(true); audio.setPaused(false); context.state = 'suspended';
  context.resume = () => new Promise(r => { oldResume = r; }); const old = audio.unlock();
  audio.setPaused(true); audio.setPaused(false); context.resume = () => new Promise(r => { latestResume = r; }); const current = audio.unlock();
  context.changeState('suspended'); context.changeState('running'); oldResume(); latestResume();
  assert.equal(await old, false); assert.equal(await current, true);
  audio.update(snapshot()); assert.equal(context.connectedVoices.length, 3); audio.dispose();
});

test('partial graph failures and rejected hardware cleanup cannot escape into gameplay', async () => {
  const { audio, context } = fixture(); await audio.unlock();
  context.createBiquadFilter = () => { throw Error('device failed'); };
  context.suspend = () => Promise.reject(Error('device disconnected')); context.close = () => Promise.reject(Error('already closed'));
  assert.doesNotThrow(() => audio.update(snapshot())); assertSilent(context);
  audio.dispose(); await new Promise(resolve => setImmediate(resolve));
  assert.doesNotThrow(() => audio.update(snapshot()));
  for (const gain of context.gains) assert.equal(gain.connections.size, 0);
});

test('dispose is permanent and idempotent, releases buffers and removes all listeners', async () => {
  const { audio, context, documentTarget, windowTarget } = await playing(); audio.update(snapshot(), [event('shot')]);
  audio.dispose(); audio.dispose(); assertSilent(context); assert.equal(context.closeCalls, 1);
  assert.equal(documentTarget.listeners.size, 0); assert.equal(windowTarget.listeners.size, 0);
  assert.ok(context.sources.every(source => source.buffer === null));
  assert.equal(await audio.unlock(), false); const count = context.allSources.length;
  audio.setMuted(false); audio.setPaused(false); audio.update(snapshot()); assert.equal(context.allSources.length, count);
});

test('fast resume enqueues a gesture resume even while an older suspend still reports running', async () => {
  const { audio, context } = await playing(); let resolveSuspend, resolveResume;
  context.suspend = () => { context.suspendCalls++; return new Promise(resolve => { resolveSuspend = resolve; }); };
  audio.setPaused(true); assertSilent(context); assert.equal(context.state, 'running');
  const before = context.resumeCalls;
  context.resume = () => { context.resumeCalls++; return new Promise(resolve => { resolveResume = resolve; }); };
  audio.setPaused(false); const pending = audio.unlock();
  assert.equal(context.resumeCalls, before + 1, 'inactive unlock must not trust stale running state');
  context.changeState('suspended'); resolveSuspend();
  context.changeState('running'); resolveResume();
  assert.equal(await pending, true); audio.update(snapshot()); assert.equal(context.connectedVoices.length, 3);
  audio.dispose();
});
