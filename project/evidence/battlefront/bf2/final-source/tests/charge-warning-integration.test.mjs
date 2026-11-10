import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDOM} from './input-dom.mjs';
import {createUI} from '../src/campaign-ui.js';
import {createGame} from '../src/campaign-simulation.js';
import {getCraftedMission} from '../src/content/crafted20/index.js';
import {boot,action,makeStorage,CURRENT_PROGRESS_KEY} from './main-entry-harness.mjs';
import {FakeElement} from './input-dom.mjs';
import {byControl} from './input-dom.mjs';
import * as THREE from 'three';

function setup(t,options={}) {
 const dom=makeDOM(),spec=getCraftedMission('crafted20-002'),state={...createGame(spec),phase:'playing'};
 if(options.fonts)dom.document.fonts=options.fonts;
 const ui=createUI({...dom,missions:[spec]});t.after(()=>ui.dispose());
 const progress={unlockedIds:[spec.id],goalHint:'火力点 ↗ 18 m'};
 const warnings={entries:[{id:'gun-a'},{id:'gun-b'}],text:'瞄你↗1.8秒 · 瞄车↙0.7秒',fallbackText:'2处蓄力·你1车1·最快0.7秒',compactText:'你1车1·最快0.7秒',minimalText:'2处·0.7s',accessibilityLabel:'右上方武器正在瞄准你，1.8秒；左下方武器正在瞄准补给车，0.7秒',signature:'gun-a:tank:NE|gun-b:truck:SW',total:2,overflow:0};
 return {...dom,spec,state,ui,progress,warnings};
}

// Dropping render-status warnings or adding a separate floating panel must fail.
test('actual UI substitutes both charge entries in the existing bearing line and restores the goal',t=>{
 const a=setup(t);a.ui.render(a.state,a.spec,a.progress);const bearing=a.mount.querySelector('.campaign-bearing'),hud=a.mount.querySelector('.campaign-hud'),children=[...hud.children];
 a.ui.render(a.state,a.spec,a.progress,{chargeWarnings:a.warnings});
 assert.equal(a.mount.querySelector('.campaign-bearing'),bearing);
 assert.deepEqual(hud.children,children,'no additional HUD surface is introduced');
 assert.equal(bearing.textContent,a.warnings.text);assert.equal(bearing.hidden,false);
 assert.equal(bearing.getAttribute('data-charge-warning'),'true');
 assert.equal(bearing.getAttribute('aria-label'),a.warnings.accessibilityLabel);
 assert.notEqual(bearing.getAttribute('aria-live'),'assertive','countdown must not become repeated spoken alerts');
 a.ui.render(a.state,a.spec,a.progress,{chargeWarnings:{entries:[],text:'',total:0}});
 assert.equal(bearing.textContent,a.progress.goalHint);assert.equal(bearing.getAttribute('data-charge-warning'),'false');
 assert.equal(bearing.getAttribute('aria-label'),a.progress.goalHint);
});

// Actual layout metrics are a browser boundary; this controlled narrow-row
// fixture catches missing overflow handling without pretending to render fonts.
test('measured narrow bearing uses an explicit count summary rather than silently clipping simultaneous warnings',t=>{
 const a=setup(t);a.ui.render(a.state,a.spec,a.progress);const bearing=a.mount.querySelector('.campaign-bearing');
 Object.defineProperty(bearing,'clientWidth',{get:()=>196});
 Object.defineProperty(bearing,'scrollWidth',{get:()=>bearing.textContent===a.warnings.text?245:184});
 a.ui.render(a.state,a.spec,a.progress,{chargeWarnings:a.warnings});
 assert.equal(bearing.textContent,a.warnings.fallbackText);
 assert.equal(bearing.getAttribute('data-charge-summary'),'true');
 assert.match(bearing.getAttribute('aria-label'),/右上方.*左下方/,'full directions stay available rather than disappearing');
 a.ui.render(a.state,a.spec,a.progress);assert.equal(bearing.getAttribute('data-charge-summary'),'false');
});

// Regression from independent review: the first fallback can itself overflow
// the 137 px content budget allowed by the existing short-landscape HUD CSS.
for(const [width,want,detail]of [[137,'compactText','compact'],[67,'minimalText','minimal'],[36,null,'count-only']])test(`warning measures every fallback at ${width}px instead of clipping a simultaneous charge`,t=>{
 const a=setup(t);a.ui.render(a.state,a.spec,a.progress);const bearing=a.mount.querySelector('.campaign-bearing');
 const lengths=new Map([[a.warnings.text,245],[a.warnings.fallbackText,184],[a.warnings.compactText,120],[a.warnings.minimalText,56],['⚠2',25]]);
 Object.defineProperty(bearing,'clientWidth',{get:()=>width});Object.defineProperty(bearing,'scrollWidth',{get:()=>lengths.get(bearing.textContent)||80});
 a.ui.render(a.state,a.spec,a.progress,{chargeWarnings:a.warnings});
 assert.equal(bearing.textContent,want?a.warnings[want]:'⚠2');assert.ok(bearing.scrollWidth<=bearing.clientWidth);
 assert.equal(bearing.getAttribute('data-charge-detail'),detail);
 assert.match(bearing.getAttribute('aria-label'),/右上方.*左下方/);
 if(detail==='count-only')assert.match(bearing.getAttribute('aria-label'),/0.7秒/,'degraded visual mode must still retain actual timing accessibly');
});

