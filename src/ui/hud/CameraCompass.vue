<template>
  <!-- Small compass at the minimap: the needle follows the camera, a click opens the camera buttons -->
  <div class="compass" :class="{ open }" data-testid="compass">
    <button
      v-tip="{ title: $t('compass.title'), text: $t('compass.hint') }"
      class="cmp-btn"
      :aria-label="$t('compass.title')"
      :aria-expanded="open"
      data-testid="compass-toggle"
      @click="open = !open"
    ><i class="cmp-n" :style="{ transform: `rotate(${yaw}rad)` }">N</i></button>
    <div v-if="open" class="cmp-pop frame" role="group" :aria-label="$t('compass.title')" data-testid="compass-panel">
      <button v-for="b in holds" :key="b.k" class="cmp-act" :aria-label="$t('compass.' + b.id)" :data-testid="'compass-' + b.id"
        @pointerdown.prevent="holdStart(b, $event)" @pointerup="holdEnd(b)" @pointercancel="holdEnd(b)" @pointerleave="holdEnd(b)" @contextmenu.prevent
        @keydown.enter.prevent="step(b)" @keydown.space.prevent="step(b)">
        <span class="cmp-glyph" aria-hidden="true">{{ b.glyph }}</span><span class="cmp-lbl">{{ $t('compass.' + b.id) }}</span>
      </button>
      <button class="cmp-act" :aria-label="$t('compass.north')" data-testid="compass-north" @click="north"><span class="cmp-glyph" aria-hidden="true">N</span><span class="cmp-lbl">{{ $t('compass.north') }}</span></button>
      <button class="cmp-act" :aria-label="$t('compass.home')" data-testid="compass-home" @click="home"><span class="cmp-glyph" aria-hidden="true">⌂</span><span class="cmp-lbl">{{ $t('compass.home') }}</span></button>
    </div>
  </div>
</template>

<script>
/** One tap = one step; holding longer than HOLD_MS repeats like the keys (rig.keys). */
const HOLD_MS = 280;
const HOLDS = [
  { id: 'left', k: 'q', glyph: '⟲', step: (r) => r.rotate(0.2, 0) },
  { id: 'right', k: 'e', glyph: '⟳', step: (r) => r.rotate(-0.2, 0) },
  { id: 'tiltUp', k: 'r', glyph: '▲', step: (r) => r.rotate(0, 0.12) },
  { id: 'tiltDown', k: 'f', glyph: '▼', step: (r) => r.rotate(0, -0.12) },
  { id: 'zoomIn', k: '+', glyph: '+', step: (r) => r.zoom(0.85) },
  { id: 'zoomOut', k: '-', glyph: '−', step: (r) => r.zoom(1 / 0.85) },
];

export default {
  name: 'CameraCompass',
  props: { engine: { type: Object, required: true } },
  data() { return { open: false, yaw: 0, holds: HOLDS }; },
  mounted() {
    this.timer = setInterval(() => { const y = this.rig()?.yaw ?? 0; if (y !== this.yaw) this.yaw = y; }, 100);
    this.timers = new Map();
  },
  beforeUnmount() { clearInterval(this.timer); for (const b of HOLDS) this.holdEnd(b); },
  methods: {
    /** Always the current rig: a stage restart builds a new renderer. */
    rig() { return this.engine.renderer?.rig; },
    step(b) { const r = this.rig(); if (r) b.step(r); },
    holdStart(b, e) {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      this.step(b);
      clearTimeout(this.timers.get(b.k));
      this.timers.set(b.k, setTimeout(() => this.rig()?.keys.add(b.k), HOLD_MS));
    },
    holdEnd(b) {
      clearTimeout(this.timers?.get(b.k));
      this.rig()?.keys.delete(b.k);
    },
    /** Turn the view so that north is up. */
    north() { this.rig()?.rotate(-this.rig().yaw, 0); },
    home() { this.engine.focusHeadquarters(); },
  },
};
</script>

<style>
.compass { position: absolute; top: -0.9375rem; left: 50%; transform: translateX(-50%); z-index: 6; }
.cmp-btn {
  position: relative; display: grid; place-items: center; width: 1.875rem; height: 1.875rem; padding: 0; border-radius: 50%; cursor: pointer;
  background: var(--wood-900); box-shadow: 0 0 0 2px var(--wood-950), inset 0 0 0 1.5px var(--gold-400); color: var(--gold-200);
}
.cmp-btn:focus-visible { outline: 2px solid var(--gold-200); outline-offset: 2px; }
.cmp-n {
  position: relative; display: grid; place-items: start center; width: 1.5rem; height: 1.5rem; border-radius: 50%; font: 700 0.6875rem/1 var(--display); font-style: normal;
  padding-top: 0.0625rem; color: var(--wood-950);
  background: radial-gradient(circle at 50% 12%, var(--gold-300) 0 32%, transparent 33%), radial-gradient(circle, var(--wood-700) 0 70%, var(--gold-500) 71%);
}
.cmp-pop {
  position: absolute; bottom: calc(100% + 0.5rem); left: 50%; transform: translateX(-50%); display: grid; grid-template-columns: repeat(4, 3rem); gap: 0.25rem;
  padding: 0.375rem; z-index: 7; width: max-content;
}
.cmp-act {
  display: grid; justify-items: center; gap: 0.0625rem; min-width: 3rem; min-height: 2.75rem; padding: 0.125rem; border-radius: 0.5rem; cursor: pointer; touch-action: none;
  background: var(--inset-bg); color: var(--gold-200); box-shadow: inset 0 0 0 1px rgba(225, 168, 58, 0.35);
}
.cmp-act:active { background: var(--gold-600); color: var(--wood-950); }
.cmp-glyph { font: 600 1.125rem/1.2 var(--display); }
.cmp-lbl { font-size: 0.625rem; line-height: 1; color: var(--ink-muted); white-space: nowrap; }
.cmp-act:active .cmp-lbl { color: var(--wood-950); }
</style>
