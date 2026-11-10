/** Reversible view-only finish. Source GLB maps and rig geometry remain borrowed.
 * Local-space variation stays attached to moving vehicle parts. No dynamic
 * textures, update loop, physics writes or new renderable objects. */
const activeRoots=new WeakMap();
const marker='war-vehicle-finish-v1';
const anchors={vertex:['#include <common>','#include <begin_vertex>'],fragment:['#include <common>','#include <color_fragment>']};

export function applyWarVehicleFinish(root,{team='allied'}={}){
 if(!root?.traverse)throw new TypeError('Vehicle finish requires an Object3D root');
 const active=activeRoots.get(root);if(active)return active;
 const faction=team==='hostile'?'hostile':'allied',copies=new Map(),bindings=[];
 const diagnostics={team:faction,materialClones:0,meshBindings:0,shaderFallbacks:0,extraTextures:0,extraDrawCalls:0,disposed:false};
 const palette=faction==='hostile'?'vec3(0.205,0.164,0.128)':'vec3(0.170,0.187,0.180)';
 function paint(source){
  if(!source?.isMeshStandardMaterial&&!source?.isMeshPhysicalMaterial)return source;
  if(copies.has(source))return copies.get(source);
  const copy=source.clone();copies.set(source,copy);diagnostics.materialClones++;
  const upstream=source.onBeforeCompile,upstreamKey=source.customProgramCacheKey.call(source);
  // Dry, worn armor: retain original texture channel detail rather than
  // replacing camouflage/palette maps with a flat universal paint color.
  copy.roughness=Math.max(.78,source.roughness);
  copy.metalness=Math.min(.38,source.metalness);
  copy.envMapIntensity=Math.min(.65,source.envMapIntensity);
  if(copy.isMeshPhysicalMaterial){copy.clearcoat=Math.min(.08,copy.clearcoat);copy.clearcoatRoughness=Math.max(.8,copy.clearcoatRoughness);}
  copy.onBeforeCompile=function(shader,renderer){
   upstream.call(this,shader,renderer);
   // Do not partially patch an unfamiliar upstream shader. Scalar PBR finish
   // still works, and diagnostics makes the omitted weathering explicit.
   if(!anchors.vertex.every(a=>shader.vertexShader.includes(a))||!anchors.fragment.every(a=>shader.fragmentShader.includes(a))){diagnostics.shaderFallbacks++;return;}
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 warFinishPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nwarFinishPosition = position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 warFinishPosition;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
// ${marker}: original sampled map/vertex color remain visible beneath dust.
float warFinishLuma=dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722));
vec3 warFinishBase=mix(diffuseColor.rgb,vec3(warFinishLuma),0.32);
float warFinishBroad=0.5+0.5*sin(dot(warFinishPosition,vec3(1.07,0.71,1.39))+sin(warFinishPosition.z*0.67+warFinishPosition.x*0.51));
float warFinishScorch=smoothstep(0.73,0.98,warFinishBroad)*0.13;
float warFinishDust=0.16+0.12*(0.5+0.5*sin(warFinishPosition.y*1.23+warFinishPosition.z*0.41));
vec3 warFinishDustColor=mix(vec3(0.215,0.190,0.151),${palette},0.24);
diffuseColor.rgb=mix(warFinishBase,warFinishDustColor,warFinishDust)*(1.0-warFinishScorch);
`);
  };
  copy.customProgramCacheKey=()=>`${upstreamKey}|${marker}|${faction}`;
  copy.needsUpdate=true;return copy;
 }
 const restore=()=>{for(const{object,original,next}of bindings)if(object.material===next)object.material=original;for(const material of copies.values())material.dispose();};
 try{root.traverse(object=>{if(!object.isMesh)return;const original=object.material,next=Array.isArray(original)?original.map(paint):paint(original);if(Array.isArray(original)?next.every((m,i)=>m===original[i]):next===original)return;object.material=next;bindings.push({object,original,next});diagnostics.meshBindings++;});}catch(error){restore();throw error;}
 let disposed=false;
 const handle={diagnostics,dispose(){if(disposed)return;disposed=true;diagnostics.disposed=true;restore();activeRoots.delete(root);}};
 activeRoots.set(root,handle);return handle;
}
