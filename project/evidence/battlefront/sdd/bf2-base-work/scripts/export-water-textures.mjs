/** Exact PNG mirrors of runtime DataTexture pixels. No image tool/dependency. */
import {writeFile,readFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createWaterPixels} from '../src/water-material.js';
const out=new URL('../assets/terrain/',import.meta.url),p=createWaterPixels();
const crc=data=>{let c=0xffffffff;for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
const chunk=(type,data)=>{const name=Buffer.from(type),n=Buffer.alloc(4),sum=Buffer.alloc(4);n.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([n,name,data,sum]);};
const files=[];
for(const [key,filename] of [['baseColor','water-basecolor.png'],['normal','water-normal.png'],['roughness','water-roughness.png']]){
 const header=Buffer.alloc(13);header.writeUInt32BE(p.size,0);header.writeUInt32BE(p.size,4);header[8]=8;header[9]=6;
 const stride=p.size*4,rows=Buffer.alloc((stride+1)*p.size);
 // DataTexture row zero is UV v=0. PNG row zero is TOP; reverse rows so
 // Blender's default UV/image convention reads exactly the runtime field.
 for(let y=0;y<p.size;y++)rows.set(p[key].subarray((p.size-y-1)*stride,(p.size-y)*stride),y*(stride+1)+1);
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);await writeFile(new URL(filename,out),png);files.push({file:filename,sha256:createHash('sha256').update(png).digest('hex'),bytes:png.length,rawRuntimeRGBA256SHA256:createHash('sha256').update(p[key]).digest('hex')});
}
const sourceHash=createHash('sha256').update(await readFile(new URL('../src/water-material.js',import.meta.url))).digest('hex');
await writeFile(new URL('water-manifest.json',out),JSON.stringify({schema:1,provenance:'Original deterministic periodic trigonometric field authored in water-material.js; no third-party images/assets.',source:'campaign/src/water-material.js',sourceSHA256:sourceHash,size:p.size,files,material:{name:'industrial-basin-water',color:0xffffff,roughness:.47,metalness:0,normalScale:[.8,.8],transparent:false},uv:{repeat:[1,1],initialOffset:[0,0],normalDriftPerSecond:[.004,.0015],maximumDt:.1,geometryUV:'Existing terrain water UVs are metres / 8; unchanged.',pngRows:'Vertically reversed relative to DataTexture byte rows for matching Blender UV orientation.'},runtime:{externalRequests:0,customShader:false,vertexDisplacement:false,generatedMaps:3,mipmappedGpuMiB:1}},null,2)+'\n');
console.log(JSON.stringify(files,null,2));
