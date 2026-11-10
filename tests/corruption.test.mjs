import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {gunzipSync,gzipSync} from 'node:zlib';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'fixtures/manifest.json')));
function scratch(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'route-corruption-'));
  t.after(()=>fs.rmSync(dir,{recursive:true}));
  fs.cpSync(path.join(root,'fixtures'),path.join(dir,'fixtures'),{recursive:true});
  return dir;
}
function rejected(dir,route,needle) {
  const child=spawnSync(process.execPath,['run-route.mjs',route,'--fixture-root='+dir],{cwd:root,encoding:'utf8',timeout:10000,maxBuffer:1024*1024});
  assert.equal(child.error,undefined);
  assert.equal(child.status,1,'damaged evidence must return nonzero');
  assert.match(child.stderr,/SHA-256 mismatch/);
  assert.ok(child.stderr.includes(needle),child.stderr);
  assert.equal(child.stdout,'','failure must not emit a success report');
}
for(const r of manifest.routes) test(r.route+' real compressed input corruption is detected by the CLI before replay',t=>{
  const dir=scratch(t),file=path.join(dir,r.files.tape.path),bytes=fs.readFileSync(file);
  bytes[Math.floor(bytes.length/2)]^=1;fs.writeFileSync(file,bytes);
  rejected(dir,r.route,r.files.tape.path);
});
test('recompressed valid JSON with changed ordinary control is rejected rather than silently adopted',t=>{
  const dir=scratch(t),r=manifest.routes[0],file=path.join(dir,r.files.tape.path);
  const tape=JSON.parse(gunzipSync(fs.readFileSync(file))); tape.runs.at(-1).input.brake=false;
  fs.writeFileSync(file,gzipSync(JSON.stringify(tape)));
  rejected(dir,r.route,r.files.tape.path);
});
test('corrupted persisted result cannot redefine the expected victory',t=>{
  const dir=scratch(t),r=manifest.routes[0],file=path.join(dir,r.files.result.path);
  fs.appendFileSync(file,Buffer.from([0]));rejected(dir,r.route,r.files.result.path);
});
test('corrupted lossless V8 events fail without falling back to lossy JSON',t=>{
  const dir=scratch(t),r=manifest.routes.find(r=>r.route==='tiger-east'),file=path.join(dir,r.files.raw.path);
  fs.appendFileSync(file,Buffer.from([0]));rejected(dir,r.route,r.files.raw.path);
});
test('truncated compressed input fails with the named provenance boundary',t=>{
  const dir=scratch(t),r=manifest.routes[0],file=path.join(dir,r.files.tape.path);
  fs.writeFileSync(file,fs.readFileSync(file).subarray(0,20));rejected(dir,r.route,r.files.tape.path);
});
