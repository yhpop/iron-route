import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {sampleHeightfield} from './terrain-candidate/heightfield.js';
/** Original procedural battle wear. Render-only: no terrain displacement, holes in
 * solid cover, collision, timers or simulation writes. Four static draw buckets.
 * Ground pieces are contained in ONE authoritative terrain triangle, including
 * their interiors. Exterior broken frames are wholly outside playable bounds. */
export function createCrossfireWarfieldView(parent,spec,field){
 const root=new THREE.Group();root.name='crossfire-warfield';parent.add(root);
 const diagnostics={enabled:spec.crossfireFront===true,drawBuckets:0,triangles:0,physicsBodiesAdded:0,walkableMaxThickness:.018,wallFaces:[],disposed:false};
 const owned=[];let seed=905071;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 function batch(name,positions,colors,{opacity=1,colorSize=3}={}){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,colorSize));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide,transparent:opacity<1,opacity,depthWrite:opacity===1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});const mesh=new THREE.Mesh(g,m);mesh.name=name;mesh.receiveShadow=true;mesh.userData.collision='none-render-only';root.add(mesh);owned.push(g,m);diagnostics.drawBuckets++;diagnostics.triangles+=positions.length/9;return mesh;}
 if(diagnostics.enabled){
 const b=field.bounds,soot=[],sootColors=[],fragments=[],fragmentColors=[],patches=[];
 // Unequal clustered blast stains, not regularly spaced craters or new cover.
 for(let i=0;i<28;i++)patches.push({x:b.minX+5+random()*(b.maxX-b.minX-10),z:b.minZ+5+random()*(b.maxZ-b.minZ-10),r:1.5+random()*3});
 const put=(out,col,points,color)=>{out.push(...points.flat());for(let k=0;k<3;k++)col.push(...color);};
 const triangle=(i,j,flip)=>{const x=b.minX+i*field.dx,z=b.minZ+j*field.dz;return (flip?[[x+field.dx,z+field.dz],[x,z+field.dz],[x+field.dx,z]]:[[x,z],[x+field.dx,z],[x,z+field.dz]]).map(([xx,zz])=>[xx,sampleHeightfield(field,xx,zz).height,zz]);};
 // One continuous opacity field is evaluated once per authoritative grid vertex.
 // Shared edges get identical RGBA; do not threshold/shade whole triangles.
 // This removes the diagnosed flat triangle-tile pattern without new textures.
 const sootOpacity=new Float32Array((field.columns+1)*(field.rows+1));
 for(let j=0;j<=field.rows;j++)for(let i=0;i<=field.columns;i++){
  const x=b.minX+i*field.dx,z=b.minZ+j*field.dz;let strength=0;
  for(const q of patches){const dx=x-q.x,dz=(z-q.z)*1.25,angle=Math.atan2(dz,dx),edge=1+.12*Math.sin(angle*3+q.x*.37)+.07*Math.sin(angle*5+q.z*.21),d=Math.hypot(dx,dz)/(q.r*edge),v=Math.max(0,Math.min(1,1-d));strength=Math.max(strength,v*v*(3-2*v));}
  sootOpacity[j*(field.columns+1)+i]=strength;
 }
 for(let j=0;j<field.rows;j++)for(let i=0;i<field.columns;i++)for(let t=0;t<2;t++){
  const p=triangle(i,j,t),idx=t?[[i+1,j+1],[i,j+1],[i+1,j]]:[[i,j],[i+1,j],[i,j+1]],alpha=idx.map(([x,z])=>sootOpacity[z*(field.columns+1)+x]);
  if(alpha.every(a=>a===0))continue;
  soot.push(...p.flatMap(a=>[a[0],a[1]+.008,a[2]]));for(const a of alpha)sootColors.push(.061,.052,.044,a);
 }
 batch('warfield-soot',soot,sootColors,{opacity:.58,colorSize:4});
 for(let n=0;n<460;n++){const i=1+Math.floor(random()*(field.columns-2)),j=1+Math.floor(random()*(field.rows-2)),p=triangle(i,j,random()<.5),size=.16+random()*.48,center=[0,1,2].map(k=>p.reduce((s,a)=>s+a[k],0)/3),verts=p.map(a=>a.map((v,k)=>center[k]+(v-center[k])*size+(k===1?.018:0))),shade=.09+random()*.2;put(fragments,fragmentColors,verts,n%4===0?[shade*1.2,shade*.74,shade*.53]:[shade,shade*.94,shade*.86]);}
 batch('warfield-fragments',fragments,fragmentColors);
 const scars=[],scarColors=[],landmarks=new Set((spec.sceneDressing?.landmarks||[]).map(l=>l.geometryId));
 for(const c of (spec.geometry||[]).filter(c=>c.kind==='box'&&!c.crush&&!c.destructible&&!landmarks.has(c.id)).slice(0,32)){
  const local=[],co=Math.cos(c.yaw||0),si=Math.sin(c.yaw||0);
  // Match createWallView's visible masonry, NOT the collision prism or a
  // landmark bounding box. Scars are 2mm above the inset central wall faces.
  const inset=Math.min(.07,Math.min(c.width,c.depth)*.06),base=Math.min(.25,c.height*.2),cap=Math.min(.18,c.height*.12),core=c.height-base-cap;
  if(core<=.02)continue;
  const add=(p,color)=>{local.push(...p);put(scars,scarColors,p.map(([x,y,z])=>[c.x+co*x+si*z,(c.y||0)+y,c.z-si*x+co*z]),color);};
  for(let side=0;side<4;side++){const span=(side<2?c.width:c.depth)-2*inset;const map=(u,v)=>{u=Math.max(-span/2+.003,Math.min(span/2-.003,u));v=Math.max(base+.003,Math.min(c.height-cap-.003,v));return side<2?[u,v,(side===0?1:-1)*(c.depth/2-inset+.002)]:[(side===2?1:-1)*(c.width/2-inset+.002),v,u];};
   for(let k=0;k<8;k++){const u=(random()-.5)*span*.86,v=base+core*(.12+random()*.7),w=Math.min(span*.18,.12+random()*.55),h=Math.min(core*.23,.15+random()*.5);const pts=[[u-w/2,v-h/2],[u+w/2,v-h*.3],[u+w*.25,v+h/2],[u-w*.4,v+h*.2]].map(([x,y])=>map(Math.max(-span/2,Math.min(span/2,x)),Math.max(0,Math.min(c.height,y))));const shade=.045+random()*.045;add([pts[0],pts[1],pts[2]],[shade,shade*.9,shade*.8]);add([pts[0],pts[2],pts[3]],[shade,shade*.9,shade*.8]);
   }
   // Narrow branching surface cracks; original full-height solid stays intact.
   let u=(random()-.5)*span*.6;for(let k=0;k<5;k++){const v=base+core*(.1+k*.15),next=Math.max(-span*.45,Math.min(span*.45,u+(random()-.5)*.3));add([map(u,v),map(u+.018,v),map(next,base+core*(.25+k*.15))],[.025,.023,.021]);u=next;}
  }diagnostics.wallFaces.push({id:c.id,localVertices:local});
 }
 batch('warfield-wall-scars',scars,scarColors,{opacity:.54});
 const parts=[];const box=(x,y,z,w,h,d,angle=0)=>{const g=new THREE.BoxGeometry(w,h,d).toNonIndexed();g.rotateZ(angle);g.translate(x,y+h/2,z);const color=new THREE.Color().setRGB(.10+random()*.06,.085+random()*.04,.065+random()*.035),a=[];for(let k=0;k<g.attributes.position.count;k++)a.push(color.r,color.g,color.b);g.setAttribute('color',new THREE.Float32BufferAttribute(a,3));g.deleteAttribute('uv');parts.push(g);};
 // No intact pale cuboids: isolated jagged uprights, snapped roof beams and
 // low uneven masonry make asymmetrical open industrial silhouettes.
 for(const [x,z] of [[b.minX-8,20],[b.minX-9,-22],[b.maxX+8,5],[b.maxX+10,-28],[-15,b.minZ-9],[22,b.minZ-10]]){
  for(let i=0;i<5;i++){const xx=x+(i-2)*1.5,h=2+random()*5;box(xx,-.7,z,.32,h,.55);box(xx,h-.8,z,.6,.5,.6,(random()-.5)*.65);if(i<4&&i!==2)box(xx+.7,2.4+random()*1.8,z,1.7,.23,.35,(random()-.5)*.5);box(xx,-.7,z+.8,1.3,.5+random(),.8);}
  box(x-2,2,z-.5,.22,3,.3,.8);box(x+2,1,z+.3,.24,2.8,.32,-.55);
 }
 const merged=mergeGeometries(parts);for(const g of parts)g.dispose();batch('warfield-ruins',Array.from(merged.attributes.position.array),Array.from(merged.attributes.color.array));merged.dispose();
 }
 return {root,diagnostics,update(){/* Static by design: phase/status independent, zero frame allocation. */},dispose(){if(diagnostics.disposed)return;diagnostics.disposed=true;root.removeFromParent();for(const resource of owned)resource.dispose();}};
}
