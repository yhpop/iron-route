/** Actual generated mission geometry; not a unit-field substitute or physical rubble. */
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {readFileSync} from 'node:fs';import * as THREE from 'three';import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createBattlefrontDepotFront} from '../src/battlefront-depot-front.js';import {createCrossfireWarfieldView} from '../src/crossfire-warfield-view.js';import {sampleHeightfield,roadSample} from '../src/terrain-candidate/heightfield.js';import {ruinedDepotColliders} from '../src/ruined-depot-layout.js';
const hash=a=>createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
export function audit(){
 const {spec,field}=createBattlefrontDepotFront(),root=new THREE.Group(),view=createCrossfireWarfieldView(root,spec,field),second=createCrossfireWarfieldView(new THREE.Group(),spec,field),mesh=view.root.children[0],p=mesh.geometry.attributes.position,c=mesh.geometry.attributes.color,inv=view.diagnostics.triangleInventory,shared=new Map(),placements={};
 const oldSource=readFileSync(new URL('../../evidence/battlefront/sdd/bf2-base-work/src/crossfire-warfield-view.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export function','function');const oldCreate=new Function('THREE','mergeGeometries','sampleHeightfield',oldSource+'\nreturn createCrossfireWarfieldView;')(THREE,mergeGeometries,sampleHeightfield),old=oldCreate(new THREE.Group(),spec,field),oldSoot=old.root.getObjectByName('warfield-soot').geometry.attributes.position.count/3;
 try{
  assert.equal(inv.length,p.count/3);assert.equal(c.itemSize,4);assert.ok(inv.length<=oldSoot+460);assert.equal(hash(p.array),hash(second.root.children[0].geometry.attributes.position.array));assert.equal(hash(c.array),hash(second.root.children[0].geometry.attributes.color.array));
  const source=ruinedDepotColliders(spec.ruinedDepotLayout).map(a=>({id:a.id,instanceId:a.ruinInstanceId,x:a.x,z:a.z,width:a.width,depth:a.depth,yaw:a.yaw||0}));assert.deepEqual(view.diagnostics.sources,source);
  let maxOffset=0,minArea=Infinity,spallMaxRadius=0;
  for(let n=0;n<inv.length;n++){
   const q=inv[n],points=[0,1,2].map(k=>[p.getX(n*3+k),p.getY(n*3+k),p.getZ(n*3+k)]),[i,j]=q.cell;
   const area=Math.abs((points[1][0]-points[0][0])*(points[2][2]-points[0][2])-(points[2][0]-points[0][0])*(points[1][2]-points[0][2]))/2;assert.ok(area>1e-6);minArea=Math.min(minArea,area);
   for(let a=0;a<=4;a++)for(let b=0;b<=4-a;b++){
    const weights=[a/4,b/4,1-(a+b)/4],pt=[0,1,2].map(k=>points.reduce((v,p,l)=>v+p[k]*weights[l],0));assert.ok(pt.every(Number.isFinite));
    const u=(pt[0]-field.bounds.minX)/field.dx-i,v=(pt[2]-field.bounds.minZ)/field.dz-j;assert.ok(u>=-1e-5&&u<=1+1e-5&&v>=-1e-5&&v<=1+1e-5);assert.ok(q.triangle?u+v>=1-1e-5:u+v<=1+1e-5,'entire triangle is within declared authoritative triangle');
    const offset=pt[1]-sampleHeightfield(field,pt[0],pt[2]).height;assert.ok(Math.abs(offset-q.offset)<2e-6,'interior contact paint offset');assert.ok(offset<=.018);maxOffset=Math.max(maxOffset,offset);
    if(q.kind==='spall'){const road=roadSample(field.roads,pt[0],pt[2]);assert.ok(!road||road.edge>=.65-1e-5,'road lanes clear');}
   }
   if(q.kind==='wear')for(let k=0;k<3;k++){const key=points[k][0]+','+points[k][2],rgba=[0,1,2,3].map(a=>c.array[(n*3+k)*4+a]);if(shared.has(key))assert.deepEqual(rgba,shared.get(key));else shared.set(key,rgba);}
   else {const s=source.find(s=>s.id===q.sourceId);assert.ok(s);placements[s.instanceId]=(placements[s.instanceId]||0)+1;const center=points.reduce((a,p)=>[a[0]+p[0]/3,a[1]+p[2]/3],[0,0]);spallMaxRadius=Math.max(spallMaxRadius,...points.map(p=>Math.hypot(p[0]-center[0],p[2]-center[1])));assert.ok(area<field.dx*field.dz*.20,'not terrain-triangle silhouette');}
  }
  assert.equal(Object.keys(placements).length,3);assert.ok(spallMaxRadius<.4);
  return {boundary:'CPU generated geometry and source transforms, not renderer/beauty/physical rubble acceptance',missionId:spec.id,field:{columns:field.columns,rows:field.rows,dx:field.dx,dz:field.dz},oldVisibleSootTriangles:oldSoot,oldTotalWarfieldTriangles:old.diagnostics.triangles,oldDrawBuckets:old.diagnostics.drawBuckets,newGroundTriangles:inv.length,wearTriangles:view.diagnostics.wearTriangles,spallTriangles:view.diagnostics.spallTriangles,drawBuckets:1,positionSHA256:hash(p.array),colorSHA256:hash(c.array),positionBytes:p.array.byteLength,colorBytes:c.array.byteLength,normalBytes:mesh.geometry.attributes.normal.array.byteLength,maxObservedOffset:maxOffset,minTriangleArea:minArea,spallMaxRadius,sharedWearVertices:shared.size,placements,sources:view.diagnostics.sources,physicsBodiesAdded:0,additionalTextures:0,additionalTextureBytes:0};
 }finally{view.dispose();second.dispose();old.dispose();}
}
test('all actual freight-yard ground triangles have authoritative containment, interior contact, continuous shared RGBA and bounded placement/budgets',()=>{const result=audit();assert.equal(result.spallTriangles,340);assert.equal(result.newGroundTriangles,2666);assert.equal(result.positionSHA256,'9167ec5512feea243e87653e1920c833f463d7d87711c88d746bd25d5fe0e66c');assert.equal(result.colorSHA256,'1783a25fba6cf2848c88809bddc72d7518d66e62bdb1298ada1e720712f3e9cd');});
