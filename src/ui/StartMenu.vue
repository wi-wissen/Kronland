<template>
  <div class="start backdrop" data-testid="start-menu">
    <div class="sm-wrap">
      <header class="sm-brand">
        <Icon name="crown" class="sm-crown" />
        <h1>{{ $t('app.title') }}</h1>
        <p>{{ $t('app.tagline') }}</p>
      </header>

      <div class="sm-cols">
        <nav class="sm-modes">
          <p v-if="recovered" class="sm-recovered parchment" role="status" data-testid="recovered-hint"><Icon name="warning" />{{ latest ? $t('crash.recovered') : $t('crash.recoveredNoSave') }}</p>
          <button v-if="latest" class="primary sm-continue" data-testid="continue" :disabled="busy" @click="continueLatest">
            <Icon name="load" />
            <span class="sm-cont-txt"><b>{{ $t('menu.continueLatest') }}</b><small data-testid="continue-name">{{ latest.auto ? $t('saves.auto') + ' · ' : '' }}{{ latest.name }}</small></span>
          </button>
          <p v-if="error" class="sm-error" role="alert" data-testid="continue-error"><Icon name="warning" />{{ error }}</p>
          <button class="sm-mode" data-testid="menu-tutorial" @click="$emit('tutorial')">
            <span class="sm-seal"><Icon name="scroll" /></span>
            <span><b>{{ $t('menu.tutorial') }}</b><small>{{ $t('menu.tutorialSub') }}</small></span>
          </button>
          <button class="sm-mode" data-testid="menu-campaign" @click="$emit('campaign')">
            <span class="sm-seal"><Icon name="banner" /></span>
            <span><b>{{ $t('menu.campaign') }}</b><small>{{ $t('menu.campaignSub') }}</small></span>
          </button>
          <button class="sm-mode" data-testid="menu-adventures" @click="$emit('adventures')">
            <span class="sm-seal"><Icon name="mode-adventure" /></span>
            <span><b>{{ $t('menu.adventures') }}</b><small>{{ $t('menu.adventuresSub') }}</small></span>
          </button>
          <button class="sm-mode" data-testid="menu-special" @click="$emit('special')">
            <span class="sm-seal"><Icon name="mode-special" /></span>
            <span><b>{{ $t('menu.special') }}</b><small>{{ $t('menu.specialSub') }}</small></span>
          </button>
          <div class="sm-tools">
            <button class="sm-tool" data-testid="menu-saves" @click="savesOpen = true"><Icon name="load" />{{ $t('menu.saves') }}</button>
            <button class="sm-tool" data-testid="menu-settings" @click="settingsOpen = true"><Icon name="settings" />{{ $t('menu.settings') }}</button>
            <div class="seg sm-lang" role="radiogroup" :aria-label="$t('menu.language')">
              <button v-for="l in ['de', 'en']" :key="l" role="radio" :aria-checked="$i18n.lang === l" :class="{ active: $i18n.lang === l }" :lang="l" :data-testid="'menu-lang-' + l" @click="setLang(l)">{{ l.toUpperCase() }}</button>
            </div>
          </div>
        </nav>

        <section class="sm-free frame">
          <h2 class="h-title">{{ $t('menu.freePlay') }}</h2>
          <p class="sm-sub">{{ $t('menu.freePlaySub') }}</p>
          <div class="sm-field">
            <span class="h-label">{{ $t('menu.opponents') }}</span>
            <div class="seg">
              <button v-for="n in [1, 2, 3]" :key="n" :class="{ active: opponents === n }" :aria-pressed="opponents === n" :data-testid="'opp-' + n" @click="opponents = n">{{ n }}</button>
            </div>
          </div>
          <div class="sm-field">
            <span class="h-label">{{ $t('menu.difficulty') }}</span>
            <div class="seg">
              <button v-for="d in ['easy', 'normal', 'hard']" :key="d" :class="{ active: difficulty === d }" :aria-pressed="difficulty === d" :data-testid="'diff-' + d" @click="difficulty = d">{{ $t('menu.diff.' + d) }}</button>
            </div>
          </div>
          <div class="sm-field">
            <span class="h-label">{{ $t('menu.hero') }}</span>
            <div class="sm-heroes">
              <button v-for="h in heroes" :key="h" class="sm-hero" :class="{ active: hero === h }" :aria-pressed="hero === h" :data-testid="'hero-pick-' + h" @click="hero = h">
                <span class="sm-heroimg"><Icon :name="'hero-' + h" /></span>
                <b>{{ $name.hero(h) }}</b>
              </button>
            </div>
            <span class="sm-hint">{{ $t('menu.hero.' + hero) }}</span>
          </div>
          <div class="sm-field">
            <span class="h-label">{{ $t('menu.fog') }}</span>
            <div class="seg" role="radiogroup" :aria-label="$t('menu.fog')">
              <button v-for="f in [true, false]" :key="String(f)" role="radio" :aria-checked="fog === f" :class="{ active: fog === f }" :data-testid="'fog-' + (f ? 'on' : 'off')" @click="fog = f">{{ $t(f ? 'menu.fog.on' : 'menu.fog.off') }}</button>
            </div>
            <span class="sm-hint">{{ $t(fog ? 'menu.fog.hint.on' : 'menu.fog.hint.off') }}</span>
          </div>
          <div class="sm-field">
            <span class="h-label">{{ $t('menu.map') }}</span>
            <div class="sm-seed">
              <input id="seed" v-model.number="seed" type="number" min="1" max="999999" :aria-label="$t('menu.mapNumber')">
              <button v-tip="$t('menu.randomMap')" class="sm-roll" @click="seed = Math.floor(Math.random() * 99999) + 1"><Icon name="dice" />{{ $t('menu.roll') }}</button>
            </div>
          </div>
          <button class="primary sm-start" data-testid="start" @click="start">{{ $t('menu.start') }}</button>
        </section>
      </div>
      <nav class="sm-links" :aria-label="$t('site.links')">
        <a :href="links.home" data-testid="menu-link-home">{{ $t('site.home') }}</a>
        <a :href="links.manual" data-testid="menu-link-manual">{{ $t('site.manual') }}</a>
        <a :href="links.compendium" data-testid="menu-link-compendium">{{ $t('site.compendium') }}</a>
        <a :href="links.scripting" data-testid="menu-link-scripting">{{ $t('site.scripting') }}</a>
        <a :href="links.blog" data-testid="menu-link-blog">{{ $t('site.blog') }}</a>
      </nav>
      <p class="sm-credits">{{ $t('menu.credits') }}</p>
    </div>

    <div v-if="savesOpen" class="scrim" @click.self="savesOpen = false">
      <div class="dialog frame sm-saves" role="dialog" aria-modal="true" :aria-label="$t('saves.title.manage')" data-testid="saves-dialog">
        <header class="dialog-head">
          <h2 class="h-title">{{ $t('saves.title.manage') }}</h2>
          <button class="icon-btn ghost" :aria-label="$t('common.close')" data-testid="saves-close" @click="savesOpen = false"><Icon name="close" /></button>
        </header>
        <div class="dialog-body scroll-y">
          <SaveBrowser ref="saves" mode="load" :touch="touch" @load="$emit('load', $event)" @changed="$emit('saves-changed')" />
        </div>
      </div>
    </div>

    <div v-if="settingsOpen" class="scrim" @click.self="settingsOpen = false">
      <div class="dialog frame" role="dialog" aria-modal="true" :aria-label="$t('set.title')">
        <header class="dialog-head">
          <h2 class="h-title">{{ $t('set.title') }}</h2>
          <button class="icon-btn ghost" :aria-label="$t('common.close')" @click="settingsOpen = false"><Icon name="close" /></button>
        </header>
        <div class="dialog-body scroll-y"><SettingsPanel @close="settingsOpen = false" /></div>
      </div>
    </div>
  </div>
