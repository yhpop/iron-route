import assert from 'node:assert/strict';
/** Evidence is persisted as JSON. Roundtrip the ENTIRE newly generated object,
 * exactly like the recorder, before comparison. JSON spells both +0 and -0 as 0.
 * No property selection, field omission, approximate comparison or state repair. */
export function assertFullEvidenceExact(actual,stored){assert.deepEqual(JSON.parse(JSON.stringify(actual)),stored,'ENTIRE JSON evidence must exactly reproduce');}
