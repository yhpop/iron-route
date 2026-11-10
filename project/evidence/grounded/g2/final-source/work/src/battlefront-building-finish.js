import {Matrix4} from 'three';
/** Static, sealed historic fire damage. Geometry and every map remain borrowed.
 * The inverse authored root is captured once, not recomputed during updates. */
const activeRoots=new WeakMap(),marker='battlefront-building-finish-v1';
const roles=new Set(['Concrete','Brick','Glass','Steel','SagePaint','DarkSteel','ZincRoof','Ivory']);
const vertexAnchors=['#include <common>','#include <project_vertex>'];
const fragmentAnchors=['#include <common>','#include <color_fragment>'];
export function applyBattlefrontBuildingFinish(root,{id}={}){
 if(!root?.traverse)throw new TypeError('Building finish requires an Object3D root');
 const active=activeRoots.get(root);if(active)return active;
 root.updateWorldMatrix(true,true);
 const inverseRoot={value:new Matrix4().copy(root.matrixWorld).invert()},copies=new Map(),bindings=[];
 const diagnostics={id,materialClones:0,meshBindings:0,shaderFallbacks:0,extraTextures:0,extraDrawCalls:0,disposed:false};
 function paint(source){
  if(!source||!roles.has(source.name)||(!source.isMeshStandardMaterial&&!source.isMeshPhysicalMaterial))return source;
  if(copies.has(source))return copies.get(source);
  const copy=source.clone();copies.set(source,copy);diagnostics.materialClones++;
  const role=source.name,upstream=source.onBeforeCompile,upstreamKey=source.customProgramCacheKey.call(source);
  const roof=role==='ZincRoof'||role==='SagePaint',glass=role==='Glass';
  copy.roughness=Math.max(.88,source.roughness);copy.metalness=Math.min(.16,source.metalness);copy.envMapIntensity=Math.min(.3,source.envMapIntensity);
  // Opaque existing northlights remain closed panels, not simulated openings.
  copy.transparent=false;copy.opacity=1;
  if(copy.isMeshPhysicalMaterial){copy.clearcoat=Math.min(.03,copy.clearcoat);copy.clearcoatRoughness=Math.max(.9,copy.clearcoatRoughness);copy.transmission=0;}
  function install(material){
   material.onBeforeCompile=function(shader,renderer){
    upstream.call(this,shader,renderer);
    if(!vertexAnchors.every(a=>shader.vertexShader.includes(a))||!fragmentAnchors.every(a=>shader.fragmentShader.includes(a))){diagnostics.shaderFallbacks++;return;}
    shader.uniforms.buildingFinishInverseRoot=inverseRoot;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform mat4 buildingFinishInverseRoot;\nvarying vec3 buildingFinishPosition;').replace('#include <project_vertex>','#include <project_vertex>\nbuildingFinishPosition = (buildingFinishInverseRoot * modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 buildingFinishPosition;').replace('#include <color_fragment>',`#include <color_fragment>
// ${marker}: continuous soot/ash, never alpha, displacement or a painted hole.
float buildingFinishLuma=dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722));
vec3 buildingFinishBase=mix(diffuseColor.rgb,vec3(buildingFinishLuma),${glass?'1.0':roof?'0.96':'0.76'});
float buildingFinishWave=0.5+0.5*sin(buildingFinishPosition.x*0.47+sin(buildingFinishPosition.z*0.38));
float buildingFinishApron=1.0-smoothstep(-3.5,3.5,buildingFinishPosition.z);
float buildingFinishSoot=clamp(0.24+0.40*buildingFinishApron+0.12*buildingFinishWave-0.045*buildingFinishPosition.y,0.12,0.76);
float buildingFinishAsh=smoothstep(1.3,3.8,buildingFinishPosition.y)*(0.24+0.22*buildingFinishWave);
vec3 buildingFinishChar=vec3(0.035,0.032,0.029)+vec3(buildingFinishLuma*0.13);
vec3 buildingFinishAshColor=vec3(0.29,0.275,0.25)+vec3(buildingFinishLuma*0.22);
vec3 buildingFinishDry=buildingFinishBase*${glass?'0.52':roof?'0.68':'0.86'};
diffuseColor.rgb=mix(mix(buildingFinishDry,buildingFinishChar,buildingFinishSoot),buildingFinishAshColor,buildingFinishAsh);
`);
   };
   material.customProgramCacheKey=()=>`${upstreamKey}|${marker}|${role}`;
   // THREE's default clone/copy omits custom shader callbacks. Occlusion owns
   // its temporary fade copies; propagate hooks/binding, never register them
   // as finish-owned resources. This also survives further clone generations.
   const clone=material.clone;
   material.clone=function(){const temporary=clone.call(this);install(temporary);return temporary;};
   material.needsUpdate=true;
  }
  install(copy);return copy;
 }
 const restore=()=>{for(const{object,original,next}of bindings)if(object.material===next)object.material=original;for(const material of copies.values())material.dispose();};
 try{root.traverse(object=>{if(!object.isMesh)return;const original=object.material,next=Array.isArray(original)?original.map(paint):paint(original);if(Array.isArray(original)?next.every((m,i)=>m===original[i]):next===original)return;object.material=next;bindings.push({object,original,next});diagnostics.meshBindings++;});}catch(error){restore();throw error;}
 let disposed=false;
 const handle={diagnostics,dispose(){if(disposed)return;disposed=true;diagnostics.disposed=true;restore();activeRoots.delete(root);}};
 activeRoots.set(root,handle);return handle;
}
