import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeEntities, createCombatState, stepCombat } from '../src/combat.js';

const noWorld = { raycast: () => null, setDestroyed() {} };
function fixture({ geometry = [], entities = [] } = {}) {
  const mission = { geometry, entities };
  return { tick: 1, mission, tank: { pose: { x: 0, y: 0, z: 0, yaw: 0 } },
    tankCombat: createCombatState(mission), entities: initializeEntities(mission),
    projectiles: [], events: [], nextProjectileId: 1, nextEventId: 1 };
}
const fire = (position = { x: 0, y: 1, z: 0 }, direction = { x: 0, y: 0, z: -1 }) => [{ type: 'fire', muzzle: { position, direction } }];
const projectile = (position, velocity, damage = 45) => ({ id: 'test-shot', ownerId: 'tank', faction: 'player', position, previousPosition: position, velocity, damage, life: 4 });

test('barriers are real damageable state and shots obey reload rather than intent count', () => {
  const s = fixture({ geometry: [{ id: 'gate', kind: 'box', x: 0, z: -5, width: 4, depth: 1, height: 3, destructible: true, hp: 90 }] });
  assert.ok(s.tankCombat && s.entities);
  assert.equal(s.entities.gate.hp, 90);
  stepCombat(s, 1 / 60, noWorld, fire());
  assert.equal(s.projectiles.length, 1);
  assert.ok(s.tankCombat.reload > 0);
  stepCombat(s, 1 / 60, noWorld, fire());
  assert.equal(s.projectiles.length, 1);
  assert.equal(s.events.filter(e => e.type === 'shot').length, 1);
});

test('height-aware nearest obstruction absorbs fire before an entity and destroying a barrier opens world', () => {
  const s = fixture({ geometry: [{ id: 'gate', kind: 'box', x: 0, z: -4, width: 4, depth: 1, height: 3, destructible: true, hp: 45 }], entities: [{ id: 'turret', kind: 'turret', pose: { x: 0, z: -8, yaw: 0 }, hp: 90 }] });
  const snapshots = [];
  const world = { setDestroyed: ids => snapshots.push([...ids]), raycast: (a, b) => a.y <= 3 && a.z >= -3.5 && b.z <= -3.5 ? { id: 'gate', fraction: (-3.5 - a.z) / (b.z - a.z), point: { x: 0, y: a.y, z: -3.5 } } : null };
  s.projectiles.push(projectile({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -100 }));
  stepCombat(s, 0.1, world);
  assert.equal(s.entities.gate.alive, false);
  assert.equal(s.entities.turret.hp, 90);
  assert.ok(snapshots.some(ids => ids.includes('gate')));
  assert.ok(s.events.some(e => e.type === 'barrier-opened'));
});

test('low cover does not intercept shells above it while entity vertical bounds still apply', () => {
  const s = fixture({ entities: [{ id: 'turret', kind: 'turret', pose: { x: 0, z: -5, yaw: 0 }, hp: 90 }] });
  s.projectiles.push(projectile({ x: 0, y: 5, z: 0 }, { x: 0, y: 0, z: -100 }));
  stepCombat(s, 0.1, noWorld);
  assert.equal(s.entities.turret.hp, 90);
  assert.equal(s.projectiles.length, 1);
});

test('shield rejects frontal fire but flank fire damages the automated turret', () => {
  const options = { entities: [{ id: 'turret', kind: 'turret', pose: { x: 0, z: 0, yaw: 0 }, hp: 90, shieldArc: Math.PI }] };
  const s = fixture(options); s.tank.pose.x = 100;
  s.projectiles.push(projectile({ x: 0, y: 1, z: -5 }, { x: 0, y: 0, z: 100 }));
  stepCombat(s, .1, noWorld);
  assert.equal(s.entities.turret.hp, 90);
  assert.ok(s.events.some(e => e.type === 'impact' && e.value === 'shield'));
  s.projectiles.push(projectile({ x: 5, y: 1, z: 0 }, { x: -100, y: 0, z: 0 }));
  stepCombat(s, .1, noWorld);
  assert.equal(s.entities.turret.hp, 45);
});

test('turrets visibly charge, lose blocked target, and never deal invisible hits', () => {
  const s = fixture({ entities: [{ id: 'turret', kind: 'turret', pose: { x: 0, z: -10, yaw: Math.PI }, hp: 90 }] });
  stepCombat(s, .1, noWorld);
  assert.equal(s.entities.turret.status, 'charging');
  assert.ok(s.entities.turret.telegraphTarget);
  assert.equal(s.tankCombat.hp, 100);
  assert.equal(s.projectiles.length, 0);
  stepCombat(s, .1, { ...noWorld, raycast: () => ({ id: 'cover', fraction: .5, point: { x: 0, y: 1, z: -5 } }) });
  assert.equal(s.entities.turret.status, 'idle');
  for (let i = 0; i < 14; i++) stepCombat(s, .1, noWorld);
  assert.ok(s.events.some(e => e.type === 'shot' && e.entityId === 'turret'));
  assert.ok(s.projectiles.length > 0);
  assert.equal(s.tankCombat.hp, 100);
});

test('hostile projectile damages tank only upon a physical hit and dead turrets stop firing', () => {
  const s = fixture({ entities: [{ id: 'turret', kind: 'turret', pose: { x: 0, z: -8, yaw: 0 }, hp: 45 }] });
  s.projectiles.push({ ...projectile({ x: 0, y: .8, z: -3 }, { x: 0, y: 0, z: 100 }, 12), faction: 'hostile', ownerId: 'turret' });
  stepCombat(s, .1, noWorld);
  assert.equal(s.tankCombat.hp, 88);
  s.entities.turret.alive = false; s.entities.turret.hp = 0;
  for (let i = 0; i < 50; i++) stepCombat(s, .1, noWorld);
  assert.equal(s.events.filter(e => e.type === 'shot' && e.entityId === 'turret').length, 0);
});

test('ambush activation waits for objective completion unless active-phase activation is explicitly authored', () => {
  const s = fixture({ entities: [{ id: 'ambush', kind: 'turret', pose: { x: 0, z: -10, yaw: Math.PI }, hp: 90, activationObjectiveId: 'breach' }] });
  s.objectiveStates = { breach: { status: 'active' } };
  for (let tick = 0; tick < 30; tick++) stepCombat(s, .1, noWorld);
  assert.equal(s.entities.ambush.status, 'idle');
  assert.equal(s.entities.ambush.charge, 0); assert.equal(s.entities.ambush.telegraphTarget, null);
  assert.equal(s.events.some(e => e.type === 'shot'), false);
  s.objectiveStates.breach.status = 'complete';
  stepCombat(s, .1, noWorld);
  assert.equal(s.entities.ambush.status, 'charging'); assert.ok(s.entities.ambush.telegraphTarget);
  for (let tick = 0; tick < 13; tick++) stepCombat(s, .1, noWorld);
  assert.ok(s.events.some(e => e.type === 'shot' && e.entityId === 'ambush'));

  const explicit = fixture({ entities: [{ id: 'defender', kind: 'turret', pose: { x: 0, z: -10, yaw: Math.PI }, hp: 90, activationObjectiveId: 'hold', activationPhase: 'active' }] });
  explicit.objectiveStates = { hold: { status: 'locked' } };
  stepCombat(explicit, .1, noWorld); assert.equal(explicit.entities.defender.status, 'idle');
  explicit.objectiveStates.hold.status = 'active';
  stepCombat(explicit, .1, noWorld); assert.equal(explicit.entities.defender.status, 'charging');
});
