/** Real build-output contracts only; these do not claim browser/gameplay acceptance. */
import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, cp, symlink, readFile, writeFile, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url));
const locales=[['CN','build.mjs','dist','铁流_电脑浏览器离线版.html'],['EN','build-english.mjs','dist-en','Iron_Route_Desktop_Offline.html']];
const noiseNotice='/**\n* Simplex and Perlin noise.\n*\n* Copied with small edits from https://github.com/josephg/noisejs which is\n* public domain. Originally by Stefan Gustavson (stegu@itn.liu.se) with\n* optimizations by Peter Eastman (peastman@drizzle.stanford.edu) and converted\n* to JavaScript by Joseph Gentle.\n*/\n';
const escapeHTML=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const unescapeHTML=text=>text.replaceAll('&#39;',"'").replaceAll('&quot;','"').replaceAll('&gt;','>').replaceAll('&lt;','<').replaceAll('&amp;','&');
let fixture,three,terrain,originalCredits;
function build(directory,script){execFileSync(process.execPath,[script],{cwd:directory,stdio:'pipe',maxBuffer:8*1024*1024});}
async function makeFixture(){
 const directory=await mkdtemp(path.join(tmpdir(),'iron-runtime-notices-'));
 for(const name of ['build.mjs','build-english.mjs','package.json','index.html','src','scripts','assets','licenses','locales'])await cp(path.join(root,name),path.join(directory,name),{recursive:true});
 await symlink(path.join(root,'node_modules'),path.join(directory,'node_modules'),'dir');
 return directory;
}
function inlineNotices(html){
 const section=html.match(/<details\b[^>]*\bid="third-party-notices"[^>]*>([\s\S]*?)<\/details>/);
 assert.ok(section,'full notices must be available in an expandable credits section');
 const pre=section[1].match(/<pre\b[^>]*>([\s\S]*?)<\/pre>/);
 assert.ok(pre,'notices are readable without running a script or fetching a file');
 assert.doesNotMatch(pre[1],/[<>]/,'license text cannot introduce HTML elements');
 return unescapeHTML(pre[1]);
}
function assertRequired(text){
 assert.ok(text.includes(three),'complete, exact Three MIT license including copyright, permission and disclaimer');
 assert.ok(text.includes(terrain),'complete, exact THREE.Terrain MIT license');
 assert.ok(text.includes(noiseNotice),'exact original noisejs public-domain header including credits');
}
async function hashes(directory){
 const result={};
 for(const name of (await readdir(directory)).sort())result[name]=createHash('sha256').update(await readFile(path.join(directory,name))).digest('hex');
 return result;
}
before(async()=>{
 three=await readFile(path.join(root,'licenses/THREE_LICENSE.txt'),'utf8');
 terrain=await readFile(path.join(root,'src/terrain-candidate/vendor/three-terrain/LICENSE.txt'),'utf8');
 assert.equal(three,await readFile(path.join(root,'node_modules/three/LICENSE'),'utf8'));
 assert.ok((await readFile(path.join(root,'src/terrain-candidate/vendor/three-terrain/noise.js'),'utf8')).startsWith(noiseNotice));
 originalCredits=(await readFile(path.join(root,'index.html'),'utf8')).match(/<details id="asset-credits"[^>]*>([\s\S]*?)<\/details>/)[1];
 fixture=await makeFixture();
 for(const [,script]of locales)build(fixture,script);
});
after(async()=>{if(fixture)await rm(fixture,{recursive:true,force:true});});

