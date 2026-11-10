import {interceptorCollider} from './interceptor.js';
import { DEFAULT_CONFIG } from './tank-controller.js';
import {sentryAim,sentryMuzzleTransform} from './sentry-rig.js';
/** Deterministic, plain-data combat. Helpers mutate only the caller's next-state draft. */
export const COMBAT_CONFIG = Object.freeze({ playerReload: .9, playerDamage: 45, playerSpeed: 38, projectileLife: 4,
  turretRange: 30, turretCharge: 1.25, turretCooldown: 2.4, turretDamage: 12, turretSpeed: 14 });
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
const pointAt = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const normalized = v => { const length = Math.hypot(v.x, v.y, v.z); return length > 1e-8 ? { x: v.x / length, y: v.y / length, z: v.z / length } : null; };

export function emitEvent(state, type, details = {}) {
  state.nextEventId = finite(state.nextEventId, 1);
  const event = { id: `event-${state.nextEventId++}`, tick: state.tick, type, ...details };
  state.events.push(event);
  return event;
}

export function createCombatState(spec) {
  const hp = Math.max(1, finite(spec.tankHp, 100));
  return { hp, maxHp: hp, reload: 0, shotsFired: 0, damageTaken: 0 };
}

export function initializeEntities(spec) {
  const entities = {};
  for (const collider of spec.geometry ?? []) {
    if (!collider.destructible) continue;
    const hp = Math.max(1, finite(collider.hp, 90));
    entities[collider.id] = { id: collider.id, kind: 'barrier', pose: { x: collider.x, y: finite(collider.y, 0), z: collider.z, yaw: finite(collider.yaw, 0) },
      hp, maxHp: hp, alive: true, destroyed: false, status: 'intact', ...(collider.width !== undefined ? { width: collider.width } : {}), ...(collider.depth !== undefined ? { depth: collider.depth } : {}), ...(collider.radius !== undefined ? { radius: collider.radius } : {}), height: collider.height };
  }
  for (const source of spec.entities ?? []) {
    const hp = Math.max(1, finite(source.hp, source.kind === 'truck' ? 70 : 90));
    const entity = { ...source, id: source.id, kind: source.kind, pose: { x: source.pose.x, y: finite(source.pose.y, 0), z: source.pose.z, yaw: finite(source.pose.yaw, 0) },
      hp, maxHp: hp, alive: true, destroyed: false, status: 'idle' };
    if (source.kind === 'truck') Object.assign(entity, { width: finite(source.width, 1.8), depth: finite(source.depth, 3.6), height: finite(source.height, 2.2),
      protected: source.protected !== false, routeIndex: source.routeIndex ?? null, arrived: false, speed: 0, maxSpeed: Math.max(.1, finite(source.speed, 1.5)), stoppedReason: null });
    else Object.assign(entity, { radius: finite(source.radius, .8), height: finite(source.height, 2.2), shieldArc: clamp(finite(source.shieldArc, 0), 0, Math.PI * 2),
      aimYaw: entity.pose.yaw, aimElevation: 0, charge: 0, chargeElapsed: 0, cooldown: 0, telegraphTarget: null, targetId: null });
    entities[entity.id] = entity;
  }
  return entities;
}

export function syncWorldEntities(state, world) {
  world.setEntities?.([...Object.values(state.entities).filter(e => (e.alive || e.vehicle==='pz3') && e.kind !== 'barrier').map(e=>e.vehicle==='pz3'?interceptorCollider(e):e), { id: 'tank', kind: 'tank', pose: state.tank.pose, turret: state.tank.turret, rig: DEFAULT_CONFIG.rig, width: 1.9, depth: 2.9, height: 1.5, hp: state.tankCombat.hp, alive: state.tankCombat.hp > 0 }]);
}

export function destroyedColliderIds(state) {
  return Object.values(state.entities).filter(e => e.kind === 'barrier' && !e.alive).map(e => e.id);
}

// Segment against an upright oriented box, using all three axes (not a ground-plane ray).
function segmentBox(from, to, pose, width, depth, height) {
  const c = Math.cos(pose.yaw), s = Math.sin(pose.yaw);
  const local = p => ({ x: c * (p.x - pose.x) - s * (p.z - pose.z), y: p.y - pose.y, z: s * (p.x - pose.x) + c * (p.z - pose.z) });
  const a = local(from), b = local(to); let lo = 0, hi = 1;
  for (const [axis, min, max] of [['x', -width / 2, width / 2], ['y', 0, height], ['z', -depth / 2, depth / 2]]) {
    const d = b[axis] - a[axis];
    if (Math.abs(d) < 1e-9) { if (a[axis] < min || a[axis] > max) return null; continue; }
    let t0 = (min - a[axis]) / d, t1 = (max - a[axis]) / d;
    if (t0 > t1) [t0, t1] = [t1, t0];
    lo = Math.max(lo, t0); hi = Math.min(hi, t1); if (lo > hi) return null;
  }
  return lo;
}

