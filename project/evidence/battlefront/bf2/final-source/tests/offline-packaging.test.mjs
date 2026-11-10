import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
for (const file of ['build.mjs','build-english.mjs']) {
 test(`${file} preserves replacement tokens in embedded CSS and JavaScript`,()=>{
  const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const line=source.split('\n').find(l=>l.includes('Offline.html')||l.includes('离线版.html'));
  const expr=line.slice(line.indexOf(',html')+1,-2);
  const html='<link rel="stylesheet" href="./style.css"><script type="module" src="./game.js"></script>';
  const css='/* $& $$ $` $\' */';
  const js='console.log("$& $$ $` $\'");';
  const result=runInNewContext(expr,{html,css,js});
  assert.equal(result,'<style>'+css+'</style><script type="module">'+js+'</script>');
 });
}
