/** Diagnostic pilot: only feeds real controls; never edits game state. */
import {createVerticalSlice} from '../src/terrain-candidate/vertical-slice.js';
import {createTerrainCombatWorld} from '../src/terrain-candidate/combat-world.js';
import {createGame,stepGame} from '../src/campaign-simulation.js';
import {getTankTransform,DEFAULT_CONFIG} from '../src/tank-controller.js';
import {writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const route=process.argv[2]||'direct',DT=1/60,clamp=x=>Math.max(-1,Math.min(1,x)),wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
const {spec,field}=createVerticalSlice(),world=createTerrainCombatWorld(spec,field),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
let s=createGame(spec),runs=[],events=[],checkpoints=[],failure=null,action='start';
const play=()=>s.phase==='playing'&&!failure,dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function tick(input={}){const encoded=JSON.stringify(input);if(runs.length&&JSON.stringify(runs.at(-1).input)===encoded)runs.at(-1).n++;else runs.push({n:1,input});s=stepGame(s,input,DT,world);events.push(...s.events.map(e=>({...e,action})));}
const snap=()=>({tick:s.tick,phase:s.phase,tank:s.tank.pose,hp:s.tankCombat.hp,contacts:s.tankFrame.contacts,choice:s.selectedConvoyChoiceId,entities:Object.values(s.entities).map(e=>({id:e.id,hp:e.hp,pose:e.pose,status:e.status,stoppedReason:e.stoppedReason,arrived:e.arrived}))});
function checkpoint(){const p={action,...snap(),failure};checkpoints.push(p);console.log(JSON.stringify(p));}
function stop(){let n=0;while(play()&&(Math.abs(s.tank.vL)>.01||Math.abs(s.tank.vR)>.01)&&n++<180)tick({brake:true});}
function drive(x,z,{pace=false}={}){if(!play())return;action=`drive ${x},${z}`;stop();const target={x,z};let n=0,last={...s.tank.pose},still=0;
 while(play()&&dist(target,s.tank.pose)>.45&&n++<9000){const p=s.tank.pose,d=dist(target,p),a=wrap(Math.atan2(-(x-p.x),-(z-p.z))-p.yaw),truck=s.entities.supply;const lag=pace&&!truck.arrived&&dist(p,truck.pose)>14&&dist(truck.pose,target)>d;const input={throttle:Math.abs(a)<.45&&!lag?Math.min(1,d/3):0,steer:-clamp(a*2.5),brake:lag,aim:{worldPoint:{x:p.x+(x-p.x)/d*30,y:p.y+3,z:p.z+(z-p.z)/d*30}}};tick(input);const now=s.tank.pose;if(dist(now,last)<.00005&&Math.abs(wrap(now.yaw-last.yaw))<.00005&&!lag)still++;else still=0;last={...now};if(still>240)failure={kind:'pilot-inconclusive',reason:'no-motion',target};}
 stop();if(n>=9000)failure={kind:'pilot-inconclusive',reason:'drive-budget',target};checkpoint();}
function shoot(id){if(!play())return;action=`shoot ${id}`;stop();let n=0,lastHp=s.entities[id].hp,shots=s.tankCombat.shotsFired;
 while(play()&&s.entities[id].alive&&n++<1200){const e=s.entities[id],m=getTankTransform(s.tank,DEFAULT_CONFIG.rig),aim={x:e.pose.x,y:e.pose.y+1,z:e.pose.z},dx=aim.x-m.position.x,dy=aim.y-m.position.y,dz=aim.z-m.position.z,l=Math.hypot(dx,dy,dz),dot=(dx*m.direction.x+dy*m.direction.y+dz*m.direction.z)/l,hit=world.raycast(m.position,aim,['tank']);tick({brake:true,aim:{worldPoint:aim},firePressed:dot>.9995&&(!hit||hit.id===id)});if(s.entities[id].hp<lastHp){lastHp=s.entities[id].hp;shots=s.tankCombat.shotsFired;}if(s.tankCombat.shotsFired-shots>5)failure={kind:'pilot-inconclusive',reason:'ineffective-fire',id};}
 if(n>=1200)failure={kind:'pilot-inconclusive',reason:'blocked-aim',id};checkpoint();}
tick({start:true});tick({});
if(route==='direct'){drive(8,19);tick({convoyOrder:'hold'});drive(14,18);drive(14,1);shoot('road-gun');drive(18,-18);shoot('ridge-gun');drive(16,22);tick({convoyOrder:'advance'});drive(18,-24,{pace:true});drive(8,-36,{pace:true});}
else if(route==='covered'){drive(-8,19);tick({convoyOrder:'hold'});drive(-18,18);drive(-22,9);drive(-22,-20);shoot('ridge-gun');drive(-22,18);drive(-12,20);tick({convoyOrder:'advance'});drive(-26,18,{pace:true});drive(-26,4,{pace:true});drive(-26,-20,{pace:true});drive(-8,-36,{pace:true});}
else throw new Error('Unknown route');
if(play()){action='wait arrival';for(let n=0;play()&&n<2400;n++)tick({brake:true});if(play())failure={kind:'pilot-inconclusive',reason:'arrival-budget'};checkpoint();}
const report={route,phase:s.phase,tick:s.tick,hp:s.tankCombat.hp,truckHp:s.entities.supply.hp,shots:s.tankCombat.shotsFired,failure,checkpoints,events,result:s.result,finalHash:hash(s)};
const out=new URL('../qa/vertical-slice/',import.meta.url);mkdirSync(out,{recursive:true});writeFileSync(new URL(`${route}-report.json`,out),JSON.stringify(report,null,2));writeFileSync(new URL(`${route}-inputs.json.gz`,out),gzipSync(JSON.stringify({schema:1,dt:DT,route,missionId:spec.id,specHash:hash(spec),runs,finalHash:hash(s)})));world.dispose();console.log(JSON.stringify({route,phase:s.phase,tick:s.tick,hp:s.tankCombat.hp,truckHp:s.entities.supply.hp,failure}));if(s.phase!=='won')process.exitCode=1;
