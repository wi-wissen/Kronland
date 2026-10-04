<template>
  <StartMenu v-if="screen === 'menu'" :has-save="hasSave" @start="newGame" @continue="continueGame" @tutorial="startMission('tutorial')" @campaign="screen = 'campaign'" />
  <CampaignMenu v-else-if="screen === 'campaign'" :lang="$i18n.lang" @back="screen = 'menu'" @start="startMission" @tutorial="startMission('tutorial')" />

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

  <div v-if="screen === 'game' || screen === 'loading'" v-show="screen === 'game'" class="game" :class="{ compact }" :style="hudVars">
    <canvas ref="canvas" data-testid="game-canvas"></canvas>

    <template v-if="ui && engine">
      <TopBar ref="top" :ui="ui" @speed="engine.setSpeed($event)" @pause="engine.togglePause()" @menu="openMenu" />

      <CommandBar
        :ui="ui"
        :engine="engine"
        :compact="compact"
        :hints="settings.hints"
        @build="engine.startPlacement($event)"
        @buy-serf="engine.buySerf($event)"
        @confirm="engine.confirmPlacement()"
        @cancel="engine.cancelPlacement()"
        @deselect="engine.clearSelection()"
        @action="onAction"
        @quick="onQuick"
        @height="bottomH = $event"
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

      <MissionHud v-if="ui.mission && !ui.mission.result" :mission="ui.mission" :touch="ui.touch" :lang="$i18n.lang" @next="engine.missionNext()" @skip="engine.missionSkip()" />
      <MissionResult
        v-if="ui.mission?.result"
        :result="ui.mission.result"
        :mission-id="ui.mission.id"
        :objectives="ui.mission.objectives"
        :record="record"
        :lang="$i18n.lang"
        @next="startMission"
        @retry="startMission(ui.mission.id)"
        @campaign="toCampaign"
        @menu="quit"
      />

      <GameMenu v-if="menuOpen" :has-save="hasSave" :touch="ui.touch" @close="closeMenu" @save="save" @load="loadSaved" @quit="quit" />
    </template>
  </div>

  <Tooltip :touch="!!ui?.touch" />
</template>

<script>
import { markRaw } from 'vue';
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
import { recordWin, loadProgress } from './mission/progress.js';
import { getMission } from '../sim/missions/registry.js';
import { setMenuMusic } from '../audio/index.js';
import { settings } from './settings.js';
import { clock } from './plugin.js';

const SAVE_KEY = 'kronland-save-1';
const storage = {
  get() { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } },
  set(v) { try { localStorage.setItem(SAVE_KEY, v); return true; } catch { return false; } },
};
/** From this width (CSS px) the command bar gets minimap and selection card side by side. */
const WIDE = 900;

