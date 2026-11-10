import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
/** Engineered retaining walls / blast-panel fences, always inside the existing
 * collision prism. Long walls keep metre-sized panel joints, never stretched facades. */
export function createWallView(c,{appearance='default'}={}){
 const root=new THREE.Group();root.name=`solid:${c.id}`;root.position.set(c.x,c.y||0,c.z);root.rotation.y=c.yaw||0;
 const geometries=[],materials=[],buckets=[[],[],[]],w=c.width,d=c.depth,h=c.height;
 const material=(color)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.89});materials.push(m);return m;};
 // Only the crossfire view opts into burned concrete; geometry and legacy
 // material colors stay identical. Avoid pale continuous caps reading as new fences.
 const palette=appearance==='crossfire'?[material(0x655d50),material(0x514b42),material(0x302f2b)]:[material(c.destructible?0x8b806c:0x837e71),material(c.destructible?0x4c5955:0xaaa28e),material(c.destructible?0xc3a34f:0x515b58)];
 const box=(width,height,depth,x,y,z,bucket=0)=>buckets[bucket].push(new THREE.BoxGeometry(width,height,depth).translate(x,y,z));
 const cap=Math.min(.18,h*.12),base=Math.min(.25,h*.2),inset=Math.min(.07,Math.min(w,d)*.06);
 box(w-inset*2,h-cap-base,d-inset*2,0,base+(h-cap-base)/2,0);
 box(w,base,d,0,base/2,0,1);box(w,cap,d,0,h-cap/2,0,1);
 const alongX=w>=d,length=alongX?w:d,thickness=alongX?d:w,panels=Math.max(1,Math.ceil(length/(c.destructible?2.3:3.6)));
 for(let i=1;i<panels;i++){const a=-length/2+length*i/panels,face=thickness/2-inset*.75;for(const side of [-1,1]){if(alongX)box(.035,h-cap-base,.018,a,base+(h-cap-base)/2,side*face,2);else box(.018,h-cap-base,.035,side*face,base+(h-cap-base)/2,a,2);}}
 if(c.destructible){const bandHeight=Math.min(.23,h*.12),bandLength=Math.min(1.1,length*.25);for(const a of [-length*.28,length*.28])for(const side of [-1,1]){const face=thickness/2-inset*.6;if(alongX)box(bandLength,bandHeight,.018,a,h*.57,side*face,2);else box(.018,bandHeight,bandLength,side*face,h*.57,a,2);}}
 for(let i=0;i<buckets.length;i++)if(buckets[i].length){const g=mergeGeometries(buckets[i]);for(const part of buckets[i])part.dispose();geometries.push(g);const mesh=new THREE.Mesh(g,palette[i]);mesh.name=['wall-masonry','wall-coping','wall-panel-joints'][i];mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
 let disposed=false;return {root,dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}};
}
