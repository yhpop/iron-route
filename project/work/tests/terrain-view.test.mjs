import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildRoadNetwork, createTerrainView, TERRAIN_BUDGET, TERRAIN_MATERIALS, polygonArea } from '../src/terrain-view.js';
const bounds={minX:-20,maxX:20,minZ:-20,maxZ:20};
const area=g=>{const p=g.getAttribute('position');let a=0;for(let i=0;i<p.count;i+=3)a+=Math.abs((p.getX(i+1)-p.getX(i))*(p.getZ(i+2)-p.getZ(i))-(p.getX(i+2)-p.getX(i))*(p.getZ(i+1)-p.getZ(i)))/2;return a;};
test('joined crossing streets form one polygon without stacked intersection faces',()=>{
 const network=buildRoadNetwork([{id:'a',points:[[-10,0],[10,0]],width:4},{id:'b',points:[[0,-10],[0,10]],width:4}]);
 assert.equal(network.contours.length,1);assert.ok(Math.abs(area(network.geometry)-144)<1e-4);
 const p=network.geometry.attributes.position;for(let i=0;i<p.count;i++)assert.equal(p.getY(i),0);
});
test('bent streets use connected mitred contours, metre-correct UV and no repeated box patches',()=>{
 const network=buildRoadNetwork([{id:'a',points:[[-10,-5],[0,-5],[0,10]],width:4}]);
 assert.equal(network.contours.length,1);assert.ok(Math.abs(polygonArea(network.contours[0]))>70);
 const p=network.geometry.attributes.position,u=network.geometry.attributes.uv;for(let i=0;i<p.count;i++){assert.ok(Math.abs(u.getX(i)-p.getX(i)/4)<1e-5);assert.ok(Math.abs(u.getY(i)+p.getZ(i)/4)<1e-5);}
});
test('duplicate and reversed overlapping routes do not multiply the visible road area',()=>{
 const n=buildRoadNetwork([{points:[[-10,0],[10,0]],width:4},{points:[[10,0],[-10,0]],width:4}]);assert.equal(n.contours.length,1);assert.ok(Math.abs(area(n.geometry)-80)<1e-4);
});
test('terrain adapter keeps collision spec immutable and does not create unapproved raised curbs',()=>{
 const spec={bounds,geometry:[],routes:[],sceneDressing:{ground:{material:'concrete'},roads:[{id:'street',points:[[-10,0],[10,0]],width:5,curb:{height:.18}}]}};
 const before=JSON.stringify(spec);const scene=new THREE.Scene();const view=createTerrainView(scene,spec,{loadTextures:false});
 assert.equal(JSON.stringify(spec),before);assert.equal(view.root.getObjectByName('raised-curbs'),undefined);assert.ok(view.diagnostics.warnings.some(w=>/curb/i.test(w)));
 assert.ok(view.diagnostics.drawCalls<=TERRAIN_BUDGET.drawCalls);assert.equal(view.diagnostics.drivePlaneY,0);view.dispose();assert.equal(scene.children.length,0);
});
test('explicit approved curb blocks remain inside their existing collision box footprint',()=>{
 const spec={bounds,geometry:[{id:'wall',kind:'box',x:0,z:5,width:12,depth:1,height:1}],sceneDressing:{roads:[],ground:{material:'concrete'},curbs:[{id:'c',colliderId:'wall',x:0,z:5,width:11.8,depth:.8,height:.16}]}};
 const view=createTerrainView(new THREE.Scene(),spec,{loadTextures:false});const curb=view.root.getObjectByName('raised-curbs');assert.ok(curb);assert.equal(view.diagnostics.raisedFootprints.length,1);view.dispose();
});
test('material contract is original local PBR and mobile bounded',()=>{
 assert.equal(TERRAIN_BUDGET.tileSizeMetres,4);assert.equal(TERRAIN_BUDGET.textureResolution,512);for(const material of Object.values(TERRAIN_MATERIALS)){assert.ok(material.baseColor.endsWith('.webp'));assert.ok(material.normal.endsWith('.png'));assert.ok(material.orm.endsWith('.png'));}
});
test('all flush road details face upward rather than disappearing under front-face culling',()=>{
 const view=createTerrainView(new THREE.Scene(),{bounds,geometry:[],sceneDressing:{roads:[{points:[[-10,0],[10,0]],width:6}],drains:[{x:0,z:2}]}},{loadTextures:false});
 for(const name of ['faded-road-paint','flush-street-edge','flush-drain-bars','flush-drain-insets']){const mesh=view.root.getObjectByName(name);assert.ok(mesh);const normals=mesh.geometry.attributes.normal;for(let i=0;i<normals.count;i++)assert.ok(normals.getY(i)>.99,`${name} must face up`);}view.dispose();
});
test('a closed factory access loop leaves its concrete courtyard unpaved',()=>{
 const n=buildRoadNetwork([{points:[[-10,-10],[10,-10],[10,10],[-10,10],[-10,-10]],width:4}]);assert.equal(n.contours.length,2);assert.ok(n.contours.some(c=>polygonArea(c)<0));assert.ok(Math.abs(area(n.geometry)-n.contours.reduce((s,c)=>s+polygonArea(c),0))<.001);
});
test('mixed paving types never create overlapping coplanar road faces at a junction',()=>{
 const view=createTerrainView(new THREE.Scene(),{bounds,geometry:[],sceneDressing:{roads:[{points:[[-10,0],[10,0]],width:4,material:'asphalt'},{points:[[0,-10],[0,10]],width:4,material:'concrete'}]}},{loadTextures:false});
 const paved=['asphalt','concrete'].reduce((s,n)=>s+area(view.root.getObjectByName('streets:'+n).geometry),0);assert.ok(Math.abs(paved-144)<.001);view.dispose();
});
test('road wear follows wheel lanes in geometry color rather than adding random floating patches',()=>{
 const v=createTerrainView(new THREE.Scene(),{bounds,geometry:[],sceneDressing:{roads:[{points:[[-10,0],[10,0]],width:8}]}},{loadTextures:false});const g=v.root.getObjectByName('streets:asphalt').geometry;assert.ok(g.attributes.color);const c=g.attributes.color.array;assert.ok(Math.max(...c)-Math.min(...c)>.10);assert.ok(v.diagnostics.triangles<TERRAIN_BUDGET.triangles);v.dispose();
});
test('declared rubble handling surfaces get a readable original aggregate material without new collision',()=>{
 const spec={bounds,geometry:[],surfaces:[{id:'r',class:'rubble',polygon:[{x:-3,z:-3},{x:3,z:-3},{x:3,z:3},{x:-3,z:3}]}],sceneDressing:{roads:[]}};const before=JSON.stringify(spec),v=createTerrainView(new THREE.Scene(),spec,{loadTextures:false});assert.equal(JSON.stringify(spec),before);const m=v.root.getObjectByName('handling-surface:r');assert.ok(m);assert.equal(m.material.name,'terrain:earth');assert.ok(Math.abs(area(m.geometry)-36)<.001);v.dispose();
});
test('texture-free geometry path exposes a settled readiness boundary for host integration',async()=>{
 const v=createTerrainView(new THREE.Scene(),{bounds,geometry:[],sceneDressing:{roads:[]}},{loadTextures:false});assert.ok(v.ready instanceof Promise);assert.deepEqual(await v.ready,{loaded:0,failed:0});v.dispose();
});
test('terrain asset overrides cannot introduce an external decoder or texture request',()=>{
 assert.throws(()=>createTerrainView(new THREE.Scene(),{bounds,geometry:[],sceneDressing:{roads:[]}},{textureUrls:{concrete:{baseColor:'https://cdn.invalid/map.webp',normal:'https://cdn.invalid/n.png',orm:'https://cdn.invalid/o.png'}}}),/embedded data URLs/);
});
