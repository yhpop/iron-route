import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as preparation from '../scripts/prepare-art-payload.mjs';
import * as restoration from '../src/art-kit-payload.js';
const keys=['cargo-truck','pump-station','sentry-turret','service-workshop','warehouse-sawtooth'];
const originals=Object.fromEntries(keys.map(key=>[key,readFileSync(new URL(`../assets/art-kit/${key}.glb`,import.meta.url))]));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function changedJson(bytes,edit){const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length));edit(json);const raw=Buffer.from(JSON.stringify(json)),padded=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]),tail=bytes.subarray(20+length),out=Buffer.alloc(20+padded.length+tail.length);bytes.copy(out,0,0,20);out.writeUInt32LE(out.length,8);out.writeUInt32LE(padded.length,12);padded.copy(out,20);tail.copy(out,20+padded.length);return out;}
test('actual shipping PNG pooling saves duplicate bytes and restores every GLB byte exactly',async()=>{
 assert.equal(typeof preparation.prepareArtPayload,'function');assert.equal(typeof restoration.restoreArtGlb,'function');
 const packed=await preparation.prepareArtPayload();
 assert.equal(packed.report.sourceBytes,11354124);
 assert.equal(packed.report.imageOccurrences,36);assert.equal(packed.report.uniqueImages,11);
 assert.equal(packed.report.imageBytes,8806617);assert.equal(packed.report.uniqueImageBytes,2659172);
 assert.equal(packed.report.duplicateImageBytes,6147445);
 assert.equal(packed.report.duplicateBufferViewBytes,6281405);
 assert.equal(packed.pool.byteLength,5206679);
 assert.deepEqual(Object.keys(packed.recipes),keys);
 const offsetPool=new Uint8Array(packed.pool.byteLength+9);offsetPool.set(packed.pool,5);
 for(const key of keys){const restored=restoration.restoreArtGlb(offsetPool.subarray(5,-4),packed.recipes[key]);assert.deepEqual(Buffer.from(restored),originals[key],key);assert.equal(hash(restored),hash(originals[key]));}
 const repeat=preparation.packArtGlbs(Object.fromEntries(Object.entries(originals).reverse()));
 assert.deepEqual(repeat.recipes,packed.recipes);assert.deepEqual(repeat.pool,packed.pool);assert.deepEqual(repeat.report,packed.report);
});
test('preparation rejects unsupported extensions, external bytes and malformed ranges instead of rewriting them',()=>{
 const b=originals['cargo-truck'];
 for(const [edit,reason] of [
  [j=>j.extensionsUsed=['EXT_unknown'],/extension/i],
  [j=>j.nodes[0].extensions={EXT_unknown:{}},/extension/i],
  [j=>j.buffers[0].uri='https://example.invalid/model.bin',/embedded/i],
  [j=>j.images[0].uri='https://example.invalid/image.png',/embedded/i],
  [j=>j.images[0].mimeType='image/jpeg',/PNG/i],
  [j=>j.bufferViews[j.images[0].bufferView].byteLength=2**32,/range/i],
  [j=>j.bufferViews[j.images[1].bufferView].byteOffset=j.bufferViews[j.images[0].bufferView].byteOffset+4,/overlap/i],
 ])assert.throws(()=>preparation.packArtGlbs({fixture:changedJson(b,edit)}),reason);
 const truncated=Buffer.from(b.subarray(0,-1));assert.throws(()=>preparation.packArtGlbs({fixture:truncated}),/length/i);
 const wrongVersion=Buffer.from(b);wrongVersion.writeUInt32LE(1,4);assert.throws(()=>preparation.packArtGlbs({fixture:wrongVersion}),/version/i);
 const wrongChunk=Buffer.from(b);wrongChunk.writeUInt32LE(0,24+b.readUInt32LE(12));assert.throws(()=>preparation.packArtGlbs({fixture:wrongChunk}),/BIN/i);
 const badPNG=Buffer.from(b),j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));badPNG[28+b.readUInt32LE(12)+j.bufferViews[j.images[0].bufferView].byteOffset]=0;assert.throws(()=>preparation.packArtGlbs({fixture:badPNG}),/PNG/i);
});
test('PNG signature validation never reads beyond a short declared image bufferView',()=>{
 // The underlying file retains a complete valid PNG signature. Only the view's
 // declared length changes, so reading following opaque bytes would hide the bug.
 for(let length=1;length<8;length++){
  const malformed=changedJson(originals['cargo-truck'],json=>{json.bufferViews[json.images[0].bufferView].byteLength=length;});
  assert.throws(()=>preparation.packArtGlbs({fixture:malformed}),/Invalid embedded PNG signature/,`declared PNG length ${length}`);
 }
});
test('restoration rejects bad spans before returning incomplete or oversized GLB data',()=>{
 const pool=new Uint8Array([1,2,3,4]);
 assert.deepEqual([...restoration.restoreArtGlb(pool,{byteLength:4,spans:[[2,2],[0,2]]})],[3,4,1,2]);
 for(const recipe of [null,{byteLength:4,spans:[]},{byteLength:3,spans:[[0,4]]},{byteLength:4,spans:[[-1,4]]},{byteLength:4,spans:[[1,4]]},{byteLength:4,spans:[[0,2.5],[0,1.5]]},{byteLength:2**40,spans:[[0,2**40]]}])assert.throws(()=>restoration.restoreArtGlb(pool,recipe),/art payload/i);
 assert.throws(()=>restoration.restoreArtGlb(null,{byteLength:4,spans:[[0,4]]}),/art payload/i);
});
