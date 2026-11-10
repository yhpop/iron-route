// Exact pause-clock + contact-recovery successor and actual offline bundles; not device acceptance.
import {prepareEnglishSource} from './english-localization.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const work=path.resolve(process.argv[2]??'.'),hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const approvedSources={
  "src/main.js": "9f8c76cf51432f6e040aebe8d19979a32bca220bac6cd8a8ad4186c1204c48b0",
  "src/tank-controller.js": "2cb8051f98e4a3dbe1010c21ecbd04ff94b6a858c7b19479437a8084f4fab76b",
  "src/campaign-ui.js": "a2e353004e9791c818a3c359dd78013e79e568d4bac5d7644c7910391ffb378d",
  "src/battlefield-guidance.js": "1a672bdfd3170972f5705f009a844e394b089d22f9d7353655f99a43087597d2",
  "src/combat-hud-layout.js": "1e9a52f5eb672a1af2ea9b10015994cd168c73d15b21f088e87d84fa0c276467",
  "src/style.css": "1bee1c48b03835f86402031b035ed23fb064835c9e19465651d4bffe7c445ea8",
  "locales/en-ui.json": "8420631ae06f416977a8014957505e034e2035888fe0ae1af20511a6b2fb653d",
  "src/eight-npc-crossfire-front.js": "5b96d98c378222e28cfaee642e3c6b7a651ba326f5023e85751b2e56cecf796c"
};
for(const [name,sha] of Object.entries(approvedSources))assert.equal(hash(path.join(work,name)),sha,name+' approved final source');
const reports=[];
for(const folder of ['dist','dist-en']){
 const m=JSON.parse(fs.readFileSync(path.join(work,folder,'build-manifest.json'))),meta=JSON.parse(fs.readFileSync(path.join(work,folder,'build-metafile.json')));assert.equal(hash(path.join(work,folder,'game.js')),m.sha256);
 for(const p of ['src/main.js','src/tank-controller.js','src/campaign-ui.js','src/battlefield-guidance.js']){const source=fs.readFileSync(path.join(work,p),'utf8'),compiled=folder==='dist-en'?prepareEnglishSource(p,source):source;assert.equal(meta.inputs[p].bytes,Buffer.byteLength(compiled),folder+' current compiled source size '+p);}
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
 assert.ok(js.replace(/\\u([0-9a-f]{4})/gi,(_,h)=>String.fromCharCode(parseInt(h,16))).includes(folder==='dist-en'?'Gun still terrain-blocked:':'炮管仍受地形限制'),folder+' honest still-blocked guidance');
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
