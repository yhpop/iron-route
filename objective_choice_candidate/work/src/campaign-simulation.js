import {stepInterceptors} from './interceptor.js';
import {stepCrushing} from './crushing.js';
import { createTank, stepTank } from './tank-controller.js';
import { createCombatState, initializeEntities, stepCombat, destroyedColliderIds, syncWorldEntities } from './combat.js';
import { createObjectiveStates, stepTrucks, stepObjectives } from './mission-runtime.js';

/** Every retained value is serializable. Mission data is embedded because stepGame needs no registry or globals. */
export function createGame(spec) {
  if (!spec || spec.schema !== 1 || typeof spec.id !== 'string') throw new TypeError('createGame requires a schema:1 MissionSpec with an id');
  const mission = JSON.parse(JSON.stringify(spec));
  const tank = createTank(mission.spawn);
  return { schema: 1, missionId: mission.id, mission, tick: 0, elapsed: 0, phase: 'briefing', tank,
    tankFrame: stepTank(tank, { paused: true }, 1 / 60).frame,
    tankCombat: createCombatState(mission), entities: initializeEntities(mission), projectiles: [],
    objectiveStates: createObjectiveStates(mission), events: [], result: null, nextEventId: 1, nextProjectileId: 1,
    ...(mission.convoyCommands === true ? { convoyOrder: 'advance' } : {}),
    ...(Object.hasOwn(mission, 'convoyChoice') ? { selectedConvoyChoiceId: null } : {}) };
}

function nextDraft(previous) {
  return { ...previous, tankCombat: { ...previous.tankCombat },
    entities: Object.fromEntries(Object.entries(previous.entities).map(([id, e]) => [id, { ...e, pose: { ...e.pose }, ...(e.telegraphTarget ? { telegraphTarget: { ...e.telegraphTarget } } : {}) }])),
    projectiles: previous.projectiles.map(p => ({ ...p, position: { ...p.position }, previousPosition: { ...p.previousPosition }, velocity: { ...p.velocity } })),
    objectiveStates: Object.fromEntries(Object.entries(previous.objectiveStates).map(([id, objective]) => [id, { ...objective }])), events: [] };
}

/** Fixed-step orchestration. Commands change phase only, and never consume a movement/fire tick. */
export function stepGame(previous, input = {}, dt = 1 / 60, world = {}) {
  if (!Number.isFinite(dt) || dt <= 0 || dt > .1) throw new RangeError('Game dt must be finite, positive, and <= 0.1 seconds');
  world.setDestroyed?.(destroyedColliderIds(previous));
  syncWorldEntities(previous, world);
  if (input.pause && previous.phase === 'playing') return { ...previous, phase: 'paused', events: [] };
  if ((input.start && previous.phase === 'briefing') || (input.resume && previous.phase === 'paused')) return { ...previous, phase: 'playing', events: [] };
  if (previous.phase !== 'playing' || input.paused) return previous.events.length ? { ...previous, events: [] } : previous;
  const next = nextDraft(previous);
  next.tick++; next.elapsed += dt;
  if (next.mission.convoyCommands === true &&
      (!next.mission.convoyChoice || next.selectedConvoyChoiceId) &&
      ['hold', 'advance'].includes(input.convoyOrder)) next.convoyOrder = input.convoyOrder;
  const ready = next.tankCombat.hp > 0 && next.tankCombat.reload - dt <= 1e-8;
  const driven = stepTank(previous.tank, { ...input, firePressed: Boolean(input.firePressed && ready) }, dt, world);
  next.tank = driven.state; next.tankFrame = driven.frame;
  stepCrushing(next,dt,world);
  syncWorldEntities(next, world);
  stepInterceptors(next, dt, world);
  syncWorldEntities(next, world);
  stepCombat(next, dt, world, driven.events);
  // Apply losses/objective releases before moving vehicles, then verify physical terminal states.
  stepObjectives(next, 0);
  if (next.phase === 'playing') {
    syncWorldEntities(next, world);
    stepTrucks(next, dt, world);
    syncWorldEntities(next, world);
    stepObjectives(next, dt);
  }
  return next;
}

export function retry(spec) { return createGame(spec); }
