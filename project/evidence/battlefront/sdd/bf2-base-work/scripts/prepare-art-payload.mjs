/** Pure Node, lossless PNG-span pooling. Authored GLBs are read, never rewritten. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
export const ART_ASSET_KEYS=Object.freeze(['cargo-truck','pump-station','sentry-turret','service-workshop','warehouse-sawtooth']);
const defaultDirectory=fileURLToPath(new URL('../assets/art-kit/',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const pngSignature=Buffer.from([137,80,78,71,13,10,26,10]);
function rejectExtensions(value){
 if(!value||typeof value!=='object')return;
 for(const [key,child]of Object.entries(value)){
  if(['extensions','extensionsUsed','extensionsRequired'].includes(key)&&child&&Object.keys(child).length)throw new Error('Unsupported glTF extension in art payload');
  rejectExtensions(child);
 }
}
function inspectGlb(raw){
 if(!(raw instanceof Uint8Array))throw new Error('Art GLB must be embedded bytes');
 const bytes=Buffer.from(raw.buffer,raw.byteOffset,raw.byteLength);
 if(bytes.length<28||bytes.readUInt32LE(0)!==0x46546c67)throw new Error('Invalid GLB header');
 if(bytes.readUInt32LE(4)!==2)throw new Error('Unsupported GLB version');
 if(bytes.readUInt32LE(8)!==bytes.length)throw new Error('Invalid GLB length');
 const jsonLength=bytes.readUInt32LE(12),binHeader=20+jsonLength;
 if(jsonLength%4||binHeader+8>bytes.length||bytes.readUInt32LE(16)!==0x4e4f534a)throw new Error('Invalid GLB JSON chunk');
 const json=JSON.parse(bytes.subarray(20,binHeader).toString('utf8'));
 rejectExtensions(json);
 if(json.asset?.version!=='2.0')throw new Error('Unsupported glTF asset version');
 if(bytes.readUInt32LE(binHeader+4)!==0x004e4942)throw new Error('Expected single GLB BIN chunk');
 const binStart=binHeader+8,binLength=bytes.readUInt32LE(binHeader);
 if(binLength%4||binStart+binLength!==bytes.length)throw new Error('Invalid GLB BIN length or extra chunks');
 const buffers=json.buffers;
 if(!Array.isArray(buffers)||buffers.length!==1||buffers[0].uri!==undefined)throw new Error('Expected one embedded GLB buffer');
 const bufferLength=buffers[0].byteLength;
 if(!Number.isSafeInteger(bufferLength)||bufferLength<0||bufferLength>binLength||binLength-bufferLength>3)throw new Error('Invalid GLB buffer range');
 const views=json.bufferViews||[];
 for(const view of views){const offset=view.byteOffset??0;if(view.buffer!==0||!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(view.byteLength)||view.byteLength<=0||offset>bufferLength-view.byteLength)throw new Error('Invalid GLB bufferView range');}
 const ranges=[];const seenViews=new Set();
 for(const image of json.images||[]){
  if(image.uri!==undefined||!Number.isSafeInteger(image.bufferView)||!views[image.bufferView])throw new Error('Expected embedded PNG bufferView');
  if(image.mimeType!=='image/png')throw new Error('Only embedded PNG images are supported');
  const view=views[image.bufferView],offset=binStart+(view.byteOffset??0);
  // A repeated image reference is not repeated bytes in this source file.
  if(!seenViews.has(image.bufferView)){ranges.push({offset,length:view.byteLength,names:[image.name??'']});seenViews.add(image.bufferView);}
 }
 ranges.sort((a,b)=>a.offset-b.offset);
 let end=binStart;
 for(const range of ranges){
  if(range.offset<end)throw new Error('Overlapping image bufferViews are unsupported');
  end=range.offset+range.length;
  if(range.length<pngSignature.length||!bytes.subarray(range.offset,range.offset+pngSignature.length).equals(pngSignature))throw new Error('Invalid embedded PNG signature');
 }
 return {bytes,json,binStart,views,ranges};
}
export function packArtGlbs(records){
 const chunks=[],images=new Map(),allViews=new Map(),recipes={},sources=[];
 let poolBytes=0,sourceBytes=0,imageBytes=0,imageOccurrences=0,bufferViewBytes=0;
 const append=bytes=>{const span=[poolBytes,bytes.length];chunks.push(bytes);poolBytes+=bytes.length;return span;};
 for(const key of Object.keys(records).sort()){
  const {bytes,binStart,views,ranges}=inspectGlb(records[key]);const spans=[];let cursor=0;
  for(const view of views){const data=bytes.subarray(binStart+(view.byteOffset??0),binStart+(view.byteOffset??0)+view.byteLength);bufferViewBytes+=data.length;allViews.set(sha(data),data.length);}
  for(const range of ranges){
   if(range.offset>cursor)spans.push(append(bytes.subarray(cursor,range.offset)));
   const data=bytes.subarray(range.offset,range.offset+range.length),hash=sha(data);
   let shared=images.get(hash);
   if(shared&&!shared.bytes.equals(data))throw new Error('Image hash collision');
   if(!shared){shared={bytes:data,span:append(data),occurrences:0};images.set(hash,shared);}
   shared.occurrences++;spans.push(shared.span);imageBytes+=range.length;imageOccurrences++;cursor=range.offset+range.length;
  }
  if(cursor<bytes.length)spans.push(append(bytes.subarray(cursor)));
  recipes[key]={byteLength:bytes.length,spans};sourceBytes+=bytes.length;
  sources.push({key,bytes:bytes.length,sha256:sha(bytes),imageOccurrences:ranges.length,imageBytes:ranges.reduce((sum,range)=>sum+range.length,0)});
 }
 const uniqueImageBytes=[...images.values()].reduce((sum,image)=>sum+image.bytes.length,0);
 const report={format:'campaign-art-png-pool-v1',sourceBytes,poolBytes,savedBytes:sourceBytes-poolBytes,imageOccurrences,uniqueImages:images.size,imageBytes,uniqueImageBytes,duplicateImageBytes:imageBytes-uniqueImageBytes,bufferViewBytes,uniqueBufferViewBytes:[...allViews.values()].reduce((a,b)=>a+b,0),duplicateBufferViewBytes:bufferViewBytes-[...allViews.values()].reduce((a,b)=>a+b,0),sources,images:[...images.entries()].map(([sha256,image])=>({sha256,bytes:image.bytes.length,occurrences:image.occurrences})),reconstruction:'byte-identical-original-glb',performanceMeasured:false};
 return {pool:Buffer.concat(chunks,poolBytes),recipes,report};
}
export async function prepareArtPayload({assetDirectory=defaultDirectory}={}){
 const records=Object.fromEntries(await Promise.all(ART_ASSET_KEYS.map(async key=>[key,await readFile(path.join(assetDirectory,`${key}.glb`))])));
 return packArtGlbs(records);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const {pool,recipes,report}=await prepareArtPayload();
 if(process.argv[2]){const out=path.resolve(process.argv[2]);await mkdir(out,{recursive:true});await writeFile(path.join(out,'art-payload.bin'),pool);await writeFile(path.join(out,'art-payload-recipes.json'),JSON.stringify(recipes,null,2)+'\n');await writeFile(path.join(out,'art-payload-report.json'),JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify(report,null,2));
}
