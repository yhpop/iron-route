/** Explicit, serialized opt-in combat ownership. Absence preserves legacy rules. */
export const factionCombat=state=>state?.mission?.combatRelations?.version===1;
function known(state,team){return typeof team==='string'&&state.mission.combatRelations.teams?.includes(team)?team:null;}
export function combatTeam(state,id){if(!factionCombat(state))return null;return known(state,id==='tank'?state.mission.combatRelations.playerTeam:state.entities?.[id]?.team);}
function teamsHostile(state,a,b){if(!a||!b||a===b)return false;return !!state.mission.combatRelations.hostilePairs?.some(pair=>pair[0]===a&&pair[1]===b);}
export function areHostile(state,sourceId,targetId){if(!factionCombat(state))return false;return teamsHostile(state,combatTeam(state,sourceId),combatTeam(state,targetId));}
export function isHostileToPlayer(state,entity){return factionCombat(state)?!!entity&&areHostile(state,'tank',entity.id):!!entity&&['turret','drone'].includes(entity.kind);}
/** A non-hostile body still stops the shell. World/barrier damage remains physical. */
export function absorbsFriendlyHit(state,shot,targetId){
 if(!factionCombat(state)||state.mission.combatRelations.friendlyFire!=='absorb')return false;
 const entity=state.entities?.[targetId];if(targetId!=='tank'&&(!entity||entity.kind==='barrier'))return false;
 return !teamsHostile(state,known(state,shot.faction),combatTeam(state,targetId));
}
export function validateCombatRelations(spec){
 if(!Object.hasOwn(spec,'combatRelations'))return;
 const p=spec.combatRelations,valid=p&&p.version===1&&Array.isArray(p.teams)&&p.teams.length>=2&&p.teams.every(t=>typeof t==='string'&&t.length>0)&&new Set(p.teams).size===p.teams.length&&p.teams.includes(p.playerTeam)&&p.friendlyFire==='absorb'&&Array.isArray(p.hostilePairs)&&p.hostilePairs.every(pair=>Array.isArray(pair)&&pair.length===2&&pair[0]!==pair[1]&&pair.every(t=>p.teams.includes(t))&&p.hostilePairs.some(reverse=>Array.isArray(reverse)&&reverse[0]===pair[1]&&reverse[1]===pair[0]));
 if(!valid)throw new TypeError('Unsupported or invalid combat relations policy');
}