for(const [locale,script,folder,offline]of locales){
 test(`${locale} webpage distributes the full runtime notices and exposes them from the existing credits`,async()=>{
  const out=path.join(fixture,folder),html=await readFile(path.join(out,'index.html'),'utf8');
  const notices=await readFile(path.join(out,'THIRD_PARTY_NOTICES.txt'),'utf8').catch(()=>null);
  assert.ok(notices,'web distribution must include THIRD_PARTY_NOTICES.txt');
  assertRequired(notices);
  assert.equal(inlineNotices(html),notices);
  assert.match(html,/<a\b[^>]*href="\.\/THIRD_PARTY_NOTICES\.txt"[^>]*>/,'credits provide a working local text download');
  assert.ok(html.indexOf('id="third-party-notices"')>html.indexOf('id="asset-credits"'));
  assert.ok(html.slice(html.indexOf('id="third-party-notices"')).endsWith('</details></details></body></html>\n'));
 });
 test(`${locale} standalone HTML embeds exact full licenses and has no external legal-file dependency`,async()=>{
  const out=path.join(fixture,folder),html=await readFile(path.join(out,offline),'utf8');
  // This assertion catches the original defect independently of the new generated file.
  assert.ok(html.includes(escapeHTML(three)),'standalone HTML lacks full Three MIT terms');
  assert.ok(html.includes(escapeHTML(terrain)),'standalone HTML lacks full THREE.Terrain MIT terms');
  const notices=await readFile(path.join(out,'THIRD_PARTY_NOTICES.txt'),'utf8');
  assert.equal(inlineNotices(html),notices);assertRequired(inlineNotices(html));
  assert.doesNotMatch(html,/For license information please see [^\r\n]*\.txt/,'no dangling esbuild license pointer');
  assert.doesNotMatch(html,/<(?:script|link)\b[^>]*(?:src|href)="(?:\.\/|https?:)/i,'standalone has no external script or stylesheet');
  assert.doesNotMatch(html,/<a\b[^>]*href="\.\/[^\"]*\.txt"/i,'offline license access needs no sibling text file');
 });
 test(`${locale} both formats preserve every existing asset attribution and executable payload`,async()=>{
  const out=path.join(fixture,folder),js=await readFile(path.join(out,'game.js'),'utf8');
  assert.match(js,/SPDX-License-Identifier: MIT/,'original bundled license comments remain');
  const css=await readFile(path.join(root,'src/style.css'),'utf8');
  assert.equal(await readFile(path.join(out,'style.css'),'utf8'),css);
  for(const file of ['index.html',offline]){
   const html=await readFile(path.join(out,file),'utf8');
   assert.ok(html.includes(originalCredits),'Fox/LFA and all other prior source/license/modification notices are verbatim');
   if(file===offline){assert.ok(html.includes(js.replace(/<\/script/gi,'<\\/script')));assert.ok(html.includes('<style>'+css+'</style>'));}
  }
  const meta=JSON.parse(await readFile(path.join(out,'build-metafile.json'),'utf8'));
  assert.ok(meta.inputs['src/terrain-candidate/vendor/three-terrain/noise.js'],'noise really is in the runtime closure');
  assert.deepEqual(JSON.parse(await readFile(path.join(out,'build-manifest.json'),'utf8')).externalRuntimeDependencies,[]);
 });
 test(`${locale} rebuilding produces byte-identical distribution artifacts`,async()=>{
  const out=path.join(fixture,folder),before=await hashes(out);build(fixture,script);assert.deepEqual(await hashes(out),before);
 });
}
test('CN and EN distribute the same full notice text',async()=>{
 const cn=await readFile(path.join(fixture,'dist/THIRD_PARTY_NOTICES.txt'),'utf8').catch(()=>null);
 const en=await readFile(path.join(fixture,'dist-en/THIRD_PARTY_NOTICES.txt'),'utf8').catch(()=>null);
 assert.ok(cn&&en,'both notice files must exist');assert.equal(cn,en);
});
test('real builds safely embed hostile HTML/script endings and replacement tokens from license input',async()=>{
 const hostile='\n</pre></details></script><script id="license-injection">throw new Error("injected")</script> & <tag> "quote" \'apostrophe\' $& $$ $` $\'\n';
 const directory=await makeFixture();
 try{
  const filename=path.join(directory,'src/terrain-candidate/vendor/three-terrain/LICENSE.txt');await writeFile(filename,terrain+hostile);
  for(const [,script,folder,offline]of locales){
   build(directory,script);
   const notices=await readFile(path.join(directory,folder,'THIRD_PARTY_NOTICES.txt'),'utf8').catch(()=>null);
   assert.ok(notices,'build must distribute the source license text');assert.ok(notices.includes(hostile));
   for(const name of ['index.html',offline]){
    const html=await readFile(path.join(directory,folder,name),'utf8');
    assert.equal(inlineNotices(html),notices);assert.ok(html.includes(escapeHTML(hostile)));
    assert.doesNotMatch(html,/<script id="license-injection">/,'license text must not become executable markup');
   }
  }
 }finally{await rm(directory,{recursive:true,force:true});}
});
