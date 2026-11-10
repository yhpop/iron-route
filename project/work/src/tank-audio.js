/**
 * Optional, presentation-only tank sound. No assets, timers or simulation writes.
 *
 * Call setPaused(false), then unlock() synchronously inside the real Start/Resume
 * gesture, never after an await. Unmute likewise needs unlock() in that gesture.
 * update(state, events = state.events) borrows nested campaign state and events;
 * it never derives firing from button/recoil/reload state. The first frame after
 * every unlock consumes but does not play events. Pause immediately, not at RAF.
 * Blur, hidden pages and interrupted devices silence and require a fresh unlock.
 * Synthesized levels are deliberately restrained, not loudness-certified; unit
 * tests cover lifecycle/scheduling, not audible quality or Safari/mobile policy.
 */
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const ignoreFailure = action => {
  try { Promise.resolve(action()).catch(() => {}); } catch { /* Sound is optional. */ }
};
const defaultContext = () => {
  const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
  return Context ? new Context({ latencyHint: 'interactive' }) : null;
};

// A low, fast-decaying recoil thump with a short filtered pressure burst, not
// a musical notification. Impact is shorter/lighter; shield has a metallic edge.
const SHOT = { priority: 4, tones: [['sine', 98, 32, .25, .12], ['noise', 580, 140, .11, .065]] };
const HOSTILE_SHOT = { priority: 1, tones: [['triangle', 78, 38, .16, .048]] };
const IMPACT = { priority: 3, tones: [['triangle', 135, 52, .14, .06], ['noise', 850, 180, .12, .045]] };
const SHIELD = { priority: 2, tones: [['triangle', 310, 160, .13, .045], ['noise', 1200, 400, .08, .025]] };
const MAX_VOICES = 8, MAX_EVENTS = 64, MAX_SEEN = 256;

