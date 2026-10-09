<template>
  <div class="start backdrop" data-testid="start-menu">
    <div class="sm-wrap">
      <!-- Quiet corners: language top left; settings and account top right (only "Sign in" is a real button) -->
      <div class="sm-corner sm-corner-l">
        <div class="sm-lang" role="radiogroup" :aria-label="$t('menu.language')">
          <template v-for="(l, i) in ['de', 'en']" :key="l">
            <span v-if="i" class="sm-dot" aria-hidden="true">·</span>
            <button class="ghost sm-langbtn" role="radio" :aria-checked="$i18n.lang === l" :class="{ active: $i18n.lang === l }" :lang="l" :data-testid="'menu-lang-' + l" @click="setLang(l)">{{ l.toUpperCase() }}</button>
          </template>
        </div>
      </div>
      <div class="sm-corner">
        <button class="ghost icon-btn" data-testid="menu-settings" :aria-label="$t('menu.settings')" v-tip="$t('menu.settings')" @click="settingsOpen = true"><Icon name="settings" /></button>
        <!-- Account: only where a server is configured (public/kronland.config.json) -->
        <div v-if="net.server" class="sm-account" data-testid="account">
          <template v-if="net.signedIn && net.user">
            <button class="ghost sm-who" data-testid="account-button" :aria-expanded="accOpen" :aria-label="$t('home.accountMenu', { name: net.user.displayName })" @click="accOpen = !accOpen">
              <span class="sm-avatar" aria-hidden="true">{{ initial }}</span><span class="sm-name">{{ net.user.displayName }}</span>
            </button>
            <div v-if="accOpen" class="sm-pop frame" role="menu" @keydown.esc="accOpen = false">
              <a role="menuitem" :href="net.user.accountUrl" target="_blank" rel="noopener noreferrer" data-testid="account-manage">{{ $t('acct.manage') }}</a>
              <button role="menuitem" class="ghost" data-testid="sign-out" @click="signOut">{{ $t('acct.signOut') }}</button>
            </div>
          </template>
          <button v-else class="primary sm-signin" data-testid="sign-in" @click="signIn">{{ $t('acct.signIn') }}</button>
        </div>
      </div>
      <p v-if="net.error" class="sm-error sm-corner-err" role="alert" data-testid="auth-error"><Icon name="warning" />{{ authError }}</p>

      <header class="sm-brand">
        <Icon name="crown" class="sm-crown" />
        <h1>{{ $t('app.title') }}</h1>
        <p>{{ $t('app.tagline') }}</p>
      </header>

      <p v-if="recovered" class="sm-recovered parchment" role="status" data-testid="recovered-hint"><Icon name="warning" />{{ latest ? $t('crash.recovered') : $t('crash.recoveredNoSave') }}</p>
      <p v-if="error" class="sm-error" role="alert" data-testid="continue-error"><Icon name="warning" />{{ error }}</p>
      <p v-if="notice" class="sm-error" role="alert" data-testid="link-error"><Icon name="warning" />{{ notice }}</p>

      <!-- The one next step: the latest save game -->
      <section v-if="latest" class="sm-hero frame" :aria-label="$t('home.continue')" data-testid="continue-card">
        <div class="sm-hero-art inset" aria-hidden="true">
          <img v-if="latest.thumb" :src="latest.thumb" alt="" draggable="false">
          <Icon v-else :name="kindIcon(heroInfo.kind)" />
        </div>
        <div class="sm-hero-body">
          <span class="sm-eyebrow">{{ $t('home.continue') }}</span>
          <h2 class="sm-hero-title" data-testid="continue-name">{{ heroInfo.title }}</h2>
          <p v-if="heroInfo.subtitle" class="sm-hero-sub">{{ heroInfo.subtitle }}</p>
          <p class="sm-hero-meta num">{{ $t(latest.auto ? 'home.autoSavedAgo' : 'home.savedAgo', { when: whenText(latest.savedAt) }) }} · {{ $t('sv.time', { t: playTime(latest.tick) }) }}</p>
          <div class="sm-hero-acts">
            <button class="primary sm-continue" data-testid="continue" :disabled="busy" @click="continueLatest">{{ $t('home.continueBtn') }}</button>
            <button class="ghost sm-allsaves" data-testid="menu-saves" @click="savesOpen = true">{{ $t('home.allSaves', { n: saves.length }) }}</button>
          </div>
        </div>
      </section>

      <!-- Without a save game the list is still reachable (a file from another device can be added there) -->
      <button v-else class="ghost sm-saves-link" data-testid="menu-saves" @click="savesOpen = true"><Icon name="load" />{{ $t('sv.title') }}</button>


      <section class="sm-library frame" :aria-label="$t('home.library')">
        <header class="sm-tilehead">
          <div><h2 class="h-title">{{ $t('home.library') }}</h2><p class="sm-sub">{{ $t('home.librarySub') }}</p></div>
          <button class="ghost sm-all" data-testid="menu-library" @click="$emit('library', 'all')">{{ $t('home.libraryAll') }}<Icon name="next" /></button>
        </header>
        <div class="sm-kinds">
          <button v-for="k in kinds" :key="k.id" class="sm-kind" :data-testid="'menu-kind-' + k.id" @click="$emit('library', k.id)">
            <span class="sm-seal"><Icon :name="k.icon" /></span>
            <span class="sm-kind-text">
              <b>{{ $t('lib.kind.' + k.id) }}</b>
              <small>{{ k.line }}</small>
            </span>
            <span v-if="k.fresh" class="sm-new">{{ $t('lib.new') }}</span>
          </button>
        </div>
      </section>

      <div class="sm-pair">
        <button class="sm-tile frame" data-testid="menu-free" @click="$emit('free')">
          <span class="sm-seal"><Icon name="map" /></span>
          <span class="sm-kind-text"><b>{{ $t('home.free') }}</b><small>{{ $t('home.freeSub') }}</small><em v-if="newMap" class="sm-newmap">{{ $t('home.newMap', { name: newMap }) }}</em></span>
        </button>
        <button class="sm-tile frame" data-testid="menu-workshop" @click="$emit('workshop')">
          <span class="sm-seal"><Icon name="edit" /></span>
          <span class="sm-kind-text"><b>{{ $t('home.workshop') }}</b><small>{{ $t('home.workshopSub') }}</small></span>
        </button>
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

    <!-- Modal dialogs live under <body>: inside .backdrop they would be laid out as content below the menu -->
    <Teleport to="body">
      <div v-if="savesOpen" class="scrim" @click.self="savesOpen = false">
        <div class="dialog frame sm-saves" role="dialog" aria-modal="true" :aria-label="$t('sv.title')" data-testid="saves-dialog">
          <SaveBrowser ref="saves" mode="load" header :touch="touch" @load="$emit('load', $event)" @changed="$emit('saves-changed')" @close="savesOpen = false" />
        </div>
      </div>

      <div v-if="settingsOpen" class="scrim" @click.self="settingsOpen = false">
        <div class="dialog frame" role="dialog" aria-modal="true" :aria-label="$t('set.title')" data-testid="settings-dialog">
          <header class="dialog-head">
            <h2 class="h-title">{{ $t('set.title') }}</h2>
            <button class="icon-btn ghost" :aria-label="$t('common.close')" @click="settingsOpen = false"><Icon name="close" /></button>
          </header>
          <div class="dialog-body scroll-y"><SettingsPanel @close="settingsOpen = false" /></div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import SettingsPanel from './SettingsPanel.vue';
