// Existing real-main/UI/input/world/simulation harness, unchanged fake DOM/GPU/audio/RAF.
// No new harness, native browser claim, terminal override or production change.
import test from 'node:test';
import assert from 'node:assert/strict';
import {boot, action} from './main-entry-harness.mjs';
import {createUI} from '../src/campaign-ui.js';
import {createGame} from '../src/campaign-simulation.js';
import {getCraftedMission} from '../src/content/crafted20/index.js';
import {makeDOM} from './input-dom.mjs';

const entries = ['showcase-flank', 'showcase-escort', 'showcase-breach'];
function key(app, code, fields = {}) {
  return app.window.dispatch('keydown', {code, repeat: false, target: app.document.activeElement, ...fields});
}

const reloadModifiers = [
  ['Ctrl+R', {ctrlKey:true}], ['Cmd+R', {metaKey:true}],
  ['Ctrl+Shift+R', {ctrlKey:true,shiftKey:true}], ['Cmd+Shift+R', {metaKey:true,shiftKey:true}],
  ['Alt+R', {altKey:true}],
];
for (const slug of entries) {
  for (const [name, modifiers] of reloadModifiers.slice(2)) test(`${slug}: ${name} leaves paused state and browser default untouched`, async t => {
    const app = await pausedRun(slug); t.after(() => app.dispose());
    const before = app.latest.state, creates = app.metrics.worldCreates;
    const event = key(app, 'KeyR', modifiers);
    t.diagnostic(JSON.stringify({slug, name, beforeTick:before.tick, afterTick:app.latest.state.tick, phase:app.latest.state.phase, worldCreates:app.metrics.worldCreates, defaultPrevented:Boolean(event.defaultPrevented)}));
    assert.equal(app.latest.state, before, `${name} must not replace the paused run`);
    assert.equal(Boolean(event.defaultPrevented), false);
    assert.equal(app.metrics.worldCreates, creates);
  });
  test(`${slug}: Shift+R retains existing Retry behavior`, async t => {
    const app = await pausedRun(slug); t.after(() => app.dispose());
    const creates = app.metrics.worldCreates, storage = JSON.stringify([...app.storage.values]);
    const event = key(app, 'KeyR', {shiftKey:true});
    assert.equal(event.defaultPrevented, true);
    assert.equal(app.latest.state.phase, 'briefing');
    assert.equal(app.latest.state.tick, 0);
    assert.equal(app.metrics.worldCreates, creates + 1);
    assert.equal(JSON.stringify([...app.storage.values]), storage);
  });
}

// UI-only phase fixtures explicitly test action routing; these are not gameplay wins/losses.
for (const phase of ['won', 'lost']) test(`${phase} UI: modified R never calls Retry; bare/Shift R do, repeats and edits do not`, t => {
  const dom = makeDOM(), spec = getCraftedMission('crafted20-002'); let retries = 0;
  const ui = createUI({...dom, retry:()=>retries++}); t.after(() => ui.dispose());
  ui.render({...createGame(spec), phase}, spec, {unlockedIds:[spec.id]}, {launchMode:'independent'});
  for (const [name, modifiers] of reloadModifiers) {
    const event = dom.window.dispatch('keydown', {code:'KeyR', target:dom.document.activeElement, ...modifiers});
    assert.equal(retries, 0, `${name} must not route to Retry in ${phase}`);
    assert.equal(Boolean(event.defaultPrevented), false);
  }
  for (const modifiers of [{}, {shiftKey:true}]) {
    const event = dom.window.dispatch('keydown', {code:'KeyR', target:dom.document.activeElement, ...modifiers});
    assert.equal(event.defaultPrevented, true);
  }
  assert.equal(retries, 2);
  for (const fields of [{repeat:true}, {target:dom.document.createElement('input')}, {target:{isContentEditable:true}}]) {
    const event = dom.window.dispatch('keydown', {code:'KeyR', ...fields});
    assert.equal(retries, 2);
    assert.equal(Boolean(event.defaultPrevented), false);
  }
});
for (const phase of ['briefing', 'playing']) test(`${phase} UI keeps every R chord outside Retry scope`, t => {
  const dom = makeDOM(), spec = getCraftedMission('crafted20-002'); let retries = 0;
  const ui = createUI({...dom, retry:()=>retries++}); t.after(() => ui.dispose());
  ui.render({...createGame(spec), phase}, spec, {unlockedIds:[spec.id]});
  for (const [,modifiers] of [['bare',{}],['Shift',{shiftKey:true}],...reloadModifiers]) {
    const event = dom.window.dispatch('keydown', {code:'KeyR', ...modifiers});
    assert.equal(retries, 0);
    assert.equal(Boolean(event.defaultPrevented), false);
  }
});

