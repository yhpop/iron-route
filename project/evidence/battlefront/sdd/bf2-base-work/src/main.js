import {createRuinedDepotFront} from './ruined-depot-front.js';
import {createRuinedDepotWorld} from './ruined-depot-world.js';
import {createRuinedDepotView} from './ruined-depot-view.js';
import {loadRuinedDepotLibrary} from './ruined-depot-loader.js';
import {createScannedCoverFront} from './scanned-cover-front.js';
import {loadScannedCoverLibrary} from './scanned-cover-loader.js';
import {applyScannedCoverView} from './scanned-cover-view.js';
import {applyWarVehicleFinish} from './war-vehicle-finish.js';
import {createCrossfireV3Front} from './crossfire-v3-front.js';
import {createCrossfireV4Front} from './crossfire-v4-front.js';
import {createCrossfireFront} from './crossfire-front.js';
import {createScorchedFront} from './scorched-front.js';
import {createScorchedWorldView} from './scorched-world-view.js';
import {listPlayerVehicles,withPlayerVehicle,playerRig} from './player-vehicles-v3.js';
import {loadPlayerModel} from './player-model-loader.js';
import {attachInterceptorArt} from './interceptor-art-loader.js';
import {createVerticalSlice} from './terrain-candidate/vertical-slice.js';
import {updateAssetCredits} from './asset-credits.js';
import {createLivingWorldView,parseWildlife} from './living-world.js';
import {createInterceptorMission} from './terrain-candidate/interceptor-mission.js';
import {routeChoiceName,routeChoiceLabels} from './route-choice-guidance.js';
import {createRidgeConvoyMission} from './terrain-candidate/ridge-convoy.js';
import {sampleHeightfield} from './terrain-candidate/heightfield.js';
import {createTerrainCombatMission} from './terrain-candidate/combat-mission.js';
import {createTerrainCombatWorld} from './terrain-candidate/combat-world.js';
import {createReliefView} from './terrain-candidate/relief-view.js';
import {crushFlank} from './content/crush-flank.js';
import {createPlayerOcclusion} from './player-occlusion.js';
import * as THREE from 'three';
import tankBytes from '../assets/tank_v5_articulated.glb';
import {getCraftedMission as getMission,listCraftedMissions as listMissions,CAMPAIGN_ID,PROGRESS_NAMESPACE} from './content/crafted20/index.js';
import {loadEmbeddedCampaignArt} from './art-kit-embedded.js';
import {getOptionalMission,listOptionalMissions} from './content/optional-records.js';
import {resolveLaunch,persistLaunchProgress,recordLaunchWin} from './launch-selection.js';
import {syncEntryUrl} from './entry-navigation.js';
import {showStartupFailure} from './startup-diagnostic.js';
import {createWorld} from './campaign-world.js';
import {createGame,stepGame} from './campaign-simulation.js';
import {loadTank} from './tank-view.js';
import {getTankTransform,DEFAULT_CONFIG} from './tank-controller.js';
import {createTargetingView} from './targeting-view.js';
import {createCampaignView} from './campaign-view.js';
import {createTankAudio} from './tank-audio.js';
import {createInput} from './campaign-input.js';
import {createGameplayGestureGuard} from './gameplay-gestures.js';
import {computeChargeWarnings,projectThreatPoint} from './threat-warnings.js';
import {createUI} from './campaign-ui.js';
import {computeBattlefieldGuidance} from './battlefield-guidance.js';
import {createCombatFeedback} from './combat-feedback.js';
import {createObjectiveTracker} from './objective-guidance.js';
import {createClock,interpolateTank,boundAim,bindPageLifecycle,loadProgress} from './session.js';

