import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const UP=new THREE.Vector3(0,1,0),EPS=1e-5;
/** Attached, render-only industrial assemblies. Never adds physics, an obstacle,
 * a gameplay affordance or a floating object outside its existing solid prism. */
export function createIndustrialDetails(scene,spec){
 const root=new THREE.Group();root.name='attached-industrial-details';const geometries=new Set(),materials=[],cache=new Map(),warnings=[];let disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;root.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();cache.clear();};
 try{
 const palette=[['pipe-enamel',0x536c68,.58,.24],['weathered-steel',0x293a3a,.64,.42],['hazard-ochre',0xb69b56,.82,0],['wet-datum',0x3d5149,.94,0]];
 for(const [name,color,roughness,metalness] of palette){const m=new THREE.MeshStandardMaterial({color,roughness,metalness});m.name=`industrial:${name}`;if(name==='hazard-ochre'||name==='weathered-steel'){m.polygonOffset=true;m.polygonOffsetFactor=-1;m.polygonOffsetUnits=-1;}materials.push(m);}
 const build=(key,fn)=>{if(cache.has(key))return cache.get(key);const buckets=palette.map(()=>[]),features=new Set();
  const put=(g,b=0)=>{buckets[b].push(g);return g;};
  const box=(x,y,z,w,h,d,b=0)=>put(new THREE.BoxGeometry(w,h,d).translate(x,y,z),b);
  const pipe=(a,b,r=.1,bucket=0)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);return put(new THREE.CylinderGeometry(r,r,delta.length(),12,1).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP,delta.clone().normalize())).translate(...start.add(end).multiplyScalar(.5).toArray()),bucket);};
  const ring=(x,y,z,r=.25,t=.04,b=2)=>put(new THREE.TorusGeometry(r,t,6,20).translate(x,y,z),b);
  fn({box,pipe,ring,features});
  const meshes=[];for(let i=0;i<buckets.length;i++)if(buckets[i].length){const g=mergeGeometries(buckets[i]);for(const part of buckets[i])part.dispose();g.computeBoundingBox();geometries.add(g);meshes.push({geometry:g,material:materials[i],name:palette[i][0]});}const result={meshes,features:[...features]};cache.set(key,result);return result;
 };
 const instantiate=(c,assembly,rotation=0,scale=null)=>{const g=new THREE.Group();g.name=`industrial-attachment:${c.id}`;g.position.set(c.x,c.y||0,c.z);g.rotation.y=(c.yaw||0)+rotation;if(scale)g.scale.set(...scale);g.userData={colliderId:c.id,collision:'inside-existing-solid-only',features:assembly.features};for(const part of assembly.meshes){const mesh=new THREE.Mesh(part.geometry,part.material);mesh.name=`attached:${part.name}`;mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);}root.add(g);return g;};
 const solid=id=>(spec.geometry||[]).find(c=>c.id===id),valid=c=>c&&c.kind!=='circle'&&[c.x,c.z,c.width,c.depth,c.height,c.y||0,c.yaw||0].every(Number.isFinite)&&c.width>=.4&&c.depth>=.4&&c.height>=.6;
 const waters=spec.sceneDressing?.water||[],waterList=Array.isArray(waters)?waters:[waters],wallIds=new Set();
 for(const water of waterList){if(!water||!Array.isArray(water.enclosedBy)){warnings.push('Industrial basin attachment omitted for malformed water entry');continue;}for(const id of water.enclosedBy){if(wallIds.has(id))continue;wallIds.add(id);const c=solid(id);if(!valid(c)||c.destructible||Math.max(c.width,c.depth)<3||c.height<1.2){warnings.push(`Industrial basin attachment omitted for invalid/unstable wall ${id}`);continue;}
  const alongX=c.width>=c.depth,length=alongX?c.width:c.depth,depth=alongX?c.depth:c.width,h=c.height,rotation=alongX?0:Math.PI/2;
  // Pick the basin-facing side in the assembly's own canonical long-X frame.
  const points=(Array.isArray(water.polygon)?water.polygon:[]).filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1])),cx=points.reduce((n,p)=>n+p[0],0)/Math.max(1,points.length),cz=points.reduce((n,p)=>n+p[1],0)/Math.max(1,points.length),yaw=(c.yaw||0)+rotation,side=Math.sign(Math.sin(yaw)*(cx-c.x)+Math.cos(yaw)*(cz-c.z))||1;
  const assembly=build(`wall:${length}:${depth}:${h}:${side}`,({box,pipe,ring,features})=>{
   const face=side*(depth/2-.012),inset=side*(depth/2-.13),run=Math.min(length*.56,7.2),pipeY=Math.min(h*.48,1.1),panelY=h*.65;
   // Tide staining is attached ABOVE the drive datum; no extra water/flood plane.
   box(0,.3,face,length-.16,.26,.012,3);features.add('tide-datum');
   pipe([-run/2,pipeY,inset],[run/2,pipeY,inset],.115,0);features.add('flanged-manifold');
   for(const x of [-run/2,-run/4,run/4,run/2]){pipe([x-.045,pipeY,side*(depth/2-.17)],[x+.045,pipeY,side*(depth/2-.17)],.162,1);box(x,pipeY-.11,side*(depth/2-.06),.09,.34,.07,1);}
   for(const x of [-length*.32,length*.32]){
    const ph=Math.min(.75,h*.3),pw=Math.min(.76,length*.12);box(x,panelY,side*(depth/2-.033),pw,ph,.05,1);box(x,panelY,side*(depth/2-.004),pw-.09,ph-.09,.006,0);
    for(const y of [panelY-ph*.27,panelY+ph*.27])box(x-pw*.37,y,side*(depth/2-.005),.065,.09,.008,2);
    box(x+pw*.22,panelY,side*(depth/2-.003),.04,ph*.32,.004,2);
   }features.add('inspection-panels');
   // Short alternating coping segments stay at/below the existing wall top.
   const patch=Math.min(1.4,length*.16);for(const x of [-length*.39,length*.39])for(let i=0;i<4;i++)box(x-patch/2+(i+.5)*patch/4,h-.003,0,patch/4-.014,.006,Math.min(depth-.04,.62),i%2?1:2);features.add('hazard-coping');
   // Subtle visible valve rim, flattened inside the existing masonry face.
   const valve=ring(0,pipeY+.31,0,Math.min(.22,h*.1),.025,2);valve.scale(1,1,.22);valve.translate(0,0,side*(depth/2-.007));
   box(0,pipeY+.31,side*(depth/2-.006),.31,.025,.006,2);box(0,pipeY+.31,side*(depth/2-.006),.025,.31,.006,2);features.add('valve-wheel');
  });instantiate(c,assembly,rotation);
 }}
 for(const landmark of spec.sceneDressing?.landmarks||[]){if(!landmark){warnings.push('Industrial pump attachment omitted for malformed landmark entry');continue;}if(landmark.assetKey!=='pump-station')continue;const c=solid(landmark.geometryId),offset=landmark.yawOffset||0;if(!valid(c)||c.width<5.2||c.depth<5.2||!Number.isFinite(offset)||Math.abs(Math.sin(offset*2))>EPS){warnings.push(`Industrial pump attachment omitted for invalid shell ${landmark.geometryId}`);continue;}
  const assembly=build('pump-service-manifold',({box,pipe,ring,features})=>{
   // The GLB lower roof tops at Y=2.81, parapet at 3.105. This service
   // manifold uses the unoccupied front-right shelf, not the raised hall.
   const y=3.23,z=-2.63;
   pipe([1.52,y,z],[3.35,y,z],.16,0);pipe([1.52,2.82,z],[1.52,y,z],.16,0);pipe([3.35,2.82,z],[3.35,y,z],.16,0);
   for(const x of [1.86,2.25,2.91]){pipe([x-.055,y,z],[x+.055,y,z],.215,1);for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])pipe([x-.065,y+Math.cos(a)*.174,z+Math.sin(a)*.174],[x+.065,y+Math.cos(a)*.174,z+Math.sin(a)*.174],.026,2);}
   // Tapered valve body, stem and true open ring/spokes make a readable
   // mechanical silhouette rather than another rectangular roof clutter box.
   pipe([2.52,y,z],[2.52,3.54,z],.105,0);pipe([2.52,3.49,z],[2.52,3.7,z],.035,1);
   const wheel=ring(0,0,0,.26,.035,2);wheel.rotateX(Math.PI/2);wheel.translate(2.52,3.72,z);
   pipe([2.27,3.72,z],[2.77,3.72,z],.022,2);pipe([2.52,3.72,z-.25],[2.52,3.72,z+.25],.022,2);
   for(const x of [1.52,3.35]){box(x,2.85,z,.5,.08,.55,1);box(x,3.02,z+.13,.07,.28,.07,1);}
   // Short flange-necked pressure chamber tied directly into the manifold.
   pipe([2.05,2.84,-1.83],[2.05,3.4,-1.83],.28,0);pipe([2.05,3.36,-1.83],[2.05,3.43,-1.83],.32,1);pipe([2.05,3.08,-1.83],[2.05,3.08,z],.09,0);
   features.add('flanged-manifold');features.add('valve-wheel');features.add('pressure-chamber');features.add('roof-mounted-inside-shell');
  });
  // Put facade rotation BELOW nonuniform collider scaling, matching the GLB.
  const group=instantiate(c,assembly,0,[c.width/8,c.height/4,c.depth/8]);if(offset){const inner=new THREE.Group();inner.rotation.y=offset;for(const child of [...group.children])inner.add(child);group.add(inner);}
 }
 const diagnostics={warnings,physicsBodiesAdded:0,drawCalls:0,triangles:0,geometries:geometries.size,materials:materials.length,attachedSolids:root.children.length};root.traverse(o=>{if(o.isMesh){diagnostics.drawCalls++;diagnostics.triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
 scene.add(root);
 return {root,diagnostics,ready:Promise.resolve({loaded:root.children.length,failed:0}),update(state={}){if(disposed)return;for(const group of root.children){const e=state.entities?.[group.userData.colliderId];group.visible=!(e?.destroyed||e?.alive===false);}},dispose};
 }catch(error){dispose();throw error;}
}
