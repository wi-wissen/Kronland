<template>
  <!-- Top bar as three free-standing plates with a gap to the edge: resources left, crest with payday in the middle,
       coin buttons right. Each plate is only as wide as its content; wraps when space is short instead of overlapping. -->
  <header ref="bar" class="topbar" :class="{ tight }" data-testid="topbar">
    <div ref="res" class="tb-res frame" role="group" :aria-label="$t('top.resources')">
      <span
        v-for="r in resources"
        :key="r"
        v-tip="resTip(r)"
        class="tb-item tb-resitem"
        :class="{ short: short[r] }"
        tabindex="0"
      >
        <Icon :name="r" />
        <b class="num" :data-testid="'res-' + r">{{ ui.res[r] }}</b>
      </span>
    </div>

    <div ref="crest" class="tb-crest">
      <div class="tb-plate tb-plate-l frame">
        <span v-tip="popTip" class="tb-item tb-pop" tabindex="0" data-testid="pop">
          <Icon name="population" />
          <span class="tb-col">
            <b class="num">{{ ui.pop[0] }}<small>/{{ ui.pop[1] }}</small></b>
            <span class="meter" :class="popClass"><i :style="{ width: popPct + '%' }"></i></span>
          </span>
        </span>
        <span v-tip="motTip" class="tb-item" :class="'mot-' + motState" tabindex="0" data-testid="motivation">
          <Icon :name="motState === 'bad' ? 'motivationLow' : 'motivation'" />
          <b class="num">{{ ui.motivation }}<small>%</small></b>
        </span>
      </div>
      <!-- Payday: medallion fills up; seconds only shortly before, a single light pulse on payday itself -->
      <span
        v-tip="payTip"
        class="tb-medal"
        :class="{ flash }"
        :style="{ '--p': payPct }"
        tabindex="0"
        data-testid="payday"
      >
        <Icon name="payday" />
        <b v-if="soon" class="tb-soon num" data-testid="payday-soon">{{ ui.paydayIn }}<small>s</small></b>
      </span>
      <div class="tb-plate tb-plate-r frame">
        <span v-tip="weatherTip" class="tb-item" tabindex="0" data-testid="weather">
          <Ring :frac="ui.weather.frac" :color="weatherColor" class="tb-wx"><Icon :name="'weather-' + ui.weather.state" /></Ring>
          <b class="tb-wxname tb-hide-m">{{ $name.weather(ui.weather.state) }}</b>
        </span>
        <span v-if="ui.faith" v-tip="faithTip" class="tb-item tb-hide-m" tabindex="0">
          <Icon name="faith" />
          <b class="num">{{ ui.faith }}</b>
        </span>
      </div>
    </div>

    <div ref="sys" class="tb-sys">
      <button
        v-tip="{ text: ui.paused ? $t('top.resume') : $t('top.pause'), key: $t('key.space') }"
        class="coin"
        :class="{ on: ui.paused }"
        :aria-label="ui.paused ? $t('top.resume') : $t('top.pause')"
        :aria-pressed="ui.paused"
        data-testid="pause"
        @click="$emit('pause')"
      ><Icon :name="ui.paused ? 'play' : 'pause'" /></button>
      <!-- Speed: button unfolds the levels -->
      <div ref="speedBox" class="tb-speedbox">
        <button
          v-tip="speedOpen ? null : { title: $t('top.speed', { n: ui.speed }), text: $t('top.speedTip') }"
          class="coin tb-speed num"
          :class="{ on: ui.speed > 1 || speedOpen }"
          :aria-label="$t('top.speed', { n: ui.speed })"
          aria-haspopup="menu"
          :aria-expanded="speedOpen"
          data-testid="speed"
          @click="speedOpen = !speedOpen"
        >{{ ui.speed }}×</button>
        <div v-if="speedOpen" class="tb-speedmenu frame" role="menu" :aria-label="$t('top.speedTitle')">
          <button
            v-for="s in speeds"
            :key="s"
            class="tb-speedopt num"
            role="menuitemradio"
            :aria-checked="ui.speed === s"
            :class="{ active: ui.speed === s }"
            :data-testid="'speed-' + s"
            @click="pickSpeed(s)"
          >{{ s }}×<small>{{ $t('top.speedName.' + s) }}</small></button>
        </div>
      </div>
      <button
        v-tip="{ text: $t('top.menu'), key: $t('key.esc') }"
        class="coin"
        :aria-label="$t('top.menu')"
        data-testid="menu"
        @click="$emit('menu')"
      ><Icon name="menu" /></button>
    </div>
  </header>
</template>

<script>
import { RESOURCES } from '../sim/data/resources.js';
import Ring from './Ring.vue';

