/** Reconstructed English-only build transformation. No DOM rewriting or source mutation. */
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const campaignRoot=fileURLToPath(new URL('../',import.meta.url));
const readInventory=file=>JSON.parse(readFileSync(new URL(`../locales/${file}`,import.meta.url),'utf8'));
export const englishInventory=Object.freeze({...readInventory('en-ui.json'),...readInventory('en-missions.json')});
const han=/\p{Script=Han}/u;
export function applyEnglishEntries(filename,source,entries){
 let result=source;
 for(const entry of entries){
  if(!entry||typeof entry.source!=='string'||!entry.source||typeof entry.target!=='string'||!Number.isInteger(entry.occurrences)||entry.occurrences<1||entry.source===entry.target)throw new Error(`Invalid English inventory entry in ${filename}`);
  const chunks=result.split(entry.source),count=chunks.length-1;
  if(count!==entry.occurrences)throw new Error(`English inventory drift in ${filename}: expected ${entry.occurrences}, found ${count} for ${JSON.stringify(entry.source)}`);
  result=chunks.join(entry.target);
 }
 return result;
}
export function translateEnglishSource(filename,source){
 const entries=englishInventory[filename],result=entries?applyEnglishEntries(filename,source,entries):source;
 if(han.test(result))throw new Error(`Unreviewed Chinese text remains in English source: ${filename}`);
 return result;
}
export function prepareEnglishSource(filename,source){
 const translated=translateEnglishSource(filename,source);
 if(filename!=='src/main.js')return translated;
 // Only English public menu excludes legacy experiments. Direct old URLs still work.
 return applyEnglishEntries(filename,translated,[{source:'ui=createUI({missions,optionalMissions,',target:'ui=createUI({missions,optionalMissions:[],',occurrences:1}]);
}
export function createEnglishLocalizationPlugin({root=campaignRoot}={}){
 const sourceRoot=path.resolve(root,'src')+path.sep;
 return {name:'iron-route-english-distribution',setup(build){build.onLoad({filter:/\.js$/,namespace:'file'},async args=>{
  if(!args.path.startsWith(sourceRoot))return;
  const relative=path.relative(root,args.path).split(path.sep).join('/');
  return {contents:prepareEnglishSource(relative,await readFile(args.path,'utf8')),loader:'js',resolveDir:path.dirname(args.path)};
 });}};
}
