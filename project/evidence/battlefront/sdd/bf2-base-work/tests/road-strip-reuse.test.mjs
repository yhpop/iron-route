import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { createCampaignView } from '../src/campaign-view.js';
import { createCampaignView as baselineView } from '../qa/road-strip-reuse/baseline-campaign-view.mjs';
import { inspectView, isRoad, sha256 } from '../qa/road-strip-reuse/footprints.mjs';
import { listMissions } from '../src/content/index.js';
import { getOptionalMission, listOptionalMissions } from '../src/content/optional-records.js';

const evidenceUrl = new URL('../qa/road-strip-reuse/before.json', import.meta.url);
const baseline = JSON.parse(fs.readFileSync(evidenceUrl));
const specWith = routes => ({ bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, geometry: [], routes });
const route = (id = 'a', width = 4, points = [{ x: 0, z: 0 }, { x: 4, z: 8 }]) => ({ id, width, points });
function roadsIn(scene) { const roads = []; scene.traverse(node => { if (isRoad(node)) roads.push(node); }); return roads; }

// Catches removing the guard or keying by route identity instead of geometry.
test('identical ordered strips across separate routes allocate one road mesh', () => {
  const scene = new THREE.Scene(), spec = specWith([route('lead'), route('rear'), route('third')]);
  const original = structuredClone(spec), view = createCampaignView(scene, spec);
  try {
    assert.equal(roadsIn(scene).length, 1);
    assert.deepEqual(spec, original, 'route arrays, order and metadata are not edited');
  } finally { view.dispose(); }
});

// Catches a global cache that accidentally drops roads from another scene.
test('road reuse is local to each view, including simultaneous views', () => {
  const a = new THREE.Scene(), b = new THREE.Scene(), spec = specWith([route()]);
  const first = createCampaignView(a, spec), second = createCampaignView(b, spec);
  try {
    assert.equal(roadsIn(a).length, 1);
    assert.equal(roadsIn(b).length, 1);
    assert.notEqual(roadsIn(a)[0].geometry, roadsIn(b)[0].geometry);
  } finally { first.dispose(); second.dispose(); }
});

// Catches a cache reset per route, and a key that normalizes endpoint order.
test('repeated segments within one route reuse only the matching direction', () => {
  const a = { x: 0, z: 0 }, b = { x: 4, z: 8 };
  const actual = inspectView(createCampaignView, specWith([route('loop', 4, [a, b, a, b])]));
  assert.equal(actual.road.length, 2, 'forward and reversed strips remain distinct');
});

// Catches rounding/tolerance keys in each of the five numeric fields.
test('nearby widths and each nearby ordered endpoint coordinate are not merged', () => {
  const base = route();
  const variants = [route('near-width', 4 + Number.EPSILON * 4), ...['x', 'z'].flatMap(axis => [0, 1].map(point => {
    const changed = structuredClone(base);
    changed.id = `near-${point}-${axis}`;
    changed.points[point][axis] += Number.EPSILON * 8;
    return changed;
  }))];
  const actual = inspectView(createCampaignView, specWith([base, ...variants]));
  assert.equal(actual.road.length, 6);
  assert.deepEqual(actual.road, inspectView(baselineView, specWith([base, ...variants])).road);
});

// Catches overlap/collinearity merging, width omission or zero-length filtering.
test('different widths, reversed, overlapping and zero-length strips remain authored', () => {
  const spec = specWith([
    route(), route('wide', 5), route('reverse', 4, [{ x: 4, z: 8 }, { x: 0, z: 0 }]),
    route('overlap', 4, [{ x: 2, z: 4 }, { x: 6, z: 12 }]),
    route('point', 4, [{ x: 1, z: 1 }, { x: 1, z: 1 }]),
    route('zero-width', 0), route('negative-width', -4)
  ]);
  const actual = inspectView(createCampaignView, spec);
  assert.equal(actual.road.length, 7);
  assert.deepEqual(actual.road, inspectView(baselineView, spec).road);
});

