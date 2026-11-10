import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import {build} from 'esbuild';
import {prepareArtPayload} from '../scripts/prepare-art-payload.mjs';
import * as pluginModule from '../scripts/art-payload-plugin.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const captureLoader={name:'capture-loader-boundary',setup(build){build.onLoad({filter:/\/src\/art-kit\.js$/},()=>({contents:'export async function loadCampaignArt(data){return data;}',loader:'js'}));}};
async function embedded(plugins){return build({absWorkingDir:root,entryPoints:['src/art-kit-embedded.js'],bundle:true,write:false,format:'iife',globalName:'ShippingArt',target:['es2020'],loader:{'.glb':'binary'},minify:true,metafile:true,plugins:[...plugins,captureLoader]});}
test('the unchanged shipping embedded module sends exact restored GLBs to its existing loader API',async()=>{
 assert.equal(typeof pluginModule.createArtPayloadPlugin,'function');
 const payload=await prepareArtPayload(),before=await embedded([]),after=await embedded([pluginModule.createArtPayloadPlugin(payload)]);
 assert.ok(before.outputFiles[0].contents.length-after.outputFiles[0].contents.length>8100000,'real emitted byte reduction, not unused asset census');
 const inputNames=Object.keys(after.metafile.inputs);
 assert.equal(inputNames.filter(name=>name.startsWith('campaign-art-payload:')).length,1,'pool embedded once');
 assert.deepEqual(inputNames.filter(name=>/^assets\/art-kit\/[^/]+\.glb$/.test(name)).map(name=>path.basename(name,'.glb')).sort(),Object.keys(payload.recipes));
 const context=vm.createContext({Uint8Array,ArrayBuffer,atob:value=>Buffer.from(value,'base64').toString('binary')});
 new vm.Script(after.outputFiles[0].text).runInContext(context,{displayErrors:false});
 const received=await context.ShippingArt.loadEmbeddedCampaignArt();
 for(const [key,bytes]of Object.entries(received))assert.deepEqual(Buffer.from(bytes),readFileSync(path.join(root,'assets/art-kit',`${key}.glb`)),key);
 const again=await context.ShippingArt.loadEmbeddedCampaignArt();for(const key of Object.keys(received))assert.equal(again[key],received[key],'existing embedded bytes lifetime retained');
});
test('the payload plugin does not intercept other GLBs or require generated files',async()=>{
 assert.equal(typeof pluginModule.createArtPayloadPlugin,'function');
 const payload=await prepareArtPayload(),result=await build({absWorkingDir:root,stdin:{contents:"import tank from './assets/tank_v5_articulated.glb';globalThis.tank=tank;",resolveDir:root},bundle:true,write:false,format:'iife',target:['es2020'],loader:{'.glb':'binary'},metafile:true,plugins:[pluginModule.createArtPayloadPlugin(payload)]});
 const context=vm.createContext({Uint8Array,ArrayBuffer,atob:value=>Buffer.from(value,'base64').toString('binary')});new vm.Script(result.outputFiles[0].text).runInContext(context,{displayErrors:false});
 assert.deepEqual(Buffer.from(context.tank),readFileSync(path.join(root,'assets/tank_v5_articulated.glb')));
 assert.equal(Object.keys(result.metafile.inputs).some(name=>name.startsWith('campaign-art-payload:')),false);
});
