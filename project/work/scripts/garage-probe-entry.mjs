/** UI-only native production dialog. No frame loop, WebGL, audio or battle acceptance. */
import {createUI} from '../src/campaign-ui.js';
import {createEightNpcCrossfire} from '../src/eight-npc-crossfire-front.js';
import {listPlayerVehicles,withPlayerVehicle} from '../src/player-vehicles-v3.js';
import {createGame,stepGame} from '../src/campaign-simulation.js';
const mount=document.body,params=new URLSearchParams(location.search),vehicles=listPlayerVehicles();
let spec=withPlayerVehicle(createEightNpcCrossfire().spec,vehicles.some(v=>v.id===params.get('vehicle'))?params.get('vehicle'):'sandfalcon'),state=createGame(spec),ui;
let viewStatus=['loading','failed'].includes(params.get('viewStatus'))?params.get('viewStatus'):'ready';
const back=document.querySelector('#probe-return'),notice=document.querySelector('#probe-notice');
function render(){ui.render(state,spec,{unlockedIds:[spec.id],bestResults:{}},{viewStatus,viewError:viewStatus==='failed'?'UI-only fixture':''});back.hidden=state.phase!=='playing';notice.textContent=state.phase==='playing'?'UI-only: Start activated. No battlefield is running.':'UI-only: production garage DOM/CSS. No battlefield validation.';}
ui=createUI({document,window,mount,missions:[spec],playerVehicles:vehicles,
 selectPlayerVehicle(id){spec=withPlayerVehicle(spec,id);state=createGame(spec);render();},
 start(){state=stepGame(state,{start:true});render();},pause(){state=stepGame(state,{pause:true});render();},resume(){state=stepGame(state,{resume:true});render();},
 retry(){state=createGame(spec);viewStatus='ready';render();},selectMission(){state=createGame(spec);render();}});
back.addEventListener('click',()=>{state=createGame(spec);render();});render();
window.addEventListener('pagehide',()=>ui.dispose(),{once:true});