</template>

<script>
import SettingsPanel from './SettingsPanel.vue';
import SaveBrowser from './saves/SaveBrowser.vue';
import { set } from './settings.js';
import { getStore, SaveError } from '../save/index.js';
import { HERO_IDS } from '../sim/data/units.js';
import { siteRoot } from '../paths.js';

export default {
  name: 'StartMenu',
  components: { SettingsPanel, SaveBrowser },
  props: {
    /** Latest save game (entry from src/save/store.js) for "Continue" */
    latest: { type: Object, default: null },
    /** Page reloaded after a game error or game left after an error: notice about "Continue" */
    recovered: { type: Boolean, default: false },
  },
  emits: ['start', 'load', 'tutorial', 'campaign', 'saves-changed', 'adventures', 'special'],
  data() {
    return {
      opponents: 1, difficulty: 'normal', hero: 'nelia', heroes: HERO_IDS,
      seed: Math.floor(Math.random() * 99999) + 1, settingsOpen: false, savesOpen: false, fog: true,
      busy: false, error: '', touch: globalThis.matchMedia?.('(pointer: coarse)').matches ?? false,
      // Website: home page, manual, compendium, scripting reference (relative to the root, see src/paths.js)
      links: { home: siteRoot(), manual: `${siteRoot()}manual/`, compendium: `${siteRoot()}compendium/`, scripting: `${siteRoot()}scripting/`, blog: `${siteRoot()}blog/` },
    };
  },
  mounted() {
    this.onKey = (e) => {
      if (e.key !== 'Escape' || !this.savesOpen || document.querySelector('[data-testid="confirm-dialog"]')) return;
      if (!this.$refs.saves?.escape()) this.savesOpen = false;
    };
    window.addEventListener('keydown', this.onKey);
  },
  beforeUnmount() { window.removeEventListener('keydown', this.onKey); },
  methods: {
    /** "Continue": load the latest save (also the autosave). */
    async continueLatest() {
      this.busy = true;
      this.error = '';
      try {
        const store = await getStore();
        this.$emit('load', await store.load(this.latest.id));
      } catch (e) {
        this.error = this.$t(e instanceof SaveError ? e.code : 'saves.err.unknown', e?.params ?? {});
      } finally { this.busy = false; }
    },
    setLang(l) { set('lang', l); },
    start() {
      this.$emit('start', { players: this.opponents + 1, difficulty: this.difficulty, hero: this.hero, seed: this.seed || 1, fog: this.fog });
    },
  },
};
</script>

