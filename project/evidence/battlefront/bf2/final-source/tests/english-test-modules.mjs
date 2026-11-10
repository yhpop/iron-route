/** Real English production modules built with shipping plugin; fake browser boundaries stay explicit. */
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import * as Three from 'three';
import {campaignRoot,createEnglishLocalizationPlugin,prepareEnglishSource} from '../scripts/english-localization.mjs';
import {boot} from './main-entry-harness.mjs';
const require=createRequire(import.meta.url),mainSource=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
const excluded=['./ruined-depot-loader.js','./ruined-depot-embedded.js','./scanned-cover-loader.js','./tank-view.js','./targeting-view.js','./campaign-view.js','./tank-audio.js','./art-kit-embedded.js','./interceptor-art-loader.js','./player-model-loader.js'];
const paths=[...mainSource.matchAll(/^import .+? from ['"](.+?)['"];$/gm)].map(match=>match[1]).filter(path=>path.startsWith('./')&&!excluded.includes(path));
const result=await build({stdin:{contents:paths.map((path,i)=>`import * as m${i} from './src/${path.slice(2)}';`).join('\n')+`\nexport const modules={${paths.map((path,i)=>`${JSON.stringify(path)}:m${i}`).join(',')}};`,resolveDir:campaignRoot},bundle:true,format:'cjs',platform:'node',packages:'external',write:false,plugins:[createEnglishLocalizationPlugin()]});
const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(name=>name==='three'?Three:require(name),module,module.exports);
// GPU/GLB boundary only; all English UI, navigation, saves and simulation remain real.
export const englishModules={...module.exports.modules,'./ruined-depot-loader.js':{loadRuinedDepotLibrary:async()=>({clone:()=>new Three.Group(),dispose(){}})},'./scanned-cover-loader.js':{loadScannedCoverLibrary:async()=>({clone:()=>new Three.Group(),dispose(){}})},'./player-model-loader.js':{loadPlayerModel:async()=>({root:{visible:true},update(){},dispose(){}})},'./interceptor-art-loader.js':{attachInterceptorArt:async base=>({...base,diagnostics:{communityVehicles:1}})}};
export const englishMainSource=prepareEnglishSource('src/main.js',mainSource);
export function bootEnglish(search='',storage,options={}){return boot(search,storage,{...options,mainSource:englishMainSource,loadModule:path=>englishModules[path]});}
