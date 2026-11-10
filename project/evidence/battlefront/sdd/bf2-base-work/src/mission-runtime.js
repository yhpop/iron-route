import {playerRig} from './player-config.js';
import { DEFAULT_CONFIG } from './tank-controller.js';
import { emitEvent, syncWorldEntities } from './combat.js';

const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const wrap = value => Math.atan2(Math.sin(value), Math.cos(value));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function pointInZone(point, zone) {
  if (!zone?.polygon?.length) return false;
  let inside = false;
  const points = zone.polygon;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    const cross = (point.x - a.x) * (b.z - a.z) - (point.z - a.z) * (b.x - a.x);
    if (Math.abs(cross) < 1e-8 && point.x >= Math.min(a.x, b.x) - 1e-8 && point.x <= Math.max(a.x, b.x) + 1e-8 && point.z >= Math.min(a.z, b.z) - 1e-8 && point.z <= Math.max(a.z, b.z) + 1e-8) return true;
    if ((a.z > point.z) !== (b.z > point.z) && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

export function createObjectiveStates(spec) {
  return Object.fromEntries((spec.objectives ?? []).map(objective => [objective.id, { id: objective.id,
    status: (objective.requires ?? []).length ? 'locked' : 'active', progress: 0, elapsed: 0, completedTick: null }]));
}

function finishMission(state, outcome, cause, entityId) {
  if (state.phase === 'won' || state.phase === 'lost') return;
  state.phase = outcome;
  state.result = { outcome, cause, missionId: state.missionId, tick: state.tick, elapsed: state.elapsed ?? 0,
    shotsFired: state.tankCombat.shotsFired ?? 0, damageTaken: state.tankCombat.damageTaken ?? 0,
    medals: outcome === 'won' && state.tankCombat.damageTaken === 0 ? ['undamaged'] : [], ...(entityId ? { entityId } : {}) };
  emitEvent(state, 'mission-ended', { value: outcome, cause, ...(entityId ? { entityId } : {}) });
}

export function stepObjectives(state, dt) {
  if (state.phase !== 'playing') return;
  if (state.tankCombat.hp <= 0) { finishMission(state, 'lost', 'tank-destroyed', 'tank'); return; }
  for (const entity of Object.values(state.entities)) {
    if (entity.kind === 'truck' && entity.protected && !entity.alive) { finishMission(state, 'lost', 'protected-vehicle-destroyed', entity.id); return; }
  }
  const specs = state.mission.objectives ?? [];
  // Iterate a dependency graph to a fixed point so authored record order does not change causality.
  // A defend clock is advanced at most once, even if its prerequisites complete in this tick.
  const timed = new Set();
  for (let pass = 0; pass <= specs.length; pass++) {
    let changed = false;
    for (const spec of specs) {
      const objective = state.objectiveStates[spec.id];
      if (objective.status === 'complete') continue;
      if (!(spec.requires ?? []).every(id => state.objectiveStates[id]?.status === 'complete')) continue;
      if (objective.status === 'locked') { objective.status = 'active'; emitEvent(state, 'objective-changed', { entityId: spec.id, value: 'active' }); changed = true; }
      const targets = (spec.targetIds ?? []).map(id => state.entities[id]);
      const zone = (state.mission.zones ?? []).find(z => z.id === spec.zoneId);
      let done = false;
      if (spec.type === 'breach' || spec.type === 'disable') {
        const count = targets.filter(t => t && !t.alive).length;
        objective.progress = targets.length ? count / targets.length : 0;
        done = targets.length > 0 && count === targets.length;
      } else if (spec.type === 'reach') {
        done = pointInZone(state.tank.pose, zone); objective.progress = done ? 1 : 0;
      } else if (spec.type === 'escort') {
        const count = targets.filter(t => t?.kind === 'truck' && t.alive && t.arrived && (!spec.zoneId || pointInZone(t.pose, zone))).length;
        objective.progress = targets.length ? count / targets.length : 0; done = targets.length > 0 && count === targets.length;
      } else if (spec.type === 'defend') {
        const holds = (!spec.zoneId || pointInZone(state.tank.pose, zone)) && targets.every(t => t?.alive);
        if (!timed.has(spec.id)) { objective.elapsed = holds ? objective.elapsed + dt : 0; timed.add(spec.id); }
        const duration = Math.max(0, finite(spec.duration, 10));
        objective.progress = holds ? clamp(objective.elapsed / Math.max(1e-8, duration), 0, 1) : 0;
        done = holds && objective.elapsed + 1e-8 >= duration;
      }
      if (done) { objective.status = 'complete'; objective.progress = 1; objective.completedTick = state.tick; emitEvent(state, 'objective-changed', { entityId: spec.id, value: 'complete' }); changed = true; }
    }
    if (!changed) break;
  }
  if (specs.length > 0 && specs.every(spec => state.objectiveStates[spec.id]?.status === 'complete')) finishMission(state, 'won', 'objectives-complete');
}

function firstRouteIndex(truck, points) {
  if (points.length < 2) return 0;
  let best = { error: Infinity, index: 0 };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], dx = b.x - a.x, dz = b.z - a.z, length2 = dx * dx + dz * dz;
    const raw = length2 > 0 ? ((truck.pose.x - a.x) * dx + (truck.pose.z - a.z) * dz) / length2 : 0;
    const t = clamp(raw, 0, 1), point = { x: a.x + dx * t, z: a.z + dz * t }, error = distance(truck.pose, point);
    const index = i === 0 && raw < -1e-6 ? 0 : i + 1;
    if (error < best.error) best = { error, index };
  }
  return best.index;
}

