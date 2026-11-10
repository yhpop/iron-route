/**
 * Native Safari gesture backstop, not a second input adapter. Pointer Events keep
 * owning every stick/action. Cancelling touch defaults must not stop propagation
 * or cancel the compatibility click used by pause, sound and governor buttons.
 */
const POINTER_CONTROLS = new Set(['drive', 'aim', 'fire', 'brake', 'boost']);
export function createGameplayGestureGuard(canvas, options = {}) {
  const document = options.document || canvas.ownerDocument || globalThis.document;
  const window = options.window || document.defaultView || globalThis.window;
  const viewport = window.visualViewport;
  const listeners = [];
  let active = false, disposed = false;
  const note = document.createElement('aside');
  note.className = 'campaign-zoom-recovery';
  note.setAttribute('role', 'status');
  note.textContent = '页面已放大，行动已暂停。请先松开所有手指，再用双指捏合缩小页面，恢复正常后按“继续行动”。';
  note.hidden = true;
  document.body.append(note);
  function listen(target, type, handler, settings) {
    target.addEventListener(type, handler, settings);
    listeners.push(() => target.removeEventListener(type, handler, settings));
  }
  function markActive(value) {
    if (active !== value) {
      active = value;
      // No scroll-blocking document listeners remain while reading menus.
      for (const [type, handler] of blockers) document[active ? 'addEventListener' : 'removeEventListener'](type, handler, blocking);
    }
    document.documentElement.setAttribute('data-gameplay-active', String(value));
  }
  function owns(target) {
    let owned = false;
    for (let node = target; node; node = node.parentElement) {
      if (node.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'OPTION'].includes(node.tagName)) return false;
      if (node.className?.split?.(/\s+/).includes('campaign-modal-layer')) return false;
      if (node === canvas || node.className?.split?.(/\s+/).some(name => name === 'campaign-controls' || name === 'campaign-ui')) owned = true;
    }
    return owned;
  }
  function pointerSurface(target) {
    for (let node = target; node; node = node.parentElement) {
      if (node === canvas || POINTER_CONTROLS.has(node.getAttribute?.('data-control'))) return true;
    }
    return false;
  }
  function cancel(event) {
    if (event.cancelable) event.preventDefault();
  }
  function touch(event) {
    if (!active || !owns(event.target)) return;
    // Single UI taps need native clicks, even with another finger on a stick.
    if (pointerSurface(event.target) || (event.type === 'touchmove' && event.touches?.length > 1)) cancel(event);
  }
  function gesture(event) {
    if (active && owns(event.target)) cancel(event);
  }
  const blocking = { capture: true, passive: false };
  const blockers = [
    ...['touchstart', 'touchmove', 'touchend'].map(type => [type, touch]),
    ...['gesturestart', 'gesturechange', 'gestureend', 'dblclick'].map(type => [type, gesture]),
  ];
  function checkViewport() {
    if (disposed || !viewport) return;
    const zoomed = Number.isFinite(viewport.scale) && viewport.scale > 1.05;
    if (active && zoomed) {
      // visualViewport.scale is read-only. Release both CSS and JS protection
      // before pausing, so the player can pinch back out instead of being trapped.
      markActive(false);
      note.hidden = false;
      options.onZoom?.();
    }
    if (!zoomed) note.hidden = true;
    if (!note.hidden) {
      // Position inside the visible viewport; never inverse-scale the game/UI.
      note.style.left = `${(viewport.offsetLeft || 0) + 12}px`;
      note.style.top = `${(viewport.offsetTop || 0) + 12}px`;
      note.style.width = `${Math.max(1, Math.min(360, viewport.width - 24))}px`;
    }
  }
  if (viewport) {
    listen(viewport, 'resize', checkViewport, { passive: true });
    listen(viewport, 'scroll', checkViewport, { passive: true });
  }
  return {
    setActive(value) {
      if (disposed) return;
      markActive(Boolean(value));
      checkViewport();
    },
    dispose() {
      if (disposed) return;
      disposed = true; markActive(false);
      for (const remove of listeners) remove();
      note.remove();
    },
  };
}
