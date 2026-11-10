import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createUI} from '../src/campaign-ui.js';
import {createCombatFeedback} from '../src/combat-feedback.js';
import {makeDOM} from './input-dom.mjs';
// Event/state fixture, not a ballistic replay or browser/device test.
function fixture(){
 const spec={id:'hit-recovery',design:{integratedSlice:true},scannedCover:true,objectives:[],entities:[]};
 const state={mission:spec,phase:'playing',tick:100,elapsed:2,tank:{},tankCombat:{hp:100,reload:.9},entities:{gun:{id:'gun',kind:'turret',alive:true,hp:45}},objectiveStates:{}};
 const event={id:'event-1',tick:100,type:'damaged',entityId:'tank',targetId:'gun',value:45};
 const model=createCombatFeedback(),hit=model.update(state,[event]);
 const charge={total:3,text:'Three threats',accessibilityLabel:'Three aiming enemies',signature:'three'};
 const dom=makeDOM(),ui=createUI({...dom,missions:[spec]});
 const render=(s=state,status={hitFeedback:hit,chargeWarnings:charge})=>ui.render(s,spec,{},status);
 const get=sel=>dom.mount.querySelector(sel);return {spec,state,event,model,hit,charge,ui,render,get};
}
test('production UI preserves warning and simultaneous event-driven hit confirmation',()=>{
 const f=fixture();try{f.render();assert.equal(f.get('.campaign-bearing').textContent,f.charge.text);
 const chip=f.get('.campaign-hit-confirmation');assert.ok(chip,'independent hit channel must exist');assert.equal(chip.hidden,false);assert.equal(chip.textContent,f.hit.compactText);assert.equal(chip.getAttribute('aria-label'),f.hit.text);
 assert.ok(f.get('.campaign-scanned-firing').textContent.startsWith('−45 · '));assert.ok(f.get('.campaign-scanned-firing').getAttribute('aria-label').includes(f.hit.text));
 const before=JSON.stringify(f.state);for(let i=0;i<20;i++)f.render();assert.equal(f.get('.campaign-hit-confirmation'),chip);assert.equal(JSON.stringify(f.state),before);
 }finally{f.ui.dispose();}
});
test('ordinary feedback stays on bearing; missing feedback and nonplaying/loading states clear secondary channel',()=>{
 const f=fixture();try{f.render();const chip=f.get('.campaign-hit-confirmation');assert.ok(chip);
 f.render(f.state,{hitFeedback:f.hit});assert.equal(chip.hidden,true);assert.equal(chip.textContent,'');assert.equal(f.get('.campaign-bearing').textContent,f.hit.text);
 for(const phase of ['paused','won','lost','briefing']){f.render({...f.state,phase});assert.equal(chip.hidden,true);assert.ok(!f.get('.campaign-scanned-firing').textContent.includes('−45'));}
 for(const viewStatus of ['loading','failed']){f.render(f.state,{hitFeedback:f.hit,chargeWarnings:f.charge,viewStatus});assert.equal(chip.hidden,true);}
 f.render(f.state,{chargeWarnings:f.charge});assert.equal(chip.hidden,true);assert.equal(chip.textContent,'');assert.ok(!f.get('.campaign-scanned-firing').getAttribute('aria-label').includes(f.hit.text));
 }finally{f.ui.dispose();}
});
test('existing simulation-time expiry and paused snapshot retain their contracts',()=>{
 const f=fixture();try{f.render();f.render({...f.state,phase:'paused'},{});
 const full=n=>[n.textContent,...n.children.map(full)].join(' ');assert.ok(full(f.get('.campaign-scanned-details')).includes(f.hit.text));
 const later={...f.state,tick:260,elapsed:4.6};assert.equal(f.model.update(later,[f.event]),null);f.render(later,{hitFeedback:null,chargeWarnings:f.charge});assert.equal(f.get('.campaign-hit-confirmation').hidden,true);
 }finally{f.ui.dispose();}
});
test('non-hostile and zero damage events cannot create confirmation',()=>{
 const f=fixture();try{for(const value of [0,NaN]){const model=createCombatFeedback();assert.equal(model.update(f.state,[{...f.event,value}]),null);}
 const state={...f.state,entities:{gun:{kind:'truck',alive:true,hp:45}}};assert.equal(createCombatFeedback().update(state,[f.event]),null);
 }finally{f.ui.dispose();}
});
test('confirmation is noninteractive, theme-based, and not a floating animated overlay',()=>{
 const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');const rule=css.match(/\.campaign-hit-confirmation \{([^}]+)\}/);assert.ok(rule);assert.match(rule[1],/pointer-events: none/);assert.match(rule[1],/color: var\(--ui-ink\)/);assert.doesNotMatch(rule[1],/position:|animation:/);
});
test('real ballistic 45 HP flank hit remains confirmed during simultaneous warnings',async()=>{
 const {createGame,stepGame}=await import('../src/campaign-simulation.js');const {createWorld}=await import('../src/campaign-world.js');
 const spec={schema:1,id:'real-hit-recovery',design:{integratedSlice:true},spawn:{x:8,y:0,z:0,yaw:Math.PI/2},bounds:{minX:-30,maxX:30,minZ:-30,maxZ:30},geometry:[],objectives:[],zones:[],entities:[{id:'gun',kind:'turret',pose:{x:0,y:0,z:0,yaw:0},hp:90,shieldArc:2.5,range:1}]};
 const world=createWorld(spec),dom=makeDOM(),ui=createUI({...dom,missions:[spec]});
 try{let state=stepGame(createGame(spec),{start:true},1/60,world),events=[];
 for(let i=0;i<180;i++){state=stepGame(state,{brake:true,aim:{worldPoint:{x:0,y:1,z:0}},firePressed:i>70},1/60,world);events.push(...state.events);if(events.some(e=>e.type==='impact'&&e.entityId==='tank'))break;}
 assert.equal(state.entities.gun.hp,45);const hit=createCombatFeedback().update(state,events);assert.equal(hit.damage,45);
 ui.render(state,spec,{}, {hitFeedback:hit,chargeWarnings:{total:3,text:'Three threats',signature:'three'}});
 assert.equal(dom.mount.querySelector('.campaign-bearing').textContent,'Three threats');const chip=dom.mount.querySelector('.campaign-hit-confirmation');assert.ok(chip,'real hit must remain visible under concurrent warnings');assert.equal(chip.hidden,false);assert.match(chip.textContent,/45/);
 }finally{ui.dispose();world.dispose();}
});
