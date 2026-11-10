/** Compare historical test reports without suppressing their nonzero status. */
import assert from 'node:assert/strict';
export function compareLegacy(log,exitCode,baseline) {
  const counts={},failureNames=[];
  for(const line of log.split('\n')) {
    const count=line.match(/^(?:ℹ|#) (tests|pass|fail|skipped|cancelled|todo) (\d+)$/);
    if(count) counts[count[1]]=Number(count[2]);
    const failure=line.match(/^✖ (.+) \([0-9.]+ms\)$/) || line.match(/^not ok \d+ - (.+)$/);
    if(failure && !failureNames.includes(failure[1])) failureNames.push(failure[1]);
  }
  for(const key of ['tests','pass','fail','skipped','cancelled','todo']) assert.ok(Number.isSafeInteger(counts[key]),'missing test summary: '+key);
  assert.equal(counts.tests,counts.pass+counts.fail+counts.skipped+counts.cancelled+counts.todo,'consistent test summary counts');
  assert.equal(failureNames.length,counts.fail,'complete named failures');
  assert.ok(Number.isInteger(exitCode) && exitCode>=0,'recorded exit code');
  assert.ok(exitCode!==0 || (counts.fail===0 && counts.cancelled===0),'exit code disagrees with failing summary');
  const newFailureNames=failureNames.filter(n=>!baseline.failureNames.includes(n));
  const removedFailureNames=baseline.failureNames.filter(n=>!failureNames.includes(n));
  const exitStatusMatches=exitCode===(baseline.exitCode ?? (baseline.counts.fail>0 ? 1 : 0));
  return {command:'npm test (unmodified isolated project/work)',exitCode,counts,failureNames,newFailureNames,removedFailureNames,
    baselineCounts:baseline.counts,exitStatusMatches,
    sameHistoricalFailures:exitStatusMatches && newFailureNames.length===0 && removedFailureNames.length===0 && Object.entries(baseline.counts).every(([k,v])=>counts[k]===v),
    historicalSuitePassed:exitCode===0 && counts.fail===0 && counts.cancelled===0,
    boundary:'Matching the known red baseline is an audit result, not a passing legacy suite or release approval.'};
}
