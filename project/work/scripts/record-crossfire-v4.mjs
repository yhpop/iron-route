/** Diagnostic pilot: only feeds real controls; never edits game state. */
import {createCrossfireV4Front} from '../src/crossfire-v4-front.js';
import {withPlayerVehicle,playerRig} from '../src/player-vehicles-v3.js';
import {createTerrainCombatWorld} from '../src/terrain-candidate/combat-world.js';
import {createGame,stepGame} from '../src/campaign-simulation.js';
import {getTankTransform} from '../src/tank-controller.js';
import {writeFileSync,mkdirSync,readFileSync,existsSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const route=process.argv[2]||'direct',vehicleId=process.argv[3]||'sandfalcon',attempt=process.argv[4]||(route==='covered'?'locked-westlane-straight-clear-southentry':'locked-spawnclear'),DT=1/60,clamp=x=>Math.max(-1,Math.min(1,x)),wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
const tapeTarget=new URL(`../qa/crossfire-v4/${vehicleId}-${route}-${attempt}-inputs.json.gz`,import.meta.url);if(existsSync(tapeTarget)||existsSync(new URL(`../qa/crossfire-v4/${vehicleId}-${route}-${attempt}-report.json`,import.meta.url)))throw new Error('Refusing to overwrite existing attempt: '+tapeTarget);
// The initial attempt predates charge commitment and is diagnostic only.
if(attempt==='initial')throw new Error('initial attempt superseded by locked combat; use a new attempt name');
const built=createCrossfireV4Front(),field=built.field,spec=withPlayerVehicle(built.spec,vehicleId),world=createTerrainCombatWorld(spec,field),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
console.log(JSON.stringify({event:'start',vehicleId,route,attempt,at:new Date().toISOString()}));
// Hash exact local static dependency closure used by the production simulation.
const root=fileURLToPath(new URL('../',import.meta.url)),runtimeFiles=new Set();
function visit(file){if(runtimeFiles.has(file))return;runtimeFiles.add(file);const code=readFileSync(resolve(root,file),'utf8');for(const m of code.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)){const dependency=relative(root,resolve(root,dirname(file),m[1]));visit(dependency);}}
for(const f of ['src/crossfire-v4-front.js','src/player-vehicles-v3.js','src/campaign-simulation.js','src/terrain-candidate/combat-world.js'])visit(f);
const sourceSnapshot=Object.fromEntries([...runtimeFiles].sort().map(f=>[f,readFileSync(resolve(root,f),'utf8')]));
const sourceHashes=Object.fromEntries(Object.entries(sourceSnapshot).map(([f,source])=>[f,createHash('sha256').update(source).digest('hex')]));
if(spec.id!=='mission-9052'||spec.playerVehicle.id!==vehicleId)throw new Error('V4 acceptance requires mission-9052 and the requested real config');
let maneuver=null,recovery=null;
let s=createGame(spec),runs=[],events=[],checkpoints=[],failure=null,action='start';
const play=()=>s.phase==='playing'&&!failure,dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function tick(input={}){const encoded=JSON.stringify(input);if(runs.length&&JSON.stringify(runs.at(-1).input)===encoded)runs.at(-1).n++;else runs.push({n:1,input});s=stepGame(s,input,DT,world);events.push(...s.events.map(e=>({...e,action})));}
const snap=()=>({tick:s.tick,phase:s.phase,tank:s.tank.pose,tankBlocked:{...s.tank.blocked},desiredSpeed:s.tankFrame.desiredSpeed,hp:s.tankCombat.hp,contacts:s.tankFrame.contacts,choice:s.selectedConvoyChoiceId,entities:Object.values(s.entities).map(e=>({id:e.id,hp:e.hp,pose:e.pose,status:e.status,stoppedReason:e.stoppedReason,arrived:e.arrived}))});
function checkpoint(){const p={action,...snap(),failure};checkpoints.push(p);console.log(JSON.stringify(p));}
function stop(){let n=0;while(play()&&(Math.abs(s.tank.vL)>.01||Math.abs(s.tank.vR)>.01)&&n++<180)tick({brake:true});}
function drive(x,z,{pace=false}={}){if(!play())return;action=`drive ${x},${z}`;stop();const target={x,z};let n=0,last={...s.tank.pose},still=0;
 while(play()&&dist(target,s.tank.pose)>.45&&n++<9000){const p=s.tank.pose,d=dist(target,p),a=wrap(Math.atan2(-(x-p.x),-(z-p.z))-p.yaw),truck=s.entities.supply;const lag=pace&&!truck.arrived&&dist(p,truck.pose)>14&&dist(truck.pose,target)>d;const input={throttle:Math.abs(a)<.45&&!lag?Math.min(1,d/3):0,steer:-clamp(a*2.5),brake:lag,aim:{worldPoint:{x:p.x+(x-p.x)/d*30,y:p.y+3,z:p.z+(z-p.z)/d*30}}};tick(input);const now=s.tank.pose;if(dist(now,last)<.00005&&Math.abs(wrap(now.yaw-last.yaw))<.00005&&!lag)still++;else still=0;last={...now};if(still>240)failure={kind:'pilot-inconclusive',reason:'no-motion',target};}
 stop();if(n>=9000)failure={kind:'pilot-inconclusive',reason:'drive-budget',target};checkpoint();}
