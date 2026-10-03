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
    />

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
    const seed = Number(new URLSearchParams(location.search).get('seed')) || 1;
    this.engine = markRaw(new Engine(this.$refs.canvas, {
      seed,
      onUi: (state) => { this.ui = state; },
    }));
    this.engine.start();
    // For E2E tests and debugging
    window.__kronland = this.engine;
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
@media (max-width: 640px) {
  .quick { top: calc(92px + env(safe-area-inset-top, 0px)); right: 8px; }
  .quick button { min-width: 72px; padding: 6px 8px; font-size: 14px; }
  .toasts { top: calc(96px + env(safe-area-inset-top, 0px)); }
}
</style>