function segmentCylinder(from, to, entity) {
  const dx = to.x - from.x, dz = to.z - from.z, ox = from.x - entity.pose.x, oz = from.z - entity.pose.z;
  const a = dx * dx + dz * dz, b = 2 * (ox * dx + oz * dz), c = ox * ox + oz * oz - entity.radius ** 2;
  let lo = 0, hi = 1;
  if (a < 1e-12) { if (c > 0) return null; }
  else {
    const disc = b * b - 4 * a * c; if (disc < 0) return null;
    const root = Math.sqrt(disc); lo = Math.max(lo, (-b - root) / (2 * a)); hi = Math.min(hi, (-b + root) / (2 * a));
  }
  const dy = to.y - from.y, minY = entity.pose.y, maxY = minY + entity.height;
  if (Math.abs(dy) < 1e-9) { if (from.y < minY || from.y > maxY) return null; }
  else { let t0 = (minY - from.y) / dy, t1 = (maxY - from.y) / dy; if (t0 > t1) [t0, t1] = [t1, t0]; lo = Math.max(lo, t0); hi = Math.min(hi, t1); }
  return lo <= hi ? lo : null;
}

function nearestHit(state, shot, from, to, world) {
  const geometry = world.raycast?.(from, to, [shot.ownerId]) ?? null;
  let best = geometry ? { id: geometry.id ?? geometry.colliderId, fraction: geometry.fraction ?? geometry.distance / Math.max(1e-9, distance(from, to)), point: geometry.point ?? geometry.position, normal: geometry.normal } : null;
  for (const entity of Object.values(state.entities)) {
    if (!entity.alive || entity.id === shot.ownerId || entity.kind === 'barrier') continue;
    const t = entity.vehicle==='pz3' && world.raycast ? null : (entity.kind === 'truck' || entity.vehicle==='pz3') ? segmentBox(from, to, entity.pose, entity.width, entity.depth, entity.height) : segmentCylinder(from, to, entity);
    if (t !== null && (!best || t < best.fraction)) best = { id: entity.id, fraction: t, point: pointAt(from, to, t) };
  }
  if (shot.ownerId !== 'tank' && !world.terrain) {
    const t = segmentBox(from, to, state.tank.pose, 1.9, 2.9, 1.5);
    if (t !== null && (!best || t < best.fraction)) best = { id: 'tank', fraction: t, point: pointAt(from, to, t) };
  }
  if (best && !best.point) best.point = pointAt(from, to, best.fraction);
  return best;
}

function shielded(entity, shot) {
  if (!(entity.shieldArc > 0) || entity.kind === 'truck') return false;
  const length = Math.hypot(shot.velocity.x, shot.velocity.z); if (length < 1e-9) return false;
  const towardShooter = (-Math.sin(entity.pose.yaw) * -shot.velocity.x - Math.cos(entity.pose.yaw) * -shot.velocity.z) / length;
  return towardShooter > Math.cos(entity.shieldArc / 2) + 1e-7;
}

function applyHit(state, shot, hit, world) {
  const entity = state.entities[hit.id];
  const blocked = entity?.alive && shielded(entity, shot);
  emitEvent(state, 'impact', { entityId: shot.ownerId, targetId: hit.id, position: hit.point, ...(hit.normal?{normal:{...hit.normal}}:{}), projectileId:shot.id, value: blocked ? 'shield' : 'hit' });
  if (blocked) return;
  if (hit.id === 'tank') {
    const dealt = Math.min(state.tankCombat.hp, shot.damage);
    state.tankCombat.hp -= dealt; state.tankCombat.damageTaken += dealt;
    emitEvent(state, 'damaged', { targetId: 'tank', entityId: shot.ownerId, position: hit.point, value: dealt });
    if (state.tankCombat.hp === 0) emitEvent(state, 'destroyed', { entityId: 'tank', position: hit.point });
  } else if (entity?.alive) {
    const dealt = Math.min(entity.hp, shot.damage); entity.hp -= dealt;
    emitEvent(state, 'damaged', { targetId: entity.id, entityId: shot.ownerId, position: hit.point, value: dealt });
    if (entity.hp === 0) {
      entity.alive = false; entity.destroyed = true; entity.status = 'destroyed'; entity.charge = 0; entity.telegraphTarget = null; entity.speed = 0;
      emitEvent(state, 'destroyed', { entityId: entity.id, position: entity.pose });
      syncWorldEntities(state, world);
      if (entity.kind === 'barrier') { world.setDestroyed?.(destroyedColliderIds(state)); emitEvent(state, 'barrier-opened', { entityId: entity.id, position: entity.pose }); }
    }
  }
}

