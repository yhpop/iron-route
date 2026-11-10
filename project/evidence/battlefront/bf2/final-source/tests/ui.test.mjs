import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeDOM} from './input-dom.mjs';
import {createUI} from '../src/campaign-ui.js';
import {getOptionalMission} from '../src/content/optional-records.js';
import {listMissions} from '../src/content/index.js';
import {createGame} from '../src/campaign-simulation.js';
const spec={id:'mission-001',title:'货运口突破',chapter:1,index:1,briefing:'打开货运通道，让补给车抵达。',objectives:[{id:'breach',type:'breach',targetIds:['wall'],requires:[]},{id:'escort',type:'escort',targetIds:['truck'],requires:['breach']}]};
const progress={schema:1,unlockedIds:['mission-001','mission-002'],bestResults:{},selectedMissionId:'mission-001'};
function setup(extraActions={}) {
 assert.equal(typeof createUI,'function','campaign UI exports createUI'); const dom=makeDOM(); const calls=[];
 const missions=Array.from({length:300},(_,i)=>({id:`mission-${String(i+1).padStart(3,'0')}`,index:i+1,chapter:Math.floor(i/50)+1,title:`任务 ${i+1}`}));
 const actions={...dom,missions,start:()=>calls.push('start'),retry:()=>calls.push('retry'),pause:()=>calls.push('pause'),resume:()=>calls.push('resume'),selectMission:id=>calls.push(id),...extraActions};
 return {...dom,calls,ui:createUI(actions)};
}
function find(mount,name){const result=mount.querySelector(`[data-action="${name}"]`);assert.ok(result,`action ${name} exists`);return result;}
function state(phase='briefing'){return {phase,missionId:spec.id,tank:{pose:{x:0,y:0,z:0,yaw:0},vL:1.2,vR:1.2,governor:'cruise',blocked:{}},tankCombat:{hp:75,maxHp:100,reload:0.4},tankFrame:{speedForward:1.2,canFire:false},objectiveStates:{breach:{status:'active'},escort:{status:'locked'}}};}

test('initial briefing names goals and starts through its explicit action',()=>{
 const {ui,mount,calls}=setup(); ui.render(state(),spec,progress); assert.equal(mount.querySelector('.campaign-dialog').hidden,false);
 assert.ok(mount.querySelector('.campaign-dialog__title').textContent.includes(spec.title)); assert.equal(mount.querySelectorAll('.campaign-brief-objective').length,2);
 find(mount,'start').dispatch('click'); assert.deepEqual(calls,['start']); ui.dispose(); assert.equal(mount.querySelector('.campaign-ui'),null);
});

test('playing HUD is compact and uses actual hp speed and reload without a modal',()=>{
 const {ui,mount}=setup();ui.render(state('playing'),spec,progress); assert.equal(mount.querySelector('.campaign-dialog').hidden,true);
 assert.match(mount.querySelector('[data-stat="hp"]').textContent,/75/); assert.match(mount.querySelector('[data-stat="speed"]').textContent,/4\.3/); assert.match(mount.querySelector('[data-stat="reload"]').textContent,/0\.4/);
 assert.match(mount.querySelector('.campaign-objective').textContent,/突破/); ui.dispose();
});

test('mission selector pauses live play, mounts only one page and rejects locked levels',()=>{
 const {ui,mount,calls}=setup();ui.render(state('playing'),spec,progress);find(mount,'missions').dispatch('click'); assert.deepEqual(calls,['pause']);
 assert.equal(mount.querySelectorAll('[data-mission-id]').length,12); assert.match(mount.querySelector('.campaign-page-label').textContent,/1.*25/);
 const locked=mount.querySelector('[data-mission-id="mission-003"]'); assert.equal(locked.disabled,true); locked.dispatch('click'); assert.deepEqual(calls,['pause']);
 find(mount,'next-page').dispatch('click');assert.equal(mount.querySelectorAll('[data-mission-id]').length,12);assert.ok(mount.querySelector('[data-mission-id="mission-013"]'));
 find(mount,'previous-page').dispatch('click');mount.querySelector('[data-mission-id="mission-002"]').dispatch('click');assert.equal(calls.at(-1),'mission-002');ui.dispose();
});

