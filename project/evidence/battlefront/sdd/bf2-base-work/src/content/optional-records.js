import { box, rectangle, trace } from './geometry.js';
import { breachCover } from './breach-cover.js';

const point = (x, z) => ({ x, z });
const phase = (objectiveId, points, extra = {}) => ({ objectiveId, tankWaypoints: trace(points), ...extra });
function freeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
const shortRoad = [point(0, 14), point(0, -34)];
const coveredRoad = [point(0, 14), point(-12, 14), point(-18, 8), point(-18, -26), point(-12, -34), point(0, -34)];
const witness = (branch, road) => ({ phases: [
  phase('open-fork', [point(0, 26)], { firingPoses: [{ targetId: 'fork-gate', x: 0, z: 26, turretYaw: 0 }] }),
  phase('deliver-pair', [point(0, 26), ...road, point(0, -40)], { convoyRouteIds: [`lead-${branch}`, `rear-${branch}`] }),
  phase('reach-depot', [point(0, -40)])
] });
const branchWitnesses = { short: witness('short', shortRoad), covered: witness('covered', coveredRoad) };

// Deliberately outside the campaign registry and its generated/save-key contract.
const warehouseFork = freeze({
  schema: 1, id: 'mission-9001', index: 9001, chapter: 1, seed: 20261028,
  title: '仓区岔路',
  briefing: '击破共同路障后，用坦克驶入岔路口：直行选较短但暴露的街道，左转选绕仓库的较长掩护路。两辆货车会锁定同一选择、保持间距并等待掉队的护送坦克；将两车护送到各自货场车位。',
  blueprintId: 'optional-warehouse-fork', objectiveGraphId: 'breach-choice-pair-depot',
  bounds: { minX: -30, maxX: 30, minZ: -48, maxZ: 48 }, spawn: { x: 0, y: 0, z: 26, yaw: 0 },
  geometry: [
    box('fork-gate', 0, 20, 8, 1.2, 2.3, { destructible: true, hp: 90 }),
    box('west-gate-shoulder', -17, 20, 26, 2.4), box('east-gate-shoulder', 17, 20, 26, 2.4),
    box('west-perimeter', -29.5, 0, 1, 96), box('east-perimeter', 29.5, 0, 1, 96),
    box('north-perimeter', 0, -47.5, 58, 1), box('south-perimeter', 0, 47.5, 58, 1),
    box('warehouse-screen', -8, -12, 4, 32, 3.2)
  ],
  surfaces: [],
  zones: [
    { id: 'choose-straight', polygon: rectangle(0, 6, 5, 4) },
    { id: 'choose-left', polygon: rectangle(-12, 14, 5, 4) },
    { id: 'fork-depot', polygon: rectangle(0, -40, 16, 10) }
  ],
  entities: [
    { id: 'lead', kind: 'truck', pose: { x: 0, z: 32, yaw: 0 }, hp: 180, escortRange: 36, routeId: 'lead-short', activationObjectiveId: 'open-fork' },
    { id: 'rear', kind: 'truck', pose: { x: 0, z: 40, yaw: 0 }, hp: 180, escortRange: 36, routeId: 'rear-short', activationObjectiveId: 'open-fork' },
    { id: 'street-gun', kind: 'turret', pose: { x: 10, z: -8, yaw: Math.PI }, hp: 90, shieldArc: 2.5, range: 30 }
  ],
  routes: [
    { id: 'lead-short', width: 8, points: [point(0, 32), ...shortRoad, point(4, -40)] },
    { id: 'rear-short', width: 8, points: [point(0, 40), ...shortRoad, point(-4, -40)] },
    { id: 'lead-covered', width: 8, points: [point(0, 32), ...coveredRoad, point(4, -40)] },
    { id: 'rear-covered', width: 8, points: [point(0, 40), ...coveredRoad, point(-4, -40)] }
  ],
  objectives: [
    { id: 'open-fork', type: 'breach', targetIds: ['fork-gate'], requires: [], nextIds: ['deliver-pair'] },
    { id: 'deliver-pair', type: 'escort', targetIds: ['lead', 'rear'], zoneId: 'fork-depot', requires: ['open-fork'], nextIds: ['reach-depot'] },
    { id: 'reach-depot', type: 'reach', targetIds: [], zoneId: 'fork-depot', requires: ['deliver-pair'], nextIds: [] }
  ],
  convoyChoice: { requiresObjectiveId: 'open-fork', options: [
    { id: 'short', zoneId: 'choose-straight', routeByTruck: { lead: 'lead-short', rear: 'rear-short' } },
    { id: 'covered', zoneId: 'choose-left', routeByTruck: { lead: 'lead-covered', rear: 'rear-covered' } }
  ] },
  witness: branchWitnesses.short,
  convoyChoiceWitnesses: branchWitnesses
});

export function getOptionalMission(slug) {
  if (slug === 'breach-cover') return breachCover;
  return slug === 'warehouse-fork' ? warehouseFork : null;
}

const optionalMissions = freeze([
  { slug: 'warehouse-fork', spec: warehouseFork },
  { slug: 'breach-cover', spec: breachCover }
]);
export function listOptionalMissions() { return optionalMissions; }
