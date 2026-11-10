/** Lazy offline GLB/GPU boundary: old missions never import or decode ruins. */
export async function loadRuinedDepotLibrary(){
 const {loadEmbeddedRuinedDepotArt}=await import('./ruined-depot-embedded.js');
 return loadEmbeddedRuinedDepotArt();
}
