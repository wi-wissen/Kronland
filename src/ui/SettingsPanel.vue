<template>
  <div class="settings" data-testid="settings">
    <section class="st-sec">
      <h4 class="h-label"><Icon name="globe" />{{ $t('set.language') }}</h4>
      <div class="seg" role="radiogroup" :aria-label="$t('set.language')">
        <button
          v-for="l in langs"
          :key="l"
          role="radio"
          :aria-checked="s.lang === l"
          :class="{ active: s.lang === l }"
          :lang="l"
          :data-testid="'lang-' + l"
          @click="set('lang', l)"
        >{{ $t('set.lang.' + l) }}</button>
      </div>
    </section>

    <section class="st-sec">
      <h4 class="h-label"><Icon name="display" />{{ $t('set.graphics') }}</h4>
      <div class="seg" role="radiogroup" :aria-label="$t('set.quality')">
        <button
          v-for="q in qualities"
          :key="q"
          role="radio"
          :aria-checked="s.quality === q"
          :class="{ active: s.quality === q }"
          :data-testid="'quality-' + q"
          @click="setQuality(q)"
        >{{ $t('set.q.' + q) }}</button>
      </div>
      <p v-if="inGame" class="st-note">{{ $t('set.qualityNote') }}</p>
    </section>

    <section class="st-sec">
      <h4 class="h-label"><Icon name="sound" />{{ $t('set.sound') }}</h4>
      <label v-for="k in ['master', 'music', 'effects']" :key="k" class="st-slider">
        <span class="st-sl-label"><Icon :name="k === 'master' ? 'sound' : k" />{{ $t('set.' + k) }}</span>
        <input
          type="range" min="0" max="100" step="5"
          :value="Math.round(s[k] * 100)"
          :style="{ '--fill': Math.round(s[k] * 100) + '%' }"
          :aria-label="$t('set.' + k)"
          :data-testid="'vol-' + k"
          @input="set(k, $event.target.value / 100)"
        >
        <b class="num">{{ Math.round(s[k] * 100) }}</b>
      </label>
    </section>

    <section class="st-sec">
      <h4 class="h-label"><Icon name="keyboard" />{{ $t('set.interface') }}</h4>
      <label class="st-slider">
        <span class="st-sl-label"><Icon name="scale" />{{ $t('set.uiScale') }}</span>
        <input
          type="range" min="90" max="130" step="5"
          :value="Math.round(s.uiScale * 100)"
          :style="{ '--fill': ((s.uiScale * 100 - 90) / 40) * 100 + '%' }"
          :aria-label="$t('set.uiScale')"
          data-testid="ui-scale"
          @change="set('uiScale', $event.target.value / 100)"
          @input="preview = $event.target.value"
        >
        <b class="num">{{ preview ?? Math.round(s.uiScale * 100) }} %</b>
      </label>
      <button class="switch" role="switch" :aria-checked="s.edgeScroll" data-testid="edge-scroll" @click="set('edgeScroll', !s.edgeScroll)">
        <span class="st-sl-label"><Icon name="edge" />{{ $t('set.edgeScroll') }}</span><span class="track"></span>
      </button>
      <button class="switch" role="switch" :aria-checked="s.hints" data-testid="hints" @click="set('hints', !s.hints)">
        <span class="st-sl-label"><Icon name="hint" />{{ $t('set.hints') }}</span><span class="track"></span>
      </button>
      <button class="switch" role="switch" :aria-checked="s.labels" data-testid="labels" @click="set('labels', !s.labels)">
        <span class="st-sl-label"><Icon name="info" />{{ $t('set.labels') }}</span><span class="track"></span>
      </button>
      <p class="st-note">{{ $t('set.labelsNote') }}</p>
      <button class="switch" role="switch" :aria-checked="dev.on" data-testid="dev-mode" @click="toggleDev">
        <span class="st-sl-label"><Icon name="display" />{{ $t('dev.toggle') }}</span><span class="track"></span>
      </button>
      <p class="st-note">{{ $t('dev.settingsNote') }}</p>
    </section>

    <section class="st-sec">
      <h4 class="h-label"><Icon name="save" />{{ $t('set.saves') }}</h4>
      <button class="switch" role="switch" :aria-checked="s.autosave" data-testid="autosave" @click="set('autosave', !s.autosave)">
        <span class="st-sl-label"><Icon name="time" />{{ $t('set.autosave') }}</span><span class="track"></span>
      </button>
    </section>

    <div class="st-foot">
      <button class="ghost" data-testid="settings-reset" @click="reset">{{ $t('set.reset') }}</button>
      <button class="primary" data-testid="settings-done" @click="$emit('close')">{{ $t('set.done') }}</button>
    </div>
  </div>
</template>

<script>
import { settings, set, DEFAULTS } from './settings.js';
import { LANGS } from '../i18n/index.js';
import { devState, setDevMode } from '../dev/state.js';

export default {
  name: 'SettingsPanel',
  props: { inGame: Boolean },
  emits: ['close', 'quality'],
  data() { return { s: settings, langs: LANGS, qualities: ['auto', 'low', 'medium', 'high'], preview: null, dev: devState }; },
  methods: {
    set(k, v) { set(k, v); if (k === 'uiScale') this.preview = null; },
    setQuality(q) { set('quality', q); this.$emit('quality', q); },
    toggleDev() { setDevMode(!this.dev.on); },
    reset() { for (const [k, v] of Object.entries(DEFAULTS)) set(k, v); },
  },
};
</script>

<style>
.settings { display: flex; flex-direction: column; gap: 0.875rem; }
.st-sec { display: flex; flex-direction: column; gap: 0.375rem; }
.st-sec .h-label .ico { width: 1rem; height: 1rem; }
.st-note { margin: 0; font-size: var(--fs-xs); color: var(--ink-dim); }
.st-slider { display: grid; grid-template-columns: minmax(8rem, 11rem) 1fr 3rem; align-items: center; gap: 0.625rem; }
.st-sl-label { display: inline-flex; align-items: center; gap: 0.4375rem; color: var(--ink); font-size: var(--fs-md); }
.st-sl-label .ico { width: 1.125rem; height: 1.125rem; color: var(--gold-300); }
.st-slider b { text-align: right; font-weight: 700; color: var(--gold-200); }
.st-foot { display: flex; justify-content: space-between; gap: 0.5rem; padding-top: 0.25rem; }
.st-foot .primary { min-width: 8rem; min-height: var(--touch); }
@media (max-width: 480px) {
  .st-slider { grid-template-columns: 1fr 2.75rem; }
  .st-slider input { grid-column: 1 / -1; grid-row: 2; }
}
</style>
