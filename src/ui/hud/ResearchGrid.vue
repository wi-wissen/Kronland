<template>
  <div class="rgrid" role="grid" :aria-label="$t('bld.research')">
    <div class="rg-head" role="row">
      <span></span>
      <span v-for="n in tiers" :key="n" class="rg-tier" role="columnheader">{{ roman(n) }}</span>
    </div>
    <div v-for="(row, li) in rows" :key="li" class="rg-row" role="row">
      <span v-tip="$t('bld.techLine.' + li)" class="rg-line" role="rowheader" :aria-label="$t('bld.techLine.' + li)">
        <Icon :name="lineIcons[li]" /><span class="rg-linename">{{ $t('bld.techLine.' + li) }}</span>
      </span>
      <template v-for="(tc, ti) in row" :key="tc ? tc.id : ti">
        <button
          v-if="tc"
          v-tip="tipFor(tc)"
          role="gridcell"
          class="rg-cell"
          :class="stateOf(tc)"
          :aria-disabled="stateOf(tc) !== 'open'"
          :aria-label="$name.tech(tc.id) + ' – ' + statusText(tc)"
          :data-testid="'tech-' + tc.id"
          @click="stateOf(tc) === 'open' && $emit('research', tc.id)"
        >
          <i v-if="ti > 0" class="rg-link" :class="{ lit: row[ti - 1]?.done }" aria-hidden="true"></i>
          <span class="rg-name">{{ $name.tech(tc.id) }}</span>
          <span class="rg-status">
            <template v-if="tc.done"><Icon name="check" />{{ $t('bld.techDone') }}</template>
            <template v-else-if="tc.running !== null">
              <span class="meter"><i :style="{ width: tc.running + '%' }"></i></span>
              <span class="num">{{ $t('bld.techRunning', { p: tc.running }) }}</span>
            </template>
            <CostList v-else :cost="tc.cost" :have="have" />
          </span>
        </button>
        <span v-else class="rg-cell empty"></span>
      </template>
    </div>
  </div>
</template>

<script>
import CostList from '../CostList.vue';
import { TECH_LINE_ICONS } from '../icons/index.js';
import { techUnlocks } from '../techUnlocks.js';

export default {
  name: 'ResearchGrid',
  components: { CostList },
  props: {
    techs: { type: Array, required: true },
    have: { type: Object, required: true },
  },
  emits: ['research'],
  data() { return { lineIcons: TECH_LINE_ICONS }; },
  computed: {
    tiers() { return Math.max(4, ...this.techs.map((t) => t.tier)); },
    rows() {
      const lines = Math.max(4, ...this.techs.map((t) => t.line + 1));
      const out = Array.from({ length: lines }, () => Array(this.tiers).fill(null));
      for (const t of this.techs) out[t.line][t.tier - 1] = t;
      return out;
    },
  },
  methods: {
    roman(n) { return ['I', 'II', 'III', 'IV', 'V', 'VI'][n - 1] ?? String(n); },
    stateOf(t) {
      if (t.done) return 'done';
      if (t.running !== null) return 'running';
      if (t.elsewhere) return 'elsewhere';
      if (!t.reason) return 'open';
      const code = typeof t.reason === 'string' ? t.reason : t.reason.code;
      return code === 'err.notEnoughResources' || code === 'err.busyResearching' ? 'wait' : 'locked';
    },
    statusText(t) {
      if (t.done) return this.$t('bld.techDone');
      if (t.running !== null) return this.$t('bld.techRunning', { p: t.running });
      return t.reason ? this.$reason(t.reason) : this.$t('build.clickToBuild');
    },
    /** "Unlocks: …" as rows for the tooltip */
    unlockNotes(id) {
      const u = techUnlocks(id), out = [];
      if (u.build.length) out.push(this.$t('bld.techBuild', { list: u.build.map((b) => this.$name.building(b)).join(', ') }));
      if (u.upgrade.length) out.push(this.$t('bld.techUpgrade', { list: u.upgrade.map(([b, l]) => this.$name.building(b, l)).join(', ') }));
      for (const k of u.extra) out.push(this.$t(k));
      if (out.length) out[0] = this.$t('bld.techUnlocks') + ' – ' + out[0];
      return out;
    },
    tipFor(t) {
      return {
        title: this.$name.tech(t.id),
        text: this.$t('bld.techLine.' + t.line) + ' · ' + this.$t('bld.techTier', { n: t.tier }) + ' · ' + this.$t('bld.techTime', { s: t.time }),
        notes: this.unlockNotes(t.id),
        cost: t.done ? null : t.cost, have: this.have,
        reason: !t.done && t.running === null && t.reason ? this.$reason(t.reason) : null,
      };
    },
  },
};
</script>

