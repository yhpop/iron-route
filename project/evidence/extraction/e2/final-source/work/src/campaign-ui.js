import {nextCampaignMission} from './launch-selection.js';
const PAGE_SIZE = 12;
const OBJECTIVE_LABELS = { breach: '突破标记路障', disable: '绕到侧面，摧毁标记武器', reach: '驶入标记区域', escort: '保护补给车抵达终点', defend: '守住标记区域' };
const FAILURE_MESSAGES = { 'tank-destroyed': '你的坦克已被击毁。利用掩体避开蓄能火线，再试一次。', 'protected-vehicle-destroyed': '受保护的补给车被击毁。先清除沿途威胁，并保持近距护送。' };
const PHASE_TITLE = { paused: '行动暂停', won: '通道已打通', lost: '行动未完成' };
const complete = value => value?.complete === true || ['complete','completed','done'].includes(value?.status);
const objectiveText = objective => objective.title || objective.description || OBJECTIVE_LABELS[objective.type] || '完成标记目标';
const editable = target => target?.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(target?.tagName);
const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };
const setAttribute = (node, name, value) => { if (node.getAttribute(name) !== value) node.setAttribute(name, value); };
const hostile = entity => ['turret', 'drone'].includes(entity.kind);
const isOptional = spec => spec?.optional === true || !!spec?.convoyChoice;
function stagedEscortDanger(mission) {
  const entities = mission?.entities || [], goals = mission?.objectives || [];
  const relay = entities.some(entity => entity.kind === 'truck' && entity.protected !== false &&
    goals.some(goal => goal.id === entity.activationObjectiveId && goal.type === 'escort'));
  const initiallyActiveHostile = entities.some(entity => hostile(entity) && (!entity.activationObjectiveId ||
    (entity.activationPhase === 'active' && goals.some(goal => goal.id === entity.activationObjectiveId && !(goal.requires || []).length))));
  return relay && initiallyActiveHostile;
}

