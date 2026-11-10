import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,makeStorage} from './main-entry-harness.mjs';

// Boundary tests of the actual main body and real diagnostic DOM helper.
// WebGL, GLB and browser APIs are controlled by the existing Node VM harness;
// these assertions are NOT browser/device/WebGL-success acceptance.
function assertPassiveFailure(app,storage,before){
 assert.equal(app.latest,undefined);
 assert.equal(app.metrics.worldCreates,0);
 assert.equal(app.metrics.framesScheduled||0,0);
 assert.equal(app.metrics.networkRequests,0);
 assert.equal(app.metrics.reloads,0);
 assert.equal(app.metrics.timers,0);
 assert.equal(storage.writes.length,0);
 assert.deepEqual([...storage.values],before);
}
function assertDiagnostic(app,kind,raw){
 assert.equal(app.help.hidden,false);
 assert.equal(app.help.getAttribute('data-startup-failure'),kind);
 assert.equal(app.help.getAttribute('role'),'alert');
 assert.equal(app.help.getAttribute('aria-live'),'assertive');
 assert.equal(app.help.getAttribute('aria-atomic'),'true');
 const title=app.help.querySelector('h1');
 assert.ok(title.textContent.length>0);
 assert.equal(app.help.getAttribute('aria-labelledby'),title.getAttribute('id'));
 const paragraph=app.help.querySelector('p');
 assert.ok(paragraph.textContent.length>20,'human-readable next steps, not only a title');
 assert.notEqual(paragraph.textContent,raw,'raw technical errors are not the primary instruction');
 const details=app.help.querySelector('details');
 assert.ok(details,'technical details remain available');
 assert.ok(!details.open,'technical details start collapsed');
 assert.ok(details.querySelector('summary').textContent.length>0);
 assert.equal(details.querySelector('pre').textContent,raw);
 assert.equal(app.errors.length,1,'original error is retained in the console');
}

test('actual main explains a WebGL context creation failure before loading assets or touching progress',async()=>{
 const storage=makeStorage(),before=[...storage.values];
 const raw='THREE.WebGLRenderer: Error creating WebGL context.';
 const app=await boot('',storage,{rendererError:new Error(raw),expectBootFailure:true});
 assertDiagnostic(app,'webgl',raw);
 assert.match(app.help.querySelector('p').textContent,/WebGL/);
 assert.equal(app.metrics.artLoads||0,0);
 assert.equal(app.metrics.tankLoads||0,0);
 assert.equal(storage.reads.length,0);
 assertPassiveFailure(app,storage,before);
});

for(const phase of ['art','tank'])test(`actual main distinguishes ${phase} asset failure from unavailable WebGL without a primitive fallback`,async()=>{
 const storage=makeStorage(),before=[...storage.values];
 // A resource's message alone must not misclassify it as renderer creation.
 const raw=`${phase}: THREE.WebGLRenderer: Error creating WebGL context. <img src=x onerror=alert(1)>`;
 const app=await boot('',storage,{[`${phase}Error`]:new Error(raw),expectBootFailure:true});
 assertDiagnostic(app,'assets',raw);
 assert.equal(app.help.querySelector('img'),null,'technical details are text, never injected HTML');
 assert.equal(app.metrics.rendererDisposes,1);
 assert.equal(app.metrics.artDisposes||0,phase==='tank'?1:0);
 assertPassiveFailure(app,storage,before);
});

test('unclassified renderer exceptions do not claim that WebGL is unavailable',async()=>{
 const storage=makeStorage(),before=[...storage.values],raw='Unexpected renderer configuration error';
 const app=await boot('',storage,{rendererError:new Error(raw),expectBootFailure:true});
 assertDiagnostic(app,'startup',raw);
 assertPassiveFailure(app,storage,before);
});

for(const phase of ['art','tank'])test(`late ${phase} rejection after permanent pagehide cannot reopen diagnostic UI or write saves`,async()=>{
 let reject;const gate=new Promise((resolve,fail)=>{reject=fail;});
 const storage=makeStorage(),before=[...storage.values];
 const app=await boot('',storage,{[`${phase}Ready`]:gate,expectBootFailure:true});
 const beforeChildren=[...app.help.children],beforeAttributes={...app.help.attributes};
 app.dispose();reject(new Error('late asset failure'));
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(app.help.children,beforeChildren);
 assert.deepEqual(app.help.attributes,beforeAttributes);
 assert.equal(app.errors.length,0);
 assert.equal(app.metrics.rendererDisposes,1);
 assertPassiveFailure(app,storage,before);
});

// Review regression: removing the constructor-phase reset must misclassify this.
test('a later renderer setup exception does not turn matching error text into a context-creation diagnosis',async()=>{
 const storage=makeStorage(),before=[...storage.values];
 const raw='THREE.WebGLRenderer: Error creating WebGL context.';
 const app=await boot('',storage,{rendererSetupError:new Error(raw),expectBootFailure:true});
 assertDiagnostic(app,'startup',raw);
 assert.equal(app.metrics.artLoads||0,0);
 assertPassiveFailure(app,storage,before);
});