test('pause resume result retry and keyboard shortcuts invoke state-appropriate actions',()=>{
 const {ui,mount,window,calls}=setup();ui.render(state('playing'),spec,progress);window.dispatch('keydown',{code:'Escape'});assert.equal(calls.at(-1),'pause');
 ui.render(state('paused'),spec,progress);find(mount,'resume').dispatch('click');assert.equal(calls.at(-1),'resume');
 ui.render({...state('lost'),result:{reason:'补给车被击毁'}},spec,progress);assert.match(mount.querySelector('.campaign-dialog__body').textContent,/补给车/);find(mount,'retry').dispatch('click');assert.equal(calls.at(-1),'retry');
 window.dispatch('keydown',{code:'KeyR'});assert.equal(calls.at(-1),'retry');ui.dispose();const count=calls.length;window.dispatch('keydown',{code:'KeyR'});assert.equal(calls.length,count);
});

test('failure message distinguishes tank destruction from a protected vehicle loss',()=>{
 const {ui,mount}=setup(); ui.render({...state('lost'),result:{cause:'tank-destroyed'}},spec,progress); assert.match(mount.querySelector('.campaign-dialog__body').textContent,/你的坦克/);
 ui.render(state('playing'),spec,progress);ui.render({...state('lost'),result:{cause:'protected-vehicle-destroyed'}},spec,progress); assert.match(mount.querySelector('.campaign-dialog__body').textContent,/受保护的补给车/);ui.dispose();
});

test('mission dialog keeps keyboard focus inside even when the chapter select has focus',()=>{
 const {ui,mount,window,document}=setup();ui.render(state('paused'),spec,progress);find(mount,'missions').dispatch('click');
 const select=mount.querySelector('select');select.focus();const event=window.dispatch('keydown',{code:'Tab',shiftKey:true,target:select});assert.equal(event.defaultPrevented,true);assert.notEqual(document.activeElement,select);assert.equal(document.activeElement.closest('.campaign-dialog'),mount.querySelector('.campaign-dialog'));ui.dispose();
});

test('optional sound button follows actual mute getter and never enables sound automatically',()=>{
 let muted=true,toggles=0;const {ui,mount}=setup({soundMuted:()=>muted,toggleSound:()=>{muted=!muted;toggles++;}});ui.render(state('playing'),spec,progress);
 const sound=find(mount,'sound');assert.equal(toggles,0);assert.equal(sound.textContent,'声音关');assert.equal(sound.getAttribute('aria-pressed'),'false');
 sound.dispatch('click');assert.equal(toggles,1);assert.equal(sound.textContent,'声音开');assert.equal(sound.getAttribute('aria-pressed'),'true');
 muted=true;ui.render(state('playing'),spec,progress);assert.equal(sound.textContent,'声音关');ui.dispose();
});
test('HUD explains convoy waiting and warns when progression cannot be saved',()=>{const {ui,mount}=setup();const s=state('playing');s.objectiveStates.breach.status='complete';s.objectiveStates.escort.status='active';s.entities={truck:{kind:'truck',alive:true,arrived:false,stoppedReason:'tank-away'}};ui.render(s,spec,{...progress,storageAvailable:false});assert.match(mount.querySelector('.campaign-convoy-status').textContent,/靠近/);assert.equal(mount.querySelector('.campaign-save-status').hidden,false);ui.render(s,spec,{...progress,storageAvailable:true});assert.equal(mount.querySelector('.campaign-save-status').hidden,true);ui.dispose();});
test('HUD displays supplied on-screen target bearing without exposing raw IDs',()=>{const {ui,mount}=setup();ui.render(state('playing'),spec,{...progress,goalHint:'火力点 ↗ 28 m'});assert.equal(mount.querySelector('.campaign-bearing').textContent,'火力点 ↗ 28 m');ui.dispose();});
test('optional sortie result cannot point to the first campaign mission as next',()=>{const {ui,mount}=setup();const optional={...spec,id:'mission-9001',convoyChoice:{requiresObjectiveId:'breach',options:[{id:'short',zoneId:'short',routeByTruck:{truck:'short-road'}},{id:'covered',zoneId:'covered',routeByTruck:{truck:'covered-road'}}]}};ui.render({...state('won'),missionId:optional.id,selectedConvoyChoiceId:'covered',result:{elapsed:75},entities:{truck:{kind:'truck',hp:140,maxHp:180,alive:true}}},optional,progress);assert.ok(!mount.querySelector('[data-action="next-mission"]'));assert.match(mount.querySelector('.campaign-dialog__body').textContent,/长路/);assert.match(mount.querySelector('.campaign-dialog__body').textContent,/140/);ui.dispose();});
test('pending physical choice gives road instructions instead of an unexplained truck wait',()=>{const {ui,mount}=setup();const optional={...spec,id:'mission-9001',convoyChoice:{requiresObjectiveId:'breach'}};const s={...state('playing'),selectedConvoyChoiceId:null,entities:{truck:{kind:'truck',alive:true,stoppedReason:'route-choice'}}};s.objectiveStates.breach.status='complete';ui.render(s,optional,progress);assert.match(mount.querySelector('.campaign-convoy-status').textContent,/直行/);assert.match(mount.querySelector('.campaign-convoy-status').textContent,/左转/);ui.dispose();});