function trafficBlock(truck, candidate, direction, trucks, tank, rig=DEFAULT_CONFIG.rig) {
  for (const other of trucks) {
    if (other.id === truck.id || !other.alive) continue;
    const dx = other.pose.x - candidate.x, dz = other.pose.z - candidate.z;
    const along = dx * direction.x + dz * direction.z, side = Math.abs(dx * direction.z - dz * direction.x);
    const bumperGap = other.arrived ? .4 : 2.5;
    if (along > -.2 && side < (truck.width + other.width) / 2 + .35 && along < (truck.depth + other.depth) / 2 + bumperGap) return 'traffic';
    if (Math.hypot(dx, dz) < (truck.width + other.width) / 2 + .2) return 'traffic';
  }
  const dx = tank.pose.x - candidate.x, dz = tank.pose.z - candidate.z;
  const along = dx * direction.x + dz * direction.z, side = Math.abs(dx * direction.z - dz * direction.x);
  // Opt-in escort vehicles leave room for the player's hull corners to pivot.
  // This is a traffic-yield policy, not collision clearance: the full articulated
  // sweep below still catches the longer cannon and actual truck envelope.
  const hull = rig.hullProxy;
  const turnRoom = Math.hypot(hull.width / 2, hull.depth / 2) + .2;
  const yielding = truck.yieldForTankTurn === true;
  if (Math.abs(along) < truck.depth / 2 + (yielding ? turnRoom : 1.5) &&
      side < truck.width / 2 + (yielding ? turnRoom : 1.05)) return 'tank';
  return null;
}

