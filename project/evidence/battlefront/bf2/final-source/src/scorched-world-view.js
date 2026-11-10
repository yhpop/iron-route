import {createCrossfireWarfieldView} from './crossfire-warfield-view.js';
import * as THREE from 'three';
import {sampleHeightfield} from './terrain-candidate/heightfield.js';
/** Opt-in, render-only soot. Solid walls are rendered by authored-scene-view.
 * No colliders, damage, false cover, loaders, timers or mutation of simulation. */
export function createScorchedWorldView(parent,spec,field,{reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false,mobile=globalThis.matchMedia?.('(pointer: coarse)')?.matches??false}={}){
 const root=new THREE.Group();root.name='scorched-world-ambience';parent.add(root);
 const warfield=spec.crossfireFront?createCrossfireWarfieldView(root,spec,field):null;
 const capacity=mobile?8:16,sources=(spec.scorchedFront?spec.sceneDressing?.scorchedSources||[]:[]).slice(0,3);
 const positions=new Float32Array(capacity*3),colors=new Float32Array(capacity*4),geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('color',new THREE.BufferAttribute(colors,4).setUsage(THREE.DynamicDrawUsage));geometry.setDrawRange(0,0);
 const data=new Uint8Array(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const u=x/31*2-1,v=y/31*2-1,r=Math.hypot(u+.1*Math.sin(v*8),v),k=(y*32+x)*4;data.set([255,255,255,Math.round(Math.max(0,1-r)**1.7*255)],k);}
 const texture=new THREE.DataTexture(data,32,32);texture.needsUpdate=true;texture.minFilter=texture.magFilter=THREE.LinearFilter;
 const material=new THREE.PointsMaterial({map:texture,size:1.9,transparent:true,depthWrite:false,vertexColors:true,opacity:.28,sizeAttenuation:true});
 const smoke=new THREE.Points(geometry,material);smoke.name='distant-cosmetic-smoke';smoke.frustumCulled=false;root.add(smoke);
 const stainPositions=[];
 if(spec.scorchedFront)for(const [x,z,r] of [[-28,23,2.2],[29,-26,2],[24,17,1.4],[-30,4,1.3],[18,23,1.2]]){
  const at=(a,scale=1)=>{const px=x+Math.cos(a)*r*scale,pz=z+Math.sin(a)*r*scale;return [px,sampleHeightfield(field,px,pz).height+.018,pz];};
  for(let i=0;i<16;i++)stainPositions.push(...[x,sampleHeightfield(field,x,z).height+.018,z],...at(i*Math.PI/8,.88+.1*Math.sin(i*2.3)),...at((i+1)*Math.PI/8,.88+.1*Math.sin((i+1)*2.3)));
 }
 const stainGeometry=new THREE.BufferGeometry();stainGeometry.setAttribute('position',new THREE.Float32BufferAttribute(stainPositions,3));stainGeometry.computeVertexNormals();
 const stainMaterial=new THREE.MeshBasicMaterial({color:0x211d19,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});
 const stains=new THREE.Mesh(stainGeometry,stainMaterial);stains.name='flush-scorch-paint';stains.userData.collision='none-ground-paint';root.add(stains);
 const pool=Array.from({length:capacity},()=>({life:0}));let cursor=0,emission=0,disposed=false,time=0,serial=0;
 const diagnostics={...(warfield?{warfield:warfield.diagnostics}:{}),physicsBodiesAdded:0,smokeProvidesCover:false,smokeCapacity:capacity,activeSmoke:0,sourceCount:sources.length,scorches:stainPositions.length/144,drawCalls:2,time:0,disposed:false};
 function update(state,events=[],dt=0){
  if(disposed||state?.phase!=='playing'||!Number.isFinite(dt)||dt<=0)return;
  const step=Math.min(.1,dt);time+=step;diagnostics.time=time;if(reducedMotion||!sources.length)return;
  for(const p of pool)p.life=Math.max(0,p.life-step);
  emission+=step;
  while(emission>=.8){emission-=.8;const source=sources[serial%sources.length],p=pool[cursor++%capacity];Object.assign(p,{x:source.x,z:source.z,y:sampleHeightfield(field,source.x,source.z).height+(source.baseHeight||0)+.3,life:4,maxLife:4,seed:serial++});}
  let count=0;for(const p of pool){if(p.life<=0)continue;const age=p.maxLife-p.life;positions.set([p.x+age*.12+Math.sin(p.seed*2.3+age)*.12,p.y+age*.48,p.z+age*.07],count*3);colors.set([.19,.175,.16,Math.min(1,age*2)*(p.life/p.maxLife)],count*4);count++;}
  geometry.setDrawRange(0,count);geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;diagnostics.activeSmoke=count;
 }
 function dispose(){if(disposed)return;disposed=true;diagnostics.disposed=true;diagnostics.activeSmoke=0;warfield?.dispose();root.removeFromParent();geometry.dispose();material.dispose();texture.dispose();stainGeometry.dispose();stainMaterial.dispose();}
 return {root,update,dispose,diagnostics};
}
