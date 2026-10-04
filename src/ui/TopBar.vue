<template>
  <header class="topbar" data-testid="topbar">
    <div class="tb-res frame" role="group" :aria-label="$t('top.resources')">
      <span
        v-for="r in resources"
        :key="r"
        v-tip="resTip(r)"
        class="tb-item tb-resitem"
        tabindex="0"
      >
        <Icon :name="r" />
        <span class="tb-col">
          <b class="num" :data-testid="'res-' + r">{{ ui.res[r] }}</b>
          <i v-if="ui.raw[r] > 0" class="tb-raw num">{{ ui.raw[r] }}</i>
        </span>
      </span>
    </div>

    <div class="tb-meta frame">
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
      <span v-if="ui.faith" v-tip="faithTip" class="tb-item tb-hide-s" tabindex="0">
        <Icon name="faith" />
        <b class="num">{{ ui.faith }}</b>
      </span>
      <span v-tip="weatherTip" class="tb-item tb-ring" tabindex="0" data-testid="weather">
        <Ring :frac="ui.weather.frac" :color="weatherColor"><Icon :name="'weather-' + ui.weather.state" /></Ring>
        <span class="tb-col tb-hide-s">
          <b>{{ $name.weather(ui.weather.state) }}</b>
          <i class="tb-raw num">{{ mmss(ui.weather.in) }}</i>
        </span>
      </span>
      <span v-tip="payTip" class="tb-item tb-ring" tabindex="0" data-testid="payday">
        <Ring :frac="ui.paydayFrac" color="var(--gold-300)" :urgent="ui.paydayIn <= 10"><Icon name="payday" /></Ring>
        <b class="num tb-pay">{{ ui.paydayIn }}<small>s</small></b>
      </span>
    </div>

    <div class="tb-ctl frame">
      <div class="tb-speed" role="group" :aria-label="$t('top.speed', { n: ui.speed })">
        <button
          v-tip="{ text: ui.paused ? $t('top.resume') : $t('top.pause'), key: $t('key.space') }"
          class="icon-btn"
          :class="{ active: ui.paused }"
          :aria-label="ui.paused ? $t('top.resume') : $t('top.pause')"
          :aria-pressed="ui.paused"
          data-testid="pause"
          @click="$emit('pause')"
        ><Icon :name="ui.paused ? 'play' : 'pause'" /></button>
        <button
          v-for="s in [1, 2, 4]"
          :key="s"
          v-tip="$t('top.speed', { n: s })"
          class="tb-spd num tb-hide-xs"
          :class="{ active: !ui.paused && ui.speed === s }"
          :aria-pressed="!ui.paused && ui.speed === s"
          :aria-label="$t('top.speed', { n: s })"
          @click="$emit('speed', s)"
        >{{ s }}×</button>
      </div>
      <button
        v-tip="{ text: $t('top.menu'), key: $t('key.esc') }"
        class="icon-btn tb-menu"
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
import { mmss } from './plugin.js';

