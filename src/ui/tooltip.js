// One shared tooltip for the whole UI.
// Verwendung: v-tip="{ title, text, lines: [[label, value]], cost: [[res, n]], have, reason, key }"
// or v-tip="'Short text'". The content is shown on hover and on keyboard focus.
// (Touch: no tooltip – important reasons are shown directly in the control).

import { reactive } from 'vue';

export const tip = reactive({ data: null, rect: null, el: null });
let hideTimer = 0;

function normalize(v) {
  if (!v) return null;
  return typeof v === 'string' ? { text: v } : v;
}

/** Devices without mouse hover (phone, tablet) get no tooltips. */
const noHover = () => { try { return globalThis.matchMedia?.('(hover: none)').matches ?? false; } catch { return false; } };

function show(el) {
  if (noHover()) return;
  clearTimeout(hideTimer);
  const data = normalize(el.__tip);
  if (!data) { hide(); return; }
  tip.el = el;
  tip.data = data;
  tip.rect = el.getBoundingClientRect();
}

function hide() {
  tip.el = null;
  tip.data = null;
}

export const tipDirective = {
  mounted(el, binding) {
    el.__tip = binding.value;
    el.__tipOn = (e) => { if (e.pointerType !== 'touch') show(el); };
    el.__tipOff = () => { hideTimer = setTimeout(() => { if (tip.el === el) hide(); }, 60); };
    el.__tipFocus = () => { if (el.matches(':focus-visible')) show(el); };
    el.addEventListener('pointerenter', el.__tipOn);
    el.addEventListener('pointerleave', el.__tipOff);
    el.addEventListener('focus', el.__tipFocus);
    el.addEventListener('blur', el.__tipOff);
    el.addEventListener('pointerdown', el.__tipOff);
  },
  updated(el, binding) {
    el.__tip = binding.value;
    if (tip.el === el) {
      const d = normalize(binding.value);
      if (!d) hide(); else { tip.data = d; tip.rect = el.getBoundingClientRect(); }
    }
  },
  beforeUnmount(el) {
    el.removeEventListener('pointerenter', el.__tipOn);
    el.removeEventListener('pointerleave', el.__tipOff);
    el.removeEventListener('focus', el.__tipFocus);
    el.removeEventListener('blur', el.__tipOff);
    el.removeEventListener('pointerdown', el.__tipOff);
    if (tip.el === el) hide();
  },
};
