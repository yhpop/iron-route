import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {createWorld as original} from '../src/campaign-world.js';
import {DEFAULT_CONFIG,getTankTransform} from '../src/tank-controller.js';
const url=new URL('../src/campaign-world-accelerated.js',import.meta.url);
const rig=DEFAULT_CONFIG.rig;
const tank=(x=0,z=0,yaw=0,y=0,joint=0,elevation=0,recoil=0)=>({pose:{x,y,z,yaw},turret:{yawRel:joint,elevation,recoil,recoilVelocity:0}});
const box=(id,x,z,width=2,depth=2,height=3,y=0,yaw=0)=>({id,kind:'box',x,y,z,width,depth,height,yaw});
const outcome=fn=>{try{return {returned:fn()};}catch(e){return {threw:{name:e.name,message:e.message}};}};
let comparisons=0;
const compare=(a,b,name,args)=>{comparisons++;assert.deepStrictEqual(outcome(()=>b[name](...args)),outcome(()=>a[name](...args)),name);};
async function accelerated(){assert.ok(existsSync(url),'Missing accelerated collision module: implement conservative sweep filtering');return (await import(url)).createWorld;}
test('accelerated public query objects equal original for adversarial static shapes and articulated motion',async(t)=>{
 const start=comparisons,create=await accelerated();let seed=0x9137;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 const geometries=[[],[box('thin',0,-3,8,.000001)],[box('rotated',1.8,-2,.02,6,3,0,Math.PI/4)],[box('vertical',0,-2,3,3,.03,1.31)],
  [box('threshold',0,-2.3247964334487916,.01,.01,.01,.191+rig.turretPivot.y+rig.barrelPivot.y)],
  [box('large',2**40,0,2**30,2**30,2**30)], [box('enclosing',0,0,2**21,2**21,2**21)],
  [box('nonfinite-y',20,20,1,1,1,Infinity)],[box('nonfinite-yaw',0,0,1,1,1,0,NaN)],
  [{id:'circle',kind:'circle',x:1.2,z:-2,radius:.25,height:2}],
  [box('far',1000,1000),box('equal-a',0,0),box('equal-b',0,0)]];
 for(let i=0;i<48;i++)geometries.push(Array.from({length:6},(_,j)=>j%3?box('b'+j,(random()-.5)*20,(random()-.5)*20,.001+random()*4,.001+random()*4,.001+random()*5,(random()-.3)*5,random()*Math.PI*2):{id:'c'+j,kind:'circle',x:(random()-.5)*20,z:(random()-.5)*20,radius:.001+random()*2,height:.001+random()*5,y:(random()-.3)*5}));
 for(const [i,geometry] of geometries.entries()){
  const spec={geometry,bounds:i%2?{minX:-12,maxX:12,minZ:-12,maxZ:12}:undefined,surfaces:[{id:'mud',traction:.5,drag:2,polygon:[{x:-3,z:-3},{x:3,z:-3},{x:3,z:3},{x:-3,z:3}]}]};
  const a=original(spec),b=create(spec),from=tank(0,0,i*.13,0,i*.07),to=tank(.04,-.05,i*.13+.04,.01,i*.07+.06,.03,.01);
  for(const ignores of [[],['far'],geometry.map(c=>c.id)]){
   compare(a,b,'sweepHullAndAttachedGun',[from,to,rig,ignores]);
   compare(a,b,'muzzleContacts',[getTankTransform(from,rig),rig,ignores]);
   compare(a,b,'raycast',[{x:0,y:1,z:0},{x:0,y:1,z:-20},ignores]);
   compare(a,b,'isRouteClear',[[{x:0,z:0,yaw:0},{x:.1,z:-.2,yaw:.03}],{width:1,depth:2,height:1},ignores]);
  }
  compare(a,b,'sweepTurretAtHull',[from.pose,from.turret,to.turret,rig]);compare(a,b,'hullContacts',[from,rig]);compare(a,b,'muzzleClear',[from,rig]);compare(a,b,'surfaceAt',[from.pose]);
  for(const ids of [geometry.map(c=>c.id),[]]){compare(a,b,'setDestroyed',[ids]);compare(a,b,'sweepHullAndAttachedGun',[from,to,rig]);}
  // bounds are intentionally caller-owned in the oracle; do not cache them.
  if(spec.bounds){spec.bounds.minX=1;compare(a,b,'sweepHullAndAttachedGun',[from,to,rig]);}
  compare(a,b,'dispose',[]);for(const name of ['setEntities','setDestroyed','surfaceAt','muzzleContacts','muzzleClear','hullContacts','sweepHullAndAttachedGun','sweepTurretAtHull','raycast','isRouteClear'])compare(a,b,name,[]);
 }
 t.diagnostic(`whole public outcomes compared: ${comparisons-start}; static scenarios: ${geometries.length}`);
});
test('malformed numeric and call behavior is not broadened by bounds validation',async()=>{
 const create=await accelerated();
 for(const spec of [null,{geometry:[box('',0,0)]},{geometry:[box('bad',0,0,-1)]},{geometry:[{id:'bad',kind:'circle',x:0,z:0,height:1,radius:NaN}]}])assert.deepStrictEqual(outcome(()=>create(spec)),outcome(()=>original(spec)));
 const a=original(),b=create();for(const [name,args] of [['setEntities',[null]],['setDestroyed',[null]],['surfaceAt',[null]],['sweepHullAndAttachedGun',[null,null]],['sweepTurretAtHull',[null,null,null]],['muzzleContacts',[null]],['hullContacts',[null]],['raycast',[null,null]],['isRouteClear',[null]],['isRouteClear',[[],{width:NaN}]]])compare(a,b,name,args);
 for(const geometry of [[box('yaw-string',20,20,1,1,1,0,'0')],[box('y-string',20,20,1,1,1,'0')]]){const x=original({geometry}),y=create({geometry});compare(x,y,'sweepHullAndAttachedGun',[tank(),tank(.1,-.1)]);}
});
test('conservative bounds keep SAT threshold corner cases and fail open outside numerical domain',async()=>{
 await accelerated();const {conservativeShapeBounds:bounds,boundsMayContact:may}=await import('../src/collision-broadphase.js');
 const b={kind:'box',x:0,y:0,z:0,width:2,depth:2,height:2,yaw:Math.PI/4};
 assert.equal(may(bounds(b),bounds({...b,x:100}),.03),false,'real horizontal pair elimination');
 assert.equal(may(bounds(b),bounds({...b,y:100}),.03),false,'real vertical pair elimination');
 for(const x of [0,2*Math.SQRT2,.03+2*Math.SQRT2,2*Math.SQRT2+.03*Math.SQRT2])assert.equal(may(bounds(b),bounds({...b,x}),.03),true);
 for(const shape of [{...b,x:2**30},{...b,width:-1},{...b,yaw:Infinity},{...b,kind:'unknown'},{kind:'capsule',a:{x:0,y:0,z:0},b:{x:Infinity,y:0,z:0},radius:1}]){assert.equal(bounds(shape),null);assert.equal(may(bounds(b),bounds(shape),.03),true);}
 assert.equal(may(bounds(b),bounds({...b,x:100}),NaN),true);
 for(const shape of [{kind:'circle',x:0,y:0,z:0,radius:1,height:2},{kind:'capsule',a:{x:-1,y:0,z:0},b:{x:1,y:0,z:0},radius:.1}]){assert.equal(may(bounds(shape),bounds(b),.03),true);assert.equal(may(bounds(shape),bounds({...b,x:100}),.03),false);}
});
test('finite non-unit rotation matrices fail open even when determinant and inverse checks pass',async()=>{
 await accelerated();const {conservativeShapeBounds}=await import('../src/collision-broadphase.js'),cos=Math.cos,sin=Math.sin;
 try{Math.cos=()=>1;Math.sin=yaw=>yaw>=Math.PI/2?-1:1;assert.equal(conservativeShapeBounds({kind:'box',x:0,y:0,z:0,yaw:0,width:2,depth:2,height:2}),null);}
 finally{Math.cos=cos;Math.sin=sin;}
});
test('whole sweep returns match on both sides of rotated SAT cutoff and at large finite query coordinates',async(t)=>{
 const create=await accelerated();let n=0;
 for(const yaw of [0,Math.PI/4,Math.PI/2])for(const epsilon of [-1e-8,-1e-9,-1e-12,0,1e-12,1e-9,1e-8]){
  const d=rig.hullProxy.width/2+.000005+.03+epsilon,offset=rig.hullProxy.offset;
  const geometry=[box('cutoff',Math.cos(yaw)*d+Math.sin(yaw)*offset.z,-Math.sin(yaw)*d+Math.cos(yaw)*offset.z,.00001,3,.2,.1,yaw)],a=original({geometry}),b=create({geometry}),from=tank(0,0,yaw);
  compare(a,b,'sweepHullAndAttachedGun',[from,from,rig]);compare(a,b,'sweepHullAndAttachedGun',[from,tank(.002*Math.cos(yaw),-.002*Math.sin(yaw),yaw),rig]);compare(a,b,'hullContacts',[from,rig]);n+=3;
 }
 for(const coordinate of [-0,2**20-1,2**20+1,2**40]){
  const geometry=[box('near-large',coordinate,coordinate-3,.0001,3,2)],a=original({geometry}),b=create({geometry}),from=tank(coordinate,coordinate,0,coordinate);
  for(const name of ['sweepHullAndAttachedGun','muzzleContacts','hullContacts']){compare(a,b,name,name==='sweepHullAndAttachedGun'?[from,from,rig]:[from,rig]);n++;}
 }
 t.diagnostic(`additional threshold/large finite whole outcomes: ${n}`);
});
