import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {createEightNpcCrossfire} from '../src/eight-npc-crossfire-front.js';import {withPlayerVehicle} from '../src/player-vehicles-v3.js';import {createGame,stepGame} from '../src/campaign-simulation.js';import {createRuinedDepotWorld} from '../src/ruined-depot-world-accelerated.js';import {areHostile} from '../src/combat-relations.js';
const hash=x=>createHash('sha256').update(x).digest('hex'),folder=new URL('./fixtures/northern-staging/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('MANIFEST.json',folder)));
function routeProgress(p,route){let total=0,bestDistance=Infinity,best=0;for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(length*length))),distance=Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);if(distance<bestDistance){bestDistance=distance;best=total+t*length;}total+=length;}return best/total;}
for(const [name,meta] of Object.entries(manifest))test(name+' literal input replay wins with physical northern attacks in the second half of the convoy route',()=>{
 const bytes=fs.readFileSync(new URL(name+'.json.gz',folder));assert.equal(hash(bytes),meta.sha256);const tape=JSON.parse(gunzipSync(bytes)),{spec:base,field}=createEightNpcCrossfire(),spec=withPlayerVehicle(base,tape.vehicle);assert.equal(hash(JSON.stringify(spec)),tape.specHash);assert.equal(tape.dt,1/60);
 const route=spec.routes.find(r=>r.id===spec.convoyChoice.options.find(o=>o.id===tape.route).routeByTruck.supply),world=createRuinedDepotWorld(spec,field);let state=createGame(spec),lateShots=0,lateDamage=0,alliedContacts=0;const projectiles=new Map();
 try {
  for(const run of tape.runs)for(let i=0;i<run.n;i++){
   state=stepGame(state,run.input,tape.dt,world);const progress=routeProgress(state.entities.supply.pose,route);
   alliedContacts+=(state.tankFrame.contacts||[]).filter(id=>['allied-north','allied-far-east'].includes(id)).length;
   for(let j=0;j<state.events.length;j++){
    const e=state.events[j];
    if(e.type==='shot'){
     const shell=state.projectiles.find(p=>p.id===e.projectileId);assert.ok(shell&&shell.ownerId===e.entityId);projectiles.set(e.projectileId,{owner:e.entityId,tick:state.tick});
     if(progress>=.5&&['ridge-gun','hostile-far-east'].includes(e.entityId)&&['tank','supply'].includes(state.entities[e.entityId].targetId))lateShots++;
    }
    if(e.type==='damaged'){
     assert.ok(areHostile(state,e.entityId,e.targetId),'friendly damage prohibited');const impact=state.events[j-1],shot=projectiles.get(impact?.projectileId);assert.ok(impact?.type==='impact'&&impact.value==='hit'&&impact.entityId===e.entityId&&impact.targetId===e.targetId&&shot?.owner===e.entityId&&shot.tick<state.tick,'damage follows actual prior projectile and collision');
     if(progress>=.5&&['ridge-gun','hostile-far-east'].includes(e.entityId)&&['tank','supply'].includes(e.targetId))lateDamage++;
    }
   }
  }
  assert.equal(state.phase,'won');assert.equal(state.selectedConvoyChoiceId,tape.route);assert.equal(state.entities.supply.arrived,true);assert.ok(state.tankCombat.hp>0&&state.entities.supply.hp>0);assert.equal(state.tick,meta.tick);assert.equal(hash(JSON.stringify(state)),meta.finalHash);assert.equal(meta.finalHash,tape.finalHash);
  assert.ok(lateShots>0,'northern projectile targets player or convoy beyond half-distance');assert.ok(lateDamage>0,'real northern damage to player or convoy beyond half-distance');assert.equal(alliedContacts,0,'neither moved ally obstructs the driven path');
 }finally{world.dispose();}
});
