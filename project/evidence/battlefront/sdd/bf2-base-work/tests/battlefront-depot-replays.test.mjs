import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync, gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {dirname, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createBattlefrontDepotFront} from '../src/battlefront-depot-front.js';
import {withPlayerVehicle} from '../src/player-vehicles-v3.js';
import {playerBody} from '../src/player-config.js';

const evidence = new URL('../../evidence/battlefront/bf1/', import.meta.url);
const workRoot = fileURLToPath(new URL('../', import.meta.url));
const read = path => JSON.parse(fs.readFileSync(new URL(path, evidence)));
const unzip = bytes => JSON.parse(gunzipSync(bytes));
const zip = path => unzip(fs.readFileSync(new URL(path, evidence)));
const hash = value => createHash('sha256')
  .update(Buffer.isBuffer(value) || typeof value === 'string' ? value : JSON.stringify(value))
  .digest('hex');
const hostileIds = ['road-gun', 'hostile-flanker'];
const currentSpec = withPlayerVehicle(createBattlefrontDepotFront().spec, 'sandfalcon');

// Discover the complete current physical closure, rather than accepting 31 arbitrary keys.
function physicalClosure() {
  const files = new Set();
  function visit(file) {
    if (files.has(file)) return;
    files.add(file);
    const source = fs.readFileSync(resolve(workRoot, file), 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
      visit(relative(workRoot, resolve(workRoot, dirname(file), match[1])));
    }
  }
  for (const root of [
    'src/battlefront-depot-front.js',
    'src/ruined-depot-world-accelerated.js',
    'src/player-vehicles-v3.js',
    'src/campaign-simulation.js',
  ]) visit(root);
  return Object.fromEntries([...files].sort().map(file => [
    file, fs.readFileSync(resolve(workRoot, file), 'utf8'),
  ]));
}

const currentSources = physicalClosure();
const currentHashes = Object.fromEntries(
  Object.entries(currentSources).map(([file, source]) => [file, hash(source)]),
);

function assertCurrentIdentity(raw) {
  assert.equal(raw.missionId, currentSpec.id);
  assert.deepEqual(raw.spec, currentSpec, 'diagnostic spec must be current');
  assert.equal(raw.specHash, hash(currentSpec));
  assert.deepEqual(raw.sourceSnapshot, currentSources, 'entire current physical closure');
  assert.deepEqual(raw.sourceHashes, currentHashes, 'all physical source hashes');
  assert.deepEqual(raw.finalState.mission, currentSpec);
  assert.equal(raw.finalHash, hash(raw.finalState));
  assert.equal(raw.inputs, raw.runs.reduce((sum, run) => sum + run.n, 0));
  assert.deepEqual(raw.runs[0], {n: 1, input: {start: true}});
}

const diagnosticFiles = {
  crossfire: {
    path: 'qa/battlefront-depot/v03-crossfire-result.json.gz',
    sha256: 'd75f4574826cdc3b10d6a1704ae4dc0b2bf9309462e2e2accae46c15fc6c7180',
  },
  cover: {
    path: 'qa/battlefront-depot/v03-cover-retreat-01-result.json.gz',
    sha256: '546f3665e6e8a567bc30f8948034ff785f89078355ae20899feff711aeec56dc',
  },
};

function loadDiagnostic(kind) {
  const bytes = fs.readFileSync(resolve(workRoot, diagnosticFiles[kind].path));
  return {bytes, raw: unzip(bytes)};
}

function assertDiagnosticIdentity(kind, artifact) {
  assert.equal(hash(artifact.bytes), diagnosticFiles[kind].sha256, 'frozen raw byte digest');
  assert.deepEqual(artifact.raw, unzip(artifact.bytes), 'parsed data belongs to those bytes');
  assertCurrentIdentity(artifact.raw);
}

for (const route of ['direct', 'covered']) {
  test(`actual ${route} convoy win binds full spec/source closure and complete independent generated evidence`, () => {
    const raw = zip(`route-qa/sandfalcon-${route}-result.json.gz`);
    const verification = read(`route-qa/sandfalcon-${route}-independent.json`);
    assertCurrentIdentity(raw);
    assert.equal(raw.finalState.phase, 'won');
    assert.equal(raw.finalState.selectedConvoyChoiceId, route);
    const supply = raw.finalState.entities.supply;
    assert.ok(supply.hp > 0 && supply.alive && supply.arrived);
    assert.equal(verification.fullEvidenceExact, true);
    assert.equal(verification.harnessSHA256,
      hash(fs.readFileSync(resolve(workRoot, 'scripts/battlefront-replay.mjs'))));
    const fresh = unzip(fs.readFileSync(resolve(workRoot, verification.generatedEvidenceFile)));
    assert.deepEqual(fresh, raw, 'ENTIRE result, not a subset or repaired state');
  });
}

