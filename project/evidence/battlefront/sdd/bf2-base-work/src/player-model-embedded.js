import lightBytes from '../assets/armor/newc-leichttraktor.glb';
import sandfalconBytes from '../assets/armor/quaternius-sandfalcon.glb';
import tigerBytes from '../assets/armor/newc-tiger.glb';
import {loadPlayerAsset} from './player-model-asset.js';
const bytesById={'newc-leichttraktor':lightBytes,'newc-tiger':tigerBytes,'quaternius-sandfalcon':sandfalconBytes};
export async function loadEmbeddedPlayerModel(scene,vehicle){
 const data=bytesById[vehicle.modelKey];if(!data)throw new RangeError('Unsupported player model: '+vehicle.modelKey);
 return loadPlayerAsset(scene,vehicle,data);
}
