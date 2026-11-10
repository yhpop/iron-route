import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {deserialize} from 'node:v8';
import {checkedBytes, verifyFileHashes, assertRuntime, validateTape} from '../lib/evidence.mjs';
import {assertVictory, assertFrameEvents, assertExpectedResult} from '../lib/invariants.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/manifest.json')));
const definition = manifest.routes.find(r => r.route === 'tiger-east');
const tape = JSON.parse(gunzipSync(fs.readFileSync(path.join(root, definition.files.tape.path))));
const old = JSON.parse(gunzipSync(fs.readFileSync(path.join(root, 'project/work/tests/fixtures/northern-staging/tiger-east.json.gz'))));
const expected = deserialize(fs.readFileSync(path.join(root, definition.files.raw.path)));
const clone = structuredClone;

// Each mutation names the boundary break the guard must reject, not a mock's behavior.
test('changed file bytes fail the fixed SHA-256 check', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'route-hash-')); t.after(() => fs.rmSync(dir, {recursive:true}));
  fs.writeFileSync(path.join(dir, 'fixture'), 'abd');
  assert.throws(() => checkedBytes(dir, {path:'fixture', sha256:'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'}), /SHA-256 mismatch/);
});
test('matching file bytes are returned without normalization', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'route-hash-')); t.after(() => fs.rmSync(dir, {recursive:true}));
  fs.writeFileSync(path.join(dir, 'fixture'), 'abc');
  assert.deepEqual(checkedBytes(dir, {path:'fixture', sha256:'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'}), Buffer.from('abc'));
});
test('manifest paths cannot escape their declared root', () => {
  assert.throws(() => checkedBytes(root, {path:'../outside', sha256:'0'.repeat(64)}), /unsafe relative path/);
});
test('changed source or dependency fails before simulation', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'route-source-')); t.after(() => fs.rmSync(dir, {recursive:true}));
  fs.writeFileSync(path.join(dir, 'controller.js'), 'abd');
  assert.throws(() => verifyFileHashes(dir, {'controller.js':'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'}), /SHA-256 mismatch/);
});
test('unsupported Node version fails rather than silently normalizing V8 evidence', () => {
  assert.throws(() => assertRuntime(manifest, 'v22.0.0'), /Node version/);
});
test('valid original partial-prefix input is accepted', () => validateTape(tape, definition, old));
const tapeMutations = [
  ['zero run length', t => {t.runs[1].n = 0;}, /run length/],
  ['fractional run length', t => {t.runs[1].n = 1.5;}, /run length/],
  ['excessive run length', t => {t.runs[1].n = 1000000000;}, /run length/],
  ['missing declared input', t => {t.runs.pop();}, /input count/],
  ['saved-state injection', t => {t.runs[2].input.state = {phase:'won'};}, /ordinary input key/],
  ['nonfinite steering', t => {t.runs[2].input.steer = NaN;}, /finite.*steer/],
  ['out of range throttle', t => {t.runs[2].input.throttle = 2;}, /range.*throttle/],
  ['non-boolean fire', t => {t.runs[2].input.firePressed = 'true';}, /boolean.*firePressed/],
  ['nonfinite aim', t => {t.runs[2].input.aim = {worldPoint:{x:0,y:NaN,z:0}};}, /finite aim/],
  ['hidden aim property', t => {t.runs[2].input.aim = {worldPoint:{x:0,y:0,z:0}, teleport:true};}, /aim shape/],
  ['unknown convoy command', t => {t.runs[2].input.convoyOrder = 'teleport';}, /convoyOrder/],
  ['unknown governor', t => {t.runs[2].input.governor = 'warp';}, /governor/],
  ['changed time step', t => {t.dt = 1;}, /time step/],
  ['wrong vehicle', t => {t.vehicle = 'sandfalcon';}, /vehicle/],
  ['misreported old prefix', t => {t.prefix.inputs = 9543;}, /prefix count/],
  ['false full historical replay claim', t => {t.prefix.completeOldTapeConsumed = true;}, /complete old tape/],
  ['second start or resurrection', t => {t.runs[2].input.start = true;}, /start only once/],
  ['changed historical input', t => {t.runs[1].input.brake = false;}, /historical prefix/],
];
for (const [name, mutate, error] of tapeMutations) test('rejects ' + name, () => {
  const damaged = clone(tape); mutate(damaged);
  assert.throws(() => validateTape(damaged, definition, old), error);
});

