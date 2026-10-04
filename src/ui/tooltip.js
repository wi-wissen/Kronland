// One shared tooltip for the whole UI.
// Usage: v-tip="{ title, text, notes: [text], lines: [[label, value]], cost: [[res, n]], have, reason, key }"
// or v-tip="'Short text'". The content is shown on hover and on keyboard focus.
// Touch: long press (LONG_PRESS_MS) shows the tooltip without triggering the action; it stays
// until you tap somewhere again.

import { reactive } from 'vue';

/** Hold time for the long press in ms */
export const LONG_PRESS_MS = 450;
/** How far (px) the finger may move before the long press is cancelled (swiping, scrolling) */
export const LONG_PRESS_SLOP = 10;

/** pinned: opened by long press (stays until the next tap) */
export const tip = reactive({ data: null, rect: null, el: null, pinned: false });
let hideTimer = 0;

function normalize(v) {
  if (!v) return null;
  return typeof v === 'string' ? { text: v } : v;
}

/** Devices without mouse hover (phone, tablet) get no hover tooltips. */
const noHover = () => { try { return globalThis.matchMedia?.('(hover: none)').matches ?? false; } catch { return false; } };

function show(el, pinned = false) {
  if (!pinned && (noHover() || tip.pinned)) return;
  clearTimeout(hideTimer);
  const data = normalize(el.__tip);
  if (!data) { hide(); return; }
  tip.el = el;
  tip.data = data;
  tip.pinned = pinned;
  tip.rect = el.getBoundingClientRect();
}

export function hide() {
  tip.el = null;
  tip.data = null;
  tip.pinned = false;
}

/**
 * Long-press detection, independent of the DOM (testable). Feed with down/move/up/cancel;
 * onFire is called after `delay` ms if the finger stays down.
 * Afterwards consumeClick() returns true once – the following click should be discarded.
 * @param {{ delay?: number, slop?: number, onFire: () => void, timers?: { set: typeof setTimeout, clear: typeof clearTimeout } }} o
 */
export function createLongPress({ delay = LONG_PRESS_MS, slop = LONG_PRESS_SLOP, onFire, timers = { set: (f, ms) => setTimeout(f, ms), clear: (id) => clearTimeout(id) } }) {
  let timer = 0, x = 0, y = 0, fired = false, active = false;
  const stop = () => { if (active) timers.clear(timer); active = false; };
  return {
    /** @param {{ x: number, y: number }} p */
    down(p) {
      stop();
      fired = false; active = true; x = p.x; y = p.y;
      timer = timers.set(() => { active = false; fired = true; onFire(); }, delay);
    },
    move(p) { if (active && Math.abs(p.x - x) + Math.abs(p.y - y) > slop) stop(); },
    up() { stop(); },
    cancel() { stop(); fired = false; },
    /** Was a long press just triggered? (resets itself) */
    consumeClick() { const f = fired; fired = false; return f; },
    get fired() { return fired; },
  };
}

// Close the pinned tooltip on the next tap anywhere (the long press itself produces no new pointerdown)
let globalBound = false;
function bindGlobal() {
  if (globalBound || typeof window === 'undefined') return;
  globalBound = true;
  window.addEventListener('pointerdown', () => {
    if (tip.pinned) hide();
  }, true);
  // Scrolling in panels moves the element – close the tooltip instead of leaving it misplaced
  window.addEventListener('scroll', () => { if (tip.pinned) hide(); }, true);
}

export const tipDirective = {
  mounted(el, binding) {
    bindGlobal();
    el.__tip = binding.value;
    el.__lp = createLongPress({ onFire: () => { show(el, true); try { navigator.vibrate?.(15); } catch { /* never mind */ } } });
    el.__tipOn = (e) => { if (e.pointerType !== 'touch') show(el); };
    el.__tipOff = () => { if (tip.pinned) return; hideTimer = setTimeout(() => { if (tip.el === el) hide(); }, 60); };
    el.__tipFocus = () => { if (el.matches(':focus-visible')) show(el); };
    el.__tipDown = (e) => {
      if (e.pointerType === 'mouse') { el.__tipOff(); return; }
      if (!normalize(el.__tip)) return;
      el.__lp.down({ x: e.clientX, y: e.clientY });
    };
    el.__tipMove = (e) => el.__lp.move({ x: e.clientX, y: e.clientY });
    el.__tipUp = () => el.__lp.up();
    el.__tipCancel = () => el.__lp.cancel();
    // Swallow the click after a long press: the action should not be triggered
    el.__tipClick = (e) => { if (el.__lp.consumeClick()) { e.preventDefault(); e.stopImmediatePropagation(); } };
    // Otherwise Android opens the context menu on long press
    el.__tipMenu = (e) => { if (e.pointerType !== 'mouse' && normalize(el.__tip)) e.preventDefault(); };
    el.addEventListener('pointerenter', el.__tipOn);
    el.addEventListener('pointerleave', el.__tipOff);
    el.addEventListener('focus', el.__tipFocus);
    el.addEventListener('blur', el.__tipOff);
    el.addEventListener('pointerdown', el.__tipDown);
    el.addEventListener('pointermove', el.__tipMove);
    el.addEventListener('pointerup', el.__tipUp);
    el.addEventListener('pointercancel', el.__tipCancel);
    el.addEventListener('click', el.__tipClick, true);
    el.addEventListener('contextmenu', el.__tipMenu);
  },
  updated(el, binding) {
    el.__tip = binding.value;
    if (tip.el === el) {
      const d = normalize(binding.value);
      if (!d) hide(); else { tip.data = d; tip.rect = el.getBoundingClientRect(); }
    }
  },
  beforeUnmount(el) {
    el.__lp?.cancel();
    el.removeEventListener('pointerenter', el.__tipOn);
    el.removeEventListener('pointerleave', el.__tipOff);
    el.removeEventListener('focus', el.__tipFocus);
    el.removeEventListener('blur', el.__tipOff);
    el.removeEventListener('pointerdown', el.__tipDown);
    el.removeEventListener('pointermove', el.__tipMove);
    el.removeEventListener('pointerup', el.__tipUp);
    el.removeEventListener('pointercancel', el.__tipCancel);
    el.removeEventListener('click', el.__tipClick, true);
    el.removeEventListener('contextmenu', el.__tipMenu);
    if (tip.el === el) hide();
  },
};