test('actual breach-cover keeps optional identity through briefing start retry and the ordinary selector',()=>{
 const optional=getOptionalMission('breach-cover'),missions=listMissions();
 const {ui,mount,calls}=setup({missions});let current=createGame(optional);
 ui.render(current,optional,progress);
 assert.equal(mount.querySelector('.campaign-dialog__title').textContent,optional.title);
 assert.equal(mount.querySelector('.campaign-dialog__body').textContent,optional.briefing);
 assert.match(mount.querySelector('.campaign-eyebrow').textContent,/支线.*不影响战役进度/);
 assert.equal(mount.querySelector('.campaign-mission-label').textContent,`支线 · ${optional.title}`);
 assert.equal(mount.querySelectorAll('.campaign-brief-objective').length,1);
 find(mount,'start').dispatch('click');assert.deepEqual(calls,['start']);
 current={...current,phase:'lost',result:{cause:'tank-destroyed'}};ui.render(current,optional,progress);
 assert.match(mount.querySelector('.campaign-eyebrow').textContent,/支线/);
 assert.doesNotMatch(mount.querySelector('.campaign-dialog__body').textContent,/补给车|直行选短路|左转选长路/);
 find(mount,'retry').dispatch('click');assert.equal(calls.at(-1),'retry');
 ui.render(createGame(optional),optional,progress);
 assert.match(mount.querySelector('.campaign-eyebrow').textContent,/支线/);
 find(mount,'open-missions').dispatch('click');
 assert.equal(mount.querySelector('.campaign-page-label').textContent,'1 / 26');
 const cards=mount.querySelectorAll('[data-mission-id]');assert.equal(cards.length,12);
 assert.ok(cards.every(card=>missions.some(mission=>mission.id===card.getAttribute('data-mission-id'))));
 assert.equal(mount.querySelector('[data-mission-id="mission-9002"]'),null);
 assert.equal(mount.querySelector('[data-mission-id="mission-003"]').disabled,true);
 mount.querySelector('[data-mission-id="mission-002"]').dispatch('click');assert.equal(calls.at(-1),'mission-002');
 ui.dispose();
});

test('actual non-convoy optional win displays tank results without truck statistics or a next mission',()=>{
 const optional=getOptionalMission('breach-cover');
 const cases=[
  {elapsed:99,result:{elapsed:42.6,shotsFired:4},combatShots:4,want:/用时 43 秒.*坦克装甲 63\/135.*开火 4 次/},
  {elapsed:99,result:{elapsed:0,shotsFired:0},combatShots:0,want:/用时 0 秒.*坦克装甲 63\/135.*开火 0 次/},
  {elapsed:27.2,result:{},combatShots:3,want:/用时 27 秒.*坦克装甲 63\/135.*开火 3 次/}
 ];
 for(const example of cases){
  const {ui,mount,calls}=setup({missions:listMissions()}),current=createGame(optional);
  ui.render({...current,phase:'won',elapsed:example.elapsed,result:example.result,tankCombat:{...current.tankCombat,hp:63,maxHp:135,shotsFired:example.combatShots}},optional,progress);
  assert.match(mount.querySelector('.campaign-dialog__body').textContent,example.want);
  assert.doesNotMatch(mount.querySelector('.campaign-dialog__body').textContent,/补给车|短路已完成|仓库掩护长路/);
  assert.equal(mount.querySelectorAll('.campaign-truck-health').length,0);
  assert.equal(mount.querySelector('.campaign-convoy-health').hidden,true);
  assert.equal(mount.querySelector('.campaign-convoy-status').hidden,true);
  assert.equal(mount.querySelector('[data-action="next-mission"]'),null);
  assert.match(mount.querySelector('.campaign-eyebrow').textContent,/支线/);
  find(mount,'retry').dispatch('click');assert.deepEqual(calls,['retry']);ui.dispose();
 }
});

