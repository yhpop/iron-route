import * as THREE from 'three';
import {createWaterMaterial} from './water-material.js';
import { TERRAIN_TEXTURE_URLS } from '../assets/terrain/runtime-textures.js';

/** Grounded district render adapter. Metres; +Y up; collision remains the mission's authority. */
export const TERRAIN_BUDGET = Object.freeze({textureResolution:512,tileSizeMetres:4,maxPbrMaterials:3,drawCalls:14,triangles:18000,textureGpuMiB:12,externalRequests:0});
export const TERRAIN_MATERIALS = Object.freeze(Object.fromEntries(['asphalt','concrete','earth'].map(name=>[name,Object.freeze({baseColor:`${name}-basecolor.webp`,normal:`${name}-normal.png`,orm:`${name}-orm.png`})])));
const EPS=1e-7, key=p=>`${Math.round(p[0]*1e5)},${Math.round(p[1]*1e5)}`;
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0], sub=(a,b)=>[a[0]-b[0],a[1]-b[1]], dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const point=p=>Array.isArray(p)?[p[0],p[1]]:[p.x,p.z];
export function polygonArea(poly){return poly.reduce((s,a,i)=>{const b=poly[(i+1)%poly.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;}
function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a[1]>p[1])!==(b[1]>p[1]))&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function cleanPoints(points){const result=[];for(const raw of points||[]){const p=point(raw);if(p.every(Number.isFinite)&&(!result.length||Math.hypot(...sub(p,result.at(-1)))>EPS))result.push(p);}return result;}
function roundedPath(points,width){const p=cleanPoints(points);if(p.length<3)return p;const out=[p[0]];for(let i=1;i<p.length-1;i++){const a=p[i-1],b=p[i],c=p[i+1],ab=sub(b,a),bc=sub(c,b),l1=Math.hypot(...ab),l2=Math.hypot(...bc),u=ab.map(v=>v/l1),v=bc.map(q=>q/l2);if(Math.abs(cross(u,v))<.02){out.push(b);continue;}const r=Math.min(width*.95,l1*.42,l2*.42);if(r<width*.76){out.push(b);continue;}const start=[b[0]-u[0]*r,b[1]-u[1]*r],end=[b[0]+v[0]*r,b[1]+v[1]*r];out.push(start);for(let s=1;s<=8;s++){const t=s/8;out.push([(1-t)**2*start[0]+2*(1-t)*t*b[0]+t*t*end[0],(1-t)**2*start[1]+2*(1-t)*t*b[1]+t*t*end[1]]);}}out.push(p.at(-1));return out;}
function ribbon(points,width){const p=roundedPath(points,width),left=[],right=[];if(p.length<2)return [];for(let i=0;i<p.length;i++){const prev=sub(p[i],p[Math.max(0,i-1)]),next=sub(p[Math.min(p.length-1,i+1)],p[i]);let a=Math.hypot(...prev)?prev:next,b=Math.hypot(...next)?next:prev;a=a.map(v=>v/Math.hypot(...a));b=b.map(v=>v/Math.hypot(...b));const n1=[-a[1],a[0]],n2=[-b[1],b[0]],s=[n1[0]+n2[0],n1[1]+n2[1]],l=Math.hypot(...s),m=l>EPS?s.map(v=>v/l):n2,extent=Math.min(width*1.4,(width/2)/Math.max(.35,dot(m,n2)));left.push([p[i][0]+m[0]*extent,p[i][1]+m[1]*extent]);right.push([p[i][0]-m[0]*extent,p[i][1]-m[1]*extent]);}const result=[...left,...right.reverse()];return polygonArea(result)>0?result:result.reverse();}
/** Planar boundary union: intersections split before triangulation, so crossroads are not overlapping planes. */
function unionContours(polygons,subtractPolygons=[]){const edges=[...polygons,...subtractPolygons].flatMap(poly=>poly.map((a,i)=>({a,b:poly[(i+1)%poly.length],ts:[0,1]})));for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){const e=edges[i],f=edges[j],r=sub(e.b,e.a),s=sub(f.b,f.a),delta=sub(f.a,e.a),den=cross(r,s);if(Math.abs(den)>EPS){const t=cross(delta,s)/den,u=cross(delta,r)/den;if(t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS){e.ts.push(Math.max(0,Math.min(1,t)));f.ts.push(Math.max(0,Math.min(1,u)));}}else if(Math.abs(cross(delta,r))<EPS){for(const p of [f.a,f.b]){const t=dot(sub(p,e.a),r)/dot(r,r);if(t>EPS&&t<1-EPS)e.ts.push(t);}for(const p of [e.a,e.b]){const u=dot(sub(p,f.a),s)/dot(s,s);if(u>EPS&&u<1-EPS)f.ts.push(u);}}}
 const segments=new Map(),inUnion=p=>polygons.some(poly=>inside(p,poly))&&!subtractPolygons.some(poly=>inside(p,poly));
 for(const e of edges){const ts=[...new Set(e.ts.map(t=>Math.round(t*1e10)/1e10))].sort((a,b)=>a-b),d=sub(e.b,e.a);for(let i=1;i<ts.length;i++){let a=[e.a[0]+d[0]*ts[i-1],e.a[1]+d[1]*ts[i-1]],b=[e.a[0]+d[0]*ts[i],e.a[1]+d[1]*ts[i]],len=Math.hypot(...sub(b,a));if(len<EPS)continue;const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],n=[-(b[1]-a[1])/len*1e-5,(b[0]-a[0])/len*1e-5],l=inUnion([mid[0]+n[0],mid[1]+n[1]]),r=inUnion([mid[0]-n[0],mid[1]-n[1]]);if(l===r)continue;if(!l)[a,b]=[b,a];segments.set(`${key(a)}>${key(b)}`,{a,b});}}
 const byStart=new Map();for(const e of segments.values()){const k=key(e.a);if(!byStart.has(k))byStart.set(k,[]);byStart.get(k).push(e);}const contours=[];
 while(segments.size){let edge=segments.values().next().value;const first=key(edge.a),poly=[];for(let guard=0;edge&&guard<edges.length*5;guard++){poly.push(edge.a);segments.delete(`${key(edge.a)}>${key(edge.b)}`);if(key(edge.b)===first)break;const candidates=(byStart.get(key(edge.b))||[]).filter(e=>segments.has(`${key(e.a)}>${key(e.b)}`));edge=candidates[0];}if(poly.length>=3&&Math.abs(polygonArea(poly))>.0001)contours.push(poly);}return contours;
}
function geometryFromContours(contours,tileSize=4){const positions=[],uv=[],outer=contours.filter(p=>polygonArea(p)>0),holes=contours.filter(p=>polygonArea(p)<0);for(const poly of outer){const itsHoles=holes.filter(h=>inside(h[0],poly)),contour=poly.map(p=>new THREE.Vector2(...p)),hs=itsHoles.map(h=>h.map(p=>new THREE.Vector2(...p))),all=[...poly,...itsHoles.flat()];for(const triangle of THREE.ShapeUtils.triangulateShape(contour,hs))for(const i of [triangle[0],triangle[2],triangle[1]]){const [x,z]=all[i];positions.push(x,0,z);uv.push(x/tileSize,-z/tileSize);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('uv1',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();g.computeBoundingSphere();return g;}
export function buildRoadNetwork(roads,{shoulder=0,tileSize=4}={}){const polygons=roads.map(r=>ribbon(r.points,(r.width||8)+shoulder*2)).filter(p=>p.length>=3),contours=unionContours(polygons);return {contours,geometry:geometryFromContours(contours,tileSize)};}
// Low-frequency use belongs to the road design: wheel-polished lanes and dusty margins,
// not arbitrary rectangular overlays. Subdivision bounds the interpolation to metre scale.
function bakeRoadWear(source,roads){
 const segments=roads.flatMap(r=>{const p=roundedPath(r.points,r.width||8);return p.slice(1).map((b,i)=>({a:p[i],b,width:r.width||8}));}),positions=[],colors=[],uv=[];
 const colorAt=p=>{let best=Infinity,half=4;for(const s of segments){const d=sub(s.b,s.a),t=Math.max(0,Math.min(1,dot(sub(p,s.a),d)/dot(d,d))),distance=Math.hypot(p[0]-s.a[0]-d[0]*t,p[1]-s.a[1]-d[1]*t);if(distance<best){best=distance;half=s.width/2;}}const wheel=Math.exp(-(((best-half*.44)/.40)**2)),dust=Math.max(0,Math.min(1,(best-half*.72)/(half*.28)));return .96-wheel*.17+dust*.10;};
 const emit=(a,b,c,depth=0)=>{const pairs=[[a,b,c],[b,c,a],[c,a,b]].sort((p,q)=>Math.hypot(...sub(q[0],q[1]))-Math.hypot(...sub(p[0],p[1]))),[p,q,r]=pairs[0];if(depth<12&&Math.hypot(...sub(p,q))>2.1){const mid=[(p[0]+q[0])/2,(p[1]+q[1])/2];emit(p,mid,r,depth+1);emit(mid,q,r,depth+1);}else for(const p of [a,b,c]){positions.push(p[0],0,p[1]);uv.push(p[0]/4,-p[1]/4);const tone=colorAt(p);colors.push(tone,tone*.995,tone*.975);}};
 const p=source.attributes.position;for(let i=0;i<p.count;i+=3)emit([p.getX(i),p.getZ(i)],[p.getX(i+1),p.getZ(i+1)],[p.getX(i+2),p.getZ(i+2)]);source.dispose();const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('uv1',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingSphere();return g;
}
function addQuad(out,a,b,width,y=0){const d=sub(b,a),l=Math.hypot(...d);if(l<EPS)return;const n=[-d[1]/l*width/2,d[0]/l*width/2],p=[[a[0]+n[0],a[1]+n[1]],[b[0]+n[0],b[1]+n[1]],[b[0]-n[0],b[1]-n[1]],[a[0]-n[0],a[1]-n[1]]];for(const i of [0,1,2,0,2,3])out.push(p[i][0],y,p[i][1]);}
function stripGeometry(positions){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;}
function curbInside(c,collider){if(!collider||collider.kind==='circle'||(c.height||.15)>(collider.height||0))return false;const yaw=collider.yaw||0,dx=(c.x||0)-collider.x,dz=(c.z||0)-collider.z,cos=Math.cos(yaw),sin=Math.sin(yaw),x=cos*dx-sin*dz,z=sin*dx+cos*dz,angle=(c.yaw||0)-yaw;return Math.abs(x)+Math.abs(Math.cos(angle))*c.width/2+Math.abs(Math.sin(angle))*c.depth/2<=collider.width/2+EPS&&Math.abs(z)+Math.abs(Math.sin(angle))*c.width/2+Math.abs(Math.cos(angle))*c.depth/2<=collider.depth/2+EPS;}

/** Each polygon boundary must be covered by immutable blockers or the world boundary.
 * Segment/box interval coverage is analytic (not a grid probe that can miss narrow gaps). */
export function isWaterEnclosed(spec,water){
 const poly=cleanPoints(water.polygon),bounds=spec.bounds;
 if(poly.length<3||!water.enclosedBy?.length)return false;
 if(poly.some(p=>p[0]<bounds.minX-EPS||p[0]>bounds.maxX+EPS||p[1]<bounds.minZ-EPS||p[1]>bounds.maxZ+EPS))return false;
 const walls=water.enclosedBy.map(id=>(spec.geometry||[]).find(c=>c.id===id));
 // The production hull begins at Y=0: any positive wall volume crossing
 // that plane blocks it. Buried/raised/invalid boxes are not water enclosures.
 if(walls.some(c=>!c||c.kind!=='box'||c.destructible||![c.x,c.z,c.width,c.depth,c.height,c.y??0,c.yaw??0].every(Number.isFinite)||c.width<=0||c.depth<=0||c.height<=0||(c.y??0)>EPS||(c.y??0)+c.height<=EPS))return false;
 return poly.every((a,i)=>{
  const b=poly[(i+1)%poly.length];
  if([[0,bounds.minX],[0,bounds.maxX],[1,bounds.minZ],[1,bounds.maxZ]].some(([axis,v])=>Math.abs(a[axis]-v)<EPS&&Math.abs(b[axis]-v)<EPS))return true;
  const spans=[];
  for(const c of walls){const co=Math.cos(c.yaw||0),si=Math.sin(c.yaw||0),local=p=>[co*(p[0]-c.x)-si*(p[1]-c.z),si*(p[0]-c.x)+co*(p[1]-c.z)],p=local(a),q=local(b);let lo=0,hi=1;
   for(const [axis,half]of [[0,c.width/2],[1,c.depth/2]]){const delta=q[axis]-p[axis];if(Math.abs(delta)<EPS){if(Math.abs(p[axis])>half+EPS){hi=-1;break;}}else{let x=(-half-EPS-p[axis])/delta,y=(half+EPS-p[axis])/delta;if(x>y)[x,y]=[y,x];lo=Math.max(lo,x);hi=Math.min(hi,y);}}
   if(lo<=hi)spans.push([lo,hi]);
  }
  spans.sort((a,b)=>a[0]-b[0]);let through=0;for(const [lo,hi]of spans){if(lo>through+EPS)return false;through=Math.max(through,hi);}return through>=1-EPS;
 });
}

export function createTerrainView(scene,spec,options={}){
 for(const urls of Object.values(options.textureUrls||{}))if(['baseColor','normal','orm'].some(key=>typeof urls[key]!=='string'||!urls[key].startsWith('data:image/')))throw new Error('Terrain textures must be embedded data URLs; external texture requests are not supported.');
 const root=new THREE.Group();root.name='district-terrain';scene.add(root);const geometries=new Set(),materials=new Set(),textures=new Set(),textureLoads=[];const dressing=spec.sceneDressing||{},warnings=[],raisedFootprints=[];let disposed=false,waterMaterial=null;
 function dispose(){if(disposed)return;disposed=true;waterMaterial?.dispose();scene.remove(root);for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();}
 const ownGeometry=g=>(geometries.add(g),g),disposeGeometry=g=>{geometries.delete(g);g.dispose();};
 const ownedContours=(...args)=>ownGeometry(geometryFromContours(...args)),ownedStrip=(...args)=>ownGeometry(stripGeometry(...args));
 try {
 const material=(params)=>{const m=new THREE.MeshStandardMaterial(params);materials.add(m);return m;};
 const pbr=name=>{name=TERRAIN_MATERIALS[name]?name:'concrete';const m=material({color:options.loadTextures===false?({asphalt:0x42423e,concrete:0x858278,earth:0x756d59}[name]):0xffffff,roughness:.9,metalness:0});m.name=`terrain:${name}`;if(options.loadTextures!==false){const urls=options.textureUrls?.[name]||TERRAIN_TEXTURE_URLS[name],loader=new THREE.TextureLoader();for(const [slot,path] of [['map',urls.baseColor],['normalMap',urls.normal],['roughnessMap',urls.orm]]){let settle;textureLoads.push(new Promise(resolve=>{settle=resolve;}));const t=loader.load(path,()=>{if(disposed)t.dispose();settle(true);},undefined,()=>{warnings.push(`Texture failed: ${name}/${slot}`);settle(false);});t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(4,options.maxAnisotropy||4);t.colorSpace=slot==='map'?THREE.SRGBColorSpace:THREE.NoColorSpace;textures.add(t);m[slot]=t;}m.normalScale.set(.55,.55);}return m;};
 const cache=new Map(),getPbr=n=>{n=TERRAIN_MATERIALS[n]?n:'concrete';if(!cache.has(n))cache.set(n,pbr(n));return cache.get(n);};
 const add=(g,m,name,y=0)=>{geometries.add(g);const mesh=new THREE.Mesh(g,m);mesh.name=name;mesh.receiveShadow=true;mesh.castShadow=false;mesh.position.y=y;root.add(mesh);return mesh;};
 const {minX,maxX,minZ,maxZ}=spec.bounds,basePoly=[[minX,minZ],[maxX,minZ],[maxX,maxZ],[minX,maxZ]];
 const waters=(Array.isArray(dressing.water)?dressing.water:dressing.water?[dressing.water]:[]).filter(w=>{if(isWaterEnclosed(spec,w))return true;warnings.push(`Water ${w.id||''} omitted: polygon is not continuously enclosed by immutable blocking geometry and world bounds.`);return false;});
 const waterPolygons=waters.map(w=>{const p=cleanPoints(w.polygon);return polygonArea(p)>0?p:p.reverse();});
 const aprons=(dressing.aprons||[]).map(a=>{const polygon=cleanPoints(a.polygon);if(polygonArea(polygon)<0)polygon.reverse();return {...a,polygon,material:TERRAIN_MATERIALS[a.material]?a.material:'concrete'};}).filter(a=>a.polygon.length>=3),apronPolygons=aprons.map(a=>a.polygon);
 const outerPoly=[[minX-60,minZ-60],[maxX+60,minZ-60],[maxX+60,maxZ+60],[minX-60,maxZ+60]];
 add(ownedContours(unionContours([outerPoly],[basePoly])),getPbr('concrete'),'outside-district-ground',-.012);
 add(ownedContours(unionContours([basePoly],[...waterPolygons,...apronPolygons])),getPbr(typeof dressing.ground==='string'?dressing.ground:dressing.ground?.material||'concrete'),'ground-foundation',-.012);
 const sourceRoads=dressing.roads||spec.routes||[],roads=sourceRoads.filter(r=>Number.isFinite(r.width||8)&&cleanPoints(r.points).length>=2);
 const shoulder={geometry:ownedContours(unionContours(roads.map(r=>ribbon(r.points,(r.width||8)+.84)),[...waterPolygons,...apronPolygons]))};if(shoulder.geometry.attributes.position.count)add(shoulder.geometry,getPbr('concrete'),'road-shoulder',-.006);else disposeGeometry(shoulder.geometry);
 const mainNetwork=buildRoadNetwork(roads);mainNetwork.geometry.dispose();const higherPriorityRoads=[...waterPolygons];
 // Each material is one unioned mesh, including all turns and intersections.
 for(const name of ['asphalt','concrete','earth']){const selected=roads.filter(r=>(r.material||'asphalt')===name),network={geometry:ownedContours(unionContours(selected.map(r=>ribbon(r.points,r.width||8)),higherPriorityRoads))};higherPriorityRoads.push(...selected.map(r=>ribbon(r.points,r.width||8)));if(network.geometry.attributes.position.count){const source=network.geometry;network.geometry=ownGeometry(bakeRoadWear(source,selected));geometries.delete(source);const m=getPbr(name);m.vertexColors=true;add(network.geometry,m,`streets:${name}`);}else disposeGeometry(network.geometry);}
 const apronExclusions=[...higherPriorityRoads];
 for(const name of ['asphalt','concrete','earth']){const selected=aprons.filter(a=>a.material===name),polygons=selected.map(a=>a.polygon),g=ownedContours(unionContours(polygons,apronExclusions));apronExclusions.push(...polygons);if(g.attributes.position.count){const o=add(g,getPbr(name),`service-aprons:${name}`);o.userData.apronIds=selected.map(a=>a.id);}else disposeGeometry(g);}
 for(const surface of spec.surfaces||[]){const polygon=cleanPoints(surface.polygon);if(polygon.length<3)continue;if(polygonArea(polygon)<0)polygon.reverse();add(ownedContours(unionContours([polygon],waterPolygons)),getPbr(surface.class==='rubble'?'earth':'concrete'),`handling-surface:${surface.id}`, .001);}
 const edgePositions=[],paintPositions=[],drainPositions=[],seamPositions=[],apronPositions=[],apronSeams=[];
 const roadPolygons=roads.map(r=>ribbon(r.points,(r.width||8)+.6));
 const edgeGeometry=ownedContours(unionContours(roads.map(r=>ribbon(r.points,r.width||8)),roads.map(r=>ribbon(r.points,Math.max(.2,(r.width||8)-.18)))));
 for(const [roadIndex,road] of roads.entries()){if(road.curb)warnings.push(`Road ${road.id||'(unnamed)'} curb omitted: raised curbs require sceneDressing.curbs with an existing colliderId and an inside-footprint box.`);const pts=roundedPath(road.points,road.width||8);let station=0;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],d=sub(b,a),len=Math.hypot(...d),u=d.map(v=>v/len);if(road.markings!==false){for(let t=0;t<len;t+=.25){const s=station+t;if(s%8<3.2){const end=Math.min(len,t+.25),start=[a[0]+u[0]*t,a[1]+u[1]*t],finish=[a[0]+u[0]*end,a[1]+u[1]*end];if(!roadPolygons.some((poly,index)=>index!==roadIndex&&(inside(start,poly)||inside(finish,poly))))addQuad(paintPositions,start,finish,.12,.002);}}}station+=len;}}
 for(const contour of unionContours(apronPolygons,waterPolygons))for(let i=0;i<contour.length;i++){const a=contour[i],b=contour[(i+1)%contour.length],d=sub(b,a),length=Math.hypot(...d),u=d.map(n=>n/length);for(let t=0;t<length;t+=.25){const end=Math.min(length,t+.25),start=[a[0]+u[0]*t,a[1]+u[1]*t],finish=[a[0]+u[0]*end,a[1]+u[1]*end];if(!roadPolygons.some(p=>inside(start,p)||inside(finish,p)))addQuad(apronSeams,start,finish,.035,.001);}}
 if(apronSeams.length)add(ownedStrip(apronSeams),material({color:0x55584d,roughness:.97}),'service-apron-seams');
 for(const marking of dressing.markings||[]){const pts=cleanPoints(marking.points);for(let i=1;i<pts.length;i++)addQuad(apronPositions,pts[i-1],pts[i],Math.max(.04,Math.min(.3,marking.width||.12)),.002);}
 if(apronPositions.length)add(ownedStrip(apronPositions),material({color:0xad985e,roughness:.97}),'authored-apron-markings');
 // Authored flush drain insets: no fake raised obstacles and no collision mutation.
 for(const drain of dressing.drains||[]){const x=drain.x,z=drain.z,w=drain.width||.7,d=drain.depth||1.1;if(![x,z,w,d].every(Number.isFinite))continue;const yaw=drain.yaw||0,transform=(a,b)=>[x+a*Math.cos(yaw)+b*Math.sin(yaw),z-a*Math.sin(yaw)+b*Math.cos(yaw)];addQuad(drainPositions,transform(0,-d/2),transform(0,d/2),w,.002);for(let k=-d/2+.09;k<d/2;k+=.12)addQuad(seamPositions,transform(-w*.38,k),transform(w*.38,k),.035,.003);}
 if(edgeGeometry.attributes.position.count)add(edgeGeometry,material({color:0x393b35,roughness:.95}),'flush-street-edge',.001);else disposeGeometry(edgeGeometry);
 if(paintPositions.length)add(ownedStrip(paintPositions),material({color:0xad985e,roughness:.97}),'faded-road-paint');
 if(drainPositions.length)add(ownedStrip(drainPositions),material({color:0x252b2a,roughness:.83,metalness:.28}),'flush-drain-insets');
 if(seamPositions.length)add(ownedStrip(seamPositions),material({color:0x5a6059,roughness:.8,metalness:.4}),'flush-drain-bars');
 // Non-driveable water is only shown inside an authored, physically enclosed area.
 if(waters.length)waterMaterial=createWaterMaterial({reducedMotion:options.reducedMotion??globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false});
 for(const [i,water]of waters.entries()){const mesh=add(ownedContours([waterPolygons[i]],8),waterMaterial.material,'enclosed-canal-water',-.065);mesh.userData.enclosedBy=[...water.enclosedBy];}
 for(const c of dressing.curbs||[]){const collider=(spec.geometry||[]).find(b=>b.id===c.colliderId);if(!curbInside(c,collider)){warnings.push(`Curb ${c.id||''} omitted: not contained in collider ${c.colliderId||'(missing)'}.`);continue;}const g=ownGeometry(new THREE.BoxGeometry(c.width,c.height||.15,c.depth));const o=add(g,getPbr('concrete'),'raised-curbs');o.position.set(c.x,(collider.y||0)+(c.height||.15)/2,c.z);o.rotation.y=c.yaw||0;raisedFootprints.push({id:c.id,colliderId:c.colliderId});}
 // Road wear enables vertex colors on cached PBR materials also used by the
 // neutral foundation, shoulders and service pads. Three requires each of those
 // geometries to supply color explicitly; MeshStandardMaterial has no white
 // default attribute. Keep the shared material/texture budget and road wear.
 root.traverse(o=>{if(o.isMesh&&o.material.vertexColors&&!o.geometry.attributes.color)o.geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(o.geometry.attributes.position.count*3).fill(1),3));});
 const diagnostics={warnings,raisedFootprints,drivePlaneY:0,drawCalls:root.children.filter(o=>o.isMesh).length,triangles:[...geometries].reduce((sum,g)=>sum+(g.index?g.index.count:g.attributes.position.count)/3,0),textureCount:textures.size+(waterMaterial?.diagnostics.textureCount||0),pbrMaterials:cache.size+(waterMaterial?1:0),externalRequests:0,textureGpuMiB:textures.size*512*512*4*4/3/1048576+(waterMaterial?.diagnostics.textureGpuMiB||0)};if(diagnostics.drawCalls>TERRAIN_BUDGET.drawCalls)warnings.push('Terrain draw-call budget exceeded.');if(diagnostics.triangles>TERRAIN_BUDGET.triangles)warnings.push('Terrain triangle budget exceeded.');
 return {root,diagnostics,ready:Promise.all([Promise.all(textureLoads),waterMaterial?.ready]).then(([results,water])=>({loaded:results.filter(Boolean).length+(water?.loaded||0),failed:results.filter(result=>!result).length+(water?.failed||0)})),update(dt,frame){if(!disposed)waterMaterial?.update(dt,frame);},dispose};
 }catch(error){dispose();throw error;}
}