/** From this many seconds before payday the number appears in the medallion */
export const PAYDAY_SOON = 10;
/** Speed levels in the dropdown */
export const SPEEDS = [1, 2, 4];

export default {
  name: 'TopBar',
  components: { Ring },
  props: {
    ui: { type: Object, required: true },
    /** Resources missing for the currently shown building (red) */
    need: { type: Object, default: null },
  },
  emits: ['speed', 'pause', 'menu'],
  data() { return { resources: RESOURCES, speeds: SPEEDS, speedOpen: false, flash: false, tight: false }; },
  computed: {
    popPct() { return this.ui.pop[1] ? Math.min(100, (100 * this.ui.pop[0]) / this.ui.pop[1]) : 0; },
    popClass() { return this.popPct >= 100 ? 'bad' : this.popPct >= 85 ? 'warn' : 'good'; },
    motState() { const m = this.ui.motivation; return m < 40 ? 'bad' : m < 70 ? 'warn' : 'good'; },
    weatherColor() { return { summer: 'var(--gold-300)', rain: '#7fb4e8', winter: 'var(--frost)' }[this.ui.weather.state] ?? 'var(--gold-300)'; },
    soon() { return this.ui.paydayIn <= PAYDAY_SOON; },
    /** How far the payday is filled (0–100) */
    payPct() { return Math.round((1 - this.ui.paydayFrac) * 100); },
    short() {
      const n = this.need ?? {}, out = {};
      for (const r of RESOURCES) out[r] = (n[r] ?? 0) > this.ui.res[r];
      return out;
    },
    popTip() {
      return { title: this.$t('top.population'), text: this.$t('top.populationTip', { used: this.ui.pop[0], limit: this.ui.pop[1] }), lines: [[this.$t('top.workers'), this.ui.workers, 'worker']] };
    },
    motTip() { return { title: this.$t('top.motivation'), text: this.$t('top.motivationTip', { v: this.ui.motivation, max: this.ui.maxMotivation }) }; },
    faithTip() { return { title: this.$t('top.faith'), text: this.$t('top.faithTip', { v: this.ui.faith, cost: this.ui.blessingCost }) }; },
    weatherTip() {
      const w = this.ui.weather;
      return { title: this.$t('top.weather'), text: this.$t('top.weatherTip', { weather: this.$name.weather(w.state), next: this.$name.weather(w.next), s: w.in }) };
    },
    payTip() {
      const p = this.ui.payday;
      const lines = p.last ? [[this.$t('top.lastPayday', { income: p.last.income, wages: p.last.wages }), '', 'gold']] : [];
      return { title: this.$t('top.payday'), text: this.$t('top.paydayTip', { s: this.ui.paydayIn, income: p.income, wages: p.wages }), lines };
    },
  },
  watch: {
    // Payday has come (counter jumps up again): light up once
    'ui.paydayIn'(n, o) {
      if (o === undefined || n <= o + 5) return;
      this.flash = false;
      clearTimeout(this.flashT);
      requestAnimationFrame(() => { this.flash = true; this.flashT = setTimeout(() => { this.flash = false; }, 1400); });
    },
  },
  mounted() {
    // Speed menu closes on a click outside and with Esc
    this.onDown = (e) => { if (this.speedOpen && !this.$refs.speedBox?.contains(e.target)) this.speedOpen = false; };
    this.onKey = (e) => { if (e.key === 'Escape' && this.speedOpen) { e.stopPropagation(); this.speedOpen = false; } };
    document.addEventListener('pointerdown', this.onDown, true);
    // If the crest does not fit exactly in the middle (side plates too wide), it gets its own row
    this.ro = new ResizeObserver(() => this.measure());
    for (const el of [this.$refs.bar, this.$refs.res, this.$refs.crest, this.$refs.sys]) this.ro.observe(el);
    window.addEventListener('keydown', this.onKey, true);
  },
  beforeUnmount() {
    document.removeEventListener('pointerdown', this.onDown, true);
    this.ro?.disconnect();
    window.removeEventListener('keydown', this.onKey, true);
    clearTimeout(this.flashT);
  },
  methods: {
    measure() {
      const { bar, res, crest, sys } = this.$refs;
      if (!bar || !res || !crest || !sys) return;
      const gap = parseFloat(getComputedStyle(bar).columnGap) || 0;
      const need = 2 * Math.max(res.offsetWidth, sys.offsetWidth) + crest.offsetWidth + 2 * gap;
      this.tight = need > bar.clientWidth;
    },
    pickSpeed(s) { this.speedOpen = false; this.$emit('speed', s); },
    resTip(r) {
      return {
        title: this.$name.res(r),
        lines: [[this.$t('top.refined'), this.ui.stock[r]], [this.$t('top.raw'), this.ui.raw[r]], [this.$t('top.total'), this.ui.res[r]]],
      };
    },
  },
};
</script>

