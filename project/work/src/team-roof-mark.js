import * as THREE from 'three';
import {combatTeam,areHostile} from './combat-relations.js';
// Paint-sized identification on the REAL indexed PzIII turret shell. Coordinates
// were sampled from assets/pz3-interceptor.glb, TurretYaw/TurretDetail_6. A flat
// horizontal plane is wrong here: the roof has a shallow fold near z=-0.369.
const BACK=[[-.34,-.44],[.07,-.44],[.07,-.04],[-.34,-.04]];
const ALLY=[[[-.29,-.39],[-.20,-.39],[-.20,-.09],[-.29,-.09]],[[-.07,-.39],[.02,-.39],[.02,-.09],[-.07,-.09]]];
const ENEMY=[[[-.135,-.40],[.025,-.24],[-.135,-.08],[-.295,-.24]]];
function relation(state,id){const player=combatTeam(state,'tank'),unit=combatTeam(state,id);return player&&unit?(player===unit?'ally':areHostile(state,'tank',id)?'enemy':null):null;}
// Sutherland-Hodgman in roof x/z, interpolating original 3D triangle heights.
function clipTriangle(vertices,polygon){
 let points=vertices.map(v=>v.clone());const area=polygon.reduce((sum,a,i)=>{const b=polygon[(i+1)%polygon.length];return sum+a[0]*b[1]-b[0]*a[1];},0),sign=Math.sign(area);
 for(let i=0;i<polygon.length&&points.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],side=p=>sign*((b[0]-a[0])*(p.z-a[1])-(b[1]-a[1])*(p.x-a[0])),next=[];
  for(let j=0;j<points.length;j++){const p=points[j],q=points[(j+1)%points.length],dp=side(p),dq=side(q),insideP=dp>=-1e-10,insideQ=dq>=-1e-10;
   if(insideP)next.push(p);if(insideP!==insideQ)next.push(p.clone().lerp(q,dp/(dp-dq)));
  }points=next;
 }return points;
}
export function createPz3TeamMark(asset,spec,source){
 if(!spec?.eightNpcReconstruction||source?.vehicle!=='pz3'||!source.id)return null;
 const affiliation=relation({mission:spec,entities:{[source.id]:source}},source.id),roof=asset?.getObjectByName('TurretDetail_6');
 if(!affiliation||!roof?.isMesh||!roof.geometry?.attributes?.position||roof.parent?.name!=='TurretYaw')return null;
 const p=roof.geometry.attributes.position,index=roof.geometry.index,positions=[],normals=[],colors=[];
 const layers=[{polygons:[BACK],color:new THREE.Color(0x151d20),offset:.001},{polygons:affiliation==='ally'?ALLY:ENEMY,color:new THREE.Color(affiliation==='ally'?0x6ae0df:0xff936f),offset:.0025}];
 const count=index?.count??p.count;
 for(let i=0;i<count;i+=3){const v=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+k):i+k));const normal=new THREE.Vector3().subVectors(v[1],v[0]).cross(new THREE.Vector3().subVectors(v[2],v[0])).normalize();
  // This measured front roof is the only eligible surface, never side/bottom faces.
  if(normal.y<.9||v.some(point=>point.y<.30||point.y>.40))continue;
  for(const layer of layers)for(const polygon of layer.polygons){const clipped=clipTriangle(v,polygon);
   for(let j=1;j+1<clipped.length;j++){const tri=[clipped[0],clipped[j],clipped[j+1]];if(new THREE.Vector3().subVectors(tri[1],tri[0]).cross(new THREE.Vector3().subVectors(tri[2],tri[0])).lengthSq()<1e-16)continue;
    for(const vertex of tri){const offset=vertex.clone().addScaledVector(normal,layer.offset);positions.push(offset.x,offset.y,offset.z);normals.push(normal.x,normal.y,normal.z);colors.push(layer.color.r,layer.color.g,layer.color.b);}
   }
  }
 }
 if(!positions.length)return null;
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,metalness:0,depthTest:true,depthWrite:true,fog:true});
 const root=new THREE.Mesh(geometry,material);root.name=`team-roof-mark:${source.id}`;root.userData.presentationOnly=true;root.userData.relation=affiliation;root.visible=false;root.castShadow=false;root.receiveShadow=true;roof.add(root);let disposed=false;
 return {root,relation:affiliation,triangles:positions.length/9,update(state){if(disposed)return;const e=state?.entities?.[source.id];root.visible=Boolean(e&&e.alive===true&&!e.destroyed&&Number.isFinite(e.hp)&&e.hp>0&&relation(state,source.id)===affiliation);},dispose(){if(disposed)return;disposed=true;root.removeFromParent();geometry.dispose();material.dispose();}};
}