export function createTankAudio({
  createContext = defaultContext,
  documentTarget = globalThis.document,
  windowTarget = globalThis.window,
  volume = .22,
} = {}) {
  const level = clamp(finite(volume, .22), 0, .3);
  const voices = new Set(), seenEvents = new Set();
  let seenObjects = new WeakSet();
  let context, master, engine, chassis, tracks, noiseBuffer, pendingUnlock;
  let paused = false, muted = false, disposed = false, unavailable = false;
  let hidden = Boolean(documentTarget?.hidden), blurred = false, active = false, dropEvents = true;
  let epoch = 0, nextCueAt = 0, closeRequested = false, lastMission, lastTick;
  const canRun = () => !disposed && !unavailable && !paused && !muted && !hidden && !blurred && !documentTarget?.hidden;
  const now = () => Math.max(0, finite(context?.currentTime));

  function release(voice, stop = true) {
    voices.delete(voice);
    if (voice.source) {
      voice.source.onended = null;
      if (stop && voice.started) ignoreFailure(() => voice.source.stop(now()));
      ignoreFailure(() => voice.source.disconnect());
      if (voice.noise) ignoreFailure(() => { voice.source.buffer = null; });
    }
    if (voice.filter) ignoreFailure(() => voice.filter.disconnect());
    if (voice.gain) ignoreFailure(() => voice.gain.disconnect());
  }
  function stopGraph() {
    active = false; dropEvents = true; engine = chassis = tracks = null;
    if (master) ignoreFailure(() => {
      master.gain.cancelScheduledValues(now()); master.gain.setValueAtTime(0, now());
    });
    for (const voice of voices) release(voice);
  }
  function silence(suspend = true) {
    epoch++; pendingUnlock = null; nextCueAt = 0;
    stopGraph();
    if (suspend && context && context.state !== 'closed') ignoreFailure(() => context.suspend());
  }
  function close() {
    if (!context || closeRequested) return;
    closeRequested = true;
    ignoreFailure(() => context.removeEventListener('statechange', onContextState));
    if (master) ignoreFailure(() => master.disconnect());
    noiseBuffer = null;
    ignoreFailure(() => context.close());
  }
  function fail() { unavailable = true; silence(false); close(); }
  function onContextState() {
    if (context.state === 'running') return;
    // An older suspend may finish while a newer gesture's resume is pending.
    // Kill its old graph, but let that resume establish its own final state.
    if (pendingUnlock) stopGraph();
    else silence(false);
  }

  function unlock() {
    if (!canRun()) return Promise.resolve(false);
    if (pendingUnlock) return pendingUnlock;
    if (active && context?.state === 'running') return Promise.resolve(true);
    try {
      if (!context) {
        context = createContext();
        if (!context) { unavailable = true; return Promise.resolve(false); }
        master = context.createGain();
        master.gain.setValueAtTime(0, now()); master.connect(context.destination);
        context.addEventListener('statechange', onContextState);
      }
      if (context.state === 'closed') { fail(); return Promise.resolve(false); }
      const token = epoch;
      // Do not defer resume: the caller's actual user activation must own it.
      // An older suspend can still be pending while state reports 'running';
      // inactive unlock must issue the new request, not trust that snapshot.
      const resumed = context.resume();
      const work = Promise.resolve(resumed).then(() => {
        if (token !== epoch || !canRun() || context.state !== 'running') {
          if (!disposed && !canRun() && context.state === 'running') ignoreFailure(() => context.suspend());
          return false;
        }
        active = true; dropEvents = true; master.gain.setValueAtTime(level, now());
        return true;
      }).catch(() => {
        if (token === epoch) silence();
        return false;
      }).finally(() => { if (pendingUnlock === work) pendingUnlock = null; });
      pendingUnlock = work;
      return work;
    } catch { fail(); return Promise.resolve(false); }
  }

  function getNoise() {
    if (noiseBuffer) return noiseBuffer;
    const sampleRate = clamp(finite(context.sampleRate, 44100), 8000, 192000);
    noiseBuffer = context.createBuffer(1, Math.ceil(sampleRate * .8), sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    // Local deterministic noise; no dependency on simulation/global randomness.
    let seed = 0x74616e6b;
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      samples[i] = seed / 2147483648 - 1;
    }
    return noiseBuffer;
  }
  function voice(type, frequency, start = now()) {
    const result = { source: null, gain: null, filter: null, noise: type === 'noise', started: false };
    voices.add(result); // Partial allocations are owned before the next fallible call.
    result.source = result.noise ? context.createBufferSource() : context.createOscillator();
    result.gain = context.createGain(); result.gain.gain.value = 0;
    if (result.noise) {
      result.source.buffer = getNoise(); result.source.loop = true;
      result.filter = context.createBiquadFilter(); result.filter.type = 'lowpass';
      result.filter.frequency.value = frequency; result.filter.Q.value = .55;
      result.source.connect(result.filter); result.filter.connect(result.gain);
    } else {
      result.source.type = type; result.source.frequency.value = frequency;
      result.source.connect(result.gain);
    }
    result.gain.connect(master);
    result.source.onended = () => release(result, false);
    result.source.start(start); result.started = true;
    return result;
  }
  function target(param, value, at) {
    // Hold the rendered value before cancelling, avoiding a default-gain burst.
    const held = param.value;
    param.cancelScheduledValues(at); param.setValueAtTime(held, at);
    param.setTargetAtTime(value, at, .08);
  }

  function chooseCue(state, events, suppress) {
    if (!Array.isArray(events)) return;
    let chosen;
    for (let i = 0; i < Math.min(MAX_EVENTS, events.length); i++) {
      const event = events[i];
      if (!event || typeof event !== 'object') continue;
      const key = typeof event.id === 'string' || typeof event.id === 'number' ? `${event.tick}:${event.id}` : null;
      if (key !== null) {
        if (seenEvents.has(key)) continue;
        seenEvents.add(key);
        if (seenEvents.size > MAX_SEEN) seenEvents.delete(seenEvents.values().next().value);
      } else {
        if (seenObjects.has(event)) continue;
        seenObjects.add(event);
      }
      // Consume even suppressed events; nothing is queued for a future frame.
      if (suppress) continue;
      if (Number.isFinite(state.tick) && Number.isFinite(event.tick) && (event.tick < state.tick - 6 || event.tick > state.tick)) continue;
      const cue = event.type === 'shot' ? (event.entityId === 'tank' ? SHOT : HOSTILE_SHOT)
        : event.type === 'impact' ? (event.value === 'shield' ? SHIELD : IMPACT) : null;
      if (cue && (!chosen || cue.priority > chosen.priority)) chosen = cue;
    }
    return chosen;
  }

  function update(state = {}, events = state?.events) {
    if (disposed || unavailable) return;
    if (state?.paused || (state?.phase && state.phase !== 'playing')) setPaused(true);
    if (!active || !canRun() || context?.state !== 'running') return;
    try {
      if ((lastMission !== undefined && state?.missionId !== lastMission)
        || (Number.isFinite(lastTick) && Number.isFinite(state?.tick) && state.tick < lastTick)) {
        seenEvents.clear(); seenObjects = new WeakSet(); dropEvents = true; nextCueAt = 0;
      }
      lastMission = state?.missionId; lastTick = state?.tick;
      const at = now(), tank = state?.tank;
      const left = clamp(Math.abs(finite(tank?.vL)), 0, 3.5), right = clamp(Math.abs(finite(tank?.vR)), 0, 3.5);
      // Mean absolute speed preserves tread rumble during a counter-rotating pivot.
      const movement = (left + right) / 7;
      const demand = clamp(Math.abs(finite(state?.tankFrame?.desiredSpeed)), 0, 3.5) / 3.5;
      const load = clamp(Math.max(0, demand - movement) + (state?.tankFrame?.boostActive ? .15 : 0), 0, 1);
      const alive = finite(state?.tankCombat?.hp, 100) > 0;
      const enginePitch = 39 + movement * 30 + load * 8;
      engine ||= voice('triangle', enginePitch);
      chassis ||= voice('sine', 25 + movement * 14);
      tracks ||= voice('noise', 130 + movement * 420);
      target(engine.source.frequency, enginePitch, at);
      target(engine.gain.gain, alive ? .014 + movement * .032 + load * .018 : 0, at);
      target(chassis.source.frequency, 25 + movement * 14, at);
      target(chassis.gain.gain, alive ? .007 + movement * .013 : 0, at);
      target(tracks.source.playbackRate, .65 + movement * 1.2, at);
      target(tracks.filter.frequency, 130 + movement * 420, at);
      target(tracks.gain.gain, alive && movement > .003 ? .009 + movement * .035 : 0, at);
      const cue = chooseCue(state, events, dropEvents || at < nextCueAt);
      dropEvents = false;
      if (!cue || voices.size + cue.tones.length > MAX_VOICES) return;
      nextCueAt = at + .09;
      for (const [type, from, to, duration, gain] of cue.tones) {
        const tone = voice(type, from, at), pitch = tone.noise ? tone.filter.frequency : tone.source.frequency;
        pitch.setValueAtTime(from, at); pitch.linearRampToValueAtTime(to, at + duration);
        tone.gain.gain.setValueAtTime(0, at);
        tone.gain.gain.linearRampToValueAtTime(gain, at + .012);
        tone.gain.gain.linearRampToValueAtTime(0, at + duration);
        tone.source.stop(at + duration + .012);
      }
    } catch { fail(); }
  }

  function setPaused(value) {
    if (disposed || paused === Boolean(value)) return;
    paused = Boolean(value); if (paused) silence();
  }
  function setMuted(value) {
    if (disposed || muted === Boolean(value)) return;
    muted = Boolean(value); if (muted) silence();
  }
  function onVisibility() { hidden = Boolean(documentTarget?.hidden); if (hidden) silence(); }
  function onPageHide() { hidden = true; silence(); }
  function onPageShow() { hidden = Boolean(documentTarget?.hidden); }
  function onBlur() { blurred = true; silence(); }
  function onFocus() { blurred = false; }
  const listeners = [
    [documentTarget, 'visibilitychange', onVisibility], [windowTarget, 'pagehide', onPageHide],
    [windowTarget, 'pageshow', onPageShow], [windowTarget, 'blur', onBlur], [windowTarget, 'focus', onFocus],
  ];
  function dispose() {
    if (disposed) return;
    disposed = true; silence(false); close(); seenEvents.clear(); seenObjects = new WeakSet();
    for (const [target, type, handler] of listeners) ignoreFailure(() => target?.removeEventListener(type, handler));
  }
  for (const [target, type, handler] of listeners) ignoreFailure(() => target?.addEventListener(type, handler));
  return { unlock, update, setPaused, setMuted, dispose };
}
