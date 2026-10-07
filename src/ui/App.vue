<template>
  <StartMenu v-if="screen === 'menu'" :latest="latest" :recovered="recovered" @start="newGame" @load="loadDoc" @saves-changed="refreshLatest" @tutorial="startMission('tutorial')" @campaign="screen = 'campaign'" @adventures="screen = 'adventures'" @special="screen = 'special'" />
  <CampaignMenu v-else-if="screen === 'campaign'" :lang="$i18n.lang" @back="screen = 'menu'" @start="startMission" @tutorial="startMission('tutorial')" />
  <SpecialMapsMenu v-else-if="screen === 'special'" :lang="$i18n.lang" @back="screen = 'menu'" @start="startMission" />
  <AdventureMenu v-else-if="screen === 'adventures'" :lang="$i18n.lang" @back="screen = 'menu'" @start="startMission" @editor="openEditor()" @open="startScenario($event)" />
  <WorldEditor v-else-if="screen === 'editor'" :initial="editorScenario" :touch="touchDevice" @back="closeEditor" @play="startScenario($event, 'editor')" @change="editorScenario = $event" />

  <div v-else-if="screen === 'loading' || finishing" class="loading backdrop" data-testid="loading">
    <div class="ld-card frame">
      <Icon name="crown" class="ld-crown" />
      <strong class="ld-title">{{ $t('app.title') }}</strong>
      <span class="ld-sub">{{ $t('loading.title') }}</span>
      <div class="meter ld-bar"><i :style="{ width: progress + '%' }"></i></div>
      <span class="ld-state num">{{ progress < 100 ? $t('loading.models', { p: progress }) : $t('loading.world') }}</span>
      <p class="ld-tip parchment"><b>{{ $t('loading.tip') }}:</b> {{ $t('loading.tip' + tipNo) }}</p>
    </div>
  </div>

  <div v-if="screen === 'game' || screen === 'loading'" v-show="screen === 'game'" class="game" :class="{ compact, narrow, mid, 'show-labels': settings.labels, split: splitW > 0 }" :style="hudVars">
    <canvas ref="canvas" data-testid="game-canvas"></canvas>

    <template v-if="ui && engine">
      <TopBar ref="top" :ui="ui" :need="need" @speed="engine.setSpeed($event)" @pause="engine.togglePause()" @menu="openMenu" />

      <CommandBar
        :ui="ui"
        :engine="engine"
        :compact="compact"
        :narrow="narrow"
        :mid="mid"
        :hints="settings.hints"
        :code="showScriptPanel && scriptLayout === 'sheet' ? { open: scriptOpen, running: ui.mission.script.player?.status === 'running' } : null"
        @code="scriptOpen = !scriptOpen"
        @build="engine.startPlacement($event)"
        @buy-serf="engine.buySerf($event)"
        @confirm="engine.confirmPlacement()"
        @cancel="engine.cancelPlacement()"
        @deselect="engine.clearSelection()"
        @action="onAction"
        @quick="onQuick"
        @height="bottomH = $event"
        @preview="preview = $event"
        @hero="onHero"
        @group="engine.selectGroup($event)"
      />

      <ToastFeed :toasts="ui.toasts" @jump="jump" @dismiss="(t) => engine?.dismissToast(t.id)" />

      <!-- Modals under <body>: .game.split (contain: layout) would confine them to the game area -->
      <Teleport to="body">
        <div v-if="ui.gameOver && !watching" class="scrim endscreen" data-testid="game-over">
          <div class="end-card parchment" :class="ui.gameOver.won ? 'won' : 'lost'" role="dialog" aria-modal="true" :aria-label="ui.gameOver.won ? $t('end.victory') : $t('end.defeat')">
            <div class="end-banner">
              <Icon :name="ui.gameOver.won ? 'crown' : 'skull'" class="end-crest" />
              <h2 data-testid="game-over-title">{{ ui.gameOver.won ? $t('end.victory') : $t('end.defeat') }}</h2>
            </div>
            <p class="end-text">{{ ui.gameOver.won ? $t('end.victoryText') : $t('end.defeatText') }}</p>
            <p class="end-time num">{{ $t('end.time', { t: clock(ui.tick) }) }}</p>
            <div class="end-actions">
              <button class="primary" data-testid="game-over-menu" @click="quit">{{ $t('end.toMenu') }}</button>
              <button data-testid="game-over-watch" @click="watching = true">{{ $t('end.watch') }}</button>
            </div>
          </div>
        </div>
      </Teleport>

      <MissionHud v-if="ui.mission && !ui.mission.result" :mission="ui.mission" :touch="ui.touch" :lang="$i18n.lang" :speed="ui.speed" :compact="compact" @next="engine.missionNext()" @skip="engine.missionSkip()" @skip-dialog="engine.skipDialog()" @line="engine.dialogFocus($event)" @focus="engine.focusHint($event)" @tribute="engine.payTribute($event)" />
      <MissionResult
        v-if="ui.mission?.result"
        :result="ui.mission.result"
        :mission-id="ui.mission.id"
        :objectives="ui.mission.objectives"
        :record="record"
        :lang="$i18n.lang"
        :origin="origin ?? 'campaign'"
        @next="startMission"
        @retry="retry"
        @campaign="toCampaign"
        @menu="quit"
      />

      <DevPanel v-if="dev.on" :engine="engine" :touch="!!ui.touch" />

      <Teleport to="body">
        <div v-if="crash" class="scrim crash-scrim" data-testid="crash-dialog">
          <div class="crash-card parchment" role="alertdialog" aria-modal="true" :aria-label="$t('crash.title')">
            <h2><Icon name="warning" />{{ $t('crash.title') }}</h2>
            <p>{{ $t('crash.text') }}</p>
            <p v-if="latest" class="crash-latest" data-testid="crash-latest">{{ $t('crash.latest', { name: latest.name }) }}</p>
            <p v-else class="crash-latest">{{ $t('crash.noSave') }}</p>
            <p v-if="crashError" class="sm-error" role="alert" data-testid="crash-error">{{ crashError }}</p>
            <details class="crash-detail"><summary>{{ $t('crash.detail') }}</summary><code data-testid="crash-message">{{ crash.area }}: {{ crash.message }}</code></details>
            <div class="crash-actions">
              <button class="primary" data-testid="crash-load" :disabled="!latest || crashBusy" @click="crashLoad"><Icon name="load" />{{ $t('crash.load') }}</button>
              <button data-testid="crash-reload" @click="crashReload">{{ $t('crash.reload') }}</button>
              <button data-testid="crash-menu" @click="crashMenu">{{ $t('end.toMenu') }}</button>
            </div>
          </div>
        </div>
      </Teleport>

      <GameMenu v-if="menuOpen" :engine="engine" :touch="ui.touch" :share="share" :update="appUpdate.available" @close="closeMenu" @saved="onSaved" @load="loadDoc" @quit="quit" @update="installUpdate" />
    </template>
  </div>

  <!-- Code panel next to the game (split screen) or as a sheet over it (phone); see src/ui/script/splitLayout.js -->
  <ScriptPanel
    v-if="screen === 'game' && ui && engine && showScriptPanel"
    :key="'sp-' + scenarioOf.id"
    :engine="engine"
    :scenario="scenarioOf"
    :script="ui.mission.script"
    :mode="origin === 'editor' ? 'editor' : 'adventure'"
    v-model:open="scriptOpen"
    :layout="scriptLayout"
    :touch="!!ui.touch"
    @width="codeW = $event"
  />

  <Tooltip :touch="!!ui?.touch" />