test('optional identity requires boolean metadata while ordinary numbering and next action remain intact',()=>{
 for(const flag of [undefined,false,'true']){
  const {ui,mount,calls}=setup(),regular={...spec,optional:flag};ui.render(state('won'),regular,progress);
  assert.equal(mount.querySelector('.campaign-mission-label').textContent,'001 · 货运口突破');
  assert.equal(mount.querySelector('.campaign-eyebrow').textContent,'行动 001');
  find(mount,'next-mission').dispatch('click');assert.deepEqual(calls,['mission-002']);ui.dispose();
 }
 const {ui,mount}=setup();ui.render(state('won'),{...spec,optional:true},progress);
 assert.match(mount.querySelector('.campaign-eyebrow').textContent,/支线/);
 assert.equal(mount.querySelector('[data-action="next-mission"]'),null,'an explicit optional record never offers campaign advancement');ui.dispose();
});

test('actual legacy warehouse fork retains convoy-specific identity and both road result summaries',()=>{
 const optional=getOptionalMission('warehouse-fork');assert.equal(optional.optional,undefined);
 for(const [choice,road] of [['covered','仓库掩护长路'],['short','短路']]){
  const {ui,mount}=setup({missions:listMissions()}),current=createGame(optional);
  current.entities.lead.hp=140;current.entities.rear.hp=150;
  ui.render({...current,phase:'won',selectedConvoyChoiceId:choice,result:{elapsed:75}},optional,progress);
  assert.equal(mount.querySelector('.campaign-mission-label').textContent,`支线 · ${optional.title}`);
  assert.match(mount.querySelector('.campaign-eyebrow').textContent,/支线.*不影响战役进度/);
  assert.equal(mount.querySelector('.campaign-dialog__body').textContent,`${road}已完成 · 用时 75 秒 · 补给车装甲 140/180、150/180`);
  assert.equal(mount.querySelector('[data-action="next-mission"]'),null);ui.dispose();
 }
});

function convoyFixture(phase='playing') {
 const convoySpec={...spec,id:'mission-207',entities:[
  {id:'first-leg',kind:'truck',hp:180},
  {id:'second-leg',kind:'truck',hp:180,activationObjectiveId:'escort-first'},
  {id:'transfer-gun',kind:'turret',hp:90}
 ],objectives:[
  {id:'clear-transfer',type:'disable',targetIds:['transfer-gun'],requires:[]},
  {id:'escort-first',type:'escort',targetIds:['first-leg'],requires:[]},
  {id:'escort-second',type:'escort',targetIds:['second-leg'],requires:['escort-first']}
 ]};
 const convoyState={...state(phase),missionId:convoySpec.id,objectiveStates:{'clear-transfer':{status:'active'},'escort-first':{status:'active'},'escort-second':{status:'locked'}},entities:{
  'first-leg':{...convoySpec.entities[0],alive:true,protected:true,hp:180,maxHp:180,arrived:false,speed:1.5,stoppedReason:null},
  'second-leg':{...convoySpec.entities[1],alive:true,protected:true,hp:168,maxHp:180,arrived:false,speed:0,stoppedReason:'objective'},
  'transfer-gun':{...convoySpec.entities[2],alive:true,status:'cooldown',targetId:'second-leg'}
 }};
 return {convoySpec,convoyState};
}
function truckRow(mount,id) {return mount.querySelector(`[data-truck-id="${id}"]`);}