for (const modifier of ['ctrlKey', 'metaKey']) test(`graphics-loss notice: ${modifier}+R preserves browser default without game Retry or clearing recovery`, async t => {
  const app = await boot('?sortie=showcase-flank'); t.after(() => app.dispose());
  action(app, 'start').dispatch('click'); app.frame();
  app.canvas.dispatch('webglcontextlost');
  assert.equal(app.latest.state.phase, 'paused'); assert.equal(app.help.hidden, false);
  const state = app.latest.state, creates = app.metrics.worldCreates, notice = app.help.textContent;
  const event = key(app, 'KeyR', {[modifier]:true});
  t.diagnostic(JSON.stringify({modifier, beforeTick:state.tick, afterTick:app.latest.state.tick, phase:app.latest.state.phase, worldCreates:app.metrics.worldCreates, defaultPrevented:Boolean(event.defaultPrevented), helpHidden:app.help.hidden}));
  assert.equal(app.latest.state, state, 'browser reload must not become in-game Retry during graphics loss');
  assert.equal(Boolean(event.defaultPrevented), false);
  assert.equal(app.metrics.worldCreates, creates);
  assert.equal(app.help.hidden, false); assert.equal(app.help.textContent, notice);
  app.frame(); assert.equal(app.latest.state.tick, state.tick);
  assert.equal(app.metrics.inputEnabled, false); assert.equal(app.metrics.audioPaused, true);
});
async function pausedRun(slug) {
  const app = await boot(`?sortie=${slug}`);
  action(app, 'start').dispatch('click');
  key(app, 'KeyW');
  for (let i = 0; i < 60; i++) app.frame();
  key(app, 'Escape');
  assert.equal(app.latest.state.phase, 'paused');
  assert.ok(app.latest.state.tick > 0);
  assert.equal(app.document.activeElement, action(app, 'resume'));
  return app;
}

for (const slug of entries) {
  for (const modifier of ['ctrlKey', 'metaKey']) {
    test(`${slug}: ${modifier}+R must not consume browser reload or silently Retry the paused run`, async t => {
      const app = await pausedRun(slug);
      t.after(() => app.dispose());
      const before = {phase: app.latest.state.phase, tick: app.latest.state.tick, worldCreates: app.metrics.worldCreates};
      const state = app.latest.state;
      const storage = JSON.stringify([...app.storage.values]);
      const event = key(app, 'KeyR', {[modifier]: true});
      const after = {phase: app.latest.state.phase, tick: app.latest.state.tick, worldCreates: app.metrics.worldCreates};
      t.diagnostic(JSON.stringify({slug, modifier, before, after, defaultPrevented: Boolean(event.defaultPrevented), storageUnchanged: JSON.stringify([...app.storage.values]) === storage}));
      assert.equal(app.latest.state, state, 'modified browser reload must not call game Retry and replace the paused run');
      assert.equal(event.defaultPrevented, undefined, 'browser reload shortcut should retain its native default');
      assert.equal(app.metrics.worldCreates, before.worldCreates);
      assert.equal(JSON.stringify([...app.storage.values]), storage);
    });
  }
  test(`${slug}: unmodified R still performs the existing explicit Retry`, async t => {
    const app = await pausedRun(slug);
    t.after(() => app.dispose());
    const creates = app.metrics.worldCreates, storage = JSON.stringify([...app.storage.values]);
    const event = key(app, 'KeyR');
    assert.equal(event.defaultPrevented, true);
    assert.equal(app.latest.state.phase, 'briefing');
    assert.equal(app.latest.state.tick, 0);
    assert.equal(app.metrics.worldCreates, creates + 1);
    assert.equal(JSON.stringify([...app.storage.values]), storage);
  });
}
