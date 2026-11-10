/** Bounded input-only reuse check. Failure means this tape is not a victory witness,
 * not that no route can win. No health, position, enemy or objective state injection. */
import fs from 'node:fs';import {createHash} from 'node:crypto';
import {createEightNpcCrossfire} from '../src/eight-npc-crossfire-front.js';
import {createRuinedDepotWorld} from '../src/ruined-depot-world-accelerated.js';
import {withPlayerVehicle} from '../src/player-vehicles-v3.js';import {createGame,stepGame} from '../src/campaign-simulation.js';
const route=process.argv[2];if(!['direct','covered'].includes(route))throw new Error('direct or covered required');
const path=route==='direct'?'../../evidence/extraction/e1/win-direct-01-inputs.json':'../../evidence/battlefront/bf1/route-qa/sandfalcon-covered-inputs.json',bytes=fs.readFileSync(new URL(path,import.meta.url)),tape=JSON.parse(bytes),{spec:base,field}=createEightNpcCrossfire(),spec=withPlayerVehicle(base,'sandfalcon'),world=createRuinedDepotWorld(spec,field);
const runs=route==='direct'?tape.runs:[tape.runs[0],{n:1080,input:{brake:true}},...tape.runs.slice(1)],hash=x=>createHash('sha256').update(x).digest('hex');let s=createGame(spec),inputs=0,events=[],lastInput=null;
try{for(const run of runs){for(let i=0;i<run.n;i++){lastInput=run.input;s=stepGame(s,run.input,1/60,world);inputs++;events.push(...s.events);if(s.phase==='won'||s.phase==='lost')break;}if(s.phase==='won'||s.phase==='lost')break;}
 const result={scope:'input-only headless reuse attempt, not original recovery or device acceptance',route,tape:path,tapeSHA256:hash(bytes),addedPreparationWait:route==='covered'?1080:0,inputs,tick:s.tick,phase:s.phase,result:s.result,selectedRoute:s.selectedConvoyChoiceId,playerHp:s.tankCombat.hp,supply:{hp:s.entities.supply.hp,alive:s.entities.supply.alive,arrived:s.entities.supply.arrived,pose:s.entities.supply.pose},objectives:s.objectiveStates,lastInput,finalHash:hash(JSON.stringify(s)),events};
 fs.writeFileSync(new URL(`../../ROUTE-${route}.json`,import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,events:events.length}));
}finally{world.dispose();}
