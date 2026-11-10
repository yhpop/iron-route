import {DEFAULT_CONFIG} from './tank-controller.js';
// The resolved selection lives in the mission, so replay never consults a mutable registry.
export const playerControllerConfig=spec=>spec?.playerVehicle?.controller||DEFAULT_CONFIG;
export const playerRig=spec=>playerControllerConfig(spec).rig;
export function playerBody(spec){return spec?.playerVehicle?.collision||{width:1.9,depth:2.9,height:1.5,aimHeight:.8};}
export function playerCollider(state){const body=playerBody(state.mission);return {id:'tank',kind:'tank',pose:state.tank.pose,turret:state.tank.turret,rig:playerRig(state.mission),width:body.width,depth:body.depth,height:body.height,hp:state.tankCombat.hp,alive:state.tankCombat.hp>0};}
