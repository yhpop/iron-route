import {createBattlefrontPerimeterGeometry} from '../battlefront-perimeter-view.js';
import {TERRAIN_TEXTURE_URLS} from '../../assets/terrain/runtime-textures.js';
import * as THREE from 'three';

import {terrainSurfaceAt,roadSample} from './heightfield.js';
import {noise} from './vendor/three-terrain/noise.js';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

const hash=(x,z)=>{const a=Math.sin(x*127.1+z*311.7)*43758.5453;
return a-Math.floor(a);
};

export function createReliefGeometry(f){const positions=[],colors=[],uv=[],indices=[];
for(let j=0;
j<=f.rows;
j++)for(let i=0;
i<=f.columns;
i++){const x=f.bounds.minX+i*f.dx,z=f.bounds.minZ+j*f.dz,k=j*(f.columns+1)+i,y=f.heights[k],surface=terrainSurfaceAt(f,x,z),r=roadSample(f.roads,x,z),grain=hash(i,j),macro=.06*Math.sin(x*.09+Math.sin(z*.07))+.025*Math.sin(z*.22),earth=[.21+macro,.235+macro,.135+macro],road=surface.roadMaterial==='asphalt'?[.105,.113,.112]:[.28,.23,.155],blend=surface.roadBlend;
let wear=0;
if(r&&r.material==='asphalt')wear=-.017*Math.exp(-(((r.distance-r.width*.25)/.33)**2));
positions.push(x,y,z);
colors.push(...earth.map((c,n)=>clamp(c*(1-blend)+(road[n]+wear)*blend+(grain-.5)*.025,.02,.9)));
uv.push(x/4,-z/4);
}for(let j=0;
j<f.rows;
j++)for(let i=0;
i<f.columns;
i++){const a=j*(f.columns+1)+i,b=a+1,c=a+f.columns+1,d=c+1;
indices.push(a,c,b,b,c,d);
}const g=new THREE.BufferGeometry();
g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
g.setIndex(indices);
g.computeVertexNormals();
g.computeBoundingSphere();
return g;
}
function replaceChunk(source,name,value){const key=`#include <${name}>`;if(!source.includes(key))throw new Error(`Missing shader chunk ${name}`);return source.replace(key,()=>value);}
export function patchReliefShader(shader,uniforms,{appearance='default'}={}){Object.assign(shader.uniforms,uniforms);
shader.vertexShader=replaceChunk(shader.vertexShader,'common','#include <common>\nvarying vec2 terrainXZ;');
shader.vertexShader=replaceChunk(shader.vertexShader,'begin_vertex','#include <begin_vertex>\nterrainXZ=position.xz;');
shader.fragmentShader=replaceChunk(shader.fragmentShader,'common',`#include <common>
varying vec2 terrainXZ;
uniform sampler2D terrainMask;uniform sampler2D earthColor;uniform sampler2D earthNormal;uniform sampler2D earthOrm;
uniform vec4 terrainBounds;
float terrainBlend;vec2 terrainUv;
`);
shader.fragmentShader=replaceChunk(shader.fragmentShader,'map_fragment',`
terrainUv=vec2(terrainXZ.x,-terrainXZ.y)/4.0;
vec4 terrainMasks=texture2D(terrainMask,(terrainXZ-terrainBounds.xy)/terrainBounds.zw);
terrainBlend=terrainMasks.r;
vec2 coarseUv=terrainUv*.213+vec2(13.2,8.4);
vec3 earthDetail=texture2D(earthColor,terrainUv).rgb;
float coarseLuma=dot(texture2D(earthColor,coarseUv).rgb,vec3(.333));
// Vegetated/compacted regions vary at metre scale instead of amplifying every grain.
vec3 terrainTint=mix(vec3(.40,.58,.27),vec3(.90,.80,.55),terrainMasks.b);
vec3 variedEarth=mix(vec3(.23,.21,.16),earthDetail,.25+.50*terrainMasks.b);
vec3 groundColor=variedEarth*terrainTint*(.82+coarseLuma*.65);
vec3 dirtColor=mix(vec3(.30,.21,.125),earthDetail*vec3(1.35,.94,.55),.50);
dirtColor*=1.0-terrainMasks.a*.30;
groundColor=mix(groundColor,dirtColor,terrainMasks.g);
// Metre-scale world weather breaks the identical four-metre asphalt repeat.
// The existing A channel is road weather on asphalt, wheel ruts on earth.
vec3 asphaltColor=texture2D(map,terrainUv).rgb*mix(.88,1.12,terrainMasks.a);
vec3 terrainColor=mix(groundColor,asphaltColor,terrainBlend);
diffuseColor.rgb*=terrainColor;
`);
shader.fragmentShader=replaceChunk(shader.fragmentShader,'roughnessmap_fragment',`float roughnessFactor=roughness;
float terrainRough=mix(texture2D(earthOrm,terrainUv).g,texture2D(roughnessMap,terrainUv).g*mix(.92,1.0,terrainMasks.a),terrainBlend);
roughnessFactor*=terrainRough;`);
shader.fragmentShader=replaceChunk(shader.fragmentShader,'normal_fragment_maps',`vec3 terrainNormal=normalize(mix(texture2D(earthNormal,terrainUv).xyz*2.0-1.0,texture2D(normalMap,terrainUv).xyz*2.0-1.0,terrainBlend));
terrainNormal.xy*=normalScale*mix(.25+.55*terrainMasks.b,1.0,terrainBlend);normal=normalize(tbn*terrainNormal);`);
if(appearance==='battlefront')shader.fragmentShader=shader.fragmentShader
 .replace('vec4 terrainMasks=texture2D(terrainMask,(terrainXZ-terrainBounds.xy)/terrainBounds.zw);',`bool terrainOutside=any(lessThan(terrainXZ,terrainBounds.xy))||any(greaterThan(terrainXZ,terrainBounds.xy+terrainBounds.zw));
vec4 terrainMasks=terrainOutside?vec4(0.0,0.0,.18,0.0):texture2D(terrainMask,(terrainXZ-terrainBounds.xy)/terrainBounds.zw);`)
 .replace('diffuseColor.rgb*=terrainColor;',`// battlefront coherent historic damage: mineral soil, dusty shoulders, charred cores; optical only.
float battleLuma=dot(earthDetail,vec3(.2126,.7152,.0722));
float battleAsh=smoothstep(.24,.48,terrainMasks.b)*(1.0-smoothstep(.64,.88,terrainMasks.b));
float battleSoot=smoothstep(.57,.88,terrainMasks.b);
float battleDamage=max(battleAsh,battleSoot);
vec3 mineralSoil=mix(vec3(.25,.22,.175),earthDetail*vec3(.94,.86,.73),.62);
vec3 compacted=mix(vec3(.25,.205,.15),earthDetail*vec3(1.0,.85,.65),.56);
compacted*=1.0-terrainMasks.a*.22;
mineralSoil=mix(mineralSoil,compacted,terrainMasks.g*.85);
vec3 battlePowder=mix(vec3(.34,.30,.25),vec3(battleLuma)*.86,.38);
vec3 battleChar=mix(vec3(.035,.030,.026),vec3(battleLuma)*.20,.35);
vec3 battleGround=mix(mineralSoil,battlePowder,battleAsh*.76)*(.87+coarseLuma*.44);
battleGround=mix(battleGround,battleChar,battleSoot*.88);
vec3 battlePigment=mix(battlePowder,battleChar,battleSoot);
vec3 battleRoad=mix(asphaltColor,battlePigment,.25*battleDamage);
terrainColor=mix(battleGround,battleRoad,terrainBlend);
diffuseColor.rgb*=terrainColor;`)
 .replace('normalScale*mix(.25+.55*terrainMasks.b,1.0,terrainBlend)','normalScale*mix(.48,1.0,terrainBlend)');
if(appearance==='scorched')shader.fragmentShader=shader.fragmentShader
 .replace('vec3 terrainTint=mix(vec3(.40,.58,.27),vec3(.90,.80,.55),terrainMasks.b);','// scorched: opt-in ash/earth palette; shared heightfield unchanged.\nvec3 terrainTint=mix(vec3(.64,.59,.52),vec3(.91,.79,.65),terrainMasks.b);')
 .replace('vec3(.23,.21,.16),earthDetail','vec3(.20,.18,.15),earthDetail')
 .replace('vec3(.30,.21,.125),earthDetail*vec3(1.35,.94,.55)','vec3(.23,.18,.13),earthDetail*vec3(1.05,.88,.68)');
if(appearance==='crossfire')shader.fragmentShader=shader.fragmentShader
 .replace('diffuseColor.rgb*=terrainColor;',`// crossfire shallow battle weather: optical soil/ash/soot only, no displacement.
float warLuma=dot(earthDetail,vec3(.2126,.7152,.0722));
float warAsh=smoothstep(.27,.48,terrainMasks.b)*(1.0-smoothstep(.58,.76,terrainMasks.b));
float warSoot=smoothstep(.55,.90,terrainMasks.b);
vec3 warSoil=mix(vec3(.16,.135,.105),earthDetail*vec3(.85,.82,.75),.58);
// Preserve the actual unpaved route and its wheel ruts before weather overlays.
vec3 warCompacted=mix(vec3(.19,.15,.10),earthDetail*vec3(.95,.78,.56),.62);
warCompacted*=1.0-terrainMasks.a*.28;
warSoil=mix(warSoil,warCompacted,terrainMasks.g*.82);
vec3 warPowder=mix(vec3(.34,.32,.28),vec3(warLuma)*.9,.45);
vec3 warChar=mix(vec3(.035,.033,.030),vec3(warLuma)*.23,.4);
vec3 warGround=mix(warSoil,warPowder,warAsh*.72)*(.80+coarseLuma*.55);
vec3 warRoad=mix(asphaltColor,vec3(warLuma)*vec3(.46,.43,.38),warAsh*.16);
terrainColor=mix(warGround,warRoad,terrainBlend);
terrainColor=mix(terrainColor,warChar,warSoot*(.86-.42*terrainBlend));
diffuseColor.rgb*=terrainColor;`)
 .replace('normalScale*mix(.25+.55*terrainMasks.b,1.0,terrainBlend)','normalScale*mix(.52,1.0,terrainBlend)');
}
// Raster edge erosion is visual only: no change to the shared contact heightfield.
export function roadMaterialWeight(r,x,z){
 if(!r)return 0;
 const hard=r.material==='asphalt';
 if(hard&&r.edge<=-.6)return 1;if(hard&&r.edge>=.3)return 0;
 // Coherent worn sections are larger than one mask texel (~8cm), with
 // restrained fine breakup. The 24cm local blend stays sharp, not metre-blurred.
 const erosion=hard?.02+.20*Math.max(0,noise.simplex(x*.43+5.3,z*.43-8.7))+.12*Math.max(0,noise.simplex(x*1.25+17,z*1.25-9))+.025*noise.simplex(x*3.4,z*3.4):.10*noise.simplex(x*1.5,z*1.5);
 const t=clamp((r.edge+erosion+(hard?.10:.25))/(hard?.24:1.05),0,1);
 return 1-t*t*(3-2*t);
}
/** Low-frequency wear follows world location and road use, not a repeated tile.
 * This changes appearance only; traction, routes and contact heights stay owned
 * by heightfield.js. Existing MIT-licensed THREE.Terrain noise is reused. */
