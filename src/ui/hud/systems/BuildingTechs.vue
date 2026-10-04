<template>
  <!-- Building technologies (smithy, sawmill, alchemist, castle, …): cards with cost, progress and lock reason -->
  <section class="bp-sec" data-testid="building-techs">
    <h4 class="h-label">
      <Icon name="research" />{{ $t('sys.techs') }}
      <span v-if="researching" class="bp-running num">{{ $t('sys.techResearching', { tech: $name.tech(researching.tech), p: researching.progress }) }}</span>
    </h4>
    <p v-if="researching && speed !== null" class="bt-speed" :class="{ stalled: speed === 0 }">
      <Icon :name="speed === 0 ? 'warning' : 'worker'" />
      <span v-tip="$t('sys.techRateTip')">{{ speed === 0 ? $t('sys.techNoWorkers') : $t('sys.techRate', { n: speed }) }}</span>
    </p>
    <div class="bt-grid">
      <button
        v-for="t in techs"
        :key="t.id"
        v-tip="tipFor(t)"
        class="bt-card"
        :class="stateOf(t)"
        :aria-disabled="stateOf(t) !== 'open'"
        :aria-label="$name.tech(t.id) + ' – ' + statusText(t)"
        :data-testid="'btech-' + t.id"
        @click="stateOf(t) === 'open' && $emit('research', t.id)"
      >
        <span class="bt-icon"><Icon :name="t.icon || 'research'" /></span>
        <span class="bt-body">
          <b class="bt-name">{{ $name.tech(t.id) }}</b>
          <small class="bt-desc">{{ $name.techDesc(t.id) }}</small>
          <span class="bt-status">
            <template v-if="t.done"><Icon name="check" />{{ $t('bld.techDone') }}</template>
            <template v-else-if="t.running !== null">
              <span class="meter"><i :style="{ width: t.running + '%' }"></i></span>
              <span class="num">{{ $t('bld.techRunning', { p: t.running }) }}</span>
            </template>
            <template v-else-if="stateOf(t) === 'locked'"><Icon name="lock" /><span class="bt-why">{{ $reason(t.reason) }}</span></template>
            <template v-else>
              <CostList :cost="t.cost" :have="have" />
              <span class="bt-time num"><Icon name="time" />{{ t.time }} s</span>
            </template>
          </span>
        </span>
      </button>
    </div>
  </section>
</template>

<script>
import CostList from '../../CostList.vue';

/** Reasons for which the card only "waits" (resources, running research) instead of being locked. */
const WAIT = new Set(['err.notEnoughResources', 'err.busyResearching', 'err.beingResearched']);

export default {
  name: 'BuildingTechs',
  components: { CostList },
  props: {
    techs: { type: Array, required: true },
    have: { type: Object, required: true },
    researching: { type: Object, default: null },
    speed: { type: Number, default: null },
  },
  emits: ['research'],
  methods: {
    code(r) { return typeof r === 'string' ? r : r?.code; },
    stateOf(t) {
      if (t.done) return 'done';
      if (t.running !== null) return 'running';
      if (!t.reason) return 'open';
      return WAIT.has(this.code(t.reason)) ? 'wait' : 'locked';
    },
    statusText(t) {
      if (t.done) return this.$t('bld.techDone');
      if (t.running !== null) return this.$t('bld.techRunning', { p: t.running });
      return t.reason ? this.$reason(t.reason) : this.$t('bld.techTime', { s: t.time });
    },
    tipFor(t) {
      const lines = [];
      if (t.prev) lines.push([this.$t('sys.techPrev', { tech: this.$name.tech(t.prev) }), '']);
      if (t.unlocks) lines.push([this.$t('sys.techUnlocks', { building: this.$name.building(t.unlocks) }), '']);
      return {
        title: this.$name.tech(t.id),
        text: this.$name.techDesc(t.id) + ' · ' + this.$t('bld.techTime', { s: t.time }),
        lines: lines.length ? lines : null,
        cost: t.done ? null : t.cost, have: this.have,
        reason: !t.done && t.running === null && t.reason ? this.$reason(t.reason) : null,
      };
    },
  },
};
</script>

<style>
.bt-speed { margin: 0; display: flex; align-items: center; gap: 0.375rem; font-size: var(--fs-xs); color: var(--ink-muted); }
.bt-speed .ico { width: 1rem; height: 1rem; }
.bt-speed.stalled { color: var(--warn); font-weight: 700; }
.bt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(14.5rem, 1fr)); gap: 0.375rem; }
.bt-card { display: flex; align-items: flex-start; gap: 0.5rem; text-align: left; padding: 0.375rem 0.5rem; min-height: 4rem; }
.bt-icon { flex: none; width: 2.25rem; height: 2.25rem; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 50% 35%, #fbf1d6, #d7bb86); box-shadow: inset 0 0 0 2px var(--gold-500), 0 1px 3px rgba(0, 0, 0, 0.45); }
.bt-icon .ico { width: 1.625rem; height: 1.625rem; }
.bt-body { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; flex: 1; }
.bt-name { font-weight: 700; font-size: var(--fs-sm); line-height: 1.15; }
.bt-desc { color: var(--ink-muted); font-size: var(--fs-xs); line-height: 1.2; }
.bt-status { display: flex; align-items: center; flex-wrap: wrap; gap: 0.25rem 0.5rem; font-size: var(--fs-xs); margin-top: 0.125rem; }
.bt-status .ico { width: 0.875rem; height: 0.875rem; }
.bt-status .meter { flex: 1; min-width: 3rem; }
.bt-status .costs { font-size: var(--fs-xs); gap: 0 0.375rem; }
.bt-status .cost .ico { width: 0.8125rem; height: 0.8125rem; }
.bt-time { display: inline-flex; align-items: center; gap: 0.125rem; color: var(--ink-dim); }
.bt-why { color: var(--ink-dim); }
.bt-card.done { background: linear-gradient(180deg, #3d5a2a, #2a3f1d); color: #e3f6d4; filter: none !important; cursor: default; box-shadow: inset 0 0 0 1px rgba(139, 217, 111, 0.55); }
.bt-card.done .bt-desc { color: #bcd9ad; }
.bt-card.done .bt-status { color: var(--good); font-weight: 700; }
.bt-card.running { box-shadow: inset 0 0 0 1px var(--gold-300), 0 0 12px rgba(243, 200, 94, 0.35); filter: none !important; cursor: default; }
.bt-card.running .bt-status { color: var(--gold-200); font-weight: 700; }
.bt-card.open { box-shadow: inset 0 0 0 1px rgba(243, 200, 94, 0.55), inset 0 1px 0 rgba(255, 228, 180, 0.2); }
.bt-card.wait { filter: brightness(0.85) !important; }
.bt-card.locked { background: rgba(14, 9, 5, 0.45); box-shadow: inset 0 0 0 1px rgba(255, 225, 170, 0.06); color: var(--ink-dim); filter: none !important; }
.bt-card.locked .bt-icon { filter: grayscale(0.8) brightness(0.8); }
@media (max-width: 760px) {
  .bt-grid { grid-template-columns: 1fr; }
  .bt-card { min-height: var(--touch); }
}
</style>
