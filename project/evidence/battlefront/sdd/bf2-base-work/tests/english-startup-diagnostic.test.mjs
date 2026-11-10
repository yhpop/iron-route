import test from 'node:test';
import assert from 'node:assert/strict';
import {bootEnglish} from './english-test-modules.mjs';
import {makeStorage} from './main-entry-harness.mjs';
const cases=[
 ['rendererError','webgl','THREE.WebGLRenderer: Error creating WebGL context.','This environment could not start 3D graphics'],
 ['artError','assets','Art download failed','Game assets could not load'],
 ['tankError','assets','Tank model failed','Game assets could not load'],
 ['rendererSetupError','startup','THREE.WebGLRenderer: Error creating WebGL context.','The game could not start']
];
for(const [boundary,kind,message,title] of cases)test(`English startup diagnostic preserves ${boundary} boundary and saved progress`,async()=>{
 const storage=makeStorage(),before=[...storage.values];
 const app=await bootEnglish('',storage,{[boundary]:new Error(message),expectBootFailure:true});
 assert.equal(app.help.getAttribute('data-startup-failure'),kind);
 assert.equal(app.help.getAttribute('role'),'alert');
 assert.equal(app.help.querySelector('h1').textContent,title);
 assert.equal(app.help.querySelector('summary').textContent,'Technical details');
 assert.equal(app.help.querySelector('pre').textContent,message);
 assert.ok(!app.help.querySelector('details').open);
 assert.doesNotMatch(app.help.querySelector('p').textContent,/\p{Script=Han}/u);
 assert.deepEqual([...storage.values],before);assert.equal(storage.writes.length,0);
 assert.equal(app.metrics.reloads,0);assert.equal(app.metrics.timers,0);assert.equal(app.metrics.networkRequests,0);
 app.dispose();
});