test('identical narrow warnings cache the measured representation but width, text, font and semantic changes invalidate it',t=>{
 const fonts=new FakeElement('fonts'),a=setup(t,{fonts});a.ui.render(a.state,a.spec,a.progress);const bearing=a.mount.querySelector('.campaign-bearing');
 let width=67,font='12px test-font',text=bearing.textContent,writes=0,reads=0;
 a.window.getComputedStyle=()=>({font,letterSpacing:'.36px',wordSpacing:'0px'});
 const lengths=new Map([[a.warnings.text,245],[a.warnings.fallbackText,184],[a.warnings.compactText,120],[a.warnings.minimalText,56],['⚠2',25]]);
 Object.defineProperty(bearing,'textContent',{get:()=>text,set:value=>{text=value;writes++;}});
 Object.defineProperty(bearing,'clientWidth',{get:()=>width});Object.defineProperty(bearing,'scrollWidth',{get:()=>{reads++;return lengths.get(text)||80;}});
 for(let i=0;i<60;i++)a.ui.render(a.state,a.spec,a.progress,{chargeWarnings:a.warnings});
 assert.equal(text,a.warnings.minimalText);assert.ok(writes<=4,`${writes} redundant text writes`);assert.ok(reads<=5,`${reads} redundant width reads`);
 const before=reads;width=137;a.ui.render(a.state,a.spec,a.progress,{chargeWarnings:a.warnings});assert.equal(text,a.warnings.compactText);assert.ok(reads>before);
 for(const change of ['font','text','semantic']){
  const before=reads;
  if(change==='font')font='13px test-font';
  if(change==='text')a.warnings={...a.warnings,text:'瞄你↗1.7秒 · 瞄车↙0.6秒'};
  if(change==='semantic')a.warnings={...a.warnings,signature:'new-targets'};
  a.ui.render(a.state,a.spec,a.progress,{chargeWarnings:a.warnings});assert.ok(reads>before,`${change} invalidates cached measurement`);
 }
 const beforeFontLoad=reads;fonts.dispatch('loadingdone');a.ui.render(a.state,a.spec,a.progress,{chargeWarnings:a.warnings});assert.ok(reads>beforeFontLoad,'font swap with unchanged computed CSS still invalidates');
 a.ui.dispose();assert.equal(fonts.listeners.get('loadingdone').size,0,'dispose removes the owned font listener');
});

// A cached model result must not leak through a phase/loading transition.
for(const phase of ['briefing','paused','won','lost'])test(`UI clears charge substitution immediately in ${phase}`,t=>{
 const a=setup(t);a.ui.render(a.state,a.spec,a.progress,{chargeWarnings:a.warnings});
 a.ui.render({...a.state,phase},a.spec,a.progress,{chargeWarnings:a.warnings});
 assert.equal(a.mount.querySelector('.campaign-bearing').textContent,a.progress.goalHint);
 assert.equal(a.mount.querySelector('.campaign-bearing').getAttribute('data-charge-warning'),'false');
});
test('loading/failed view cannot expose stale combat warning and empty hints remain hidden',t=>{
 const a=setup(t);
 for(const viewStatus of ['loading','failed']) {
  a.ui.render(a.state,a.spec,{...a.progress,goalHint:''},{viewStatus,chargeWarnings:a.warnings});
  const bearing=a.mount.querySelector('.campaign-bearing');assert.equal(bearing.textContent,'');assert.equal(bearing.hidden,true);
 }
});

test('touch briefing explains released world aim without promising automatic fire or mandatory three fingers',t=>{
 const a=setup(t);a.ui.render({...a.state,phase:'briefing'},a.spec,a.progress);
 const text=a.mount.querySelector('.campaign-touch-hint').textContent;
 assert.match(text,/松开.*瞄准.*保留|松开.*保留.*瞄准/);
 assert.match(text,/再.*点按开火/);assert.doesNotMatch(text,/自动开火|必须.*三/);
});

