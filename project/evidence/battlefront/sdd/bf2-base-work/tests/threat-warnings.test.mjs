import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {COMBAT_CONFIG} from '../src/combat.js';

const path = new URL('../src/threat-warnings.js', import.meta.url);
let api;
try { api = await import(path); } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
const charge = (id='gun', extra={}) => ({id,kind:'turret',alive:true,destroyed:false,status:'charging',charge:.25,chargeTime:1.8,chargeElapsed:.45,targetId:'tank',telegraphTarget:{x:0,y:.8,z:0},pose:{x:12,y:0,z:-4},...extra});
const state = (entities=[charge()]) => ({missionId:'mission-a',phase:'playing',tankCombat:{hp:100},entities:Object.fromEntries(entities.map(e=>[e.id,e]))});
const frame = (s=state(),extra={}) => ({state:s,projectEntity:()=>({x:280,y:20,inFront:true}),origin:{x:195,y:320},...extra});
const compute = (...args) => { assert.equal(typeof api?.computeChargeWarnings,'function','actual-charge view-model export must exist'); return api.computeChargeWarnings(...args); };

test('actual live tank charge shows source arrow and ceil tenth without mutating snapshot',()=>{
 const input=frame(), before=JSON.stringify(input.state), r=compute(input);
 assert.equal(r.total,1); assert.equal(r.entries[0].remaining,1.35); assert.equal(r.entries[0].arrow,'↑');
 assert.equal(r.text,'瞄你↑1.4秒'); assert.equal(r.overflow,null); assert.equal(JSON.stringify(input.state),before);
});
test('only current playing authoritative turret/drone charges qualify',()=>{
 const original=charge();
 for(const patch of [{alive:false},{destroyed:true},{status:'idle'},{status:'cooldown'},{charge:0},{telegraphTarget:null},{telegraphTarget:{x:NaN,y:0,z:0}},{kind:'truck'},{targetId:'missing'}]) assert.equal(compute(frame(state([{...original,...patch}]))).total,0,JSON.stringify(patch));
 for(const phase of ['briefing','paused','won','lost']) assert.equal(compute(frame({...state(),phase})).text,'');
 assert.equal(compute(frame({...state(),tankCombat:{hp:0}})).total,0);
 assert.equal(compute(frame(state([charge('drone',{kind:'drone'})]))).total,1);
});
test('live protected convoy target is explicit and never relabeled as tank',()=>{
 const truck={id:'supply',kind:'truck',alive:true,protected:true}, gun=charge('gun',{targetId:'supply'});
 const r=compute(frame(state([gun,truck]))); assert.equal(r.text,'瞄车↑1.4秒'); assert.equal(r.entries[0].targetId,'supply'); assert.equal(r.entries[0].target,'convoy');
 for(const patch of [{alive:false},{protected:false},{kind:'turret'}]) assert.equal(compute(frame(state([gun,{...truck,...patch}]))).total,0);
});
test('time reads only actual chargeElapsed with shared combat default and tiny positive rounds up',()=>{
 const gun=charge('gun',{chargeTime:undefined,chargeElapsed:.25});
 assert.equal(compute(frame(state([gun]))).entries[0].remaining,COMBAT_CONFIG.turretCharge-.25);
 const tiny=compute(frame(state([charge('gun',{chargeElapsed:1.799999})]))); assert.equal(tiny.text,'瞄你↑0.1秒');
 const frozen=frame(); const a=compute(frozen),b=compute(frozen); assert.deepEqual(a,b);
 const corrupt=compute(frame(state([charge('gun',{chargeElapsed:undefined})]))); assert.match(corrupt.text,/时间未知/); assert.equal(corrupt.entries[0].remaining,null);
});
test('every direction is relative to current rendered player origin, and invalid projection is honest',()=>{
 const vectors=[[1,0,'→'],[1,1,'↘'],[0,1,'↓'],[-1,1,'↙'],[-1,0,'←'],[-1,-1,'↖'],[0,-1,'↑'],[1,-1,'↗']];
 for(const[x,y,arrow]of vectors) assert.equal(compute(frame(state(),{origin:{x:40,y:70},projectEntity:()=>({x:40+x*30,y:70+y*30})})).entries[0].arrow,arrow);
 for(const projection of [null,{x:NaN,y:2},{x:300,y:20,inFront:false},{x:195,y:320}]) {const r=compute(frame(state(),{projectEntity:()=>projection}));assert.equal(r.total,1);assert.match(r.text,/方位未知/);}
});
test('all simultaneous entries survive and overflow never pretends to show omitted directions',()=>{
 const truck={id:'supply',kind:'truck',alive:true,protected:true},many=Array.from({length:7},(_,i)=>charge(`g${i}`,{chargeElapsed:.1+i*.1,targetId:i%2?'supply':'tank'}));
 const r=compute(frame(state([truck,...many]))); assert.equal(r.entries.length,7); assert.equal(r.total,7); assert.equal(r.overflow.count,7); assert.equal(r.displayedCount,0);
 assert.equal(r.overflow.tankCount,4);assert.equal(r.overflow.convoyCount,3); assert.match(r.text,/7处蓄力/); assert.equal(/[↑↗→↘↓↙←↖]/u.test(r.text),false);assert.match(r.text,/最快/);
 assert.equal(r.entries[0].id,'g6'); assert.equal(r.entries[1].id,'g5'); assert.equal(r.accessibilityLabel.includes('7处'),true);
});
test('accessibility signature/label do not churn every countdown frame; new target and new mission do',()=>{
 const a=compute(frame()), b=compute(frame(state([charge('gun',{chargeElapsed:.65})])));
 assert.notEqual(a.text,b.text); assert.equal(a.signature,b.signature); assert.equal(a.accessibilityLabel,b.accessibilityLabel);
 assert.notEqual(a.signature,compute(frame({...state(),missionId:'mission-b'})).signature);
 assert.equal(compute(frame(state([]))).signature,'');
});
test('projection uses CSS canvas offset/size and does not modify camera',()=>{
 assert.equal(typeof api?.projectThreatPoint,'function');
 const camera=new THREE.PerspectiveCamera(42,390/844,.15,150);camera.position.set(8,23.5,22);camera.lookAt(0,.5,0);camera.updateMatrixWorld(true);
 const before=JSON.stringify(camera.toJSON()),rect={left:17,top:29,width:390,height:844},entity=charge();
 const p=api.projectThreatPoint({entity,camera,canvasRect:rect}),v=new THREE.Vector3(entity.pose.x,entity.pose.y+1.3,entity.pose.z).project(camera);
 assert.ok(Math.abs(p.x-(17+(v.x+1)*195))<1e-9);assert.ok(Math.abs(p.y-(29+(1-v.y)*422))<1e-9);assert.equal(p.inFront,true);assert.equal(JSON.stringify(camera.toJSON()),before);
});