const canvas=document.querySelector('#world'),help=document.querySelector('#launch-help');
let startupPhase='graphics';
function fail(error){showStartupFailure(help,error,startupPhase);console.error(error);}
async function boot(){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
 startupPhase='startup';
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 const audio=createTankAudio();let soundMuted=false;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x8eaaa8);scene.fog=new THREE.Fog(0x8eaaa8,55,120);
 const hemisphere=new THREE.HemisphereLight(0xe3f1ed,0x304b48,2.3);scene.add(hemisphere);const sun=new THREE.DirectionalLight(0xffe2ac,3.1);sun.position.set(-18,28,14);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-26,right:26,top:26,bottom:-26,near:1,far:80});sun.shadow.bias=-.0004;scene.add(sun,sun.target);
 const camera=new THREE.PerspectiveCamera(42,1,.15,150);const target=new THREE.Vector3();let cameraReady=false;
 const raycaster=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.8),hit=new THREE.Vector3();
 const terrainCombat=createTerrainCombatMission(),ridgeConvoy=createRidgeConvoyMission(),interceptor=createInterceptorMission(),verticalSlice=createVerticalSlice(),scorchedFront=createScorchedFront(),crossfireFront=createCrossfireFront(),crossfireV3=createCrossfireV3Front(),crossfireV4=createCrossfireV4Front(),scannedCover=createScannedCoverFront(),ruinedDepot=createRuinedDepotFront();ruinedDepot.spec=withPlayerVehicle(ruinedDepot.spec,'sandfalcon');scannedCover.spec=withPlayerVehicle(scannedCover.spec,'sandfalcon');crossfireV4.spec=withPlayerVehicle(crossfireV4.spec,'sandfalcon');crossfireV3.spec=withPlayerVehicle(crossfireV3.spec,'sandfalcon');crossfireFront.spec=withPlayerVehicle(crossfireFront.spec,'vanguard');scorchedFront.spec=withPlayerVehicle(scorchedFront.spec,'vanguard');
 const livingConvoy={...ridgeConvoy,spec:{...ridgeConvoy.spec,id:'living-convoy',livingWorld:true}};
 const terrainFor=spec=>spec.id===ruinedDepot.spec.id?ruinedDepot:spec.id===scannedCover.spec.id?scannedCover:spec.id===crossfireV4.spec.id?crossfireV4:spec.id===crossfireV3.spec.id?crossfireV3:spec.id===crossfireFront.spec.id?crossfireFront:spec.id===scorchedFront.spec.id?scorchedFront:spec.id===verticalSlice.spec.id?verticalSlice:spec.livingWorld?ridgeConvoy:spec.id===interceptor.spec.id?interceptor:spec.id===ridgeConvoy.spec.id?ridgeConvoy:terrainCombat;
 const missions=listMissions(),optionalMissions=listOptionalMissions();let storage;try{storage=localStorage;}catch{}
 let progress=loadProgress(storage,missions,PROGRESS_NAMESPACE),spec,world,state,worldView,pendingEvents=[],previousTank,lastAim=null,winRecorded=false,disposed=false,input,ui,gestureGuard,artKit,tankView,clock,last=performance.now(),viewStatus='loading',viewError='';
 let scanView=null,scanLibrary=null,scanLoad=null;
 let ruinView=null,ruinLibrary=null,ruinLoad=null;
 // App-owned successful/pending library; an actual decode rejection is retryable.
 function ensureRuinLibrary(){
  if(ruinLoad)return ruinLoad;
  const pending=loadRuinedDepotLibrary().then(library=>{
   if(disposed){library.dispose();return null;}
   ruinLibrary=library;return library;
  },error=>{if(ruinLoad===pending)ruinLoad=null;throw error;});
  ruinLoad=pending;return pending;
 }
 function ensureScanLibrary(){
  if(scanLoad)return scanLoad;
  const pending=loadScannedCoverLibrary().then(library=>{if(disposed){library.dispose();return null;}scanLibrary=library;return library;},error=>{if(scanLoad===pending)scanLoad=null;throw error;});
  scanLoad=pending;return pending;
 }
 let originalTankView,playerFinish=null,selectionEpoch=0,muzzleGuidanceState=null,muzzleGuidanceContacts=[];
 let pendingConvoyOrder=null;const hitFeedback=createCombatFeedback(),objectiveTracker=createObjectiveTracker();
 const resolveOptional=slug=>slug==='ruined-depot'?ruinedDepot.spec:slug==='scanned-cover'?scannedCover.spec:slug==='crossfire-v4'?crossfireV4.spec:slug==='crossfire-v3'?crossfireV3.spec:slug==='crossfire-front'?crossfireFront.spec:slug==='scorched-front'?scorchedFront.spec:slug==='vertical-slice'?verticalSlice.spec:slug==='living-convoy'?livingConvoy.spec:slug==='interceptor'?interceptor.spec:slug==='ridge-convoy'?ridgeConvoy.spec:slug==='terrain-combat'?terrainCombat.spec:slug==='crush-flank'?crushFlank:getOptionalMission(slug);
 let launch=resolveLaunch(globalThis.location?.search||'',missions,progress,resolveOptional),entryWarning=false;
 const targeting=createTargetingView(scene);let occlusion=createPlayerOcclusion(scene);
 function dispose(){
  if(disposed)return;disposed=true;clock?.pause();gestureGuard?.dispose();input?.dispose();ui?.dispose();selectionEpoch++;playerFinish?.dispose();playerFinish=null;if(tankView!==originalTankView)tankView?.dispose();originalTankView?.dispose();occlusion.dispose();targeting.dispose();audio.dispose();scanView?.dispose();scanView=null;ruinView?.dispose();ruinView=null;worldView?.dispose();scanLibrary?.dispose();scanLibrary=null;ruinLibrary?.dispose();ruinLibrary=null;artKit?.dispose();world?.dispose();renderer.dispose();
  window.removeEventListener('resize',resize);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',pauseHidden);detachLifecycle();
 }
 const detachLifecycle=bindPageLifecycle(window,{pause:()=>{if(state?.phase==='playing')command('pause');},restore:()=>{resize();last=performance.now();updateUI();},dispose});
 try{
  startupPhase='assets';
  artKit=await loadEmbeddedCampaignArt();if(disposed){artKit.dispose();return;}
  tankView=originalTankView=await loadTank(scene,{data:tankBytes});if(disposed){tankView.dispose();return;}
  if(launch.spec.entities?.some(e=>e.vehicle==='pz3')){artKit=await attachInterceptorArt(artKit,tankView.root);if(disposed){artKit.dispose();return;}}
 }catch(error){const canceled=disposed;dispose();if(!canceled)throw error;return;}
 startupPhase='startup';

 function renderStatus(renderTank=state?.tank){
  updateAssetCredits(document.querySelector('#asset-credits'),state?.phase);
  const objectiveGuidance=objectiveTracker.update(state,spec,renderTank?.pose),goal=objectiveGuidance.target,p=renderTank?.pose;
  progress.goalHint='';
  if(goal&&p){
   camera.updateMatrixWorld();
   const g=new THREE.Vector3(goal.x,.2,goal.z).project(camera),origin=new THREE.Vector3(p.x,.2,p.z).project(camera),angle=Math.atan2(-(g.y-origin.y),g.x-origin.x);
   const arrow=['→','↘','↓','↙','←','↖','↑','↗'][(Math.round(angle/(Math.PI/4))+8)%8];
   const objective=objectiveGuidance.targetObjectiveId===objectiveGuidance.objective?.id?objectiveGuidance.objective:null;
   progress.goalHint=(objective?.title||routeChoiceName(spec,{zoneId:goal.id})||{breach:'路障',disable:'火力点',escort:'补给车',reach:'目的地',defend:'掩护点'}[goal.type]||'目标')+' '+arrow+' '+Math.round(Math.hypot(goal.x-p.x,goal.z-p.z))+' m';
  }
  if(spec.convoyChoice){if(!state.selectedConvoyChoiceId&&!spec.convoyChoice.options.some(o=>o.title)&&state.objectiveStates[spec.convoyChoice.requiresObjectiveId]?.status==='complete')progress.goalHint='直行：短路有火力 · 左转：长路有掩护';else if(state.selectedConvoyChoiceId){const title=routeChoiceName(spec,{choiceId:state.selectedConvoyChoiceId});progress.goalHint+=title?' · '+title:(state.selectedConvoyChoiceId==='covered'?' · 已选掩护长路':' · 已选短路');}}if(state.tankFrame?.surface?.class==='rubble')progress.goalHint+=' · 碎石减速';
  let chargeWarnings,battlefieldGuidance,routeLabels=[];
  if(state?.phase==='playing'&&viewStatus==='ready'){
   // The warning reads this exact render camera in CSS pixels. It never adjusts
   // framing or the input projection, and its countdown comes only from state.
   camera.updateMatrixWorld();const canvasRect=canvas.getBoundingClientRect();
   // New mission only: omit floating labels pending device validation; zone crossing remains simulation-owned.
   if(!spec.ruinedDepot)routeLabels=routeChoiceLabels(state,spec,pose=>projectThreatPoint({entity:{pose:{...pose,y:world?.terrain?sampleHeightfield(world.terrain,pose.x,pose.z).height:0}},camera,canvasRect,height:.12}),canvasRect);
   // Simulation snapshots are immutable between ticks; do not repeat broadphase
   // muzzle queries on every interpolated render or invent a nearby contact.
   if(muzzleGuidanceState!==state){muzzleGuidanceState=state;muzzleGuidanceContacts=spec.crossfireFront&&state.tank?.blocked?.muzzle?(world?.muzzleContacts?.(getTankTransform(state.tank,playerRig(spec)),playerRig(spec))?.contacts||[]):[];}
   battlefieldGuidance=computeBattlefieldGuidance({state,origin:projectThreatPoint({entity:{pose:renderTank.pose},camera,canvasRect,height:.8}),projectEntity:entity=>projectThreatPoint({entity,camera,canvasRect}),viewStatus,visible:!document.hidden,muzzleContactIds:muzzleGuidanceContacts});
   chargeWarnings=computeChargeWarnings({state,origin:projectThreatPoint({entity:{pose:renderTank.pose},camera,canvasRect,height:.8}),projectEntity:entity=>projectThreatPoint({entity,camera,canvasRect})});
  }
  return {entryWarning,viewStatus,viewError,chargeWarnings,battlefieldGuidance,routeLabels,objectiveGuidance,hitFeedback:hitFeedback.update(state)};
 }
 function updateUI(){if(!state||disposed)return;const playable=state.phase==='playing'&&viewStatus==='ready';input?.setEnabled(playable);gestureGuard?.setActive(playable);ui?.render(state,spec,progress,renderStatus());}
 function loadSelection(next){
  const epoch=++selectionEpoch;
  playerFinish?.dispose();playerFinish=null;
  if(tankView&&tankView!==originalTankView)tankView.dispose();tankView=originalTankView;
  if(originalTankView?.root)originalTankView.root.visible=!next.spec.playerVehicle||next.spec.playerVehicle.modelKey==='original';
  viewStatus='loading';viewError='';help.hidden=true;
  occlusion.dispose();occlusion=createPlayerOcclusion(scene);launch=next;scanView?.dispose();scanView=null;ruinView?.dispose();ruinView=null;world?.dispose();worldView?.dispose();spec=launch.spec;
  const scorched=!!spec.scorchedFront;scene.background.setHex(scorched?0x969086:0x8eaaa8);scene.fog.color.setHex(scorched?0x969086:0x8eaaa8);hemisphere.groundColor.setHex(scorched?0x494136:0x304b48);hemisphere.color.setHex(scorched?0xe8e0d0:0xe3f1ed);
  world=spec.ruinedDepot?createRuinedDepotWorld(spec,terrainFor(spec).field):spec.terrainCombat?createTerrainCombatWorld(spec,terrainFor(spec).field):createWorld(spec);state=createGame(spec);if(world.groundPose)state.tank.pose=world.groundPose(state.tank.pose);previousTank=state.tank;
  worldView=createCampaignView(scene,spec,{artKit,...(spec.scorchedFront?{livingFactory:root=>createScorchedWorldView(root,spec,terrainFor(spec).field)}:{}),...(spec.livingWorld?{livingFactory:root=>createLivingWorldView(root,spec,{load:async()=>parseWildlife((await import('../assets/ecology/Fox.glb')).default),groundHeightAt:(x,z)=>sampleHeightfield(terrainFor(spec).field,x,z).height})}:{}),...(spec.terrainCombat?{groundHeightAt:(x,z)=>sampleHeightfield(terrainFor(spec).field,x,z).height,terrainFactory:root=>createReliefView(root,terrainFor(spec).field,{appearance:spec.ruinedDepot?'scorched':spec.crossfireFront?'crossfire':spec.scorchedFront?'scorched':'default'})}:{}),terrain:{maxAnisotropy:renderer.capabilities.getMaxAnisotropy()}});
  const loadedView=worldView,vehicle=spec.playerVehicle;
  if(spec.crossfireFront&&(!vehicle||vehicle.modelKey==='original')&&tankView.root?.traverse)playerFinish=applyWarVehicleFinish(tankView.root,{team:spec.combatRelations.playerTeam});
  const modelReady=vehicle&&vehicle.modelKey!=='original'?loadPlayerModel(scene,vehicle,{artKit}).then(view=>{if(disposed||selectionEpoch!==epoch){view.dispose();return;}tankView=view;if(spec.crossfireFront&&view.root?.traverse)playerFinish=applyWarVehicleFinish(view.root,{team:spec.combatRelations.playerTeam});tankView.update(state.tank,0);}):null;
  const selectionSpec=spec,selectionField=terrainFor(spec).field;
  const isCurrentView=()=>!disposed&&selectionEpoch===epoch&&worldView===loadedView;
  // Start both independent loads in parallel, but never decorate a half-built world.
  // Preserve the old scan-only path; the new mission's scan adapter also waits.
  const scanLibraryReady=spec.scannedCover?(spec.ruinedDepot?Promise.all([loadedView.ready,ensureScanLibrary()]).then(([,library])=>library):ensureScanLibrary()):null;
  const scanReady=scanLibraryReady?.then(library=>{
   if(isCurrentView())scanView=applyScannedCoverView(scene,selectionSpec,library);
  });
  const ruinReady=spec.ruinedDepot?Promise.all([loadedView.ready,ensureRuinLibrary()]).then(([,library])=>{
   if(isCurrentView())ruinView=createRuinedDepotView(scene,selectionSpec,selectionField,library);
  }):null;
  const ready=loadedView.ready||modelReady||scanReady||ruinReady?Promise.all([loadedView.ready,modelReady,scanReady,ruinReady]):null;
  if(ready)ready.then(()=>{
   if(!disposed&&worldView===loadedView){viewStatus='ready';updateUI();}
  },error=>{
   if(!disposed&&worldView===loadedView){viewStatus='failed';viewError=error?.message||'图形资源载入失败';if(state.phase==='playing')command('pause');console.error(error);updateUI();}
  });else viewStatus='ready';
  if(launch.progressWritable){progress={...progress,selectedMissionId:spec.id};progress.storageAvailable=persistLaunchProgress(launch,storage,progress,PROGRESS_NAMESPACE);}
  pendingEvents=[];hitFeedback.reset();objectiveTracker.reset();pendingConvoyOrder=null;lastAim=null;winRecorded=false;cameraReady=false;input?.reset({clearAim:true});clock?.pause();audio.setPaused(true);updateUI();
 }
 function syncSelection(slug){try{entryWarning=!syncEntryUrl(globalThis.location,globalThis.history,slug,resolveOptional);}catch{entryWarning=true;}updateUI();}
 function select(id){const selected=getMission(id);if(!selected||!progress.unlockedIds.includes(id))return;loadSelection({optional:false,spec:selected,progressWritable:true});syncSelection(null);}
 function selectOptionalMission(slug){const selected=getOptionalMission(slug);if(!selected)return;loadSelection({optional:true,spec:selected,progressWritable:false});syncSelection(slug);}
 let selectingFeatured=false;
 async function selectFeaturedMission(slug){
  if(!['ruined-depot','vertical-slice','scorched-front','crossfire-front','crossfire-v3','crossfire-v4'].includes(slug)||selectingFeatured||disposed)return;
  selectingFeatured=true;const epoch=selectionEpoch;
  if(state.phase==='playing')command('pause');viewStatus='loading';updateUI();
  try{
   if(!artKit.diagnostics?.communityVehicles){artKit=await attachInterceptorArt(artKit,tankView.root);if(disposed){artKit.dispose();return;}}
   if(selectionEpoch!==epoch)return;
   loadSelection({optional:true,spec:resolveOptional(slug),progressWritable:false});syncSelection(slug);
  }catch(error){if(!disposed&&selectionEpoch===epoch){viewStatus='failed';viewError=error?.message||String(error);console.error(error);updateUI();}}
  finally{selectingFeatured=false;}
 }
 function selectPlayerVehicle(id){if(disposed||!spec?.scorchedFront||state.phase!=='briefing'||viewStatus!=='ready')return;const selected=withPlayerVehicle(spec,id);loadSelection({...launch,spec:selected});}
 function command(action){if(action==='pause')pendingConvoyOrder=null;if(!state||disposed||(['start','resume'].includes(action)&&viewStatus!=='ready'))return;state=stepGame(state,{[action]:true},1/60,world);input.reset();if(state.phase==='playing'){clock.resume();audio.setPaused(false);void audio.unlock();}else {clock.pause();audio.setPaused(true);}updateUI();}
 input=createInput(canvas,{getTankPose:()=>state?.tank.pose,projectAim(x,y){const rect=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),camera);if(spec?.terrainCombat){const a=raycaster.ray.origin,b=a.clone().addScaledVector(raycaster.ray.direction,200);return world.raycast(a,b,['tank'])?.point||null;}return raycaster.ray.intersectPlane(plane,hit)?boundAim(hit,state?.tank.pose):null;}});
 ui=createUI({missions,optionalMissions,playerVehicles:listPlayerVehicles(),selectPlayerVehicle,featuredMissions:[{slug:'ruined-depot',spec:ruinedDepot.spec},{slug:'crossfire-v4',spec:crossfireV4.spec},{slug:'crossfire-v3',spec:crossfireV3.spec},{slug:'crossfire-front',spec:crossfireFront.spec},{slug:'scorched-front',spec:scorchedFront.spec},{slug:'vertical-slice',spec:verticalSlice.spec}],selectFeaturedMission,campaign:{id:CAMPAIGN_ID,title:'手工战役'},soundMuted:()=>soundMuted,toggleSound:()=>{soundMuted=!soundMuted;audio.setMuted(soundMuted);if(!soundMuted&&state.phase==='playing')void audio.unlock();},start:()=>command('start'),pause:()=>command('pause'),resume:()=>command('resume'),retry:()=>loadSelection(launch),selectMission:select,selectOptionalMission,setGovernor:mode=>input.setGovernor(mode),orderConvoy:order=>{pendingConvoyOrder=order;},cycleObjective:()=>{if(objectiveTracker.selectNext())updateUI();}});
 gestureGuard=createGameplayGestureGuard(canvas,{onZoom:()=>{if(state?.phase==='playing')command('pause');}});
 clock=createClock(dt=>{const was=state.phase;previousTank=state.tank;const controls=input.sample();if(pendingConvoyOrder){controls.convoyOrder=pendingConvoyOrder;pendingConvoyOrder=null;}if(controls.aim?.worldPoint)lastAim=controls.aim.worldPoint;state=stepGame(state,controls,dt,world);pendingEvents.push(...state.events);if(state.phase==='won'&&!winRecorded){winRecorded=true;progress=recordLaunchWin(launch,progress,{ticks:state.tick,hp:state.tankCombat.hp},missions);const saved=persistLaunchProgress(launch,storage,progress,PROGRESS_NAMESPACE);if(saved!==null)progress.storageAvailable=saved;}if(state.phase!==was){if(state.phase!=='playing'){clock.pause();audio.setPaused(true);}updateUI();}});
 loadSelection(launch);
 function resize(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 resize();window.addEventListener('resize',resize);
 function pauseHidden(){if(document.hidden&&state.phase==='playing')command('pause');}
 function blur(){if(state.phase==='playing')command('pause');}
 document.addEventListener('visibilitychange',pauseHidden);window.addEventListener('blur',blur);
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(state.phase==='playing')command('pause');help.hidden=false;help.textContent='图形连接已暂停。恢复后可继续，若无法恢复请重新打开页面。';});
 canvas.addEventListener('webglcontextrestored',()=>{help.hidden=true;resize();});
 last=performance.now();function frame(now){if(disposed)return;const dt=Math.max(0,(now-last)/1000);last=now;const alpha=clock.advance(dt);const renderTank=state.phase==='playing'?interpolateTank(previousTank,state.tank,alpha):state.tank;
  const p=renderTank.pose;const aim=state.tank.turret.yawRel+p.yaw;const focus=new THREE.Vector3(p.x-Math.sin(aim)*2.2,p.y+.5,p.z-Math.cos(aim)*2.2);if(!cameraReady){target.copy(focus);cameraReady=true;}else target.lerp(focus,1-Math.exp(-Math.min(dt,.1)*5));
  const portrait=camera.aspect<.85;camera.position.set(target.x+(portrait?8:10),target.y+(portrait?23:19),target.z+(portrait?22:18));camera.lookAt(target);sun.position.set(target.x-18,target.y+28,target.z+14);sun.target.position.set(target.x,target.y,target.z);

  tankView.update(renderTank,Math.min(dt,.1));targeting.update(getTankTransform(renderTank,playerRig(spec)),lastAim,world,state.tankFrame?.canFire&&state.tankCombat.reload<=0);hitFeedback.update(state,pendingEvents);worldView.update(state,pendingEvents,Math.min(dt,.1));ruinView?.update(state,pendingEvents,Math.min(dt,.1));audio.update(state,pendingEvents);pendingEvents=[];ui.render(state,spec,progress,renderStatus(renderTank));occlusion.update(camera,p);renderer.render(scene,camera);requestAnimationFrame(frame);
 }
 help.hidden=true;requestAnimationFrame(frame);

}
boot().catch(fail);
