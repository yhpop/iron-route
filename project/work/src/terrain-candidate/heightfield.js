import {noise} from './vendor/three-terrain/noise.js';

noise.seed(5271);

/** Original deterministic terrain model. Geometry and support use the SAME grid triangles. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const smooth=t=>{t=clamp(t,0,1);
return t*t*(3-2*t);
};

export const HEIGHTFIELD_PRESET=Object.freeze({bounds:{minX:-60,maxX:60,minZ:-60,maxZ:60},cellSize:.75,roads:[{width:7,material:'asphalt',points:[[-60,0],[-15,0],[16,0],[60,8]]},{width:5,material:'earth',points:[[-15,0],[0,12],[18,20],[38,15],[60,8]]}]});

export function roadSample(roads,x,z){let best=null;
for(const r of roads||[])for(let i=1;
i<r.points.length;
i++){const a=r.points[i-1],b=r.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length2=dx*dx+dz*dz;
if(!length2)continue;
const t=clamp(((x-a[0])*dx+(z-a[1])*dz)/length2,0,1),px=a[0]+t*dx,pz=a[1]+t*dz,d=Math.hypot(x-px,z-pz),edge=d-r.width/2;
if(!best||edge<best.edge)best={distance:d,edge,x:px,z:pz,width:r.width,material:r.material};
}return best;
}
const naturalHeight=(x,z)=>3.8*Math.exp(-((x-10)**2/520+(z-23)**2/240))+2.2*Math.exp(-((x+26)**2/600+(z+22)**2/300))-.7*Math.exp(-((x-30)**2/650+(z+26)**2/190))+.12*noise.simplex(x*.055,z*.055)+.025*noise.perlin(x*.3,z*.3);

function authoredHeight(x,z,roads){const h=naturalHeight(x,z),r=roadSample(roads,x,z);
if(!r)return h;
const blend=1-smooth((r.distance-r.width/2)/4.5),crown=.055*(1-clamp(r.distance/(r.width/2),0,1)**2),rut=r.material==='earth'?-.035*Math.exp(-(((r.distance-r.width*.27)/.22)**2)):0;
return h+(crown+rut)*blend;
}
export function createHeightfield(spec){const b=spec?.bounds,cell=spec?.cellSize;
if(!b||![b.minX,b.maxX,b.minZ,b.maxZ,cell].every(Number.isFinite)||b.maxX<=b.minX||b.maxZ<=b.minZ||cell<=0)throw new RangeError('Invalid heightfield dimensions');
const columns=Math.ceil((b.maxX-b.minX)/cell),rows=Math.ceil((b.maxZ-b.minZ)/cell);
if(columns*rows>250000)throw new RangeError('Heightfield exceeds candidate budget');
const dx=(b.maxX-b.minX)/columns,dz=(b.maxZ-b.minZ)/rows,heights=new Float64Array((columns+1)*(rows+1)),roads=JSON.parse(JSON.stringify(spec.roads||[]));
for(let j=0;
j<=rows;
j++)for(let i=0;
i<=columns;
i++){const x=b.minX+i*dx,z=b.minZ+j*dz,h=spec.heightAt?spec.heightAt(x,z):authoredHeight(x,z,roads);
if(!Number.isFinite(h))throw new RangeError('Non-finite terrain height');
heights[j*(columns+1)+i]=h;
}return {bounds:{...b},columns,rows,dx,dz,heights,roads};
}
export function sampleHeightfield(f,x,z){const b=f.bounds;
if(!Number.isFinite(x)||!Number.isFinite(z)||x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ)throw new RangeError('Terrain sample outside bounds');
const gx=(x-b.minX)/f.dx,gz=(z-b.minZ)/f.dz,i=Math.min(Math.floor(gx),f.columns-1),j=Math.min(Math.floor(gz),f.rows-1),u=gx-i,v=gz-j,k=j*(f.columns+1)+i,a=f.heights[k],bb=f.heights[k+1],c=f.heights[k+f.columns+1],d=f.heights[k+f.columns+2];
let height,sx,sz;
if(u+v<=1){height=a+(bb-a)*u+(c-a)*v;
sx=(bb-a)/f.dx;
sz=(c-a)/f.dz;
}else{height=d+(c-d)*(1-u)+(bb-d)*(1-v);
sx=(d-c)/f.dx;
sz=(d-bb)/f.dz;
}const length=Math.hypot(sx,1,sz);
return {height,normal:{x:-sx/length,y:1/length,z:-sz/length},cell:[i,j],triangle:u+v<=1?0:1};
}
export function terrainSurfaceAt(f,x,z){const hard=roadSample(f.roads.filter(r=>r.material==='asphalt'),x,z),r=hard&&hard.edge<0?hard:roadSample(f.roads,x,z),road=r&&r.edge<0;
return {class:road&&r.material==='asphalt'?'road':'earth',traction:road&&r.material==='asphalt'?1:.76,drag:road&&r.material==='asphalt'?1:1.35,roadBlend:r?1-smooth((r.edge+.35)/1.8):0,roadMaterial:r?.material||null};
}
/** Four support points define a conservative rigid support plane. Suspension is not simulated. */
export function sampleGroundContact(f,x,z,yaw,{halfWidth=.95,halfLength=1.41}={}){
 const co=Math.cos(yaw),si=Math.sin(yaw),at=(lx,lz)=>sampleHeightfield(f,x+co*lx+si*lz,z-si*lx+co*lz).height;

 const sx=(at(halfWidth,0)-at(-halfWidth,0))/(2*halfWidth),sz=(at(0,halfLength)-at(0,-halfLength))/(2*halfLength);

 const normalize=v=>{const l=Math.hypot(...v);
return v.map(n=>n/l);
},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

 const up=normalize([-sx,1,-sz]),right0=normalize([1,sx,0]),forward=normalize(cross(right0,up)),right=normalize(cross(up,forward)),samples=[];

 for(const lx of [-halfWidth,0,halfWidth])for(let i=0;
i<=8;
i++){const lz=-halfLength+i*halfLength/4,rx=right[0]*lx+forward[0]*lz,ry=right[1]*lx+forward[1]*lz,rz=right[2]*lx+forward[2]*lz,wx=x+co*rx+si*rz,wz=z-si*rx+co*rz;
samples.push({lx,lz,x:wx,z:wz,offsetY:ry,groundY:sampleHeightfield(f,wx,wz).height});
}
 const height=Math.max(...samples.map(s=>s.groundY-s.offsetY));
for(const s of samples)s.supportY=height+s.offsetY;

 return {height,pitch:Math.atan(sz),roll:-Math.atan(sx),slopeX:sx,slopeZ:sz,basis:{right,up,forward},maxGap:Math.max(...samples.map(s=>s.supportY-s.groundY)),samples};

}