export function asphaltWeatherWeight(r,x,z){
 if(!r||r.material!=='asphalt')return 0;
 const coarse=.5+.5*noise.simplex(x*.11+13.2,z*.11-4.1),patch=.5+.5*noise.simplex(x*.39-8.2,z*.39+17);
 const edge=clamp((r.distance-r.width*.30)/(r.width*.20),0,1),shoulder=edge*edge*(3-2*edge);
 const wheel=Math.exp(-(((r.distance-r.width*.26)/.42)**2));
 return clamp(.2+.44*coarse+.18*patch+.18*shoulder-.15*wheel,0,1);
}
/** Historical shallow surface damage, not crater physics. Three broad, warped
 * damage zones and coherent metre-scale weather reuse the existing B mask channel.
 * Original MIT THREE.Terrain noise is already embedded; no new asset or texture. */
export function crossfireWeatherWeight(x,z){
 const weather=noise.simplex(x*.075+21.7,z*.075-14.2),breakup=noise.simplex(x*.24-6.3,z*.24+11.9);
 const warp=weather*2.4;
 const west=Math.exp(-(((x+26+warp)/7.5)**2+((z-4)/13)**2));
 const east=Math.exp(-(((x-23-warp)/8)**2+((z+1)/15)**2));
 const ridge=Math.exp(-(((x+warp)/11)**2+((z+18)/7)**2));
 return clamp(.22+.19*weather+.09*breakup+.72*Math.max(west,east,ridge),0,1);
}
/** Existing B channel: four anchored continuous elliptical historic damage zones.
 * Quiet mineral negative space is deliberate; no displacement or contact changes.
 */
