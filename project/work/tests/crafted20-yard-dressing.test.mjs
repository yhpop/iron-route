import test from 'node:test';
import assert from 'node:assert/strict';
import {getCraftedMission} from '../src/content/crafted20/index.js';
test('001 loading frontage connects to a real flush service spur and faces the bay',()=>{
 const m=getCraftedMission('crafted20-001'),s=m.sceneDressing;
 const road=s.roads.find(r=>r.id==='south-loading-service-spur');assert.ok(road);
 assert.deepEqual(road.points,[[-18,30],[17,30]]);assert.equal(road.width,6);assert.equal(road.curb,false);
 assert.equal(s.landmarks.find(l=>l.geometryId==='east-loading').yawOffset,Math.PI);
});
test('010 service aprons and entry extension are explicit renderer metadata, not physics surfaces',()=>{
 const m=getCraftedMission('crafted20-010'),s=m.sceneDressing;
 assert.deepEqual(s.aprons,[
  {id:'north-pump-service',polygon:[[-25,-37],[-9,-37],[-9,-22],[-25,-22]],material:'concrete'},
  {id:'south-store-service',polygon:[[-2,23],[14,23],[14,36],[-2,36]],material:'concrete'},
 ]);
 assert.deepEqual(s.roads.find(r=>r.id==='north-pump-service-lane').points,[[-17,-22],[-17,-17]]);
 assert.equal(s.roads.find(r=>r.id==='north-pump-service-lane').width,6);
 assert.deepEqual(s.roads.find(r=>r.id==='basin-entry').points[0],[-23,31]);
 assert.ok(!m.surfaces.some(p=>p.id==='north-pump-service'||p.id==='south-store-service'));
});
