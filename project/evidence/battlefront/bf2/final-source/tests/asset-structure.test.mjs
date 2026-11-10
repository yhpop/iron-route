import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const asset=path.join(root,'assets/tank_v5_articulated.glb');
function glb(file){const b=fs.readFileSync(file);assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(4),2);assert.equal(b.readUInt32LE(8),b.length);return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());}
function triangles(g,node){let n=g.nodes[node];return (n.mesh===undefined?0:g.meshes[n.mesh].primitives.reduce((s,p)=>s+g.accessors[p.indices??p.attributes.POSITION].count/3,0))+(n.children??[]).reduce((s,i)=>s+triangles(g,i),0);}

test('standalone derivative exists and is a complete glTF binary',()=>{assert.ok(fs.existsSync(asset));assert.ok(glb(asset).nodes.length>100);});
test('derivative separates original links, complete wheels, anchored mantlet and recoiling tube',()=>{
 assert.ok(fs.existsSync(asset),'derivative is missing');const g=glb(asset), by=(name)=>{const i=g.nodes.findIndex(n=>n.name===name);assert.ok(i>=0,name);return i;};
 assert.equal(triangles(g,by('TankRoot')),49748);
 assert.equal(triangles(g,by('Chassis_Geometry')),10480);
 assert.equal(triangles(g,by('Turret_Geometry')),4732);
 assert.equal(triangles(g,by('Mantlet_Geometry')),76);
 assert.equal(triangles(g,by('Barrel_Geometry')),764);
 for(const side of ['L','R']){
  for(let i=0;i<56;i++)assert.equal(triangles(g,by(`Track_${side}_${String(i).padStart(2,'0')}`)),148);
  for(let i=0;i<6;i++)assert.equal(triangles(g,by(`Wheel_${side}_${i}`)),1300);
  for(let i=0;i<2;i++)assert.equal(triangles(g,by(`Guide_${side}_${i}`)),380);
 }
 assert.ok(g.nodes[by('TurretPivot')].children.includes(by('GunElevationPivot')));
 assert.ok(g.nodes[by('GunElevationPivot')].children.includes(by('Mantlet_Geometry')));
 assert.ok(g.nodes[by('GunElevationPivot')].children.includes(by('RecoilPivot')));
 assert.ok(g.nodes[by('RecoilPivot')].children.includes(by('Barrel_Geometry')));
 assert.equal(g.images.length,2);assert.ok(g.images.every(i=>i.bufferView!==undefined&&!i.uri),'textures must be embedded for offline loading');
 assert.equal(g.materials.length,7);assert.equal(g.animations?.length??0,0);
});

test('reproducible metadata identifies this exact derivative and all 621 preserved source parts',()=>{
 const metadata=JSON.parse(fs.readFileSync(path.join(root,'assets/tank_v5_articulated.asset.json'),'utf8'));
 const binary=fs.readFileSync(asset),hash=createHash('sha256').update(binary).digest('hex');
 assert.equal(metadata.sha256,hash);assert.equal(metadata.bytes,binary.length);
 const parts=metadata.groups.flatMap(g=>g.sources);assert.equal(parts.length,621);assert.equal(new Set(parts).size,621);
 const fixed=metadata.groups.find(g=>g.name==='Chassis_Geometry').sources;
 assert.ok(fixed.every(n=>! /^(Tread link |Track \/ |Road wheel |Steel road wheel hub|Wheel axle cap|Wheel hub fastener|End idler sprocket)/.test(n)));
 const report=JSON.parse(fs.readFileSync(path.join(root,'assets/geometry-validation.json'),'utf8'));
 assert.equal(report.assetSha256,hash);assert.equal(report.passed,true);assert.equal(report.originalPaintUvIdentity,true);
 assert.ok(Math.max(...Object.values(report.maxNeutralVertexErrorRawByMaterial))<1e-6);
 assert.ok(report.maxCanonicalTrackErrorRaw<1e-5);assert.ok(report.maxCanonicalWheelGuideErrorRaw<1e-5);
 const g=glb(asset);assert.deepEqual(g.materials.map(m=>m.name).sort(),['Tank_V5_Baked_Paint','Tank_V5_wheel_tire_rubber','Tank_V5_oiled_steel','Tank_V5_exposed_armor_edge','Tank_V5_optical_glass','Tank_V5_scorched_interior','Tank_V5_weathered_equipment_canvas'].sort());
});
