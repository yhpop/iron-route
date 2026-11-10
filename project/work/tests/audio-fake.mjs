import assert from 'node:assert/strict';
// WebAudio boundary double adapted from tests/audio.test.mjs. Not an audible/browser test.
class FakeParam {
  constructor(value = 0, clock = () => 0) { this.intrinsic = value; this.clock = clock; this.calls = []; this.events = []; }
  get value() { return this.at(this.clock()); }
  set value(value) { this.intrinsic = value; this.setValueAtTime(value, this.clock()); }
  at(time) {
    let value = this.intrinsic, previousTime = 0, target;
    const targetValue = at => target.value + (target.from - target.value) * Math.exp(-(at - target.time) / target.constant);
    for (const event of this.events) {
      if (time < event.time) {
        if (target) return targetValue(time);
        if (event.method === 'ramp' && event.time > previousTime) return value + (event.value - value) * (time - previousTime) / (event.time - previousTime);
        return value;
      }
      if (target) value = targetValue(event.time);
      if (event.method === 'target') target = { ...event, from: value };
      else { value = event.value; target = undefined; }
      previousTime = event.time;
    }
    return target ? targetValue(time) : value;
  }
  record(method, value, time, constant) {
    assert.ok(Number.isFinite(value), `${method}: finite value`);
    assert.ok(Number.isFinite(time) && time >= 0, `${method}: valid audio time`);
    if (constant !== undefined) assert.ok(constant > 0 && Number.isFinite(constant));
    const event = { method, value, time, constant };
    this.calls.push(event); this.events.push(event); this.events.sort((a, b) => a.time - b.time);
  }
  setValueAtTime(value, time) { this.record('set', value, time); }
  linearRampToValueAtTime(value, time) { this.record('ramp', value, time); }
  setTargetAtTime(value, time, constant) { this.record('target', value, time, constant); }
  cancelScheduledValues(time) {
    assert.ok(Number.isFinite(time) && time >= 0);
    this.events = this.events.filter(event => event.time < time);
    if (this.events.at(-1)?.method === 'target') this.events.pop();
  }
}
class FakeNode {
  constructor() { this.connections = new Set(); }
  connect(node) { assert.ok(node); this.connections.add(node); return node; }
  disconnect() { this.connections.clear(); }
}
class FakeOscillator extends FakeNode {
  constructor(context) { super(); this.context = context; this.frequency = new FakeParam(440, () => context.currentTime); this.started = false; this.stopAt = Infinity; this.onended = null; }
  start(time = 0) { assert.equal(this.started, false); assert.ok(time >= 0); this.started = true; this.startAt = time; this.startFrequency = this.frequency.value; }
  stop(time = 0) { assert.equal(this.started, true); assert.ok(time >= 0); this.stopAt = time; }
}
export class FakeContext extends EventTarget {
  constructor() {
    super(); this.state = 'suspended'; this.currentTime = 0; this.destination = new FakeNode();
    this.oscillators = []; this.buffers = []; this.sources = []; this.filters = []; this.sampleRate = 8000; this.gains = []; this.resumeCalls = 0; this.suspendCalls = 0; this.closeCalls = 0;
  }
  createGain() { const node = new FakeNode(); node.gain = new FakeParam(1, () => this.currentTime); this.gains.push(node); return node; }
  createOscillator() { const node = new FakeOscillator(this); this.oscillators.push(node); return node; }
  createBuffer(channels, length, sampleRate) { const buffer = { channels, length, sampleRate, data: new Float32Array(length), getChannelData() { return this.data; } }; this.buffers.push(buffer); return buffer; }
  createBufferSource() { const node = new FakeOscillator(this); node.playbackRate = new FakeParam(1, () => this.currentTime); this.sources.push(node); return node; }
  createBiquadFilter() { const node = new FakeNode(); node.frequency = new FakeParam(350, () => this.currentTime); node.Q = new FakeParam(1, () => this.currentTime); this.filters.push(node); return node; }
  get allSources() { return [...this.oscillators, ...this.sources]; }
  changeState(state) { this.state = state; this.dispatchEvent(new Event('statechange')); }
  resume() { this.resumeCalls++; this.changeState('running'); return Promise.resolve(); }
  suspend() { this.suspendCalls++; this.changeState('suspended'); return Promise.resolve(); }
  close() { this.closeCalls++; this.changeState('closed'); return Promise.resolve(); }
  advance(seconds) {
    if (this.state !== 'running') return;
    this.currentTime += seconds;
    for (const node of this.allSources) {
      if (!node.ended && node.stopAt <= this.currentTime) { node.ended = true; node.onended?.(); }
    }
  }
  get connectedVoices() { return this.allSources.filter(node => node.connections.size); }
}
export class PageTarget extends EventTarget {
  constructor() { super(); this.hidden = false; this.listeners = new Set(); }
  addEventListener(type, handler) { super.addEventListener(type, handler); this.listeners.add(handler); }
  removeEventListener(type, handler) { super.removeEventListener(type, handler); this.listeners.delete(handler); }
}