const position = point => point && Number.isFinite(point.x) && Number.isFinite(point.z);
const cross2 = (a, b, c) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
function segmentsMeet(a, b, c, d) {
  if (Math.max(a.x, b.x) < Math.min(c.x, d.x) - 1e-8 || Math.max(c.x, d.x) < Math.min(a.x, b.x) - 1e-8 ||
      Math.max(a.z, b.z) < Math.min(c.z, d.z) - 1e-8 || Math.max(c.z, d.z) < Math.min(a.z, b.z) - 1e-8) return false;
  return cross2(a, b, c) * cross2(a, b, d) <= 1e-8 && cross2(c, d, a) * cross2(c, d, b) <= 1e-8;
}
function validChoicePolygon(polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3 || !polygon.every(position)) return false;
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    if (distance(a, b) < 1e-8) return false;
    area += a.x * b.z - b.x * a.z;
    for (let j = i + 2; j < polygon.length; j++) {
      if (i === 0 && j === polygon.length - 1) continue;
      if (segmentsMeet(a, b, polygon[j], polygon[(j + 1) % polygon.length])) return false;
    }
  }
  return Math.abs(area) > 1e-8;
}
function zonesMeet(a, b) {
  if (a.polygon.some(p => pointInZone(p, b)) || b.polygon.some(p => pointInZone(p, a))) return true;
  return a.polygon.some((p, i) => b.polygon.some((q, j) => segmentsMeet(p, a.polygon[(i + 1) % a.polygon.length], q, b.polygon[(j + 1) % b.polygon.length])));
}
function uniqueRecord(records, id) {
  if (typeof id !== 'string' || !id || !Array.isArray(records)) return null;
  const matches = records.filter(record => record?.id === id);
  return matches.length === 1 ? matches[0] : null;
}
function convoyOptions(state, trucks) {
  const mission = state.mission, choice = mission.convoyChoice;
  if (!choice || !uniqueRecord(mission.objectives, choice.requiresObjectiveId) || !Array.isArray(choice.options) || choice.options.length < 2 || !trucks.length) return null;
  const ids = new Set(), zones = [], options = [];
  for (const option of choice.options) {
    if (!option || typeof option.id !== 'string' || !option.id || ids.has(option.id)) return null;
    ids.add(option.id);
    const zone = uniqueRecord(mission.zones, option.zoneId), map = option.routeByTruck;
    if (!zone || !validChoicePolygon(zone.polygon) || zones.some(other => zonesMeet(zone, other))) return null;
    if (!map || typeof map !== 'object' || Array.isArray(map) || Object.keys(map).length !== trucks.length) return null;
    for (const truck of trucks) {
      const authoredTruck = uniqueRecord(mission.entities, truck.id);
      const route = Object.hasOwn(map, truck.id) && uniqueRecord(mission.routes, map[truck.id]);
      if (authoredTruck?.kind !== 'truck' || !position(authoredTruck.pose) || !route || !Number.isFinite(route.width) || route.width <= 0 ||
          !Array.isArray(route.points) || route.points.length < 2 || !route.points.every(position) || distance(route.points[0], authoredTruck.pose) > 1e-6) return null;
    }
    zones.push(zone); options.push({ ...option, zone });
  }
  return options;
}

// Optional missions hold their whole convoy until a valid, disjoint physical mouth is chosen.
// Selection consumes a stationary frame: routeIndex stays zero and no pose/HP/arrival is rewritten.
function holdForConvoyChoice(state, trucks) {
  if (!Object.hasOwn(state.mission, 'convoyChoice')) return false;
  const options = convoyOptions(state, trucks), prerequisite = state.mission.convoyChoice?.requiresObjectiveId;
  const released = state.objectiveStates[prerequisite]?.status === 'complete';
  let reason = released ? 'route-choice' : 'objective';
  if (options && released) {
    if (state.selectedConvoyChoiceId != null) {
      if (options.some(option => option.id === state.selectedConvoyChoiceId)) return false;
    } else {
      const entered = options.filter(option => pointInZone(state.tank.pose, option.zone));
      if (entered.length === 1) {
        const selected = entered[0];
        for (const truck of trucks) { truck.routeId = selected.routeByTruck[truck.id]; truck.routeIndex = 0; truck.speed = 0; }
        state.selectedConvoyChoiceId = selected.id;
        emitEvent(state, 'convoy-route-selected', { value: selected.id, choiceId: selected.id });
        reason = null;
      }
    }
  }
  // Malformed choice data also holds all trucks, rather than releasing a partially mapped convoy.
  if (!options) reason = 'route-choice';
  for (const truck of trucks) if (truck.alive && !truck.arrived) { truck.speed = 0; truck.status = 'waiting'; truck.stoppedReason = reason; }
  return true;
}