<style>
/* Shared background of the menus: painted title image (public/art/title.webp, loading screen loading.webp; addresses
   set by src/ui/art.js as --art-title/--art-loading), above it a darkening gradient for legibility.
   Below it as a fallback (image still loading or missing) the evening sky over hills made of gradients. */
.backdrop {
  --backdrop-art: var(--art-title, none);
  position: fixed; inset: 0; overflow-y: auto; padding: max(1rem, var(--safe-t)) 1rem max(1rem, var(--safe-b));
  background:
    linear-gradient(180deg, rgba(14, 10, 6, 0.5) 0%, rgba(14, 10, 6, 0.18) 30%, rgba(14, 10, 6, 0.32) 60%, rgba(14, 10, 6, 0.62) 100%),
    var(--backdrop-art) center 40% / cover no-repeat,
    radial-gradient(ellipse 60% 40% at 72% 18%, rgba(255, 214, 140, 0.55), transparent 70%),
    radial-gradient(ellipse 120% 60% at 30% 118%, #2f4a2a 0 40%, transparent 41%),
    radial-gradient(ellipse 90% 50% at 90% 120%, #3b5a33 0 45%, transparent 46%),
    radial-gradient(ellipse 140% 55% at 50% 135%, #24381f 0 50%, transparent 51%),
    linear-gradient(180deg, #2c3e5c 0%, #6f6b7a 38%, #d79a62 62%, #3a2a1c 100%);
}
.backdrop::after {
  content: ''; position: fixed; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 45%, rgba(10, 6, 3, 0.55));
}
.backdrop > * { position: relative; z-index: 1; }
.backdrop.loading { --backdrop-art: var(--art-loading, var(--art-title, none)); }
.sm-wrap { max-width: 60rem; margin: 0 auto; min-height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 1.25rem; }
.sm-brand { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.125rem; }
.sm-crown { width: 3.25rem !important; height: 3.25rem !important; filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.5)); }
.sm-brand h1 {
  margin: 0; font-family: var(--display); font-size: clamp(2.75rem, 8vw, 4.5rem); line-height: 1; letter-spacing: 0.06em;
  color: var(--gold-200); text-shadow: 0 2px 0 var(--gold-800), 0 4px 14px rgba(0, 0, 0, 0.6);
}
.sm-brand p { margin: 0.375rem 0 0; color: #fff3da; font-size: var(--fs-lg); text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8); }
.sm-cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 1rem; align-items: start; }
.sm-modes { display: flex; flex-direction: column; gap: 0.625rem; }
.sm-continue { display: flex; align-items: center; justify-content: center; gap: 0.625rem; min-height: 3.25rem; font-size: var(--fs-lg); }
.sm-cont-txt { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; line-height: 1.15; }
.sm-cont-txt small { font-size: var(--fs-xs); font-weight: 400; opacity: 0.85; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sm-recovered { margin: 0; display: flex; gap: 0.5rem; align-items: flex-start; padding: 0.5rem 0.75rem; font-size: var(--fs-sm); line-height: 1.4; }
.sm-error { margin: 0; display: flex; gap: 0.5rem; padding: 0.5rem 0.75rem; border-radius: var(--r-md); background: rgba(80, 18, 14, 0.85); color: #ffd9d2; font-size: var(--fs-sm); }
.sm-saves { width: min(40rem, 100%); }
.sm-mode {
  display: flex; align-items: center; gap: 0.875rem; text-align: left; padding: 0.875rem 1rem; min-height: 5rem;
  background: var(--panel-bg); box-shadow: var(--panel-edge); border-color: transparent; border-radius: var(--r-lg);
}
.sm-mode b { display: block; font-family: var(--display); color: var(--gold-200); font-size: var(--fs-xl); line-height: 1.1; }
.sm-mode small { color: var(--ink-muted); font-size: var(--fs-sm); }
.sm-seal { flex: none; width: 3.25rem; height: 3.25rem; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 40% 30%, #fbf1d6, #c9a66b); box-shadow: inset 0 0 0 2px var(--gold-500), 0 0 0 2px var(--wood-950), 0 3px 6px rgba(0, 0, 0, 0.5); }
.sm-seal .ico { width: 2.125rem; height: 2.125rem; }
.sm-tools { display: flex; gap: 0.5rem; align-items: stretch; flex-wrap: wrap; }
.sm-tool { flex: 1 1 8rem; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; min-height: var(--touch); }
.sm-lang { flex: none; width: 7rem; }
.sm-free { padding: 1rem 1.125rem 1.125rem; display: flex; flex-direction: column; gap: 0.75rem; }
.sm-free .h-title { font-size: var(--fs-xl); }
.sm-sub { margin: -0.5rem 0 0; color: var(--ink-muted); font-size: var(--fs-sm); }
.sm-field { display: flex; flex-direction: column; gap: 0.375rem; }
.sm-field .seg > button { min-height: 2.5rem; }
.sm-heroes { display: grid; grid-template-columns: repeat(auto-fit, minmax(4.25rem, 1fr)); gap: 0.375rem; }
.sm-hero { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 0.5rem 0.25rem; }
.sm-heroimg { width: 3rem; height: 3rem; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 50% 35%, #fbf1d6, #c9a66b); box-shadow: inset 0 0 0 2px rgba(90, 60, 20, 0.5); }
.sm-hero.active .sm-heroimg { box-shadow: inset 0 0 0 2px var(--gold-300), 0 0 10px rgba(243, 200, 94, 0.5); }
.sm-heroimg .ico { width: 2.375rem; height: 2.375rem; }
.sm-heroimg .ico.portrait { width: calc(100% - 4px); height: calc(100% - 4px); border-radius: 50%; }
.sm-hint { color: var(--ink-muted); font-size: var(--fs-sm); }
.sm-seed { display: flex; gap: 0.375rem; }
.sm-seed input { flex: 1; }
.sm-roll { display: inline-flex; align-items: center; gap: 0.375rem; }
.sm-start { min-height: 3.25rem; font-size: var(--fs-lg); margin-top: 0.25rem; }
.sm-credits { margin: 0; text-align: center; color: rgba(255, 243, 218, 0.75); font-size: var(--fs-xs); text-shadow: 0 1px 2px #000; }
.sm-links { display: flex; justify-content: center; flex-wrap: wrap; gap: 0.25rem 1.25rem; margin-bottom: -0.5rem; }
.sm-links a { color: var(--gold-200); font-size: var(--fs-sm); text-shadow: 0 1px 2px #000; text-underline-offset: 0.2em; padding: 0.375rem 0.25rem; }
.sm-links a:hover { color: var(--gold-100); }
@media (max-width: 760px) {
  .sm-cols { grid-template-columns: 1fr; }
  .sm-wrap { justify-content: flex-start; gap: 1rem; }
}
@media (max-height: 480px) and (orientation: landscape) {
  .sm-brand { flex-direction: row; justify-content: center; gap: 0.75rem; }
  .sm-brand p { display: none; }
  .sm-brand h1 { font-size: 2.25rem; }
  .sm-crown { width: 2.25rem !important; height: 2.25rem !important; }
  .sm-cols { grid-template-columns: 1fr 1.2fr; }
  .sm-wrap { justify-content: flex-start; gap: 0.625rem; }
  .sm-mode { min-height: 3.75rem; padding: 0.5rem 0.75rem; }
}
</style>
