/** Browser-only adapter for the nested drivetrain TankInput contract. No simulation state is mutated. */
const GOVERNORS = ['crawl', 'cruise', 'travel'];
const KEYS = new Set(['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight','KeyF','Digit1','Digit2','Digit3']);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const editable = target => target?.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(target?.tagName);

export function createInput(canvas, options = {}) {
  const document = options.document || canvas.ownerDocument || globalThis.document;
  const window = options.window || document.defaultView || globalThis.window;
  const listeners = [];
  const keys = new Set();
  const pointers = new Map();
  const sticks = { drive: { x: 0, y: 0 }, aim: { x: 0, y: 0 } };
  let governor = 'cruise', fireQueued = false, enabled = true, disposed = false, lastAim;
  const root = document.createElement('div');
  root.className = 'campaign-controls';
  root.setAttribute('aria-label', '坦克触屏控制');
  root.setAttribute('data-enabled', 'true');
  (options.mount || canvas.parentElement || document.body).append(root);
  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }
  function element(tag, className, text) {
    const result = document.createElement(tag); result.className = className;
    if (text) result.textContent = text;
    return result;
  }
  function acceptAim(point) {
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z)) lastAim = { x: point.x, y: point.y, z: point.z };
  }
  function project(clientX, clientY) {
    acceptAim(options.projectAim?.(clientX, clientY));
  }
  function projectStickAim({ x, y }) {
    const bounds = canvas.getBoundingClientRect();
    const range = Math.min(bounds.width, bounds.height) * 0.46;
    // Project a virtual point around screen centre, not the thumb's bottom-right UI position.
    if (options.projectAim) project(bounds.left + bounds.width / 2 + x * range, bounds.top + bounds.height / 2 + y * range);
    else {
      const pose = options.getTankPose?.();
      if (pose) acceptAim({ x: pose.x + x * 32, y: (pose.y || 0) + 0.7, z: pose.z + y * 32 });
    }
  }
  function releasePointer(id) {
    const held = pointers.get(id);
    if (!held) return;
    pointers.delete(id);
    if (held.kind in sticks) {
      sticks[held.kind] = { x: 0, y: 0 };
      held.knob.style.transform = 'translate(0px, 0px)';
    }
    held.element.setAttribute('data-active', 'false');
    try { if (held.element.hasPointerCapture?.(id)) held.element.releasePointerCapture(id); } catch { /* Pointer may already have been cancelled by the browser. */ }
  }
  function reset(resetOptions) {
    keys.clear(); fireQueued = false;
    for (const id of [...pointers.keys()]) releasePointer(id);
    sticks.drive = { x: 0, y: 0 }; sticks.aim = { x: 0, y: 0 };
    if (resetOptions?.clearAim === true) lastAim = undefined;
  }
  function begin(event, kind, element, knob) {
    if (!enabled || disposed || event.button > 0 || [...pointers.values()].some(held => held.kind === kind)) return false;
    event.preventDefault(); event.stopPropagation();
    pointers.set(event.pointerId, { kind, element, knob });
    element.setAttribute('data-active', 'true');
    try { element.setPointerCapture?.(event.pointerId); } catch { /* Window fallback still releases held controls. */ }
    return true;
  }
  function connectRelease(element) {
    listen(element, 'pointerup', event => { event.preventDefault(); releasePointer(event.pointerId); });
    listen(element, 'pointercancel', () => reset());
    listen(element, 'lostpointercapture', event => { if (pointers.has(event.pointerId)) reset(); });
    listen(element, 'contextmenu', event => event.preventDefault());
  }
  function makeStick(kind, title, subtitle) {
    const stick = element('div', `campaign-stick campaign-stick--${kind}`);
    stick.setAttribute('data-control', kind); stick.setAttribute('aria-label', `${title}摇杆：${subtitle}`);
    const knob = element('span', 'campaign-stick__knob');
    const label = element('span', 'campaign-stick__label', title);
    stick.append(knob, label); root.append(stick);
    function move(event) {
      const held = pointers.get(event.pointerId);
      if (held?.kind !== kind) return;
      event.preventDefault();
      const rect = stick.getBoundingClientRect(), radius = Math.max(1, Math.min(rect.width, rect.height) / 2);
      let x = (event.clientX - rect.left - rect.width / 2) / radius;
      let y = (event.clientY - rect.top - rect.height / 2) / radius;
      const rawLength = Math.hypot(x, y), length = Math.min(1, rawLength);
      if (rawLength > 1) { x /= rawLength; y /= rawLength; }
      knob.style.transform = `translate(${x * radius * 0.62}px, ${y * radius * 0.62}px)`;
      // A radial deadzone preserves diagonals. Soft response gives useful low-speed control.
      const response = length <= 0.12 ? 0 : Math.pow((length - 0.12) / 0.88, 1.35);
      sticks[kind] = length ? { x: x / length * response, y: y / length * response } : { x: 0, y: 0 };
      if (kind === 'aim') {
        // Keep raw radial-clamped coordinates: the soft response is only for stick output.
        // Pointer ownership also owns this vector, so every release/reset stops reprojection.
        held.aimVector = response > 0 && Number.isFinite(x) && Number.isFinite(y) ? { x, y } : undefined;
        if (held.aimVector) projectStickAim(held.aimVector);
      }
    }
    listen(stick, 'pointerdown', event => { if (begin(event, kind, stick, knob)) move(event); });
    listen(stick, 'pointermove', move); connectRelease(stick);
    return stick;
  }
  makeStick('drive', '驾驶', '前后油门 / 左右转向');
  makeStick('aim', '瞄准', '独立转动炮塔');
  const actionCluster = element('div', 'campaign-touch-actions'); root.append(actionCluster);
  for (const [kind, title] of [['fire', '开火'], ['brake', '刹车'], ['boost', '加速']]) {
    const button = element('button', `campaign-touch-button campaign-touch-button--${kind}`, title);
    button.type = 'button'; button.setAttribute('data-control', kind); button.setAttribute('aria-label', title);
    actionCluster.append(button);
    listen(button, 'pointerdown', event => { if (begin(event, kind, button) && kind === 'fire') fireQueued = true; });
    connectRelease(button);
  }
  const speed = element('div', 'campaign-governor'); speed.setAttribute('role', 'group'); speed.setAttribute('aria-label', '速度上限'); root.append(speed);
  const governorButtons = GOVERNORS.map((mode, index) => {
    const button = element('button', 'campaign-governor__button', ['低速', '巡航', '高速'][index]);
    button.type = 'button'; button.setAttribute('data-control', mode); button.setAttribute('aria-label', `${index + 1} ${button.textContent}`);
    speed.append(button);
    listen(button, 'click', event => { event.stopPropagation(); if (enabled) setGovernor(mode); });
    return button;
  });
  function setGovernor(mode) {
    if (!GOVERNORS.includes(mode)) return;
    governor = mode;
    governorButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(GOVERNORS[index] === mode)));
  }
  setGovernor(governor);
  listen(window, 'keydown', event => {
    if (!enabled || disposed || editable(event.target) || !KEYS.has(event.code)) return;
    event.preventDefault();
    if (event.repeat && !keys.has(event.code)) return;
    const fresh = !keys.has(event.code) && !event.repeat;
    keys.add(event.code);
    if (event.code === 'KeyF' && fresh) fireQueued = true;
    if (event.code.startsWith('Digit')) setGovernor(GOVERNORS[Number(event.code.slice(-1)) - 1]);
  });
  listen(window, 'keyup', event => { keys.delete(event.code); });
  listen(canvas, 'pointermove', event => { if (enabled && event.pointerType !== 'touch') project(event.clientX, event.clientY); });
  listen(canvas, 'pointerdown', event => {
    if (!enabled || event.pointerType === 'touch' || event.button !== 0) return;
    event.preventDefault(); project(event.clientX, event.clientY); fireQueued = true;
  });
  listen(canvas, 'contextmenu', event => event.preventDefault());
  listen(window, 'pointerup', event => releasePointer(event.pointerId));
  listen(window, 'pointercancel', () => reset());
  listen(window, 'blur', reset);
  listen(document, 'visibilitychange', () => { if (document.hidden || document.visibilityState === 'hidden') reset(); });
  function sample() {
    const held = kind => [...pointers.values()].some(pointer => pointer.kind === kind);
    const aimPointer = [...pointers.values()].find(pointer => pointer.kind === 'aim');
    if (enabled && !disposed && aimPointer?.aimVector) projectStickAim(aimPointer.aimVector);
    const forward = keys.has('KeyW'), reverse = keys.has('KeyS');
    const result = {
      throttle: enabled ? clamp(Number(forward) - Number(reverse) - sticks.drive.y, -1, 1) : 0,
      steer: enabled ? clamp(Number(keys.has('KeyD')) - Number(keys.has('KeyA')) + sticks.drive.x, -1, 1) : 0,
      brake: enabled && (keys.has('Space') || (forward && reverse) || held('brake')),
      boost: enabled && (keys.has('ShiftLeft') || keys.has('ShiftRight') || held('boost')),
      governor, firePressed: enabled && fireQueued, paused: !enabled,
    };
    if (lastAim) result.aim = { worldPoint: { ...lastAim } };
    fireQueued = false;
    return result;
  }
  function setEnabled(value) {
    enabled = Boolean(value) && !disposed;
    if (!enabled) reset();
    root.setAttribute('data-enabled', String(enabled));
    root.hidden = !enabled;
  }
  function dispose() {
    if (disposed) return;
    reset(); disposed = true; enabled = false;
    for (const remove of listeners) remove();
    root.remove();
  }
  return { sample, reset, setGovernor, setEnabled, dispose };
}
