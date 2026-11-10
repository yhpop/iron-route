import {createCrossfireV4Front} from './crossfire-v4-front.js';
import {sampleHeightfield} from './terrain-candidate/heightfield.js';
export const SCANNED_COVER_IDS=Object.freeze(['scan-east-entry','scan-east-mid','scan-west-shoulder']);
/** Exact scan envelope: box collision intentionally fills chips and lifting loops. */
export function createScannedCoverFront(){
 const {spec,field}=createCrossfireV4Front();
 spec.id='mission-9060';spec.index=9060;spec.slug='scanned-cover';spec.scannedCover=true;spec.title='实景混凝土掩体 · 资源候选';
 spec.geometry=[...spec.geometry,...[[19.5,16],[19.5,-12],[-26.2,8]].map(([x,z],i)=>({id:SCANNED_COVER_IDS[i],kind:'box',x,z,y:sampleHeightfield(field,x,z).height,yaw:Math.PI/2,width:1.56540936,depth:.44214198,height:1.11195294}))];
 return {spec,field};
}
