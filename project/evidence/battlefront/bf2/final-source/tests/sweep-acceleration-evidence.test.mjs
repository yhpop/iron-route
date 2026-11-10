import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const exists=fs.existsSync(new URL('../qa/performance/core.mjs',import.meta.url));
test('live exact comparator, persistence distinction and nonzero controls',async()=>{
 assert.ok(exists,'Missing exact evidence harness');const {assertLive,exactHash}=await import('../qa/performance/core.mjs');
 assertLive({x:-0,u:undefined},{x:-0,u:undefined});assert.throws(()=>assertLive({x:-0},{x:0}));assert.throws(()=>assertLive({x:1},{x:1.000001}));assert.notEqual(exactHash({x:-0}),exactHash({x:0}));
 const {assertFullEvidenceExact}=await import('../qa/ruined-depot/full-evidence-json.mjs');assertFullEvidenceExact({x:-0,u:undefined},{x:0});assert.throws(()=>assertFullEvidenceExact({x:1},{x:2}));
});
test('ordered complete calls, receiver and independent state negative controls',async()=>{
 assert.ok(exists,'Missing exact evidence harness');const {QueryPair}=await import('../qa/performance/core.mjs');
 function world(delta=0){return {n:2, setEntities(a){return this.n+a.x+delta;},setDestroyed(x){return x;}};}
 const q=new QueryPair(world(),world());q.begin();assert.equal(q.a.setEntities({x:3}),5);assert.equal(q.b.setEntities({x:3}),5);q.finish();
 q.begin();q.a.setDestroyed([-0]);assert.throws(()=>q.b.setDestroyed([0]));
 q.begin();q.a.setEntities({x:1});assert.throws(()=>q.b.setDestroyed({x:1}));
 q.begin();q.a.setEntities({x:1});assert.throws(()=>q.finish());
 const bad=new QueryPair(world(),world(.01));bad.begin();bad.a.setEntities({x:1});assert.throws(()=>bad.b.setEntities({x:1}));
});
test('source freeze detects mutations before execution proof',async()=>{
 assert.ok(exists,'Missing exact evidence harness');const {assertFrozen}=await import('../qa/performance/core.mjs');assertFrozen({a:'same'},{a:'same'});assert.throws(()=>assertFrozen({a:'old'},{a:'new'}));
});
test('independently derived original closure and provenance match entire metadata',async()=>{
 const {retained,closure,provenance,hash,boundary}=await import('../qa/performance/core.mjs');
 for(const route of ['direct','covered']){const old=retained(route),sources=closure('original');assert.deepStrictEqual(sources,old.sourceSnapshot);assert.deepStrictEqual(Object.fromEntries(Object.entries(sources).map(([f,s])=>[f,hash(s)])),old.sourceHashes);assert.deepStrictEqual(provenance(route,'original'),old.provenance);assert.equal(boundary,old.boundary);assert.equal(Object.keys(sources).length,30);assert.notDeepEqual(closure('accelerated'),sources);}
});