test('protected relay truck damage is visible while its movement and escort objective are locked',()=>{
 const {ui,mount}=setup();const {convoySpec,convoyState}=convoyFixture();ui.render(convoyState,convoySpec,progress);
 const health=mount.querySelector('.campaign-convoy-health');assert.ok(health,'protected truck health is displayed');assert.equal(health.hidden,false);
 const row=truckRow(mount,'second-leg');assert.ok(row,'locked relay truck is not hidden behind objective activation');
 assert.equal(row.querySelector('.campaign-truck-health__hp').textContent,'168/180');
 assert.match(row.querySelector('.campaign-truck-health__status').textContent,/待命.*已受损/);
 assert.match(row.getAttribute('aria-label'),/补给车 2.*168\/180.*已受损/);
 assert.match(mount.querySelector('.campaign-objective').textContent,/摧毁标记武器/);ui.dispose();
});

test('truck threat text requires a living hostile currently charging at that exact truck',()=>{
 const {ui,mount}=setup();const {convoySpec,convoyState}=convoyFixture();const gun=convoyState.entities['transfer-gun'];
 const cases=[
  {status:'cooldown',alive:true,targetId:'second-leg',aimed:false},
  {status:'charging',alive:true,targetId:'second-leg',aimed:true},
  {status:'charging',alive:true,targetId:'tank',aimed:false},
  {status:'charging',alive:false,targetId:'second-leg',aimed:false},
  {status:'idle',alive:true,targetId:'second-leg',aimed:false}
 ];
 for(const example of cases){Object.assign(gun,example);ui.render(convoyState,convoySpec,progress);const row=truckRow(mount,'second-leg');assert.ok(row);const text=row.querySelector('.campaign-truck-health__status').textContent;assert.equal(text.includes('正被瞄准'),example.aimed,JSON.stringify(example));if(!example.aimed)assert.match(text,/已受损/);}
 gun.kind='truck';gun.alive=true;gun.status='charging';ui.render(convoyState,convoySpec,progress);assert.doesNotMatch(truckRow(mount,'second-leg').querySelector('.campaign-truck-health__status').textContent,/正被瞄准/);
 ui.dispose();
});

test('convoy rows keep authored labels and order through arrival destruction and state reordering',()=>{
 const {ui,mount}=setup();const {convoySpec,convoyState}=convoyFixture();convoySpec.entities[1].label='后段接力车';
 convoySpec.entities.push({id:'decoy',kind:'truck',protected:false},{id:'third',kind:'truck'},{id:'fourth',kind:'truck'});
 convoyState.entities={fourth:{id:'fourth',kind:'truck',alive:true,protected:true,hp:70,maxHp:70},decoy:{id:'decoy',kind:'truck',alive:true,protected:false,hp:40,maxHp:40},third:{id:'third',kind:'truck',alive:true,protected:true,hp:70,maxHp:70},...convoyState.entities};
 ui.render(convoyState,convoySpec,progress);let rows=mount.querySelectorAll('.campaign-truck-health');assert.deepEqual(rows.map(row=>row.getAttribute('data-truck-id')),['first-leg','second-leg','third']);
 assert.equal(truckRow(mount,'decoy'),null);assert.equal(truckRow(mount,'third').querySelector('.campaign-truck-health__label').textContent,'补给车 3');
 assert.equal(truckRow(mount,'second-leg').querySelector('.campaign-truck-health__label').textContent,'后段接力车');
 assert.match(mount.querySelector('.campaign-convoy-overflow').textContent,/另有 1 辆.*未显示/);
 convoyState.entities['first-leg'].arrived=true;convoyState.entities['second-leg'].alive=false;convoyState.entities['second-leg'].hp=0;
 convoyState.entities=Object.fromEntries(Object.entries(convoyState.entities).reverse());ui.render(convoyState,convoySpec,progress);
 assert.equal(truckRow(mount,'second-leg'),rows[1],'rows are not rebuilt on a health update');
 assert.match(rows[0].querySelector('.campaign-truck-health__status').textContent,/已抵达/);assert.match(rows[1].querySelector('.campaign-truck-health__status').textContent,/已击毁/);assert.equal(rows[1].querySelector('.campaign-truck-health__hp').textContent,'0/180');
 assert.equal(rows[2].querySelector('.campaign-truck-health__label').textContent,'补给车 3');ui.dispose();
});