import SaveBrowser from './saves/SaveBrowser.vue';
import { set } from './settings.js';
import { getStore, SaveError } from '../save/index.js';
import { defaultSaveName, playTime } from '../save/format.js';
import { siteRoot } from '../paths.js';
import { net, seen, library } from '../net/state.js';
import { todayString, isNewEntry } from '../net/seen.js';
import { errorMessage } from '../net/errors.js';
import { has, t, tr } from '../i18n/index.js';
import { loadProgress, isUnlocked } from './mission/progress.js';
import { builtinSeries, packSeries, describeSave, KINDS, nextLevel } from '../library/model.js';
import { loadDone } from '../net/progress.js';
import { whenText } from './when.js';

const ICONS = { first: 'scroll', stories: 'banner', code: 'mode-adventure', free: 'mode-special', level: 'banner' };

export default {
  name: 'StartMenu',
  components: { SettingsPanel, SaveBrowser },
  props: {
    /** Latest save game (entry from src/save/store.js) for "Continue" */
    latest: { type: Object, default: null },
    /** All save games (entries), newest first */
    saves: { type: Array, default: () => [] },
    /** Page reloaded after a game error or game left after an error: notice about "Continue" */
    recovered: { type: Boolean, default: false },
    /** Why a link (?save=, ?source=) could not be handled */
    notice: { type: String, default: '' },
    /** Name of a recently added map for the free play tile (or empty) */
    newMap: { type: String, default: '' },
  },
  emits: ['load', 'saves-changed', 'library', 'free', 'workshop'],
  data() {
    return {
      settingsOpen: false, savesOpen: false, accOpen: false, net, busy: false, error: '',
      touch: globalThis.matchMedia?.('(pointer: coarse)').matches ?? false,
      progress: loadProgress(),
      // Website: home page, manual, compendium, scripting reference (relative to the root, see src/paths.js)
      links: { home: siteRoot(), manual: `${siteRoot()}manual/`, compendium: `${siteRoot()}compendium/`, scripting: `${siteRoot()}scripting/`, blog: `${siteRoot()}blog/` },
    };
  },
  computed: {
    authError() { return net.error ? errorMessage(net.error, t, has) : ''; },
    initial() { return (net.user?.displayName ?? '?').trim().slice(0, 1).toUpperCase() || '?'; },
    running() { return new Set(this.saves.filter((e) => e.mission).map((e) => e.mission)); },
    builtin() { return builtinSeries({ progress: this.progress, running: this.running, t, unlocked: isUnlocked }); },
    heroInfo() {
      return describeSave(this.latest, this.builtin, { t: (k, p) => this.$t(k, p), tr: (x) => this.$tr(x), defaultName: (e) => defaultSaveName(e, (k, p) => this.$t(k, p)) });
    },
    packs() { return packSeries(library.packs, loadDone()); },
    /** The three kinds of the library with a short status line each */
    kinds() {
      const today = todayString();
      return KINDS.map((id) => {
        const own = this.builtin.filter((s) => s.kind === id);
        const all = [...own, ...this.packs.filter((s) => s.kind === id)];
        const levels = own.flatMap((s) => s.levels);
        const next = nextLevel(levels.filter((l) => l.state !== 'done')) ;
        const allDone = all.length > 0 && all.every((s) => s.status === 'done');
        const started = levels.some((l) => l.state === 'running' || l.state === 'done');
        let line = this.$t('lib.kindSub.' + id);
        if (allDone) line = this.$t('lib.tile.done');
        else if (next && started) line = this.$t('lib.tile.next', { title: this.$tr(next.title) });
        return { id, icon: ICONS[id], line, done: allDone, fresh: this.packs.some((s) => s.kind === id && isNewEntry(s, seen, today)) };
      });
    },
  },
  mounted() {
    this.onKey = (e) => {
      if (e.key !== 'Escape' || document.querySelector('[data-testid="confirm-dialog"]')) return;
      if (this.accOpen) { this.accOpen = false; return; }
      if (this.savesOpen && !this.$refs.saves?.escape()) this.savesOpen = false;
    };
    window.addEventListener('keydown', this.onKey);
  },
  beforeUnmount() { window.removeEventListener('keydown', this.onKey); },
  methods: {
    playTime,
    kindIcon: (k) => ICONS[k] ?? 'banner',
    whenText(iso) { return whenText(iso, (k, p) => this.$t(k, p), this.$i18n.lang); },
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
    async signIn() { try { await (await import('../net/index.js')).login(location.search.replace(/^\?/, '')); } catch (e) { net.error = { code: e.code ?? 'net.err.unknown', params: e.params ?? {} }; } },
    async signOut() { this.accOpen = false; await (await import('../net/index.js')).logout(); },
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
.sm-wrap { max-width: 60rem; margin: 0 auto; min-height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 1rem; padding-top: calc(var(--touch) + 1rem); }

/* Corner: quiet text and symbols without frames */
.sm-corner { position: absolute; top: max(0.5rem, var(--safe-t)); right: max(0.75rem, var(--safe-r)); z-index: 3; display: flex; justify-content: flex-end; align-items: center; gap: 0.25rem; }
.sm-corner-l { right: auto; left: max(0.75rem, var(--safe-l)); }
.sm-corner > button, .sm-langbtn { color: #fff3da; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85); }
.sm-lang { display: flex; align-items: center; }
.sm-langbtn { min-width: var(--touch); padding-inline: 0.5rem; font-weight: 600; }
.sm-langbtn.active { color: var(--gold-200); background: transparent; box-shadow: none; text-decoration: underline; text-underline-offset: 0.3em; text-decoration-thickness: 2px; }
.sm-dot { color: rgba(255, 243, 218, 0.6); }
.sm-account { position: relative; display: flex; align-items: center; }
.sm-signin { padding-inline: 1.25rem; font-size: var(--fs-md); }
.sm-who { gap: 0.5rem; padding-inline: 0.5rem; color: #fff3da; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85); }
.sm-avatar { width: 1.75rem; height: 1.75rem; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 40% 30%, var(--gold-200), var(--gold-500)); color: #2a1a06; font-weight: 800; box-shadow: 0 0 0 1px var(--wood-950); }
.sm-name { font-size: var(--fs-sm); max-width: 9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sm-pop { position: absolute; top: calc(100% + 0.25rem); right: 0; z-index: 5; min-width: 12rem; padding: 0.375rem; display: flex; flex-direction: column; gap: 0.125rem; }
.sm-pop a, .sm-pop button { min-height: var(--touch); display: flex; align-items: center; padding: 0 0.75rem; border-radius: var(--r-md); color: var(--ink); text-decoration: none; justify-content: flex-start; }
.sm-pop a:hover, .sm-pop button:hover { background: rgba(255, 225, 170, 0.1); }
.sm-corner-err { margin-top: 2.5rem; align-self: flex-end; }

.sm-brand { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.125rem; }
.sm-crown { width: 3.25rem !important; height: 3.25rem !important; filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.5)); }
.sm-brand h1 {
  margin: 0; font-family: var(--display); font-size: clamp(2.75rem, 8vw, 4.5rem); line-height: 1; letter-spacing: 0.06em;
  color: var(--gold-200); text-shadow: 0 2px 0 var(--gold-800), 0 4px 14px rgba(0, 0, 0, 0.6);
}
.sm-brand p { margin: 0.375rem 0 0; color: #fff3da; font-size: var(--fs-lg); text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8); }
.sm-recovered { margin: 0; display: flex; gap: 0.5rem; align-items: flex-start; padding: 0.5rem 0.75rem; font-size: var(--fs-sm); line-height: 1.4; }
.sm-error { margin: 0; display: flex; gap: 0.5rem; padding: 0.5rem 0.75rem; border-radius: var(--r-md); background: rgba(80, 18, 14, 0.85); color: #ffd9d2; font-size: var(--fs-sm); }
.sm-saves { width: min(42rem, 100%); }

/* Hero: continue */
.sm-hero { display: grid; grid-template-columns: 9rem minmax(0, 1fr); gap: 1rem; padding: 0.875rem; align-items: stretch; }
.sm-hero-art { display: grid; place-items: center; overflow: hidden; min-height: 6.5rem; }
.sm-hero-art img { width: 100%; height: 100%; object-fit: cover; }
.sm-hero-art .ico { width: 3rem; height: 3rem; color: var(--ink-dim); }
.sm-hero-body { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; justify-content: center; }
.sm-eyebrow { color: var(--ink-muted); font-size: var(--fs-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em; }
.sm-hero-title { margin: 0; font-family: var(--display); font-size: var(--fs-2xl); line-height: 1.1; color: var(--gold-200); overflow-wrap: anywhere; }
.sm-hero-sub { margin: 0; font-size: var(--fs-lg); }
.sm-hero-meta { margin: 0; color: var(--ink-muted); font-size: var(--fs-sm); }
.sm-hero-acts { display: flex; align-items: center; gap: 0.5rem 1rem; flex-wrap: wrap; margin-top: 0.625rem; }
.sm-continue { min-height: 3.25rem; padding-inline: 2rem; font-size: var(--fs-xl); font-family: var(--display); }
.sm-allsaves { font-size: var(--fs-sm); }
button.sm-saves-link { align-self: center; color: #fff3da; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85); background: rgba(20, 12, 8, 0.6); border-radius: 999px; padding-inline: 1rem; }

/* Library tile and the kinds */
.sm-library { padding: 0.875rem 1rem 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
.sm-tilehead { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; }
.sm-tilehead .h-title { font-size: var(--fs-xl); }
.sm-sub { margin: 0.125rem 0 0; color: var(--ink-muted); font-size: var(--fs-sm); }
.sm-all { color: var(--gold-200); flex: none; }
.sm-kinds { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.625rem; }
.sm-kind, .sm-tile {
  position: relative; display: flex; align-items: center; gap: 0.75rem; text-align: left; padding: 0.75rem 0.875rem; min-height: 5rem;
  justify-content: flex-start;
}
.sm-kind { background: var(--inset-bg); box-shadow: var(--inset-edge); border-color: transparent; border-radius: var(--r-lg); }
.sm-tile { border-color: transparent; border-radius: var(--r-lg); }
.sm-kind:hover:not(:disabled), .sm-tile:hover:not(:disabled) { filter: brightness(1.12); }
.sm-kind-text { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; }
.sm-kind-text b { font-family: var(--display); color: var(--gold-200); font-size: var(--fs-xl); line-height: 1.1; font-weight: 700; }
.sm-kind-text small { color: var(--ink-muted); font-size: var(--fs-sm); line-height: 1.3; }
.sm-newmap { font-style: normal; color: var(--gold-300); font-size: var(--fs-sm); font-weight: 700; }
.sm-seal { flex: none; width: 3.25rem; height: 3.25rem; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 40% 30%, #fbf1d6, #c9a66b); box-shadow: inset 0 0 0 2px var(--gold-500), 0 0 0 2px var(--wood-950), 0 3px 6px rgba(0, 0, 0, 0.5); }
.sm-seal .ico { width: 2.125rem; height: 2.125rem; }
.sm-new { position: absolute; top: 0.375rem; right: 0.5rem; padding: 0 0.5rem; border-radius: 999px; background: var(--bad); color: #2a0b05; font-size: var(--fs-xs); font-weight: 800; line-height: 1.4rem; }
.sm-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.625rem; }
.sm-credits { margin: 0; text-align: center; color: rgba(255, 243, 218, 0.75); font-size: var(--fs-xs); text-shadow: 0 1px 2px #000; }
.sm-links { display: flex; justify-content: center; flex-wrap: wrap; gap: 0.25rem 1.25rem; }
.sm-links a { color: var(--gold-200); font-size: var(--fs-sm); text-shadow: 0 1px 2px #000; text-underline-offset: 0.2em; padding: 0.375rem 0.25rem; }
.sm-links a:hover { color: var(--gold-100); }
@media (max-width: 760px) {
  .sm-wrap { justify-content: flex-start; gap: 0.75rem; }
  .sm-kinds, .sm-pair { grid-template-columns: 1fr; }
  .sm-hero { grid-template-columns: 1fr; }
  .sm-hero-art { min-height: 0; height: 5.5rem; }
  .sm-hero-title { font-size: var(--fs-xl); }
  .sm-continue { flex: 1 1 100%; }
  .sm-allsaves { flex: 1 1 100%; }
  .sm-name { max-width: 6rem; }
}
@media (max-height: 480px) and (orientation: landscape) {
  .sm-brand { flex-direction: row; justify-content: center; gap: 0.75rem; }
  .sm-brand p { display: none; }
  .sm-brand h1 { font-size: 2.25rem; }
  .sm-crown { width: 2.25rem !important; height: 2.25rem !important; }
  .sm-wrap { justify-content: flex-start; gap: 0.5rem; }
  .sm-kinds { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .sm-pair { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sm-kind, .sm-tile { min-height: 3.75rem; padding: 0.5rem 0.75rem; }
  .sm-hero { grid-template-columns: 7rem minmax(0, 1fr); }
  .sm-hero-art { height: auto; }
}
</style>
