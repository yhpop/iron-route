import * as THREE from 'three';
import {createCombatFx} from './combat-fx.js';
import {createTerrainView} from './terrain-view.js';
import {createAuthoredSceneView} from './authored-scene-view.js';
// Every solid comes from the collision spec; decorative paint stays flat.
export function createCampaignView(scene,spec,fxOptions={}){
 const groundHeightAt=fxOptions.groundHeightAt||(()=>0);
 const crafted=!!spec.sceneDressing?.landmarks;
 if(crafted&&!fxOptions.artKit?.clone)throw new Error('Crafted campaign requires a loaded art kit');
 const root=new THREE.Group();root.name='campaign-world';scene.add(root);
 const materials=new Set(),geometries=new Set(),solids=new Map(),entities=new Map(),traces=new Map(),markers=new Map();
 let combatFx=null,terrain=null,authored=null,living=null,disposed=false;
 function dispose(){if(disposed)return;disposed=true;living?.dispose();combatFx?.dispose();authored?.dispose();terrain?.dispose();scene.remove(root);for(const g of geometries)g.dispose();for(const m of materials)m.dispose();solids.clear();entities.clear();traces.clear();markers.clear();}
 try {
 combatFx=createCombatFx(scene,spec,fxOptions);
 living=fxOptions.livingFactory?.(root);
 const mat=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.83,...extra});materials.add(m);return m;};
 const concrete=mat(0x707a78),breach=mat(0xbb9666),roadMat=mat(0x303d43),truckMat=mat(0x6b988b),dark=mat(0x172b32),danger=mat(0xd86e52),metal=mat(0x5a6e73),glow=mat(0xf8d391,{emissive:0xe29c39,emissiveIntensity:2});
 const mesh=(g,m,parent=root)=>{geometries.add(g);const o=new THREE.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 const box=(w,h,d,m,parent)=>mesh(new THREE.BoxGeometry(w,h,d),m,parent);
 if(crafted){authored=createAuthoredSceneView(root,spec,fxOptions.artKit);terrain=fxOptions.terrainFactory?fxOptions.terrainFactory(root):createTerrainView(root,spec,{...fxOptions.terrain,...(fxOptions.reducedMotion!==undefined?{reducedMotion:fxOptions.reducedMotion}:{})});}
 else {
 const {minX,maxX,minZ,maxZ}=spec.bounds;
 const ground=box(maxX-minX,.18,maxZ-minZ,mat(0x4e625e));ground.position.set((minX+maxX)/2,-.11,(minZ+maxZ)/2);
 const roadStrips=new Set();
 for(const route of spec.routes||[]){for(let i=1;i<route.points.length;i++){
  const a=route.points[i-1],b=route.points[i],coordinates=[route.width,a.x,a.z,b.x,b.z];
  // Only identical finite, ordered strips share this opaque visual. Preserve -0.
  if(coordinates.every(Number.isFinite)){
   const key=coordinates.map(value=>Object.is(value,-0)?'-0':value).join(',');
   if(roadStrips.has(key))continue;
   roadStrips.add(key);
  }
  const length=Math.hypot(b.x-a.x,b.z-a.z),strip=box(route.width,.025,length,roadMat);strip.position.set((a.x+b.x)/2,.002,(a.z+b.z)/2);strip.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);
 }}
 for(const surface of spec.surfaces||[]){const points=surface.polygon.map(p=>new THREE.Vector2(p.x,p.z));const faces=THREE.ShapeUtils.triangulateShape(points,[]);const positions=[];for(const face of faces)for(const i of face)positions.push(points[i].x,.043,points[i].y);const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();const paint=mesh(geometry,mat(surface.class==='rubble'?0x86755c:0x627467,{side:THREE.DoubleSide}));paint.name='surface:'+surface.id;paint.castShadow=false;}
 for(const c of spec.geometry){const o=c.kind==='circle'?mesh(new THREE.CylinderGeometry(c.radius,c.radius,c.height,20),c.destructible?breach:concrete):box(c.width,c.height,c.depth,c.destructible?breach:concrete);o.position.set(c.x,(c.y||0)+c.height/2,c.z);o.rotation.y=c.yaw||0;o.name='solid:'+c.id;solids.set(c.id,o);
  if(c.destructible){const mark=box(Math.min(c.width||c.radius,1.6),.13,.03,danger,o);mark.position.set(0,.1,(c.depth||c.radius*2)/2+.02);mark.rotation.z=.65;}
 }
 }
 for(const zone of spec.zones||[]){const pts=[];for(let i=0;i<zone.polygon.length;i++){const a=zone.polygon[i],b=zone.polygon[(i+1)%zone.polygon.length],n=fxOptions.groundHeightAt?Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.5)):1;for(let j=0;j<n;j++){const x=a.x+(b.x-a.x)*j/n,z=a.z+(b.z-a.z)*j/n;pts.push(new THREE.Vector3(x,groundHeightAt(x,z)+.05,z));}}if(pts.length)pts.push(pts[0].clone());const g=new THREE.BufferGeometry().setFromPoints(pts);geometries.add(g);const m=new THREE.LineBasicMaterial({color:0x84cfb5});materials.add(m);const line=new THREE.Line(g,m);if(fxOptions.groundHeightAt)line.name='zone-boundary:'+zone.id;root.add(line);}
 if(!crafted)for(const e of spec.entities||[]){const group=new THREE.Group();group.name='entity:'+e.id;group.position.set(e.pose.x,e.pose.y||0,e.pose.z);group.rotation.y=e.pose.yaw||0;root.add(group);entities.set(e.id,group);
  if(e.kind==='truck'){box(1.8,1.3,2.6,truckMat,group).position.set(0,1.5,.5);box(1.75,1.1,1.0,metal,group).position.set(0,1.3,-1.25);box(1.25,.33,.04,dark,group).position.set(0,1.4,-1.57);for(const x of [-.8,.8])for(const z of [-.9,.9]){const tire=mesh(new THREE.CylinderGeometry(.35,.35,.23,12),dark,group);tire.rotation.z=Math.PI/2;tire.position.set(x,.38,z);}for(const x of [-.58,.58])box(.18,.12,.05,glow,group).position.set(x,.77,-1.58);
  }else{mesh(new THREE.CylinderGeometry(.72,.8,.9,12),metal,group).position.y=.45;const head=new THREE.Group();head.name='turret-head:'+e.id;group.add(head);head.position.y=1.18;box(1.1,.6,1.1,danger,head);box(.19,.19,.6,dark,head).position.set(0,.12,-.5);box(.05,.72,.05,dark,head).position.set(.4,.66,.35);if(e.shieldArc){const shield=box(1.2,1.4,.2,metal,group);shield.name='shield:'+e.id;shield.position.set(0,.9,-.5);}const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);geometries.add(geometry);const m=new THREE.LineDashedMaterial({color:0xe9b552,dashSize:.3,gapSize:.5,transparent:true,opacity:.55,depthWrite:false});materials.add(m);const line=new THREE.Line(geometry,m);line.name='enemy-charge-warning:'+e.id;line.visible=false;root.add(line);traces.set(e.id,line);}
 }
 function update(state,events=[],dt=0){
  if(disposed)return;authored?.update(state,events,dt);terrain?.update(dt);living?.update(state,events,dt);
  for(const o of markers.values())o.visible=false;
  for(const target of getActiveTargets(state,spec)){let o=markers.get(target.id);if(!o){o=mesh(new THREE.RingGeometry(1.25,1.39,40),mat(0xe9c46a,{emissive:0xb99939,emissiveIntensity:.7,side:THREE.DoubleSide}));o.name='objective-marker:'+target.id;o.rotation.x=-Math.PI/2;o.castShadow=false;markers.set(target.id,o);}o.visible=true;o.position.set(target.x,.08,target.z);if(fxOptions.groundHeightAt){const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)a.setZ(i,groundHeightAt(target.x+a.getX(i),target.z-a.getY(i)));a.needsUpdate=true;o.geometry.computeBoundingSphere();}}

  for(const [id,o]of solids){const s=state.entities?.[id];o.visible=!(s?.destroyed||s?.alive===false);}
  for(const [id,o]of entities){const e=state.entities?.[id];if(!e)continue;o.position.set(e.pose.x,e.pose.y||0,e.pose.z);o.rotation.y=e.pose.yaw||0;const dead=e.alive===false;o.visible=!dead;const head=o.getObjectByName('turret-head:'+id);if(head)head.rotation.y=(e.aimYaw??e.pose.yaw??0)-(e.pose.yaw||0);const line=traces.get(id);if(line){line.visible=!!e.telegraphTarget&&!dead&&(e.charge||0)>0;if(line.visible){const a=line.geometry.attributes.position;a.setXYZ(0,e.pose.x,(e.pose.y||0)+1.3,e.pose.z);a.setXYZ(1,e.telegraphTarget.x,e.telegraphTarget.y??.8,e.telegraphTarget.z);a.needsUpdate=true;line.geometry.computeBoundingSphere();line.computeLineDistances();line.material.opacity=.25+.45*e.charge;}}}
  combatFx.update(state,events,dt);
 }
 const ready=Promise.all([terrain?.ready,authored?.ready,living?.ready]).then(results=>{const total=results.reduce((sum,r)=>({loaded:sum.loaded+(r?.loaded||0),failed:sum.failed+(r?.failed||0)}),{loaded:0,failed:0});if(total.failed)throw new Error(`Campaign environment loading failed (${total.failed} resources)`);return total;});
 return {update,ready,diagnostics:{living:living?.diagnostics,terrain:terrain?.diagnostics,art:fxOptions.artKit?.diagnostics,details:authored?.diagnostics.details},dispose};
 }catch(error){dispose();throw error;}
}