<style>
.topbar {
  position: fixed; z-index: 4; pointer-events: none;
  top: calc(var(--hud-gap) + var(--safe-t)); left: calc(var(--hud-gap) * 2 + var(--safe-l)); right: calc(var(--hud-gap) * 2 + var(--safe-r));
  display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0.5rem 1rem;
}
.topbar > * { pointer-events: auto; }
.tb-item { display: inline-flex; align-items: center; gap: 0.3125rem; padding: 0.1875rem 0.3125rem; border-radius: var(--r-sm); white-space: nowrap; cursor: default; outline-offset: 0; }
.tb-item:hover { background: rgba(255, 225, 170, 0.07); }
.tb-item > .ico { width: 1.375rem; height: 1.375rem; filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.45)); }
.tb-item b { font-size: var(--fs-lg); font-weight: 700; letter-spacing: 0.01em; text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6); }
.tb-item b small { font-size: 0.75em; color: var(--ink-muted); font-weight: 500; }
.tb-col { display: flex; flex-direction: column; line-height: 1.05; gap: 0.1875rem; }

.tb-res { display: flex; gap: 0.125rem; padding: 0.3125rem 0.625rem; min-height: 2.75rem; align-items: center; }
.tb-resitem b { min-width: 2.2ch; }
.tb-resitem.short b { color: var(--bad); }

/* Crest: two plates, between them the payday medallion */
.tb-crest { display: grid; grid-template-columns: 1fr auto 1fr; align-items: start; margin-inline: auto; }
.tb-plate-l { justify-content: flex-end; }
/* Wide windows: grid of three columns, the middle one (crest) lies exactly in the screen centre.
   Side columns equally wide (1fr), never narrower than their content; too little space: crest in its own, centred row (tight); phone: flow layout. */
.game:not(.compact) .topbar { display: grid; grid-template-columns: minmax(max-content, 1fr) auto minmax(max-content, 1fr); }
.game:not(.compact) .tb-res { justify-self: start; }
.game:not(.compact) .tb-crest { margin: 0; }
.game:not(.compact) .tb-sys { justify-self: end; margin: 0; }
.game:not(.compact) .topbar.tight { grid-template-columns: 1fr auto; grid-template-areas: 'res sys' 'crest crest'; }
.game:not(.compact) .topbar.tight .tb-res { grid-area: res; }
.game:not(.compact) .topbar.tight .tb-sys { grid-area: sys; }
.game:not(.compact) .topbar.tight .tb-crest { grid-area: crest; justify-self: center; }
.tb-plate { display: flex; align-items: center; gap: 0.625rem; min-height: 2.75rem; padding: 0.125rem 0.875rem; }
.tb-plate-l { padding-right: 2.75rem; }
.tb-plate-r { padding-left: 2.75rem; }
.tb-pop .meter { width: 2.75rem; height: 0.25rem; }
.mot-good b { color: var(--good); }
.mot-warn b { color: var(--warn); }
.mot-bad b { color: var(--bad); }
.tb-wx { width: 2rem; height: 2rem; }
.tb-wx .ico { width: 1.25rem; height: 1.25rem; }
.tb-wxname { font-size: var(--fs-md) !important; }
.tb-medal {
  position: relative; z-index: 1; flex: none; margin: 0 -2rem; width: 4.5rem; height: 4.5rem; border-radius: 50%; display: grid; place-items: center; cursor: default;
  background: conic-gradient(var(--gold-300) calc(var(--p) * 1%), rgba(20, 12, 6, 0.9) 0);
  box-shadow: 0 0 0 2px var(--wood-950), 0 6px 14px rgba(0, 0, 0, 0.5);
}
.tb-medal::before { content: ''; position: absolute; inset: 5px; border-radius: 50%; background: radial-gradient(circle at 50% 35%, var(--wood-600), var(--wood-900) 75%); box-shadow: inset 0 0 0 1px rgba(255, 225, 170, 0.25); }
.tb-medal > .ico { position: relative; width: 2.25rem; height: 2.25rem; }
.tb-soon { position: absolute; bottom: -0.5rem; left: 50%; transform: translateX(-50%); padding: 0 0.4375rem; border-radius: 0.625rem; background: var(--gold-300); color: var(--wood-950); font: 800 0.8125rem/1.25rem var(--body); box-shadow: 0 0 0 2px var(--wood-950); white-space: nowrap; }
.tb-soon small { font-size: 0.75em; }
.tb-medal.flash { animation: tb-flash 1.3s ease-out 1; }
@keyframes tb-flash { 0% { box-shadow: 0 0 0 2px var(--wood-950), 0 0 0 rgba(243, 200, 94, 0); } 25% { box-shadow: 0 0 0 2px var(--wood-950), 0 0 24px 6px rgba(243, 200, 94, 0.9); } 100% { box-shadow: 0 0 0 2px var(--wood-950), 0 6px 14px rgba(0, 0, 0, 0.5); } }