</template>

<script>
import { markRaw, toRaw, defineAsyncComponent } from 'vue';
import { mergeUi } from './uiMerge.js';
import { Engine } from '../game/Engine.js';
import { loadAssets } from '../render/assets.js';
import { settleLazyLoads } from '../render/lazyLoads.js';
import TopBar from './TopBar.vue';
import CommandBar from './hud/CommandBar.vue';
import ToastFeed from './hud/ToastFeed.vue';
import StartMenu from './StartMenu.vue';
import GameMenu from './GameMenu.vue';
import Tooltip from './Tooltip.vue';
import CampaignMenu from './mission/CampaignMenu.vue';
import SpecialMapsMenu from './mission/SpecialMapsMenu.vue';
import MissionHud from './mission/MissionHud.vue';
import MissionResult from './mission/MissionResult.vue';
import AdventureMenu from './script/AdventureMenu.vue';
import { recordWin, loadProgress } from './mission/progress.js';
import { getMission, SPECIAL_MAPS } from '../sim/missions/registry.js';
import { setMenuMusic } from '../audio/index.js';
import { settings, applyPlayerColor } from './settings.js';
import { clock } from './plugin.js';
import { getStore, autosaveDue, autosaveStart, snapshotText, whenIdle, AUTO_ID, SaveError } from '../save/index.js';
import { defaultSaveName } from '../save/format.js';
import { makeThumb } from './saves/thumb.js';
import { t } from '../i18n/index.js';
import { devState, setDevMode, isDevHotkey } from '../dev/state.js';
import { missing } from './hud/hudLayout.js';
import { buildStartLink, parseStartLink, normalizeFree, addressFor, shareUrl } from './startLink.js';
import { siteUrl } from '../paths.js';
import { layoutMode } from './script/splitLayout.js';
import { update as appUpdate, setReloadPolicy, updateIfIdle, applyUpdate } from '../pwa.js';
/** Levels by window width (CSS px at UI size 100 %), as classes on .game:
 *  compact – phone/narrow: panel across the full width, map as a button;
 *  mid – smaller map and tiles; narrow – portrait without shield, key figures in the panel. */