export function stepTrucks(state, dt, world) {
  const trucks = Object.values(state.entities).filter(e => e.kind === 'truck');
  if (holdForConvoyChoice(state, trucks)) return;
  for (const truck of trucks) {
    if (!truck.alive || truck.arrived) continue;
    const route = (state.mission.routes ?? []).find(r => r.id === truck.routeId);
    if (!route?.points?.length) { truck.status = 'parked'; truck.speed = 0; continue; }
    if (truck.routeIndex === null) truck.routeIndex = firstRouteIndex(truck, route.points);
    let reason = null;
    if (truck.activationObjectiveId && state.objectiveStates[truck.activationObjectiveId]?.status !== 'complete') reason = 'objective';
    else if (state.mission.convoyCommands === true && state.convoyOrder === 'hold') reason = 'commander-hold';
    else if (distance(truck.pose, state.tank.pose) > finite(truck.escortRange, 22)) reason = 'tank-away';
    if (reason === 'commander-hold') { truck.speed = 0; truck.status = 'waiting'; truck.stoppedReason = reason; continue; }
    const target = route.points[truck.routeIndex];
    if (!target) { truck.arrived = true; truck.status = 'arrived'; truck.speed = 0; continue; }
    let remaining = distance(truck.pose, target);
    if (remaining <= .025) {
      truck.pose.x = target.x; truck.pose.z = target.z;
      truck.routeIndex++;
      if (truck.routeIndex === route.points.length) { truck.arrived = true; truck.status = 'arrived'; truck.speed = 0; truck.stoppedReason = null; emitEvent(state, 'vehicle-arrived', { entityId: truck.id, position: { ...truck.pose } }); }
      continue;
    }
    const direction = { x: (target.x - truck.pose.x) / remaining, z: (target.z - truck.pose.z) / remaining };
    const desiredYaw = Math.atan2(-direction.x, -direction.z), turn = wrap(desiredYaw - truck.pose.yaw);
    const nextYaw = wrap(truck.pose.yaw + clamp(turn, -dt * .9, dt * .9));
    const nextSpeed = Math.min(truck.maxSpeed, truck.speed + .9 * dt) * Math.max(0, Math.cos(turn));
    const travel = Math.min(remaining, nextSpeed * dt), candidate = { x: truck.pose.x + direction.x * travel, y: truck.pose.y, z: truck.pose.z + direction.z * travel, yaw: nextYaw };
    if (!reason) reason = trafficBlock(truck, candidate, direction, trucks, state.tank,playerRig(state.mission));
    if (!reason && world.isRouteClear && !world.isRouteClear({ points: [truck.pose, candidate], width: route.width }, { width: truck.width, depth: truck.depth, height: truck.height, ignoreIds: [truck.id] })) reason = 'obstacle';
    // Narrow fakes may only implement raycast; production uses the full truck envelope above.
    if (!reason && !world.isRouteClear && world.raycast?.({ ...truck.pose, y: truck.pose.y + 1 }, { x: candidate.x + direction.x * truck.depth / 2, y: truck.pose.y + 1, z: candidate.z + direction.z * truck.depth / 2 }, [truck.id])) reason = 'obstacle';
    if (reason) { truck.speed = 0; truck.status = 'waiting'; truck.stoppedReason = reason; continue; }
    truck.pose = candidate; syncWorldEntities(state, world); truck.speed = nextSpeed; truck.status = 'moving'; truck.stoppedReason = null;
    remaining -= travel;
    if (remaining <= .025) {
      truck.pose.x = target.x; truck.pose.z = target.z; truck.routeIndex++;
      if (truck.routeIndex === route.points.length) { truck.arrived = true; truck.status = 'arrived'; truck.speed = 0; emitEvent(state, 'vehicle-arrived', { entityId: truck.id, position: { ...truck.pose } }); }
    }
  }
}
