<template>
  <div class="dev-stats" data-testid="dev-stats" role="region" :aria-label="$t('dev.st.title')">
    <div class="ds-head">
      <b>{{ $t('dev.st.title') }}</b>
      <button class="ds-btn" data-testid="dev-stats-copy" @click="copy">{{ copied ? $t('dev.st.copied') : $t('dev.st.copy') }}</button>
      <button class="ds-btn" :aria-label="$t('common.close')" data-testid="dev-stats-close" @click="$emit('close')">×</button>
    </div>
    <canvas ref="graph" class="ds-graph" width="240" height="44" aria-hidden="true"></canvas>
    <table v-if="rows.length" class="ds-rows">
      <tr v-for="r in shown" :key="r[0]"><th>{{ r[0] }}</th><td>{{ r[1] }}</td></tr>
    </table>
    <button v-if="narrow" class="ds-btn ds-more" data-testid="dev-stats-more" @click="more = !more">{{ more ? '▲' : '▼ ' + (rows.length - shown.length) }}</button>
  </div>
</template>

<script>
import { statsRows, statsText } from '../../dev/statsText.js';
import { FRAME_SAMPLES } from '../../dev/DevTools.js';

export default {
  name: 'DevStats',
  props: { engine: { type: Object, required: true } },
  emits: ['close'],
  data() { return { rows: [], copied: false, more: false, narrow: false }; },
  computed: {
    /** On narrow screens first only the most important rows */
    shown() { return this.narrow && !this.more ? this.rows.slice(0, 6) : this.rows; },
  },
  mounted() {
    this.narrow = window.innerWidth < 700;
    this.poll();
    this.timer = setInterval(() => this.poll(), 250);
  },
  beforeUnmount() { clearInterval(this.timer); clearTimeout(this.copyTimer); },
  methods: {
    stats() { return this.engine.dev?.stats() ?? null; },
    poll() {
      const s = this.stats();
      if (!s) return;
      this.last = s;
      this.rows = statsRows(s, this.$t);
      this.draw();
    },
    /** Frame times of the last 120 frames as bars; lines at 16.7 ms (60 frames/s) and 33 ms (30). */
    draw() {
      const dev = this.engine.dev, cv = this.$refs.graph;
      if (!dev || !cv) return;
      // Software canvas (willReadFrequently): a GPU canvas above the WebGL image slows weak/software graphics heavily
      const ctx = (this.ctx ??= cv.getContext('2d', { willReadFrequently: true }));
      const W = cv.width, H = cv.height, max = 50;
      ctx.clearRect(0, 0, W, H);
      const bw = W / FRAME_SAMPLES;
      for (let i = 0; i < FRAME_SAMPLES; i++) {
        const v = dev.frameTimes[(dev.frameIdx + i) % FRAME_SAMPLES];
        if (!v) continue;
        const h = Math.min(H, (v / max) * H);
        ctx.fillStyle = v > 33.4 ? '#f0604c' : v > 17.5 ? '#f2c94c' : '#62d36f';
        ctx.fillRect(i * bw, H - h, Math.max(1, bw - 0.4), h);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.setLineDash([3, 3]);
      for (const ms of [16.7, 33.3]) {
        const y = Math.round(H - (ms / max) * H) + 0.5;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.setLineDash([]);
    },
    async copy() {
      const s = this.last ?? this.stats();
      if (!s) return;
      const text = statsText(s, this.$t, `Kronland – ${this.$t('dev.st.title')}`);
      try { await navigator.clipboard.writeText(text); } catch {
        // Fallback without Clipboard API (e.g. without secure context)
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch { /* nothing */ }
        ta.remove();
      }
      this.lastCopied = text;
      this.copied = true;
      clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => { this.copied = false; }, 1500);
    },
  },
};
</script>

<style>
.dev-stats {
  position: fixed; z-index: 22;
  left: calc(0.5rem + var(--safe-l)); top: calc(var(--top-total, 4rem) + 0.5rem);
  width: min(22rem, calc(100vw - 1rem));
  max-height: calc(100dvh - var(--top-total, 4rem) - var(--bottom-h, 13rem) - 1.5rem);
  overflow: auto; scrollbar-width: thin;
  font: 11px/1.35 ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  color: #e6f2ff; background: rgba(6, 10, 14, 0.72); border-radius: 6px; padding: 6px 8px 7px;
  box-shadow: 0 0 0 1px rgba(140, 200, 255, 0.2), 0 4px 14px rgba(0, 0, 0, 0.4);
  -webkit-user-select: text; user-select: text;
}
.ds-head { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.ds-head b { flex: 1; color: #9fdcff; font-weight: 700; letter-spacing: 0.02em; }
.ds-btn {
  font: inherit; min-height: 0; padding: 1px 7px; border-radius: 4px; color: #e6f2ff;
  background: rgba(140, 200, 255, 0.14); border: 1px solid rgba(140, 200, 255, 0.3); box-shadow: none;
}
.ds-more { display: block; width: 100%; margin-top: 3px; }
.ds-graph { display: block; width: 100%; height: 44px; margin: 2px 0 5px; background: rgba(255, 255, 255, 0.04); border-radius: 3px; }
.ds-rows { border-collapse: collapse; width: 100%; table-layout: fixed; }
.ds-rows th { width: 7.6em; text-align: left; font-weight: 400; color: #8fa9bf; padding: 0 6px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; vertical-align: top; }
.ds-rows td { padding: 0; overflow-wrap: anywhere; }
@media (max-width: 700px) {
  .dev-stats { font-size: 10px; width: min(17rem, calc(100vw - 6rem)); max-height: 34dvh; }
  .ds-graph { height: 28px; }
}
</style>
