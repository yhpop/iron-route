import {createGame} from '../../src/campaign-simulation.js';
import {stepCombat} from '../../src/combat.js';
import {createWorld} from '../../src/campaign-world.js';
import {getTankTransform} from '../../src/tank-controller.js';

/** Inspection fixtures, NOT new missions or altered production combat. Five
 * cases use the unmodified combat step and its actual events. Ground is the
 * explicit synthetic exception: production currently emits no ground contact. */
export function createFxFixture(kind='masonry'){
 const wall={id:'wall',kind:'box',x:0,y:0,z:-2,yaw:0,width:6,depth:.8,height:2.6,...(kind==='breakup'?{destructible:true,hp:45}:{})};
 const turret={id:'gun',kind:'turret',pose:{x:0,y:0,z:-2,yaw:Math.PI},hp:300,range:kind==='charge'?30:.1,...(kind==='shield'?{shieldArc:Math.PI}:{} )};
 const spec={schema:1,id:`fx-inspection-${kind}`,spawn:{x:0,y:0,z:7,yaw:0},bounds:{minX:-12,maxX:12,minZ:-12,maxZ:12},geometry:['masonry','breakup'].includes(kind)?[wall]:[],entities:['metal','shield','charge'].includes(kind)?[turret]:[],routes:[],zones:[],objectives:[]};
 const state=createGame(spec),world=createWorld(spec);state.phase='playing';let elapsed=0,fired=false,groundShown=false;
 return {kind,spec,state,synthetic:kind==='ground',advance(dt=1/60){
  elapsed+=dt;state.tick++;state.elapsed=elapsed;state.events=[];
  const fire=!fired&&elapsed>=.12&&kind!=='charge'&&kind!=='ground';if(fire)fired=true;
  const muzzle=getTankTransform(state.tank);
  stepCombat(state,dt,world,fire?[{type:'fire',muzzle:{position:muzzle.position,direction:muzzle.direction}}]:[]);
  if(kind==='ground'&&!groundShown&&elapsed>=.12){groundShown=true;state.events.push({id:'synthetic-ground-only',type:'impact',targetId:'ground',entityId:'inspector',position:{x:0,y:.045,z:-2},value:'synthetic-inspector-only'});}
  return {state,events:state.events,elapsed};
 },dispose(){world.dispose();}};
}