export default {
  name: 'App',
  components: { TopBar, CommandBar, ToastFeed, StartMenu, GameMenu, Tooltip, CampaignMenu, MissionHud, MissionResult },
  data() {
    return {
      screen: 'menu',
      /** Engine deliberately lives outside reactivity (markRaw). */
      engine: null,
      ui: null,
      progress: 0,
      menuOpen: false,
      hasSave: !!storage.get(),
      /** New best time in the mission just won */
      record: false,
      settings,
      compact: false,
      bottomH: 220,
      topH: 64,
      watching: false,
      tipNo: 1,
    };
  },
  computed: {
    hudVars() { return { '--bottom-h': `${this.bottomH}px`, '--top-total': `${this.topH}px` }; },
  },
  watch: {
    // Menu music on start and campaign screens (plays after the first click; in-game GameAudio takes over)
    screen: { immediate: true, handler(s) { if (s === 'menu' || s === 'campaign') setMenuMusic(true); else if (s === 'loading') setMenuMusic(false); } },
    // Record mission end once (progress, best time)
    'ui.mission.result'(r) {
      if (!r || this.recorded) return;
      this.recorded = true;
      if (!r.won) return;
      const id = this.ui.mission.id;
      const before = loadProgress().done[id]?.best;
      const optional = this.ui.mission.objectives.filter((o) => !o.primary && o.status === 'done').length;
      recordWin(id, r.tick, optional);
      this.record = id !== 'tutorial' && before !== undefined && r.tick < before;
    },
  },
  mounted() {
    this.layout = () => {
      this.compact = window.innerWidth < WIDE * settings.uiScale || window.innerHeight < 560;
      const tb = document.querySelector('.topbar');
      if (tb) this.topH = Math.round(tb.getBoundingClientRect().bottom);
    };
    this.layout();
    window.addEventListener('resize', this.layout);
    this.layoutTimer = setInterval(this.layout, 1000);
    this.onKey = (e) => {
      if (e.key !== 'Escape' || this.screen !== 'game' || !this.ui || this.menuOpen) return;
      if (!this.ui.selection && !this.ui.placing && !this.ui.mission?.result) this.openMenu();
    };
    window.addEventListener('keydown', this.onKey);
    // Direct start via address (for tests and links): ?seed=…&ai=easy|normal|hard&players=2
    const q = new URLSearchParams(location.search);
    if (q.has('mission') && getMission(q.get('mission'))) {
      this.startMission(q.get('mission'), { noAssets: q.has('no-models'), seed: Number(q.get('seed')) || undefined });
    } else if (q.has('seed')) {
      this.newGame({
        seed: Number(q.get('seed')) || 1,
        difficulty: { easy: 'easy', normal: 'normal', hard: 'hard' }[q.get('ai')] ?? 'normal',
        players: Math.min(4, Math.max(2, Number(q.get('players')) || 2)),
        hero: q.get('hero') ?? 'bertram',
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
    clearInterval(this.layoutTimer);
  },
  methods: {
    clock,
    async boot(opts) {
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
      this.engine = markRaw(new Engine(this.$refs.canvas, { ...opts, onUi: (state) => { this.ui = state; } }));
      this.engine.start();
      this.screen = 'game';
      this.$nextTick(this.layout);
      // For E2E tests and debugging
      window.__kronland = this.engine;
    },
    newGame(opts) { this.boot(opts); },
    /** Start a mission or tutorial. */
    startMission(id, extra = {}) {
      const def = getMission(id);
      if (!def) return;
      this.recorded = false;
      this.record = false;
      const players = def.players.filter((p) => p.kind !== 'bandits').length + (def.players.some((p) => p.kind === 'bandits') ? 1 : 0);
      this.boot({ mission: { id, seed: extra.seed }, players, noAssets: extra.noAssets });
    },
    toCampaign() { this.quit(); this.screen = 'campaign'; },
    continueGame() { this.loadSaved(); },
    loadSaved() {
      const raw = storage.get();
      if (!raw) return;
      this.menuOpen = false;
      try { this.boot({ load: JSON.parse(raw) }); } catch { this.engine?.toast('toast.loadFailed', null, { icon: 'warning', tone: 'bad' }); }
    },
    save() {
      const ok = storage.set(JSON.stringify(this.engine.save()));
      this.hasSave = ok || this.hasSave;
      this.engine.toast(ok ? 'toast.saved' : 'toast.saveFailed', null, { icon: 'save', tone: ok ? 'good' : 'bad' });
      this.closeMenu();
    },
    openMenu() { this.menuOpen = true; this.wasPaused = this.engine.paused; this.engine.paused = true; this.engine.emitUi(); },
    closeMenu() { this.menuOpen = false; if (this.engine) { this.engine.paused = !!this.wasPaused; this.engine.emitUi(); } },
    quit() {
      this.menuOpen = false;
      this.engine?.stop();
      this.engine = null;
      this.ui = null;
      this.screen = 'menu';
      if (location.search) history.replaceState(null, '', location.pathname);
    },
    jump(t) { this.engine?.jumpTo(t.pos.x, t.pos.y, true); this.engine?.dismissToast(t.id); },
    onQuick(k) {
      const e = this.engine;
      if (k === 'hq') e.focusHeadquarters();
      else if (k === 'idle') e.selectIdleSerfs();
      else if (k === 'all') e.selectAllSerfs();
    },
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
      else if (a.kind === 'recruit') e.recruit(a.id, a.line, a.full);
      else if (a.kind === 'upgradeLine') e.upgradeLine(a.line);
      else if (a.kind === 'militia') e.militia(a.on);
      else if (a.kind === 'researchBuilding') e.researchBuilding(a.id, a.tech);
      else if (a.kind === 'trade') e.trade(a.id, a.give, a.take, a.amount);
      else if (a.kind === 'changeWeather') e.changeWeather(a.id, a.state);
      else if (a.kind === 'repair') e.repair(a.id);
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
