import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,action} from './main-entry-harness.mjs';
import {byControl,FakeElement} from './input-dom.mjs';

function touch(app,type,target,count=1) {
 return app.document.dispatch(type,{target,cancelable:true,touches:Array.from({length:count},()=>({target}))});
}
function pointer(node,type,id,x=60,y=0) {
 node.dispatch(type,{pointerId:id,pointerType:'touch',button:0,clientX:x,clientY:y});
}

test('actual main guards native gameplay touches without stealing dual-stick/action ownership or click menus',async t=>{
 const app=await boot();t.after(()=>app.dispose());
 assert.notEqual(touch(app,'touchstart',app.canvas).defaultPrevented,true,'briefing keeps reading gestures');
 action(app,'start').dispatch('click');
 const drive=byControl(app.mount,'drive'),aim=byControl(app.mount,'aim');
 for(const [id,kind] of [[1,'drive'],[2,'aim'],[3,'fire'],[4,'brake'],[5,'boost']]) {
  const node=byControl(app.mount,kind);pointer(node,'pointerdown',id);
  assert.equal(touch(app,'touchstart',node,id).defaultPrevented,true);
 }
 pointer(aim,'pointermove',2,120,60);
 assert.equal(touch(app,'touchmove',drive,5).defaultPrevented,true);
 assert.equal(app.document.dispatch('gesturestart',{target:app.canvas,cancelable:true}).defaultPrevented,true);
 app.frame();
 assert.equal(app.metrics.lastControls.throttle,1);assert.ok(app.metrics.lastControls.aim);
 assert.equal(app.metrics.lastControls.firePressed,true);assert.equal(app.metrics.lastControls.brake,true);assert.equal(app.metrics.lastControls.boost,true);
 pointer(byControl(app.mount,'fire'),'pointerup',3);touch(app,'touchend',byControl(app.mount,'fire'),4);
 app.frame();assert.equal(app.metrics.lastControls.throttle,1);assert.equal(app.metrics.lastControls.firePressed,false);
 const governor=byControl(app.mount,'travel');
 assert.notEqual(touch(app,'touchstart',governor).defaultPrevented,true,'click-based buttons retain native click synthesis');
 governor.dispatch('click');app.frame();assert.equal(app.metrics.lastControls.governor,'travel');
 const pause=action(app,'pause');assert.notEqual(touch(app,'touchend',pause).defaultPrevented,true);
 pause.dispatch('click');assert.equal(app.latest.state.phase,'paused');
 assert.notEqual(touch(app,'touchmove',app.mount.querySelector('.campaign-dialog'),2).defaultPrevented,true);
 action(app,'resume').dispatch('click');app.frame();assert.equal(app.metrics.lastControls.throttle,0);assert.equal(app.metrics.lastControls.boost,false);
 app.window.dispatch('pagehide',{persisted:true});assert.equal(app.latest.state.phase,'paused');
 app.window.dispatch('pageshow',{persisted:true});assert.notEqual(touch(app,'touchstart',drive).defaultPrevented,true);
 action(app,'resume').dispatch('click');assert.equal(touch(app,'touchstart',drive).defaultPrevented,true);
 app.dispose();assert.notEqual(touch(app,'touchstart',app.canvas).defaultPrevented,true,'real lifecycle removes guard');
});

test('actual main pauses already-zoomed gameplay, frees pinch recovery and never resumes automatically',async t=>{
 const viewport=new FakeElement('visualviewport');Object.assign(viewport,{scale:1,width:1024,height:768,offsetLeft:0,offsetTop:0});
 const app=await boot('',undefined,{viewport});t.after(()=>app.dispose());
 action(app,'start').dispatch('click');pointer(byControl(app.mount,'drive'),'pointerdown',1);
 viewport.scale=2;viewport.width=512;viewport.height=384;viewport.offsetLeft=120;viewport.offsetTop=80;viewport.dispatch('resize');
 assert.equal(app.latest.state.phase,'paused');assert.equal(app.metrics.inputEnabled,false);assert.equal(app.metrics.audioPaused,true);
 const recovery=app.document.body.querySelector('.campaign-zoom-recovery');assert.ok(recovery);assert.equal(recovery.hidden,false);
 assert.match(recovery.textContent,/双指/);assert.notEqual(touch(app,'touchmove',app.canvas,2).defaultPrevented,true,'recovery must allow native pinch-out');
 assert.equal(recovery.style.left,'132px');assert.equal(recovery.style.top,'92px');
 action(app,'resume').dispatch('click');assert.equal(app.latest.state.phase,'paused','cannot resume into an already-zoomed viewport');
 viewport.scale=1;viewport.dispatch('resize');assert.equal(recovery.hidden,true);assert.equal(app.latest.state.phase,'paused');
 action(app,'resume').dispatch('click');app.frame();assert.equal(app.latest.state.phase,'playing');assert.equal(app.metrics.lastControls.throttle,0);
 app.dispose();viewport.scale=2;viewport.dispatch('resize');assert.equal(app.document.body.querySelector('.campaign-zoom-recovery'),null);
});
