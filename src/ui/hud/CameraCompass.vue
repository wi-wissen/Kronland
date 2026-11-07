<template>
  <!-- Desktop (rim): the needle on the minimap frame opens and closes round brass knobs set into the frame.
       Phone (badge): the N badge opens a small panel with the same actions. -->
  <div v-if="variant === 'rim'" class="compass rim" :class="{ open: showKnobs }" data-testid="compass">
    <button
      v-tip="{ title: $t('compass.title'), text: $t('compass.hintRim') }"
      class="cmp-btn cmp-rimbtn"
      :aria-label="$t('compass.title')"
      :aria-expanded="showKnobs"
      data-testid="compass-toggle"
      @click="toggleKnobs"
    ><svg class="cmp-needle" viewBox="0 0 32 32" aria-hidden="true" :style="{ transform: `rotate(${yaw}rad)` }">
      <path d="M16 3.5l4.2 12.5h-8.4z" fill="#e2533f" /><path d="M16 28.5l-4.2-12.5h8.4z" fill="#f3e3c0" /><circle cx="16" cy="16" r="1.7" fill="#22170f" />
    </svg></button>
    <template v-for="b in holds" :key="b.k">
      <button v-tip="{ title: $t('compass.' + b.id), text: $t('compass.tip.' + b.tip) }" class="cmp-knob" :class="'k-' + b.id" :aria-label="$t('compass.' + b.id)" :data-testid="'compass-' + b.id" :tabindex="showKnobs ? 0 : -1"
        @pointerdown.prevent="holdStart(b, $event)" @pointerup="holdEnd(b)" @pointercancel="holdEnd(b)" @pointerleave="holdEnd(b)" @contextmenu.prevent
        @keydown.enter.prevent="step(b)" @keydown.space.prevent="step(b)"><span aria-hidden="true">{{ b.glyph }}</span></button>
    </template>
    <button v-tip="{ title: $t('compass.north'), text: $t('compass.tip.north') }" class="cmp-knob k-north" :aria-label="$t('compass.north')" data-testid="compass-north" :tabindex="showKnobs ? 0 : -1" @click="north"><span aria-hidden="true">N</span></button>
    <button v-tip="{ title: $t('compass.home'), text: $t('compass.tip.home') }" class="cmp-knob k-home" :aria-label="$t('compass.home')" data-testid="compass-home" :tabindex="showKnobs ? 0 : -1" @click="home"><span aria-hidden="true">⌂</span></button>
  </div>
  <div v-else class="compass phone" :class="{ open }" data-testid="compass">
    <button
      v-tip="open ? null : { title: $t('compass.title'), text: $t('compass.hint') }"
      class="cmp-btn"
      :aria-label="$t('compass.title')"
      aria-haspopup="dialog"
      :aria-expanded="open"
      data-testid="compass-toggle"
      @click="open = !open"
    ><i class="cmp-n" :style="{ transform: `rotate(${yaw}rad)` }">N</i></button>
    <div v-if="open" class="cmp-pop frame" role="group" :aria-label="$t('compass.title')" data-testid="compass-panel">
      <button v-for="b in holds" :key="b.k" v-tip="{ title: $t('compass.' + b.id), text: $t('compass.tip.' + b.tip) }" class="cmp-act" :aria-label="$t('compass.' + b.id)" :data-testid="'compass-' + b.id"
        @pointerdown.prevent="holdStart(b, $event)" @pointerup="holdEnd(b)" @pointercancel="holdEnd(b)" @pointerleave="holdEnd(b)" @contextmenu.prevent
        @keydown.enter.prevent="step(b)" @keydown.space.prevent="step(b)">
        <span class="cmp-glyph" aria-hidden="true">{{ b.glyph }}</span><span class="cmp-lbl">{{ $t('compass.' + b.id) }}</span>
      </button>
      <button v-tip="{ title: $t('compass.north'), text: $t('compass.tip.north') }" class="cmp-act" :aria-label="$t('compass.north')" data-testid="compass-north" @click="north"><span class="cmp-glyph" aria-hidden="true">N</span><span class="cmp-lbl">{{ $t('compass.north') }}</span></button>
      <button v-tip="{ title: $t('compass.home'), text: $t('compass.tip.home') }" class="cmp-act" :aria-label="$t('compass.home')" data-testid="compass-home" @click="home"><span class="cmp-glyph" aria-hidden="true">⌂</span><span class="cmp-lbl">{{ $t('compass.home') }}</span></button>
    </div>
  </div>