export function getActiveTargets(state,spec){if(spec.convoyChoice&&!state.selectedConvoyChoiceId&&state.objectiveStates?.[spec.convoyChoice.requiresObjectiveId]?.status==='complete'){return spec.convoyChoice.options.flatMap(option=>{const zone=spec.zones.find(z=>z.id===option.zoneId);return zone?.polygon.length?[{id:zone.id,x:zone.polygon.reduce((n,p)=>n+p.x,0)/zone.polygon.length,z:zone.polygon.reduce((n,p)=>n+p.z,0)/zone.polygon.length,type:'route-choice'}]:[];});}const found=new Map();for(const goal of spec.objectives||[]){if(state.objectiveStates?.[goal.id]?.status!=='active')continue;for(const id of goal.targetIds||[]){const e=state.entities?.[id];if(e?.alive&&!e.arrived)found.set(id,{id,x:e.pose.x,z:e.pose.z,type:goal.type});}if(goal.zoneId&&!goal.targetIds?.length){const z=spec.zones.find(z=>z.id===goal.zoneId);if(z?.polygon.length)found.set(z.id,{id:z.id,x:z.polygon.reduce((n,p)=>n+p.x,0)/z.polygon.length,z:z.polygon.reduce((n,p)=>n+p.z,0)/z.polygon.length,type:goal.type});}}return [...found.values()];}
