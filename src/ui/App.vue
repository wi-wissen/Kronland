<template>
  <StartMenu v-if="screen === 'menu'" :has-save="hasSave" @start="newGame" @continue="continueGame" />

  <div v-else-if="screen === 'loading'" class="loading">
    <div class="panel lcard">
      <strong>Kronland</strong>
      <span>Lade Modelle … {{ progress }} %</span>
      <div class="bar"><i :style="{ width: progress + '%' }"></i></div>
    </div>
  </div>

  <div v-if="screen === 'game' || screen === 'loading'" v-show="screen === 'game'" class="game">
    <canvas ref="canvas" data-testid="game-canvas"></canvas>

    <TopBar v-if="ui" :ui="ui" @speed="engine.setSpeed($event)" @pause="engine.togglePause()" @menu="openMenu" />

    <div v-if="ui" class="quick">
      <button title="Zur Burg" @click="engine.focusHeadquarters()">Burg</button>
      <button title="Untätige Leibeigene auswählen (Taste .)" @click="engine.selectIdleSerfs()">Untätige</button>
      <button title="Alle Leibeigenen auswählen" @click="engine.selectAllSerfs()">Alle</button>
    </div>

    <ContextPanel
      v-if="ui"
      :ui="ui"
      @build="engine.startPlacement($event)"
      @buy-serf="engine.buySerf($event)"
      @confirm="engine.confirmPlacement()"
      @cancel="engine.cancelPlacement()"
      @deselect="engine.clearSelection()"
      @action="onAction"
    />

    <div v-if="ui?.gameOver" class="gameover">
      <div class="panel card">
        <h2>{{ ui.gameOver.won ? 'Sieg!' : 'Niederlage' }}</h2>
        <p>{{ ui.gameOver.won ? 'Alle gegnerischen Burgen sind gefallen.' : 'Eure Burg ist gefallen.' }}</p>
        <button class="primary" @click="quit">Zum Hauptmenü</button>
      </div>
    </div>

    <GameMenu v-if="menuOpen" :has-save="hasSave" :touch="ui?.touch" @close="closeMenu" @save="save" @load="loadSaved" @quit="quit" />

    <div class="toasts" aria-live="polite">
      <div v-for="t in ui?.toasts ?? []" :key="t.id" class="toast panel">{{ t.text }}</div>
    </div>
  </div>
</template>

<script>
import { markRaw } from 'vue';
import { Engine } from '../game/Engine.js';
import { loadAssets } from '../render/assets.js';
import TopBar from './TopBar.vue';
import ContextPanel from './ContextPanel.vue';
import StartMenu from './StartMenu.vue';
import GameMenu from './GameMenu.vue';

const SAVE_KEY = 'kronland-save-1';
const storage = {
  get() { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } },
  set(v) { try { localStorage.setItem(SAVE_KEY, v); return true; } catch { return false; } },
};

export default {
  name: 'App',
  components: { TopBar, ContextPanel, StartMenu, GameMenu },
  data() {
    return {
      screen: 'menu',
      /** Engine deliberately lives outside reactivity (markRaw). */
      engine: null,
      ui: null,
      progress: 0,
      menuOpen: false,
      hasSave: !!storage.get(),
    };
  },
  mounted() {
    // Direct start via address (for tests and links): ?seed=…&ai=easy|normal|hard&players=2
    const q = new URLSearchParams(location.search);
    if (q.has('seed')) {
      this.newGame({
        seed: Number(q.get('seed')) || 1,
        difficulty: { easy: 'easy', normal: 'normal', hard: 'hard' }[q.get('ai')] ?? 'normal',
        players: Math.min(4, Math.max(2, Number(q.get('players')) || 2)),
        hero: q.get('hero') ?? 'bertram',
        noAssets: q.has('no-models'),
      });
    }
  },
  beforeUnmount() {
    this.engine?.stop();
  },
  methods: {
    async boot(opts) {
      this.engine?.stop();
      this.engine = null;
      this.ui = null;
      this.screen = 'loading';
      this.progress = 0;
      const players = opts.load ? opts.load.players.length : opts.players;
      if (!opts.noAssets) await loadAssets(players, (d, t) => { this.progress = Math.round((d / t) * 100); });
      await this.$nextTick();
      this.engine = markRaw(new Engine(this.$refs.canvas, { ...opts, onUi: (state) => { this.ui = state; } }));
      this.engine.start();
      this.screen = 'game';
      // For E2E tests and debugging
      window.__kronland = this.engine;
    },
    newGame(opts) { this.boot(opts); },
    continueGame() { this.loadSaved(); },
    loadSaved() {
      const raw = storage.get();
      if (!raw) return;
      this.menuOpen = false;
      try { this.boot({ load: JSON.parse(raw) }); } catch { this.engine?.toast('Spielstand konnte nicht geladen werden'); }
    },
    save() {
      const ok = storage.set(JSON.stringify(this.engine.save()));
      this.hasSave = ok || this.hasSave;
      this.engine.toast(ok ? 'Spiel gespeichert' : 'Speichern nicht möglich (Browserspeicher gesperrt oder voll)');
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
    },
  },
};
</script>

<style>
.quick {
  position: fixed;
  right: 12px;
  top: calc(64px + env(safe-area-inset-top, 0px));
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 3;
}
.quick button { background: var(--panel); min-width: 84px; }
.toasts {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  top: calc(70px + env(safe-area-inset-top, 0px));
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  pointer-events: none;
  z-index: 6;
  max-width: calc(100% - 32px);
}
.toast { padding: 7px 14px; font-size: 14px; }
.loading { position: fixed; inset: 0; display: grid; place-items: center; background: linear-gradient(160deg, #22302a, #141a17 70%); padding: 16px; z-index: 40; }
.lcard { padding: 18px 22px; display: flex; flex-direction: column; gap: 8px; width: min(320px, 100%); }
.lcard strong { font-family: var(--display); color: var(--accent); font-size: 24px; }
.lcard .bar { height: 6px; border-radius: 3px; background: rgba(241, 234, 216, 0.1); overflow: hidden; }
.lcard .bar i { display: block; height: 100%; background: var(--accent); transition: width 0.2s; }
.gameover { position: fixed; inset: 0; display: grid; place-items: center; background: rgba(10, 14, 12, 0.55); z-index: 20; padding: 16px; }
.gameover .card { padding: 24px 28px; text-align: center; max-width: 360px; }
.gameover h2 { font-family: var(--display); color: var(--accent); font-size: 32px; margin: 0 0 8px; }
.gameover p { color: var(--muted); margin: 0 0 16px; }
@media (max-width: 640px) {
  .quick { top: calc(120px + env(safe-area-inset-top, 0px)); right: 8px; }
  .quick button { min-width: 72px; padding: 6px 8px; font-size: 14px; }
  .toasts { top: calc(124px + env(safe-area-inset-top, 0px)); }
}
</style>
