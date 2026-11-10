/** Lazy offline GPU/GLB boundary. CPU startup never decodes the scan. */
export async function loadScannedCoverLibrary(){const {loadEmbeddedScannedCoverArt}=await import('./scanned-cover-embedded.js');return loadEmbeddedScannedCoverArt();}
