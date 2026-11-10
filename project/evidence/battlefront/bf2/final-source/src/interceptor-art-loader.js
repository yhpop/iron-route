/** Shared lazy boundary: runtime imports embedded GLB; CPU harness substitutes only GPU asset loading. */
export async function attachInterceptorArt(base,ownerTankRoot){
 const module=await import('./interceptor-art-embedded.js');
 return module.attachInterceptorArt(base,ownerTankRoot);
}