export function battlefrontWeatherWeight(x,z){
 const weather=noise.simplex(x*.075+21.7,z*.075-14.2);
 const warpX=1.2*noise.simplex(x*.11+9.3,z*.11-2.7),warpZ=1.2*noise.simplex(x*.11-4.6,z*.11+12.1);
 const zone=(cx,cz,rx,rz)=>Math.exp(-(((x-cx+warpX)/rx)**2+((z-cz+warpZ)/rz)**2));
 const damage=Math.max(zone(-26,25,8,10),zone(-30,18,7,10),zone(-32,-5,6,13),zone(19.5,0,6,10));
 return clamp(.12+.035*weather+.83*damage,0,1);
}
export function createReliefView(scene,field,{loadTextures=typeof document!=='undefined',maxAnisotropy=4,appearance='default'}={}){
const owned=[],loader=loadTextures?new THREE.TextureLoader():null,pending=[];
function map(name,slot){let t;if(loader){let resolve,reject;pending.push(new Promise((a,b)=>{resolve=a;reject=b;}));t=loader.load(TERRAIN_TEXTURE_URLS[name][slot],()=>resolve(),undefined,()=>reject(new Error(`Terrain texture failed: ${name}/${slot}`)));}else t=new THREE.DataTexture(new Uint8Array(slot==='normal'?[128,128,255,255]:[160,200,0,255]),1,1);
t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=slot==='baseColor'?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=Math.max(1,Math.min(8,maxAnisotropy));t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;/* TextureLoader marks its texture only after an image arrives. DataTexture is already initialized. */if(!loader)t.needsUpdate=true;owned.push(t);return t;}
const maps={};for(const n of ['asphalt','earth'])maps[n]={color:map(n,'baseColor'),normal:map(n,'normal'),orm:map(n,'orm')};
const size=1024,data=new Uint8Array(size*size*4),b=field.bounds,w=b.maxX-b.minX,h=b.maxZ-b.minZ;
const asphalt=field.roads.filter(r=>r.material==='asphalt'),earth=field.roads.filter(r=>r.material==='earth');

for(let j=0;j<size;j++)for(let i=0;i<size;i++){
const x=b.minX+(i+.5)/size*w,z=b.minZ+(j+.5)/size*h;
const dirtSample=roadSample(earth,x,z),hardSample=roadSample(asphalt,x,z),hard=roadMaterialWeight(hardSample,x,z),dirt=roadMaterialWeight(dirtSample,x,z)*(1-hard);
const tracks=dirtSample?Math.exp(-(((dirtSample.distance-dirtSample.width*.27)/.32)**2))*dirt:0;
const macro=appearance==='battlefront'?battlefrontWeatherWeight(x,z):appearance==='crossfire'?crossfireWeatherWeight(x,z):clamp(.5+.42*noise.simplex(x*.035,z*.035)+.13*noise.simplex(x*.11+3,z*.11-8),0,1);
const k=(j*size+i)*4;data[k]=Math.round(hard*255);data[k+1]=Math.round(dirt*255);data[k+2]=Math.round(macro*255);data[k+3]=Math.round((tracks+(hard>0?hard*asphaltWeatherWeight(hardSample,x,z):0))*255);
}
const mask=new THREE.DataTexture(data,size,size);mask.magFilter=THREE.LinearFilter;mask.minFilter=THREE.LinearMipmapLinearFilter;mask.generateMipmaps=true;mask.needsUpdate=true;owned.push(mask);
const geometry=createReliefGeometry(field),material=new THREE.MeshStandardMaterial({vertexColors:false,roughness:1,metalness:0,map:maps.asphalt.color,normalMap:maps.asphalt.normal,roughnessMap:maps.asphalt.orm,normalScale:new THREE.Vector2(.6,.6)});
material.onBeforeCompile=shader=>patchReliefShader(shader,{terrainMask:{value:mask},earthColor:{value:maps.earth.color},earthNormal:{value:maps.earth.normal},earthOrm:{value:maps.earth.orm},terrainBounds:{value:new THREE.Vector4(b.minX,b.minZ,w,h)}},{appearance});
material.customProgramCacheKey=()=> appearance==='battlefront'?'relief-pbr-world-weather-v6-battlefront-grounded':appearance==='crossfire'?'relief-pbr-world-weather-v4-crossfire':appearance==='scorched'?'relief-pbr-world-weather-v3-scorched':'relief-pbr-world-weather-v3';
const mesh=new THREE.Mesh(geometry,material);mesh.name='shared-heightfield-relief';mesh.receiveShadow=true;scene.add(mesh);
let perimeterMesh,perimeterDiagnostics;
if(appearance==='battlefront'){
 const perimeter=createBattlefrontPerimeterGeometry(field);perimeterDiagnostics=perimeter.diagnostics;
 perimeterMesh=new THREE.Mesh(perimeter.geometry,material);perimeterMesh.name='battlefront-optical-exterior-ground';perimeterMesh.castShadow=false;perimeterMesh.receiveShadow=true;perimeterMesh.userData.viewOnly=true;
 // Exclude this backdrop from generic selectable-object ray queries as well.
 perimeterMesh.raycast=()=>{};scene.add(perimeterMesh);
}
let disposed=false;
// Static terrain still implements the campaign view lifecycle contract.
return {mesh,...(perimeterMesh?{perimeterMesh}:{}),update(){},ready:Promise.all(pending),diagnostics:{triangles:geometry.index.count/3+(perimeterDiagnostics?.triangles??0),drawCalls:perimeterMesh?2:1,...(perimeterMesh?{baseTriangles:geometry.index.count/3,perimeterTriangles:perimeterDiagnostics.triangles,perimeter:perimeterDiagnostics}:{}),materials:'embedded-original-PBR',maskResolution:size,maskBaseBytes:data.byteLength,...(['crossfire','battlefront'].includes(appearance)?{additionalTextureBytes:0,appearance,damageIsSurfaceOnly:true}:{}),maskMipmappedBytes:(data.byteLength*4-4)/3,terrainHeightSource:'same grid triangle interpolation as contact sampler'},dispose(){if(disposed)return;disposed=true;scene.remove(mesh);if(perimeterMesh){scene.remove(perimeterMesh);perimeterMesh.geometry.dispose();}geometry.dispose();material.dispose();for(const t of owned)t.dispose();}};
}
