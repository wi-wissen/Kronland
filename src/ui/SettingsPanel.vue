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
      <h4 class="h-label"><Icon name="banner" />{{ $t('set.playerColor') }}</h4>
      <div class="st-colors" role="radiogroup" :aria-label="$t('set.playerColor')">
        <button
          v-for="(c, i) in colorIds"
          :key="c"
          role="radio"
          class="st-color"
          :aria-checked="s.playerColor === i"
          :aria-label="$t('set.color.' + c)"
          :class="{ active: s.playerColor === i }"
          :style="{ '--swatch': colorCss[i] }"
          :data-testid="'player-color-' + c"
          @click="set('playerColor', i)"
        ><span class="st-swatch"></span><span>{{ $t('set.color.' + c) }}</span></button>
      </div>
      <p class="st-note">{{ $t(inGame ? 'set.playerColorNoteGame' : 'set.playerColorNote') }}</p>
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
      <button class="switch" role="switch" :aria-checked="s.menuMotion" data-testid="menu-motion" @click="set('menuMotion', !s.menuMotion)">
        <span class="st-sl-label"><Icon name="display" />{{ $t('set.menuMotion') }}</span><span class="track"></span>
      </button>
      <p class="st-note">{{ $t('set.menuMotionNote') }}</p>
    </section>

    <section class="st-sec">
      <h4 class="h-label"><Icon name="sound" />{{ $t('set.sound') }}</h4>
      <button class="switch" role="switch" :aria-checked="s.muted" data-testid="muted" @click="set('muted', !s.muted)">
        <span class="st-sl-label"><Icon name="mute" />{{ $t('set.muted') }}</span><span class="track"></span>
      </button>
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
      <span class="st-sl-label st-sub"><Icon name="time" />{{ $t('set.musicPause') }}</span>
      <div class="seg" role="radiogroup" :aria-label="$t('set.musicPause')">
        <button
          v-for="p in pauses"
          :key="p"
          role="radio"
          :aria-checked="s.musicPause === p"
          :class="{ active: s.musicPause === p }"
          :data-testid="'music-pause-' + p"
          @click="set('musicPause', p)"
        >{{ $t('set.pause.' + p) }}</button>
      </div>
      <p class="st-note">{{ $t('set.musicPauseNote') }}</p>
      <span class="st-sl-label st-sub"><Icon name="scroll" />{{ $t('set.barks') }}</span>
      <div class="seg" role="radiogroup" :aria-label="$t('set.barks')">
        <button
          v-for="b in barkModes"
          :key="b"
          role="radio"
          :aria-checked="s.barks === b"
          :class="{ active: s.barks === b }"
          :data-testid="'barks-' + b"
          @click="set('barks', b)"
        >{{ $t('set.barks.' + b) }}</button>
      </div>
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
      <button class="switch" role="switch" :aria-checked="s.speech" data-testid="speech" @click="set('speech', !s.speech)">
        <span class="st-sl-label"><Icon name="scroll" />{{ $t('set.speech') }}</span><span class="track"></span>
      </button>
      <p class="st-note">{{ $t('set.speechNote') }}</p>
      <button class="switch" role="switch" :aria-checked="s.dialogCamera" data-testid="dialog-camera" @click="set('dialogCamera', !s.dialogCamera)">
        <span class="st-sl-label"><Icon name="target" />{{ $t('set.dialogCamera') }}</span><span class="track"></span>
      </button>
      <p class="st-note">{{ $t('set.dialogCameraNote') }}</p>
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
import { settings, set, DEFAULTS, MUSIC_PAUSE_OPTIONS, BARK_OPTIONS } from './settings.js';
import { LANGS } from '../i18n/index.js';
import { devState, setDevMode } from '../dev/state.js';
import { PLAYER_COLOR_IDS, PLAYER_COLOR_CSS } from '../render/playerColors.js';

export default {
  name: 'SettingsPanel',
  props: { inGame: Boolean },
  emits: ['close', 'quality'],
  data() { return { s: settings, langs: LANGS, qualities: ['auto', 'low', 'medium', 'high'], pauses: MUSIC_PAUSE_OPTIONS, barkModes: BARK_OPTIONS, preview: null, dev: devState, colorIds: PLAYER_COLOR_IDS, colorCss: PLAYER_COLOR_CSS }; },
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
.st-sub { margin-top: 0.25rem; }
.st-slider b { text-align: right; font-weight: 700; color: var(--gold-200); }
.st-colors { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.375rem; }
.st-color { display: flex; align-items: center; justify-content: center; gap: 0.4375rem; min-height: var(--touch); padding: 0.25rem 0.5rem; }
.st-swatch { flex: none; width: 1.125rem; height: 1.125rem; border-radius: 50%; background: var(--swatch); box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.35); }
.st-color.active { box-shadow: inset 0 0 0 2px var(--gold-300); color: var(--gold-100); }
.st-color.active .st-swatch { box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.35), 0 0 0 2px var(--gold-200); }
.st-foot { display: flex; justify-content: space-between; gap: 0.5rem; padding-top: 0.25rem; }
.st-foot .primary { min-width: 8rem; min-height: var(--touch); }
@media (max-width: 480px) {
  .st-slider { grid-template-columns: 1fr 2.75rem; }
  .st-slider input { grid-column: 1 / -1; grid-row: 2; }
  .st-colors { grid-template-columns: repeat(2, 1fr); }
}
</style>