const COMPACT = 760;
/** sessionStorage: page was reloaded from the error dialog */
const CRASH_FLAG = 'kronland-crash';
/** Screens on which a new version may reload the page by itself (nothing running, nothing unsaved) */
const IDLE_SCREENS = ['menu', 'campaign', 'adventures', 'special'];
const MID = 1100;
const NARROW = 1500;

export default {
  name: 'App',
  components: {
    TopBar, CommandBar, ToastFeed, StartMenu, GameMenu, Tooltip, CampaignMenu, SpecialMapsMenu, MissionHud, MissionResult, AdventureMenu,
    // Code panel and world editor: loaded only on demand
    ScriptPanel: defineAsyncComponent(() => import('./script/ScriptPanel.vue')),
    WorldEditor: defineAsyncComponent(() => import('./editor/WorldEditor.vue')),
    // Developer mode: loaded only when switched on
    DevPanel: defineAsyncComponent(() => import('./dev/DevPanel.vue')),
  },
  data() {
    return {
      screen: 'menu',
      /** Code panel opened on phone */
      scriptOpen: false,
      /** Engine deliberately lives outside reactivity (markRaw). */
      engine: null,
      ui: null,
      progress: 0,
      /** Game built, loading screen still up while cached on-demand models arrive (boot) */
      finishing: false,
      menuOpen: false,
      /** Latest save game (entry) for "Continue" */
      latest: null,
      /** New best time in the mission just won */
      record: false,
      settings,
      compact: false,
      mid: false,
      narrow: false,
      /** Cost of the building under the mouse pointer in the build menu (missing resources shown red on top) */
      preview: null,
      bottomH: 220,
      topH: 64,
      watching: false,
      tipNo: 1,
      dev: devState,
      /** Where the running game comes from: 'campaign' | 'adventures' | 'editor' | null */
      origin: null,
      /** Scenario in the world editor (kept during test play) */
      editorScenario: null,
      touchDevice: globalThis.matchMedia?.('(pointer: coarse)').matches ?? false,
      /** Game halted after a permanent error (Engine.crash): error dialog */
      crash: null,
      /** Error dialog: loading is in progress or has failed */
      crashBusy: false,
      crashError: '',
      /** The page was reloaded after an error or the game was left after an error (notice in the start menu) */
      recovered: false,
      /** Window size (CSS px) for the layout of the code panel */
      winW: window.innerWidth,
      winH: window.innerHeight,
      /** Width the code panel takes up on the right (split screen), reported by ScriptPanel */
      codeW: 0,
      /** Start of the running game ({ kind: 'free'|'mission', … }, src/ui/startLink.js) or null (save game, scenario file) */
      start: null,
      /** A newer version is online (src/pwa.js): notice in the game menu */
      appUpdate,
    };
  },
  computed: {
    /** Start link for the game menu: { url, name } or null */
    share() {
      const st = this.start;
      if (!st) return null;
      let base;
      try { base = new URL(siteUrl('play/'), location.href).href; } catch { base = location.href; }
      const url = shareUrl(base, buildStartLink(st));
      if (st.kind === 'free') return { url, name: String(st.seed), title: t('gmenu.mapSeed', { seed: st.seed }) };
      const def = getMission(st.id);
      const title = def?.title ? this.$tr(def.title) : st.id;
      return { url, name: st.seed ? `${title} · ${st.seed}` : title, title };
    },
    need() { return this.preview && this.ui ? missing(this.preview, this.ui.res) : null; },
    hudVars() {
      const v = { '--bottom-h': `${this.bottomH}px`, '--top-total': `${this.topH}px` };
      // Split screen: the game (canvas and HUD) only fills the area left of the code panel
      if (this.splitW) v.right = `${this.splitW}px`;
      return v;
    },
    /** Code panel: 'split' (next to the game) or 'sheet' (phone) */
    scriptLayout() { return layoutMode(this.winW, this.winH); },
    /** Width taken from the game by the code panel */
    splitW() { return this.showScriptPanel && this.scriptLayout === 'split' && this.screen === 'game' ? this.codeW : 0; },
    /** Scenario JSON of the running game (coding adventure, script mission, editor) or null */
    scenarioOf() { return this.ui?.mission?.script ? this.engine?.sim.mission?.def.scenario ?? null : null; },
    showScriptPanel() {
      const m = this.ui?.mission;
      return !!(m?.script && this.scenarioOf && !m.result && (m.kind === 'adventure' || this.origin === 'editor'));
    },
  },
  watch: {
    'dev.on'(on) { this.engine?.setDevMode(on); },
    // Panel width changed (dragging, collapsing): HUD levels for the new game area
    splitW() { this.$nextTick(() => this.layout?.()); },
    showScriptPanel() { this.$nextTick(() => this.layout?.()); },
    // Menu music on start and campaign screens (plays after the first click; in-game GameAudio takes over)
    screen: {
      immediate: true,
      handler(s) {
        if (['menu', 'campaign', 'adventures', 'special', 'editor'].includes(s)) setMenuMusic(true); else if (s === 'loading') setMenuMusic(false);
        // Back in the menus after a game: a pending update loads now
        if (IDLE_SCREENS.includes(s)) updateIfIdle();
      },
    },
    // New version while a game is running: notice once (the game menu offers "save and reload")
    'appUpdate.available'(on) { if (on && this.engine && this.screen === 'game') this.engine.toast('update.toast', null, { icon: 'info', ttl: 10_000, cat: 'system' }); },
    // Autosave every 2 game minutes, the first shortly after the start (setting "Save automatically")
    'ui.tick'(tick) {
      if (tick !== undefined && settings.autosave && autosaveDue(tick, this.lastAutoTick ?? tick)) this.autosave({ idle: true });
    },
    // Record mission end once (progress, best time)
    'ui.mission.result'(r) {
      if (!r || this.recorded) return;
      this.recorded = true;
      if (!r.won || this.engine?.sim.mission?.def.custom) return;
      const id = this.ui.mission.id;
      const before = loadProgress().done[id]?.best;
      const optional = this.ui.mission.objectives.filter((o) => !o.primary && o.status === 'done').length;
      recordWin(id, r.tick, optional);
      this.record = id !== 'tutorial' && before !== undefined && r.tick < before;
    },
  },
  mounted() {
    // Reload for a new version only where nothing is lost: menus, no editor draft, no error dialog
    setReloadPolicy(() => IDLE_SCREENS.includes(this.screen) && !this.editorScenario && !this.crash);
    this.layout = () => {
      this.winW = window.innerWidth;
      this.winH = window.innerHeight;
      // HUD levels by the width of the game area (split screen: left of the code panel)
      const w = (window.innerWidth - this.splitW) / settings.uiScale;
      // Code panel as a sheet (phones, portrait tablets): phone HUD with the code button
      this.compact = w < COMPACT || window.innerHeight < 560 || (this.showScriptPanel && this.scriptLayout === 'sheet');
      this.mid = w < MID;
      this.narrow = w < NARROW;
      const tb = document.querySelector('.topbar');
      if (tb) this.topH = Math.round(tb.getBoundingClientRect().bottom);
    };
    this.layout();
    window.addEventListener('resize', this.layout);
    this.layoutTimer = setInterval(this.layout, 1000);
    this.onKey = (e) => {
      // Developer mode: F3 or Ctrl+Shift+D
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (isDevHotkey(e) && !typing) { e.preventDefault(); setDevMode(!devState.on); return; }
      if (typing && e.key !== 'Escape') return;
      if (e.key !== 'Escape' || this.screen !== 'game' || !this.ui || this.menuOpen) return;
      if (!this.ui.selection && !this.ui.placing && !this.ui.mission?.result) this.openMenu();
    };
    window.addEventListener('keydown', this.onKey);
    // Save automatically when leaving the page (switching tab, closing the app)
    this.onHide = () => { if (document.visibilityState === 'hidden') this.autosave(); };
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onHide);
    this.refreshLatest();
    try { this.recovered = sessionStorage.getItem(CRASH_FLAG) === '1'; sessionStorage.removeItem(CRASH_FLAG); } catch { /* without sessionStorage no notice */ }
    // Direct start via address (start links, tests): ?seed=…&ai=easy|normal|hard&players=2&hero=…&fog=off
    // or ?mission=<id>[&seed=…]; invalid values → default (src/ui/startLink.js, docs/ARCHITEKTUR.md#url-parameter)
    const link = parseStartLink(location.search, { hasMission: (id) => !!getMission(id) });
    if (link?.kind === 'mission') this.startMission(link.id, { noAssets: link.noAssets, seed: link.seed });
    else if (link) this.newGame({ ...link, noAssets: link.noAssets });
  },
  beforeUnmount() {
    this.engine?.stop();
    window.removeEventListener('resize', this.layout);
    window.removeEventListener('keydown', this.onKey);
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('pagehide', this.onHide);
    clearInterval(this.layoutTimer);
  },
  methods: {
    /** New engine state: replace only what changed (otherwise Vue redraws everything every 200 ms). */
    applyUi(state) {
      if (!this.ui) this.ui = state;
      else mergeUi(this.ui, toRaw(this.ui), state);
    },
    clock,
    async boot(opts) {
      this.scriptOpen = false;
      this.engine?.stop();
      this.engine = null;
      this.ui = null;
      this.watching = false;
      this.finishing = false;
      this.screen = 'loading';
      this.progress = 0;
      this.tipNo = 1 + Math.floor(Math.random() * 6);
      const players = opts.load ? opts.load.players.length : opts.players;
      applyPlayerColor(); // set the player colour before the models are loaded (colour variants per player)
      if (!opts.noAssets) await loadAssets(players, (d, t) => { this.progress = Math.round((d / t) * 100); });
      this.progress = 100;
      await this.$nextTick();
      this.crash = null;
      this.crashError = '';
      this.recovered = false;
      this.engine = markRaw(new Engine(this.$refs.canvas, { ...opts, onUi: (state) => this.applyUi(state), onCrash: (c) => this.onCrash(c) }));
      this.lastAutoTick = autosaveStart(this.engine.sim.tick);
      const e = this.engine;
      e.start();
      if (devState.on) e.setDevMode(true);
      this.screen = 'game';
      this.$nextTick(this.layout);
      if (!opts.noAssets) {
        // Models the first frames request on demand (hero, workers, other buildings): if they are all cached
        // already, keep the loading screen up (game paused) until they are there – no placeholders at the start.
        // On a first visit nothing waits (src/render/lazyLoads.js).
        this.finishing = true;
        const paused = e.paused;
        e.paused = true;
        const t0 = performance.now();
        const result = await settleLazyLoads();
        // measurement for E2E and docs/PERFORMANCE.md
        e.startupWait = { result, ms: Math.round(performance.now() - t0) };
        if (this.engine !== e) return;
        e.paused = paused;
        this.finishing = false;
      }
      // For E2E tests and debugging
      window.__kronland = e;
    },
    newGame(opts) {
      // Bring values from the start menu or address to valid ones; exactly this is what the link starts
      const start = normalizeFree(opts);
      this.setStart(start);
      const { kind: _kind, ...free } = start;
      this.boot({ ...opts, ...free });
    },
    /**
     * Remember the start of the running game and set the address bar to the canonical start link
     * (history.replaceState: no new history entry). null: save game/scenario file – clear the query.
     * @param {object|null} start
     */
    setStart(start) {
      this.start = start;
      try { history.replaceState(null, '', addressFor(location.pathname, location.search, start ? buildStartLink(start) : null)); } catch { /* without History API no link in the address */ }
    },
    /** Start a mission, tutorial, coding adventure or script mission. */
    startMission(id, extra = {}) {
      const def = getMission(id);
      if (!def) return;
      this.recorded = false;
      this.record = false;
      // Special maps (showcase, stress test) have their own menu: return there
      this.origin = SPECIAL_MAPS.includes(def) ? 'special' : def.scenario ? 'adventures' : 'campaign';
      const players = def.players.filter((p) => p.kind !== 'bandits').length + (def.players.some((p) => p.kind === 'bandits') ? 1 : 0);
      // Fixed mission map: link only ?mission=<id>; a deviating seed comes along with it
      const seed = extra.seed !== undefined && extra.seed !== def.seed ? extra.seed : undefined;
      this.setStart({ kind: 'mission', id, ...(seed !== undefined ? { seed } : {}) });
      this.boot({ mission: { id, seed: extra.seed }, players, noAssets: extra.noAssets });
    },
    /** Play scenario JSON (file or world editor). */
    startScenario(json, origin = 'adventures') {
      this.recorded = false;
      this.record = false;
      this.origin = origin;
      // Scenario file / world editor: is in no directory, hence no start link
      this.setStart(null);
      const players = json.players.filter((p) => p.kind !== 'bandits').length + (json.players.some((p) => p.kind === 'bandits') ? 1 : 0);
      this.boot({ scenario: json, players });
    },
    /** Again: mission from the directory or the same scenario JSON. */
    retry() {
      const def = this.engine?.sim.mission?.def;
      if (def?.custom) this.startScenario(def.scenario, this.origin ?? 'adventures');
      else this.startMission(this.ui.mission.id, { seed: this.start?.kind === 'mission' ? this.start.seed : undefined });
    },
    openEditor(scenario = null) {
      if (scenario) this.editorScenario = scenario;
      this.screen = 'editor';
    },
    closeEditor() { this.screen = 'adventures'; },
    toCampaign() {
      const back = ['editor', 'adventures', 'special'].includes(this.origin) ? this.origin : 'campaign';
      this.quit();
      this.screen = back;
    },
    /** Determine the latest save game for "Continue". */
    async refreshLatest() {
      try { this.latest = await (await getStore({ legacyName: t('saves.legacyName') })).latest(); } catch { this.latest = null; }
    },
    /** Load a checked envelope (src/save/format.js). */
    loadDoc(doc) {
      this.menuOpen = false;
      this.recorded = false;
      this.record = false;
      // Save game: cannot be rebuilt from a seed – no start link
      this.setStart(null);
      this.boot({ load: doc.state });
    },
    onSaved(entry) {
      this.latest = entry;
      this.engine?.toast('saves.saved', { name: entry.name }, { icon: 'save', tone: 'good' });
      this.closeMenu();
    },
    /**
     * Write the autosave slot (silently; only errors are reported). The state is turned into text synchronously without a deep
     * copy (snapshotText), compression and storage run afterwards asynchronously. The store queues
     * the writes one after another (store.serial), so the most recent
     * state always wins – even if an autosave is still running when leaving.
     * @param {{ idle?: boolean, force?: boolean }} [opts] idle: only when the browser has air between two frames (regular autosave);
     *   force: also with the setting "Save automatically" switched off (before reloading for an update)
     */
    async autosave({ idle = false, force = false } = {}) {
      const e = this.engine;
      if (!e || (!settings.autosave && !force) || this.screen !== 'game') return;
      // Never save after a crash: the state may be broken, the last good save is kept
      if (e.crash) return;
      this.lastAutoTick = e.sim.tick;
      if (idle) {
        await whenIdle();
        if (this.engine !== e || e.crash || this.screen !== 'game') return;
      }
      // Do not save finished games any more
      const ui = this.ui;
      if (ui?.gameOver || ui?.mission?.result || e.sim.winner !== null) return;
      const sim = e.sim;
      // The same tick is already saved (pagehide often follows right after visibilitychange)
      if (this.autoSaved?.engine === e && this.autoSaved.tick === sim.tick) return this.autoSaved.promise;
      const meta = { tick: sim.tick, mode: sim.mission ? 'mission' : 'free', mission: sim.mission?.def?.id ?? null, seed: sim.seed };
      let snap, thumb;
      const t0 = performance.now();
      try {
        snap = snapshotText(e.save({ clone: false }), { name: defaultSaveName(meta, t) });
        thumb = makeThumb(e);
      } catch (err) { console.error(err); return; }
      // Measurement for developer mode and E2E (docs/PERFORMANCE.md): time on the main thread, size of the text
      const stats = { syncMs: performance.now() - t0, chars: snap.text.length, tick: meta.tick };
      e.autosaveStats = stats;
      const promise = (async () => {
        try {
          const entry = await (await getStore()).saveText(snap.text, snap.meta, { id: AUTO_ID, thumb });
          this.latest = entry;
          stats.totalMs = performance.now() - t0;
          if (this.engine === e && document.visibilityState !== 'hidden') e.toast('saves.autosaved', null, { icon: 'save', ttl: 2000 });
        } catch (err) {
          const code = err instanceof SaveError ? err.code : 'saves.err.unknown';
          if (!(err instanceof SaveError)) console.error(err);
          if (this.engine === e) e.toast(code, err?.params ?? null, { icon: 'warning', tone: 'bad', ttl: 6000, cat: 'system' });
          // Next attempt allowed at the next occasion
          if (this.autoSaved?.promise === promise) this.autoSaved = null;
        }
      })();
      this.autoSaved = { engine: e, tick: sim.tick, promise };
      return promise;
    },
    /** Engine reports a permanent error: game stops, dialog with load/reload. */
    onCrash(c) {
      this.crash = c;
      this.menuOpen = false;
      this.refreshLatest();
    },
    /** Error dialog: load the latest save game (usually the autosave). */
    async crashLoad() {
      if (!this.latest) return;
      this.crashBusy = true;
      this.crashError = '';
      try {
        const doc = await (await getStore()).load(this.latest.id);
        this.loadDoc(doc);
      } catch (e) {
        this.crashError = t(e instanceof SaveError ? e.code : 'saves.err.unknown', e?.params ?? {});
      } finally { this.crashBusy = false; }
    },
    /** Error dialog: reload the page; the start menu then points to "Continue". */
    crashReload() {
      try { sessionStorage.setItem(CRASH_FLAG, '1'); } catch { /* notice is missing then */ }
      location.href = location.pathname;
    },
    /** Game menu "Save and reload": autosave slot first, then the new version; "Continue" in the start menu resumes. */
    async installUpdate() {
      try { await this.autosave({ force: true }); } catch { /* reload anyway: the user asked for it */ }
      applyUpdate();
    },
    crashMenu() {
      this.quit();
      this.recovered = true;
    },
    openMenu() { this.menuOpen = true; this.wasPaused = this.engine.paused; this.engine.paused = true; this.engine.emitUi(); },
    closeMenu() { this.menuOpen = false; if (this.engine) { this.engine.paused = !!this.wasPaused; this.engine.emitUi(); } },
    quit() {
      this.menuOpen = false;
      this.finishing = false;
      // Save automatically on leaving (before halting: the state is copied synchronously)
      if (this.engine) Promise.resolve(this.autosave()).finally(() => this.refreshLatest());
      this.engine?.stop();
      this.engine = null;
      this.ui = null;
      // Test play from the world editor: back to the editor
      this.screen = this.origin === 'editor' ? 'editor' : 'menu';
      this.origin = null;
      this.start = null;
      if (location.search) history.replaceState(null, '', location.pathname);
    },
    // Permanent notices (attack, fire, hero) stay after the jump; only the × hides them
    jump(t) { this.engine?.jumpTo(t.pos.x, t.pos.y, true); if (!t.sticky) this.engine?.dismissToast(t.id); },
    onQuick(k) {
      const e = this.engine;
      if (k === 'hq') e.focusHeadquarters();
      else if (k === 'idle') e.selectIdleSerfs();
      else if (k === 'all') e.selectAllSerfs();
      else if (k === 'army') e.selectAllArmy();
    },
    /** Hero portrait: first click selects, click on the already selected hero jumps there. */
    onHero(id) { this.engine?.selectHero(id); },
    onAction(a) {
      const e = this.engine;
      if (a.kind === 'tax') e.setTax(a.level);
      else if (a.kind === 'research') e.research(a.id, a.tech);
      else if (a.kind === 'bless') e.bless(a.id, a.blessing);
      else if (a.kind === 'upgrade') e.upgrade(a.id);
      else if (a.kind === 'overtime') e.setOvertime(a.id, a.on);
      else if (a.kind === 'demolish') e.demolish(a.id);
      else if (a.kind === 'order') e.armyOrder(a.order);
      else if (a.kind === 'refill') e.refillSoldiers();
      else if (a.kind === 'ability') e.ability(a.hero, a.ability);
      else if (a.kind === 'special') e.special(a.action);
      else if (a.kind === 'recruit') e.recruit(a.id, a.line, a.full);
      else if (a.kind === 'upgradeLine') e.upgradeLine(a.line);
      else if (a.kind === 'militia') e.militia(a.on);
      else if (a.kind === 'arm') e.armSelected(a.on);
      else if (a.kind === 'researchBuilding') e.researchBuilding(a.id, a.tech);
      else if (a.kind === 'trade') e.trade(a.id, a.give, a.take, a.amount);
      else if (a.kind === 'changeWeather') e.changeWeather(a.id, a.state);
      else if (a.kind === 'repair') e.repair(a.id);
      else if (a.kind === 'group') e.assignGroup(a.n);
      // Extensions (BUILDING_SECTIONS): arbitrary command to the simulation
      else if (a.kind === 'command' && a.cmd?.type) e.issue(a.cmd);
    },
  },
};
</script>