// atan2(-0, negative) is -PI, not +PI: plain JSON/Set number keys lose this.
test('signed-zero endpoint differences that change rotation remain distinct', () => {
  const spec = specWith([
    route('negative-pi', 4, [{ x: 0, z: 0 }, { x: -0, z: -4 }]),
    route('positive-pi', 4, [{ x: -0, z: 0 }, { x: 0, z: -4 }])
  ]);
  const scene = new THREE.Scene(), view = createCampaignView(scene, spec);
  try {
    assert.deepEqual(roadsIn(scene).map(road => road.rotation.y), [-Math.PI, Math.PI]);
    assert.deepEqual(inspectView(createCampaignView, spec).road, inspectView(baselineView, spec).road);
  } finally { view.dispose(); }
});

test('signed-zero width is conservatively kept distinct', () => {
  const spec = specWith([route('positive', 0), route('negative', -0)]);
  assert.equal(inspectView(createCampaignView, spec).road.length, 2);
});

// Catches JSON null collisions and changes to the old handling of invalid data.
test('non-finite, undefined and non-numeric width or coordinates bypass reuse', () => {
  for (const field of ['width', 'ax', 'az', 'bx', 'bz']) {
    for (const value of [undefined, NaN, Infinity, -Infinity, null, '4']) {
      const invalid = route();
      if (field === 'width') invalid.width = value;
      else invalid.points[field[0] === 'a' ? 0 : 1][field[1]] = value;
      const spec = specWith([invalid, structuredClone(invalid)]);
      const actual = inspectView(createCampaignView, spec);
      assert.equal(actual.road.length, 2, `${field}=${String(value)} is not a reuse candidate`);
      assert.deepEqual(actual.road, inspectView(baselineView, spec).road);
    }
  }
});

// Catches allocation-then-removal "optimizations", leaks and double disposal.
// These observers call the real Three methods; no renderer/constructor is faked.
test('discarded duplicates are never allocated and all created resources dispose once', t => {
  const geometries = new Map(), materials = new Map(), restore = [];
  function observe(prototype, name, records) {
    const original = prototype[name];
    prototype[name] = function (...args) {
      if (!records.has(this)) {
        const record = { disposals: 0 }; records.set(this, record);
        this.addEventListener('dispose', () => record.disposals++);
      }
      return original.apply(this, args);
    };
    restore.push(() => { prototype[name] = original; });
  }
  observe(THREE.BufferGeometry.prototype, 'setIndex', geometries);
  observe(THREE.BufferGeometry.prototype, 'setAttribute', geometries);
  observe(THREE.Material.prototype, 'setValues', materials);
  let view;
  try {
    const spec = specWith([route('one'), route('two'), route('three')]);
    spec.zones = [{ id: 'exit', polygon: [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 2 }] }];
    spec.objectives = [{ id: 'goal', type: 'reach', zoneId: 'exit' }];
    const scene = new THREE.Scene();
    view = createCampaignView(scene, spec);
    const fxGeometries = new Set(), fxMaterials = new Set();
    scene.getObjectByName('combat-fx').traverse(o => { if (o.geometry) fxGeometries.add(o.geometry); if (o.material) fxMaterials.add(o.material); });
    const initialGeometries = geometries.size, initialMaterials = materials.size;
    assert.equal(geometries.size - fxGeometries.size, 3, 'only ground, one road and zone line are constructed outside the bounded FX pool');
    assert.equal(materials.size - fxMaterials.size, 10, 'original eight shared, ground and zone materials outside FX');
    view.update({ objectiveStates: { goal: { status: 'active' } }, projectiles: [
      { id: 'shot', faction: 'player', position: { x: 1, y: 2, z: 3 } }
    ] }, [{ type: 'impact', position: { x: 1, z: 2 } }], .01);
    assert.equal(geometries.size, initialGeometries + 1, 'only the objective marker allocates; projectile/effect resources are pooled');
    assert.equal(materials.size, initialMaterials + 1, 'only one objective material allocates');
    view.update({ projectiles: [] }, [], 1);
    assert.equal([...geometries.values()].filter(record => record.disposals === 1).length, 0, 'pooled transient geometry is retained until view disposal');
    view.dispose(); view = undefined;
    assert.ok([...geometries.values()].every(record => record.disposals === 1));
    assert.ok([...materials.values()].every(record => record.disposals === 1));
    let createdGeometries = geometries.size, createdMaterials = materials.size;
    for (const spec of [...listMissions(), ...listOptionalMissions().map(({ spec }) => spec)]) {
      geometries.clear(); materials.clear();
      const scene = new THREE.Scene(), before = baseline.worlds.find(world => world.id === spec.id);
      view = createCampaignView(scene, spec);
      assert.equal(geometries.size - fxGeometries.size, before.geometries - before.road.length + before.uniqueRoad.length,
        `${spec.id}: no discarded road geometry was constructed`);
      view.dispose(); view = undefined;
      assert.equal(scene.children.length, 0, `${spec.id}: root detached`);
      assert.ok([...geometries.values()].every(record => record.disposals === 1), `${spec.id}: each allocated geometry disposed once`);
      assert.ok([...materials.values()].every(record => record.disposals === 1), `${spec.id}: each allocated material disposed once`);
      createdGeometries += geometries.size; createdMaterials += materials.size;
    }
    t.diagnostic(JSON.stringify({ checkedViews: 306, createdGeometries, createdMaterials, disposalCountPerResource: 1 }));
  } finally { view?.dispose(); for (const reset of restore.reverse()) reset(); }
});

