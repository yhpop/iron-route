import {contactEscapeGuidance} from './recovery-direction.js';
import {factionCombat, combatTeam, areHostile} from './combat-relations.js';

// Pure presentation: no timers, event history, simulation changes or camera writes.
const DIRECTIONS = [['→','右方'],['↘','右下方'],['↓','下方'],['↙','左下方'],['←','左方'],['↖','左上方'],['↑','上方'],['↗','右上方']];
const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.inFront !== false;
const worldPoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
const live = e => e?.alive === true && !e.destroyed && !(Number.isFinite(e.hp) && e.hp <= 0);
function bearing(point, origin) {
  if (!finitePoint(point) || !finitePoint(origin) || Math.hypot(point.x-origin.x,point.y-origin.y)<1e-6) return {arrow:'',direction:'方位未知'};
  const [arrow,direction] = DIRECTIONS[(Math.round(Math.atan2(point.y-origin.y,point.x-origin.x)/(Math.PI/4))+8)%8];
  return {arrow,direction};
}
function engagement(entity,state) {
  if (!live(entity)) return {engagement:entity.alive===false || entity.destroyed || entity.hp<=0 ? 'destroyed' : 'unknown',label:'生死未确认'};
  // Opt-in V4 presentation of accepted simulation motion, never patrol intent.
  // Charging/unknown states fall through; stale speed cannot override them.
  if (state.mission?.crossfireV4===true && entity.vehicle==='pz3' &&
      Array.isArray(entity.patrol) && entity.patrol.length>1 &&
      ['cooldown','idle'].includes(entity.status)) {
    if (entity.patrolBlocked===true) return {engagement:'blocked',label:entity.status==='cooldown'?'装填·换位受阻':'换位受阻'};
    if (worldPoint(entity.pose) && Number.isFinite(entity.speed) && entity.speed>0 &&
        Number.isFinite(entity.travel) && entity.travel>0) return {engagement:'maneuvering',label:entity.status==='cooldown'?'装填机动':'机动换位'};
  }
  if (entity.status === 'cooldown') return {engagement:'cooldown',label:'装填中'};
  if (entity.status === 'idle') return {engagement:'idle',label:'待机'};
  const target = state.entities?.[entity.targetId];
  if (entity.status === 'charging' && live(target) && areHostile(state,entity.id,target.id) &&
      Number.isFinite(entity.charge) && entity.charge>0 && worldPoint(entity.telegraphTarget)) return {engagement:'charging',label:'瞄敌蓄力'};
  return {engagement:'unknown',label:'目标待确认'};
}
function recoveryFor(state,muzzleContactIds) {
  const blocked = state.tank?.blocked || {};
  const terrainTravel = state.tankFrame?.terrainTravelClearance === true;
  if (!blocked.body && !blocked.barrel && !blocked.muzzle && !terrainTravel) return null;
  const contactIds = [...new Set([...(state.tankFrame?.contacts || []),...(muzzleContactIds || [])].filter(id=>typeof id==='string'))].sort();
  // A retained floor is a request, not proof that the collision sweep accepted a lift.
  // Actual wall/vehicle/boundary contacts still take precedence.
  if (!blocked.body && contactIds.every(id=>id==='terrain') &&
      (terrainTravel || contactIds.length>0 && (blocked.barrel || blocked.muzzle))) {
    const stillBlocked = terrainTravel && (blocked.barrel || blocked.muzzle);
    const text = stillBlocked
      ? '炮管仍受地形限制：辅助抬炮也需通过碰撞检查。松开油门或刹车后可重新瞄准；仍不动时，观察后尝试倒车留距。'
      : terrainTravel
      ? '触地恢复：行驶中保持抬炮避地；松开油门或刹车后可重新压低瞄准。其他障碍仍会挡车。'
      : '炮管触地：将瞄准点移远或抬高，再尝试移动；仍需避开实体障碍。';
    const compactText = stillBlocked
      ? '炮管触地：松油门/刹车重瞄；仍不动试倒车'
      : terrainTravel
      ? '触地恢复：行驶保持抬炮；松油门/刹车恢复压低瞄准'
      : '炮管触地：瞄准点移远/抬高，再试移动';
    return {kind:'terrain',contactIds,text,compactText,accessibilityLabel:text};
  }
  const playerTeam = combatTeam(state,'tank');
  const contacts = contactIds.map(id=>{
    const entity=state.entities?.[id],friendly=playerTeam && combatTeam(state,id)===playerTeam;
    return {id,kind:friendly && entity?.kind!=='barrier' ? entity?.kind==='truck' ? 'truck' : 'friendly' : 'obstacle',wreck:entity?.destroyed===true || entity?.alive===false || entity?.hp<=0};
  });
  const friendly=contacts.filter(c=>c.kind!=='obstacle'),obstacles=contacts.filter(c=>c.kind==='obstacle');
  const kind = friendly.length ? obstacles.length ? 'mixed' : friendly.every(c=>c.kind==='truck') ? 'truck' : 'friendly' : 'obstacle';
  const names = [...new Set(friendly.map(c=>(c.kind==='truck'?'补给车':'友军')+(c.wreck?'残骸':'')))];
  const source = names.length ? `接触${names.join(' / ')}${obstacles.length?'及其他障碍':''}` : '障碍接触未确认';
  // Frame contacts combine body and joint sweeps; do not assert which friendly
  // blocked which part, or that reversing is guaranteed to create clearance.
  const condition = blocked.muzzle ? '炮口受阻' : blocked.barrel ? '炮管转动受限' : '车体受阻';
  if(state.mission?.crossfireV4===true){
    const direction=contactEscapeGuidance(state,contactIds);
    const text=`${source} · ${condition}：${direction.full}`,compactText=`${source}：${direction.compact}`;
    return {kind,contactIds,escapeDirection:direction.escapeDirection,text,compactText,accessibilityLabel:text};
  }
  const text = `${source} · ${condition}：先停稳，再尝试倒车拉开侧向间距，把炮管转离障碍；仍可能受阻，勿强挤。`;
  const compactText = `${source}：停稳→尝试倒车→留侧隙，炮管转离；勿强挤`;
  return {kind,contactIds,text,compactText,accessibilityLabel:text};
}

