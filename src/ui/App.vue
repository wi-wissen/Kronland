<template>
  <StartMenu v-if="screen === 'menu'" :latest="latest" @start="newGame" @load="loadDoc" @saves-changed="refreshLatest" @tutorial="startMission('tutorial')" @campaign="screen = 'campaign'" @adventures="screen = 'adventures'" />
  <CampaignMenu v-else-if="screen === 'campaign'" :lang="$i18n.lang" @back="screen = 'menu'" @start="startMission" @tutorial="startMission('tutorial')" />
  <AdventureMenu v-else-if="screen === 'adventures'" :lang="$i18n.lang" @back="screen = 'menu'" @start="startMission" @editor="openEditor()" @open="startScenario($event)" />
  <WorldEditor v-else-if="screen === 'editor'" :initial="editorScenario" :touch="touchDevice" @back="closeEditor" @play="startScenario($event, 'editor')" @change="editorScenario = $event" />

  <div v-else-if="screen === 'loading'" class="loading backdrop" data-testid="loading">
    <div class="ld-card frame">
      <Icon name="crown" class="ld-crown" />
      <strong class="ld-title">{{ $t('app.title') }}</strong>
      <span class="ld-sub">{{ $t('loading.title') }}</span>
      <div class="meter ld-bar"><i :style="{ width: progress + '%' }"></i></div>
      <span class="ld-state num">{{ progress < 100 ? $t('loading.models', { p: progress }) : $t('loading.world') }}</span>
      <p class="ld-tip parchment"><b>{{ $t('loading.tip') }}:</b> {{ $t('loading.tip' + tipNo) }}</p>
    </div>
  </div>

  <div v-if="screen === 'game' || screen === 'loading'" v-show="screen === 'game'" class="game" :class="{ compact, narrow, mid, 'show-labels': settings.labels }" :style="hudVars">
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
        :code="showScriptPanel ? { open: scriptOpen, running: ui.mission.script.player?.status === 'running' } : null"
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

      <ToastFeed :toasts="ui.toasts" @jump="jump" />

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

      <MissionHud v-if="ui.mission && !ui.mission.result" :mission="ui.mission" :touch="ui.touch" :lang="$i18n.lang" :speed="ui.speed" @next="engine.missionNext()" @skip="engine.missionSkip()" @skip-dialog="engine.skipDialog()" @tribute="engine.payTribute($event)" />
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

      <ScriptPanel
        v-if="showScriptPanel"
        :key="'sp-' + scenarioOf.id"
        :engine="engine"
        :scenario="scenarioOf"
        :script="ui.mission.script"
        :mode="origin === 'editor' ? 'editor' : 'adventure'"
        v-model:open="scriptOpen"
        :compact="compact"
        :touch="!!ui.touch"
      />

      <DevPanel v-if="dev.on" :engine="engine" :touch="!!ui.touch" />

      <GameMenu v-if="menuOpen" :engine="engine" :touch="ui.touch" @close="closeMenu" @saved="onSaved" @load="loadDoc" @quit="quit" />
    </template>
  </div>

  <Tooltip :touch="!!ui?.touch" />
</template>

<script>
import { markRaw, toRaw, defineAsyncComponent } from 'vue';
import { mergeUi } from './uiMerge.js';
import { Engine } from '../game/Engine.js';
import { loadAssets } from '../render/assets.js';
import TopBar from './TopBar.vue';
import CommandBar from './hud/CommandBar.vue';
import ToastFeed from './hud/ToastFeed.vue';
import StartMenu from './StartMenu.vue';
import GameMenu from './GameMenu.vue';
import Tooltip from './Tooltip.vue';
import CampaignMenu from './mission/CampaignMenu.vue';
import MissionHud from './mission/MissionHud.vue';
import MissionResult from './mission/MissionResult.vue';
import AdventureMenu from './script/AdventureMenu.vue';
import { recordWin, loadProgress } from './mission/progress.js';
import { getMission } from '../sim/missions/registry.js';
import { setMenuMusic } from '../audio/index.js';
import { settings } from './settings.js';
import { clock } from './plugin.js';
import { getStore, autosaveDue, AUTO_ID, SaveError } from '../save/index.js';
import { defaultSaveName } from '../save/format.js';
import { makeThumb } from './saves/thumb.js';
import { t } from '../i18n/index.js';
import { devState, setDevMode, isDevHotkey } from '../dev/state.js';
import { missing } from './hud/hudLayout.js';
/** Levels by window width (CSS px at UI size 100 %), as classes on .game:
 *  compact – phone/narrow: panel across the full width, map as a button;
 *  mid – smaller map and tiles; narrow – portrait without shield, key figures in the panel. */
