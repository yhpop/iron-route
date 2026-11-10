/** Separate synthetic wall/RAF clocks through actual main; not native scheduling evidence. */
import test from 'node:test';import assert from 'node:assert/strict';
import {boot} from './timed-main-harness.mjs';
import {englishModules,englishMainSource} from './english-test-modules.mjs';
async function setup(){let clock;const modules={...englishModules,'./session.js':{...englishModules['./session.js'],createClock(step){return clock=englishModules['./session.js'].createClock(step);}}};const app=await boot('',undefined,{mainSource:englishMainSource,loadModule:p=>modules[p]});return {app,get clock(){return clock;}};}
for(const transition of ['start','resume'])test(`${transition}: obsolete RAF cannot rewind the new active-time anchor`,async()=>{const {app,clock}=await setup();try{
 if(transition==='resume'){app.uiActions.start();app.frame(8);app.uiActions.pause();}
 app.elapse(1000);const anchor=app.now;app.uiActions[transition]();
 app.frame(1,anchor-10);assert.equal(app.latest.state.tick,0);
 app.frame(7,anchor+7);assert.equal(app.latest.state.tick,0,'8 ms active wall time must not become a full simulation step');assert.equal(clock.droppedSeconds,0);
 app.frame(9,anchor+17);assert.equal(app.latest.state.tick,1);assert.equal(clock.droppedSeconds,0);
 }finally{app.dispose();}});
test('multiple obsolete callbacks cannot accumulate repeated paused debt',async()=>{const {app,clock}=await setup();try{
 app.elapse(1000);app.uiActions.start();for(const stamp of [950,960,980,990,995]){app.frame(1,stamp);assert.equal(app.latest.state.tick,0);}
 app.frame(3,1008);assert.equal(app.latest.state.tick,0);app.frame(9,1017);assert.equal(app.latest.state.tick,1);assert.equal(clock.droppedSeconds,0);
 }finally{app.dispose();}});
test('an old callback during ordinary play cannot double-count its interval',async()=>{const {app,clock}=await setup();try{
 app.uiActions.start();app.frame(17);assert.equal(app.latest.state.tick,1);app.frame(1,1);app.frame(1,19);
 assert.equal(app.latest.state.tick,1,'only 19 ms since start, not a second credited interval');app.frame(15,34);assert.equal(app.latest.state.tick,2);assert.equal(clock.droppedSeconds,0);
 }finally{app.dispose();}});
test('forward long RAF gaps retain the original six-step catch-up cap and dropped-time policy',async()=>{const {app,clock}=await setup();try{
 app.uiActions.start();app.frame(1000);assert.equal(app.latest.state.tick,6);assert.ok(Math.abs(clock.droppedSeconds-.9)<1e-12);
 }finally{app.dispose();}});
