<template>
  <!-- Glow frame around the control a mission points at (tutorial step or campaign objective) -->
  <div v-show="box" class="ui-pointer" :style="boxStyle" aria-hidden="true" data-testid="ui-pointer"></div>
</template>

<script>
export default {
  name: 'UiPointer',
  props: {
    /** data-testids of the target controls, order = priority (the first visible one wins) */
    ids: { type: Array, default: () => [] },
  },
  data() { return { box: null }; },
  computed: {
    boxStyle() {
      if (!this.box) return {};
      const b = this.box;
      return { left: `${b.x - 5}px`, top: `${b.y - 5}px`, width: `${b.w + 10}px`, height: `${b.h + 10}px` };
    },
  },
  mounted() {
    // Keep tracking the position of the target element (panels open, scroll, size changes)
    const loop = () => { this.track(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  },
  beforeUnmount() { cancelAnimationFrame(this.raf); },
  methods: {
    track() {
      let found = null;
      for (const id of this.ids) {
        // data-hint-for: a button that first unfolds the target (phone: map button for the quick access)
        for (const el of document.querySelectorAll(`[data-testid="${id}"], [data-hint-for~="${id}"]`)) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && el.offsetParent !== null) { found = r; break; }
        }
        if (found) break;
      }
      const b = found ? { x: Math.round(found.left), y: Math.round(found.top), w: Math.round(found.width), h: Math.round(found.height) } : null;
      if (JSON.stringify(b) !== JSON.stringify(this.box)) this.box = b;
    },
  },
};
</script>

<style>
.ui-pointer {
  position: fixed; z-index: 25; pointer-events: none; border-radius: 0.625rem;
  border: 3px solid #ffcf4a; box-shadow: 0 0 0 4px rgba(255, 207, 74, 0.25), 0 0 18px rgba(255, 207, 74, 0.6);
  animation: ui-pointer-pulse 1.2s ease-in-out infinite;
}
@keyframes ui-pointer-pulse { 50% { box-shadow: 0 0 0 9px rgba(255, 207, 74, 0.08), 0 0 26px rgba(255, 207, 74, 0.85); } }
</style>
