<template>
  <div class="game">
    <canvas ref="canvas" data-testid="game-canvas"></canvas>

    <TopBar v-if="ui" :ui="ui" @speed="engine.setSpeed($event)" @pause="engine.togglePause()" />

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
        <button class="primary" @click="restart">Neues Spiel</button>
      </div>
    </div>

    <div class="toasts" aria-live="polite">
      <div v-for="t in ui?.toasts ?? []" :key="t.id" class="toast panel">{{ t.text }}</div>
    </div>
  </div>
</template>

<script>
import { markRaw } from 'vue';
import { Engine } from '../game/Engine.js';
import TopBar from './TopBar.vue';
import ContextPanel from './ContextPanel.vue';

export default {
  name: 'App',
  components: { TopBar, ContextPanel },
  data() {
    return {
      /** Engine deliberately lives outside reactivity (markRaw). */
      engine: null,
      ui: null,
    };
  },
  mounted() {
    const q = new URLSearchParams(location.search);
    const seed = Number(q.get('seed')) || 1;
    const difficulty = { easy: 'easy', normal: 'normal', hard: 'hard' }[q.get('ai')] ?? 'normal';
    this.engine = markRaw(new Engine(this.$refs.canvas, {
      seed,
      difficulty,
      players: Math.min(4, Math.max(2, Number(q.get('players')) || 2)),
      hero: q.get('hero') ?? 'bertram',
      onUi: (state) => { this.ui = state; },
    }));
    this.engine.start();
    // For E2E tests and debugging
    window.__kronland = this.engine;
  },
  methods: {
    restart() { location.search = '?seed=' + Math.floor(Math.random() * 100000); },
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
  beforeUnmount() {
    this.engine?.stop();
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
.gameover { position: fixed; inset: 0; display: grid; place-items: center; background: rgba(10, 14, 12, 0.55); z-index: 20; padding: 16px; }
.gameover .card { padding: 24px 28px; text-align: center; max-width: 360px; }
.gameover h2 { font-family: var(--display); color: var(--accent); font-size: 32px; margin: 0 0 8px; }
.gameover p { color: var(--muted); margin: 0 0 16px; }
@media (max-width: 640px) {
  .quick { top: calc(92px + env(safe-area-inset-top, 0px)); right: 8px; }
  .quick button { min-width: 72px; padding: 6px 8px; font-size: 14px; }
  .toasts { top: calc(96px + env(safe-area-inset-top, 0px)); }
}
</style>
