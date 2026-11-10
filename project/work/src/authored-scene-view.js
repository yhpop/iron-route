import {createPz3TeamMark} from './team-roof-mark.js';
import {applyBattlefrontBuildingFinish} from './battlefront-building-finish.js';
import {applyWarVehicleFinish} from './war-vehicle-finish.js';
import {createCrossfireEffects} from './crossfire-effects.js';
import {updateInterceptorRunningGear,updateInterceptorWreck} from './interceptor-art.js';
import {createCrushableView} from './crushable-prop-view.js';
import * as THREE from 'three';
import {createIndustrialDetails} from './industrial-details.js';
import {createWallView} from './architectural-wall.js';
import {SENTRY_RIG,sentryMuzzleTransform} from './sentry-rig.js';
/** Authored art is an adapter, never a source of collision or simulation state. */
export function createAuthoredSceneView(scene,spec,artKit){
 if(!artKit?.clone)throw new Error('Crafted campaign requires a loaded art kit');
 const root=new THREE.Group();root.name='authored-scene-art';const solids=new Map(),entities=new Map(),rigs=new Map(),walls=[],traces=new Map(),owned=[],finishes=[],buildingFinishes=[];let disposed=false,details=null,crossfire=null;const crushViews=new Map(),teamMarks=new Map();
 const landmarks=new Map((spec.sceneDressing?.landmarks||[]).map(l=>[l.geometryId,l]));
 for(const id of landmarks.keys())if(!spec.geometry.some(c=>c.id===id))throw new Error(`Art landmark references absent collider: ${id}`);
 try{
  for(const c of spec.geometry){const landmark=landmarks.get(c.id);let object;
   if(c.crush){const view=createCrushableView(c);walls.push(view);crushViews.set(c.id,view);object=view.root;}
   else if(landmark){if(c.kind==='circle'||c.width<5.2||c.depth<5.2)throw new Error(`Building ${c.id} has a narrow/non-box collider; do not stretch building art`);object=new THREE.Group();object.name=`solid:${c.id}`;object.position.set(c.x,c.y||0,c.z);object.rotation.y=c.yaw||0;object.scale.set(c.width/8,c.height/4,c.depth/8);const model=artKit.clone(landmark.assetKey);const offset=landmark.yawOffset||0;if(Math.abs(Math.sin(offset*2))>1e-7)throw new Error(`Building ${c.id} yawOffset must be a quarter turn to preserve its collider footprint`);model.rotation.y=offset;object.add(model);}
   else {if(c.kind==='circle')throw new Error(`Crafted circular solid has no authored art: ${c.id}`);const wall=createWallView(c,{appearance:spec.crossfireFront?'crossfire':'default'});walls.push(wall);object=wall.root;}
   root.add(object);solids.set(c.id,object);if(spec.battlefrontDepot&&c.id==='south-depot'&&landmark?.assetKey==='warehouse-sawtooth')buildingFinishes.push(applyBattlefrontBuildingFinish(object,{id:c.id}));
  }
  // Distant district context is explicitly outside the physics bounds. A low
  // retaining edge makes the real movement limit legible, not a floating map.
  const b=spec.bounds,cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2,context=new THREE.Group();context.name='outside-industrial-context';root.add(context);
  for(const [i,x,z,yaw]of [[0,b.minX-13,cz-18,Math.PI/2],[1,b.minX-16,cz+19,Math.PI/2],[2,b.maxX+15,cz-16,-Math.PI/2],[3,b.maxX+13,cz+21,-Math.PI/2],[4,cx-18,b.minZ-15,Math.PI],[5,cx+17,b.minZ-14,Math.PI]]){const o=artKit.clone(i%3===0?'warehouse-sawtooth':i%3===1?'pump-station':'service-workshop');o.position.set(x,0,z);o.rotation.y=yaw;o.scale.set(1.5,1.05,1.6);o.userData.collision='none-outside-bounds';context.add(o);if(spec.battlefrontDepot&&(i===0||i===3))buildingFinishes.push(applyBattlefrontBuildingFinish(o,{id:`context-warehouse-${i}`}));}
  for(const c of [{id:'edge-west',x:b.minX-.6,z:cz,width:.6,depth:b.maxZ-b.minZ+1.8,height:.8},{id:'edge-east',x:b.maxX+.6,z:cz,width:.6,depth:b.maxZ-b.minZ+1.8,height:.8},{id:'edge-north',x:cx,z:b.minZ-.6,width:b.maxX-b.minX+1.8,depth:.6,height:.8},{id:'edge-south',x:cx,z:b.maxZ+.6,width:b.maxX-b.minX+1.8,depth:.6,height:.8}]){const wall=createWallView(c,{appearance:spec.crossfireFront?'crossfire':'default'});walls.push(wall);wall.root.userData.collision='none-outside-bounds';context.add(wall.root);}
  for(const source of spec.entities||[]){const object=new THREE.Group();object.name=`entity:${source.id}`;object.position.set(source.pose.x,source.pose.y||0,source.pose.z);object.rotation.y=source.pose.yaw||0;root.add(object);entities.set(source.id,object);
   const asset=artKit.clone(source.vehicle==='pz3'?'pz3':source.kind==='truck'?'cargo-truck':'sentry-turret');object.add(asset);if(spec.crossfireFront&&(source.team==='allied'||source.team==='hostile')){const copies=new Map(),tint=new THREE.Color(source.team==='allied'?0x718d9b:0x9e7662);asset.traverse(o=>{if(!o.isMesh)return;const paint=m=>{if(!copies.has(m)){const copy=m.clone();if(copy.color)copy.color.lerp(tint,.48);copies.set(m,copy);owned.push(copy);}return copies.get(m);};o.material=Array.isArray(o.material)?o.material.map(paint):paint(o.material);});}if(spec.crossfireFront)finishes.push(applyWarVehicleFinish(asset,{team:source.team}));const teamMark=createPz3TeamMark(asset,spec,source);if(teamMark)teamMarks.set(source.id,teamMark);if(source.vehicle==='pz3')asset.traverse(o=>{if(o.isInstancedMesh)owned.push(o);});
   if(source.kind==='truck'){rigs.set(source.id,{kind:'truck',wheels:['WheelLFront','WheelLRear','WheelRFront','WheelRRear'].map(name=>asset.getObjectByName(name)),previous:{...source.pose},travel:0});}
   else{const rig={kind:'sentry',asset,vehicle:source.vehicle,yaw:asset.getObjectByName('TurretYaw'),pitch:asset.getObjectByName('GunPitch'),recoil:asset.getObjectByName('Recoil'),muzzle:asset.getObjectByName('Muzzle'),kick:0};if(asset.getObjectByName('Shield'))asset.getObjectByName('Shield').visible=!!source.shieldArc;rigs.set(source.id,rig);
    const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),m=new THREE.LineDashedMaterial({color:spec.crossfireFront&&source.team&&source.team===spec.combatRelations?.playerTeam?0x789eae:0xe9b552,dashSize:.3,gapSize:.5,transparent:true,opacity:.55,depthWrite:false});owned.push(g,m);const line=new THREE.Line(g,m);line.name=`enemy-charge-warning:${source.id}`;line.visible=false;if(spec.crossfireFront)line.renderOrder=10;root.add(line);traces.set(source.id,line);
   }
  }
 details=createIndustrialDetails(root,spec);if(spec.crossfireFront)crossfire=createCrossfireEffects(root,spec);
 }catch(error){for(const mark of teamMarks.values())mark.dispose();crossfire?.dispose();details?.dispose();for(const finish of buildingFinishes)finish.dispose();for(const finish of finishes)finish.dispose();for(const wall of walls)wall.dispose();for(const resource of owned)resource.dispose();throw error;}
 scene.add(root);const seen=new Set();
 function update(state,events=[],dt=0){if(disposed)return;for(const mark of teamMarks.values())mark.update(state);crossfire?.update(state,events,dt);details?.update(state);const fired=new Set();for(const event of events)if(event.type==='shot'&&event.id!==undefined&&!seen.has(event.id)){seen.add(event.id);fired.add(event.entityId);}while(seen.size>256)seen.delete(seen.values().next().value);
  for(const [id,object]of solids){const e=state.entities?.[id];if(crushViews.has(id)){crushViews.get(id).update(e,dt);continue;}object.visible=!(e?.destroyed||e?.alive===false);}
  for(const [id,object]of entities){const e=state.entities?.[id];if(!e)continue;object.position.set(e.pose.x,e.pose.y||0,e.pose.z);object.rotation.y=e.pose.yaw||0;object.visible=e.alive!==false||e.vehicle==='pz3';const rig=rigs.get(id);if(rig.vehicle==='pz3')updateInterceptorWreck(rig.asset,e,owned);
   if(rig.kind==='truck'){const dx=e.pose.x-rig.previous.x,dz=e.pose.z-rig.previous.z;rig.travel+=-Math.sin(e.pose.yaw||0)*dx-Math.cos(e.pose.yaw||0)*dz;for(const wheel of rig.wheels)wheel.rotation.x=-rig.travel/.36;rig.previous={...e.pose};}
   else{if(rig.vehicle==='pz3')updateInterceptorRunningGear(rig.asset,e);rig.yaw.rotation.y=(e.aimYaw??e.pose.yaw??0)-(e.pose.yaw||0);rig.pitch.rotation.x=e.aimElevation||0;rig.kick=fired.has(id)?SENTRY_RIG.maxRecoil:Math.max(0,rig.kick-Math.max(0,dt)*.32);rig.recoil.position.z=rig.kick;
    const line=traces.get(id);line.visible=object.visible&&!!e.telegraphTarget&&(e.charge||0)>0;if(line.visible){const p=sentryMuzzleTransform(e,rig.kick).position,a=line.geometry.attributes.position;a.setXYZ(0,p.x,p.y,p.z);a.setXYZ(1,e.telegraphTarget.x,e.telegraphTarget.y??.8,e.telegraphTarget.z);a.needsUpdate=true;line.geometry.computeBoundingSphere();line.computeLineDistances();line.material.opacity=.25+.45*e.charge;}
   }
  }
 }
 return {root,solids,entities,update,ready:details.ready,diagnostics:{details:details.diagnostics,...(spec.battlefrontDepot?{buildingFinishes:buildingFinishes.map(f=>f.diagnostics)}:{}),...(spec.crossfireFront?{vehicleFinishes:finishes.map(f=>f.diagnostics)}:{}),...(crossfire?{crossfire:crossfire.diagnostics}:{})},dispose(){if(disposed)return;disposed=true;for(const mark of teamMarks.values())mark.dispose();teamMarks.clear();crossfire?.dispose();details?.dispose();for(const finish of buildingFinishes)finish.dispose();for(const finish of finishes)finish.dispose();root.removeFromParent();for(const wall of walls)wall.dispose();for(const resource of owned)resource.dispose();solids.clear();entities.clear();rigs.clear();seen.clear();}};
}