function addProjectile(state, ownerId, faction, position, direction, speed, damage) {
  const unit = normalized(direction); if (!unit) return false;
  state.nextProjectileId = finite(state.nextProjectileId, 1);
  const id = `projectile-${state.nextProjectileId++}`;
  state.projectiles.push({ id, ownerId, faction, position: { ...position }, previousPosition: { ...position }, velocity: { x: unit.x * speed, y: unit.y * speed, z: unit.z * speed }, damage, life: COMBAT_CONFIG.projectileLife });
  emitEvent(state, 'shot', { entityId: ownerId, position: { ...position }, projectileId: id });
  return true;
}

function active(entity, state) {
  if (!entity.activationObjectiveId) return true;
  const objective = state.objectiveStates?.[entity.activationObjectiveId];
  return objective?.status === 'complete' || (entity.activationPhase === 'active' && objective?.status === 'active');
}

function stepTurrets(state, dt, world) {
  for (const entity of Object.values(state.entities)) {
    if (!entity.alive || !['turret', 'drone'].includes(entity.kind)) continue;
    if (!active(entity, state)) { entity.status = 'idle'; entity.charge = 0; continue; }
    entity.cooldown = Math.max(0, entity.cooldown - dt);
    if (entity.cooldown > 0) { entity.status = 'cooldown'; continue; }
    const origin = { x: entity.pose.x, y: entity.pose.y + 1.3, z: entity.pose.z };
    const targets = [{ id: 'tank', pose: state.tank.pose, alive: state.tankCombat.hp > 0 }, ...Object.values(state.entities).filter(e => e.kind === 'truck' && e.protected)];
    const candidates = targets.filter(t => t.alive && distance(origin, { ...t.pose, y: t.pose.y + .8 }) <= finite(entity.range, COMBAT_CONFIG.turretRange)).sort((a, b) => distance(origin, a.pose) - distance(origin, b.pose));
    const target = candidates.find(t => !world.raycast?.(origin, { x: t.pose.x, y: t.pose.y + .8, z: t.pose.z }, [entity.id, t.id]));
    if (!target) { entity.status = 'idle'; entity.charge = 0; entity.chargeElapsed = 0; entity.telegraphTarget = null; entity.targetId = null; continue; }
    if (entity.status !== 'charging' || entity.targetId !== target.id) {
      entity.status = 'charging'; entity.chargeElapsed = 0; entity.targetId = target.id;
      entity.telegraphTarget = { x: target.pose.x, y: target.pose.y + .8, z: target.pose.z };
    }
    // Lock the visible aim point from the start of the charge: a deliberate dodge is meaningful.
    entity.chargeElapsed += dt; entity.charge = clamp(entity.chargeElapsed / finite(entity.chargeTime, COMBAT_CONFIG.turretCharge), 0, 1);
    const aim = sentryAim(entity, entity.telegraphTarget);
    entity.aimYaw = aim.yaw; entity.aimElevation = aim.elevation;
    if (entity.charge < 1) continue;
    const muzzle = sentryMuzzleTransform(entity);
    // Never teleport a shell through a thin blocker between the body and bore.
    // Collision stays authoritative; the measured art rig supplies only the start/direction.
    if (!world.raycast?.(origin, muzzle.position, [entity.id]))
      addProjectile(state, entity.id, 'hostile', muzzle.position, muzzle.direction, COMBAT_CONFIG.turretSpeed, finite(entity.damage, COMBAT_CONFIG.turretDamage));
    entity.cooldown = finite(entity.reload, COMBAT_CONFIG.turretCooldown); entity.status = 'cooldown'; entity.charge = 0; entity.chargeElapsed = 0; entity.telegraphTarget = null;
  }
}

export function stepCombat(state, dt, world, controllerEvents = []) {
  state.tankCombat.reload = Math.max(0, state.tankCombat.reload - dt);
  for (const intent of controllerEvents) {
    if (intent.type !== 'fire' || state.tankCombat.hp <= 0 || state.tankCombat.reload > 1e-8) continue;
    if (addProjectile(state, 'tank', 'player', intent.muzzle.position, intent.muzzle.direction, COMBAT_CONFIG.playerSpeed, COMBAT_CONFIG.playerDamage)) {
      state.tankCombat.reload = COMBAT_CONFIG.playerReload; state.tankCombat.shotsFired++;
    }
  }
  const survivors = [];
  for (const shot of state.projectiles) {
    const from = shot.position, to = { x: from.x + shot.velocity.x * dt, y: from.y + shot.velocity.y * dt, z: from.z + shot.velocity.z * dt };
    const hit = nearestHit(state, shot, from, to, world);
    shot.previousPosition = { ...from }; shot.position = to; shot.life -= dt;
    if (hit) applyHit(state, shot, hit, world);
    else if (shot.life > 0 && (world.projectileInBounds ? world.projectileInBounds(to) : to.y >= -.05)) survivors.push(shot);
  }
  state.projectiles = survivors;
  stepTurrets(state, dt, world);
}
