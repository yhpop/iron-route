import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {listMissions,getMission,validateMission} from '../src/content/index.js';
import {compiledCatalog, blueprintAudits, auditCatalog} from '../src/content/catalog.js';

test('at least 300 stable, immutable mission records are actually loadable',()=>{
 const all=listMissions();assert.ok(all.length>=300);
 assert.equal(new Set(all.map(m=>m.id)).size,all.length);
 for(let i=0;i<all.length;i++){assert.equal(all[i].id,`mission-${String(i+1).padStart(3,'0')}`);assert.equal(getMission(all[i].id),all[i]);assert.ok(Object.isFrozen(all[i].witness.phases));}
});

test('thirty realized route blueprints have coordinate-independent structural differences',()=>{
 const audits=blueprintAudits();assert.equal(audits.length,30);
 assert.equal(new Set(audits.map(a=>a.canonicalTopology)).size,30);
 for(const a of audits){assert.equal(a.verifiedRoadEdges,a.roadEdges);assert.ok(a.articulationCount>=1);assert.ok(a.cycleRank>=2);assert.equal(a.geometryRealized,true);}
});

test('all campaign records pass phase-sensitive clearance and reference audits',()=>{
 const failures=[];
 for(const spec of listMissions()){const result=validateMission(spec);if(!result.valid)failures.push({id:spec.id,errors:result.errors});}
 assert.deepEqual(failures,[]);
 const report=auditCatalog();assert.equal(report.structuralVariants,300);assert.equal(report.uniqueCombinedSignatures,300);
 assert.equal(report.humanPlaythrough,'unverified');assert.equal(report.combatSurvivability,'unverified');
});

test('objective variants change actual dependency, road and encounter choices',()=>{
 const missions=listMissions().filter(m=>m.blueprintId==='route-01');
 assert.equal(missions.length,10);assert.equal(new Set(missions.map(m=>m.objectiveGraphId)).size,10);
 assert.equal(new Set(missions.map(m=>m.signature)).size,10);
 for(const m of missions){assert.ok(m.objectives.length>=2);assert.ok(m.routes.length>=2);}
});

test('baked records match the current audited authoring compiler',()=>{const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');assert.equal(hash(listMissions().slice(3)),hash(compiledCatalog()));});