<style>
.rgrid { display: grid; gap: 0.3125rem; min-width: 34rem; }
.rg-head, .rg-row { display: grid; grid-template-columns: 7.25rem repeat(4, minmax(0, 1fr)); gap: 0.3125rem 0.875rem; align-items: stretch; }
.rg-tier { text-align: center; font-family: var(--display); color: var(--gold-400); font-size: var(--fs-sm); line-height: 1; }
.rg-line { display: flex; align-items: center; gap: 0.375rem; color: var(--ink-muted); font-size: var(--fs-sm); font-weight: 700; }
.rg-line .ico { width: 1.5rem; height: 1.5rem; }
.rg-linename { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rg-cell {
  position: relative; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 0.1875rem;
  text-align: left; padding: 0.3125rem 0.5rem; min-height: 3.125rem;
}
.rg-cell.empty { visibility: hidden; }
.rg-link { position: absolute; left: -0.9375rem; top: 50%; width: 0.9375rem; height: 3px; transform: translateY(-50%); background: rgba(10, 6, 3, 0.7); box-shadow: 0 0 0 1px rgba(255, 225, 170, 0.08); pointer-events: none; }
.rg-link.lit { background: linear-gradient(90deg, var(--gold-500), var(--gold-300)); box-shadow: 0 0 6px rgba(243, 200, 94, 0.6); }
.rg-name { font-weight: 700; font-size: var(--fs-sm); line-height: 1.15; }
.rg-status { display: flex; align-items: center; gap: 0.3125rem; font-size: var(--fs-xs); width: 100%; }
.rg-status .ico { width: 0.875rem; height: 0.875rem; }
.rg-status .meter { flex: 1; }
.rg-status .costs { font-size: var(--fs-xs); gap: 0 0.375rem; }
.rg-status .cost .ico { width: 0.8125rem; height: 0.8125rem; }
.rg-cell.done { background: linear-gradient(180deg, #3d5a2a, #2a3f1d); color: #e3f6d4; filter: none !important; cursor: default; box-shadow: inset 0 0 0 1px rgba(139, 217, 111, 0.55); }
.rg-cell.done .rg-status { color: var(--good); font-weight: 700; }
.rg-cell.running { box-shadow: inset 0 0 0 1px var(--gold-300), 0 0 12px rgba(243, 200, 94, 0.35); filter: none !important; cursor: default; }
.rg-cell.running .rg-status { color: var(--gold-200); }
.rg-cell.open { box-shadow: inset 0 0 0 1px rgba(243, 200, 94, 0.55), inset 0 1px 0 rgba(255, 228, 180, 0.2); }
.rg-cell.wait { filter: brightness(0.85) !important; }
.rg-cell.locked { background: rgba(14, 9, 5, 0.45); box-shadow: inset 0 0 0 1px rgba(255, 225, 170, 0.06); color: var(--ink-dim); filter: none !important; }
.rg-cell.locked .costs { color: var(--ink-dim); }
.rg-cell.locked .cost .ico { opacity: 0.55; }
.rg-cell.elsewhere { filter: brightness(0.75) !important; }
@media (max-width: 760px), (max-height: 480px) and (orientation: landscape) {
  .rgrid { min-width: 30rem; }
  .rg-head, .rg-row { grid-template-columns: 2rem repeat(4, minmax(6.25rem, 1fr)); gap: 0.25rem 0.75rem; }
  .rg-linename { display: none; }
  .rg-link { left: -0.8125rem; width: 0.8125rem; }
  .rg-cell { min-height: var(--touch); }
  /* "Show labels" setting: name of the research line under the icon */
  .show-labels .rg-head, .show-labels .rg-row { grid-template-columns: 3.75rem repeat(4, minmax(6.25rem, 1fr)); }
  .show-labels .rg-line { flex-direction: column; justify-content: center; gap: 0; }
  .show-labels .rg-linename { display: block; max-width: 100%; font-size: 0.625rem; line-height: 1.1; }
}
</style>
