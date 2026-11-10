import records from './generated-records.js';
export {validateMission} from './validate.js';
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;}
const missions=freeze(records);
const byId=new Map(missions.map(m=>[m.id,m]));
export function getMission(id){return byId.get(id);}
export function listMissions(){return missions;}
