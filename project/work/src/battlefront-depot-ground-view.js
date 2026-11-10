import * as THREE from 'three';
import {sampleHeightfield,roadSample} from './terrain-candidate/heightfield.js';
/** Static optical ash and small flat spalls, NOT physical rubble. One bucket;
 * each output triangle stays inside one authoritative contact triangle.
 * No new textures, bodies, frame allocation, timers or terrain writes. */
export function createBattlefrontDepotGroundView(parent,spec,field){
 const root=new THREE.Group();root.name='battlefront-ground';
 const sources=(spec.geometry||[]).filter(c=>c.ruinInstanceId).map(c=>({id:c.id,instanceId:c.ruinInstanceId,x:c.x,z:c.z,width:c.width,depth:c.depth,yaw:c.yaw||0}));
 const positions=[],colors=[],triangles=[],b=field.bounds;
 let seed=908021;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 const lane=(x,z)=>{const r=roadSample(field.roads,x,z);return r&&r.edge<.65;};
 function nearest(x,z){let best={distance:Infinity,source:null};for(const c of sources){const co=Math.cos(c.yaw),si=Math.sin(c.yaw),dx=x-c.x,dz=z-c.z,lx=co*dx-si*dz,lz=si*dx+co*dz,ax=Math.abs(lx)-c.width/2,az=Math.abs(lz)-c.depth/2,d=Math.hypot(Math.max(0,ax),Math.max(0,az))+Math.min(0,Math.max(ax,az));const distance=Math.abs(d);if(distance<best.distance)best={distance,source:c};}return best;}
 const rgba=new Float32Array((field.columns+1)*(field.rows+1)*4);
 for(let j=0;j<=field.rows;j++)for(let i=0;i<=field.columns;i++){
  const x=b.minX+i*field.dx,z=b.minZ+j*field.dz,k=(j*(field.columns+1)+i)*4,d=nearest(x,z).distance,warp=1+.16*Math.sin(x*.81+z*.63),t=Math.max(0,1-d/(1.65*warp)),a=lane(x,z)?0:t*t*(3-2*t)*.40,grain=.012*Math.sin(x*.91+Math.sin(z*.63));
  rgba.set([.125+grain,.112+grain,.092+grain,a],k);
 }
 function cell(i,j,t){const x=b.minX+i*field.dx,z=b.minZ+j*field.dz;return t?[[x+field.dx,z+field.dz],[x,z+field.dz],[x+field.dx,z]]:[[x,z],[x+field.dx,z],[x,z+field.dz]];}
 function emit(points,rgbaValues,kind,i,j,t,sourceId=null){const offset=kind==='wear'?.008:.014;for(let k=0;k<3;k++){const [x,z]=points[k];positions.push(x,sampleHeightfield(field,x,z).height+offset,z);colors.push(...rgbaValues[k]);}triangles.push({kind,cell:[i,j],triangle:t,offset,sourceId});}
 let wearTriangles=0,spallTriangles=0;
 for(let j=0;j<field.rows;j++)for(let i=0;i<field.columns;i++)for(let t=0;t<2;t++){
  const idx=t?[[i+1,j+1],[i,j+1],[i+1,j]]:[[i,j],[i+1,j],[i,j+1]],c=idx.map(([x,z])=>Array.from(rgba.slice((z*(field.columns+1)+x)*4,(z*(field.columns+1)+x)*4+4)));
  if(c.some(a=>a[3]>0)){emit(cell(i,j,t),c,'wear',i,j,t);wearTriangles++;}
 }
 // Choose scalene inset barycentric shards around actual wall feet, not copies
 // of grid silhouettes. Entire shard lies in the chosen convex terrain triangle.
 for(let attempt=0;attempt<4000&&spallTriangles<340;attempt++){
  const c=sources[Math.floor(random()*sources.length)];if(!c)break;
  const side=Math.floor(random()*4),u=random()-.5,co=Math.cos(c.yaw),si=Math.sin(c.yaw),lx=side<2?u*c.width:(side===2?1:-1)*(c.width/2+.15+random()*.85),lz=side<2?(side===0?1:-1)*(c.depth/2+.15+random()*.85):u*c.depth,x=c.x+co*lx+si*lz,z=c.z-si*lx+co*lz;
  if(x<=b.minX||x>=b.maxX||z<=b.minZ||z>=b.maxZ||lane(x,z))continue;
  const s=sampleHeightfield(field,x,z),[i,j]=s.cell,t=s.triangle,p=cell(i,j,t),center=[p.reduce((v,a)=>v+a[0],0)/3,p.reduce((v,a)=>v+a[1],0)/3],angle=random()*Math.PI*2,size=.045+random()*.15;
  const points=[0,1,2].map(k=>{const a=angle+k*Math.PI*2/3+(random()-.5)*.6,r=size*(.55+random()*.45);return [center[0]+Math.cos(a)*r,center[1]+Math.sin(a)*r];});
  if(points.some(([xx,zz])=>{const q=sampleHeightfield(field,xx,zz);return q.cell[0]!==i||q.cell[1]!==j||q.triangle!==t||lane(xx,zz)||nearest(xx,zz).distance>1.65;}))continue;
  const shade=.18+random()*.12;emit(points,points.map(()=>[shade,shade*.94,shade*.82,.90]),'spall',i,j,t,c.id);spallTriangles++;
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide,transparent:true,opacity:1,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const mesh=new THREE.Mesh(geometry,material);mesh.name='battlefront-ground-detail';mesh.receiveShadow=true;mesh.userData.collision='none-paint-only';root.add(mesh);parent.add(root);
 const diagnostics={enabled:true,drawBuckets:1,triangles:triangles.length,wearTriangles,spallTriangles,physicsBodiesAdded:0,walkableMaxThickness:.014,additionalTextures:0,additionalTextureBytes:0,sources,triangleInventory:triangles,disposed:false};
 return {root,diagnostics,update(){/* Authored once. Intentionally no per-frame work. */},dispose(){if(diagnostics.disposed)return;diagnostics.disposed=true;root.removeFromParent();geometry.dispose();material.dispose();}};
}