function shotRecords(raw) {
  return raw.frames.flatMap(frame => frame.events
    .filter(event => event.type === 'shot' && hostileIds.includes(event.entityId))
    .map(event => {
      assert.deepEqual(event, raw.events.find(item => item.id === event.id));
      return {
        tick: frame.tick,
        owner: event.entityId,
        origin: event.position,
        player: frame.player,
        bearing: Math.atan2(event.position.x - frame.player.x, event.position.z - frame.player.z),
        projectiles: frame.projectiles,
        entities: Object.fromEntries(hostileIds.map(id => [id, {
          alive: frame.entities[id].alive,
          targetId: frame.entities[id].targetId,
          status: frame.entities[id].status,
        }])),
      };
    }));
}

function deriveCrossfire(raw) {
  let pair = null;
  for (const a of shotRecords(raw)) {
    for (const b of shotRecords(raw)) {
      if (a.owner === b.owner || Math.abs(a.tick - b.tick) > 120 ||
          JSON.stringify(a.player) !== JSON.stringify(b.player)) continue;
      const degrees = Math.abs(Math.atan2(
        Math.sin(a.bearing - b.bearing), Math.cos(a.bearing - b.bearing),
      )) * 180 / Math.PI;
      if (!pair || degrees > pair.degrees) pair = {a, b, degrees};
    }
  }
  assert.ok(pair && pair.degrees >= 45, 'actual shot-origin bearings at identical player pose');
  for (const record of [pair.a, pair.b]) {
    for (const id of hostileIds) {
      assert.equal(record.entities[id].alive, true);
      assert.equal(record.entities[id].targetId, 'tank');
    }
  }
  const laterFrame = raw.frames.find(frame => frame.tick === Math.max(pair.a.tick, pair.b.tick));
  for (const record of [pair.a, pair.b]) {
    const shot = raw.events.find(event => event.type === 'shot' &&
      event.tick === record.tick && event.entityId === record.owner);
    const projectile = laterFrame.projectiles.find(item => item.id === shot.projectileId);
    assert.equal(projectile?.ownerId, record.owner, 'both actual shot projectiles coexist');
    const impact = raw.events.find(event => event.type === 'impact' &&
      event.projectileId === shot.projectileId && event.targetId === 'tank' && event.value === 'hit');
    assert.ok(impact && impact.tick > shot.tick && impact.tick - shot.tick <= 120);
    const damage = raw.events.find(event => event.type === 'damaged' &&
      event.tick === impact.tick && event.entityId === record.owner && event.targetId === 'tank');
    assert.ok(damage?.value > 0, 'selected real projectile is followed by player damage');
    const damageFrame = raw.frames.find(frame => frame.tick === damage.tick);
    assert.deepEqual(damageFrame.player, record.player);
    assert.ok(damageFrame.events.some(event => event.id === damage.id));
  }
  const overlappingActualHostileProjectiles = raw.frames.filter(frame => new Set(
    frame.projectiles.filter(projectile => hostileIds.includes(projectile.ownerId))
      .map(projectile => projectile.ownerId),
  ).size === 2).map(frame => ({
    tick: frame.tick, player: frame.player, projectiles: frame.projectiles, hostiles: frame.sight,
  }));
  assert.ok(overlappingActualHostileProjectiles.length > 0);
  return {pair, overlappingActualHostileProjectiles};
}

function assertCrossfireEvidence(summary, artifact) {
  assertDiagnosticIdentity('crossfire', artifact);
  const raw = artifact.raw;
  const derived = deriveCrossfire(raw);
  assert.deepEqual(summary, {
    boundary: 'Read-only analysis of already saved full input-only raw evidence; failed/incomplete cover retreats are not waived',
    attempt: 'v03-crossfire',
    rawSHA256: hash(artifact.bytes),
    specHash: raw.specHash,
    sourceHashes: raw.sourceHashes,
    pair: derived.pair,
    overlapTicks: raw.engagements.length,
    overlappingActualHostileProjectiles: derived.overlappingActualHostileProjectiles,
    alliedEnemyDamage: raw.events.filter(event => event.type === 'damaged' &&
      (event.entityId === 'allied-support' || event.targetId === 'allied-support')),
    damage: raw.events.filter(event => event.type === 'damaged'),
    phase: raw.finalState.phase,
    playerHp: raw.finalState.tankCombat.hp,
    truckHp: raw.finalState.entities.supply.hp,
  }, 'complete summary must be derived from bound raw, not trusted');
}