const COMPACT = 760;
const MID = 1100;
const NARROW = 1500;

export default {
  name: 'App',
  components: {
    TopBar, CommandBar, ToastFeed, StartMenu, GameMenu, Tooltip, CampaignMenu, MissionHud, MissionResult, AdventureMenu,
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
    };
  },
  computed: {
    need() { return this.preview && this.ui ? missing(this.preview, this.ui.res) : null; },
    hudVars() { return { '--bottom-h': `${this.bottomH}px`, '--top-total': `${this.topH}px` }; },
    /** Scenario JSON of the running game (coding adventure, script mission, editor) or null */
    scenarioOf() { return this.ui?.mission?.script ? this.engine?.sim.mission?.def.scenario ?? null : null; },
    showScriptPanel() {
      const m = this.ui?.mission;
      return !!(m?.script && this.scenarioOf && !m.result && (m.kind === 'adventure' || this.origin === 'editor'));
    },
  },
  watch: {
    'dev.on'(on) { this.engine?.setDevMode(on); },
    // Menu music on start and campaign screens (plays after the first click; in-game GameAudio takes over)
    screen: { immediate: true, handler(s) { if (s === 'menu' || s === 'campaign' || s === 'adventures' || s === 'editor') setMenuMusic(true); else if (s === 'loading') setMenuMusic(false); } },
    // Autosave every 5 game minutes (setting "Save automatically")
    'ui.tick'(tick) {
      if (tick !== undefined && settings.autosave && autosaveDue(tick, this.lastAutoTick ?? tick)) this.autosave();
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
    this.layout = () => {
      const w = window.innerWidth / settings.uiScale;
      this.compact = w < COMPACT || window.innerHeight < 560;
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
    // Direct start via address (for tests and links): ?seed=…&ai=easy|normal|hard&players=2
    const q = new URLSearchParams(location.search);
    if (q.has('mission') && getMission(q.get('mission'))) {
      this.startMission(q.get('mission'), { noAssets: q.has('no-models'), seed: Number(q.get('seed')) || undefined });
    } else if (q.has('seed')) {
      this.newGame({
        seed: Number(q.get('seed')) || 1,
        difficulty: { easy: 'easy', normal: 'normal', hard: 'hard' }[q.get('ai')] ?? 'normal',
        players: Math.min(4, Math.max(2, Number(q.get('players')) || 2)),
        hero: q.get('hero') ?? 'nelia',
        // Fog of war: ?fog=off turns it off
        fog: !['off', '0'].includes(q.get('fog') ?? ''),
        noAssets: q.has('no-models'),
      });
    }
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
      this.screen = 'loading';
      this.progress = 0;
      this.tipNo = 1 + Math.floor(Math.random() * 6);
      const players = opts.load ? opts.load.players.length : opts.players;
      if (!opts.noAssets) await loadAssets(players, (d, t) => { this.progress = Math.round((d / t) * 100); });
      this.progress = 100;
      await this.$nextTick();
      this.engine = markRaw(new Engine(this.$refs.canvas, { ...opts, onUi: (state) => this.applyUi(state) }));
      this.lastAutoTick = this.engine.sim.tick;
      this.engine.start();
      if (devState.on) this.engine.setDevMode(true);
      this.screen = 'game';
      this.$nextTick(this.layout);
      // For E2E tests and debugging
      window.__kronland = this.engine;
    },
    newGame(opts) { this.boot(opts); },
    /** Start a mission, tutorial, coding adventure or script mission. */
    startMission(id, extra = {}) {
      const def = getMission(id);
      if (!def) return;
      this.recorded = false;
      this.record = false;
      this.origin = def.scenario ? 'adventures' : 'campaign';
      const players = def.players.filter((p) => p.kind !== 'bandits').length + (def.players.some((p) => p.kind === 'bandits') ? 1 : 0);
      this.boot({ mission: { id, seed: extra.seed }, players, noAssets: extra.noAssets });
    },
    /** Play scenario JSON (file or world editor). */
    startScenario(json, origin = 'adventures') {
      this.recorded = false;
      this.record = false;
      this.origin = origin;
      const players = json.players.filter((p) => p.kind !== 'bandits').length + (json.players.some((p) => p.kind === 'bandits') ? 1 : 0);
      this.boot({ scenario: json, players });
    },
    /** Again: mission from the directory or the same scenario JSON. */
    retry() {
      const def = this.engine?.sim.mission?.def;
      if (def?.custom) this.startScenario(def.scenario, this.origin ?? 'adventures');
      else this.startMission(this.ui.mission.id);
    },
    openEditor(scenario = null) {
      if (scenario) this.editorScenario = scenario;
      this.screen = 'editor';
    },
    closeEditor() { this.screen = 'adventures'; },
    toCampaign() {
      const back = this.origin === 'editor' ? 'editor' : this.origin === 'adventures' ? 'adventures' : 'campaign';
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
      this.boot({ load: doc.state });
    },
    onSaved(entry) {
      this.latest = entry;
      this.engine?.toast('saves.saved', { name: entry.name }, { icon: 'save', tone: 'good' });
      this.closeMenu();
    },
    /**
     * Write the autosave slot (silently; only errors are reported). State and preview image are
     * copied synchronously; the store queues the writes one after another (store.serial), so
     * the latest state always wins - even if an autosave is still running on leaving.
     */
    async autosave() {
      const e = this.engine, ui = this.ui;
      if (!e || !settings.autosave || this.screen !== 'game') return;
      // Do not save finished games any more
      if (ui?.gameOver || ui?.mission?.result || e.sim.winner !== null) return;
      const sim = e.sim;
      this.lastAutoTick = sim.tick;
      // The same tick is already saved (pagehide often follows right after visibilitychange)
      if (this.autoSaved?.engine === e && this.autoSaved.tick === sim.tick) return this.autoSaved.promise;
      const meta = { tick: sim.tick, mode: sim.mission ? 'mission' : 'free', mission: sim.mission?.def?.id ?? null, seed: sim.seed };
      let state, thumb;
      try { state = e.save(); thumb = makeThumb(e); } catch (err) { console.error(err); return; }
      const promise = (async () => {
        try {
          const entry = await (await getStore()).save(state, { id: AUTO_ID, name: defaultSaveName(meta, t), thumb });
          this.latest = entry;
          if (this.engine === e && document.visibilityState !== 'hidden') e.toast('saves.autosaved', null, { icon: 'save', ttl: 2000 });
        } catch (err) {
          const code = err instanceof SaveError ? err.code : 'saves.err.unknown';
          if (!(err instanceof SaveError)) console.error(err);
          if (this.engine === e) e.toast(code, err?.params ?? null, { icon: 'warning', tone: 'bad', ttl: 6000 });
          // Next attempt allowed at the next occasion
          if (this.autoSaved?.promise === promise) this.autoSaved = null;
        }
      })();
      this.autoSaved = { engine: e, tick: sim.tick, promise };
      return promise;
    },
    openMenu() { this.menuOpen = true; this.wasPaused = this.engine.paused; this.engine.paused = true; this.engine.emitUi(); },
    closeMenu() { this.menuOpen = false; if (this.engine) { this.engine.paused = !!this.wasPaused; this.engine.emitUi(); } },
    quit() {
      this.menuOpen = false;
      // Save automatically on leaving (before halting: the state is copied synchronously)
      if (this.engine) Promise.resolve(this.autosave()).finally(() => this.refreshLatest());
      this.engine?.stop();
      this.engine = null;
      this.ui = null;
      // Test play from the world editor: back to the editor
      this.screen = this.origin === 'editor' ? 'editor' : 'menu';
      this.origin = null;
      if (location.search) history.replaceState(null, '', location.pathname);
    },
    jump(t) { this.engine?.jumpTo(t.pos.x, t.pos.y, true); this.engine?.dismissToast(t.id); },
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
</style>