function shoot(id){if(!play())return;action=`shoot ${id}`;stop();let n=0,lastHp=s.entities[id].hp,shots=s.tankCombat.shotsFired;
 while(play()&&s.entities[id].alive&&n++<1200){const e=s.entities[id],m=getTankTransform(s.tank,playerRig(spec)),aim={x:e.pose.x,y:e.pose.y+(e.kind==='barrier'?e.height*.5:1),z:e.pose.z},dx=aim.x-m.position.x,dy=aim.y-m.position.y,dz=aim.z-m.position.z,l=Math.hypot(dx,dy,dz),dot=(dx*m.direction.x+dy*m.direction.y+dz*m.direction.z)/l,hit=world.raycast(m.position,aim,['tank']);tick({brake:true,aim:{worldPoint:aim},firePressed:dot>.9995&&(!hit||hit.id===id)});if(s.entities[id].hp<lastHp){lastHp=s.entities[id].hp;shots=s.tankCombat.shotsFired;}if(s.tankCombat.shotsFired-shots>5)failure={kind:'pilot-inconclusive',reason:'ineffective-fire',id};}
 if(n>=1200)failure={kind:'pilot-inconclusive',reason:'blocked-aim',id};checkpoint();}
if(attempt.includes('recovery')){
 const prefixFile=attempt.includes('escape')?`${vehicleId}-covered-locked-westlane-straight-recovery-inputs.json.gz`:`${vehicleId}-covered-locked-westlane-straight-inputs.json.gz`,prefixBytes=readFileSync(new URL('../qa/crossfire-v4/'+prefixFile,import.meta.url)),prefix=JSON.parse(gunzipSync(prefixBytes));
 if(prefix.specHash!==hash(spec))throw new Error('Recovery prefix spec mismatch');action='replay authentic blocked prefix';let prefixInputs=0;
 let originalObstacleVerified=false;
 for(const run of prefix.runs)for(let n=0;n<run.n;n++){tick(run.input);prefixInputs++;if(prefix.recovery&&prefixInputs===prefix.recovery.prefixInputs){if(hash(s)!==prefix.recovery.prefixFinalHash||s.entities.supply.stoppedReason!=='obstacle')throw new Error('Original obstacle ancestor mismatch');originalObstacleVerified=true;}}
 if(hash(s)!==prefix.finalHash)throw new Error('Recovery full prefix hash mismatch '+hash(s)+' != '+prefix.finalHash);
 if(attempt.includes('escape')){if(!originalObstacleVerified||!world.hullContacts(s.tank,playerRig(spec)).includes('supply'))throw new Error('Recovery prefix lacks original obstacle or real supply contact');}else if(s.entities.supply.stoppedReason!=='obstacle')throw new Error('Recovery prefix is not obstacle state');
 recovery={originalObstacle:prefix.recovery?{inputs:prefix.recovery.prefixInputs,finalHash:prefix.recovery.prefixFinalHash,verified:originalObstacleVerified}:null,prefixStoppedReason:s.entities.supply.stoppedReason,prefixFile,prefixSHA256:createHash('sha256').update(prefixBytes).digest('hex'),prefixInputs,prefixFinalHash:hash(s),blockedTick:s.tick,blockedTruck:structuredClone(s.entities.supply),noStateRepair:true};checkpoint();
 tick({convoyOrder:'hold'});if(attempt.includes('escape')){const before=structuredClone(s.tank.pose),contacts=world.hullContacts(s.tank,playerRig(spec));if(!contacts.includes('supply'))throw new Error('Expected real starting supply contact');action='reverse away from real supply contact';for(let n=0;play()&&n<90;n++)tick({throttle:-1});stop();recovery.escape={before,after:structuredClone(s.tank.pose),contactsBefore:contacts,contactsAfter:world.hullContacts(s.tank,playerRig(spec)),reverseDisplacement:dist(before,s.tank.pose)};if(recovery.escape.reverseDisplacement<.3||recovery.escape.contactsAfter.includes('supply'))failure={kind:'pilot-inconclusive',reason:'collision-reverse-did-not-clear'};checkpoint();drive(-22,21);}else drive(-22,18);drive(-12,24);for(const id of ['ridge-fence-2','ridge-fence-3','ridge-fence-4'])if(s.entities[id].alive)shoot(id);drive(-12,20);tick({convoyOrder:'advance'});drive(-22,18,{pace:true});drive(-22,4,{pace:true});drive(-22,-20,{pace:true});drive(-8,-36,{pace:true});
}else{
 tick({start:true});tick({});
if(attempt==='maneuver'){
 tick({convoyOrder:'hold'});const truck=s.entities.supply;drive(truck.pose.x+4,truck.pose.z-3);stop();
 const before=structuredClone(s.tank.pose),truckBefore=structuredClone(s.entities.supply.pose);action='near-truck pivot';for(let i=0;play()&&i<90;i++)tick({steer:1,aim:{worldPoint:{x:before.x+20,y:before.y+4,z:before.z-20}}});stop();const turned=structuredClone(s.tank.pose);action='near-truck reverse escape';for(let i=0;play()&&i<120;i++)tick({throttle:-1});stop();const after=structuredClone(s.tank.pose);
 maneuver={before,turned,after,truckBefore,distanceBefore:dist(before,truckBefore),distanceAfter:dist(after,s.entities.supply.pose),turnRadians:wrap(turned.yaw-before.yaw),reverseDisplacement:dist(turned,after),realControlsOnly:true};if(Math.abs(maneuver.turnRadians)<.2||maneuver.reverseDisplacement<.3)failure={kind:'pilot-inconclusive',reason:'near-truck-maneuver-blocked'};checkpoint();
}

if(route==='direct'){drive(8,19);tick({convoyOrder:'hold'});drive(14,18);drive(14,1);shoot('road-gun');drive(18,-18);shoot('ridge-gun');drive(16,22);tick({convoyOrder:'advance'});drive(18,-24,{pace:true});drive(8,-36,{pace:true});}
else if(route==='covered'){if(attempt.includes('southentry')){drive(-10,25);drive(-10,21);}else drive(-8,19);tick({convoyOrder:'hold'});drive(-18,18);if(attempt.includes('straight'))drive(-22,18);drive(-22,9);if(attempt.includes('westlane'))shoot('hostile-flanker');drive(-22,-20);shoot('ridge-gun');drive(-22,18);drive(-12,20);if(attempt.includes('clear')){drive(-12,24);for(const id of ['ridge-fence-2','ridge-fence-3','ridge-fence-4'])if(s.entities[id].alive)shoot(id);drive(-12,20);}tick({convoyOrder:'advance'});const escortX=attempt.includes('westlane')?-22:-26;drive(escortX,18,{pace:true});drive(escortX,4,{pace:true});drive(escortX,-20,{pace:true});drive(-8,-36,{pace:true});}
else throw new Error('Unknown route');
}
if(play()){action='wait arrival';for(let n=0;play()&&n<2400;n++)tick({brake:true});if(play())failure={kind:'pilot-inconclusive',reason:'arrival-budget'};checkpoint();}
const report={evidenceBoundary:'Offline production simulation only; no WebGL/browser/device visual acceptance.',sourceHashes,recovery,maneuver,vehicleId,vehicleVersion:spec.playerVehicle.version,attempt,specHash:hash(spec),route,phase:s.phase,tick:s.tick,hp:s.tankCombat.hp,truckHp:s.entities.supply.hp,shots:s.tankCombat.shotsFired,failure,checkpoints,events,result:s.result,finalHash:hash(s)};
const out=new URL('../qa/crossfire-v4/',import.meta.url);mkdirSync(out,{recursive:true});writeFileSync(new URL(`${vehicleId}-${route}-${attempt}-report.json`,out),JSON.stringify(report,null,2));writeFileSync(new URL(`${vehicleId}-${route}-${attempt}-inputs.json.gz`,out),gzipSync(JSON.stringify({schema:1,sourceHashes,recovery,dt:DT,route,vehicleId,vehicleVersion:spec.playerVehicle.version,attempt,missionId:spec.id,specHash:hash(spec),spec,sourceSnapshot,runs,finalState:s,finalHash:hash(s),finalPhase:s.phase})));world.dispose();console.log(JSON.stringify({event:'end',at:new Date().toISOString(),vehicleId,route,phase:s.phase,tick:s.tick,hp:s.tankCombat.hp,truckHp:s.entities.supply.hp,failure}));if(s.phase!=='won')process.exitCode=1;