test('mission-003 removes exactly two road meshes and 24 repeated triangles', () => {
  const spec = listMissions().find(spec => spec.id === 'mission-003');
  const before = inspectView(baselineView, spec), after = inspectView(createCampaignView, spec);
  assert.equal(before.road.length - after.road.length, 2);
  assert.equal(before.triangles - after.triangles, 24);
});

test('warehouse-fork keeps ten unique roads instead of twenty opaque strips', () => {
  const spec = getOptionalMission('warehouse-fork');
  const before = inspectView(baselineView, spec), after = inspectView(createCampaignView, spec);
  assert.equal(before.road.length, 20);
  assert.equal(after.road.length, 10);
  assert.equal(before.meshes - after.meshes, 10);
  assert.equal(before.triangles - after.triangles, 120);
});

test('immutable pre-edit fixture and all 305 content/route JSON byte hashes stay intact', () => {
  assert.equal(sha256(fs.readFileSync(new URL('../qa/road-strip-reuse/baseline-campaign-view.mjs', import.meta.url))),
    '20dc3bcd18fafa312042b5be3f1d171a81d8081f7b6942c5c5aa3b86a370b343');
  assert.equal(sha256(fs.readFileSync(evidenceUrl)), 'fa21bfb5e4c436c534959936ce20b5f6b2e4efba64fd81be644a87f67edfa205');
  const specs = [...listMissions(), ...listOptionalMissions().map(({ spec }) => spec)];
  assert.equal(specs.length, 305);
  assert.deepEqual(specs.map(spec => ({ id: spec.id, contentJsonSha256: sha256(JSON.stringify(spec)),
    routesJsonSha256: sha256(JSON.stringify(spec.routes ?? [])) })), baseline.content);
  for (const { path, sha256: expected } of baseline.contentFiles) {
    assert.equal(sha256(fs.readFileSync(new URL(`../${path}`, import.meta.url))), expected, path);
  }
});

// Independent oracle: execute immutable old view and current view with the same
// Three, compare actual world vertices/materials/flags; no route-derived key.
test('all 305 scenes preserve unique world footprints and every non-combat non-road drawable', () => {
  const unexpected = [];
  for (const spec of [...listMissions(), ...listOptionalMissions().map(({ spec }) => spec)]) {
    const before = inspectView(baselineView, spec), after = inspectView(createCampaignView, spec);
    assert.deepEqual(after.uniqueRoad, before.uniqueRoad, `${spec.id}: road vertices, attributes, material and flags`);
    assert.deepEqual(after.other, before.other, `${spec.id}: static non-road drawables including multiplicity (combat has independent regression tests)`);
    assert.equal(after.materials, before.materials, `${spec.id}: shared material count`);
    if (after.road.length !== before.uniqueRoad.length) unexpected.push({ id: spec.id,
      expected: before.uniqueRoad.length, actual: after.road.length });
    const removed = before.road.length - after.road.length;
    assert.equal(before.meshes - after.meshes, removed);
    assert.equal(before.geometries - after.geometries, removed);
    assert.equal(before.triangles - after.triangles, removed * 12);
  }
  assert.deepEqual(unexpected, [], 'every exact duplicate is suppressed, not just nominated missions');
});
