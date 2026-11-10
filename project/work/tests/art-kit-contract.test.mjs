import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,symlinkSync} from 'node:fs';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const folder=path.join(root,'assets/art-kit');
const manifest=JSON.parse(readFileSync(path.join(folder,'manifest.json'),'utf8'));
const expected=['warehouse-sawtooth','pump-station','service-workshop','cargo-truck','sentry-turret'];
test('art kit has stable assets, self-contained GLB buffers and truthful hashes',()=>{
 assert.deepEqual(manifest.assets.map(x=>x.assetKey),expected);
 for(const asset of manifest.assets){
  const bytes=readFileSync(path.join(folder,asset.file));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  assert.equal(bytes.readUInt32LE(0),0x46546c67);
  assert.equal(bytes.readUInt32LE(4),2);
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  assert.deepEqual(json.extensionsRequired??[],[]);
  assert.ok(json.buffers.every(x=>!x.uri));
  assert.ok(json.images.every(x=>!x.uri&&x.mimeType==='image/png'));
  assert.ok(json.nodes.some(x=>x.name===asset.root));
  for(const node of json.nodes)for(const scale of node.scale??[1,1,1])assert.ok(Math.abs(scale-1)<1e-5,'runtime transforms must not compensate for design scale');
 }
});
test('art is contained by existing collision contracts',()=>{
 for(const asset of manifest.assets.slice(0,3)){
  const [lo,hi]=asset.boundsMeters;
  assert.ok(lo[0]>=-4.001&&lo[2]>=-4.001&&hi[0]<=4.001&&hi[2]<=4.001);
  assert.ok(lo[1]>=-.001&&hi[1]<=4.001);
  assert.equal(asset.collisionContract.facadeOverhangMeters,0);
  assert.ok(asset.facadeReadability.visibleReliefMeters>.02);
 }
 const truck=manifest.assets.find(x=>x.assetKey==='cargo-truck');
 const [lo,hi]=truck.boundsMeters;
 assert.ok(lo[0]>=-.901&&hi[0]<=.901&&lo[2]>=-1.801&&hi[2]<=1.801&&hi[1]<=2.2);
 const turret=manifest.assets.find(x=>x.assetKey==='sentry-turret');
 assert.equal(turret.collisionContract.barrelVisualOverhang,false);
 assert.ok(turret.collisionContract.articulatedSweepRadiusMeters<=.801);
 assert.equal(turret.rig.recoilAxis,'local +Z');
});
test('independent binary vertex/UV/index/rig and motion-range validator passes',()=>{
 const result=execFileSync('python',['scripts/art-kit/validate_kit.py'],{cwd:root,encoding:'utf8',timeout:30000});
 assert.match(result,/ART_KIT_VALIDATION_PASS/);
});

// A deliberate binary mutation proves the facade regression check rejects the
// exact pixel-QA failure mode, without touching the shipping files.
test('validator rejects a window/shutter moved behind the opaque wall shell',()=>{
 const fixture=mkdtempSync(path.join(os.tmpdir(),'canal-art-buried-facade-'));
 for(const asset of manifest.assets.slice(1))symlinkSync(path.join(folder,asset.file),path.join(fixture,asset.file));
 const bytes=Buffer.from(readFileSync(path.join(folder,'warehouse-sawtooth.glb')));
 const jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength).toString()),binaryStart=20+jsonLength+8;
 const edited=new Set();
 for(const mesh of json.meshes)for(const primitive of mesh.primitives){
  if(!['Glass','SagePaint'].includes(json.materials[primitive.material].name))continue;
  const index=primitive.attributes.POSITION;if(edited.has(index))continue;edited.add(index);
  const accessor=json.accessors[index],view=json.bufferViews[accessor.bufferView];
  assert.equal(accessor.componentType,5126);
  for(let i=0;i<accessor.count;i++){
   const offset=binaryStart+(view.byteOffset??0)+(accessor.byteOffset??0)+i*(view.byteStride??12)+8;
   const z=bytes.readFloatLE(offset);if(z<-3.5)bytes.writeFloatLE(z+.25,offset);
  }
 }
 writeFileSync(path.join(fixture,'warehouse-sawtooth.glb'),bytes);
 const run=spawnSync('python',['scripts/art-kit/validate_kit.py','--write-manifest'],{cwd:root,encoding:'utf8',env:{...process.env,ART_KIT_DIRECTORY:fixture},timeout:30000});
 assert.notEqual(run.status,0);assert.match(run.stderr,/buried behind opaque facade shell/);
});
