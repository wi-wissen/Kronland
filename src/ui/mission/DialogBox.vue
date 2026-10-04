<template>
  <transition name="dlg">
    <div v-if="current" :key="current.seq" class="dialogbox frame" role="status" aria-live="polite" data-testid="dialog">
      <span class="dlg-seal" :style="{ '--sp': speaker.color }" aria-hidden="true">{{ speaker.initial }}</span>
      <div class="dlg-body">
        <b class="dlg-name" data-testid="dialog-speaker">{{ $tr(speaker.name) }}</b>
        <p data-testid="dialog-text">{{ $tr(current.text) }}</p>
      </div>
      <button class="icon-btn ghost dlg-close" :aria-label="$t('mission.dismiss')" data-testid="dialog-close" @click="dismiss"><Icon name="close" /></button>
    </div>
  </transition>
</template>

<script>
import { tr } from '../../i18n/index.js';
import { SPEAKERS } from '../../sim/missions/speakers.js';

const SHOW_MS = 14000;

export default {
  name: 'DialogBox',
  props: {
    messages: { type: Array, required: true },
    lang: { type: String, default: 'de' },
  },
  data() { return { seen: 0 }; },
  computed: {
    /** Oldest message not yet read (order is preserved). */
    current() {
      // Unread ones in sequence; anything more than 10 s of game time older than the newest is obsolete
      const open = this.messages.filter((x) => x.seq > this.seen);
      if (!open.length) return null;
      const newest = open[open.length - 1].tick;
      return open.find((x) => x.tick >= newest - 100) ?? null;
    },
    speaker() {
      return SPEAKERS[this.current?.speaker] ?? { name: this.current?.speaker ?? '', color: '#e0a93b', initial: '?' };
    },
  },
  watch: {
    'current.seq': {
      immediate: true,
      handler(seq) {
        clearTimeout(this.timer);
        if (!seq) return;
        // reading time by text length, at least 6 s
        const len = tr(this.current.text, this.lang).length;
        this.timer = setTimeout(() => this.dismiss(), Math.min(SHOW_MS, 6000 + len * 45));
      },
    },
  },
  beforeUnmount() { clearTimeout(this.timer); },
  methods: {
    dismiss() { if (this.current) this.seen = this.current.seq; },
  },
};
</script>

<style>
.dialogbox { display: flex; gap: 0.75rem; align-items: flex-start; padding: 0.75rem 0.5rem 0.75rem 0.75rem; flex: none; }
.dlg-seal {
  flex: none; width: 3rem; height: 3rem; border-radius: 50%; display: grid; place-items: center;
  font-family: var(--display); font-size: 1.375rem; font-weight: 700; color: #fff8e6; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--sp) 60%, #fff), var(--sp) 70%);
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.3), 0 0 0 2px var(--gold-500), 0 0 0 4px var(--wood-950), 0 3px 6px rgba(0, 0, 0, 0.5);
}
.dlg-body { flex: 1; min-width: 0; }
.dlg-name { font-family: var(--display); font-size: var(--fs-md); display: block; margin-bottom: 0.125rem; color: var(--gold-200); }
.dlg-body p { margin: 0; font-size: var(--fs-md); line-height: 1.45; }
.dlg-close { flex: none; width: 2.25rem !important; min-width: 2.25rem !important; min-height: 2.25rem; }
.dlg-enter-active { transition: opacity 0.25s, transform 0.25s; }
.dlg-enter-from { opacity: 0; transform: translateX(-12px); }
@media (max-width: 640px), (max-height: 480px) and (orientation: landscape) {
  .dlg-seal { width: 2.25rem; height: 2.25rem; font-size: 1.0625rem; }
  .dlg-body p { font-size: var(--fs-sm); }
  .dialogbox { padding: 0.5rem 0.375rem 0.5rem 0.5rem; gap: 0.5rem; }
}
</style>
