import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createGame,stepGame} from '../src/campaign-simulation.js';import {createWorld} from '../src/campaign-world.js';
import {createUI} from '../src/campaign-ui.js';import {makeDOM} from './input-dom.mjs';
const mod=await import('../src/combat-feedback.js').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const feedback=()=>{assert.equal(typeof mod.createCombatFeedback,'function','event-driven feedback model must exist');return mod.createCombatFeedback();};
function encounter(flank=false){return {schema:1,id:'feedback-fixture',design:{integratedSlice:true},spawn:{x:flank?8:0,y:0,z:flank?0:-8,yaw:flank?Math.PI/2:Math.PI},bounds:{minX:-30,maxX:30,minZ:-30,maxZ:30},geometry:[],objectives:[],zones:[],entities:[{id:'gun',kind:'turret',pose:{x:0,y:0,z:0,yaw:0},hp:90,shieldArc:2.5,range:1}]};}
function actualShot(flank=false){const spec=encounter(flank),world=createWorld(spec);let state=stepGame(createGame(spec),{start:true},1/60,world),events=[];try{for(let i=0;i<180;i++){state=stepGame(state,{brake:true,aim:{worldPoint:{x:0,y:1,z:0}},firePressed:i>70},1/60,world);events.push(...state.events);if(events.some(e=>e.type==='impact'&&e.entityId==='tank'))break;}assert.ok(events.some(e=>e.type==='impact'&&e.entityId==='tank'),'physical shot must really hit');return {spec,state,events};}finally{world.dispose();}}
test('real frontal shot explains no damage; real flank shot confirms actual HP loss',()=>{
 const front=actualShot(),before=JSON.stringify(front),model=feedback(),blocked=model.update(front.state,front.events);
 assert.equal(front.state.entities.gun.hp,90);assert.equal(blocked.kind,'blocked');assert.equal(blocked.targetId,'gun');assert.match(blocked.text,/挡弹/);assert.match(blocked.text,/绕侧/);assert.equal(JSON.stringify(front),before);
 const flank=actualShot(true),hit=feedback().update(flank.state,flank.events);assert.equal(flank.state.entities.gun.hp,45);assert.equal(hit.kind,'damage');assert.equal(hit.damage,45);assert.match(hit.text,/45/);assert.doesNotMatch(hit.text,/挡弹/);
});
test('no invented success from aim, ordinary impacts, terrain, friendly targets or hostile shells',()=>{
 const {state}=actualShot();const model=feedback();assert.equal(model.update(state,[]),null);
 const common={tick:state.tick,entityId:'tank',targetId:'gun'};
 for(const [index,event] of [{type:'shot'},{type:'impact',value:'hit'},{type:'impact',value:'shield',targetId:'terrain'},{type:'impact',value:'shield',entityId:'enemy'},{type:'damaged',value:0},{type:'damaged',value:NaN},{type:'damaged',value:45,targetId:'supply'}].entries())assert.equal(model.update({...state,entities:{...state.entities,supply:{kind:'truck',alive:true}}},[{...common,...event,id:`event-${200+index}`}]),null);
 const legacy={...state,mission:{...state.mission,design:{}}};assert.equal(feedback().update(legacy,[{...common,id:'event-900',type:'impact',value:'shield'}]),null);
});
test('lifetime is simulation time; duplicate render, pause, retry and stale event cannot renew it',()=>{
 const {state,events}=actualShot(),model=feedback(),first=model.update(state,events);assert.ok(first);
 for(let i=0;i<50;i++)assert.deepEqual(model.update(state,events),first);
 assert.equal(model.update({...state,phase:'paused'},events),null);assert.deepEqual(model.update(state,[]),first);
 assert.equal(model.update({...state,tick:state.tick+160,elapsed:state.elapsed+2.6},events),null);
 assert.equal(model.update({...state,tick:state.tick+161,elapsed:state.elapsed+2.7},events),null);
 model.reset();assert.equal(model.update(createGame(state.mission),[]),null);
 assert.equal(model.update({...state,phase:'lost'},events),null);
});
test('later effective hit replaces flank advice; dead enemy cannot retain stale flank advice',()=>{
 const {state,events}=actualShot(),model=feedback();model.update(state,events);
 assert.equal(model.update({...state,entities:{...state.entities,gun:{...state.entities.gun,alive:false,destroyed:true}}},[]),null);
 const model2=feedback();model2.update(state,events);const hit=model2.update({...state,tick:state.tick+1},[{id:'event-999',tick:state.tick+1,type:'damaged',entityId:'tank',targetId:'gun',value:45}]);assert.equal(hit.kind,'damage');assert.doesNotMatch(hit.text,/挡弹/);
});
test('existing bearing gives urgent charge priority, then feedback, then goal; compact retains full accessible text',()=>{
 const spec=encounter(),state={...createGame(spec),phase:'playing'},dom=makeDOM(),ui=createUI({...dom,missions:[spec]}),progress={goalHint:'任务方向',unlockedIds:[spec.id]};
 const hit={kind:'blocked',eventId:'event-1',targetId:'gun',text:'炮位正面装甲挡弹 · 尝试绕侧攻击',compactText:'挡弹 · 绕侧',minimalText:'挡弹'};
 ui.render(state,spec,progress,{hitFeedback:hit});const bearing=dom.mount.querySelector('.campaign-bearing');assert.equal(bearing.textContent,hit.text);assert.equal(bearing.getAttribute('data-hit-feedback'),'blocked');
 Object.defineProperty(bearing,'clientWidth',{get:()=>100,configurable:true});Object.defineProperty(bearing,'scrollWidth',{get:()=>bearing.textContent.length*10,configurable:true});
 ui.render(state,spec,progress,{hitFeedback:hit});assert.equal(bearing.textContent,hit.compactText);assert.equal(bearing.getAttribute('aria-label'),hit.text);
 const charge={total:1,text:'瞄你 1秒',accessibilityLabel:'敌人正在瞄准你',signature:'one'};ui.render(state,spec,progress,{hitFeedback:hit,chargeWarnings:charge});assert.equal(bearing.textContent,charge.text);assert.equal(bearing.getAttribute('data-hit-feedback'),'none');
 ui.render(state,spec,progress,{});assert.equal(bearing.textContent,progress.goalHint);
 ui.render({...state,phase:'paused'},spec,progress,{hitFeedback:hit});assert.equal(bearing.getAttribute('data-hit-feedback'),'none');ui.dispose();
});
test('main captures the accumulated fixed-step events before the render drains them, and resets on selection',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');assert.match(main,/hitFeedback\.update\(state,pendingEvents\)/);assert.ok(main.indexOf('hitFeedback.update(state,pendingEvents)')<main.lastIndexOf('pendingEvents=[];ui.render'));assert.match(main,/hitFeedback\.reset\(\)/);assert.match(main,/hitFeedback:hitFeedback\.update\(state\)/);
});