/** Low-chrome DOM HUD. Action callbacks own all game-state changes. */
export function createUI(actions = {}) {
  const document = actions.document || globalThis.document;
  const window = actions.window || document.defaultView || globalThis.window;
  const mount = actions.mount || document.body;
  const assetCredits = document.querySelector('#asset-credits');
  const missions = actions.missions || [];
  const optionalMissions = actions.optionalMissions || [];
  const featuredMissions = actions.featuredMissions || [];
  const campaign = actions.campaign;
  const playerVehicles = actions.playerVehicles || [];
  let vehicleFocusId = null;
  const activeMission = () => state?.mission || spec;
  const isScorched = () => activeMission()?.scorchedFront === true;
  const canSelectVehicle = () => !disposed && !selectorOpen && isScorched() && state?.phase === 'briefing' && viewStatus === 'ready' && typeof actions.selectPlayerVehicle === 'function';
  const optionalLabel = campaign ? '旧版战术试验' : '战术支线';
  const campaignPosition = mission => `${String(missions.findIndex(item => item.id === mission?.id) + 1).padStart(2, '0')} / ${missions.length}`;
  const listeners = [];
  let state, spec, progress, objectiveGuidance, battlefieldGuidance, entryWarning = false, viewStatus = 'ready', viewError = '', selectorOpen = false, page = 0, chapter = 'all', disposed = false, dialogKey = '';
  function element(tag, className, text) {
    const node = document.createElement(tag); node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }
  function on(node, type, handler) { node.addEventListener(type, handler); listeners.push(() => node.removeEventListener(type, handler)); }
  function button(label, action, handler, className = '') {
    const node = element('button', `campaign-button ${className}`, label); node.type = 'button'; node.setAttribute('data-action', action);
    // Detached dialog nodes can be collected: only permanent listeners are retained in listeners.
    node.addEventListener('click', event => { event.stopPropagation(); if (!disposed && !node.disabled) handler(); });
    return node;
  }
  const root = element('div', 'campaign-ui'); mount.append(root);
  const routeLabels=new Map();
  let scannedSnapshot = null, snapshotMissionId = null, restoreStatusFocus = false;
  const isScanned = () => activeMission()?.scannedCover === true;
  const compactStatus = element('section', 'campaign-scanned-status');
  compactStatus.setAttribute('aria-label', '战斗状态');
  const compactHp = element('div', 'campaign-scanned-hp'), compactSupply = element('div', 'campaign-scanned-supply'), compactFiring = element('div', 'campaign-scanned-firing');
  compactStatus.append(compactHp, compactSupply, compactFiring); root.append(compactStatus);
  const statusOpener = button('状态', 'scanned-status', () => {
    if (isScanned() && state?.phase === 'playing' && viewStatus === 'ready') {
      restoreStatusFocus = true;
      actions.pause?.(); // The owner resets held inputs and renders paused state before disclosure.
    }
  }, 'campaign-scanned-opener');
  root.append(statusOpener);
  const hud = element('section', 'campaign-hud'); hud.setAttribute('aria-label', '坦克状态');
  const missionLabel = element('div', 'campaign-mission-label');
  const stats = element('div', 'campaign-stats');
  const hp = element('span', 'campaign-stat'), speed = element('span', 'campaign-stat'), reload = element('span', 'campaign-stat');
  hp.setAttribute('data-stat', 'hp'); speed.setAttribute('data-stat', 'speed'); reload.setAttribute('data-stat', 'reload'); stats.append(hp, speed, reload);
  const objective = element('div', 'campaign-objective'); objective.setAttribute('aria-live', 'polite');
  const objectiveSwitch = button('', 'cycle-objective', () => cycleObjective(), 'campaign-objective-switch');
  objectiveSwitch.hidden = true;
  objectiveSwitch.setAttribute('aria-live', 'polite'); objectiveSwitch.setAttribute('aria-atomic', 'true');
  function canCycleObjective(){return !disposed&&!selectorOpen&&state?.phase==='playing'&&viewStatus==='ready'&&objectiveGuidance?.canCycle===true&&typeof actions.cycleObjective==='function';}
  function cycleObjective(){if(canCycleObjective())actions.cycleObjective();}
  const bearing=element('div','campaign-bearing');const convoyStatus=element('div','campaign-convoy-status');const saveStatus=element('div','campaign-save-status','进度暂无法保存，关闭页面后可能丢失。');saveStatus.setAttribute('role','status');
  // Crossfire awareness stays in the existing HUD, never a world-space panel.
  const supportStatus = element('div', 'campaign-support-status'); supportStatus.hidden = true;
  supportStatus.setAttribute('aria-label', '友军支援状态');
  let bearingLayout=null, supportLayout=null;
  if(document.fonts?.addEventListener)on(document.fonts,'loadingdone',()=>{bearingLayout=null;supportLayout=null;});
  const convoyHealth = element('div', 'campaign-convoy-health'); convoyHealth.hidden = true;
  convoyHealth.setAttribute('role', 'group'); convoyHealth.setAttribute('aria-label', '受保护补给车状态');
  const convoyOverflow = element('div', 'campaign-convoy-overflow');
  let truckRows = [], truckRowsKey = '';
  hud.append(missionLabel, stats, objective,objectiveSwitch,bearing,supportStatus,convoyStatus,convoyHealth,saveStatus); root.append(hud);
  const convoyOrderButton = button('车队待命 · H', 'convoy-order', () => issueConvoyOrder(), 'campaign-convoy-order');
  convoyOrderButton.hidden = true; hud.append(convoyOrderButton);
  function canOrderConvoy() {
    return spec?.convoyCommands === true && state?.phase === 'playing' && viewStatus === 'ready' &&
      (!spec.convoyChoice || Boolean(state.selectedConvoyChoiceId)) &&
      Object.values(state.entities || {}).some(e => e.kind === 'truck' && e.alive && !e.arrived);
  }
  function issueConvoyOrder() { if (canOrderConvoy()) actions.orderConvoy?.(state.convoyOrder === 'hold' ? 'advance' : 'hold'); }
  const navigation = element('nav', 'campaign-nav'); navigation.setAttribute('aria-label', '行动菜单');
  const pause = button('暂停', 'pause', () => actions.pause?.());
  const missionButton = button('关卡', 'missions', () => {
    if (!state) return;
    if (state.phase === 'playing') actions.pause?.();
    selectorOpen = true; chapter = 'all';
    const index = missions.findIndex(mission => mission.id === spec?.id); page = Math.max(0, Math.floor(index / PAGE_SIZE));
    drawDialog(true);
  });
  navigation.append(missionButton, pause);
  const sound = actions.toggleSound ? button('声音关', 'sound', () => { actions.toggleSound(); updateSound(); }, 'campaign-sound-button') : null;
  function updateSound() {
    if (!sound) return;
    const muted = actions.soundMuted ? Boolean(actions.soundMuted()) : true;
    setText(sound, muted ? '声音关' : '声音开');
    setAttribute(sound, 'aria-pressed', String(!muted));
    setAttribute(sound, 'aria-label', muted ? '开启声音' : '关闭声音');
  }
  if (sound) { navigation.append(sound); updateSound(); }
  root.append(navigation);
  const overlay = element('div', 'campaign-modal-layer');
  const dialog = element('section', 'campaign-dialog'); dialog.hidden = true; overlay.hidden = true;
  dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'campaign-dialog-title');
  overlay.append(dialog); root.append(overlay);
  function closeSelector() { selectorOpen = false; drawDialog(true); }
  function unlocked(id) { return (progress?.unlockedIds || [missions[0]?.id || spec?.id]).includes(id); }
  function showEntryWarning() {
    if (!entryWarning) return;
    const warning = element('p', 'campaign-dialog__body campaign-entry-warning', '本次选择已生效，但网址未能更新；刷新可能重新打开之前的行动。');
    warning.setAttribute('role', 'status'); dialog.append(warning);
  }
  function showSelector() {
    const heading = element('h1', 'campaign-dialog__title', campaign ? `${missions.length} 关${campaign.title}` : '选择行动'); heading.id = 'campaign-dialog-title';
    const introduction = element('p', 'campaign-dialog__body', campaign ? `逐关解锁 ${missions.length} 个手工设计任务，已解锁任务可重玩。新战役使用独立存档，不读取或覆盖旧版进度。` : '战术支线可随时试玩，不影响战役进度；普通战役通关后解锁下一关，已解锁任务可随时重玩。');
    const toolbar = element('div', 'campaign-selector-toolbar');
    const filter = element('select', 'campaign-chapter-select'); filter.setAttribute('aria-label', '筛选章节');
    const choices = [['all', '全部章节'], ...[...new Set(missions.map(mission => mission.chapter).filter(value => value !== undefined))].map(value => [String(value), `第 ${value} 章`])];
    for (const [value, text] of choices) { const option = element('option', '', text); option.value = value; filter.append(option); }
    filter.value = chapter;
    filter.addEventListener('change', () => { chapter = filter.value; page = 0; drawDialog(true); });
    toolbar.append(filter, button('返回', 'close-missions', closeSelector));
    const filtered = missions.filter(mission => chapter === 'all' || String(mission.chapter) === chapter);
    const total = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)); page = Math.max(0, Math.min(page, total - 1));
    const grid = element('div', 'campaign-mission-grid');
    for (const mission of filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)) {
      const available = unlocked(mission.id), cleared = Boolean(progress?.bestResults?.[mission.id]);
      const card = button(`${String(mission.index || mission.id.slice(-3)).padStart(3, '0')} · ${mission.title || '行动'}${!available ? ' · 未解锁' : cleared ? ' · 已完成' : ''}`, 'select-mission', () => {
        if (!unlocked(mission.id)) return;
        selectorOpen = false; dialogKey = ''; actions.selectMission?.(mission.id);
      }, 'campaign-mission-card');
      card.setAttribute('data-mission-id', mission.id); card.setAttribute('aria-current', mission.id === spec?.id ? 'true' : 'false'); card.disabled = !available; grid.append(card);
    }
    if (!filtered.length) grid.append(element('p', '', '暂无可选任务'));
    const pagination = element('div', 'campaign-pagination');
    const previous = button('上一页', 'previous-page', () => { page--; drawDialog(true); }); previous.disabled = page === 0;
    const next = button('下一页', 'next-page', () => { page++; drawDialog(true); }); next.disabled = page >= total - 1;
    pagination.append(previous, element('span', 'campaign-page-label', `${page + 1} / ${total}`), next);
    dialog.append(heading, introduction); showEntryWarning();
    if (campaign) dialog.append(toolbar, grid, pagination);
    if (featuredMissions.length) {
      const section = element('section', 'campaign-featured-section');
      section.append(element('h2', 'campaign-dialog__title', '代表关试玩'), element('p', 'campaign-dialog__body', '独立试玩，不改变战役解锁与存档。'));
      for (const {slug, spec: mission} of featuredMissions) {
        const card = button(mission.title, 'select-featured-mission', () => { selectorOpen = false; dialogKey = ''; actions.selectFeaturedMission?.(slug); }, 'campaign-mission-card');
        card.setAttribute('data-featured-slug', slug); card.setAttribute('aria-current', mission.id === spec?.id ? 'true' : 'false'); section.append(card);
      }
      dialog.append(section);
    }
    if (optionalMissions.length) {
      const section = element('section', 'campaign-optional-section'); section.setAttribute('aria-label', optionalLabel);
      section.append(element('h2', 'campaign-dialog__title', optionalLabel), element('p', 'campaign-dialog__body', campaign ? `旧版独立试验 · 不计入这 ${missions.length} 关，不影响新旧战役进度。` : '独立行动 · 不影响战役进度，可随时进入与重试。'));
      const optionalGrid = element('div', 'campaign-mission-grid');
      for (const {slug, spec: mission} of optionalMissions) {
        const card = button(mission.title, 'select-optional-mission', () => {
          selectorOpen = false; dialogKey = ''; actions.selectOptionalMission?.(slug);
        }, 'campaign-mission-card');
        card.setAttribute('data-optional-slug', slug); card.setAttribute('aria-current', mission.id === spec?.id ? 'true' : 'false'); optionalGrid.append(card);
      }
      section.append(optionalGrid); dialog.append(section);
    }
    if (!campaign) dialog.append(toolbar, grid, pagination);
    dialog.setAttribute('data-mode', 'missions');
  }
  function showGarage() {
    if (!isScorched() || !playerVehicles.length) return;
    const garage = element('section', 'scorched-garage');
    garage.setAttribute('aria-label', '出战车辆');
    garage.append(element('h2', 'scorched-garage__heading', '出战车辆'), element('p', 'scorched-garage__note', '选择装备，再打开运输通道。数值为游戏设定。'));
    const grid = element('div', 'scorched-garage__grid');
    const selected = activeMission()?.playerVehicle?.id;
    const value = number => Number.isFinite(number) ? String(Math.round(number * 100) / 100) : '—';
    for (const vehicle of playerVehicles) {
      const text = `${vehicle.title} · ${vehicle.role || ''}\n装甲 ${value(vehicle.hp)} · 单发 ${value(vehicle.weapon?.damage)}\n装填 ${value(vehicle.weapon?.reload)} s · 行驶 ${value(vehicle.controller?.governorCaps?.travel)} m/s\n${vehicle.tradeoff || ''}`;
      const card = button(text, 'select-vehicle', () => {
        if (!canSelectVehicle() || !playerVehicles.some(item => item.id === vehicle.id)) return;
        vehicleFocusId = vehicle.id;
        actions.selectPlayerVehicle(vehicle.id);
      }, 'scorched-vehicle');
      card.setAttribute('data-vehicle-id', vehicle.id);
      card.setAttribute('aria-pressed', String(vehicle.id === selected));
      card.disabled = !canSelectVehicle(); grid.append(card);
    }
    garage.append(grid); dialog.append(garage);
  }
  function showPhase() {
    const phase = state?.phase || 'briefing';
    const title = phase === 'briefing' ? spec?.title || '装甲通道' : PHASE_TITLE[phase] || '装甲通道';
    const heading = element('h1', 'campaign-dialog__title', title); heading.id = 'campaign-dialog-title';
    const eyebrow = element('div', 'campaign-eyebrow', isScorched()?'独立行动 · 不影响战役进度':isOptional(spec)?`${campaign ? '旧版试验' : '支线试玩'} · 不影响战役进度`:campaign ? `${campaign.title} · ${campaignPosition(spec)}` : `行动 ${String(spec?.index || spec?.id?.slice(-3) || 1).padStart(3, '0')}`);
    let message = spec?.briefing || '驾驶坦克打开安全通道。';
    if (phase === 'paused') message = '时间已停止。继续时车辆不会保留之前按住的油门或开火。';
    if (phase === 'won') message = campaign && !isOptional(spec) && spec?.id === missions.at(-1)?.id ? `${missions.length} 关战役已完成。可在选择关卡中重玩已完成的任务。` : state?.result?.message || '本次行动目标已达成。';
    if(phase==='won'&&spec?.convoyChoice){const road=spec.convoyChoice.options?.find(o=>o.id===state.selectedConvoyChoiceId)?.title||(state.selectedConvoyChoiceId==='covered'?'仓库掩护长路':'短路');const trucks=Object.values(state.entities||{}).filter(e=>e.kind==='truck');message=`${road}已完成 · 用时 ${Math.round(state.result?.elapsed||state.elapsed||0)} 秒 · 补给车装甲 ${trucks.map(e=>Math.max(0,Math.round(e.hp))+'/'+e.maxHp).join('、')}`;}
    else if (phase === 'won' && isOptional(spec)) {
      const combat = state.tankCombat || {};
      const armor = Number.isFinite(combat.hp) ? Math.max(0, Math.round(combat.hp)) : '—';
      const maxArmor = Number.isFinite(combat.maxHp) ? combat.maxHp : '—';
      message = `行动已完成 · 用时 ${Math.round(state.result?.elapsed ?? state.elapsed ?? 0)} 秒 · 坦克装甲 ${armor}/${maxArmor} · 开火 ${state.result?.shotsFired ?? combat.shotsFired ?? 0} 次`;
    }
    if (phase === 'lost') message = state?.result?.reason || state?.result?.message || FAILURE_MESSAGES[state?.result?.cause] || '行动未能完成。可立即重试。';
    dialog.append(eyebrow, heading, element('p', 'campaign-dialog__body', message));
    showEntryWarning();
    if (viewStatus !== 'ready') {
      const notice = element('p', 'campaign-dialog__body campaign-resource-status', viewStatus === 'failed' ? `场景资源载入失败：${viewError}。请重试或选择其他关卡。` : '正在载入场景资源，请稍候。');
      notice.setAttribute('role', viewStatus === 'failed' ? 'alert' : 'status'); dialog.append(notice);
    }
    if (phase === 'briefing') {
      showGarage();
      const goals = element('ol', 'campaign-brief-objectives');
      for (const item of spec?.objectives || []) goals.append(element('li', 'campaign-brief-objective', objectiveText(item)));
      dialog.append(goals);
      if(objectiveGuidance?.activeCount>1&&actions.cycleObjective)dialog.append(element('p','campaign-control-hints',
        '追踪只是导航，不会跳过其他目标。行动中按 Q 或点目标条切换追踪。'));
      if (stagedEscortDanger(spec)) dialog.append(element('p', 'campaign-staged-escort-warning',
        '等待放行的接力补给车也需要保护。可暂时离开车队处理威胁，车队会等待；等待不代表安全。'));
      const hints = element('div', 'campaign-control-hints');
      hints.append(element('p', 'campaign-touch-hint', '左摇杆驾驶 · 右摇杆瞄准 · 点按开火\n松开右摇杆会保留世界中的瞄准点，可再点按开火；移动后可重新瞄准。\n低速转弯，高速赶路；加速需持续按住。\n金色圆环：指令目标 · 十字准星：炮口预计命中点（红色：暂不能开火）'));
      hints.append(element('p', 'campaign-desktop-hint', 'W/S 油门与倒车 · A/D 转向 · 空格刹车\n鼠标瞄准 · 左键/F 开火 · Shift 加速 · 1/2/3 限速\n金色圆环：指令目标 · 十字准星：炮口预计命中点（红色：暂不能开火）'));
      dialog.append(hints);
    }
    if (phase === 'paused' && isScanned()) {
      const details = element('section', 'campaign-scanned-details');
      details.setAttribute('aria-label', '完整战斗状态');
      for (const text of scannedSnapshot?.texts || []) if (text) details.append(element('p', 'campaign-dialog__body', text));
      dialog.append(details);
    }
    const footer = element('div', 'campaign-dialog__actions');
    if (phase === 'briefing') { const start = button('开始行动', 'start', () => { if (state?.phase === 'briefing' && viewStatus === 'ready' && !selectorOpen) actions.start?.(); }, 'campaign-button--primary'); start.disabled = viewStatus !== 'ready'; footer.append(start); }
    if (phase === 'paused') { const resume = button('继续行动', 'resume', () => actions.resume?.(), 'campaign-button--primary'); resume.disabled = viewStatus !== 'ready'; footer.append(resume); }
    if (phase !== 'briefing' || viewStatus === 'failed') footer.append(button('重新开始', 'retry', () => { if (isScanned()) { scannedSnapshot = null; restoreStatusFocus = false; } actions.retry?.(); }, phase === 'lost' ? 'campaign-button--primary' : ''));
    if (phase === 'won' && !isOptional(spec)) {
      const next = nextCampaignMission(missions,spec?.id);
      if (next && unlocked(next.id)) footer.append(button('下一关', 'next-mission', () => actions.selectMission?.(next.id), 'campaign-button--primary'));
    }
    footer.append(button('选择关卡', 'open-missions', () => { selectorOpen = true; page = 0; drawDialog(true); }));
    if (phase === 'paused' && isScanned() && sound) footer.append(button(sound.textContent, 'paused-sound', () => { actions.toggleSound(); updateSound(); drawDialog(true); }));
    dialog.append(footer);if(assetCredits){assetCredits.hidden=false;dialog.append(assetCredits);} dialog.setAttribute('data-mode', phase);
  }
  function drawDialog(force = false) {
    const visible = selectorOpen || state?.phase !== 'playing';
    dialog.hidden = !visible; overlay.hidden = !visible;
    if (visible) {
      supportStatus.hidden = true;
      if (convoyStatus.getAttribute('data-recovery-active') === 'true') convoyStatus.hidden = true;
    }
    const key = `${spec?.id}:${state?.phase}:${selectorOpen}:${page}:${chapter}:${(progress?.unlockedIds || []).join(',')}:${entryWarning}:${viewStatus}:${viewError}:${isScorched()}:${isScorched() ? activeMission()?.playerVehicle?.id : ''}`;
    if (!visible) { dialogKey = ''; return; }
    if (!force && key === dialogKey) return;
    dialogKey = key; dialog.replaceChildren();
    if (selectorOpen) showSelector(); else showPhase();
    const vehicleFocus = vehicleFocusId && [...dialog.querySelectorAll('[data-vehicle-id]')].find(node => node.getAttribute('data-vehicle-id') === vehicleFocusId && !node.disabled);
    const primary = vehicleFocus || dialog.querySelector('.campaign-button--primary') || dialog.querySelector('button'); primary?.focus?.({ preventScroll: true });
    if (!isScorched() || state?.phase !== 'briefing') vehicleFocusId = null;
  }
  function drawConvoyHealth() {
    const entities = state?.entities || {}, authored = (spec?.entities || []).filter(entity => entity.kind === 'truck' && entity.protected !== false);
    const listed = new Set(authored.map(entity => entity.id));
    // Runtime insertion order and casualties must never rename the surviving trucks.
    const trucks = authored.map((source, index) => ({ id: source.id, source, number: index + 1, truck: entities[source.id] }))
      .concat(Object.entries(entities).filter(([id, entity]) => !listed.has(id) && entity.kind === 'truck' &&
        !(spec?.entities || []).some(source => source.id === id && source.protected === false))
        .sort(([a], [b]) => a.localeCompare(b)).map(([id, truck], index) => ({ id, source: truck, number: authored.length + index + 1, truck })))
      .filter(({ truck }) => truck?.kind === 'truck' && truck.protected !== false);
    const visible = trucks.slice(0, 3), key = JSON.stringify([spec?.id, visible.map(({ id }) => id)]);
    if (key !== truckRowsKey) {
      truckRowsKey = key;
      truckRows = visible.map(({ id }) => {
        const row = element('div', 'campaign-truck-health'); row.setAttribute('data-truck-id', id);
        const label = element('span', 'campaign-truck-health__label'), health = element('span', 'campaign-truck-health__hp'), status = element('span', 'campaign-truck-health__status');
        row.append(label, health, status); return { row, label, health, status };
      });
      convoyHealth.replaceChildren(...truckRows.map(item => item.row), convoyOverflow);
    }
    const aimingAt = new Set(Object.values(entities).filter(entity => hostile(entity) && entity.alive && entity.status === 'charging').map(entity => entity.targetId));
    visible.forEach(({ id, source, number, truck }, index) => {
      const { row, label, health, status } = truckRows[index];
      const name = source.label || truck.label || `补给车 ${number}`;
      const hpText = `${Number.isFinite(truck.hp) ? Math.max(0, Math.ceil(truck.hp)) : '—'}/${Number.isFinite(truck.maxHp) ? Math.ceil(truck.maxHp) : '—'}`;
      const destroyed = truck.alive === false || truck.destroyed || truck.hp <= 0;
      const aimed = !destroyed && aimingAt.has(id), damaged = !destroyed && truck.hp < truck.maxHp;
      const locked = truck.activationObjectiveId && !complete(state?.objectiveStates?.[truck.activationObjectiveId]);
      const waits = { 'commander-hold': '指挥待命', objective: '待命', 'tank-away': '等待靠近', tank: '等待让路', traffic: '保持车距', obstacle: '前方受阻', 'route-choice': '等待选路' };
      const movement = destroyed ? '已击毁' : truck.arrived ? '已抵达' : locked ? '待命' : waits[truck.stoppedReason] || (truck.speed > 0 ? '行进中' : '待出发');
      const statusText = movement + (aimed ? ' · 正被瞄准' : damaged ? ' · 已受损' : '');
      setText(label, name); setText(health, hpText); setText(status, statusText);
      setAttribute(row, 'aria-label', `${name}，装甲 ${hpText}，${statusText}`);
      setAttribute(row, 'data-condition', destroyed ? 'destroyed' : aimed ? 'aimed' : damaged ? 'damaged' : 'intact');
    });
    const overflow = Math.max(0, trucks.length - visible.length);
    setText(convoyOverflow, overflow ? `另有 ${overflow} 辆受保护补给车未显示` : ''); convoyOverflow.hidden = !overflow;
    convoyHealth.hidden = !trucks.length;
  }
  function drawBattlefieldGuidance() {
    const allowed = activeMission()?.crossfireFront === true && state?.phase === 'playing' &&
      viewStatus === 'ready' && !selectorOpen && !document.hidden;
    const support = allowed ? battlefieldGuidance?.support : null;
    const recovery = allowed ? battlefieldGuidance?.recovery : null;
    supportStatus.hidden = !support?.total;
    if (support?.total) {
      const style = window.getComputedStyle?.(supportStatus);
      const key = JSON.stringify([support.text,support.compactText,supportStatus.clientWidth || 0,
        style?.font,style?.letterSpacing,style?.wordSpacing]);
      if (supportLayout?.key !== key) {
        // Measure nowrap first. Only the final wrap tier may grow vertically;
        // it never silently drops range, life or engagement to a count-only chip.
        setAttribute(supportStatus, 'data-guidance-detail', 'detail');
        setText(supportStatus, support.text);
        let detail = 'detail';
        if (supportStatus.clientWidth > 0 && supportStatus.scrollWidth > supportStatus.clientWidth + 1) {
          setText(supportStatus, support.compactText || support.text);
          detail = supportStatus.scrollWidth > supportStatus.clientWidth + 1 ? 'wrap' : 'compact';
        }
        supportLayout = {key,text:supportStatus.textContent,detail};
      }
      setText(supportStatus, supportLayout.text);
      setAttribute(supportStatus, 'data-guidance-detail', supportLayout.detail);
      setAttribute(supportStatus, 'aria-label', support.accessibilityLabel || support.text);
    } else {
      supportLayout = null; setAttribute(supportStatus, 'data-guidance-detail', 'none');
      setText(supportStatus, ''); setAttribute(supportStatus, 'aria-label', '友军支援状态');
    }
    setAttribute(convoyStatus, 'data-recovery-active', String(Boolean(recovery)));
    if (recovery) {
      setText(convoyStatus, recovery.compactText || recovery.text);
      setAttribute(convoyStatus, 'aria-label', recovery.accessibilityLabel || recovery.text);
      convoyStatus.hidden = false;
    } else setAttribute(convoyStatus, 'aria-label', convoyStatus.textContent);
  }
  function render(nextState, nextSpec, nextProgress, status = {}) {
    if (disposed) return;
    if (spec && spec.id !== nextSpec?.id) selectorOpen = false;
    for(const label of routeLabels.values())label.hidden=true;
    for(const item of status.routeLabels||[]){let label=routeLabels.get(item.id);if(!label){label=element('span','campaign-route-label');label.setAttribute('data-route-zone',item.id);root.append(label);routeLabels.set(item.id,label);}setText(label,item.title);label.style.left=item.x+'px';label.style.top=item.y+'px';label.hidden=false;}
    const previousPhase = state?.phase;
    state = nextState; spec = nextSpec || state?.mission; progress = nextProgress || {}; objectiveGuidance = status.objectiveGuidance; battlefieldGuidance = status.battlefieldGuidance; entryWarning = status.entryWarning === true; viewStatus = status.viewStatus || 'ready'; viewError = status.viewError || '';
    const scanned = isScanned();
    const identity = activeMission()?.id;
    if (!scanned || identity !== snapshotMissionId || viewStatus !== 'ready' || !['playing', 'paused'].includes(state?.phase)) scannedSnapshot = null;
    snapshotMissionId = identity;
    setAttribute(root, 'data-scanned-cover', String(scanned));
    if (document.documentElement) setAttribute(document.documentElement, 'data-scanned-cover', String(scanned));
    compactStatus.hidden = statusOpener.hidden = !scanned || state?.phase !== 'playing';
    statusOpener.disabled = viewStatus !== 'ready';
    setAttribute(root, 'data-scorched-front' , String(isScorched()));
    setAttribute(root, 'data-crossfire-front', String(activeMission()?.crossfireFront === true));
    setAttribute(root, 'data-crossfire-v3', String(activeMission()?.crossfireV3 === true));
    const crossfireV4 = activeMission()?.crossfireV4 === true;
    setAttribute(root, 'data-crossfire-v4', String(crossfireV4));
    if (document.documentElement) setAttribute(document.documentElement, 'data-crossfire-v4', String(crossfireV4));
    setAttribute(hud, 'tabindex', crossfireV4 ? '0' : '-1');
    setAttribute(root, 'data-phase', state?.phase || 'briefing');
    setText(missionLabel, isScorched()?`独立行动 · ${spec.title}`:isOptional(spec)?`${campaign ? '旧版试验' : '支线'} · ${spec.title}`:campaign ? `${campaignPosition(spec)} · ${spec?.title || campaign.title}` : `${String(spec?.index || spec?.id?.slice(-3) || 1).padStart(3, '0')} · ${spec?.title || '装甲通道'}`);
    const combat = state?.tankCombat || {}, tank = state?.tank || {}, frame = state?.tankFrame || {};
    setText(hp, `装甲 ${Math.max(0, Math.ceil(combat.hp ?? 100))}`);
    const velocity = Number.isFinite(frame.speedForward) ? frame.speedForward : ((tank.vL || 0) + (tank.vR || 0)) / 2;
    setText(speed, `${Math.abs(velocity * 3.6).toFixed(1)} km/h${velocity < -0.05 ? ' 倒车' : ''}`);
    // A blocked turret sweep does not obstruct the accepted muzzle direction.
    const countdown = (Math.max(1, Math.ceil(combat.reload * 10 - 1e-9)) / 10).toFixed(1);
    const cycleLabel = combat.magazineSize ? (combat.ammo === 0 ? '整仓装填' : '射击间隔') : '装填';
    const firingStatus = tank.blocked?.muzzle ? '炮口受阻' : combat.reload > 0 ? `${cycleLabel} ${countdown}s` : '可开火';
    setText(reload, firingStatus + (state.tankFrame?.travelClearance ? ' · 行驶抬炮' : '') + (tank.blocked?.barrel && !tank.blocked?.muzzle ? ' · 转向受限' : ''));
    setAttribute(reload, 'data-ready', String(!(combat.reload > 0) && !tank.blocked?.muzzle));
    const goals = spec?.objectives || [], done = goals.filter(item => complete(state?.objectiveStates?.[item.id])).length;
    const active = objectiveGuidance?.objective || goals.find(item => state?.objectiveStates?.[item.id]?.status === 'active') || goals.find(item => !complete(state?.objectiveStates?.[item.id]));
    // Candidate-only, real simulated hold time; reuse this existing HUD node.
    const preparation = spec?.loadingExtraction && active?.id === 'prepare-extraction' && !complete(state?.objectiveStates?.[active.id]) && Number.isFinite(active.duration) && active.duration > 0;
    const activeText = preparation ? `装卸掩护 · ${Math.max(0, active.duration - (state?.objectiveStates?.[active.id]?.elapsed || 0)).toFixed(1)}s` : active && objectiveText(active);
    setText(objective, active ? `${done}/${goals.length} · ${activeText}` : '全部目标完成');
    const parallel=objectiveGuidance?.activeCount>1&&!objectiveGuidance.routeChoicePending&&state?.phase==='playing'&&viewStatus==='ready'&&typeof actions.cycleObjective==='function';
    objective.hidden=parallel;objectiveSwitch.hidden=!parallel;objectiveSwitch.disabled=!canCycleObjective();
    if(parallel){
      const rule=objectiveGuidance.freeOrder?'先后自定，全部须完成':'并行目标，全部须完成';
      setText(objectiveSwitch,`${done}/${goals.length} · ${objectiveText(active)}\n${rule} · Q / 点按切换`);
      setAttribute(objectiveSwitch,'aria-label',`当前追踪：${objectiveText(active)}。${rule}。按 Q 或点击切换追踪，不改变任务条件。`);
      setAttribute(objectiveSwitch,'data-tracked-objective',active.id);
    }
    const waiting=Object.values(state?.entities||{}).find(e=>e.kind==='truck'&&e.alive&&!e.arrived&&e.stoppedReason);
    const reasons={'commander-hold':'车队按令待命：敌火仍在，清路后继续护送','tank-away':'补给车等待：请靠近车队','tank':'补给车等待：请让出车道','traffic':'车队正在保持安全间距','obstacle':'补给车前方受阻：请清障或让路','objective':'补给车等待道路放行','route-choice':spec?.convoyChoice?.prompt||'直行选短路（有火力），左转选长路（仓库掩护）；驶入后锁定'};
    setText(convoyStatus, waiting?(reasons[waiting.stoppedReason]||'补给车等待通行'):'');convoyStatus.hidden=!waiting;
    drawConvoyHealth();
    drawBattlefieldGuidance();
    saveStatus.hidden=progress?.storageAvailable!==false;
    // Reuse the existing goal-bearing line, rather than adding another overlay
    // over the playfield. The model is transient render status, never a save field.
    const charge = state?.phase === 'playing' && viewStatus === 'ready' && status.chargeWarnings?.total > 0 ? status.chargeWarnings : null;
    const hit = !charge && state?.phase === 'playing' && viewStatus === 'ready' && spec?.design?.integratedSlice === true ? status.hitFeedback : null;
    const bearingText = charge?.text || hit?.text || progress?.goalHint || '';
    bearing.hidden=!bearingText;
    setAttribute(bearing,'data-charge-warning',String(Boolean(charge)));
    setAttribute(bearing,'data-hit-feedback',hit?.kind || 'none');
    setAttribute(bearing,'data-hit-feedback-active',String(Boolean(hit)));
    let chargeDetail = charge ? (charge.overflow ? 'summary' : 'detail') : 'none',layoutBlocked=false;
    if(charge){
     const style=window.getComputedStyle?.(bearing),fontKey=[style?.font,style?.letterSpacing,style?.wordSpacing,style?.textTransform];
     const keyAt=width=>JSON.stringify([charge.signature,charge.text,charge.fallbackText,charge.compactText,charge.minimalText,charge.total,Boolean(charge.overflow),width,...fontKey]);
     const key=keyAt(bearing.clientWidth||0);
     if(bearingLayout?.key===key){setText(bearing,bearingLayout.text);chargeDetail=bearingLayout.detail;layoutBlocked=bearingLayout.blocked;}
     else{
      setText(bearing,bearingText);
      if(bearing.clientWidth>0){
       // Measure each representation only when its content/width/font changed;
       // identical RAFs must not rewrite the long label and force fallback again.
       for(const [detail,text]of [['summary',charge.fallbackText],['compact',charge.compactText],['minimal',charge.minimalText],['count-only',`⚠${charge.total}`]]){
        if(bearing.scrollWidth<=bearing.clientWidth+1)break;
        if(text){setText(bearing,text);chargeDetail=detail;}
       }
       layoutBlocked=bearing.scrollWidth>bearing.clientWidth+1;
      }
      bearingLayout={key:keyAt(bearing.clientWidth||0),text:bearing.textContent,detail:chargeDetail,blocked:layoutBlocked};
     }
    }else if(hit){
     const style=window.getComputedStyle?.(bearing),width=bearing.clientWidth||0;
     const key=JSON.stringify(['hit',hit.eventId,hit.text,hit.compactText,hit.minimalText,width,style?.font,style?.letterSpacing,style?.wordSpacing]);
     if(bearingLayout?.key===key)setText(bearing,bearingLayout.text);
     else{setText(bearing,bearingText);if(width>0)for(const text of [hit.compactText,hit.minimalText]){if(bearing.scrollWidth<=width+1)break;if(text)setText(bearing,text);}bearingLayout={key,text:bearing.textContent};}
    }else{bearingLayout=null;setText(bearing,bearingText);}
    setAttribute(bearing,'data-charge-detail',chargeDetail);
    setAttribute(bearing,'data-charge-summary',String(Boolean(charge)&&chargeDetail!=='detail'));
    setAttribute(bearing,'data-charge-layout-blocked',String(layoutBlocked));
    const accessibleCharge = charge && ['minimal','count-only'].includes(chargeDetail) ? `${charge.accessibilityLabel} ${charge.text}` : charge?.accessibilityLabel;
    setAttribute(bearing,'aria-label',accessibleCharge || hit?.text || bearingText);
    setText(compactHp, hp.textContent);
    setText(compactSupply, truckRows.length ? `补给 ${truckRows.map(({health}) => health.textContent).join(' · ')}` : '补给 —');
    const fullConvoy = truckRows.map(({row}) => row.getAttribute('aria-label')).join(' · ');
    setAttribute(compactSupply, 'aria-label', fullConvoy);
    setText(compactFiring, firingStatus);
    setAttribute(compactFiring, 'aria-label', reload.textContent);
    setText(statusOpener, charge ? `⚠${charge.total}` : '状态');
    setAttribute(statusOpener, 'aria-label', charge ? `暂停查看状态：${charge.accessibilityLabel || ''} ${charge.text}` : '暂停查看状态');
    if (scanned && state?.phase === 'playing' && viewStatus === 'ready' && !selectorOpen && !document.hidden) {
      scannedSnapshot = {texts: [missionLabel.textContent, hp.textContent, speed.textContent, reload.textContent,
        objective.textContent, battlefieldGuidance?.support?.accessibilityLabel || battlefieldGuidance?.support?.text,
        battlefieldGuidance?.recovery?.accessibilityLabel || battlefieldGuidance?.recovery?.text || convoyStatus.textContent,
        charge ? `${charge.accessibilityLabel || ''} ${charge.text}` : hit?.text || bearingText,
        fullConvoy, !saveStatus.hidden ? saveStatus.textContent : '']};
    }
    pause.hidden = state?.phase !== 'playing';
    updateSound();
    hud.hidden = state?.phase === 'briefing';
    convoyOrderButton.hidden = spec?.convoyCommands !== true;
    convoyOrderButton.disabled = !canOrderConvoy();
    setText(convoyOrderButton, state.convoyOrder === 'hold' ? '继续护送 · H' : '车队待命 · H');
    setAttribute(convoyOrderButton, 'aria-pressed', String(state.convoyOrder === 'hold'));
    drawDialog();
    if (restoreStatusFocus && previousPhase === 'paused' && state?.phase === 'playing') {
      const compactViewport = window.innerWidth > window.innerHeight && window.innerHeight <= 560;
      (compactViewport ? statusOpener : pause).focus?.({preventScroll:true}); restoreStatusFocus = false;
    }
    if (!scanned || !['playing','paused'].includes(state?.phase)) restoreStatusFocus = false;
    // World labels may project into variable-height HUD text. Measure after all
    // text/layout updates, not using fixed screen margins. Hide rather than
    // relocate a label away from its physical choice circle.
    const blockers = [hud, navigation, ...(crossfireV4 ? [convoyOrderButton] : []), ...(scanned ? [compactStatus, statusOpener] : [])].filter(node => !node.hidden && window.getComputedStyle?.(node)?.display !== 'none').map(node => node.getBoundingClientRect());
    for (const label of routeLabels.values()) {
      if (label.hidden) continue;
      const box = label.getBoundingClientRect();
      label.hidden = blockers.some(b => b.width > 0 && b.height > 0 &&
        box.left < b.left + b.width + 6 && box.left + box.width > b.left - 6 &&
        box.top < b.top + b.height + 6 && box.top + box.height > b.top - 6);
    }
  }
  on(window, 'keydown', event => {
    if (disposed || event.repeat || (event.code !== 'Tab' && event.code !== 'Escape' && editable(event.target))) return;
    if (event.code === 'KeyQ' && !event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.shiftKey&&canCycleObjective()) { event.preventDefault(); cycleObjective(); }
    else if (event.code === 'KeyH' && canOrderConvoy()) { event.preventDefault(); issueConvoyOrder(); }
    else if (event.code === 'Escape') {
      event.preventDefault();
      if (selectorOpen) closeSelector(); else if (state?.phase === 'playing') actions.pause?.(); else if (state?.phase === 'paused') actions.resume?.();
    } else if (event.code === 'KeyR' && ['lost','won','paused'].includes(state?.phase)) { event.preventDefault(); if (isScanned()) { scannedSnapshot = null; restoreStatusFocus = false; } actions.retry?.(); }
    else if (event.code === 'Tab' && !dialog.hidden) {
      const focusable = dialog.querySelectorAll('button, select'); const controls = [...focusable].filter(node => !node.disabled && !node.hidden);
      if (!controls.length) return;
      const index = controls.indexOf(document.activeElement), next = event.shiftKey ? (index <= 0 ? controls.length - 1 : index - 1) : (index + 1) % controls.length;
      event.preventDefault(); controls[next].focus();
    }
  });
  function dispose() { if (disposed) return; disposed = true; scannedSnapshot = null; restoreStatusFocus = false; if (document.documentElement) setAttribute(document.documentElement, 'data-scanned-cover', 'false'); for (const remove of listeners) remove(); if (document.documentElement) setAttribute(document.documentElement, 'data-crossfire-v4', 'false'); root.remove(); }
  return { render, dispose };
}
