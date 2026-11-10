import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../../',import.meta.url));
const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url)));
const manifest=read('manifest.json');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

test('40 accepted tapes are bound to the 20 authored missions and exact packaged runtime',()=>{
  assert.equal(manifest.missions.length,20);
  assert.equal(new Set(manifest.missions.map(m=>m.id)).size,20);
  for(const [file,expected] of Object.entries(manifest.replaySourceHashes)){
    assert.equal(sha256(readFileSync(path.join(root,'src',file))),expected,file);
  }
  for(const [index,mission] of manifest.missions.entries()){
    assert.equal(mission.id,`crafted20-${String(index+1).padStart(3,'0')}`);
    for(const kind of ['main','alternative']){
      const expected=mission[kind];
      const tapeBytes=readFileSync(new URL(expected.tape,import.meta.url));
      assert.equal(sha256(tapeBytes),expected.tapeSHA256,'original recording bytes');
      const tape=JSON.parse(gunzipSync(tapeBytes));
      assert.equal(tape.dt,1/60);
      assert.equal(tape.missionId,mission.id);
      assert.equal(tape.specHash,mission.specHash);
      assert.equal(tape.finalHash,expected.finalHash);
      assert.equal(sha256(JSON.stringify(tape.sourceHashes)),expected.recordedSourceHash,'recorded source metadata remains original');
      const differences=Object.entries(tape.sourceHashes).filter(([name,digest])=>manifest.replaySourceHashes[name]!==digest).map(([name])=>name);
      assert.deepEqual(differences,expected.sourceDifferencesFromReplay);
      assert.ok(differences.every(name=>name==='content/crafted20/south-wharf.js'),'historical recordings may differ only in the shared authored-content file; current spec and final state are checked by fresh replay');
      assert.deepEqual(tape.runs[0],{n:1,input:{start:true}});
      let count=0,starts=0;
      for(const run of tape.runs){
        assert.ok(Number.isInteger(run.n)&&run.n>0);
        count+=run.n;
        if(run.input.start)starts+=run.n;
        for(const key of Object.keys(run.input))assert.ok(['start','throttle','steer','brake','governor','aim','firePressed'].includes(key),key);
        for(const key of ['throttle','steer'])if(key in run.input)assert.ok(Number.isFinite(run.input[key])&&Math.abs(run.input[key])<=1,key);
        if(run.input.aim)for(const key of ['x','y','z'])assert.ok(Number.isFinite(run.input.aim.worldPoint[key]));
      }
      assert.equal(starts,1);
      assert.equal(count,expected.tick+1);
    }
  }
});

for(const mission of manifest.missions)for(const kind of ['main','alternative']){
  test(`${mission.id} ${kind}: fresh-process exact-input replay wins with the expected full-state hash`,()=>{
    const expected=mission[kind];
    const result=spawnSync(process.execPath,['qa/accepted40/replay-snapshot.mjs','src',`qa/accepted40/${expected.tape}`],{
      cwd:root,encoding:'utf8',timeout:120000,maxBuffer:1024*1024,
    });
    assert.ifError(result.error);
    assert.equal(result.status,0,result.stderr+'\n'+result.stdout);
    const replay=JSON.parse(result.stdout.trim().split('\n').at(-1));
    assert.equal(replay.missionId,mission.id);
    assert.equal(replay.phase,'won');
    assert.equal(replay.tick,expected.tick);
    assert.equal(replay.hash,expected.finalHash);
    assert.equal(replay.specMatches,true);
    assert.equal(replay.stateMatches,true);
  });
}
