import {DEFAULT_CONFIG} from './tank-controller.js';
import {INTERCEPTOR_COLLISION_RIG} from './interceptor.js';
import {ARMOR_RIGS} from '../assets/armor/rigs.js';
export {playerControllerConfig,playerRig,playerBody} from './player-config.js';
const clone=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{for(const v of Object.values(x))if(v&&typeof v==='object')freeze(v);return Object.freeze(x);};
const armor=(id,details,drivetrain)=>{const r=ARMOR_RIGS[id].rig,h=r.hullProxy;return {id,version:1,modelKey:id,...details,collision:{width:h.width,depth:h.depth,height:r.turretPivot.y+r.turretProxy.offset.y+r.turretProxy.height/2,aimHeight:r.turretPivot.y+r.turretProxy.offset.y},controller:{...clone(DEFAULT_CONFIG),...drivetrain,elevationLimits:[-.12,.3],recoilDistance:.08,rig:clone(r)}};};
// Tuning is game-scale, not a statement of historical vehicle performance.
const roster=freeze([
 {id:'vanguard',version:1,title:'先锋 M-1',role:'均衡突击',tradeoff:'中等装甲与装填；适合贴掩体推进',modelKey:'original',hp:100,weapon:{damage:45,reload:.9,speed:38},collision:{width:1.9,depth:2.9,height:1.5,aimHeight:.8},controller:clone(DEFAULT_CONFIG)},
 {id:'pz3',version:1,title:'Pz.III',role:'机动侧击',tradeoff:'速度快、装填短；装甲较薄，需绕开正面火线',modelKey:'pz3',hp:75,weapon:{damage:32,reload:.65,speed:36},collision:{width:1.921792,depth:3.532506,height:1.645451,aimHeight:1.05},controller:{...clone(DEFAULT_CONFIG),trackGauge:1.61,governorCaps:{crawl:1.4,cruise:2.7,travel:3.8},reverseCap:1.4,boostCap:4.1,accel:1.6,maxYawRate:.78,maxYawAccel:1.35,turretYawRate:1.25,elevationLimits:[-.12,.3],recoilDistance:.07,rig:clone(INTERCEPTOR_COLLISION_RIG)}},
 armor('newc-leichttraktor',{title:'Leichttraktor',role:'轻装侦察',tradeoff:'小口径快射与灵活倒车；装甲薄，不宜硬扛火力',hp:60,weapon:{damage:24,reload:.45,speed:34}},{trackGauge:1.5,governorCaps:{crawl:1.5,cruise:2.8,travel:4.0},reverseCap:1.7,boostCap:4.3,accel:1.9,maxYawRate:.92,maxYawAccel:1.55,turretYawRate:1.35}),
 armor('newc-tiger',{title:'Tiger',role:'重装突破',tradeoff:'高耐久与重炮；车体大、装填慢，提前规划转向',hp:155,weapon:{damage:70,reload:1.55,speed:40}},{trackGauge:1.85,governorCaps:{crawl:1.0,cruise:1.8,travel:2.5},reverseCap:.85,boostCap:2.8,accel:1.0,maxYawRate:.5,maxYawAccel:.85,turretYawRate:.75})
]);
export const listPlayerVehicles=()=>roster;
export function getPlayerVehicle(id){const v=roster.find(v=>v.id===id);if(!v)throw new RangeError('Unknown player vehicle: '+id);return v;}
export function withPlayerVehicle(spec,id){if(!spec?.scorchedFront)throw new TypeError('Vehicle selection is restricted to scorched-front');return {...clone(spec),playerVehicle:clone(getPlayerVehicle(id))};}