/**
 * computeBattlefieldGuidance({state, origin, projectEntity, viewStatus='ready',
 *   visible=true, muzzleContactIds=[]}) -> {support, recovery}.
 *
 * Crossfire-only. origin and projectEntity(entity) MUST use the same updated
 * render camera and CSS viewport coordinates (projectThreatPoint), not world axes
 * or a second UI camera. Positions outside the viewport still have a direction;
 * behind-camera/invalid projections explicitly have an unknown direction.
 * Distance is current planar simulation distance in metres, rounded only in text.
 * muzzleContactIds may supplement actual tankFrame sweep contacts from the world;
 * never supply nearest IDs or IDs guessed from proximity. Missing IDs stay generic.
 * Paused/nonplaying, hidden, loading or failed snapshots return empty guidance.
 * The first stable-ID support is shown; additional actual units are explicitly
 * counted, with every unit's full detail in accessibilityLabel and entries.
 */
export function computeBattlefieldGuidance({state,origin,projectEntity,viewStatus='ready',visible=true,muzzleContactIds=[]}={}) {
  const emptySupport={entries:[],total:0,text:'',compactText:'',accessibilityLabel:''};
  if (state?.mission?.crossfireFront!==true || !factionCombat(state) || state.phase!=='playing' || viewStatus!=='ready' || !visible) return {support:emptySupport,recovery:null};
  const playerTeam = combatTeam(state,'tank');
  const entries = Object.values(state.entities || {}).filter(e=>e && ['turret','drone'].includes(e.kind) && playerTeam && combatTeam(state,e.id)===playerTeam)
    .sort((a,b)=>String(a.id).localeCompare(String(b.id))).map(entity=>{
      const direction=bearing(projectEntity?.(entity),origin);
      const distance=worldPoint(entity.pose) && worldPoint(state.tank?.pose) ? Math.hypot(entity.pose.x-state.tank.pose.x,entity.pose.z-state.tank.pose.z) : null;
      const alive=live(entity) ? true : entity.alive===false || entity.destroyed || entity.hp<=0 ? false : null, status=engagement(entity,state);
      const range=distance===null?'距离未知':`${Math.round(distance)} m`;
      const life=alive===true?'存活':alive===false?'已毁':'生死未确认';
      const text=`支援 ${direction.arrow || direction.direction} ${range} · ${life}${alive?' · '+status.label:''}`;
      return {id:entity.id,...direction,distance,alive,engagement:status.engagement,text,
        compactText:`援${direction.arrow || direction.direction}${range.replace(' ','')}·${life}${alive?'·'+status.label:''}`,
        accessibilityLabel:`支援单位，屏幕${direction.direction}，${distance===null?'距离未知':`距离 ${Math.round(distance)} 米`}，${life}${alive?'，'+(status.engagement==='charging'?'正在瞄准敌方蓄力':status.label):''}。`};
    });
  const extra=entries.length>1?` · 另${entries.length-1}辆支援未逐一显示方位`:'';
  const compactExtra=entries.length>1?`·另${entries.length-1}援`:'';
  const support={entries,total:entries.length,text:(entries[0]?.text || '')+extra,
    compactText:(entries[0]?.compactText || '')+compactExtra,
    accessibilityLabel:entries.length?`${entries.length}辆友军支援。${entries.map(e=>e.accessibilityLabel).join('')}`:''};
  return {support,recovery:recoveryFor(state,muzzleContactIds)};
}
