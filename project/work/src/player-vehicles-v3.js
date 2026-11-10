import {listPlayerVehicles as oldList,getPlayerVehicle as oldGet,withPlayerVehicle as oldSelect} from './player-vehicles.js';
import {QUATERNIUS_SANDFALCON_RIG as measured} from '../assets/armor/quaternius-sandfalcon-rig.js';
export {playerControllerConfig,playerRig,playerBody} from './player-config.js';
const clone=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{for(const v of Object.values(x))if(v&&typeof v==='object')freeze(v);return Object.freeze(x);};
const r=measured.rig,h=r.hullProxy,t=r.turretProxy;
// Game-scale geometry tradeoff, not historical performance. Keep the reference weapon/HP
// unchanged until balance trials; the measured low/wide hull changes clearance and exposure.
const fifth=freeze({id:'sandfalcon',version:1,title:'沙隼 S-5',role:'低姿火力支援',tradeoff:'低矮车身便于藏身；宽履带难过窄隙，火力与先锋相同',modelKey:'quaternius-sandfalcon',hp:oldGet('vanguard').hp,weapon:clone(oldGet('vanguard').weapon),collision:{width:h.width,depth:h.depth,height:r.turretPivot.y+t.offset.y+t.height/2,aimHeight:r.turretPivot.y+t.offset.y},controller:{...clone(oldGet('vanguard').controller),trackGauge:1.7366422273733255,elevationLimits:[-.12,.3],recoilDistance:.08,rig:clone(r)}});
const roster=Object.freeze([...oldList(),fifth]);
export const listPlayerVehicles=()=>roster;
export function getPlayerVehicle(id){return id==='sandfalcon'?fifth:oldGet(id);}
export function withPlayerVehicle(spec,id){if(id!=='sandfalcon')return oldSelect(spec,id);if(!spec?.scorchedFront)throw new TypeError('Vehicle selection is restricted to scorched-front');return {...clone(spec),playerVehicle:clone(fifth)};}