</template>

<script>
import { settings, set as setSetting } from '../settings.js';

/** One tap = one step; holding longer than HOLD_MS repeats like the keys (rig.keys). */
const HOLD_MS = 280;
const HOLDS = [
  { id: 'left', tip: 'rotate', k: 'q', glyph: '⟲', step: (r) => r.rotate(0.2, 0) },
  { id: 'right', tip: 'rotate', k: 'e', glyph: '⟳', step: (r) => r.rotate(-0.2, 0) },
  { id: 'tiltUp', tip: 'tilt', k: 'r', glyph: '▲', step: (r) => r.rotate(0, 0.12) },
  { id: 'tiltDown', tip: 'tilt', k: 'f', glyph: '▼', step: (r) => r.rotate(0, -0.12) },
  { id: 'zoomIn', tip: 'zoom', k: '+', glyph: '+', step: (r) => r.zoom(0.85) },
  { id: 'zoomOut', tip: 'zoom', k: '-', glyph: '−', step: (r) => r.zoom(1 / 0.85) },
];

export default {
  name: 'CameraCompass',
  props: {
    engine: { type: Object, required: true },
    /** 'badge' = small N at the minimap with a panel (phone), 'rim' = needle and brass knobs in the minimap frame (desktop) */
    variant: { type: String, default: 'badge' },
    /** A tutorial step points at the compass: the knobs are shown whatever the setting says */
    forceOpen: Boolean,
  },
  data() { return { open: false, yaw: 0, holds: HOLDS }; },
  computed: { showKnobs() { return settings.cameraKnobs || this.forceOpen; } },
  mounted() {
    this.timer = setInterval(() => { const y = this.rig()?.yaw ?? 0; if (y !== this.yaw) this.yaw = y; }, 100);
    this.timers = new Map();
  },
  beforeUnmount() { clearInterval(this.timer); for (const b of HOLDS) this.holdEnd(b); },
  methods: {
    /** Needle click: the state is remembered (default: closed, a normal map starts without knobs). */
    toggleKnobs() { setSetting('cameraKnobs', !settings.cameraKnobs); },
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
.compass.phone { position: absolute; top: -0.9375rem; left: 50%; transform: translateX(-50%); z-index: 6; }
.compass.rim { display: contents; }
.cmp-btn.cmp-rimbtn { position: absolute; top: -1.0625rem; left: 50%; margin-left: -0.9375rem; z-index: 6; }
.cmp-needle { display: block; width: 1.375rem; height: 1.375rem; }
.cmp-knob {
  position: absolute; z-index: 5; display: grid; place-items: center; width: 1.5rem; height: 1.5rem; padding: 0; border-radius: 50%; cursor: pointer; touch-action: none;
  background: radial-gradient(circle at 50% 35%, var(--wood-600), var(--wood-900) 70%); color: var(--gold-200); font: 600 0.8125rem/1 var(--display);
  box-shadow: 0 0 0 1.5px var(--gold-500), 0 0 0 2.5px var(--wood-950);
  opacity: 0; transform: scale(0.3); pointer-events: none; transition: opacity 0.18s, transform 0.18s;
}
.compass.open .cmp-knob { opacity: 1; transform: none; pointer-events: auto; }
.cmp-knob:hover { filter: brightness(1.3); }
.cmp-knob:active { background: var(--gold-600); color: var(--wood-950); }
.cmp-knob:focus-visible { outline: 2px solid var(--gold-100); outline-offset: 2px; }
.k-left { top: -0.9375rem; left: calc(20% - 0.75rem); }
.k-right { top: -0.9375rem; left: calc(80% - 0.75rem); }
.k-tiltUp { right: -0.9375rem; top: calc(26% - 0.75rem); }
.k-tiltDown { right: -0.9375rem; top: calc(42% - 0.75rem); }
.k-zoomIn { right: -0.9375rem; top: calc(60% - 0.75rem); }
.k-zoomOut { right: -0.9375rem; top: calc(76% - 0.75rem); }
.k-home { bottom: -0.9375rem; left: calc(20% - 0.75rem); }
.k-north { bottom: -0.9375rem; left: calc(80% - 0.75rem); }
.cmp-pop { bottom: auto; top: calc(100% + 0.5rem); left: auto; right: 0; transform: none; z-index: 8; }
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
