/** Independent tape replay: production createGame/stepGame only; no driver policy. */
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const [source,trace,output]=process.argv.slice(2);if(!source||!trace)throw new Error('Usage: node replay-snapshot.mjs <source-dir> <trace.gz> [output.json]');
const root=pathToFileURL(resolve(source)+'/');
const {getCraftedMission}=await import(new URL('content/crafted20/index.js',root));
const {createWorld}=await import(new URL('campaign-world.js',root));
const {createGame,stepGame}=await import(new URL('campaign-simulation.js',root));
const tape=JSON.parse(gunzipSync(await readFile(trace))),spec=getCraftedMission(tape.missionId);
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const world=createWorld(spec);let state=createGame(spec),inputs=0;
for(const run of tape.runs){if(!Number.isInteger(run.n)||run.n<=0)throw new Error('Invalid RLE');for(let i=0;i<run.n;i++){state=stepGame(state,run.input,tape.dt,world);inputs++;}}
const result={schema:1,trace,source,missionId:tape.missionId,inputs,tick:state.tick,phase:state.phase,hash:hash(state),expectedHash:tape.finalHash,specMatches:hash(spec)===tape.specHash,stateMatches:hash(state)===tape.finalHash};
world.dispose();if(output)await writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.specMatches||!result.stateMatches)process.exitCode=1;