<style>
.loading { display: grid; place-items: center; z-index: 40; }
.ld-card { width: min(26rem, 100%); padding: 1.5rem 1.5rem 1.25rem; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; text-align: center; }
.ld-crown { width: 2.75rem !important; height: 2.75rem !important; }
.ld-title { font-family: var(--display); color: var(--gold-200); font-size: 2.25rem; line-height: 1; letter-spacing: 0.05em; text-shadow: 0 2px 0 var(--gold-800); }
.ld-sub { color: var(--ink-muted); }
.ld-bar { width: 100%; height: 0.625rem; margin-top: 0.5rem; }
.ld-state { font-size: var(--fs-sm); color: var(--ink-muted); }
.ld-tip { margin: 0.75rem 0 0; padding: 0.625rem 0.875rem; font-size: var(--fs-sm); line-height: 1.45; text-align: left; }

.endscreen { z-index: 28; }
.end-card { width: min(30rem, 100%); overflow: hidden; display: flex; flex-direction: column; gap: 0.625rem; padding-bottom: 1.25rem; text-align: center; }
.end-banner { padding: 1.25rem 1.25rem 1rem; display: flex; flex-direction: column; align-items: center; gap: 0.25rem; color: #f6ead0; }
.won .end-banner { background: linear-gradient(180deg, #7a2f1f, #5e2416); box-shadow: inset 0 -3px 0 var(--gold-500); }
.lost .end-banner { background: linear-gradient(180deg, #3e4448, #2b3033); box-shadow: inset 0 -3px 0 #6b7378; }
.end-crest { width: 3rem !important; height: 3rem !important; }
.end-banner h2 { margin: 0; font-family: var(--display); font-size: 2.25rem; letter-spacing: 0.04em; }
.end-text { margin: 0 1.5rem; font-size: var(--fs-lg); font-weight: 700; }
.end-time { margin: 0; color: var(--parch-ink-muted); }
.end-actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; margin: 0.375rem 1.5rem 0; }
.end-actions button { min-height: var(--touch); padding-inline: 1.25rem; }
.end-actions button:not(.primary) { color: var(--parch-ink); background: rgba(255, 255, 255, 0.3); border-color: rgba(58, 42, 23, 0.35); box-shadow: none; }

/* Error dialog (game halted after a permanent error) */
.crash-scrim { z-index: 60; }
.crash-card { width: min(32rem, 100%); padding: 1.25rem 1.25rem 1rem; display: flex; flex-direction: column; gap: 0.625rem; }
.crash-card h2 { margin: 0; display: flex; align-items: center; gap: 0.5rem; font-family: var(--display); font-size: clamp(1.25rem, 5vw, 1.75rem); line-height: 1.15; }
.crash-card p { margin: 0; line-height: 1.45; }
.crash-latest { font-weight: 700; }
.crash-detail { font-size: var(--fs-sm); color: var(--parch-ink-muted); }
.crash-detail code { display: block; margin-top: 0.25rem; white-space: pre-wrap; word-break: break-word; }
.crash-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.25rem; }
.crash-actions button { min-height: var(--touch); padding-inline: 1rem; flex: 1 1 auto; }
.crash-actions button:not(.primary) { color: var(--parch-ink); background: rgba(255, 255, 255, 0.3); border-color: rgba(58, 42, 23, 0.35); box-shadow: none; }
</style>