function close(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) <= 1e-8, `${label}: ${actual} != ${expected}`);
}

function assertHitOnRecordedSegment(record) {
  const hit = record.hit;
  if (!hit) return;
  assert.ok(hit.fraction >= 0 && hit.fraction <= 1);
  const length = Math.hypot(...['x', 'y', 'z'].map(axis => record.to[axis] - record.from[axis]));
  close(hit.distance, length * hit.fraction, 'ray distance');
  for (const axis of ['x', 'y', 'z']) {
    close(hit.point[axis], record.from[axis] +
      (record.to[axis] - record.from[axis]) * hit.fraction, 'hit point ' + axis);
  }
}

function deriveCover(raw) {
  const records = raw.coverInspection;
  assert.equal(records.length, raw.inputs);
  const aimHeight = playerBody(raw.spec).aimHeight;
  const road = raw.spec.entities.find(entity => entity.id === 'road-gun');
  const cover = raw.spec.geometry.find(collider => collider.id === 'scorched-east-cover');
  const transitions = [];
  let previous = null;
  for (const [index, record] of records.entries()) {
    assert.equal(record.tick, index, 'one exact cover inspection per literal input');
    assert.equal(record.enemy.id, road.id);
    assert.equal(record.enemy.range, road.range);
    assert.deepEqual(record.from, {
      x: record.enemy.pose.x, y: record.enemy.pose.y + 1.3, z: record.enemy.pose.z,
    }, 'production turret LOS origin');
    assert.deepEqual(record.to, {
      x: record.player.x, y: record.player.y + aimHeight, z: record.player.z,
    }, 'production resolved player aim height');
    const distance = Math.hypot(...['x', 'y', 'z'].map(axis => record.to[axis] - record.from[axis]));
    assert.equal(record.inRange, distance <= road.range, 'production THREE-dimensional range');
    assertHitOnRecordedSegment(record);
    if (record.hit?.id === cover.id) {
      close(record.hit.point.y, record.hit.position.y, 'hit aliases');
      assert.ok(Math.abs(record.hit.point.x - cover.x) <= cover.width / 2 + 1e-8);
      assert.ok(Math.abs(record.hit.point.z - cover.z) <= cover.depth / 2 + 1e-8);
      assert.ok(record.hit.point.y >= cover.y - 1e-8 &&
        record.hit.point.y <= cover.y + cover.height + 1e-8, 'actual static cover bounds');
    }
    const frame = raw.frames.find(item => item.tick === record.tick);
    if (frame) {
      assert.deepEqual(record.player, frame.player);
      assert.deepEqual(record.enemy, frame.entities['road-gun']);
      assert.equal(record.hp, frame.playerHp);
    }
    if (previous && !previous.hit && record.hit && record.enemy.alive) {
      transitions.push({before: previous, after: record});
    }
    previous = record;
  }
  const blocked = records.filter(record => record.enemy.alive && record.inRange &&
    record.hit && ['scorched-east-cover', 'ruin-east-window', 'scan-east-entry'].includes(record.hit.id));
  assert.equal(blocked.length, 887);
  assert.equal(blocked[0].tick, 2231);
  assert.equal(blocked.at(-1).tick, 3117);
  for (const [index, record] of blocked.entries()) {
    assert.equal(record.tick, 2231 + index, 'exact contiguous cover interval');
    assert.equal(record.enemy.hp, 90);
    assert.equal(record.hit.id, 'scorched-east-cover');
    assert.equal(record.hp, 48);
  }
  assert.ok(transitions.length > 0);
  assert.ok(transitions.every(item => !item.after.inRange),
    'initial clear-to-blocked transitions are OUTSIDE range, not instant in-range disengagement');
  const lastClear = records.findLast(record => record.tick < blocked[0].tick &&
    record.inRange && !record.hit && record.enemy.targetId === 'tank');
  assert.equal(lastClear?.tick, 1370);
  assert.ok(raw.events.some(event => event.type === 'damaged' &&
    event.entityId === 'road-gun' && event.targetId === 'tank' && event.tick < lastClear.tick));
  return {transitions, blocked, lastClear};
}

