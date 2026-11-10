import path from 'node:path';
import {fileURLToPath} from 'node:url';
const defaultDirectory=fileURLToPath(new URL('../assets/art-kit/',import.meta.url));
const runtime=fileURLToPath(new URL('../src/art-kit-payload.js',import.meta.url));
/** Only the known campaign GLB imports change packaging. Every consumer still
 * receives exactly its original Uint8Array; other GLBs use esbuild's binary loader.
 * The pool exists in memory, so a clean source package needs no generated asset. */
export function createArtPayloadPlugin({pool,recipes},{assetDirectory=defaultDirectory}={}){
 const files=new Map(Object.entries(recipes).map(([key,recipe])=>[path.resolve(assetDirectory,`${key}.glb`),recipe]));
 return {name:'lossless-campaign-art-png-pool',setup(build){
  build.onResolve({filter:/^campaign-art-payload:pool$/},()=>({path:'pool',namespace:'campaign-art-payload'}));
  build.onLoad({filter:/.*/,namespace:'campaign-art-payload'},()=>({contents:pool,loader:'binary'}));
  build.onLoad({filter:/\.glb$/},args=>{
   const recipe=files.get(args.path);if(!recipe)return;
   return {contents:`import pool from 'campaign-art-payload:pool';import {restoreArtGlb} from ${JSON.stringify(runtime)};export default restoreArtGlb(pool,${JSON.stringify(recipe)});`,loader:'js',resolveDir:assetDirectory,watchFiles:[args.path]};
  });
 }};
}
