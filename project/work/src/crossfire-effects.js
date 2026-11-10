import * as THREE from 'three';
// Cosmetic, entity-owned sources only. No lights, impact pools, physics or damage.
function mask(flame){const n=32,data=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const u=x/(n-1)*2-1,v=y/(n-1)*2-1;const a=flame?Math.max(0,1-Math.abs(u)/(.14+.48*(1-v)/2))*Math.max(0,1-v*v):Math.max(0,1-Math.hypot(u+.12*Math.sin(v*7),v))**1.7;const i=(y*n+x)*4;data.set([255,flame?155:255,flame?55:255,Math.round(a*255)],i);}const t=new THREE.DataTexture(data,n,n);t.needsUpdate=true;t.minFilter=t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;t.colorSpace=THREE.SRGBColorSpace;return t;}
export function createCrossfireEffects(parent,spec){
 const mobile=globalThis.matchMedia?.('(pointer: coarse)')?.matches??false,reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false;
 const root=new THREE.Group();root.name='crossfire-damage-effects';parent.add(root);
 const capacity=mobile?4:8,enabled=spec.crossfireFront===true,maps=[mask(false),mask(true)],materials=[];
 const diagnostics={enabled,reducedMotion,sourceCapacity:capacity,activeSmoke:0,activeFire:0,deathTransitions:0,time:0,disposed:false,physicsBodiesAdded:0,providesCover:false};
 const sources=(enabled?(spec.entities||[]).filter(e=>e.vehicle==='pz3').slice(0,capacity):[]).map(e=>{const make=(fire)=>{const material=new THREE.SpriteMaterial({map:maps[fire?1:0],color:fire?0xffba69:0x494641,transparent:true,opacity:fire?.45:.18,depthWrite:false,depthTest:true});materials.push(material);const s=new THREE.Sprite(material);s.name=`${fire?'wreck-fire':'damage-smoke'}:${e.id}`;s.visible=false;s.userData.entityId=e.id;s.userData.collision='none';root.add(s);return s;};return {id:e.id,maxHp:e.maxHp??e.hp,smoke:make(false),fire:make(true),deadAt:null};});
 function update(state,events=[],dt=0){if(diagnostics.disposed||state.phase!=='playing'||!Number.isFinite(dt)||dt<=0)return;diagnostics.time+=Math.min(dt,.1);diagnostics.activeSmoke=diagnostics.activeFire=0;
  for(const source of sources){const e=state.entities?.[source.id];source.smoke.visible=source.fire.visible=false;if(!e?.pose||![e.pose.x,e.pose.z].every(Number.isFinite))continue;
   const dead=e.alive===false;if(dead&&source.deadAt===null){source.deadAt=diagnostics.time;diagnostics.deathTransitions++;}const age=source.deadAt===null?0:diagnostics.time-source.deadAt;
   const max=e.maxHp??source.maxHp,damaged=e.alive!==false&&Number.isFinite(e.hp)&&Number.isFinite(max)&&max>0&&e.hp/max<.65;
   if(reducedMotion)continue;
   // Compact low-opacity soot stays local to the hull; never a tall opaque screen.
   source.smoke.visible=damaged||(dead&&age<18);source.fire.visible=dead&&age<12;
   source.smoke.position.set(e.pose.x,(e.pose.y||0)+1.45+.12*Math.sin(diagnostics.time*1.3),e.pose.z);source.smoke.scale.set(1.15,1.4,1);
   source.fire.position.set(e.pose.x,(e.pose.y||0)+.8,e.pose.z);source.fire.scale.set(.7,.9+.08*Math.sin(diagnostics.time*9),1);
   source.smoke.material.opacity=dead?.18*Math.min(1,(18-age)/3):.13;
   source.fire.material.opacity=.45*Math.min(1,(12-age)/3);
   diagnostics.activeSmoke+=Number(source.smoke.visible);diagnostics.activeFire+=Number(source.fire.visible);
  }
 }
 return {root,update,diagnostics,dispose(){if(diagnostics.disposed)return;diagnostics.disposed=true;diagnostics.activeSmoke=diagnostics.activeFire=0;root.removeFromParent();for(const m of materials)m.dispose();for(const t of maps)t.dispose();}};
}
