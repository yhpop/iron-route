import test from 'node:test';
import assert from 'node:assert/strict';
const load = () => import('../src/session.js');
test('fixed loop caps catchup, pauses and discards stale accumulated time', async()=>{
 const {createClock}=await load();let ticks=0;const c=createClock(()=>ticks++);
 c.advance(1/120);assert.equal(ticks,0);c.advance(1/120);assert.equal(ticks,1);
 c.advance(10);assert.equal(ticks,7);assert.ok(c.droppedSeconds>9);
 c.pause();c.advance(1);assert.equal(ticks,7);c.resume();c.advance(1/60);assert.equal(ticks,8);
});
test('same elapsed regular time gives same fixed ticks at 30/60/120Hz',async()=>{
 const {createClock}=await load();for(const fps of [30,60,120]){let n=0;const c=createClock(()=>n++);for(let i=0;i<fps*3;i++)c.advance(1/fps);assert.equal(n,180);}
});
test('progress validates membership, advances only wins, preserves legacy keys',async()=>{
 const {loadProgress,recordWin,saveProgress,PROGRESS_KEY}=await load();
 const m=[{id:'mission-001'},{id:'mission-002'},{id:'mission-003'}];const map=new Map([['old-rescue','keep']]);const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 let p=loadProgress(storage,m);assert.deepEqual(p.unlockedIds,['mission-001']);
 p=recordWin(p,'mission-001',{ticks:200,hp:90},m);assert.deepEqual(p.unlockedIds,['mission-001','mission-002']);saveProgress(storage,p);assert.equal(map.get('old-rescue'),'keep');assert.equal(loadProgress(storage,m).bestResults['mission-001'].ticks,200);
 map.set(PROGRESS_KEY,JSON.stringify({schema:1,unlockedIds:['fake','mission-002'],selectedMissionId:'fake',bestResults:{fake:{ticks:1}}}));p=loadProgress(storage,m);assert.equal(p.selectedMissionId,'mission-001');assert.ok(!p.unlockedIds.includes('fake'));
});
test('corrupt and blocked storage degrade to unsaved progress rather than crash',async()=>{
 const {loadProgress,saveProgress}=await load();const storage={getItem(){throw Error('denied')},setItem(){throw Error('full')}};const p=loadProgress(storage,[{id:'mission-001'}]);assert.equal(p.selectedMissionId,'mission-001');assert.equal(saveProgress(storage,p),false);
});
test('render interpolation crosses yaw wrap by shortest arc without mutating simulation',async()=>{const {interpolateTank}=await load();const a={pose:{x:0,y:0,z:0,yaw:Math.PI-.1},vL:1,vR:1,trackL:0,trackR:0,turret:{yawRel:Math.PI-.1,elevation:0,recoil:0}},b={...a,pose:{x:2,y:0,z:4,yaw:-Math.PI+.1},trackL:2,trackR:4,turret:{yawRel:-Math.PI+.1,elevation:.2,recoil:.08}};const v=interpolateTank(a,b,.5);assert.equal(v.pose.x,1);assert.equal(v.trackR,2);assert.ok(Math.abs(Math.abs(v.pose.yaw)-Math.PI)<1e-9);assert.equal(v.turret.recoil,.04);assert.equal(a.pose.x,0);});
test('aim projection rejects nonfinite and clamps distant targets around vehicle',async()=>{const {boundAim}=await load();assert.equal(boundAim({x:NaN,y:1,z:0},{x:0,z:0}),null);const p=boundAim({x:300,y:.8,z:400},{x:0,z:0},50);assert.equal(p.x,30);assert.equal(p.z,40);assert.equal(p.y,.8);});
test('bfcache pagehide pauses without destroying and restored page remains paused',async()=>{const {bindPageLifecycle}=await load();const target=new EventTarget();let paused=0,disposed=0,restored=0;const detach=bindPageLifecycle(target,{pause:()=>paused++,dispose:()=>disposed++,restore:()=>restored++});const hide=new Event('pagehide');Object.defineProperty(hide,'persisted',{value:true});target.dispatchEvent(hide);assert.equal(paused,1);assert.equal(disposed,0);const show=new Event('pageshow');Object.defineProperty(show,'persisted',{value:true});target.dispatchEvent(show);assert.equal(restored,1);target.dispatchEvent(new Event('pagehide'));assert.equal(disposed,1);target.dispatchEvent(show);assert.equal(restored,1);detach();});
