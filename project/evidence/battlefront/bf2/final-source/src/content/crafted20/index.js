import {southWharfAdvanced} from './south-wharf-advanced.js';
import {northHarbor} from './north-harbor.js';
import {railWorks} from './rail-works.js';
import {lockside} from './lockside.js';
import {southWharf} from './south-wharf.js';
export {validateCraftedMission} from './validate.js';
export const CAMPAIGN_ID='crafted20-v1';
export const PROGRESS_NAMESPACE='iron-route:crafted20:v1';
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
const missions=freeze([...southWharf,...southWharfAdvanced,...lockside,...railWorks,...northHarbor]);
const byId=new Map(missions.map(m=>[m.id,m]));
export function listCraftedMissions(){return missions;}
export function getCraftedMission(id){return byId.get(id);}