// Real main, simulation, keyboard adapter, UI and Three camera. Only WebGL/art,
// audio, RAF and browser DOM are the existing harness boundaries.
test('source main exposes the actual offscreen 003 charge, clears on pause/zoom/retry and never fires itself',async t=>{
 const storage=makeStorage();storage.values.set(CURRENT_PROGRESS_KEY,JSON.stringify({schema:1,selectedMissionId:'crafted20-003',unlockedIds:['crafted20-001','crafted20-002','crafted20-003'],bestResults:{}}));
 const viewport=new FakeElement('visualviewport');Object.assign(viewport,{scale:1,width:390,height:664,offsetLeft:0,offsetTop:0});
 const app=await boot('',storage,{viewport});t.after(()=>app.dispose());
 Object.assign(app.canvas,{clientWidth:390,clientHeight:664});app.canvas.rect={left:0,top:0,width:390,height:664};app.window.dispatch('resize');app.frame();
 action(app,'start').dispatch('click');app.window.dispatch('keydown',{code:'Digit3'});app.window.dispatch('keydown',{code:'Space'});
 for(let i=0;i<36;i++)app.frame();app.window.dispatch('keyup',{code:'Space'});app.window.dispatch('keydown',{code:'KeyW'});
 while(app.latest.state.tick<400 && app.latest.state.entities['bend-gun'].status!=='charging')app.frame();
 const gun=app.latest.state.entities['bend-gun'],bearing=app.mount.querySelector('.campaign-bearing');
 assert.equal(app.latest.state.tick,272,'actual keyboard opening reaches the recorded first charge');
 assert.equal(gun.targetId,'tank');assert.equal(gun.status,'charging');
 assert.equal(bearing.textContent,'瞄你↗1.8秒','source-main projection wires the real offscreen right/upper source');
 assert.equal(app.metrics.lastControls.firePressed,false);
 const elapsed=gun.chargeElapsed;
 action(app,'pause').dispatch('click');assert.doesNotMatch(bearing.textContent,/瞄你|瞄车/);app.frame();assert.equal(app.latest.state.entities['bend-gun'].chargeElapsed,elapsed);
 action(app,'resume').dispatch('click');assert.equal(bearing.textContent,'瞄你↗1.8秒');app.frame();assert.equal(app.metrics.lastControls.throttle,0);assert.equal(app.metrics.lastControls.firePressed,false);
 viewport.scale=2;viewport.width=195;viewport.height=332;viewport.dispatch('resize');assert.equal(app.latest.state.phase,'paused');assert.doesNotMatch(bearing.textContent,/瞄你|瞄车/);
 viewport.scale=1;viewport.width=390;viewport.height=664;viewport.dispatch('resize');assert.equal(app.latest.state.phase,'paused');
 action(app,'resume').dispatch('click');assert.match(bearing.textContent,/瞄你↗/);
 app.uiActions.retry();assert.equal(app.latest.state.phase,'briefing');assert.doesNotMatch(bearing.textContent,/瞄你|瞄车/);
 app.uiActions.selectMission('crafted20-002');assert.equal(app.latest.spec.id,'crafted20-002');assert.doesNotMatch(bearing.textContent,/瞄你|瞄车/);
 assert.ok(storage.writes.every(({value})=>!value.includes('chargeWarnings')&&!value.includes('瞄你')),'render-only warning never reaches the progress schema');
});

test('source-main held touch and mouse aim use the unchanged render-camera rays through resize/orientation, then released aim survives fire',async t=>{
 const app=await boot();t.after(()=>app.dispose());
 const setSize=(width,height,left=0,top=0)=>{Object.assign(app.canvas,{clientWidth:width,clientHeight:height});app.canvas.rect={left,top,width,height};app.window.dispatch('resize');};
 setSize(390,664);app.frame();action(app,'start').dispatch('click');
 const pointer=(node,type,id,x,y,pointerType='touch')=>node.dispatch(type,{pointerId:id,pointerType,button:0,clientX:x,clientY:y});
 const aim=byControl(app.mount,'aim');pointer(aim,'pointerdown',1,90,30); // Raw(.5,-.5), independent of stick response.
 function expectedAt(x,y) {
  const camera=app.metrics.renderCamera.clone(),r=app.canvas.rect,ray=new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2((x-r.left)/r.width*2-1,1-(y-r.top)/r.height*2),camera);
  const p=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-.8),new THREE.Vector3());
  const pose=app.latest.state.tank.pose,d=Math.hypot(p.x-pose.x,p.z-pose.z),scale=Math.min(1,50/d);
  return {x:pose.x+(p.x-pose.x)*scale,y:p.y,z:pose.z+(p.z-pose.z)*scale};
 }
 function compare(expected) {app.frame();for(const k of ['x','y','z'])assert.ok(Math.abs(app.metrics.lastControls.aim.worldPoint[k]-expected[k])<1e-7,k);assert.equal(app.metrics.lastControls.firePressed,false);}
 for(const [w,h,left,top]of [[390,664,0,0],[844,390,12,7],[820,1180,0,0],[1280,720,0,0]]){
  setSize(w,h,left,top);const range=Math.min(w,h)*.46;
  compare(expectedAt(left+w/2+.5*range,top+h/2-.5*range));
 }
 pointer(aim,'pointerup',1,90,30);const released={...app.metrics.lastControls.aim.worldPoint};
 app.window.dispatch('keydown',{code:'KeyW'});for(let i=0;i<20;i++)app.frame();assert.deepEqual(app.metrics.lastControls.aim.worldPoint,released);
 const fire=byControl(app.mount,'fire');pointer(fire,'pointerdown',2,60,60);app.frame();assert.equal(app.metrics.lastControls.firePressed,true);assert.deepEqual(app.metrics.lastControls.aim.worldPoint,released);
 pointer(fire,'pointerup',2,60,60);app.frame();assert.equal(app.metrics.lastControls.firePressed,false);
 const expected=expectedAt(400,300);pointer(app.canvas,'pointermove',3,400,300,'mouse');compare(expected);
});
