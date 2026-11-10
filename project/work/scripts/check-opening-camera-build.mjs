import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const work=path.resolve(process.argv[2]??'.'),hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(hash(path.join(work,'src/main.js')),'e44c52431a2936167e7d152e724e1563d5035681bb500b4638bab98abf1a7315');
const reports=[];
for(const folder of ['dist','dist-en']){
 const m=JSON.parse(fs.readFileSync(path.join(work,folder,'build-manifest.json'))),meta=JSON.parse(fs.readFileSync(path.join(work,folder,'build-metafile.json')));assert.equal(hash(path.join(work,folder,'game.js')),m.sha256);
 const inputs=meta.inputs,imports=p=>inputs[p].imports.filter(i=>!i.external).map(i=>i.path);
 for(const p of ['src/eight-npc-crossfire-front.js','src/team-roof-mark.js','src/fielddesk-presentation.js','src/combat-feedback.js','src/ruined-depot-world-accelerated.js','src/terrain-candidate/combat-world-accelerated.js','src/campaign-world-accelerated.js','src/collision-broadphase.js'])assert.ok(inputs[p],p);
 assert.ok(imports('src/main.js').includes('src/eight-npc-crossfire-front.js'));
 assert.ok(imports('src/main.js').includes('src/opening-combat-camera.js'));
 assert.deepEqual(imports('src/opening-combat-camera.js'),[]);
 assert.ok(imports('src/authored-scene-view.js').includes('src/team-roof-mark.js'));
 const js=fs.readFileSync(path.join(work,folder,'game.js'),'utf8'); assert.ok(js.includes('team-roof-mark:')); assert.ok(js.includes('fielddesk-roster')); assert.ok(js.includes('mission-9102'));
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
