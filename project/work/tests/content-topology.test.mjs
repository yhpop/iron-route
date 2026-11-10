import test from 'node:test';
import assert from 'node:assert/strict';
import {BLUEPRINTS,analyzeRoadGraph} from '../src/content/blueprints.js';

test('topology signatures and articulation counts are recomputed from actual adjacency, not declared labels',()=>{
 const originals=BLUEPRINTS.map(b=>analyzeRoadGraph(b.regions,b.roadEdges));
 assert.equal(new Set(originals.map(a=>a.canonicalTopology)).size,30);
 for(let i=0;i<BLUEPRINTS.length;i++){
  const b=BLUEPRINTS[i],names=new Map(b.regions.map((n,j)=>[n.id,`arbitrary-${b.regions.length-j}`]));
  const nodes=[...b.regions].reverse().map(n=>({...n,id:names.get(n.id),x:999,z:-999}));
  const edges=[...b.roadEdges].reverse().map(e=>({from:names.get(e.to),to:names.get(e.from)}));
  assert.deepEqual(analyzeRoadGraph(nodes,edges),originals[i]);
  assert.equal(originals[i].articulationCount,b.blocks-1);
  assert.equal(originals[i].cycleRank,b.blocks+b.extra-1);
 }
});

test('broken actual road edges cannot inherit an authored topology signature',()=>{
 const b=BLUEPRINTS[4];
 assert.throws(()=>analyzeRoadGraph(b.regions,b.roadEdges.slice(1)),/series-theta|connected|graph/);
});
