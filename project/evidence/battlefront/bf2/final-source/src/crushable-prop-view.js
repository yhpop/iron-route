import * as THREE from 'three';
import {ConvexObjectBreaker} from 'three/addons/misc/ConvexObjectBreaker.js';
/** Original lightweight timber barrier; physics remains in the mission collider.
 * Each independently authored segment leaves traversable debris when crushed. */
export function createCrushableView(c){
 const root=new THREE.Group();root.name=`solid:${c.id}`;root.userData.staticOcclusion=false;root.position.set(c.x,c.y||0,c.z);root.rotation.y=c.yaw||0;
 const geometries=[],materials=[new THREE.MeshStandardMaterial({color:0x76634b,roughness:.97}),new THREE.MeshStandardMaterial({color:0x4b4940,metalness:.35,roughness:.8})];
 const add=(w,h,d,x,y,z,m=0)=>{const g=new THREE.BoxGeometry(w,h,d);geometries.push(g);const o=new THREE.Mesh(g,materials[m]);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;root.add(o);return o;};
 const w=c.width,d=c.depth,h=c.height,planks=[];
 for(const x of [-w/2+.07,w/2-.07])add(.12,h,d*.8,x,h/2,0,1);
 for(const y of [h*.3,h*.75])add(w,.08,d*.65,0,y,d*.1);
 const n=Math.max(2,Math.floor(w/.25));for(let i=0;i<n;i++){const x=-w/2+w*(i+.5)/n;const plank=add(w/n*.77,h*.84,d*.3,x,h*.49,-d*.25);plank.rotation.z=((i%3)-1)*.02;planks.push(plank);}
 const intact=[...root.children],debris=new THREE.Group();debris.name='fracture-debris';debris.visible=false;root.add(debris);
 let fractured=false,age=0,wasCrushed=false;
 const motion=[];
 function fracture(){if(fractured)return;fractured=true;const cutter=new ConvexObjectBreaker(.05);
  for(const [i,plank]of planks.entries()){
   const source=new THREE.Mesh(plank.geometry,plank.material);source.position.copy(plank.position);source.rotation.copy(plank.rotation);source.updateMatrixWorld(true);
   cutter.prepareBreakableObject(source,1,new THREE.Vector3(),new THREE.Vector3(),false);
   const normal=new THREE.Vector3(.3,1,.15).normalize(),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,source.position),result={object1:null,object2:null};
   cutter.cutByPlane(source,plane,result);
   for(const [j,piece]of [result.object1,result.object2].entries())if(piece){geometries.push(piece.geometry);piece.rotation.set(Math.PI/2,Math.sin(i*2.17+j*1.31)*.72,0);
    piece.position.x+=Math.sin(i*3.1+j)*.09;piece.position.z+=(j?1:-1)*(h*.19+(i%3)*.035);
    piece.position.y=0;piece.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(piece);
    piece.position.y=.009-bounds.min.y+(i%3)*.009;
    const end=piece.position.clone(),start=end.clone();start.z-=.09*Math.cos(i+j);start.y+=.07+(i%2)*.03;
    motion.push({piece,start,end});piece.position.copy(start);
    piece.castShadow=piece.receiveShadow=true;debris.add(piece);}
  }
 }
 let disposed=false;
 function update(e,dt=0){
  if(disposed)return;
  const dead=e?.alive===false,crushed=dead&&e?.status==='crushed';
  root.visible=!dead||crushed;root.scale.y=1;
  if(crushed){fracture();if(!wasCrushed)age=0;
   age=Math.min(.28,age+(Number.isFinite(dt)?Math.max(0,dt):0));
   const t=age/.28,ease=1-(1-t)*(1-t);
   for(const {piece,start,end} of motion)piece.position.lerpVectors(start,end,ease);
  }else age=0;
  wasCrushed=crushed;debris.visible=crushed;for(const o of intact)o.visible=!crushed;
 }
 function dispose(){if(disposed)return;disposed=true;root.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
 return {root,update,dispose};
}
