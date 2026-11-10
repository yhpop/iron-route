import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
const spec={bounds:{minX:-20,maxX:20,minZ:-20,maxZ:20},geometry:[{id:'wall',kind:'box',x:0,y:0,z:0,yaw:Math.PI/2,width:4,depth:1,height:3}],entities:[]};
const freeze=x=>{if(x&&typeof x==='object'){Object.freeze(x);for(const v of Object.values(x))freeze(v);}return x;};
const near=(v,w)=>assert.ok(Math.abs(v-w)<1e-6,`${v} != ${w}`);
// Catch wrong yaw convention or generic front-facing bursts.
test('impact normal uses the actual rotated collider face and material class',async()=>{
 const {resolveImpactFrame}=await import('../src/combat-fx-frame.js');
 const frame=resolveImpactFrame({type:'impact',targetId:'wall',position:{x:.5,y:1,z:0}},{entities:{}},spec,[]);
 near(frame.normal.x,1);near(frame.normal.y,0);near(frame.normal.z,0);assert.equal(frame.surface,'masonry');assert.equal(frame.staticSurface,true);
});
// Catch guessing a tank aim when there is no projectile information.
test('missing projectile data never manufactures an incoming direction',async()=>{
 const {resolveImpactFrame}=await import('../src/combat-fx-frame.js');
 const frame=resolveImpactFrame({type:'impact',targetId:'unknown',entityId:'tank',position:{x:1,y:0,z:2}},{entities:{}},spec,[]);
 assert.equal(frame.incoming,null);assert.equal(frame.surface,'ground');near(frame.normal.y,1);
});
// Catch moving the shell onto the end of a decorative streak.
test('shell core follows exact projectile position and velocity, not target or trail endpoint',async()=>{
 const {createCombatFx}=await import('../src/combat-fx.js');const scene=new THREE.Scene(),fx=createCombatFx(scene,spec,{reducedMotion:false});
 const state=freeze({entities:{},projectiles:[{id:'p1',ownerId:'tank',faction:'player',previousPosition:{x:0,y:1,z:0},position:{x:1,y:1.5,z:2},velocity:{x:2,y:1,z:4}}]});
 fx.update(state,[freeze({id:'e1',type:'shot',projectileId:'p1',entityId:'tank',position:{x:0,y:1,z:0}})],.016);
 const core=scene.getObjectByName('projectile:p1');assert.ok(core);assert.deepEqual(core.position.toArray(),[1,1.5,2]);
 const dir=new THREE.Vector3(0,1,0).applyQuaternion(core.quaternion);near(dir.x,2/Math.sqrt(21));near(dir.y,1/Math.sqrt(21));near(dir.z,4/Math.sqrt(21));
 // Inspect the matrix actually submitted by the rendered instanced body, not
 // merely the named per-projectile transform used by the adapter.
 const matrix=new THREE.Matrix4(),renderedPosition=new THREE.Vector3(),renderedRotation=new THREE.Quaternion(),renderedScale=new THREE.Vector3();
 scene.getObjectByName('shell-cores').getMatrixAt(0,matrix);matrix.decompose(renderedPosition,renderedRotation,renderedScale);
 assert.deepEqual(renderedPosition.toArray(),[1,1.5,2]);const renderedDirection=new THREE.Vector3(0,1,0).applyQuaternion(renderedRotation);near(renderedDirection.x,2/Math.sqrt(21));near(renderedDirection.y,1/Math.sqrt(21));near(renderedDirection.z,4/Math.sqrt(21));
 fx.update({entities:{},projectiles:[]},[],.016);assert.equal(scene.getObjectByName('projectile:p1'),undefined);fx.dispose();
});
// Catch replaying consumed events on every render frame.
test('replayed event IDs do not replay effects, and all transient effects expire',async()=>{
 const {createCombatFx}=await import('../src/combat-fx.js');const scene=new THREE.Scene(),fx=createCombatFx(scene,spec);
 const e={id:'e1',type:'impact',targetId:'wall',position:{x:.5,y:1,z:0}},state={entities:{},projectiles:[]};
 fx.update(state,[e],0);assert.ok(scene.getObjectByName('combat-fx').children.some(o=>o.visible));
 for(let i=0;i<120;i++)fx.update(state,[e],.1);
 for(const o of scene.getObjectByName('combat-fx').children)assert.equal(o.visible,false,`${o.name} should have expired`);
 fx.dispose();
});
// Catch unbounded per-event GPU allocation or incomplete shared-resource disposal.
test('event storms cannot grow the render graph and dispose releases every owned GPU resource once',async()=>{
 const {createCombatFx}=await import('../src/combat-fx.js');const scene=new THREE.Scene(),fx=createCombatFx(scene,spec,{mobile:true});
 const root=scene.getObjectByName('combat-fx'),count=root.children.length,resources=new Set();root.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material){for(const m of [].concat(o.material)){resources.add(m);if(m.map)resources.add(m.map);}}});
 const disposed=new Map();for(const r of resources)r.addEventListener('dispose',()=>disposed.set(r,(disposed.get(r)||0)+1));
 for(let n=0;n<20;n++)fx.update({entities:{},projectiles:[]},Array.from({length:100},(_,i)=>({id:`${n}:${i}`,type:'impact',targetId:'wall',position:{x:.5,y:1,z:0}})),.016);
 assert.equal(root.children.length,count);fx.dispose();fx.dispose();assert.equal(scene.children.length,0);for(const r of resources)assert.equal(disposed.get(r),1);
 fx.update({projectiles:[]},[{type:'shot',position:{x:0,y:1,z:0}}],.1);assert.equal(scene.children.length,0);
});
// Catch missing InstancedMesh.dispose(), which otherwise leaks per-instance GPU buffers.
test('dispose releases instanced mesh buffers as well as shared geometry',async()=>{
 const {createCombatFx}=await import('../src/combat-fx.js');const scene=new THREE.Scene(),fx=createCombatFx(scene,spec),instances=[];
 scene.traverse(o=>{if(o.isInstancedMesh)instances.push(o);});const counts=new Map(instances.map(o=>[o,0]));for(const o of instances)o.addEventListener('dispose',()=>counts.set(o,counts.get(o)+1));
 fx.dispose();fx.dispose();assert.ok(instances.length>0);for(const o of instances)assert.equal(counts.get(o),1);
});
// Catch allowing decorative fragments/tails to keep moving under reduced motion.
test('reduced motion retains the real shell but removes travelling particles and hot tail',async()=>{
 const {createCombatFx}=await import('../src/combat-fx.js');const scene=new THREE.Scene(),fx=createCombatFx(scene,spec,{mobile:true,reducedMotion:true});
 fx.update({projectiles:[{id:'p',position:{x:1,y:1,z:1},velocity:{x:0,y:0,z:-38}}],entities:{}},[{id:'hit',type:'impact',targetId:'wall',position:{x:.5,y:1,z:0}}],.016);
 assert.ok(scene.getObjectByName('projectile:p'));assert.equal(scene.getObjectByName('shell-short-tails').visible,false);assert.equal(fx.getStats().sparks,0);assert.equal(fx.getStats().fragments,0);assert.ok(fx.getStats().smoke>0);
 fx.update({projectiles:[],entities:{}},[],.25);assert.equal(fx.getStats().smoke,0);fx.dispose();
});
// Catch confusing two plausible projectiles from the same owner with exact attribution.
test('impact direction accepts one actual cached trajectory but rejects ambiguous trajectories',async()=>{
 const {resolveImpactFrame}=await import('../src/combat-fx-frame.js');const e={type:'impact',entityId:'tank',targetId:'wall',position:{x:.5,y:1,z:0}};
 const track={id:'p',ownerId:'tank',previousPosition:{x:2,y:1,z:0},position:{x:1,y:1,z:0},velocity:{x:-38,y:0,z:0},window:.1};
 assert.deepEqual(resolveImpactFrame(e,{entities:{}},spec,[track]).incoming,{x:-1,y:0,z:0});
 assert.equal(resolveImpactFrame(e,{entities:{}},spec,[track,{...track,id:'p2'}]).incoming,null);
});
// Catch an adapter mutating a real combat snapshot or emitting replacement game events.
test('real combat fixture preserves damage/events and borrowed frozen snapshots through the view',async()=>{
 const {createFxFixture}=await import('../qa/combat-fx/fixtures.mjs');const {createCombatFx}=await import('../src/combat-fx.js');
 const fixture=createFxFixture('metal'),scene=new THREE.Scene(),fx=createCombatFx(scene,fixture.spec);let shots=0,hits=0;
 for(let i=0;i<90;i++){const frame=fixture.advance();shots+=frame.events.filter(e=>e.type==='shot').length;hits+=frame.events.filter(e=>e.type==='impact').length;const borrowed=freeze(structuredClone(frame.state)),before=JSON.stringify(borrowed);fx.update(borrowed,borrowed.events,1/60);assert.equal(JSON.stringify(borrowed),before);}
 assert.equal(shots,1);assert.equal(hits,1);assert.equal(fixture.state.entities.gun.hp,255);fx.dispose();fixture.dispose();
});
