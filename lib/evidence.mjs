/** Read-only provenance and ordinary-input validation. Never updates fixtures. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {deserialize} from 'node:v8';
export const suiteRoot = fileURLToPath(new URL('../', import.meta.url));
export const workRoot = path.join(suiteRoot, 'project/work');
export const sha256 = value => crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);

export function checkedBytes(root, entry) {
  assert.ok(typeof entry.path === 'string' && entry.path && !path.isAbsolute(entry.path) && !entry.path.split(/[\\/]/).includes('..'), 'unsafe relative path');
  assert.match(entry.sha256, /^[a-f0-9]{64}$/, 'expected SHA-256');
  const filename=path.resolve(root,entry.path), realRoot=fs.realpathSync(root);
  const realFile=fs.realpathSync(filename);
  assert.ok(realFile.startsWith(realRoot + path.sep), 'unsafe relative path: symlink escape');
  const bytes=fs.readFileSync(filename);
  assert.equal(sha256(bytes),entry.sha256,'SHA-256 mismatch: '+entry.path);
  return bytes;
}
export function verifyFileHashes(root, hashes) {
  assert.ok(object(hashes) && Object.keys(hashes).length, 'nonempty source manifest');
  for (const [filename, hash] of Object.entries(hashes)) checkedBytes(root,{path:filename,sha256:hash});
  return Object.keys(hashes).length;
}
export function assertRuntime(manifest, version=process.version) {
  assert.equal(version,manifest.nodeVersion,'Node version must match frozen lossless CPU evidence');
}
export function* expandRuns(runs) {
  for (const {n,input} of runs) for(let i=0;i<n;i++) yield input;
}
function validateInput(input, index, n) {
  assert.ok(object(input),'ordinary input object');
  const keys=['start','throttle','steer','brake','aim','firePressed','governor','convoyOrder','boost'];
  for(const key of Object.keys(input)) assert.ok(keys.includes(key),'ordinary input key: '+key);
  for(const key of ['start','brake','firePressed','boost']) if(key in input) assert.equal(typeof input[key],'boolean','boolean control: '+key);
  for(const key of ['throttle','steer']) if(key in input) {
    assert.ok(typeof input[key] === 'number' && Number.isFinite(input[key]),'finite control: '+key);
    assert.ok(Math.abs(input[key])<=1,'range of control: '+key);
  }
  if('convoyOrder' in input) assert.ok(['advance','hold'].includes(input.convoyOrder),'ordinary convoyOrder');
  if('governor' in input) assert.ok(['crawl','cruise'].includes(input.governor),'ordinary governor');
  if('aim' in input) {
    assert.ok(object(input.aim) && Object.keys(input.aim).join(',')==='worldPoint' && object(input.aim.worldPoint),'aim shape');
    assert.deepEqual(Object.keys(input.aim.worldPoint).sort(),['x','y','z'],'aim shape');
    for(const value of Object.values(input.aim.worldPoint)) assert.ok(typeof value==='number' && Number.isFinite(value),'finite aim');
  }
  if(input.start) assert.ok(index===0 && n===1,'start only once at normal opening');
}
export function validateTape(tape, definition, old) {
  assert.equal(tape.schema,1,'tape schema');
  assert.equal(tape.dt,1/60,'fixed time step');
  assert.equal(tape.vehicle,definition.vehicle,'vehicle');
  assert.equal(tape.route,definition.selectedRoute,'route');
  assert.equal(tape.attempt,definition.attempt,'attempt');
  assert.equal(tape.inputs,definition.inputs,'declared input count');
  assert.ok(tape.inputs>0 && tape.inputs<=20000,'bounded input count');
  assert.equal(tape.finalHash,definition.finalHash,'declared final hash');
  assert.equal(tape.finalPhase,'won','declared final phase');
  assert.ok(Array.isArray(tape.runs) && tape.runs.length>0,'nonempty runs');
  let total=0;
  for(const [i,run] of tape.runs.entries()) {
    assert.ok(object(run) && Number.isSafeInteger(run.n) && run.n>0 && run.n<=20000,'positive bounded run length');
    assert.deepEqual(Object.keys(run).sort(),['input','n'],'ordinary run shape');
    validateInput(run.input,i,run.n); total+=run.n;
  }
  assert.equal(total,tape.inputs,'expanded input count');
  assert.deepEqual(tape.runs[0],{n:1,input:{start:true}},'normal opening');
  assert.equal(tape.prefix.inputs,definition.retainedOldPrefixInputs,'historical prefix count');
  const oldCount=old.runs.reduce((sum,r)=>sum+r.n,0);
  assert.equal(oldCount,definition.originalHistoricalInputs,'complete original historical input count');
  const complete=tape.prefix.inputs===oldCount;
  assert.equal(complete,definition.completeOldTapeConsumed,'complete old tape contract');
  if('completeOldTapeConsumed' in tape.prefix) assert.equal(tape.prefix.completeOldTapeConsumed,complete,'complete old tape claim');
  assert.ok(tape.prefix.inputs>0 && tape.prefix.inputs<=oldCount,'historical prefix bound');
  const inputs=expandRuns(tape.runs), prior=expandRuns(old.runs);
  for(let i=0;i<tape.prefix.inputs;i++) assert.deepEqual(inputs.next().value,prior.next().value,'unchanged historical prefix input '+i);
}
export function loadWitness(routeId, {fixtureRoot=suiteRoot, sourceRoot=workRoot}={}) {
  const manifest=JSON.parse(fs.readFileSync(path.join(fixtureRoot,'fixtures/manifest.json')));
  assertRuntime(manifest);
  const definition=manifest.routes.find(r=>r.route===routeId);
  assert.ok(definition,'unknown route '+routeId);
  // Verify all blobs before parsing and all executable inputs before dynamic production imports.
  const tape=JSON.parse(gunzipSync(checkedBytes(fixtureRoot,definition.files.tape)));
  const expectedJson=JSON.parse(gunzipSync(checkedBytes(fixtureRoot,definition.files.result)));
  const expected=definition.files.raw ? deserialize(checkedBytes(fixtureRoot,definition.files.raw)) : expectedJson;
  const sourceHashes=JSON.parse(checkedBytes(fixtureRoot,manifest.sourceManifest));
  const dependencyHashes=JSON.parse(checkedBytes(fixtureRoot,manifest.runtimeManifest));
  const sourceFiles=verifyFileHashes(sourceRoot,sourceHashes), dependencyFiles=verifyFileHashes(sourceRoot,dependencyHashes);
  assert.ok(object(tape.sourceHashes) && Object.keys(tape.sourceHashes).length,'tape source binding');
  for(const [name,hash] of Object.entries(tape.sourceHashes)) assert.equal(sourceHashes[name],hash,'tape source binding: '+name);
  const old=JSON.parse(gunzipSync(checkedBytes(sourceRoot,{path:'tests/fixtures/northern-staging/'+definition.route+'.json.gz',sha256:tape.prefix.sha256})));
  validateTape(tape,definition,old);
  assert.equal(sha256(expected.finalState),definition.finalHash,'persisted state hash');
  assert.deepEqual(JSON.parse(JSON.stringify(expected.finalState)),expectedJson.finalState,'raw and original JSON state agree');
  assert.deepEqual(JSON.parse(JSON.stringify(expected.events)),expectedJson.events,'raw and original JSON events agree');
  return {tape,definition,expected,sourceRoot,sourceFiles,dependencyFiles};
}
