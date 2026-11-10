// Exact canonical form for these small labelled objective DAGs. IDs, declaration
// order, coordinates, rotations and reflections never enter the signature.
function permutations(values){if(values.length<2)return [values];return values.flatMap((v,i)=>permutations(values.filter((_,j)=>i!==j)).map(rest=>[v,...rest]));}
export function canonicalObjectives(objectives,entities=[],geometry=[]){
 const byId=new Map(entities.map(e=>[e.id,e.kind]));for(const c of geometry)byId.set(c.id,c.destructible?'barrier':'solid');
 const labels=objectives.map(o=>JSON.stringify({type:o.type,targets:o.targetIds.map(id=>byId.get(id)||'missing').sort(),zone:!!o.zoneId,duration:o.type==='defend'?o.duration:null}));
 const groups=[...new Set(labels)].sort().map(label=>objectives.map((_,i)=>i).filter(i=>labels[i]===label));
 let candidates=[[]];for(const group of groups)candidates=candidates.flatMap(prefix=>permutations(group).map(order=>[...prefix,...order]));
 let best;
 for(const order of candidates){const position=new Map(order.map((old,index)=>[objectives[old].id,index]));const form=JSON.stringify(order.map(old=>[labels[old],objectives[old].requires.map(id=>position.get(id)).sort((a,b)=>a-b)]));if(best===undefined||form<best)best=form;}
 return best||'[]';
}
