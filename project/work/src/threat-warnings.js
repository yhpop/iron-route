import { Vector3 } from 'three';
import { COMBAT_CONFIG } from './combat.js';
import { factionCombat, areHostile, isHostileToPlayer } from './combat-relations.js';

// Presentation only: no retained state, simulation mutation, timers or listeners.
const DIRECTIONS = Object.freeze([
  ['→', '右方'], ['↘', '右下方'], ['↓', '下方'], ['↙', '左下方'],
  ['←', '左方'], ['↖', '左上方'], ['↑', '上方'], ['↗', '右上方'],
]);
const finitePoint = point => point && Number.isFinite(point.x) && Number.isFinite(point.y);
const finiteWorldPoint = point => finitePoint(point) && Number.isFinite(point.z);
const MAX_INDIVIDUAL = 2;
const compareId = (a, b) => String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;

function bearing(point, origin) {
  if (!finitePoint(point) || !finitePoint(origin) || point.inFront === false || origin.inFront === false) return { arrow: '', direction: '方位未知' };
  const x = point.x - origin.x, y = point.y - origin.y;
  if (Math.hypot(x, y) < 1e-6) return { arrow: '', direction: '方位未知' };
  const [arrow, direction] = DIRECTIONS[(Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8];
  return { arrow, direction };
}

function remainingCharge(entity) {
  // Match combat's finite() fallback, not a separate UI default or a local clock.
  const duration = Number.isFinite(entity.chargeTime) ? entity.chargeTime : COMBAT_CONFIG.turretCharge;
  if (!(duration > 0) || !Number.isFinite(entity.chargeElapsed) || entity.chargeElapsed < 0) return null;
  const remaining = duration - entity.chargeElapsed;
  return remaining > 0 ? remaining : null;
}

function timeText(remaining) {
  if (remaining === null) return '时间未知';
  // Tolerance removes binary float noise at exact tenths; a live positive charge
  // still always displays at least 0.1 s, never 0.0 s before its authoritative shot.
  return `${(Math.max(1, Math.ceil(remaining * 10 - 1e-9)) / 10).toFixed(1)}秒`;
}

function targetKind(entity, state) {
  if (factionCombat(state) && !areHostile(state, entity.id, entity.targetId)) return null;
  if (entity.targetId === 'tank') return state.tankCombat?.hp > 0 ? 'tank' : null;
  const target = state.entities?.[entity.targetId];
  return target?.kind === 'truck' && target.alive === true && !target.destroyed && target.protected === true ? 'convoy' : null;
}

/**
 * Current simulation snapshot -> existing bearing-line presentation.
 * projectEntity(entity) and origin must share CSS viewport coordinates. Supply the
 * already updated render camera, never a separate UI camera or interpolated timer.
 * All entries are retained; >2 uses a clearly labelled count/earliest-time summary,
 * not two arrows implying that the other sources were individually represented.
 */
export function computeChargeWarnings({ state, projectEntity, origin } = {}) {
  const empty = { entries: [], text: '', fallbackText: '', compactText: '', minimalText: '', accessibilityLabel: '', signature: '', total: 0, displayedCount: 0, overflow: null };
  if (state?.phase !== 'playing') return empty;
  const entries = [];
  for (const entity of Object.values(state.entities || {})) {
    if (!entity || entity.alive !== true || entity.destroyed || !isHostileToPlayer(state, entity) ||
        entity.status !== 'charging' || !Number.isFinite(entity.charge) || !(entity.charge > 0) || !finiteWorldPoint(entity.telegraphTarget)) continue;
    const target = targetKind(entity, state);
    if (!target) continue;
    const remaining = remainingCharge(entity);
    const { arrow, direction } = bearing(projectEntity?.(entity), origin);
    entries.push({ id: entity.id, targetId: entity.targetId, target, arrow, direction, remaining,
      text: `${target === 'tank' ? '瞄你' : '瞄车'}${arrow || direction}${timeText(remaining)}` });
  }
  if (!entries.length) return empty;
  entries.sort((a, b) => {
    const difference = (a.remaining ?? Infinity) - (b.remaining ?? Infinity);
    return Math.abs(difference) > 1e-9 ? difference : compareId(a, b);
  });
  // Semantic order must never depend on remaining time (including float ties).
  const semanticEntries = [...entries].sort(compareId);
  const tankCount = entries.filter(entry => entry.target === 'tank').length;
  const convoyCount = entries.length - tankCount;
  const summary = entries.length > MAX_INDIVIDUAL;
  const earliestRemaining = entries.find(entry => entry.remaining !== null)?.remaining ?? null;
  const unknownTimeCount = entries.filter(entry => entry.remaining === null).length;
  const overflow = summary ? { count: entries.length, tankCount, convoyCount, earliestRemaining, unknownTimeCount } : null;
  // If any timing is unknown, "earliest" would be an unsupported claim: make the
  // incomplete timing explicit instead of reporting only the known subset.
  const summaryTime = unknownTimeCount ? '时间未全知' : `最快${timeText(earliestRemaining)}`;
  const fallbackText = `${entries.length}处蓄力·你${tankCount}车${convoyCount}·${summaryTime}`;
  const compactText = `${tankCount ? `你${tankCount}` : ''}${convoyCount ? `车${convoyCount}` : ''}·${summaryTime}`;
  // Last visual time-bearing tier: the number counts every source and the time
  // is the earliest actual charge completion, not a promised impact or hit.
  const minimalText = `${entries.length}处·${unknownTimeCount ? '时未知' : timeText(earliestRemaining).replace('秒','s')}`;
  const text = summary ? fallbackText : entries.map(entry => entry.text).join(' · ');
  const accessibilityLabel = summary
    ? `${entries.length}处敌方正在蓄力，${tankCount}处瞄准你的坦克，${convoyCount}处瞄准受保护车队；当前仅显示汇总，未逐一显示方向。`
    : `${entries.length}处敌方正在蓄力，${semanticEntries.map(entry => `${entry.direction}敌人瞄准${entry.target === 'tank' ? '你的坦克' : '受保护车队'}`).join('；')}。`;
  // Deliberately excludes chargeElapsed/countdown: consumers must not create an
  // aria-live countdown announcement on every rendered frame.
  const signature = JSON.stringify([state.missionId, semanticEntries.map(entry => [entry.id, entry.targetId, entry.arrow])]);
  return { entries, text, fallbackText, compactText, minimalText, accessibilityLabel, signature, total: entries.length, displayedCount: summary ? 0 : entries.length, overflow };
}

/** Actual combat origin by default; pass height:0.8 for the rendered tank origin.
 * Caller must update camera matrices after lookAt. This helper never changes them.
 * Behind-camera projection is labelled unknown by the formatter, not mirrored.
 */
export function projectThreatPoint({ entity, camera, canvasRect, height = 1.3 } = {}) {
  const pose = entity?.pose;
  if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z) || !Number.isFinite(height) ||
      !camera?.matrixWorldInverse || !camera?.projectionMatrix || !canvasRect ||
      !['left', 'top', 'width', 'height'].every(key => Number.isFinite(canvasRect[key])) ||
      !(canvasRect.width > 0 && canvasRect.height > 0)) return null;
  const point = new Vector3(pose.x, (Number.isFinite(pose.y) ? pose.y : 0) + height, pose.z);
  const inFront = point.clone().applyMatrix4(camera.matrixWorldInverse).z < 0;
  point.project(camera);
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return { x: canvasRect.left + (point.x + 1) * canvasRect.width / 2,
    y: canvasRect.top + (1 - point.y) * canvasRect.height / 2, inFront };
}
