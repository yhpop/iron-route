import { box, point, rectangle, trace } from './geometry.js';

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

// Corner-B encounter: a shell removes the SAME wall that blocks the road and
// hostile fire. The intact bypass is the static witness; demolition is optional.
// Deliberately kept outside the ordinary 303-record registry/save-key contract.
export const breachCover = freeze({
  schema: 1, id: 'mission-9002', index: 9002, chapter: 1, seed: 1, optional: true,
  title: '拆墙还是借墙',
  briefing: '驶入北侧出口即可完成，不必摧毁墙体或炮台。正前方的墙既挡路，也挡住右前方炮台的射线：开炮拆墙会同时打开近路和敌方火力。近路被仓库挡住，须提前转弯、留意炮管和车身的转向空间；需要撤退时先沿缺口倒回开阔处再转向。也可保留墙体，从左侧绕过封锁，走较长、有墙体掩护的碎石路。拆掉的掩体不会恢复，前装甲保护下的炮台也不能从正面轻易清除。',
  blueprintId: 'optional-breach-cover', objectiveGraphId: 'optional-demolition-reach',
  bounds: { minX: -36, maxX: 34, minZ: -48, maxZ: 34 },
  spawn: { x: 0, y: 0, z: 24, yaw: 0 },
  geometry: [
    box('dual-wall', 0, 6, 10, 1.2, 2.3, { destructible: true, hp: 90 }),
    box('west-shoulder', -11.5, 6, 13, 1.2, 3),
    box('east-shoulder', 19.5, 6, 29, 1.2, 3),
    box('west-screen', -8, -10, 4, 32, 3.2),
    box('warehouse', 0, -20, 8, 12, 3.2)
  ],
  surfaces: [{ id: 'west-rubble', class: 'rubble', traction: .66, drag: 1.4, polygon: rectangle(-25, 0, 10, 40) }],
  zones: [{ id: 'exit', polygon: rectangle(0, -40, 10, 10) }],
  entities: [{ id: 'gun', kind: 'turret', pose: { x: 10, z: -8, yaw: Math.PI }, hp: 90, shieldArc: 2.5 }],
  routes: [],
  objectives: [{ id: 'escape', type: 'reach', targetIds: [], requires: [], nextIds: [], zoneId: 'exit' }],
  witness: { phases: [{ objectiveId: 'escape', tankWaypoints: trace([
    point(0, 24), point(-25, 24), point(-25, -36), point(0, -36)
  ]) }] }
});