test('convoy health hides for missions without protected trucks and resets across mission changes',()=>{
 const {ui,mount}=setup();const {convoySpec,convoyState}=convoyFixture();ui.render(convoyState,convoySpec,progress);assert.ok(truckRow(mount,'second-leg'));
 ui.render({...state('playing'),entities:{decoy:{id:'decoy',kind:'truck',protected:false,alive:true,hp:40,maxHp:40}}},spec,progress);
 assert.equal(mount.querySelector('.campaign-convoy-health').hidden,true);assert.equal(mount.querySelectorAll('.campaign-truck-health').length,0);ui.dispose();
});

function watchWrites(node) {
 let text=node.textContent,textWrites=0,attributeWrites=0;
 Object.defineProperty(node,'textContent',{configurable:true,get:()=>text,set:value=>{text=value;textWrites++;}});
 const original=node.setAttribute.bind(node);node.setAttribute=(...args)=>{attributeWrites++;return original(...args);};
 return ()=>({textWrites,attributeWrites});
}
test('identical animation frames do not rewrite HUD text or accessible labels',()=>{
 let muted=true;const {ui,mount}=setup({soundMuted:()=>muted,toggleSound:()=>{muted=!muted;}});const {convoySpec,convoyState}=convoyFixture();ui.render(convoyState,convoySpec,{...progress,goalHint:'火力点 ↗ 28 m'});
 const selectors=['.campaign-mission-label','[data-stat="hp"]','[data-stat="speed"]','[data-stat="reload"]','.campaign-objective','.campaign-bearing','.campaign-convoy-status','.campaign-sound-button'];
 const observations=selectors.map(selector=>[selector,watchWrites(mount.querySelector(selector))]);
 const row=truckRow(mount,'second-leg');if(row){observations.push(['truck row',watchWrites(row)]);for(const child of row.children)observations.push([child.className,watchWrites(child)]);}
 for(let frame=0;frame<60;frame++)ui.render(convoyState,convoySpec,{...progress,goalHint:'火力点 ↗ 28 m'});
 for(const [name,counts] of observations)assert.deepEqual(counts(),{textWrites:0,attributeWrites:0},`${name} is unchanged`);
 assert.equal(mount.querySelector('.campaign-objective').getAttribute('aria-live'),'polite');ui.dispose();
});

test('briefing warns about waiting relay protection only with an actual escort activation and initial hostile',()=>{
 const cases=[
  {name:'staged escort with initial turret',edit:()=>{},warn:true},
  {name:'safe staged freight',edit:s=>s.entities.pop(),warn:false},
  {name:'ordinary freight unlock',edit:s=>s.entities[1].activationObjectiveId='clear-transfer',warn:false},
  {name:'independent route fork',edit:s=>{delete s.entities[1].activationObjectiveId;s.convoyChoice={requiresObjectiveId:'clear-transfer'};},warn:false},
  {name:'hostile activates after escort completion',edit:s=>s.entities[2].activationObjectiveId='escort-first',warn:false},
  {name:'hostile starts with active initial objective',edit:s=>Object.assign(s.entities[2],{activationObjectiveId:'clear-transfer',activationPhase:'active'}),warn:true},
  {name:'hostile starts with locked later objective',edit:s=>Object.assign(s.entities[2],{activationObjectiveId:'escort-second',activationPhase:'active'}),warn:false}
 ];
 for(const example of cases){const {ui,mount}=setup();const {convoySpec,convoyState}=convoyFixture('briefing');example.edit(convoySpec);ui.render(convoyState,convoySpec,progress);const warning=mount.querySelector('.campaign-staged-escort-warning');assert.equal(Boolean(warning),example.warn,example.name);if(warning){assert.match(warning.textContent,/等待.*接力.*保护/);assert.match(warning.textContent,/暂时离开.*等待/);assert.match(warning.textContent,/不.*安全/);}ui.dispose();}
});

test('desktop speed controls anchor at the lower safe edge instead of overlapping a growing HUD',async()=>{
 // Static placement contract only: browser/device layout acceptance remains separate.
 const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8');
 const desktop=css.match(/\.campaign-governor\s*\{([^}]+)\}/)?.[1];assert.ok(desktop);
 const declarations=Object.fromEntries(desktop.split(';').filter(part=>part.includes(':')).map(part=>part.split(':').map(value=>value.trim())));
 assert.equal(declarations.top,'auto');assert.equal(declarations.bottom,'var(--ui-safe-bottom)');
 const coarse=css.slice(css.indexOf('@media (any-pointer: coarse)'));
 assert.match(coarse,/\.campaign-governor\s*\{[^}]*bottom:\s*calc\(var\(--ui-safe-bottom\)\s*\+\s*clamp\(108px,\s*17vw,\s*150px\)\s*\+\s*31px\)/);
});

