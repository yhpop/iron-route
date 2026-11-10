import * as THREE from 'three';

export const WATER_TEXTURE_SIZE=256;
const TAU=Math.PI*2;
// Integer spatial frequencies make the authored field exactly periodic. No RNG,
// downloaded photograph, wall-clock phase, shader replacement or geometry motion.
const WAVES=[[2,3,.52,.4],[5,-2,.24,1.7],[11,4,.11,2.4],[17,8,.055,.8],[31,-7,.025,2.9]];
export function sampleWaterField(u,v){
 let ripple=0,dx=0,dy=0;
 for(const [x,y,a,p] of WAVES){const phase=TAU*(x*u+y*v)+p;ripple+=Math.sin(phase)*a;dx+=Math.cos(phase)*a*x;dy+=Math.cos(phase)*a*y;}
 const broad=Math.sin(TAU*(u+2*v)+.9)*.58+Math.cos(TAU*(3*u-v)+.3)*.25;
 return {ripple,dx,dy,broad};
}
export function createWaterPixels(){
 const size=WATER_TEXTURE_SIZE,baseColor=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4),roughness=new Uint8Array(size*size*4);
 const byte=v=>Math.max(0,Math.min(255,Math.round(v)));
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=(y*size+x)*4,{ripple,dx,dy,broad}=sampleWaterField(x/size,y/size),tone=broad*7+ripple*4;
  baseColor.set([byte(43+tone),byte(72+tone),byte(78+tone*.9),255],i);
  const nx=-dx*.11,ny=-dy*.11,length=Math.hypot(nx,ny,1);
  normal.set([byte((nx/length*.5+.5)*255),byte((ny/length*.5+.5)*255),byte((1/length*.5+.5)*255),255],i);
  const r=byte(213+broad*15+ripple*11);roughness.set([r,r,r,255],i);
 }
 return {size,baseColor,normal,roughness};
}

/** Material-only view adapter. The caller retains all polygon/hole/elevation and
 * collider ownership. Standard Three shaders receive no vertex modifications. */
export function createWaterMaterial(options={}){
 const pixels=createWaterPixels(),textures=[];
 const texture=(data,name,colorSpace)=>{const t=new THREE.DataTexture(data,pixels.size,pixels.size,THREE.RGBAFormat);t.name=name;t.colorSpace=colorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=2;t.needsUpdate=true;textures.push(t);return t;};
 const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.47,metalness:0,map:texture(pixels.baseColor,'water-basecolor',THREE.SRGBColorSpace),normalMap:texture(pixels.normal,'water-normal',THREE.NoColorSpace),roughnessMap:texture(pixels.roughness,'water-roughness',THREE.NoColorSpace),normalScale:new THREE.Vector2(.8,.8)});
 material.name='industrial-basin-water';material.userData.collision='none-material-only';
 let disposed=false;
 return {material,ready:Promise.resolve({loaded:3,failed:0}),diagnostics:{externalRequests:0,textureCount:3,textureSize:pixels.size,textureGpuMiB:3*pixels.size*pixels.size*4*4/3/1048576,vertexDisplacement:false},
  update(dt,frame={}){if(disposed||(frame.reducedMotion??options.reducedMotion)||!Number.isFinite(dt)||dt<=0)return;const step=Math.min(dt,.1),offset=material.normalMap.offset;offset.x=(offset.x+step*.004)%1;offset.y=(offset.y+step*.0015)%1;},
  dispose(){if(disposed)return;disposed=true;material.dispose();for(const t of textures)t.dispose();}
 };
}