test('compact fallback is an explicit count summary and unknown timing cannot claim earliest',()=>{
 const truck={id:'supply',kind:'truck',alive:true,protected:true};
 const pair=compute(frame(state([charge('a'),charge('b',{targetId:'supply'}),truck])));
 assert.equal(pair.fallbackText,'2处蓄力·你1车1·最快1.4秒');
 const many=compute(frame(state([charge('a'),charge('b'),charge('c',{chargeElapsed:undefined})])));
 assert.equal(many.overflow.unknownTimeCount,1);assert.doesNotMatch(many.text,/最快/);assert.match(many.text,/时间未全知/);
});
test('nonfinite charge never becomes a claimed actual charge',()=>{
 assert.equal(compute(frame(state([charge('gun',{charge:Infinity})]))).total,0);
});

test('narrow visual representations preserve complete counts and authoritative earliest time without false precision',()=>{
 const truck={id:'supply',kind:'truck',alive:true,protected:true};
 const pair=compute(frame(state([charge('a'),charge('b',{targetId:'supply',chargeElapsed:1.15}),truck])));
 assert.equal(pair.compactText,'你1车1·最快0.7秒');assert.equal(pair.minimalText,'2处·0.7s');
 const unknown=compute(frame(state([charge('a'),charge('b',{chargeElapsed:undefined})])));
 assert.equal(unknown.compactText,'你2·时间未全知');assert.equal(unknown.minimalText,'2处·时未知');
 assert.doesNotMatch(unknown.minimalText,/\d\.\d/);
 const empty=compute(frame(state([])));assert.equal(empty.compactText,'');assert.equal(empty.minimalText,'');
});

test('countdown-only floating point near-ties cannot churn semantic accessibility order',()=>{
 const a=charge('a',{chargeTime:1,chargeElapsed:.1}), b=charge('b',{chargeTime:1.2,chargeElapsed:.3});
 const options={origin:{x:100,y:100},projectEntity:e=>({x:e.id==='a'?200:0,y:100})};
 const first=compute(frame(state([a,b]),options));
 const next=compute(frame(state([{...a,chargeElapsed:a.chargeElapsed+1/60},{...b,chargeElapsed:b.chargeElapsed+1/60}]),options));
 assert.equal(first.signature,next.signature);assert.equal(first.accessibilityLabel,next.accessibilityLabel);assert.deepEqual(first.entries.map(e=>e.id),next.entries.map(e=>e.id));
});
test('behind-camera player reference cannot produce a claimed source arrow',()=>{
 const r=compute(frame(state(),{origin:{x:0,y:0,inFront:false},projectEntity:()=>({x:100,y:0,inFront:true})}));
 assert.equal(r.total,1);assert.match(r.text,/方位未知/);
});
