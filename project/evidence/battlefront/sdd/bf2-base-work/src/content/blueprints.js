import {box,rectangle,trace,pathBlocker} from './geometry.js';
const p=(x,z)=>({x,z});
const key=p=>`${p.x},${p.z}`;
const all=[];
// Thirty genuinely different SERIES-THETA road-region graphs: block count and
// distinguished branch count alter articulation/cycle structure, not coordinates.
// Each graph edge is physically realized by a corridor between solid wall slabs.
for(let blocks=2;blocks<=7;blocks++)for(let extra=1;extra<=5;extra++){
 const n=all.length+1,lanesPerBlock=Array.from({length:blocks},(_,i)=>i===Math.floor(blocks/2)?extra+1:2);
 const maxLanes=Math.max(...lanesPerBlock),half=maxLanes*7+8,maxLane=(maxLanes-1)*7;
 const roomZ=i=>12-44*i,bounds={minX:-half-2,maxX:half+2,minZ:roomZ(blocks)-12,maxZ:38};
 const geometry=[box('edge-west',-half-1,(bounds.minZ+38)/2,2,38-bounds.minZ),box('edge-east',half+1,(bounds.minZ+38)/2,2,38-bounds.minZ),box('edge-north',0,bounds.minZ+1,2*half,2),box('edge-south',0,37,2*half,2)];
 const corridors=[],regions=[],roadEdges=[],routes=[],surfaces=[],nodes=new Map(),edges=[];
 const node=pos=>{const id=key(pos);if(!nodes.has(id))nodes.set(id,{id,...pos});return id;};
 const link=(a,b)=>{const from=node(a),to=node(b);edges.push({from,to});};
 for(let i=0;i<=blocks;i++)regions.push({id:`junction-${i}`,kind:'junction',x:0,z:roomZ(i)});
 for(let i=0;i<blocks;i++){
  const count=lanesPerBlock[i],xs=Array.from({length:count},(_,j)=>(j-(count-1)/2)*14),z0=roomZ(i),z1=roomZ(i+1);
  let cursor=-half;
  for(let j=0;j<xs.length;j++){
   const x=xs[j],width=j===0?9:8;
   if(x-width/2>cursor)geometry.push(box(`divider-${i}-${j}`,(cursor+x-width/2)/2,(z0+z1)/2,(x-width/2)-cursor,28,3.2));
   cursor=x+width/2;
   const id=`lane-${i}-${j}`;regions.push({id,kind:'lane',x,z:(z0+z1)/2});
   roadEdges.push({from:`junction-${i}`,to:id},{from:id,to:`junction-${i+1}`});
   const points=[p(x,z0),p(x,z0-12),p(x,z1)];
   corridors.push({id,block:i,lane:j,x,width,front:z0,end:z1,points});
   routes.push({id:`road-${i}-${j}`,points,width,branchGroup:`choice-${i}`});
   link(points[0],points[1]);link(points[1],points[2]);
   if((i+j)%2)surfaces.push({id:`rubble-${i}-${j}`,class:'rubble',traction:0.66,drag:1.4,polygon:rectangle(x,(z0+z1)/2,width,26)});
  }
  if(cursor<half)geometry.push(box(`divider-${i}-outer`,(cursor+half)/2,(z0+z1)/2,half-cursor,28,3.2));
 }
 for(let i=0;i<=blocks;i++){
  const xs=[...new Set([0,-maxLane,maxLane,...corridors.filter(c=>c.block===i||c.block===i-1).map(c=>c.x)])].sort((a,b)=>a-b);
  for(let j=1;j<xs.length;j++)link(p(xs[j-1],roomZ(i)),p(xs[j],roomZ(i)));
 }
 link(p(0,18),p(0,roomZ(0)));
 // Region graph signature is exact for this verified family (a chain of theta
 // blocks). We do NOT present this as a universal graph-isomorphism algorithm.
 const forward=lanesPerBlock.join(','),reverse=[...lanesPerBlock].reverse().join(',');
 const canonicalTopology=`series-theta:${[forward,reverse].sort()[0]}`;
 const vertexCount=regions.length,edgeCount=roadEdges.length,cycleRank=edgeCount-vertexCount+1;
 const blueprint={id:`route-${String(n).padStart(2,'0')}`,chapter:blocks-1,blocks,extra,lanesPerBlock,half,maxLane,bounds,geometry,surfaces,routes,corridors,regions,roadEdges,nodes:[...nodes.values()],edges,roomZ:Array.from({length:blocks+1},(_,i)=>roomZ(i)),canonicalTopology,cycleRank,articulationCount:blocks-1};
 all.push(blueprint);
}
export const BLUEPRINTS=all;
let auditCache;
export function auditBlueprints(){
 if(auditCache)return auditCache;
 auditCache=BLUEPRINTS.map(b=>{
  let verifiedRoadEdges=0;const failures=[];
  const actual=analyzeRoadGraph(b.regions,b.roadEdges);if(actual.canonicalTopology!==b.canonicalTopology)failures.push('declared topology disagrees with actual adjacency');
  for(const corridor of b.corridors){const hit=pathBlocker(trace(corridor.points),b.geometry,b.bounds);if(hit)failures.push(`${corridor.id}:${hit.id}`);else verifiedRoadEdges+=2;}
  // A graph-only claim would be insufficient: every nav connection is also swept.
  const nodes=new Map(b.nodes.map(n=>[n.id,n]));
  for(const e of b.edges){const hit=pathBlocker(trace([nodes.get(e.from),nodes.get(e.to)]),b.geometry,b.bounds);if(hit)failures.push(`junction:${hit.id}`);}
  return {id:b.id,...actual,verifiedRoadEdges,geometryRealized:failures.length===0,failures};
 });return auditCache;
}
export function navigationPath(b,start,end,blockers=[]){
 const nodes=new Map(b.nodes.map(n=>[n.id,n])),adj=new Map(b.nodes.map(n=>[n.id,[]]));
 const startId=key(start),endId=key(end);
 if(!nodes.has(startId)||!nodes.has(endId))throw new Error(`Missing navigation endpoint ${b.id}: ${startId} / ${endId}`);
 for(const edge of b.edges){const a=nodes.get(edge.from),c=nodes.get(edge.to);const near=blockers.filter(v=>{const r=v.kind==='circle'?v.radius:Math.hypot(v.width,v.depth)/2;return v.x+r+3.4>=Math.min(a.x,c.x)&&v.x-r-3.4<=Math.max(a.x,c.x)&&v.z+r+3.4>=Math.min(a.z,c.z)&&v.z-r-3.4<=Math.max(a.z,c.z);});if(near.length&&pathBlocker(trace([a,c]),near,b.bounds))continue;const cost=Math.hypot(a.x-c.x,a.z-c.z);adj.get(edge.from).push({id:edge.to,cost});adj.get(edge.to).push({id:edge.from,cost});}
 const distance=new Map([[startId,0]]),previous=new Map(),open=new Set([startId]);
 while(open.size){const id=[...open].sort((a,c)=>distance.get(a)-distance.get(c))[0];open.delete(id);if(id===endId)break;
  for(const e of adj.get(id)){const d=distance.get(id)+e.cost;if(d<(distance.get(e.id)??Infinity)){distance.set(e.id,d);previous.set(e.id,id);open.add(e.id);}}
 }
 if(!distance.has(endId))throw new Error(`No open route ${b.id}: ${startId} -> ${endId}`);
 const out=[];for(let id=endId;id;id=previous.get(id))out.push(p(nodes.get(id).x,nodes.get(id).z));return out.reverse();
}

