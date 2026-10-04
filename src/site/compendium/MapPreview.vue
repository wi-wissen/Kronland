<template>
  <div class="mp" data-testid="map-preview">
    <form class="mp-form" @submit.prevent="make">
      <label>
        <span>{{ L('map.seed') }}</span>
        <input v-model.number="seed" type="number" min="1" max="999999" inputmode="numeric">
      </label>
      <label>
        <span>{{ L('map.size') }}</span>
        <select v-model.number="size">
          <option v-for="(v, k) in sizes" :key="k" :value="v">{{ L('map.' + k) }} ({{ v }})</option>
        </select>
      </label>
      <label>
        <span>{{ L('map.players') }}</span>
        <select v-model.number="players">
          <option v-for="n in [2, 3, 4]" :key="n" :value="n">{{ n }}</option>
        </select>
      </label>
      <button type="submit" class="primary" :disabled="busy">{{ L('map.show') }}</button>
      <a class="mp-play" :href="$links.play + '?seed=' + seed + '&players=' + players">{{ $s('nav.play') }} →</a>
    </form>
    <div class="mp-body">
      <canvas ref="cv" class="mp-canvas" :width="px" :height="px" role="img" :aria-label="L('map.render') + ' ' + seed"></canvas>
      <div class="mp-side">
        <table v-if="stats" class="mp-stats">
          <tbody>
            <tr><th scope="row">{{ L('map.trees') }}</th><td class="num">{{ stats.tree }}</td></tr>
            <tr><th scope="row">{{ L('map.piles') }}</th><td class="num">{{ stats.pile }}</td></tr>
            <tr><th scope="row">{{ L('map.shafts') }}</th><td class="num">{{ stats.shaft }}</td></tr>
            <tr><th scope="row">{{ L('map.spots') }}</th><td class="num">{{ stats.spot }}</td></tr>
            <tr><th scope="row">{{ L('map.water') }}</th><td class="num">{{ stats.water }} %</td></tr>
            <tr><th scope="row">{{ L('map.cliff') }}</th><td class="num">{{ stats.cliff }} %</td></tr>
          </tbody>
        </table>
        <ul class="mp-legend" :aria-label="L('map.legend')">
          <li><i style="background:#3f7fb8"></i>{{ L('map.water') }}</li>
          <li><i style="background:#6b6a66"></i>{{ L('map.cliff') }}</li>
          <li><i style="background:#1f5a2a"></i>{{ L('map.trees') }}</li>
          <li><i style="background:#e8b04a"></i>{{ L('map.piles') }}</li>
          <li><i style="background:#fff;outline:2px solid #222"></i>{{ L('map.shafts') }}</li>
          <li><i style="background:#c03a3f;border-radius:50%"></i>{{ L('map.spots') }}</li>
          <li><i style="background:#4d7bc0"></i>{{ L('map.start') }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import { generateMap, MAP_SIZES } from '../../sim/mapgen.js';
import { WATER, CLIFF } from '../../sim/map.js';
import { LABELS } from './texts.js';

const RES = { clay: '#c46a3a', stone: '#a8a8a0', iron: '#5b6f80', sulfur: '#e3d24a', gold: '#e8b04a' };
const PLAYER = ['#3b6fbf', '#c03a3f', '#46a052', '#d79a2c'];

export default {
  name: 'MapPreview',
  data() { return { seed: 42, size: MAP_SIZES.small, players: 2, sizes: MAP_SIZES, stats: null, busy: false, px: 480 }; },
  mounted() { setTimeout(this.make, 50); },
  methods: {
    L(k) { return LABELS[this.$i18n.lang]?.[k] ?? LABELS.de[k] ?? k; },
    make() {
      this.busy = true;
      // Generation takes a moment on large maps – let it redraw first
      setTimeout(() => {
        try { this.draw(generateMap(Math.max(1, this.seed | 0), { size: this.size, players: this.players })); } finally { this.busy = false; }
      }, 16);
    },
    draw(g) {
      const { map } = g;
      const S = map.width, c = this.$refs.cv;
      if (!c) return;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(S, S);
      let lo = Infinity, hi = -Infinity, water = 0, cliff = 0;
      for (let k = 0; k < S * S; k++) { const h = map.heights[k]; if (h < lo) lo = h; if (h > hi) hi = h; }
      for (let k = 0; k < S * S; k++) {
        const f = map.flags[k], h = map.heights[k];
        let r, gg, b;
        if (f & WATER) { r = 63; gg = 127; b = 184; water++; } else if (f & CLIFF) { r = 107; gg = 106; b = 102; cliff++; } else {
          const v = (h - g.waterLevel) / Math.max(1, hi - g.waterLevel);
          r = 92 + v * 90; gg = 150 + v * 45; b = 70 + v * 50;
        }
        img.data.set([r, gg, b, 255], k * 4);
      }
      const off = document.createElement('canvas');
      off.width = off.height = S;
      off.getContext('2d').putImageData(img, 0, 0);
      const s = this.px / S;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, this.px, this.px);
      ctx.drawImage(off, 0, 0, this.px, this.px);
      const st = { tree: 0, pile: 0, shaft: 0, spot: 0 };
      for (const ft of g.features) {
        st[ft.kind] = (st[ft.kind] ?? 0) + 1;
        const x = (ft.x + 0.5) * s, y = (ft.y + 0.5) * s;
        if (ft.kind === 'tree') { ctx.fillStyle = 'rgba(31,90,42,0.85)'; ctx.fillRect(x - s / 2, y - s / 2, s, s); }
        else if (ft.kind === 'pile') { ctx.fillStyle = RES[ft.res] ?? '#e8b04a'; ctx.beginPath(); ctx.arc(x, y, s * 1.2, 0, 7); ctx.fill(); }
        else if (ft.kind === 'shaft') { ctx.fillStyle = '#fff'; ctx.strokeStyle = RES[ft.res] ?? '#222'; ctx.lineWidth = 2; ctx.fillRect(x - s * 1.5, y - s * 1.5, s * 3, s * 3); ctx.strokeRect(x - s * 1.5, y - s * 1.5, s * 3, s * 3); }
        else if (ft.kind === 'spot') { ctx.strokeStyle = '#c03a3f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, s * 2.2, 0, 7); ctx.stroke(); }
      }
      g.hqs.forEach((h, i) => {
        ctx.fillStyle = PLAYER[i % 4]; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.fillRect(h.x * s, h.y * s, 5 * s, 5 * s); ctx.strokeRect(h.x * s, h.y * s, 5 * s, 5 * s);
      });
      const N = S * S;
      this.stats = { ...st, water: Math.round((water * 100) / N), cliff: Math.round((cliff * 100) / N) };
    },
  },
};
</script>

<style>
.mp { margin: 1rem 0 1.5rem; }
.mp-form { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: flex-end; margin-bottom: 0.75rem; }
.mp-form label { display: flex; flex-direction: column; gap: 0.25rem; font-weight: 700; font-size: 0.875rem; }
.mp-form input, .mp-form select { font: inherit; min-height: var(--touch); padding: 0.375rem 0.5rem; border-radius: var(--r-md); border: 1px solid rgba(90, 60, 20, 0.45); background: #fffaf0; color: var(--parch-ink); width: 8rem; }
.mp-form button { min-height: var(--touch); }
.mp-play { align-self: center; font-weight: 700; }
.mp-body { display: flex; flex-wrap: wrap; gap: 1.25rem; align-items: flex-start; }
.mp-canvas { width: min(100%, 480px); height: auto; aspect-ratio: 1; image-rendering: pixelated; border-radius: var(--r-md); box-shadow: 0 0 0 1px rgba(90, 60, 20, 0.4), 0 6px 18px rgba(40, 25, 5, 0.25); background: #2b3a2b; }
.mp-side { display: flex; flex-direction: column; gap: 0.75rem; min-width: 12rem; }
.prose .mp-stats { width: auto; }
.mp-legend { list-style: none; padding: 0 !important; margin: 0 !important; display: grid; gap: 0.25rem; font-size: 0.9375rem; }
.mp-legend i { display: inline-block; width: 0.875rem; height: 0.875rem; margin-right: 0.5rem; vertical-align: -0.1rem; }
</style>