export default {
  name: 'TopBar',
  components: { Ring },
  props: { ui: { type: Object, required: true } },
  emits: ['speed', 'pause', 'menu'],
  data() { return { resources: RESOURCES }; },
  computed: {
    popPct() { return this.ui.pop[1] ? Math.min(100, (100 * this.ui.pop[0]) / this.ui.pop[1]) : 0; },
    popClass() { return this.popPct >= 100 ? 'bad' : this.popPct >= 85 ? 'warn' : 'good'; },
    motState() { const m = this.ui.motivation; return m < 40 ? 'bad' : m < 70 ? 'warn' : 'good'; },
    weatherColor() { return { summer: 'var(--gold-300)', rain: '#7fb4e8', winter: 'var(--frost)' }[this.ui.weather.state] ?? 'var(--gold-300)'; },
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
  methods: {
    mmss,
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
  position: fixed; z-index: 4;
  top: calc(var(--hud-gap) + var(--safe-t)); left: calc(var(--hud-gap) + var(--safe-l)); right: calc(var(--hud-gap) + var(--safe-r));
  display: flex; gap: var(--hud-gap); align-items: stretch; pointer-events: none;
}
.topbar > * { pointer-events: auto; }
.topbar .frame { display: flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.625rem; min-height: var(--top-h); border-radius: var(--r-lg); }
.tb-res { flex: 0 1 auto; gap: 0.125rem 0.375rem !important; }
.tb-meta { flex: 1 1 auto; justify-content: center; gap: 0.25rem 0.75rem !important; }
.tb-ctl { flex: none; gap: 0.375rem !important; padding-inline: 0.375rem !important; margin-left: auto; }
/* Large UI scaling (up to 130 %): better to wrap than to push pause/menu off screen */
.topbar { flex-wrap: wrap; }
.tb-res, .tb-meta { flex-wrap: wrap; min-width: 0; }
.tb-item { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.1875rem 0.3125rem; border-radius: var(--r-sm); white-space: nowrap; cursor: default; outline-offset: 0; }
.tb-item:hover { background: rgba(255, 225, 170, 0.06); }
.tb-item > .ico { width: 1.625rem; height: 1.625rem; filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.45)); }
.tb-resitem { min-width: 4.25rem; }
.tb-col { display: flex; flex-direction: column; line-height: 1.05; gap: 0.125rem; }
.tb-item b { font-size: var(--fs-lg); font-weight: 700; letter-spacing: 0.01em; text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6); }
.tb-item b small { font-size: 0.75em; color: var(--ink-muted); font-weight: 500; }
.tb-raw { font-style: normal; font-size: 0.6875rem; color: var(--ink-dim); }
.tb-raw::before { content: '+'; }
.tb-ring .tb-raw::before { content: ''; }
.tb-pop .meter { width: 3.25rem; height: 0.25rem; }
.tb-pop .tb-col { gap: 0.25rem; }
.mot-good b { color: var(--good); }
.mot-warn b { color: var(--warn); }
.mot-bad b { color: var(--bad); }
.tb-ring .ring { width: 2.125rem; height: 2.125rem; }
.tb-ring .ring .ico { width: 1.25rem; height: 1.25rem; }
.tb-pay { min-width: 2.75rem; }
.tb-speed { display: flex; gap: 0.25rem; padding: 3px; border-radius: var(--r-md); background: var(--inset-bg); box-shadow: var(--inset-edge); }
.tb-speed button { min-height: 2.125rem; height: 2.125rem; }
.tb-speed .icon-btn { width: 2.125rem; min-width: 2.125rem; }
.tb-spd { padding: 0 0.5rem; font-size: var(--fs-sm); font-weight: 700; }
.tb-menu { width: 2.75rem !important; min-height: 2.75rem; }
.tb-menu .ico { width: 1.375rem; height: 1.375rem; }

@media (max-width: 1100px) {
  .tb-res .tb-raw { display: none; }
  .tb-resitem { min-width: 3.625rem; }
  .tb-meta { gap: 0.25rem 0.5rem !important; }
}
@media (max-width: 860px) {
  .topbar { flex-wrap: wrap; }
  .tb-res { flex: 1 1 100%; justify-content: space-between; }
  .tb-meta { justify-content: flex-start; }
  .topbar .frame { min-height: 2.75rem; padding: 0.125rem 0.375rem; }
}
@media (max-width: 640px) {
  .topbar { --hud-gap: 0.375rem; gap: 0.25rem; }
  .tb-meta { flex: 1 1 0; min-width: 0; justify-content: space-between; }
  .tb-hide-s { display: none !important; }
  .tb-resitem { min-width: 0; gap: 0.1875rem; padding: 0.125rem; }
  .tb-item > .ico { width: 1.25rem; height: 1.25rem; }
  .tb-item b { font-size: var(--fs-md); }
  .tb-meta { gap: 0.125rem 0.375rem !important; }
  .tb-pop .meter { width: 2.5rem; }
  .tb-ring .ring { width: 1.875rem; height: 1.875rem; }
}
@media (max-width: 420px) {
  .tb-hide-xs { display: none !important; }
  .tb-pop .meter { display: none; }
  .tb-pay small, .tb-item b small { display: none; }
  .tb-pop b small { display: inline; }
  .tb-pay { min-width: 0; }
  .tb-meta { padding-inline: 0.25rem !important; }
  .tb-ctl { gap: 0.25rem !important; padding-inline: 0.25rem !important; }
}
/* Landscape phone: one row, very flat */
@media (max-height: 480px) and (orientation: landscape) {
  .topbar { flex-wrap: nowrap; --hud-gap: 0.375rem; }
  .tb-res { flex: 1 1 auto; justify-content: space-between; }
  .topbar .frame { min-height: 2.5rem; padding: 0.125rem 0.375rem; }
  .tb-res .tb-raw, .tb-hide-s { display: none !important; }
  .tb-resitem { min-width: 0; padding: 0.125rem; gap: 0.1875rem; }
  .tb-item > .ico { width: 1.25rem; height: 1.25rem; }
  .tb-item b { font-size: var(--fs-md); }
  .tb-meta { flex: 0 1 auto; gap: 0.125rem 0.375rem !important; }
  .tb-pop .meter { width: 2.5rem; }
  .tb-ring .ring { width: 1.875rem; height: 1.875rem; }
  .tb-spd { display: none; }
  .tb-menu { min-height: 2.5rem; width: 2.5rem !important; }
  /* one row: displays may be clipped, pause and menu always stay reachable */
  .tb-res, .tb-meta { flex-wrap: nowrap; overflow: hidden; }
}
</style>
