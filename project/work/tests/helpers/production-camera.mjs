import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {applyFollowCamera} from '../../src/opening-combat-camera.js';
// CPU projection using the literal camera constructor and frame-camera statements
// extracted from main.js. No re-implemented offset/FOV constants; no WebGL claims.
const source=readFileSync(new URL('../../src/main.js',import.meta.url),'utf8');
const constructor=source.match(/const camera=new THREE\.PerspectiveCamera\([^\n]+let cameraReady=false[^;]*;/)?.[0];
const begin=source.indexOf('  const p=renderTank.pose;'),end=source.indexOf('\n  tankView.update(',begin);
if(!constructor||begin<0||end<0)throw new Error('Production camera source boundary changed; inspect the helper before trusting projections.');
const frame=source.slice(begin,end);
export const cameraSource={helperSha256:createHash('sha256').update(readFileSync(new URL('../../src/opening-combat-camera.js',import.meta.url))).digest('hex'),sha256:createHash('sha256').update(source).digest('hex'),constructor,frame};
const make=new Function('THREE','applyFollowCamera','spec','viewport',`${constructor}\nconst sun={position:new THREE.Vector3(),target:{position:new THREE.Vector3()}};return (renderTank,aspect,dt=1/60)=>{viewportWidth=viewport.width??aspect*720;viewportHeight=viewport.height??720;camera.aspect=aspect;camera.updateProjectionMatrix();const state={tank:renderTank};${frame}\ncamera.updateMatrixWorld(true);return camera;};`);
export function createProductionCamera(spec={},viewport={}){return make(THREE,applyFollowCamera,spec,viewport);}
export function projectPoint(camera,p){const v=new THREE.Vector3(p.x,p.y??0,p.z).project(camera);return {x:v.x,y:v.y,z:v.z,inFrustum:Math.abs(v.x)<=1&&Math.abs(v.y)<=1&&v.z>=-1&&v.z<=1};}