function assertCoverEvidence(summary, artifact) {
  assertDiagnosticIdentity('cover', artifact);
  const raw = artifact.raw;
  const derived = deriveCover(raw);
  assert.deepEqual(summary, {
    missionSpecHash: raw.specHash,
    rawFile: 'work/' + diagnosticFiles.cover.path,
    boundary: 'Literal createGame and real input only; road remains alive/unmodified. Exact production origin+resolved player aimHeight LOS; no forced target, pose or health injection.',
    transitions: derived.transitions,
    firstInRangeMasonryBlocked: derived.blocked[0],
    lastInRangeMasonryBlocked: derived.blocked.at(-1),
    blockedInRangeTicks: derived.blocked.length,
    lastPriorLiveInRangeEngagedClear: derived.lastClear,
    damage: raw.events.filter(event => event.type === 'damaged'),
    shots: raw.events.filter(event => event.type === 'shot'),
    finalHp: raw.finalState.tankCombat.hp,
    truckHp: raw.finalState.entities.supply.hp,
  }, 'complete cover summary must derive from the bound raw inspection');
  assert.equal(raw.finalState.tankCombat.hp, 48);
  assert.equal(raw.finalState.entities.supply.hp, 100);
}

test('natural crossfire is bound to current raw bytes/spec/closure and actual shots/projectiles/damage', () => {
  assertCrossfireEvidence(read('v03-crossfire-analysis.json'), loadDiagnostic('crossfire'));
  const covered = zip('route-qa/sandfalcon-covered-result.json.gz');
  assertCurrentIdentity(covered);
  for (const [attacker, target] of [
    ['allied-support', 'hostile-flanker'], ['hostile-flanker', 'allied-support'],
  ]) {
    assert.ok(covered.events.some(event => event.type === 'damaged' &&
      event.entityId === attacker && event.targetId === target && event.value > 0));
  }
});

test('early retreat derives exact production-height/range static-cover interval from bound raw', () => {
  assertCoverEvidence(read('early-cover-retreat-analysis.json'), loadDiagnostic('cover'));
});

test('I1 mutation negatives reject edited summaries, stale raw bytes, stale specs and stale sources', () => {
  for (const [kind, summaryFile, validate] of [
    ['crossfire', 'v03-crossfire-analysis.json', assertCrossfireEvidence],
    ['cover', 'early-cover-retreat-analysis.json', assertCoverEvidence],
  ]) {
    const artifact = loadDiagnostic(kind);
    const summary = read(summaryFile);
    const editedSummary = structuredClone(summary);
    if (kind === 'crossfire') editedSummary.pair.degrees += 1;
    else editedSummary.blockedInRangeTicks += 1;
    assert.throws(() => validate(editedSummary, artifact), {name: 'AssertionError'});

    const staleRaw = structuredClone(artifact.raw);
    staleRaw.finalAction += ' stale';
    assert.throws(() => validate(summary, {
      raw: staleRaw, bytes: gzipSync(JSON.stringify(staleRaw)),
    }), {name: 'AssertionError'});

    const staleSpec = structuredClone(artifact.raw);
    staleSpec.spec.entities[0].hp += 1;
    staleSpec.specHash = hash(staleSpec.spec); // Even internally consistent stale spec is rejected.
    assert.throws(() => assertCurrentIdentity(staleSpec), {name: 'AssertionError'});

    const staleSource = structuredClone(artifact.raw);
    const file = 'src/combat.js';
    staleSource.sourceSnapshot[file] += '\n// stale source';
    staleSource.sourceHashes[file] = hash(staleSource.sourceSnapshot[file]);
    assert.throws(() => assertCurrentIdentity(staleSource), {name: 'AssertionError'});

    const missingSource = structuredClone(artifact.raw);
    delete missingSource.sourceSnapshot[file];
    delete missingSource.sourceHashes[file];
    assert.throws(() => assertCurrentIdentity(missingSource), {name: 'AssertionError'});
  }
});

test('I1 mutation negatives reject unsupported raw combat and incorrect cover query semantics', () => {
  const crossfire = loadDiagnostic('crossfire').raw;
  const missingProjectile = structuredClone(crossfire);
  const frame = missingProjectile.frames.find(item => item.tick === 867);
  frame.projectiles = frame.projectiles.filter(item => item.ownerId !== 'road-gun');
  assert.throws(() => deriveCrossfire(missingProjectile), {name: 'AssertionError'});

  const missingDamage = structuredClone(crossfire);
  missingDamage.events = missingDamage.events.filter(event =>
    !(event.type === 'damaged' && event.tick === 870 && event.entityId === 'road-gun'));
  assert.throws(() => deriveCrossfire(missingDamage), {name: 'AssertionError'});

  const cover = loadDiagnostic('cover').raw;
  const wrongAim = structuredClone(cover);
  wrongAim.coverInspection[2231].to.y += 0.1;
  assert.throws(() => deriveCover(wrongAim), {name: 'AssertionError'});

  const wrongRange = structuredClone(cover);
  wrongRange.coverInspection[2231].inRange = false;
  assert.throws(() => deriveCover(wrongRange), {name: 'AssertionError'});
});
