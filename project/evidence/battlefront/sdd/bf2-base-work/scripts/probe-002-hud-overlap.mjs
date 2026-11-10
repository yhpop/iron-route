/** Source-geometry counterexample, not browser pixels. */
import * as THREE from 'three';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {getCraftedMission} from '../src/content/crafted20/index.js';
import {createWorld} from '../src/campaign-world.js';
import {createGame,stepGame} from '../src/campaign-simulation.js';
import {createAuthoredSceneView} from '../src/authored-scene-view.js';
import {geometryLibrary} from '../tests/helpers/art-geometry.mjs';
import {createProductionCamera} from '../tests/helpers/production-camera.mjs';
const root=new URL('../qa/002-opening/',import.meta.url),report=JSON.parse(readFileSync(new URL('projection-and-replay.json',root))),route=report.layouts.at(-1).routes.find(r=>r.route==='west'),failure=route.exposure.phoneChrome.firstCounterexample;
if(!failure)throw new Error('No known phoneChrome counterexample to inspect.');
const input=JSON.parse(gunzipSync(readFileSync(new URL('../qa/crafted20-playthrough/opening-v5-west-crafted20-002-inputs.json.gz',import.meta.url)))),spec=getCraftedMission('crafted20-002'),world=createWorld(spec);let state=createGame(spec);
const update=createProductionCamera();let camera=update(state.tank,390/664);const end=Math.round(failure.seconds*60);
outer:for(const run of input.runs)for(let i=0;i<run.n;i++){state=stepGame(state,run.input,input.dt,world);camera=update(state.tank,390/664,input.dt);if(state.tick===end)break outer;}
const models=await geometryLibrary(),scene=new THREE.Scene(),view=createAuthoredSceneView(scene,spec,{clone:key=>models[key].scene.clone(true)});await view.ready;view.update(state,[],0);scene.updateMatrixWorld(true);
const gun=view.entities.get('armored-yard-gun'),control=report.touchExclusionModel.rects.phoneChrome.find(c=>c.id==='fire-side14-bottom34'),bounds=failure.projectedPixelRect;
const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};let tested=0,gunSamples=0;const samples=[];
for(let y=Math.max(control.top,bounds.top)+.5;y<Math.min(control.bottom,bounds.bottom);y++)for(let x=Math.max(control.left,bounds.left)+.5;x<Math.min(control.right,bounds.right);x++){
 tested++;const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x/390*2-1,1-y/664*2),camera);const hit=ray.intersectObject(gun,true).find(h=>visible(h.object));if(!hit)continue;const blocker=ray.intersectObjects([...view.solids.values()],true).find(h=>visible(h.object)&&h.distance<hit.distance-.001);if(blocker)continue;gunSamples++;if(samples.length<5)samples.push({x,y,gunMesh:hit.object.name,worldPoint:hit.point.toArray()});
}
const result={provenance:'CPU Three ray intersections with actual shipping GLB triangles at the replayed first-charge camera; unchanged CSS fire rectangle modeled at 390x664, 34px bottom inset and 14px side inset. Not a browser screenshot.',tick:state.tick,seconds:state.tick/60,gunStatus:state.entities['armored-yard-gun'].status,control,projectedGunBounds:bounds,tested,visibleGunSamplesUnderFireButton:gunSamples,examples:samples};
writeFileSync(new URL('hud-counterexample.json',root),JSON.stringify(result,null,2));console.log(JSON.stringify(result));view.dispose();world.dispose();
