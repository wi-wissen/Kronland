<template>
  <section class="coach frame" data-testid="tutorial-coach">
    <div class="co-top">
      <span class="co-avatar" aria-hidden="true">O</span>
      <span class="co-step num" data-testid="tutorial-step">{{ $t('mission.step', { n: step.index + 1, total: step.total }) }}</span>
      <span class="co-dots" aria-hidden="true"><i v-for="n in step.total" :key="n" :class="{ on: n <= step.index + 1 }"></i></span>
    </div>
    <h3 v-if="step.title" data-testid="tutorial-title">{{ $tr(step.title) }}</h3>
    <p data-testid="tutorial-text">{{ $tr(touch && step.touch ? step.touch : step.text) }}</p>
    <div class="co-actions">
      <button v-if="step.canNext" class="primary co-next" data-testid="tutorial-next" @click="$emit('next')">{{ $t('mission.next') }}<Icon name="next" /></button>
      <span v-else class="co-wait"><Icon name="hint" />{{ $t('mission.doIt') }}</span>
      <button class="ghost co-skip" data-testid="tutorial-skip" @click="$emit('skip')">{{ $t('mission.skipStep') }}</button>
    </div>
  </section>
  <!-- Glow frame around the control the step points at -->
  <div v-show="box" class="co-ring" :style="boxStyle" aria-hidden="true" data-testid="tutorial-highlight"></div>
</template>

<script>
export default {
  name: 'TutorialCoach',
  props: {
    step: { type: Object, required: true },
    touch: Boolean,
    lang: { type: String, default: 'de' },
  },
  emits: ['next', 'skip'],
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
    /** First visible element from the hint list (order = priority). */
    track() {
      const ids = this.step.hint?.ui ?? [];
      let found = null;
      for (const id of ids) {
        for (const el of document.querySelectorAll(`[data-testid="${id}"]`)) {
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
.coach {
  padding: 0.75rem 0.875rem; display: flex; flex-direction: column; gap: 0.375rem; flex: none;
  box-shadow: var(--panel-edge), 0 0 0 2px rgba(243, 200, 94, 0.35), 0 8px 24px rgba(0, 0, 0, 0.35);
}
.co-top { display: flex; align-items: center; gap: 0.5rem; }
.co-avatar {
  flex: none; width: 1.75rem; height: 1.75rem; border-radius: 50%; display: grid; place-items: center;
  font-family: var(--display); font-weight: 700; color: #3a1f06; font-size: var(--fs-md);
  background: radial-gradient(circle at 35% 30%, #f2d48e, #c9a35a 70%); box-shadow: 0 0 0 2px var(--wood-950);
}
.co-step { color: var(--ink-muted); font-size: var(--fs-xs); font-weight: 700; flex: 1; }
.co-dots { display: flex; gap: 3px; flex-wrap: wrap; justify-content: flex-end; max-width: 9rem; }
.co-dots i { width: 0.375rem; height: 0.375rem; border-radius: 50%; background: rgba(246, 236, 212, 0.18); }
.co-dots i.on { background: var(--gold-300); }
.coach h3 { margin: 0; font-family: var(--display); color: var(--gold-200); font-size: var(--fs-xl); line-height: 1.1; }
.coach p { margin: 0; font-size: var(--fs-md); line-height: 1.45; }
.co-actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.125rem; }
.co-next { display: inline-flex; align-items: center; gap: 0.375rem; min-height: var(--touch); padding-inline: 1.125rem; }
.co-next .ico { width: 1rem; height: 1rem; }
.co-wait { color: var(--ink-muted); font-size: var(--fs-sm); font-style: italic; flex: 1; display: inline-flex; align-items: center; gap: 0.375rem; }
.co-wait .ico { width: 1rem; height: 1rem; flex: none; }
.co-skip { margin-left: auto; font-size: var(--fs-sm); min-height: var(--touch); }
.co-ring {
  position: fixed; z-index: 25; pointer-events: none; border-radius: 0.625rem;
  border: 3px solid #ffcf4a; box-shadow: 0 0 0 4px rgba(255, 207, 74, 0.25), 0 0 18px rgba(255, 207, 74, 0.6);
  animation: co-pulse 1.2s ease-in-out infinite;
}
@keyframes co-pulse { 50% { box-shadow: 0 0 0 9px rgba(255, 207, 74, 0.08), 0 0 26px rgba(255, 207, 74, 0.85); } }
@media (max-width: 640px), (max-height: 480px) and (orientation: landscape) {
  .coach { padding: 0.5rem 0.625rem; gap: 0.25rem; }
  .coach h3 { font-size: var(--fs-lg); }
  .coach p { font-size: var(--fs-sm); }
  .co-dots { display: none; }
}
</style>
