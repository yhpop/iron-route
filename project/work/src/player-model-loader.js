import {createPlayerModelView} from './player-model-view.js';
import {updateInterceptorRunningGear} from './interceptor-art.js';
/** Lazy boundary keeps original campaigns off the extra model parsing path. */
export async function loadPlayerModel(scene,vehicle,{artKit}={}){
 if(vehicle.modelKey==='pz3')return createPlayerModelView(scene,artKit.clone('pz3'),{vehicle,updateRunningGear:updateInterceptorRunningGear});
 const module=await import('./player-model-embedded.js');
 return module.loadEmbeddedPlayerModel(scene,vehicle);
}
