import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDOM,byControl} from './input-dom.mjs';
import {createInput} from '../src/campaign-input.js';
function setup(options={}) { assert.equal(typeof createInput,'function','campaign input exports createInput'); const dom=makeDOM(); return {...dom,input:createInput(dom.canvas,{...dom,...options})}; }
function key(window,code,type='keydown',more={}) { window.dispatch(type,{code,...more}); }
function pointer(element,type,id,x,y,more={}) { element.dispatch(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,button:0,...more}); }

test('keyboard is hull-relative, supports brake/boost/governor and consumes one fire edge',()=>{
 const {input,window}=setup(); key(window,'KeyW'); key(window,'KeyD'); key(window,'ShiftLeft'); key(window,'Digit3'); key(window,'KeyF');
 assert.deepEqual(input.sample(),{throttle:1,steer:1,brake:false,boost:true,governor:'travel',firePressed:true,paused:false});
 assert.equal(input.sample().firePressed,false); key(window,'KeyF','keydown',{repeat:true}); assert.equal(input.sample().firePressed,false);
 key(window,'KeyS'); assert.equal(input.sample().brake,true); assert.equal(input.sample().throttle,0); key(window,'KeyW','keyup'); assert.equal(input.sample().throttle,-1);
 key(window,'Space'); assert.equal(input.sample().brake,true); input.dispose();
});

test('left analog stick retains magnitude and does not become world-axis movement',()=>{
 const {input,mount}=setup(); const drive=byControl(mount,'drive'); pointer(drive,'pointerdown',10,60,60); pointer(drive,'pointermove',10,84,36); const state=input.sample();
 assert.ok(state.throttle>0&&state.throttle<1); assert.ok(state.steer>0&&state.steer<1); assert.ok(Math.abs(state.throttle-state.steer)<1e-8);
 pointer(drive,'pointermove',10,62,60); assert.equal(input.sample().steer,0); pointer(drive,'pointerup',10,62,60); assert.equal(input.sample().throttle,0); input.dispose();
});

test('drive, aim and fire have independent pointer ownership and retain released aim',()=>{
 const {input,mount}=setup({projectAim:(x,y)=>({x,y:1,z:y}),getTankPose:()=>({x:0,y:0,z:0,yaw:0})}); const drive=byControl(mount,'drive'),aim=byControl(mount,'aim'),fire=byControl(mount,'fire');
 pointer(drive,'pointerdown',1,60,60); pointer(drive,'pointermove',1,60,0); pointer(aim,'pointerdown',2,60,60); pointer(aim,'pointermove',2,120,60); pointer(fire,'pointerdown',3,0,0);
 const first=input.sample(); assert.equal(first.throttle,1); assert.ok(first.aim.worldPoint.x>512); assert.equal(first.firePressed,true);
 pointer(fire,'pointerup',3,0,0); pointer(aim,'pointerup',2,120,60); const next=input.sample(); assert.equal(next.throttle,1); assert.deepEqual(next.aim,first.aim); assert.equal(next.firePressed,false);
 pointer(drive,'pointermove',99,60,120); assert.equal(input.sample().throttle,1); pointer(drive,'pointerup',1,60,0); assert.equal(input.sample().throttle,0); input.dispose();
});

test('cancellation, blur, visibility and disabled state clear held input and queued shots',()=>{
 const {input,mount,window,document}=setup(); const drive=byControl(mount,'drive'),fire=byControl(mount,'fire');
 pointer(drive,'pointerdown',1,60,60); pointer(drive,'pointermove',1,60,0); pointer(fire,'pointerdown',2,0,0); key(window,'ShiftLeft'); pointer(drive,'pointercancel',1,60,0);
 assert.equal(input.sample().throttle,0); assert.equal(input.sample().firePressed,false); assert.equal(input.sample().boost,false);
 key(window,'KeyW'); key(window,'KeyF'); window.dispatch('blur'); assert.equal(input.sample().throttle,0); assert.equal(input.sample().firePressed,false);
 key(window,'KeyW'); document.hidden=true; document.dispatch('visibilitychange'); assert.equal(input.sample().throttle,0);
 document.hidden=false; input.setEnabled(false); key(window,'KeyW'); assert.equal(input.sample().throttle,0); assert.equal(input.sample().paused,true); input.setEnabled(true); assert.equal(input.sample().throttle,0); input.dispose();
});

test('mouse aim preserves last valid target and firing ignores UI and editable keyboard targets',()=>{
 let valid=true; const {input,canvas,window,document}=setup({projectAim:(x,y)=>valid?({x,y:2,z:y}):null});
 pointer(canvas,'pointermove',1,20,30,{pointerType:'mouse'}); assert.deepEqual(input.sample().aim,{worldPoint:{x:20,y:2,z:30}}); valid=false; pointer(canvas,'pointermove',1,80,90,{pointerType:'mouse'}); assert.deepEqual(input.sample().aim,{worldPoint:{x:20,y:2,z:30}});
 pointer(canvas,'pointerdown',1,20,30,{pointerType:'mouse'}); assert.equal(input.sample().firePressed,true); assert.equal(input.sample().firePressed,false);
 key(window,'KeyW','keydown',{target:document.createElement('input')}); assert.equal(input.sample().throttle,0); input.dispose(); assert.equal(canvas.parentElement.querySelector('.campaign-controls'),null); key(window,'KeyW'); assert.equal(input.sample().throttle,0);
});

test('unexpected lost capture clears all controls, release does not cancel other pointers',()=>{
 const {input,mount}=setup(); const drive=byControl(mount,'drive'),boost=byControl(mount,'boost');
 pointer(drive,'pointerdown',1,60,0); pointer(boost,'pointerdown',2,0,0); pointer(boost,'pointerup',2,0,0); pointer(boost,'lostpointercapture',2,0,0); assert.equal(input.sample().throttle,1);
 pointer(drive,'lostpointercapture',1,60,0); assert.equal(input.sample().throttle,0); input.dispose();
});

test('governor button focus does not disable subsequent driving keys',()=>{
 const {input,mount,window}=setup(); const button=byControl(mount,'travel'); button.dispatch('click'); key(window,'KeyW','keydown',{target:button});
 assert.equal(input.sample().governor,'travel'); assert.equal(input.sample().throttle,1); input.dispose();
});

test('resume does not reactivate a physically held key from OS repeat events',()=>{
 const {input,window}=setup();key(window,'KeyW');key(window,'ShiftLeft');input.setEnabled(false);input.setEnabled(true);
 key(window,'KeyW','keydown',{repeat:true});key(window,'ShiftLeft','keydown',{repeat:true});assert.equal(input.sample().throttle,0);assert.equal(input.sample().boost,false);
 key(window,'KeyW','keyup');key(window,'KeyW');assert.equal(input.sample().throttle,1);input.dispose();
});
