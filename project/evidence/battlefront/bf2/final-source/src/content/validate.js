import {ENVELOPE,inside,pathBlocker,poseBlocker,lineBlocker,trace,wrap,yawTo} from './geometry.js';
const finite=(n)=>Number.isFinite(n);
const position=(p)=>p&&finite(p.x)&&finite(p.z);
const warning='Automated planar witnesses establish clearance, target access and dependency order only. Combat survivability, route-choice quality, pacing, camera readability and human playthrough remain unverified.';
export function validateMission(spec){
 const errors=[],warnings=[warning],audit={phaseWitnesses:0,firingPoses:0,convoyRoutes:0,topology:null,combatSurvivability:'unverified',humanPlaythrough:'unverified'};
 const fail=m=>errors.push(m);
 if(!spec||typeof spec!=='object')return {valid:false,errors:['Mission must be an object'],warnings,audit};
 if(spec.schema!==1)fail('schema must be 1');
 if(!/^mission-\d{3,}$/.test(spec.id||''))fail('invalid stable mission ID');
 for(const key of ['geometry','surfaces','zones','entities','routes','objectives'])if(!Array.isArray(spec[key]))fail(`${key} must be an array`);
 if(errors.length)return {valid:false,errors,warnings,audit};
 for(const key of ['geometry','surfaces','zones','entities','routes','objectives'])if(spec[key].some(item=>!item||typeof item!=='object'||Array.isArray(item)))fail(`${key} contains an invalid record`);
 if(errors.length)return {valid:false,errors,warnings,audit};
 const bounds=spec.bounds;
 if(!bounds||!['minX','maxX','minZ','maxZ'].every(k=>finite(bounds[k]))||bounds.minX>=bounds.maxX||bounds.minZ>=bounds.maxZ)fail('invalid bounds');
 if(!position(spec.spawn)||!finite(spec.spawn.yaw))fail('invalid spawn');
 const ids=new Set();
 for(const key of ['geometry','surfaces','zones','entities','routes','objectives'])for(const item of spec[key]){
  if(!item.id||ids.has(item.id))fail(`duplicate or missing ID ${item.id}`);ids.add(item.id);
 }
 const geometry=new Map(spec.geometry.map(c=>[c.id,c])),entities=new Map(spec.entities.map(e=>[e.id,e])),routes=new Map(spec.routes.map(r=>[r.id,r])),zones=new Map(spec.zones.map(z=>[z.id,z])),objectives=new Map(spec.objectives.map(o=>[o.id,o]));
 for(const c of spec.geometry){if(!position(c)||!finite(c.height)||c.height<=0||!finite(c.yaw)||!['box','circle'].includes(c.kind)||(c.kind==='box'&&(!finite(c.width)||!finite(c.depth)||c.width<=0||c.depth<=0))||(c.kind==='circle'&&(!finite(c.radius)||c.radius<=0)))fail(`invalid collider ${c.id}`);if(c.destructible&&!(c.hp>0))fail(`destructible ${c.id} lacks hp`);}
 for(const z of [...spec.zones,...spec.surfaces])if(!Array.isArray(z.polygon)||z.polygon.length<3||!z.polygon.every(position))fail(`invalid polygon ${z.id}`);
 for(const r of spec.routes)if(!Array.isArray(r.points)||r.points.length<2||!r.points.every(position)||!(r.width>0))fail(`invalid route ${r.id}`);
 for(const e of spec.entities){if(!position(e.pose)||!finite(e.pose.yaw)||!(e.hp>0)||!['truck','turret','drone'].includes(e.kind))fail(`invalid entity ${e.id}`);if(e.routeId&&!routes.has(e.routeId))fail(`unknown route ${e.routeId}`);if(e.kind==='truck'&&!e.routeId)fail(`truck ${e.id} lacks route`);if(e.activationObjectiveId&&!objectives.has(e.activationObjectiveId))fail(`unknown activation ${e.activationObjectiveId}`);}
 for(const o of spec.objectives){
  if(!['breach','disable','reach','escort','defend'].includes(o.type)||!Array.isArray(o.targetIds)||!Array.isArray(o.requires)||!Array.isArray(o.nextIds)){fail(`invalid objective ${o.id}`);continue;}
  for(const id of o.targetIds){const target=geometry.get(id)||entities.get(id);if(!target)fail(`unknown objective target ${id}`);if(o.type==='breach'&&!geometry.get(id)?.destructible)fail(`breach target ${id} not destructible`);if(o.type==='disable'&&!['turret','drone'].includes(entities.get(id)?.kind))fail(`disable target ${id} not hostile`);if(o.type==='escort'&&entities.get(id)?.kind!=='truck')fail(`escort target ${id} not truck`);}
  for(const id of [...o.requires,...o.nextIds])if(!objectives.has(id)||id===o.id)fail(`invalid objective dependency ${o.id} -> ${id}`);
  if(o.zoneId&&!zones.has(o.zoneId))fail(`unknown zone ${o.zoneId}`);
  if(['reach','defend'].includes(o.type)&&!o.zoneId)fail(`${o.type} ${o.id} requires zone`);
  if(o.type==='defend'&&!(o.duration>0))fail(`defend ${o.id} needs duration`);
  for(const id of o.requires)if(!objectives.get(id)?.nextIds.includes(o.id))fail(`nonreciprocal objective edge ${id} -> ${o.id}`);
  for(const id of o.nextIds)if(!objectives.get(id)?.requires.includes(o.id))fail(`nonreciprocal objective edge ${o.id} -> ${id}`);
 }
 if(errors.length)return {valid:false,errors,warnings,audit};
 const visit=(id,stack=new Set(),done=new Set())=>{if(stack.has(id)){fail(`objective cycle at ${id}`);return;}if(done.has(id))return;stack.add(id);for(const next of objectives.get(id)?.requires||[])if(objectives.has(next))visit(next,stack,done);stack.delete(id);done.add(id);};
 for(const o of spec.objectives)visit(o.id);
 if(errors.length)return {valid:false,errors,warnings,audit};
 const phases=spec.witness?.phases;
 if(!Array.isArray(phases)){fail('missing phase witnesses');return {valid:false,errors,warnings,audit};}
 const completed=new Set(),destroyed=new Set();let last={...spec.spawn};
 const liveColliders=()=>[...spec.geometry.filter(c=>!destroyed.has(c.id)),...spec.entities.filter(e=>e.kind==='turret'&&!destroyed.has(e.id)).map(e=>({id:e.id,kind:'circle',x:e.pose.x,z:e.pose.z,radius:1.1,height:2.1}))];
 const spawnHit=poseBlocker(spec.spawn,liveColliders(),bounds);if(spawnHit)fail(`spawn blocked by ${spawnHit}`);
 for(const phase of phases){
  const o=objectives.get(phase.objectiveId);
  if(!o||completed.has(phase.objectiveId)){fail(`duplicate/unknown witness objective ${phase.objectiveId}`);continue;}
  if(o.requires.some(id=>!completed.has(id)))fail(`witness phase ${o.id} precedes prerequisite`);
  const poses=phase.tankWaypoints;
  if(!Array.isArray(poses)||!poses.length||!poses.every(p=>position(p)&&finite(p.yaw))){fail(`invalid witness poses ${o.id}`);continue;}
  if(Math.hypot(poses[0].x-last.x,poses[0].z-last.z)>0.1)fail(`disconnected witness phase ${o.id}`);
  const joined=[{...last},...poses],live=liveColliders();
  const hit=pathBlocker(joined,live,bounds);if(hit)fail(`witness ${o.id} intersects ${hit.id} at ${hit.x.toFixed(2)},${hit.z.toFixed(2)}`);
  for(let i=1;i<poses.length;i++)if(Math.hypot(poses[i].x-poses[i-1].x,poses[i].z-poses[i-1].z)>0.1){const dir=yawTo(poses[i-1],poses[i]);if(Math.abs(Math.sin(dir-poses[i-1].yaw))>0.04||Math.abs(wrap(poses[i].yaw-poses[i-1].yaw))>0.04)fail(`witness ${o.id} strafes or uses unchecked curved movement`);}
  last=poses.at(-1);
  const fires=phase.firingPoses||[];
  for(const targetId of o.type==='breach'||o.type==='disable'?o.targetIds:[])if(!fires.some(f=>f.targetId===targetId))fail(`witness ${o.id} lacks firing pose for ${targetId}`);
  for(const f of fires){
   const entity=entities.get(f.targetId),target=geometry.get(f.targetId)||entity?.pose;
   if(!target||!position(f)||!finite(f.turretYaw)){fail(`invalid firing witness ${o.id}`);continue;}
   if(Math.hypot(f.x-last.x,f.z-last.z)>0.1)fail(`firing witness ${o.id} not at reachable phase endpoint`);
   const aim=yawTo(f,target);if(Math.abs(wrap(aim-f.turretYaw))>0.05)fail(`firing witness ${o.id} does not aim at target`);
   const range=Math.hypot(target.x-f.x,target.z-f.z);if(range<ENVELOPE.gunReach+0.5||range>38)fail(`firing witness ${o.id} invalid range ${range}`);
   const blocked=poseBlocker({...f,yaw:last.yaw},live,bounds,{turretYaw:f.turretYaw});if(blocked)fail(`firing witness ${o.id} barrel/hull hits ${blocked}`);
   const muzzle={x:f.x-Math.sin(f.turretYaw)*ENVELOPE.gunReach,z:f.z-Math.cos(f.turretYaw)*ENVELOPE.gunReach};
   const los=lineBlocker(muzzle,target,live,[f.targetId]);if(los)fail(`firing witness ${o.id} LOS blocked by ${los}`);
   if(entity?.shieldArc>0){const angle=yawTo(entity.pose,f);if(Math.abs(wrap(angle-entity.pose.yaw))<=entity.shieldArc/2+0.05)fail(`firing witness ${o.id} inside target shield`);}
   audit.firingPoses++;
  }
  if(['reach','defend'].includes(o.type)&&!inside(last,zones.get(o.zoneId).polygon))fail(`witness ${o.id} does not enter zone`);
  for(const routeId of phase.convoyRouteIds||[]){
   const r=routes.get(routeId);if(!r){fail(`unknown witness convoy route ${routeId}`);continue;}
   if(r.width<ENVELOPE.truckWidth+0.5)fail(`convoy route ${routeId} insufficient width`);
   const truck=spec.entities.find(e=>e.kind==='truck'&&e.routeId===routeId);
   if(!truck)fail(`witness convoy route ${routeId} has no truck`);
   const routeHit=pathBlocker(trace(r.points,truck?.pose.yaw||0),live,bounds,{truck:true});if(routeHit)fail(`convoy witness ${routeId} intersects ${routeHit.id}`);
   if(o.zoneId&&!inside(r.points.at(-1),zones.get(o.zoneId).polygon))fail(`convoy witness ${routeId} misses depot`);
   audit.convoyRoutes++;
  }
  if(o.type==='escort')for(const id of o.targetIds){const routeId=entities.get(id)?.routeId;if(!(phase.convoyRouteIds||[]).includes(routeId))fail(`escort witness ${o.id} omits ${routeId}`);}
  if(['breach','disable'].includes(o.type))for(const id of o.targetIds)destroyed.add(id);
  completed.add(o.id);audit.phaseWitnesses++;
 }
 for(const o of spec.objectives)if(!completed.has(o.id))fail(`missing witness phase ${o.id}`);
 const truckEnds=spec.entities.filter(e=>e.kind==='truck').map(e=>({id:e.id,p:routes.get(e.routeId).points.at(-1)}));
 for(let i=0;i<truckEnds.length;i++)for(let j=i+1;j<truckEnds.length;j++)if(Math.hypot(truckEnds[i].p.x-truckEnds[j].p.x,truckEnds[i].p.z-truckEnds[j].p.z)<6.2)fail(`truck endpoint overlap ${truckEnds[i].id}/${truckEnds[j].id}`);
 return {valid:errors.length===0,errors,warnings,audit};
}
