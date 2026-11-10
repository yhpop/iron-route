import test from 'node:test';
import assert from 'node:assert/strict';
import {getCraftedMission} from '../src/content/crafted20/index.js';
import {lineBlocker} from '../src/content/geometry.js';
const m=getCraftedMission('crafted20-008');
const length=points=>points.slice(1).reduce((s,p,i)=>s+Math.hypot(p.x-points[i].x,p.z-points[i].z),0);
test('008 compact dock cuts route length rather than increasing vehicle speed or target duration',()=>{
 for(const route of m.routes)assert.ok(length(route.points)<50,`${route.id}: ${length(route.points)} m`);
 for(const e of m.entities.filter(e=>e.kind==='truck')){assert.equal(e.speed,1.5);assert.equal(e.hp,220);}
 assert.deepEqual(m.design.targetSeconds,[110,160]);
 const release=m.zones.filter(z=>z.id.includes('rendezvous'));
 assert.equal(release.length,2);
 for(const zone of release){const lane=zone.id.startsWith('west')?-12:12;assert.ok(zone.polygon.every(p=>Math.abs(p.x-lane)>=5),'release must remain off-lane');}
});
test('008 berth walls shelter waiting trucks but leave the paired shooting pockets exposed',()=>{
 for(const side of ['west','east']){
  const gun=m.entities.find(e=>e.id===`${side}-berth-gun`),truck=m.entities.find(e=>e.id===`${side}-berth-truck`);
  assert.ok(lineBlocker(gun.pose,truck.pose,m.geometry),'compact gun lacks a real parked-berth shield');
  const pocket={x:side==='west'?-10:10,z:26};
  assert.equal(lineBlocker(gun.pose,pocket,m.geometry),null,'firing pocket must provide a usable shot');
  assert.ok(Math.hypot(gun.pose.x-pocket.x,gun.pose.z-pocket.z)<=gun.range,'do not make the compact combat a free out-of-range shot');
 }
});
