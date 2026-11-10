/** CPU-only exact-source camera/GLB geometry inspection. Not screenshots or browser QA. */
import * as THREE from 'three';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {getCraftedMission} from '../src/content/crafted20/index.js';
import {createWorld} from '../src/campaign-world.js';
import {createGame,stepGame} from '../src/campaign-simulation.js';
import {getTankTransform,DEFAULT_CONFIG} from '../src/tank-controller.js';
import {lineBlocker,inside,yawTo,wrap} from '../src/content/geometry.js';
import {createAuthoredSceneView} from '../src/authored-scene-view.js';
import {geometryLibrary} from '../tests/helpers/art-geometry.mjs';
import {createProductionCamera,projectPoint,cameraSource} from '../tests/helpers/production-camera.mjs';
const root=new URL('../qa/002-opening/',import.meta.url),tapes=new URL('../qa/crafted20-playthrough/',import.meta.url);
mkdirSync(root,{recursive:true});
const read=name=>JSON.parse(readFileSync(new URL(name,root),'utf8'));
const sources=await geometryLibrary(),artKit={clone:key=>sources[key].scene.clone(true)};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const viewports={landscape:{width:1280,height:720,coarse:false},phonePortrait:{width:390,height:844,coarse:true},phoneChrome:{width:390,height:664,coarse:true},phoneLandscape:{width:844,height:390,coarse:true},tabletPortrait:{width:820,height:1180,coarse:true}};
const aspects=Object.fromEntries(Object.entries(viewports).map(([k,v])=>[k,v.width/v.height]));
const shielded=(gun,p)=>Math.abs(wrap(yawTo(gun.pose,p)-gun.pose.yaw))<gun.shieldArc/2;
function pointInfo(camera,point,view){
 const projected=projectPoint(camera,point),origin=camera.position.clone(),to=new THREE.Vector3(point.x,point.y??0,point.z),distance=origin.distanceTo(to);
 const ray=new THREE.Raycaster(origin,to.clone().sub(origin).normalize(),0,distance-.08);
 const blockers=ray.intersectObjects([...view.solids.values()],true).filter(hit=>{for(let p=hit.object;p;p=p.parent)if(!p.visible)return false;return true;});
 let object=blockers[0]?.object;while(object?.parent&&object.parent!==view.root)object=object.parent;
 return {...projected,pixel:{x:(projected.x+1)/2,y:(1-projected.y)/2},artOccluder:object?.name??null};
}
function frustumGround(camera){return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>{
 const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x,y),camera);const point=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());return point?{x:point.x,z:point.z}:null;
});}
function meshExtent(camera,object){
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,vertices=0;
 object.updateWorldMatrix(true,true);object.traverse(mesh=>{if(!mesh.isMesh)return;for(let p=mesh;p;p=p.parent)if(!p.visible)return;const position=mesh.geometry.attributes.position,v=new THREE.Vector3();for(let i=0;i<position.count;i++){v.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld).project(camera);if(v.z < -1||v.z>1)continue;minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);vertices++;}});
 return {minX,maxX,minY,maxY,vertices,fullyInFrustum:vertices>0&&minX>=-1&&maxX<=1&&minY>=-1&&maxY<=1};
}

// Source-CSS exclusion model, not DOM/browser measurement. Root safe vars and
// media-query dimensions below are copied from unchanged style.css and hashed.
function controlRects({width:w,height:h,coarse}){
 if(!coarse&&w>900)return[];
 const portrait=h>w,short=!portrait&&h<=560,narrow=portrait&&w<=600;
 const configs=portrait?[{side:14,bottom:14},{side:14,bottom:34}]:[{side:14,bottom:14},{side:44,bottom:14}];
 return configs.flatMap(({side,bottom:safe})=>{
  const size=short||narrow?112:Math.max(108,Math.min(150,w*.17)),right=w-side-8,bottom=h-safe-(short?7:14);
  const rect=(id,r,b,width,height=width)=>({id:`${id}-side${side}-bottom${safe}`,left:r-width,right:r,top:b-height,bottom:b});
  const result=[rect('aim',right,bottom,size),rect('drive',side+8+size,bottom,size)];
  result.push(rect('fire',right-(narrow?-3:1),bottom-size-(short?12:17),narrow?58:short?56:66));
  if(narrow){result.push(rect('brake',right-65,bottom-size-23,44),rect('boost',right-114,bottom-size-23,44));result.push({id:`governor-side${side}-bottom${safe}`,left:side+7,right:side+57,top:h-safe-144-114,bottom:h-safe-144});}
  else if(short&&w<=560){result.push(rect('brake',right-64,bottom-size-12,48),rect('boost',right-64,bottom-size-68,48));}
  else result.push(rect('brake',right-size-17,bottom,48),rect('boost',right-size-17,bottom-60,48));
  return result;
 });
}
const touchExclusions=Object.fromEntries(Object.entries(viewports).map(([k,v])=>[k,controlRects(v)]));
function touchOverlaps(name,extent){const {width,height}=viewports[name],r={left:(extent.minX+1)*width/2,right:(extent.maxX+1)*width/2,top:(1-extent.maxY)*height/2,bottom:(1-extent.minY)*height/2};return {projectedPixelRect:r,controls:touchExclusions[name].filter(c=>r.right>c.left-8&&r.left<c.right+8&&r.bottom>c.top-8&&r.top<c.bottom+8).map(c=>c.id)};}

