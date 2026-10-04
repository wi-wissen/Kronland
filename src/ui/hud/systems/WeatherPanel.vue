<template>
  <!-- Weather tower: forecast of the next weather conditions; weather power plant additionally energy and weather change -->
  <section class="bp-sec wx" data-testid="weather-panel">
    <h4 class="h-label"><Icon name="weather-rain" />{{ $t('sys.forecast') }}</h4>
    <ol class="wx-strip">
      <li class="wx-card now inset" :class="'w-' + weather.current">
        <Icon :name="'weather-' + weather.current" />
        <b>{{ $name.weather(weather.current) }}</b>
        <small class="num">{{ $t('sys.weatherEnds', { t: mmss(weather.endsIn) }) }}</small>
      </li>
      <li v-for="(f, i) in weather.forecast" :key="i" class="wx-card inset" :class="'w-' + f.state" :data-testid="'forecast-' + i">
        <Icon :name="'weather-' + f.state" />
        <b>{{ $name.weather(f.state) }}</b>
        <small class="num">{{ $t('sys.weatherIn', { t: mmss(f.in) }) }}</small>
        <small class="num dim">{{ $t('sys.weatherFor', { t: mmss(f.duration) }) }}</small>
      </li>
    </ol>

    <template v-if="weather.options">
      <h4 class="h-label"><Icon name="energy" />{{ $t('sys.energy') }}
        <span class="bp-running num" data-testid="weather-energy">{{ $t('sys.energyOf', { v: weather.energy, max: weather.maxEnergy }) }}</span>
      </h4>
      <div class="wx-energy">
        <span class="meter wx-bar" :class="{ full: weather.energy >= weather.cost }"><i :style="{ width: Math.min(100, (100 * weather.energy) / weather.maxEnergy) + '%' }"></i></span>
        <span v-if="weather.cooldown" class="wx-cd num"><Icon name="time" />{{ $t('sys.cooldown', { t: mmss(weather.cooldown) }) }}</span>
      </div>
      <p v-if="hints && weather.energy < weather.cost" class="bp-note"><Icon name="info" />{{ $t('sys.energyHint') }}</p>
      <div class="wx-opts" role="group" :aria-label="$t('sys.changeWeather')">
        <button
          v-for="o in weather.options"
          :key="o.state"
          v-tip="{ title: $t('sys.bringWeather', { weather: $name.weather(o.state) }), text: $t('sys.weatherFor', { t: mmss(weather.durationChange) }), reason: o.reason ? $reason(o.reason) : null }"
          class="wx-opt"
          :class="['w-' + o.state, { primary: !o.reason, current: weather.current === o.state }]"
          :aria-pressed="weather.current === o.state"
          :disabled="!!o.reason"
          :data-testid="'weather-' + o.state"
          @click="$emit('change', o.state)"
        >
          <Icon :name="'weather-' + o.state" />
          <span>{{ $t('sys.bringWeather', { weather: $name.weather(o.state) }) }}</span>
          <span v-if="weather.cooldown && weather.current !== o.state" class="cd" :style="{ '--cd': cdFrac }" aria-hidden="true"></span>
        </button>
      </div>
    </template>
  </section>
</template>

<script>
import { mmss } from '../../plugin.js';

export default {
  name: 'WeatherPanel',
  props: { weather: { type: Object, required: true }, hints: { type: Boolean, default: true } },
  emits: ['change'],
  computed: {
    cdFrac() { return Math.round((this.weather.cooldown / Math.max(1, this.weather.cooldownTotal)) * 100) / 100; },
  },
  methods: { mmss },
};
</script>

<style>
.wx-strip { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.375rem; }
.wx-card { position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.0625rem; padding: 0.375rem 0.25rem; text-align: center; min-width: 0; }
.wx-card .ico { width: 2rem; height: 2rem; }
.wx-card b { font-size: var(--fs-sm); }
.wx-card small { font-size: var(--fs-xs); color: var(--ink-muted); }
.wx-card small.dim { color: var(--ink-dim); }
.wx-card.now { box-shadow: inset 0 0 0 1px var(--gold-400), 0 0 10px rgba(243, 200, 94, 0.25); }
.wx-card.now b { color: var(--gold-200); }
.wx-card + .wx-card:not(.now)::before { content: ''; position: absolute; left: -0.3125rem; top: 50%; width: 0.25rem; height: 2px; background: var(--gold-500); }
.wx-card.w-rain { background: linear-gradient(180deg, rgba(74, 143, 216, 0.18), rgba(14, 9, 5, 0.38)); }
.wx-card.w-winter { background: linear-gradient(180deg, rgba(191, 227, 246, 0.18), rgba(14, 9, 5, 0.38)); }
.wx-card.w-summer { background: linear-gradient(180deg, rgba(245, 197, 66, 0.16), rgba(14, 9, 5, 0.38)); }
.wx-energy { display: flex; align-items: center; gap: 0.625rem; }
.wx-bar { flex: 1; height: 0.75rem; }
.wx-bar > i { background: linear-gradient(180deg, #ffe98a, #e0a020); }
.wx-bar.full > i { box-shadow: 0 0 8px rgba(255, 220, 110, 0.8); }
.wx-cd { display: inline-flex; align-items: center; gap: 0.25rem; font-size: var(--fs-xs); color: var(--warn); font-weight: 700; }
.wx-cd .ico { width: 0.875rem; height: 0.875rem; }
.wx-opts { display: grid; grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr)); gap: 0.375rem; }
.wx-opt { position: relative; overflow: hidden; display: inline-flex; align-items: center; gap: 0.4375rem; font-weight: 700; font-size: var(--fs-sm); }
.wx-opt .ico { width: 1.5rem; height: 1.5rem; position: relative; z-index: 1; }
.wx-opt span:not(.cd) { position: relative; z-index: 1; }
.wx-opt.current { filter: none !important; color: var(--gold-200); box-shadow: inset 0 0 0 1px var(--gold-400); background: linear-gradient(180deg, #4b3520, #33231a); cursor: default; }
.wx-opt .cd { position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(90deg, rgba(10, 6, 3, 0.55) calc(var(--cd) * 100%), transparent 0); pointer-events: none; }
@media (max-width: 760px) {
  .wx-strip { gap: 0.25rem; }
  .wx-card { padding: 0.25rem 0.125rem; }
  .wx-card .ico { width: 1.5rem; height: 1.5rem; }
  .wx-card b { font-size: var(--fs-xs); }
  .wx-card small { font-size: 0.6875rem; }
  .wx-card + .wx-card:not(.now)::before { display: none; }
  .wx-opt { min-height: var(--touch); }
}
</style>
