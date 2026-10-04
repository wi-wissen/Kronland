<template>
  <div class="toasts" aria-live="polite" data-testid="toasts">
    <transition-group name="toast">
      <component
        :is="t.pos ? 'button' : 'div'"
        v-for="t in toasts"
        :key="t.id"
        class="toast"
        :class="['tone-' + t.tone, { jump: !!t.pos }]"
        :title="t.pos ? $t('toast.jump') : null"
        :data-testid="'toast'"
        @click="t.pos && $emit('jump', t)"
      >
        <span class="toast-icon"><Icon :name="t.icon || 'info'" /></span>
        <span class="toast-text">{{ text(t) }}</span>
        <Icon v-if="t.pos" class="toast-go" name="jump" />
      </component>
    </transition-group>
  </div>
</template>

<script>
import { has, reasonText, buildingName, rankName } from '../../i18n/index.js';

export default {
  name: 'ToastFeed',
  props: { toasts: { type: Array, required: true } },
  emits: ['jump'],
  methods: {
    text(t) {
      if (!has(t.key)) return t.key;
      if (t.key.startsWith('err.')) return reasonText(t.key, t.params);
      const p = { ...(t.params ?? {}) };
      // convert IDs to names
      if (p.building) p.building = buildingName(p.building, p.level ?? 0);
      if (p.tech) p.tech = this.$name.tech(p.tech);
      if (p.line) p.line = this.$name.line(p.line);
      if (p.unit) p.unit = this.$name.unit(p.unit);
      if (p.res) p.res = this.$name.res(p.res);
      if (p.weather) p.weather = this.$name.weather(p.weather);
      // name as i18n key (e.g. 'addon.spec.thief')
      if (typeof p.name === 'string' && has(p.name)) p.name = this.$t(p.name);
      if (p.rank !== undefined && p.rank !== null) p.rank = rankName(p.rank);
      return this.$t(t.key, p);
    },
  },
};
</script>

<style>
/* Notices top right under the coin buttons; new ones appended at the bottom, older ones slide away upward */
.toasts {
  position: fixed; z-index: 6; pointer-events: none;
  right: calc(var(--hud-gap) * 2 + var(--safe-r)); top: calc(var(--top-total, 4rem) + var(--hud-gap));
  width: min(19rem, calc(100vw - 1rem)); display: flex; flex-direction: column; gap: 0.3125rem; align-items: flex-end;
}
.toast {
  pointer-events: auto; display: flex; align-items: center; gap: 0.5rem; max-width: 100%;
  padding: 0.3125rem 0.625rem 0.3125rem 0.3125rem; min-height: 2.5rem; border-radius: 1.5rem 0.625rem 0.625rem 1.5rem;
  background: linear-gradient(180deg, rgba(58, 40, 26, 0.95), rgba(36, 24, 16, 0.95));
  border: 0; box-shadow: inset 0 0 0 1px rgba(225, 168, 58, 0.35), 0 4px 12px rgba(0, 0, 0, 0.4);
  color: var(--ink); font-size: var(--fs-sm); font-weight: 700; text-align: left; line-height: 1.25;
}
button.toast { cursor: pointer; }
button.toast:hover { filter: brightness(1.15); }
.toast-icon { flex: none; width: 2rem; height: 2rem; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 50% 35%, #fbf1d6, #d7bb86); box-shadow: inset 0 0 0 2px var(--tone, var(--gold-500)); }
.toast-icon .ico { width: 1.375rem; height: 1.375rem; }
.toast-text { flex: 1; min-width: 0; }
.toast-go { width: 1rem; height: 1rem; color: var(--gold-300); flex: none; }
.tone-good { --tone: var(--good); }
.tone-warn { --tone: var(--warn); }
.tone-bad { --tone: var(--bad); box-shadow: inset 0 0 0 1px rgba(243, 122, 100, 0.6), 0 4px 14px rgba(0, 0, 0, 0.45); }
.tone-bad .toast-text { color: #ffd9cf; }
.toast-enter-active { transition: opacity 0.2s, transform 0.2s; }
.toast-leave-active { transition: opacity 0.3s; }
.toast-enter-from { opacity: 0; transform: translateX(16px); }
.toast-leave-to { opacity: 0; }
.compact .toasts { left: 50%; right: auto; transform: translateX(-50%); align-items: center; width: min(22rem, calc(100vw - 1rem)); }
@media (max-width: 760px), (max-height: 480px) and (orientation: landscape) {
  .toast { min-height: var(--touch); }
}
</style>
