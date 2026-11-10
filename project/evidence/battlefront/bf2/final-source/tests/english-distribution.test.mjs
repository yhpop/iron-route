import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let api;
try { api=await import('../scripts/english-localization.mjs'); } catch(error) { if(error.code!=='ERR_MODULE_NOT_FOUND')throw error; }
const root=new URL('../',import.meta.url);
test('dedicated English localization translates entry document and leaves Chinese source intact',async()=>{
 assert.equal(typeof api?.translateEnglishSource,'function');
 const source=await readFile(new URL('index.html',root),'utf8'),translated=api.translateEnglishSource('index.html',source);
 assert.match(translated,/<html lang="en">/);assert.match(translated,/<title>Iron Route/);assert.doesNotMatch(translated,/\p{Script=Han}/u);
 assert.equal(await readFile(new URL('index.html',root),'utf8'),source);
});
test('exact localization inventory guards reject missing and duplicate matches',()=>{
 assert.equal(typeof api?.applyEnglishEntries,'function');const entries=[{source:"'暂停'",target:"'Pause'",occurrences:1}];
 assert.equal(api.applyEnglishEntries('sample.js',"const title='暂停';",entries),"const title='Pause';");
 assert.throws(()=>api.applyEnglishEntries('sample.js',"const title='继续';",entries),/expected 1.*found 0/);
 assert.throws(()=>api.applyEnglishEntries('sample.js',"['暂停','暂停']",entries),/expected 1.*found 2/);
});
test('English entry harness really uses localized production UI modules',async()=>{
 const {bootEnglish}=await import('./english-test-modules.mjs'),app=await bootEnglish();try{assert.equal(app.mount.querySelector('[data-action="start"]').textContent,'Start Mission');}finally{app.dispose();}
});
