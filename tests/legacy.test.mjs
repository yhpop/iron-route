import test from 'node:test';
import assert from 'node:assert/strict';
import {compareLegacy} from '../lib/legacy.mjs';
const baseline={counts:{tests:4,pass:2,fail:1,skipped:1,cancelled:0,todo:0},failureNames:['historical trajectory']};
const spec='✖ historical trajectory (1.23ms)\nℹ tests 4\nℹ pass 2\nℹ fail 1\nℹ skipped 1\nℹ cancelled 0\nℹ todo 0\n';
test('matching known failures are reported as still failing, never as a green historical suite',()=>{
  const r=compareLegacy(spec,1,baseline);
  assert.deepEqual(r.counts,baseline.counts);assert.deepEqual(r.failureNames,['historical trajectory']);
  assert.equal(r.sameHistoricalFailures,true);assert.equal(r.historicalSuitePassed,false);assert.equal(r.exitCode,1);
});
test('added failure and missing historical failure are both surfaced',()=>{
  const r=compareLegacy(spec.replace('historical trajectory','file load error'),1,baseline);
  assert.deepEqual(r.newFailureNames,['file load error']);assert.deepEqual(r.removedFailureNames,['historical trajectory']);
  assert.equal(r.sameHistoricalFailures,false);
});
test('incomplete log cannot be mistaken for zero failures',()=>{
  assert.throws(()=>compareLegacy('partial test output',1,baseline),/missing test summary/);
});
test('TAP summaries and duplicate detailed failures retain exact counts',()=>{
  const tap='not ok 1 - historical trajectory\n# tests 4\n# pass 2\n# fail 1\n# skipped 1\n# cancelled 0\n# todo 0\n';
  const r=compareLegacy(tap,1,baseline);assert.deepEqual(r.counts,baseline.counts);assert.equal(r.sameHistoricalFailures,true);
});
test('a zero exit cannot turn recorded failures into a passing suite',()=>{
  assert.throws(()=>compareLegacy(spec,0,baseline),/exit code disagrees/);
});
test('unexpected process termination cannot attest the exact recorded failing baseline',()=>{
  const r=compareLegacy(spec,137,{...baseline,exitCode:1});
  assert.equal(r.exitStatusMatches,false);
  assert.equal(r.sameHistoricalFailures,false);
  assert.equal(r.historicalSuitePassed,false);
});
