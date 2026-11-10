import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCrushableView} from '../src/crushable-prop-view.js';
import {createPlayerOcclusion} from '../src/player-occlusion.js';
test('dynamic crush debris does not inherit static building cutaway materials',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(0,1,5);
 const prop=createCrushableView({id:'fence',x:0,z:2,width:2,height:2,depth:.3});scene.add(prop.root);
 const cutaway=createPlayerOcclusion(scene);const original=prop.root.children[0].material;
 assert.equal(cutaway.update(camera,{x:0,z:0}),0);
 assert.equal(prop.root.children[0].material,original);
 prop.update({alive:false,status:'crushed'});cutaway.update(camera,{x:0,z:0});
 const debris=prop.root.getObjectByName('fracture-debris');
 assert.ok(debris.children.length>0);assert.ok(debris.children.every(mesh=>mesh.material.opacity===1));
 cutaway.dispose();prop.dispose();
});