test('real stored victory and complete ordered events satisfy escort contract', () => assertVictory(expected.finalState, expected.events, definition));
for (const [name, mutate, error] of [
  ['false victory', (s,e) => {s.phase='playing';}, /victory/],
  ['dead player', (s,e) => {s.tankCombat.hp=0;}, /player alive/],
  ['dead escort', (s,e) => {s.entities.supply.hp=0;}, /supply alive/],
  ['false arrival flag', (s,e) => {s.entities.supply.arrived=false;}, /arrived/],
  ['teleported destination claim', (s,e) => {s.entities.supply.pose.z=-31;}, /destination/],
  ['missing physical arrival event', (s,e) => {e.splice(e.findIndex(x=>x.type==='vehicle-arrived'),1);}, /one physical arrival/],
  ['premature mission completion', (s,e) => {const last=e.pop();e.unshift(last);}, /event order/],
  ['wrong route', (s,e) => {s.selectedConvoyChoiceId='covered';}, /selected route/],
]) test('rejects ' + name, () => {
  const data=clone(expected); mutate(data.finalState,data.events);
  assert.throws(() => assertVictory(data.finalState,data.events,definition),error);
});
test('JSON zero-sign loss is not accepted as lossless event equality', () => {
  const lossy=JSON.parse(JSON.stringify(expected));
  assert.throws(() => assertExpectedResult(lossy.finalState,lossy.events,expected), /entire.*events/);
});
test('full final-state drift fails even if victory and HP still match', () => {
  const changed=clone(expected); changed.finalState.entities.supply.pose.y+=0.01;
  assert.throws(() => assertExpectedResult(changed.finalState,changed.events,expected), /entire final state/);
});
const shot={id:'event-1',tick:1,type:'shot',entityId:'tank',projectileId:'p1'};
const impact={id:'event-2',tick:1,type:'impact',entityId:'tank',projectileId:'p1',targetId:'enemy',value:'hit'};
const damage={id:'event-3',tick:1,type:'damaged',entityId:'tank',targetId:'enemy',value:1};
function frame(events, projectiles=[]) {return {tick:1, events,projectiles, entities:{tank:{team:'allied'},enemy:{team:'hostile'}}};}
function tracker() {return {shots:new Map(),impacts:new Set(),eventIds:new Set(),lastTick:-1,damageChecks:0,projectileChecks:0,sameTickImpacts:0};}
// Synthetic event records test our audit contract, never stand in for the four real simulations.
test('same-tick shot and physical impact are valid even without a live end-frame projectile', () => {
  assertFrameEvents(frame([shot,impact,damage]),tracker(),() => true);
});
test('shot without a projectile or physical same-tick impact fails', () => {
  assert.throws(() => assertFrameEvents(frame([shot]),tracker(),() => true),/physical projectile/);
});
test('friendly damage fails even with a valid projectile chain', () => {
  assert.throws(() => assertFrameEvents(frame([shot,impact,damage]),tracker(),() => false),/friendly damage/);
});
test('damage without preceding physical impact fails', () => {
  assert.throws(() => assertFrameEvents(frame([shot,damage],[{id:'p1',ownerId:'tank'}]),tracker(),() => true),/damage.*impact/);
});
test('duplicate shot projectile IDs fail', () => {
  assert.throws(() => assertFrameEvents(frame([shot,{...shot,id:'event-2'}],[{id:'p1',ownerId:'tank'}]),tracker(),() => true),/duplicate projectile/);
});
test('duplicate event IDs fail', () => {
  assert.throws(() => assertFrameEvents(frame([shot,{...impact,id:'event-1'}]),tracker(),() => true),/duplicate event/);
});
test('impact and damage before the shot in the same tick fail causal ordering', () => {
  assert.throws(() => assertFrameEvents(frame([impact,damage,shot]),tracker(),() => true),/impact.*recorded shot/);
});
test('one projectile cannot cause two physical impact and damage chains', () => {
  assert.throws(() => assertFrameEvents(frame([shot,impact,damage,{...impact,id:'event-4'},{...damage,id:'event-5'}]),tracker(),() => true),/duplicate.*impact/);
});
test('live projectile with wrong owner cannot satisfy shot creation', () => {
  assert.throws(() => assertFrameEvents(frame([shot],[{id:'p1',ownerId:'enemy'}]),tracker(),() => true),/projectile owner/);
});
test('arrival event must agree with the supply position in its actual event frame', () => {
  const s=clone(expected.finalState);
  s.events=[clone(expected.events.find(e=>e.type==='vehicle-arrived'))];
  s.entities.supply.pose.z=10;
  assert.throws(() => assertFrameEvents(s,tracker(),() => true),/arrival frame position/);
});
test('arrival event must not claim a still-moving unarrived supply', () => {
  const s=clone(expected.finalState);
  s.events=[clone(expected.events.find(e=>e.type==='vehicle-arrived'))];
  s.entities.supply.arrived=false;s.entities.supply.status='moving';
  assert.throws(() => assertFrameEvents(s,tracker(),() => true),/arrival frame status/);
});
