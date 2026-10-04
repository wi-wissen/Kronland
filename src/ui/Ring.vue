<template>
  <span class="ring" :class="{ urgent }" :style="{ '--frac': frac01, '--ring': urgent ? 'var(--bad)' : color }">
    <span class="ring-in"><slot /></span>
  </span>
</template>

<script>
/**
 * Ring display for times (payday, weather). frac = remaining share 0…1.
 * As conic-gradient instead of SVG: changes several times per second and must stay cheap above the 3D scene.
 */
export default {
  name: 'Ring',
  props: {
    frac: { type: Number, default: 1 },
    color: { type: String, default: 'var(--gold-300)' },
    urgent: Boolean,
  },
  computed: { frac01() { return Math.round(Math.max(0, Math.min(1, this.frac)) * 100) / 100; } },
};
</script>

<style>
.ring {
  position: relative; display: inline-grid; place-items: center; flex: none; border-radius: 50%;
  background: conic-gradient(var(--ring) calc(var(--frac) * 360deg), rgba(10, 6, 3, 0.6) 0);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.55);
}
.ring::before { content: ''; position: absolute; inset: 3px; border-radius: 50%; background: radial-gradient(circle at 50% 35%, #4a3322, #23170e); box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.5); }
.ring-in { position: relative; display: grid; place-items: center; }
</style>
