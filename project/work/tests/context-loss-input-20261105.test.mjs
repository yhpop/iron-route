// New regression suite. Real main/UI/input/world/simulation, existing fake DOM/GPU/audio/RAF boundaries.
// No native WebGL restoration claim; no terminal override or simulation mutation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,action} from './main-entry-harness.mjs';
import {byControl} from './input-dom.mjs';
const key=(app,code,repeat=false)=>app.window.dispatch('keydown',{code,repeat,target:app.canvas});
const pointer=(node,type,id,x=60,y=0)=>node.dispatch(type,{pointerId:id,pointerType:'touch',button:0,clientX:x,clientY:y});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function assertNeutral(app){const c=app.metrics.lastControls;assert.equal(c.throttle,0);assert.equal(c.steer,0);assert.equal(c.firePressed,false);assert.equal(c.boost,false);assert.equal(c.brake,false);}
function hold(app){for(const code of ['KeyW','KeyD','ShiftLeft','KeyF'])key(app,code);const drive=byControl(app.mount,'drive'),fire=byControl(app.mount,'fire');pointer(drive,'pointerdown',10);pointer(fire,'pointerdown',11);return {drive,fire};}
function assertStopped(app,tick){assert.equal(app.latest.state.tick,tick);assert.equal(app.metrics.inputEnabled,false);assert.equal(app.metrics.audioPaused,true);}

for(const method of ['escape','button'])test(`lost graphics blocks ${method} Resume; restoration still requires explicit clean Resume`,async t=>{
 const app=await boot('?sortie=showcase-flank');t.after(()=>app.dispose());action(app,'start').dispatch('click');const held=hold(app),tick=app.latest.state.tick;
 const lost=app.canvas.dispatch('webglcontextlost');assert.equal(lost.defaultPrevented,true);assert.equal(app.latest.state.phase,'paused');assert.equal(held.drive.captured.size,0);assert.equal(held.fire.captured.size,0);
 if(method==='escape')key(app,'Escape');else action(app,'resume').dispatch('click');
 key(app,'KeyW');key(app,'KeyF');app.frame();assert.equal(app.latest.state.phase,'paused');assertStopped(app,tick);assert.equal(app.help.hidden,false);
 app.canvas.dispatch('webglcontextrestored');app.frame();assert.equal(app.help.hidden,true);assert.equal(app.latest.state.phase,'paused');assertStopped(app,tick);
 action(app,'resume').dispatch('click');for(const code of ['KeyW','KeyD','ShiftLeft','KeyF'])key(app,code,true);pointer(held.drive,'pointermove',10);app.frame();assertNeutral(app);
 app.window.dispatch('keyup',{code:'KeyW'});app.window.dispatch('keyup',{code:'KeyF'});key(app,'KeyW');key(app,'KeyF');app.frame();assert.equal(app.metrics.lastControls.throttle,1);assert.equal(app.metrics.lastControls.firePressed,true);assert.ok(app.latest.state.tick>tick);assert.equal(app.metrics.audioPaused,false);
});

test('briefing context loss blocks Start until restoration without automatically starting',async t=>{
 const app=await boot('?sortie=showcase-flank');t.after(()=>app.dispose());app.canvas.dispatch('webglcontextlost');action(app,'start').dispatch('click');app.frame();assert.equal(app.latest.state.phase,'briefing');assertStopped(app,0);assert.equal(app.help.hidden,false);
 app.canvas.dispatch('webglcontextrestored');assert.equal(app.latest.state.phase,'briefing');action(app,'start').dispatch('click');app.frame();assert.equal(app.latest.state.phase,'playing');assert.ok(app.latest.state.tick>0);assertNeutral(app);
});

test('normal R retry cannot clear graphics loss or enable new-round input before restore',async t=>{
 const app=await boot('?sortie=showcase-flank');t.after(()=>app.dispose());action(app,'start').dispatch('click');hold(app);app.canvas.dispatch('webglcontextlost');key(app,'KeyR');assert.equal(app.latest.state.phase,'briefing');assert.equal(app.help.hidden,false,'retry must preserve loss notice');action(app,'start').dispatch('click');app.frame();assert.equal(app.latest.state.phase,'briefing');assertStopped(app,0);
 app.canvas.dispatch('webglcontextrestored');action(app,'start').dispatch('click');app.frame();assertNeutral(app);assert.equal(app.latest.state.phase,'playing');
});

for(const transition of ['same-id-campaign-return','other-showcase'])test(`${transition} cannot bypass graphics loss via a fresh ready view`,async t=>{
 const app=await boot('?sortie=showcase-flank');t.after(()=>app.dispose());action(app,'start').dispatch('click');hold(app);app.canvas.dispatch('webglcontextlost');
 if(transition==='same-id-campaign-return'){action(app,'return-campaign').dispatch('click');assert.equal(app.latest.spec.id,'crafted20-002');assert.equal(app.latest.status.launchMode,'campaign');}
 else{action(app,'open-missions').dispatch('click');app.mount.querySelector('[data-featured-slug="showcase-escort"]').dispatch('click');await settle();assert.equal(app.latest.spec.id,'crafted20-003');}
 assert.equal(app.latest.state.phase,'briefing');assert.equal(app.help.hidden,false,'selection must preserve loss notice');action(app,'start').dispatch('click');app.frame();assert.equal(app.latest.state.phase,'briefing');assertStopped(app,0);app.canvas.dispatch('webglcontextrestored');action(app,'start').dispatch('click');app.frame();assertNeutral(app);
});