.tb-sys { display: flex; gap: 0.625rem; margin-left: auto; }
.tb-speedbox { position: relative; }
button.tb-speed { font-weight: 800; font-size: 1.125rem; letter-spacing: -0.02em; }
.tb-speedmenu { position: absolute; top: calc(100% + 0.5rem); left: 50%; transform: translateX(-50%); z-index: 8; display: flex; flex-direction: column; gap: 0.25rem; padding: 0.375rem; min-width: 10.5rem; }
button.tb-speedopt { display: flex; align-items: baseline; gap: 0.5rem; justify-content: flex-start; min-height: 2.5rem; padding: 0.25rem 0.75rem; font-size: 1.125rem; font-weight: 800; background: transparent; border-color: transparent; box-shadow: none; }
button.tb-speedopt small { font-size: var(--fs-xs); font-weight: 500; color: var(--ink-muted); white-space: nowrap; }
button.tb-speedopt.active { color: var(--gold-100); background: linear-gradient(180deg, rgba(243, 200, 94, 0.28), rgba(196, 141, 42, 0.12)); box-shadow: inset 0 0 0 1px var(--gold-500); }

.narrow .tb-hide-m { display: none !important; }
/* Somewhat narrower: condense plates so the crest still stays exactly centred */
.narrow .topbar { column-gap: 0.75rem; }
.narrow .tb-res { padding-inline: 0.5rem; }
.narrow .tb-resitem { padding-inline: 0.1875rem; gap: 0.25rem; }
.narrow .tb-plate { gap: 0.5rem; }
.narrow .tb-plate-l { padding-left: 0.625rem; padding-right: 2.5rem; }
.narrow .tb-plate-r { padding-right: 0.625rem; padding-left: 2.5rem; }
.mid .tb-resitem { padding-inline: 0.1875rem; }
.mid .tb-item b { font-size: var(--fs-md); }
.mid .tb-plate { gap: 0.5rem; }
.mid .tb-plate-l { padding-left: 0.625rem; }
.mid .tb-plate-r { padding-right: 0.625rem; }
.mid .tb-sys { gap: 0.5rem; }
/* Phone and narrow windows: resources across the full width, below them crest on the left and buttons on the right */
.compact .topbar { left: calc(var(--hud-gap) + var(--safe-l)); right: calc(var(--hud-gap) + var(--safe-r)); gap: 0.375rem 0; }
.compact .tb-res { flex: 1 1 100%; justify-content: space-between; padding: 0.125rem 0.375rem; min-height: 2.25rem; }
.compact .tb-resitem { gap: 0.1875rem; padding: 0.1875rem 0.0625rem; }
.compact .tb-resitem > .ico { width: 1.125rem; height: 1.125rem; }
.compact .tb-item b { font-size: var(--fs-sm); }
.compact .tb-crest { margin: 0; }
.compact .tb-plate { min-height: 2.25rem; gap: 0.375rem; padding: 0 0.5rem; }
.compact .tb-plate-l { padding-right: 2.125rem; }
.compact .tb-plate-r { padding-left: 2.125rem; }
.compact .tb-pop .meter { display: none; }
.compact .tb-medal { width: 3.5rem; height: 3.5rem; margin: 0 -1.625rem; }
.compact .tb-medal > .ico { width: 1.75rem; height: 1.75rem; }
.compact .tb-wx { width: 1.75rem; height: 1.75rem; }
.compact .tb-sys { margin-left: auto; gap: 0.375rem; }
.compact .tb-sys .coin { width: 2.5rem; height: 2.5rem; min-width: 2.5rem; min-height: 2.5rem; }
.compact .tb-speed { display: none !important; }
@media (max-width: 380px) {
  .tb-item b small { display: none; }
  .tb-pop b small { display: inline; }
}
/* Landscape phone: everything in one row, very flat */
@media (max-height: 480px) and (orientation: landscape) {
  .compact .topbar { flex-wrap: nowrap; }
  .compact .tb-res { flex: 0 1 auto; justify-content: flex-start; overflow: hidden; }
  .compact .tb-crest { flex: none; margin: 0; }
  .compact .tb-medal { width: 3rem; height: 3rem; margin: 0 -1.375rem; }
  .compact .tb-medal > .ico { width: 1.5rem; height: 1.5rem; }
  .compact .tb-plate-l { padding-right: 1.75rem; }
  .compact .tb-plate-r { padding-left: 1.75rem; }
}
</style>
