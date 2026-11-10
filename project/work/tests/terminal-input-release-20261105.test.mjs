// One gap-specific terminal check. Ordinary key/touch/UI routes only: no phase override,
// state mutation, invulnerability, aim injection, simulation proxy or golden changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,action} from './main-entry-harness.mjs';
import {byControl} from './input-dom.mjs';
const key=(a,code,type='keydown',repeat=false)=>a.window.dispatch(type,{code,repeat,target:a.canvas});
const touch=(node,type,id)=>node.dispatch(type,{pointerId:id,pointerType:'touch',button:0,clientX:60,clientY:0});

test('genuine enemy-fire loss releases held keyboard/touch controls before normal R Retry and Start',async t=>{
 const app=await boot('?sortie=showcase-escort');t.after(()=>app.dispose());const storage=JSON.stringify([...app.storage.values]);action(app,'start').dispatch('click');key(app,'KeyW');for(let i=0;i<600;i++)app.frame();key(app,'KeyW','keyup');key(app,'Space');for(let i=0;i<30;i++)app.frame();key(app,'Space','keyup');
 let frames=630;while(app.latest.state.phase==='playing'&&app.latest.state.tankCombat.hp>9&&frames<6000){app.frame();frames++;}
 assert.equal(app.latest.state.phase,'playing');assert.ok(app.latest.state.tankCombat.hp<=9,'ordinary enemy fire reached low health');
 const drive=byControl(app.mount,'drive'),fire=byControl(app.mount,'fire');for(const code of ['KeyW','KeyD','ShiftLeft','Space','KeyF'])key(app,code);touch(drive,'pointerdown',31);touch(fire,'pointerdown',32);
 while(app.latest.state.phase==='playing'&&frames<6000){app.frame();frames++;}
 assert.equal(app.latest.state.phase,'lost');assert.equal(app.latest.state.result.cause,'tank-destroyed');assert.equal(app.latest.state.tankCombat.hp,0);assert.equal(app.metrics.inputEnabled,false);assert.equal(app.metrics.audioPaused,true);assert.equal(drive.captured.size,0);assert.equal(fire.captured.size,0);const terminalTick=app.latest.state.tick;
 app.frame();assert.equal(app.latest.state.tick,terminalTick);key(app,'KeyR');assert.equal(app.latest.state.phase,'briefing');assert.equal(app.latest.state.tick,0);action(app,'start').dispatch('click');for(const code of ['KeyW','KeyD','ShiftLeft','Space','KeyF'])key(app,code,'keydown',true);touch(drive,'pointermove',31);app.frame();
 const c=app.metrics.lastControls;assert.equal(c.throttle,0);assert.equal(c.steer,0);assert.equal(c.boost,false);assert.equal(c.brake,false);assert.equal(c.firePressed,false);assert.equal(app.latest.state.tankCombat.shotsFired,0);assert.equal(JSON.stringify([...app.storage.values]),storage,'independent loss and Retry preserve campaign storage');
 key(app,'KeyW','keyup');key(app,'KeyW');app.frame();assert.equal(app.metrics.lastControls.throttle,1);t.diagnostic(JSON.stringify({terminalTick,cause:'tank-destroyed',normalInputOnly:true}));
});
