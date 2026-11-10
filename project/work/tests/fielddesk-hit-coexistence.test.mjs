import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDOM} from './input-dom.mjs';
import {createUI} from '../src/campaign-ui.js';
import {createGame,stepGame} from '../src/campaign-simulation.js';
import {createWorld} from '../src/campaign-world.js';
import {createCombatFeedback} from '../src/combat-feedback.js';
import {listPlayerVehicles,withPlayerVehicle} from '../src/player-vehicles-v3.js';

// CPU ballistic encounter + real UI callbacks. Not the authored convoy route,
// browser layout, asset loading, touch input, or device acceptance.
test('one native UI selects a real vehicle, starts, reports a ballistic hit under warnings, pauses and retries',()=>{
  const dom=makeDOM(),roster=listPlayerVehicles();
  const raw={schema:1,id:'merged-ui-ballistic-encounter',scorchedFront:true,scannedCover:true,
    design:{integratedSlice:true},spawn:{x:8,y:0,z:0,yaw:Math.PI/2},
    bounds:{minX:-30,maxX:30,minZ:-30,maxZ:30},geometry:[],objectives:[],zones:[],
    entities:[{id:'gun',kind:'turret',pose:{x:0,y:0,z:0,yaw:0},hp:90,shieldArc:2.5,range:1}]};
  let spec=withPlayerVehicle(raw,'sandfalcon'),state=createGame(spec),world=createWorld(spec),ui,hit=null;
  const feedback=createCombatFeedback(),calls=[];
  const render=()=>ui.render(state,spec,{}, {hitFeedback:hit,chargeWarnings:{total:3,text:'Three threats',signature:'three'}});
  ui=createUI({...dom,missions:[spec],playerVehicles:roster,
    selectPlayerVehicle:id=>{calls.push('select:'+id);world.dispose();spec=withPlayerVehicle(spec,id);state=createGame(spec);world=createWorld(spec);feedback.reset();hit=null;render();},
    start:()=>{calls.push('start');state=stepGame(state,{start:true},1/60,world);render();},
    pause:()=>{calls.push('pause');state=stepGame(state,{pause:true},1/60,world);render();},
    retry:()=>{calls.push('retry');state=createGame(spec);feedback.reset();hit=null;render();}});
  const get=selector=>dom.mount.querySelector(selector);
  try{
    render();assert.ok(get('.fielddesk-dossier'));assert.equal(dom.mount.querySelectorAll('[data-vehicle-id]').length,5);
    get('[data-vehicle-id="vanguard"]').dispatch('click');
    assert.equal(state.mission.playerVehicle.id,'vanguard');assert.equal(get('.fielddesk-vehicle-title').textContent,roster[0].title);
    get('[data-action="start"]').dispatch('click');assert.equal(state.phase,'playing');assert.equal(state.tick,0);
    let impact=null;
    for(let i=0;i<180;i++){
      state=stepGame(state,{brake:true,aim:{worldPoint:{x:0,y:1,z:0}},firePressed:i>70},1/60,world);
      hit=feedback.update(state,state.events);render();
      impact=state.events.find(event=>event.type==='impact'&&event.entityId==='tank');
      if(impact)break;
    }
    assert.ok(impact,'accepted projectile reaches actual collision target');
    assert.equal(state.entities.gun.hp,45);assert.equal(hit.damage,45);
    assert.equal(get('.campaign-bearing').textContent,'Three threats');
    assert.equal(get('.campaign-hit-confirmation').hidden,false);
    assert.equal(get('.campaign-hit-confirmation').textContent,hit.compactText);
    assert.equal(get('[data-instrument="hp"]').style['--fielddesk-fill'],'1');
    assert.ok(get('.campaign-scanned-firing').textContent.startsWith('−45 · '));
    const unchanged=JSON.stringify(state);render();assert.equal(JSON.stringify(state),unchanged);
    const elapsed=state.elapsed;dom.window.dispatch('keydown',{code:'Escape'});
    assert.equal(state.phase,'paused');assert.equal(state.elapsed,elapsed);
    const text=node=>[node.textContent,...node.children.map(text)].join(' ');
    assert.ok(text(get('.campaign-scanned-details')).includes(hit.text));
    get('[data-action="retry"]').dispatch('click');assert.equal(state.phase,'briefing');assert.equal(state.tick,0);
    assert.equal(state.mission.playerVehicle.id,'vanguard');assert.ok(get('.fielddesk-dossier'));
    assert.equal(get('.campaign-hit-confirmation').hidden,true);
    assert.deepEqual(calls,['select:vanguard','start','pause','retry']);
  }finally{ui.dispose();world.dispose();}
});