function snapshot(label,state,cameras,view,spec){
 const gun=spec.entities[0],mouthZ=spec.spawn.z-1.45;
 const points={gun:{...gun.pose,y:1.1},westMouth:{x:spec.spawn.x-4,y:.02,z:mouthZ},eastMouth:{x:spec.spawn.x+4,y:.02,z:mouthZ}};
 return {label,tick:state.tick,seconds:state.tick/60,pose:state.tank.pose,turret:state.tank.turret,combat:{losBlocker:lineBlocker(state.tank.pose,gun.pose,spec.geometry),insideShield:shielded(gun,state.tank.pose)},viewports:Object.fromEntries(Object.entries(cameras).map(([name,camera])=>[name,{aspect:camera.aspect,position:camera.position.toArray(),gunMeshExtent:meshExtent(camera,view.entities.get(gun.id)),groundFootprint:frustumGround(camera),points:Object.fromEntries(Object.entries(points).map(([key,p])=>[key,pointInfo(camera,p,view)]))}]))};
}
const layouts=[['before',read('before-spec.json'),'opening-before'],['v1',read('v1-spec.json'),'opening-v1'],['v2',read('v2-spec.json'),'opening-v2'],['v3',read('v3-spec.json'),'opening-v3'],['v4',read('v4-spec.json'),'opening-v4'],['candidate',getCraftedMission('crafted20-002'),'opening-v5']];
const output={provenance:'CPU-only: unchanged production main.js camera statements executed with Three.js; shipping GLB vertex meshes for art occlusion, image references omitted. Projection replay assumes one 60 Hz render per simulation step with renderTank=current tank (not observed browser interpolation). No browser pixels/device/performance/human acceptance.',cameraSource,touchExclusionModel:{viewports,cssSha256:createHash('sha256').update(readFileSync(new URL('../src/style.css',import.meta.url))).digest('hex'),portraitBottomInsets:[14,34],landscapeSideInsets:[14,44],padding:8,rects:touchExclusions},layouts:[]};
for(const [label,spec,tag] of (process.argv.includes('--current-only')?layouts.slice(-1):layouts)){
 const scene=new THREE.Scene(),view=createAuthoredSceneView(scene,spec,artKit);await view.ready;scene.updateMatrixWorld(true);
 const layout={label,specHash:hash(spec),fork:{westHasGravel:spec.surfaces.some(s=>s.class==='rubble'&&inside({x:spec.spawn.x-4,z:spec.spawn.z-1.45},s.polygon)),eastHasGravel:spec.surfaces.some(s=>s.class==='rubble'&&inside({x:spec.spawn.x+4,z:spec.spawn.z-1.45},s.polygon))},routes:[]};
 for(const route of ['west','east']){
  const file=`${tag}-${route}-crafted20-002-inputs.json.gz`,input=JSON.parse(gunzipSync(readFileSync(new URL(file,tapes)))),world=createWorld(spec);let state=createGame(spec);view.update(state,[],0);scene.updateMatrixWorld(true);
  const updateCameras=Object.fromEntries(Object.keys(aspects).map(k=>[k,createProductionCamera()]));let cameras=Object.fromEntries(Object.entries(updateCameras).map(([k,update])=>[k,update(state.tank,aspects[k])]));
  const result={route,inputFile:file,tapeSpecMatches:hash(spec)===input.specHash,samples:[snapshot('spawn',state,cameras,view,spec)],exposure:Object.fromEntries(Object.keys(aspects).map(k=>[k,{chargingFrames:0,outsideComfortFrame:0,occludedFrames:0,touchOverlapFrames:0,first:null,firstCounterexample:null,worstHorizontal:0,worstVertical:0}])),firstCombatLos:null,firstEnemyCharge:null,firstEnemyShot:null,firstPlayerDamage:null,gravelTicksBeforeShot:0,firstUsefulSideLos:null,firstVisibleGun:{},firstShot:null,aimStartSeconds:null,choiceNearest:null,contactTicks:0};let bestChoice=Infinity,firstShot=false;
  for(const run of input.runs)for(let i=0;i<run.n;i++){
   state=stepGame(state,run.input,input.dt,world);view.update(state,state.events,input.dt);scene.updateMatrixWorld(true);
   cameras=Object.fromEntries(Object.entries(updateCameras).map(([k,update])=>[k,update(state.tank,aspects[k],input.dt)]));
   if(state.tankFrame?.contacts?.length)result.contactTicks++;
   const enemy=state.entities[spec.entities[0].id];if(result.firstEnemyCharge===null&&enemy.status==='charging'&&enemy.targetId==='tank'){result.firstEnemyCharge=state.tick/60;result.samples.push(snapshot('first-enemy-charge',state,cameras,view,spec));}if(enemy.alive&&enemy.status==='charging'&&enemy.targetId==='tank')for(const [name,camera]of Object.entries(cameras)){const extent=meshExtent(camera,view.entities.get(enemy.id)),item=result.exposure[name];item.chargingFrames++;const overlap=touchOverlaps(name,extent);if(overlap.controls.length)item.touchOverlapFrames++;if(pointInfo(camera,{...enemy.pose,y:1.1},view).artOccluder)item.occludedFrames++;const horizontal=Math.max(Math.abs(extent.minX),Math.abs(extent.maxX));item.worstHorizontal=Math.max(item.worstHorizontal,horizontal);item.worstVertical=Math.max(item.worstVertical,Math.abs(extent.minY),Math.abs(extent.maxY));if(!item.firstCounterexample&&(!extent.fullyInFrustum||horizontal>.9||overlap.controls.length))item.firstCounterexample={seconds:state.tick/60,pose:state.tank.pose,extent,...overlap};if(!item.first)item.first={seconds:state.tick/60,extent};if(!extent.fullyInFrustum||horizontal>.9)item.outsideComfortFrame++;}if(result.firstEnemyShot===null&&state.events.some(e=>e.type==='shot'&&e.entityId===enemy.id))result.firstEnemyShot=state.tick/60;if(result.firstPlayerDamage===null&&state.events.some(e=>e.type==='damaged'&&e.targetId==='tank'))result.firstPlayerDamage=state.tick/60;
   if(!firstShot){
    if(state.tankFrame.surface.class==='rubble')result.gravelTicksBeforeShot++;
    if(run.input.aim&&!result.aimStartSeconds){result.aimStartSeconds=state.tick/60;result.samples.push(snapshot('aim-start',state,cameras,view,spec));}
    const gun=spec.entities[0],los=!lineBlocker(state.tank.pose,gun.pose,spec.geometry),dist=Math.hypot(state.tank.pose.x-gun.pose.x,state.tank.pose.z-gun.pose.z);
    if(los&&dist<26&&!result.firstCombatLos){result.firstCombatLos=state.tick/60;result.samples.push(snapshot('first-combat-LOS',state,cameras,view,spec));}
    if(los&&!shielded(gun,state.tank.pose)&&!result.firstUsefulSideLos){result.firstUsefulSideLos=state.tick/60;result.samples.push(snapshot('first-useful-side-LOS',state,cameras,view,spec));}
    const choiceDistance=Math.abs(state.tank.pose.z-4);if(choiceDistance<bestChoice&&Math.abs(state.tank.pose.x)>5){bestChoice=choiceDistance;result.choiceNearest=snapshot('shoulder-choice',state,cameras,view,spec);}
    for(const [name,camera]of Object.entries(cameras)){if(result.firstVisibleGun[name]!==undefined)continue;const info=pointInfo(camera,{...gun.pose,y:1.1},view);if(info.inFrustum&&!info.artOccluder)result.firstVisibleGun[name]=state.tick/60;}
    if(state.events.some(e=>e.type==='shot'&&e.entityId==='tank')){firstShot=true;result.firstShot=state.tick/60;result.samples.push(snapshot('first-shot',state,cameras,view,spec));}
   }
  }
  result.final={phase:state.phase,tick:state.tick,hp:state.tankCombat.hp,hash:hash(state),tapeHashMatches:hash(state)===input.finalHash};
  if(result.choiceNearest)result.samples.splice(1,0,result.choiceNearest);delete result.choiceNearest;
  layout.routes.push(result);world.dispose();
 }
 view.dispose();output.layouts.push(layout);
}
writeFileSync(new URL('projection-and-replay.json',root),JSON.stringify(output,null,2));
for(const l of output.layouts)for(const r of l.routes)console.log(JSON.stringify({layout:l.label,route:r.route,firstCombatLos:r.firstCombatLos,firstUsefulSideLos:r.firstUsefulSideLos,firstShot:r.firstShot,firstVisibleGun:r.firstVisibleGun,firstShotNdc:Object.fromEntries(Object.entries(r.samples.find(s=>s.label==='first-shot').viewports).map(([k,v])=>[k,v.points.gun])),final:r.final}));

if(process.argv.includes('--verify-current-exposure'))for(const route of output.layouts.at(-1).routes){assert.ok(route.tapeSpecMatches&&route.final.tapeHashMatches&&route.final.phase==='won',`${route.route}: exposure evidence must replay this exact spec to its recorded win`);for(const [aspect,e]of Object.entries(route.exposure)){assert.ok(e.chargingFrames>0,`${route.route}/${aspect}: no real enemy acquisition tested`);assert.equal(e.outsideComfortFrame,0,`${route.route}/${aspect}: charging while gun mesh is cropped or within 5% of horizontal edge`);assert.equal(e.occludedFrames,0,`${route.route}/${aspect}: charging while static shipping art hides target`);assert.equal(e.touchOverlapFrames,0,`${route.route}/${aspect}: warning overlaps source-CSS touch controls plus 8px margin`);}}
