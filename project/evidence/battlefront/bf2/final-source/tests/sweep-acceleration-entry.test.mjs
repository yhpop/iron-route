/** Build/source contracts only: no browser, FPS, or runtime layout claims. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=v=>createHash('sha256').update(v).digest('hex');
// BF2 authorizes a new optional main entry. BASE.json retains the old identity.
const originalMainSHA256='9d937baf1d64fcb3409d3e975e1cf836c221e900dea420fdd57741289867e6dc';
const frozenCandidateMainSHA256='2f9e5103d6ff46f3ec162e54137b12f118a912417b5aeeb5108ff43a8af02e73';
let api;
try { api=await import('../scripts/sweep-acceleration-plugin.mjs'); } catch(e) { if(e.code!=='ERR_MODULE_NOT_FOUND')throw e; }

test('resolver intercepts only exact ruined specifier from absolute actual main in file namespace',()=>{
 assert.equal(typeof api?.createSweepAccelerationPlugin,'function','scoped resolver must exist');
 const plugin=api.createSweepAccelerationPlugin({root});
 const hooks=[];plugin.setup({onResolve(options,callback){hooks.push({options,callback});}});
 assert.equal(hooks.length,1);const {options,callback}=hooks[0];assert.equal(options.namespace,'file');
 const main=path.join(root,'src/main.js'),target=path.join(root,'src/ruined-depot-world-accelerated.js');
 assert.equal(options.filter.test('./ruined-depot-world.js'),true);
 const invoke=(specifier,importer,namespace='file')=>options.filter.test(specifier)&&options.namespace===namespace?callback({path:specifier,importer,namespace}):undefined;
 assert.deepEqual(invoke('./ruined-depot-world.js',main),{path:target});
 for(const importer of [path.join(root,'src/other.js'),path.join(root,'src/terrain-candidate/main.js'),'src/main.js',main+'.copy','',path.join(root,'other/src/main.js')])assert.equal(invoke('./ruined-depot-world.js',importer),undefined,importer);
 for(const specifier of ['./campaign-world.js','./terrain-candidate/combat-world.js','./ruined-depot-world.js?test','../src/ruined-depot-world.js',target])assert.equal(invoke(specifier,main),undefined,specifier);
 assert.equal(invoke('./ruined-depot-world.js',main,'virtual-main'),undefined);
 // A second root is independent: no mutable global dispatch configuration.
 const second=[];api.createSweepAccelerationPlugin({root:path.join(root,'isolated')}).setup({onResolve(options,callback){second.push(callback);}});
 assert.equal(second[0]({path:'./ruined-depot-world.js',importer:main,namespace:'file'}),undefined);
 assert.deepEqual(invoke('./ruined-depot-world.js',main),{path:target});
});

test('actual CN and EN build metafiles prove main-only accelerated closure and retain original other worlds',async()=>{
 const baseline=JSON.parse(await readFile(path.join(root,'../BASE.json'),'utf8'));
 assert.equal(baseline.files['src/main.js'].sha256,originalMainSHA256,'old performance-task baseline remains recorded');
 const original=await readFile(path.join(root,'src/main.js'));assert.equal(hash(original),frozenCandidateMainSHA256);
 const mainText=original.toString();assert.match(mainText,/import \{createBattlefrontDepotFront\} from '\.\/battlefront-depot-front.js'/);
 assert.match(mainText,/slug==='battlefront-depot'\?battlefrontDepot.spec/);
 assert.match(mainText,/world=spec.ruinedDepot\?createRuinedDepotWorld\(spec,terrainFor\(spec\).field\)/);
 const {createBattlefrontDepotFront}=await import('../src/battlefront-depot-front.js');
 const candidate=createBattlefrontDepotFront();assert.equal(candidate.spec.id,'mission-9080');assert.equal(candidate.spec.ruinedDepot,true);
 for(const [script,directory] of [['build.mjs','dist'],['build-english.mjs','dist-en']]){
  const result=spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
  assert.equal(result.status,0,`${script}\n${result.stdout}\n${result.stderr}`);
  const manifest=JSON.parse(await readFile(path.join(root,directory,'build-manifest.json'),'utf8'));
  assert.equal(manifest.browserVerified,false);assert.equal(manifest.runtimeRequestsMeasured,false);
  assert.deepEqual(manifest.sweepAcceleration,{scope:'ruined-main-import-only',importer:'src/main.js',specifier:'./ruined-depot-world.js',resolved:'src/ruined-depot-world-accelerated.js'},'build must disclose exact accelerated dispatch');
  const meta=JSON.parse(await readFile(path.join(root,directory,'build-metafile.json'),'utf8'));
  const inputs=meta.inputs,imports=file=>inputs[file].imports.filter(i=>!i.external).map(i=>i.path);
  const main='src/main.js',ruin='src/ruined-depot-world-accelerated.js',terrain='src/terrain-candidate/combat-world-accelerated.js',world='src/campaign-world-accelerated.js',helper='src/collision-broadphase.js';
  for(const file of [main,ruin,terrain,world,helper,'src/terrain-candidate/combat-world.js','src/campaign-world.js'])assert.ok(inputs[file],`${script}: ${file}`);
  assert.ok(imports(main).includes('src/battlefront-depot-front.js'),'new optional mission enters same main-only accelerated world dispatch');
  assert.ok(imports(main).includes(ruin));assert.ok(!imports(main).includes('src/ruined-depot-world.js'));
  assert.ok(imports(ruin).includes(terrain));assert.ok(imports(terrain).includes(world));assert.ok(imports(world).includes(helper));
  const incoming=target=>Object.keys(inputs).filter(file=>imports(file).includes(target)).sort();
  assert.deepEqual(incoming(ruin),[main]);assert.deepEqual(incoming(terrain),[ruin]);assert.deepEqual(incoming(world),[terrain]);assert.deepEqual(incoming(helper),[world]);
  assert.ok(imports(main).includes('src/terrain-candidate/combat-world.js'));
  assert.ok(imports(main).includes('src/campaign-world.js'));
  assert.ok(imports('src/terrain-candidate/combat-world.js').includes('src/campaign-world.js'));
  assert.equal(inputs['src/ruined-depot-world.js'],undefined,'old adapter is not another route into ruined main');
  assert.equal(inputs['src/content/generated-records.js'],undefined,'archive protection stays intact');
  assert.ok(!Object.keys(inputs).some(p=>/strv103/i.test(p)),'isolated new tank remains unintegrated');
  const js=await readFile(path.join(root,directory,'game.js'),'utf8');assert.equal(hash(js),manifest.sha256);
  console.log(JSON.stringify({event:'BF2-build-terminal',script,directory,javascriptSHA256:manifest.sha256,javascriptBytes:manifest.javascriptBytes,mainSHA256:hash(original),newMissionId:candidate.spec.id,acceleratedResolution:manifest.sweepAcceleration}));
  if(directory==='dist-en'){
   const {englishInventory}=await import('../scripts/english-localization.mjs');
   for(const file of Object.keys(englishInventory))if(file!=='index.html')assert.ok(inputs[file],`original English inventory path: ${file}`);
   assert.doesNotMatch(js,/\p{Script=Han}/u);
  }
 }
 assert.deepEqual(await readFile(path.join(root,'src/main.js')),original,'builds never rewrite old main');
});
