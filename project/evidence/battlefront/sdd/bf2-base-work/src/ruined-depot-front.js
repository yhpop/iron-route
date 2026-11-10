import {createScannedCoverFront} from './scanned-cover-front.js';
import {roadSample} from './terrain-candidate/heightfield.js';
import {RUINED_DEPOT_LAYOUT,RUINED_DEPOT_FOUNDATIONS,ruinedDepotColliders} from './ruined-depot-layout.js';
const smooth=t=>t*t*(3-2*t);
/** New optional mission. Copies the field; original builders and every protected
 * road/spawn/opening grid sample remain byte-exact. No invisible floor collider. */
export function createRuinedDepotFront(){
 const {spec,field:original}=createScannedCoverFront(),field={...original,heights:new Float64Array(original.heights)};
 const spawn=spec.spawn;
 for(let j=0;j<=field.rows;j++)for(let i=0;i<=field.columns;i++){
  const x=field.bounds.minX+i*field.dx,z=field.bounds.minZ+j*field.dz,k=j*(field.columns+1)+i;
  if(roadSample(original.roads,x,z).edge<=.5||Math.hypot(x-spawn.x,z-spawn.z)<=5||(x>=-9&&x<=6&&z>=12&&z<=22))continue;
  for(const p of RUINED_DEPOT_FOUNDATIONS){const distance=Math.max(p.minX-x,x-p.maxX,p.minZ-z,z-p.maxZ,0);if(distance>=p.blend)continue;const weight=1-smooth(distance/p.blend);field.heights[k]+=weight*(p.height-field.heights[k]);}
 }
 spec.id='mission-9070';spec.index=9070;spec.slug='ruined-depot';spec.ruinedDepot=true;
 spec.title='废弃货场 · 断墙护送';
 spec.briefing='护送补给车到达北侧接应区。山脊工房、装卸区断墙与东侧窗墙都是真实掩体；炮弹可穿过窗口和低矮缺口，但人行破口不是坦克通道。东路较短却有敌车封锁，西路可借山脊掩护。按 H 或点车队待命，先侦察再推进。友军与残骸会挡住炮弹和车辆，别挡住友军炮口或把敌车残骸留在车队路线上。无需消灭所有敌人。';
 spec.ruinedDepotLayout=RUINED_DEPOT_LAYOUT;spec.ruinedDepotFoundations=RUINED_DEPOT_FOUNDATIONS;
 spec.geometry=[...spec.geometry.filter(c=>c.id!=='scorched-east-low-wall'),...ruinedDepotColliders()];
 spec.design={...spec.design,terrainChange:'One bounded cut/fill workshop pad; protected roads/spawn/opening unchanged; same field for rendering and physics',ruinCollision:'757 exact exported triangles for new projectile/LOS rays; 61 conservative movement spans, omitted rebar/crown mass',ruinComposition:'Three coherent structures. West loading bay relocated to level apron: not universally visible from the opening camera.'};
 return {spec,field};
}