test('asynchronous showcase view readiness cannot reopen input while graphics remain lost',async t=>{
 let release;const ready=new Promise(resolve=>release=resolve);const app=await boot('?sortie=showcase-flank',undefined,{viewReady:spec=>spec.id==='crafted20-003'?ready:undefined});t.after(()=>{release();app.dispose();});action(app,'open-missions').dispatch('click');app.mount.querySelector('[data-featured-slug="showcase-escort"]').dispatch('click');await settle();assert.equal(app.latest.status.viewStatus,'loading');app.canvas.dispatch('webglcontextlost');release();await settle();assert.equal(app.latest.status.viewStatus,'ready');action(app,'start').dispatch('click');app.frame();assert.equal(app.latest.state.phase,'briefing');assertStopped(app,0);assert.equal(app.help.hidden,false);app.canvas.dispatch('webglcontextrestored');action(app,'start').dispatch('click');app.frame();assert.equal(app.latest.state.phase,'playing');assertNeutral(app);
});

test('repeated loss/restoration and bfcache restoration never auto-resume or resurrect held controls',async t=>{
 const app=await boot('?sortie=showcase-flank');t.after(()=>app.dispose());action(app,'start').dispatch('click');hold(app);app.frame();const tick=app.latest.state.tick,storage=JSON.stringify([...app.storage.values]);
 for(let i=0;i<2;i++)app.canvas.dispatch('webglcontextlost');app.window.dispatch('pagehide',{persisted:true});app.window.dispatch('pageshow',{persisted:true});key(app,'Escape');app.frame();assert.equal(app.latest.state.phase,'paused');assertStopped(app,tick);
 for(let i=0;i<2;i++)app.canvas.dispatch('webglcontextrestored');app.frame();assert.equal(app.latest.state.phase,'paused');assertStopped(app,tick);assert.equal(JSON.stringify([...app.storage.values]),storage);action(app,'resume').dispatch('click');for(const code of ['KeyW','KeyD','ShiftLeft','KeyF'])key(app,code,true);app.frame();assertNeutral(app);
});

test('permanent pagehide detaches context callbacks instead of reopening disposed recovery UI',async()=>{
 const app=await boot('?sortie=showcase-flank');action(app,'start').dispatch('click');hold(app);app.canvas.dispatch('webglcontextlost');app.dispose();const before={hidden:app.help.hidden,text:app.help.textContent,frames:app.metrics.framesScheduled,worldCreates:app.metrics.worldCreates};app.canvas.dispatch('webglcontextrestored');app.canvas.dispatch('webglcontextlost');key(app,'Escape');app.frame();assert.equal(app.help.hidden,before.hidden);assert.equal(app.help.textContent,before.text);assert.equal(app.metrics.framesScheduled,before.frames);assert.equal(app.metrics.worldCreates,before.worldCreates);assert.equal(app.canvas.listeners.get('webglcontextlost')?.size||0,0);assert.equal(app.canvas.listeners.get('webglcontextrestored')?.size||0,0);assert.equal(app.mount.querySelector('.campaign-controls'),null);
});

for(const stage of ['art','tank'])test(`context loss during initial ${stage} load remains gated after boot completes`,async t=>{
 let release;const pending=new Promise(resolve=>release=resolve);const app=await boot('?sortie=showcase-flank',undefined,{[`${stage}Ready`]:pending,expectBootFailure:true});t.after(()=>{release();app.dispose();});assert.equal(app.latest,undefined);const lost=app.canvas.dispatch('webglcontextlost');assert.equal(lost.defaultPrevented,true,'register app recovery before awaiting initial assets');release();await settle();assert.equal(app.latest.state.phase,'briefing');assert.equal(app.help.hidden,false,'boot completion must not hide an outstanding loss');action(app,'start').dispatch('click');app.frame();assert.equal(app.latest.state.phase,'briefing');assertStopped(app,0);app.canvas.dispatch('webglcontextrestored');action(app,'start').dispatch('click');app.frame();assert.equal(app.latest.state.phase,'playing');assertNeutral(app);
});

test('initial loss followed by restoration before assets are ready neither starts nor permanently blocks play',async t=>{
 let release;const artReady=new Promise(resolve=>release=resolve);const app=await boot('?sortie=showcase-flank',undefined,{artReady,expectBootFailure:true});t.after(()=>{release();app.dispose();});app.canvas.dispatch('webglcontextlost');app.canvas.dispatch('webglcontextrestored');app.canvas.dispatch('webglcontextrestored');assert.equal(app.latest,undefined);release();await settle();assert.equal(app.latest.state.phase,'briefing');assert.equal(app.help.hidden,true);action(app,'start').dispatch('click');app.frame();assert.equal(app.latest.state.phase,'playing');assertNeutral(app);
});

for(const end of ['failure','dispose'])test(`initial ${end} detaches early context listeners and cannot resurrect UI`,async()=>{
 let release;const artReady=new Promise(resolve=>release=resolve);const app=await boot('?sortie=showcase-flank',undefined,{artReady,expectBootFailure:true,...(end==='failure'?{artError:new Error('deliberate early asset failure')}: {})});app.canvas.dispatch('webglcontextlost');if(end==='dispose')app.dispose();release();await settle();const before={hidden:app.help.hidden,text:app.help.textContent,children:[...app.help.children],errors:[...app.errors]};app.canvas.dispatch('webglcontextrestored');assert.equal(app.help.hidden,before.hidden);assert.deepEqual(app.help.children,before.children);app.canvas.dispatch('webglcontextlost');assert.equal(app.help.hidden,before.hidden);assert.equal(app.help.textContent,before.text);assert.deepEqual(app.errors,before.errors);assert.equal(app.latest,undefined);assert.equal(app.canvas.listeners.get('webglcontextlost')?.size||0,0);assert.equal(app.canvas.listeners.get('webglcontextrestored')?.size||0,0);app.dispose();
});
