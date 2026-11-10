import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,stepGame} from '../src/campaign-simulation.js';
import {createWorld} from '../src/campaign-world.js';
function fixture(enabled){const spec={schema:1,id:'orders',convoyCommands:enabled,spawn:{x:8,y:0,z:0,yaw:0},bounds:{minX:-50,maxX:50,minZ:-50,maxZ:50},geometry:[],zones:[],objectives:[],entities:[{id:'supply',kind:'truck',pose:{x:0,y:0,z:12,yaw:0},routeId:'r',hp:100,protected:true,speed:2,escortRange:30}],routes:[{id:'r',width:6,points:[{x:0,z:12},{x:0,z:-20}]}]};return {spec,s:stepGame(createGame(spec),{start:true}),world:createWorld(spec)};}
test('hold stops real truck, advance moves without teleport; command is immutable and serializable',()=>{
 let {s,world}=fixture(true);const prior=s;s=stepGame(s,{convoyOrder:'hold'},1/60,world);
 assert.equal(s.convoyOrder,'hold');assert.equal(prior.convoyOrder,'advance');
 const pos={...s.entities.supply.pose};for(let i=0;i<120;i++)s=stepGame(s,{},1/60,world);
 assert.deepEqual(s.entities.supply.pose,pos);assert.equal(s.entities.supply.stoppedReason,'commander-hold');assert.ok(s.elapsed>1);
 s=JSON.parse(JSON.stringify(s));s=stepGame(s,{convoyOrder:'advance'},1/60,world);
 for(let i=0;i<120;i++)s=stepGame(s,{},1/60,world);assert.ok(s.entities.supply.pose.z<pos.z-1);world.dispose();
});
test('commands are opt-in, paused/terminal and pre-choice guarded; retry restores advance',()=>{
 for(const enabled of [false,undefined,'true']){const {spec,s,world}=fixture(enabled);if(enabled===undefined)delete spec.convoyCommands;const n=stepGame(s,{convoyOrder:'hold'},1/60,world);assert.equal(n.convoyOrder,undefined);world.dispose();}
 const {s,world,spec}=fixture(true);for(const phase of ['briefing','paused','won','lost'])assert.equal(stepGame({...s,phase},{convoyOrder:'hold'},1/60,world).convoyOrder,'advance');
 const choosing={...s,mission:{...s.mission,convoyChoice:{}},selectedConvoyChoiceId:null};assert.equal(stepGame(choosing,{convoyOrder:'hold'},1/60,world).convoyOrder,'advance');
 assert.equal(createGame(spec).convoyOrder,'advance');assert.equal(stepGame(s,{convoyOrder:'invalid'},1/60,world).convoyOrder,'advance');world.dispose();
});
test('held protected truck still takes hostile projectile damage and loses normally',()=>{
 let {s,world}=fixture(true);s=stepGame(s,{convoyOrder:'hold'},1/60,world);
 s.projectiles=[{id:1,owner:'enemy',team:'enemy',damage:200,position:{x:0,y:1,z:14},previousPosition:{x:0,y:1,z:14},velocity:{x:0,y:0,z:-30},life:4,age:0}];
 for(let i=0;i<60&&s.phase==='playing';i++)s=stepGame(s,{},1/60,world);
 assert.equal(s.phase,'lost');assert.equal(s.result.cause,'protected-vehicle-destroyed');world.dispose();
});
