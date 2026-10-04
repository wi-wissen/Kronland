<template>
  <!-- Damaged or burning building: state, repair squad and "Repair" button -->
  <section class="rp inset" :class="{ burning: repair.burning }" data-testid="repair-panel" role="status">
    <span class="rp-icon"><Icon :name="repair.burning ? 'fire' : 'repair'" /></span>
    <span class="rp-text">
      <b>{{ repair.burning ? $t('sys.burning') : $t('sys.damaged') }}</b>
      <small v-if="repair.repairers">{{ $t('sys.repairers', { n: repair.repairers, max: repair.max }) }} · <span class="num">{{ $t('sys.repairRate', { n: repair.hpPerSecond }) }}</span></small>
      <small v-else-if="repair.burning">{{ $t('sys.burnHint') }}</small>
    </span>
    <span v-if="repair.repairers" class="pips small rp-pips" :aria-label="repair.repairers + '/' + repair.max"><i v-for="n in repair.max" :key="n" :class="{ on: n <= repair.repairers }"></i></span>
    <button
      v-if="own"
      v-tip="{ title: $t('sys.repair'), text: $t('sys.repairTip') }"
      class="rp-btn"
      :class="{ primary: repair.repairers < repair.max }"
      :disabled="repair.repairers >= repair.max"
      data-testid="repair"
      @click="$emit('repair')"
    ><Icon name="repair" />{{ $t('sys.repair') }}</button>
  </section>
</template>

<script>
export default {
  name: 'RepairState',
  props: { repair: { type: Object, required: true }, own: { type: Boolean, default: true } },
  emits: ['repair'],
};
</script>

<style>
.rp { display: flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0.5rem; flex-wrap: wrap; box-shadow: inset 0 0 0 1px rgba(244, 189, 79, 0.5); }
.rp.burning { background: linear-gradient(90deg, rgba(163, 50, 31, 0.45), rgba(14, 9, 5, 0.4)); box-shadow: inset 0 0 0 1px rgba(243, 122, 100, 0.7), 0 0 12px rgba(240, 122, 42, 0.3); }
.rp-icon { flex: none; width: 2.25rem; height: 2.25rem; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 50% 35%, #fbf1d6, #d7bb86); box-shadow: inset 0 0 0 2px var(--warn); }
.rp.burning .rp-icon { box-shadow: inset 0 0 0 2px var(--bad); animation: rp-pulse 1.2s ease-in-out infinite; }
.rp-icon .ico { width: 1.625rem; height: 1.625rem; }
.rp-text { display: flex; flex-direction: column; flex: 1; min-width: 9rem; }
.rp-text b { font-size: var(--fs-sm); color: var(--warn); }
.rp.burning .rp-text b { color: #ffcbbf; }
.rp-text small { font-size: var(--fs-xs); color: var(--ink-muted); }
.rp-btn { display: inline-flex; align-items: center; gap: 0.375rem; font-weight: 700; }
@keyframes rp-pulse { 50% { box-shadow: inset 0 0 0 2px var(--bad), 0 0 10px rgba(240, 122, 42, 0.8); } }
@media (prefers-reduced-motion: reduce) { .rp.burning .rp-icon { animation: none; } }
@media (max-width: 760px) { .rp-btn { min-height: var(--touch); } }
</style>