// Resolve only this stylesheet's simple media queries and exact selectors; this
// is a source-level cascade check, not a substitute for browser layout testing.
function styleAt(css, selector, viewport) {
 const result={};
 function mediaMatches(query) {
  return query.split(',').some(branch=>[...branch.matchAll(/\(([\w-]+):\s*([^()]+)\)/g)].every(([,feature,value])=>{
   if(feature==='orientation')return value.trim()===(viewport.width>viewport.height?'landscape':'portrait');
   if(feature==='any-pointer')return value.trim()===viewport.pointer;
   if(feature==='max-width')return viewport.width<=parseFloat(value);
   if(feature==='max-height')return viewport.height<=parseFloat(value);
   return false;
  }));
 }
 function visit(source) {
  let position=0;
  while(position<source.length){const open=source.indexOf('{',position);if(open<0)break;let close=open+1,depth=1;while(depth&&close<source.length){if(source[close]==='{')depth++;if(source[close]==='}')depth--;close++;}
   const head=source.slice(position,open).trim(),body=source.slice(open+1,close-1);
   if(head.startsWith('@media')){if(mediaMatches(head.slice(6)))visit(body);}
   else if(head.split(',').some(value=>value.trim()===selector)){for(const declaration of body.split(';')){const colon=declaration.indexOf(':');if(colon>=0)result[declaration.slice(0,colon).trim()]=declaration.slice(colon+1).trim();}}
   position=close;
  }
 }
 visit(css.replace(/\/\*[\s\S]*?\*\//g,''));return result;
}

// A deliberately limited source-geometry model, not a CSS layout engine. It
// evaluates the authored lengths rather than repeating the intended positions.
// It cannot measure text wrapping, browser layout, or real touch usability.
function lengthAt(value, viewport, variables, percent=0) {
 let expression=value.replace(/var\((--[\w-]+)\)/g,(_,name)=>`(${lengthAt(variables[name],viewport,variables,percent)})`)
  .replace(/env\(safe-area-inset-(top|right|bottom|left)\)/g,(_,edge)=>String(viewport.insets?.[edge]||0))
  .replace(/(-?\d*\.?\d+)(px|dvh|vh|vw|%)/g,(_,number,unit)=>String(Number(number)*({px:1,dvh:viewport.height/100,vh:viewport.height/100,vw:viewport.width/100,'%':percent/100}[unit])))
  .replace(/\bcalc\(/g,'(').replace(/\b(max|min|clamp)\(/g,(_,fn)=>`${fn}(`);
 assert.match(expression,/^[\d\s.,()+*/\-a-z]+$/,'only supported CSS lengths are evaluated');
 assert.ok(!/[a-z]+/.test(expression.replace(/\b(max|min|clamp)\b/g,'')),`unsupported CSS length ${value}`);
 return Function('max','min','clamp',`return (${expression});`)(Math.max,Math.min,(low,n,high)=>Math.max(low,Math.min(n,high)));
}
function controlGeometry(css,viewport) {
 const variables=styleAt(css,':root',viewport);
 const style=(...selectors)=>Object.assign({},...selectors.map(selector=>styleAt(css,selector,viewport)));
 const px=(value,percent=0)=>lengthAt(value,viewport,variables,percent);
 const rect=(x,y,width,height)=>({x,y,width,height,right:x+width,bottom:y+height});
 const placed=(s,parent=rect(0,0,viewport.width,viewport.height))=>{
  const width=px(s.width,parent.width),height=px(s.height,parent.height);
  const x=parent.x+(s.left&&s.left!=='auto'?px(s.left,parent.width):parent.width-px(s.right,parent.width)-width);
  const y=parent.y+parent.height-px(s.bottom,parent.height)-height;
  return rect(x,y,width,height);
 };
 const stick=style('.campaign-stick');Object.assign(variables,stick);
 const drive=placed(style('.campaign-stick','.campaign-stick--drive'));
 const aim=placed(style('.campaign-stick','.campaign-stick--aim'));
 const actions=placed(style('.campaign-touch-actions'));
 const controls={drive,aim};
 for(const action of ['fire','brake','boost'])controls[action]=placed(style('.campaign-touch-button',`.campaign-touch-button--${action}`),actions);
 const governor=style('.campaign-governor'),button=style('.campaign-governor__button');
 const buttonWidth=px(button.width||button['min-width']),buttonHeight=px(button.height||button['min-height']),gap=px(governor.gap);
 const width=governor.width?px(governor.width):3*buttonWidth+2*gap;
 const columns=governor['flex-wrap']==='wrap'?Math.max(1,Math.floor((width+gap)/(buttonWidth+gap))):3;
 const rows=Math.ceil(3/columns),height=rows*buttonHeight+(rows-1)*gap;
 const x=px(governor.left),y=viewport.height-px(governor.bottom)-height;
 for(let i=0;i<3;i++)controls[`governor${i}`]=rect(x+(i%columns)*(buttonWidth+gap),y+Math.floor(i/columns)*(buttonHeight+gap),buttonWidth,buttonHeight);
 return {controls,safe:Object.fromEntries(['top','right','bottom','left'].map(edge=>[edge,px(variables[`--ui-safe-${edge}`])]))};
}
const overlaps=(a,b)=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;

test('short landscape keeps fine-pointer governors at the bottom safe edge',async()=>{
 const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8');
 const desktop=styleAt(css,'.campaign-governor',{width:1024,height:320,pointer:'fine'});
 assert.equal(desktop.top,'auto');assert.equal(desktop.bottom,'var(--ui-safe-bottom)');
});

test('static landscape geometry separates governor and all touch targets at 428px and representative safe insets',async()=>{
 const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8');
 const examples=[
  {width:428,height:320},
  {width:428,height:320,insets:{left:44,bottom:21}},
  {width:428,height:320,insets:{right:44,bottom:21}},
  {width:428,height:320,insets:{left:44,right:44,bottom:21}},
  {width:480,height:320,insets:{left:44,right:44,bottom:21}},
  {width:560,height:320,insets:{left:44,right:44,bottom:21}},
  {width:561,height:320,insets:{left:44,right:44,bottom:21}},
  {width:568,height:320}, {width:800,height:480}, {width:1024,height:560}
 ];
 for(const example of examples){
  const viewport={...example,pointer:'coarse'},context=JSON.stringify(viewport);
  const {controls,safe}=controlGeometry(css,viewport),entries=Object.entries(controls);
  for(const [name,box] of entries){
   assert.ok(box.width>=44&&box.height>=44,`${context}: ${name} keeps a 44px target`);
   assert.ok(box.x>=safe.left&&box.right<=viewport.width-safe.right&&box.y>=safe.top&&box.bottom<=viewport.height-safe.bottom,`${context}: ${name} stays inside safe bounds`);
   if(name.startsWith('governor'))assert.ok(box.y>=200,`${context}: governor stays below the explicit 200px HUD budget`);
  }
  for(let a=0;a<entries.length;a++)for(let b=a+1;b<entries.length;b++)assert.ok(!overlaps(entries[a][1],entries[b][1]),`${context}: ${entries[a][0]} overlaps ${entries[b][0]}`);
  // The top navigation is at least 44px tall. This is only a vertical budget,
  // not a measurement of its rendered text width or the HUD's text height.
  for(const name of ['fire','brake','boost'])assert.ok(controls[name].y>=safe.top+44,`${context}: ${name} stays below the navigation budget`);
 }
});
test('asset attribution lives after pause actions in scrollable dialog, never a fixed menu overlay',async()=>{const dom=makeDOM(),credits=dom.document.createElement('details'),query=dom.document.querySelector.bind(dom.document);dom.document.querySelector=selector=>selector==='#asset-credits'?credits:query(selector);const ui=createUI({...dom,missions:[]});ui.render(state('paused'),spec,progress);const dialog=dom.mount.querySelector('.campaign-dialog');assert.equal(credits.parentElement,dialog);assert.equal(dialog.children.at(-1),credits);assert.equal(dialog.children.at(-2).className,'campaign-dialog__actions');credits.open=true;ui.render(state('playing'),spec,progress);assert.equal(dialog.hidden,true);const html=await readFile(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/<details id="asset-credits" style="position:static/);ui.dispose();});