// Independently derive the family canonical form from unlabeled adjacency.
// Tarjan's biconnected components detect the actual articulations and theta
// blocks; declaration order, authored block labels and coordinates are ignored.
export function analyzeRoadGraph(regions,roadEdges){
 const adjacency=new Map(regions.map(n=>[n.id,[]]));
 if(adjacency.size!==regions.length||!regions.length)throw new Error('Invalid graph vertices');
 for(let i=0;i<roadEdges.length;i++){
  const e=roadEdges[i];if(!adjacency.has(e.from)||!adjacency.has(e.to)||e.from===e.to)throw new Error('Invalid graph edge');
  adjacency.get(e.from).push({id:e.to,edge:i});adjacency.get(e.to).push({id:e.from,edge:i});
 }
 const discovered=new Map(),low=new Map(),articulations=new Set(),stack=[],components=[];let clock=0;
 function dfs(id,parentEdge=-1){
  discovered.set(id,++clock);low.set(id,clock);let children=0;
  for(const e of adjacency.get(id)){
   if(e.edge===parentEdge)continue;
   if(!discovered.has(e.id)){
    children++;stack.push(e.edge);dfs(e.id,e.edge);low.set(id,Math.min(low.get(id),low.get(e.id)));
    if(low.get(e.id)>=discovered.get(id)){
     if(parentEdge!==-1||children>1)articulations.add(id);
     const edges=[];let next;do{next=stack.pop();edges.push(next);}while(next!==e.edge);components.push(edges);
    }
   }else if(discovered.get(e.id)<discovered.get(id)){stack.push(e.edge);low.set(id,Math.min(low.get(id),discovered.get(e.id)));}
  }
 }
 dfs(regions[0].id);if(discovered.size!==regions.length)throw new Error('Road graph is not connected');
 const membership=new Map(),branchCounts=[];
 for(let i=0;i<components.length;i++){
  const degrees=new Map();for(const index of components[i])for(const id of [roadEdges[index].from,roadEdges[index].to])degrees.set(id,(degrees.get(id)||0)+1);
  const lanes=components[i].length/2,values=[...degrees.values()].sort((a,b)=>a-b);
  if(lanes<2||!Number.isInteger(lanes)||degrees.size!==lanes+2||values.some((d,j)=>d!==(j<lanes?2:lanes)))throw new Error('Road graph is not a series-theta family');
  branchCounts.push(lanes);for(const id of degrees.keys()){if(!membership.has(id))membership.set(id,[]);membership.get(id).push(i);}
 }
 const blocks=components.map(()=>[]);
 for(const id of articulations){const parts=membership.get(id);if(parts.length!==2)throw new Error('Road graph is not a series-theta chain');blocks[parts[0]].push(parts[1]);blocks[parts[1]].push(parts[0]);}
 if(blocks.some(v=>v.length>2))throw new Error('Road graph is not a series-theta chain');
 const ends=blocks.map((v,i)=>v.length<=1?i:-1).filter(i=>i>=0);
 if(components.length>1&&ends.length!==2)throw new Error('Road graph is not a series-theta chain');
 function order(start){const result=[];let last=-1,current=start;while(current!==undefined){result.push(branchCounts[current]);const next=blocks[current].find(i=>i!==last);last=current;current=next;}return result;}
 const sequences=ends.map(start=>order(start));if(sequences.some(s=>s.length!==components.length))throw new Error('Road graph incomplete chain');
 const canonical=sequences.map(s=>s.join(',')).sort()[0];
 return {canonicalTopology:`series-theta:${canonical}`,vertexCount:regions.length,roadEdges:roadEdges.length,cycleRank:roadEdges.length-regions.length+1,articulationCount:articulations.size};
}
