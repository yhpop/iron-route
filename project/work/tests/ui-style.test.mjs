import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('touch layout includes safe areas, portrait/landscape adaptation and no browser gesture takeover',async()=>{
 const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8').catch(()=> '');
 assert.match(css,/safe-area-inset-bottom/); assert.match(css,/safe-area-inset-left/); assert.match(css,/orientation:\s*landscape/); assert.match(css,/orientation:\s*portrait/); assert.match(css,/touch-action:\s*none/); assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/\[hidden\][^{]*\{[^}]*display:\s*none\s*!important/);
});
