// Exact approved successor and actual offline bundles; not device acceptance.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const work=path.resolve(process.argv[2]??'.'),hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const approvedSources={
  "src/main.js": "97e05f02a26e9b1f63ada2d9dfecb9e024b4a6f79cad2ced444d3322d49d417a",
  "src/tank-controller.js": "1dfb0bf111a64f09c47f5e03bf35ff4fa27ac7fe5e8f5c72015d5f129a275e04",
  "src/campaign-ui.js": "a9089a49e7c9167969f8ceb2e7c1e8115da511dd3cfe51b40bfdc16de60d3f3c",
  "src/battlefield-guidance.js": "02f536b3c694112496b6423346c4bbf11f81635574f2836c44a8cb0c821e5fd9",
  "src/combat-hud-layout.js": "1e9a52f5eb672a1af2ea9b10015994cd168c73d15b21f088e87d84fa0c276467",
  "src/style.css": "1bee1c48b03835f86402031b035ed23fb064835c9e19465651d4bffe7c445ea8",
  "locales/en-ui.json": "0e6ea5fdd7ed0a1825e6c4e6fe0fd31afa9f47318209662c61eaa3bd67029834",
  "src/eight-npc-crossfire-front.js": "5b96d98c378222e28cfaee642e3c6b7a651ba326f5023e85751b2e56cecf796c"
};
for(const [name,sha] of Object.entries(approvedSources))assert.equal(hash(path.join(work,name)),sha,name+' approved final source');
const reports=[];
for(const folder of ['dist','dist-en']){
 const m=JSON.parse(fs.readFileSync(path.join(work,folder,'build-manifest.json'))),meta=JSON.parse(fs.readFileSync(path.join(work,folder,'build-metafile.json')));assert.equal(hash(path.join(work,folder,'game.js')),m.sha256);
 const inputs=meta.inputs,imports=p=>inputs[p].imports.filter(i=>!i.external).map(i=>i.path);
 for(const p of ['src/eight-npc-crossfire-front.js','src/team-roof-mark.js','src/fielddesk-presentation.js','src/combat-feedback.js','src/ruined-depot-world-accelerated.js','src/terrain-candidate/combat-world-accelerated.js','src/campaign-world-accelerated.js','src/collision-broadphase.js'])assert.ok(inputs[p],p);
 assert.ok(imports('src/main.js').includes('src/eight-npc-crossfire-front.js'));
 assert.ok(imports('src/main.js').includes('src/opening-combat-camera.js'));
 assert.ok(imports('src/main.js').includes('src/combat-hud-layout.js'));
 assert.ok(imports('src/campaign-ui.js').includes('src/combat-hud-layout.js'));
 assert.deepEqual(imports('src/opening-combat-camera.js'),[]);
 assert.ok(imports('src/authored-scene-view.js').includes('src/team-roof-mark.js'));
 const js=fs.readFileSync(path.join(work,folder,'game.js'),'utf8'); assert.ok(js.includes('team-roof-mark:')); assert.ok(js.includes('fielddesk-roster')); assert.ok(js.includes('mission-9102'));
 for(const marker of ['terrainTravelElevation','terrainTravelClearance','data-layout-reason','data-layout-overlap','campaign-escort-tactics'])assert.ok(js.includes(marker),folder+' final runtime marker '+marker);
 assert.match(js,/\("allied-north","allied",10,30,2,16\)/);
 assert.match(js,/\("allied-far-east","allied",30,8,23,16\)/);
 assert.equal(fs.readFileSync(path.join(work,folder,'style.css'),'utf8'),fs.readFileSync(path.join(work,'src/style.css'),'utf8'));
 const html=fs.readFileSync(path.join(work,folder,folder==='dist'?'铁流_电脑浏览器离线版.html':'Iron_Route_Desktop_Offline.html'),'utf8'); assert.ok(html.includes(js.replace(/<\/script/gi,'<\\/script')));

 assert.ok(imports('src/main.js').includes('src/ruined-depot-world-accelerated.js'));
 const incoming=t=>Object.keys(inputs).filter(p=>imports(p).includes(t)).sort();
 assert.deepEqual(incoming('src/ruined-depot-world-accelerated.js'),['src/main.js']);
 assert.deepEqual(incoming('src/terrain-candidate/combat-world-accelerated.js'),['src/ruined-depot-world-accelerated.js']);
 assert.deepEqual(incoming('src/campaign-world-accelerated.js'),['src/terrain-candidate/combat-world-accelerated.js']);
 assert.deepEqual(incoming('src/collision-broadphase.js'),['src/campaign-world-accelerated.js']);
 assert.equal(inputs['src/content/generated-records.js'],undefined);
 assert.equal(m.browserVerified,false);assert.equal(m.runtimeRequestsMeasured,false);
 if(folder==='dist-en')assert.doesNotMatch(fs.readFileSync(path.join(work,folder,'game.js'),'utf8'),/\p{Script=Han}/u);
 reports.push({folder,sha256:m.sha256,openingCameraInActualMainClosure:true,latestMissionInActualMainClosure:true,fielddeskAndHitFeedbackBundled:true,garageShelfAndPhysicalTeamMarkBundled:true,offlineEmbedsActualJavaScriptAndCSS:true,mainOnlyAcceleration:true,browserVerified:false});
}
console.log(JSON.stringify(reports,null,2));
