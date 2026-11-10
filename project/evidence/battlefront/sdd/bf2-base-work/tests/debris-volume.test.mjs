import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createCrushableView} from '../src/crushable-prop-view.js';
const spec={id:'wood',x:0,y:0,z:0,width:1.8,height:.65,depth:.25};
test('crushed timber keeps physical thickness without root squash and settles above ground',()=>{
 const v=createCrushableView(spec);v.update({alive:false,status:'crushed'},1);
 assert.equal(v.root.scale.y,1);
 const d=v.root.getObjectByName('fracture-debris');v.root.updateMatrixWorld(true);
 for(const p of d.children){const b=new THREE.Box3().setFromObject(p);assert.ok(b.min.y>=-.0001);assert.ok(b.max.y-b.min.y>.025);assert.ok(b.max.y<.3);}
 assert.ok(new Set(d.children.map(p=>p.rotation.y.toFixed(3))).size>5);v.dispose();
});
test('fracture movement is bounded, settles and retry resets without reallocating',()=>{
 const v=createCrushableView(spec);v.update({alive:false,status:'crushed'},0);
 const d=v.root.getObjectByName('fracture-debris'),p=d.children[0],start=p.position.clone(),g=p.geometry;
 v.update({alive:false,status:'crushed'},.12);assert.ok(p.position.distanceTo(start)>.001);
 v.update({alive:false,status:'crushed'},1);const settled=p.position.clone();v.update({alive:false,status:'crushed'},1);assert.deepEqual(p.position,settled);
 v.update({alive:true},.1);assert.equal(d.visible,false);v.update({alive:false,status:'crushed'},0);assert.deepEqual(p.position,start);assert.equal(p.geometry,g);v.dispose();
});
