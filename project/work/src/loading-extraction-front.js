import {createBattlefrontDepotFront} from './battlefront-depot-front.js';
/** Independent defend→escort authoring. All inherited physical data and combat
 * remain unchanged; the public runtime owns hold/reset, choice and release. */
export function createLoadingExtraction(){
 const {spec,field}=createBattlefrontDepotFront();
 spec.id='mission-9090';spec.index=9090;spec.slug='loading-extraction';spec.loadingExtraction=true;spec.optional=true;
 spec.title='装卸点掩护 · 撤离';
 spec.briefing='留在装卸区内掩护装卸，累计守住 18 秒模拟时间；离开会重置尚未完成的准备。准备完成前补给车不能提前出发，完成后驶入东路或西路入口选择撤离路线，再护送补给车到达北侧接应区。按 H 或点车队待命可暂停车队，但待命时敌方炮火仍会继续。东侧硬路短，西侧绕行可借山脊和断墙掩护。补给车被毁或玩家阵亡都会失败；支援车不是护送目标。友军和残骸会挡住炮弹与车辆，无需消灭所有敌人。';
 spec.zones=spec.zones.map(zone=>zone.id==='orders'?{...zone,id:'loading-area'}:zone);
 spec.objectives=[
  {id:'prepare-extraction',type:'defend',title:'掩护装卸 18 秒',requires:[],nextIds:['escort-supply'],targetIds:[],zoneId:'loading-area',duration:18},
  {id:'escort-supply',type:'escort',title:'护送补给车撤离',requires:['prepare-extraction'],nextIds:[],targetIds:['supply'],zoneId:'rendezvous'}
 ];
 spec.entities=spec.entities.map(entity=>entity.id==='supply'?{...entity,activationObjectiveId:'prepare-extraction'}:entity);
 spec.convoyChoice={...spec.convoyChoice,requiresObjectiveId:'prepare-extraction'};
 return {spec,field};
}
