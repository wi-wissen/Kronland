<template>
  <!-- Key figures of a building as small bars: construction, hit points, workers, beds, dining spots, motivation -->
  <div class="sstats">
    <div v-if="!sel.done" class="ss-row ss-build">
      <span class="ss-label"><Icon name="serf" />{{ sel.level > 1 ? $t('bld.upgrading') : $t('bld.underConstruction') }}</span>
      <span class="meter"><i :style="{ width: sel.progress + '%' }"></i></span>
      <b class="num">{{ $t('bld.progress', { p: sel.progress, n: sel.builders }) }}</b>
    </div>
    <div class="ss-row" :class="{ 'ss-burning': sel.burning }" data-testid="stat-hp">
      <span v-tip="sel.burning ? $t('sys.burning') : null" class="ss-label"><Icon :name="sel.burning ? 'fire' : 'hp'" />{{ $t('bld.hp') }}</span>
      <span class="meter hp"><i :style="{ width: pct(sel.hp, sel.maxHp) + '%' }"></i></span>
      <b class="num">{{ sel.hp }}<small>/{{ sel.maxHp }}</small></b>
    </div>
    <div v-if="sel.workers" class="ss-row" data-testid="stat-workers">
      <span class="ss-label"><Icon name="worker" />{{ $t('bld.workers') }}</span>
      <span class="pips" :aria-label="sel.workers[0] + '/' + sel.workers[1]"><i v-for="n in sel.workers[1]" :key="n" :class="{ on: n <= sel.workers[0] }"></i></span>
      <b class="num">{{ sel.workers[0] }}<small>/{{ sel.workers[1] }}</small></b>
    </div>
    <div v-if="sel.beds" class="ss-row" data-testid="stat-beds">
      <span class="ss-label"><Icon name="bed" />{{ $t('bld.beds') }}</span>
      <span class="meter good"><i :style="{ width: pct(sel.beds[0], sel.beds[1]) + '%' }"></i></span>
      <b class="num">{{ sel.beds[0] }}<small>/{{ sel.beds[1] }}</small></b>
    </div>
    <div v-if="sel.seats" class="ss-row" data-testid="stat-seats">
      <span class="ss-label"><Icon name="seat" />{{ $t('bld.seats') }}</span>
      <span class="meter good"><i :style="{ width: pct(sel.seats[0], sel.seats[1]) + '%' }"></i></span>
      <b class="num">{{ sel.seats[0] }}<small>/{{ sel.seats[1] }}</small></b>
    </div>
    <div v-if="sel.motivation !== null && sel.motivation !== undefined" class="ss-row">
      <span class="ss-label"><Icon :name="sel.motivation < 40 ? 'motivationLow' : 'motivation'" />{{ $t('bld.motivation') }}</span>
      <span class="meter" :class="sel.motivation < 40 ? 'bad' : sel.motivation < 70 ? 'warn' : 'good'"><i :style="{ width: Math.min(100, sel.motivation / 1.5) + '%' }"></i></span>
      <b class="num">{{ sel.motivation }}<small>%</small></b>
    </div>
    <div v-if="sel.population" class="ss-row">
      <span class="ss-label"><Icon name="population" />{{ $t('bld.population') }}</span>
      <b class="num ss-wide">{{ $t('bld.populationPlus', { n: sel.population }) }}</b>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SelectionStats',
  props: { sel: { type: Object, required: true } },
  methods: { pct(a, b) { return b ? Math.min(100, (100 * a) / b) : 0; } },
};
</script>

<style>
.sstats { display: flex; flex-direction: column; gap: 0.3125rem; font-size: var(--fs-sm); }
.ss-row { display: grid; grid-template-columns: 6.25rem 1fr auto; align-items: center; gap: 0.5rem; }
.ss-label { display: inline-flex; align-items: center; gap: 0.3125rem; color: var(--ink-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ss-label .ico { width: 1rem; height: 1rem; }
.ss-row b { font-weight: 700; text-align: right; min-width: 3.25rem; }
.ss-row b small { color: var(--ink-dim); font-weight: 500; }
.ss-burning .ss-label { color: var(--bad); font-weight: 700; }
.ss-burning .meter.hp { box-shadow: 0 0 6px rgba(240, 122, 42, 0.7); }
.ss-wide { grid-column: 2 / 4; text-align: left !important; }
.ss-build b { min-width: 0; font-size: var(--fs-xs); }
.pips { display: flex; gap: 3px; flex-wrap: wrap; }
.pips i { width: 0.625rem; height: 0.625rem; border-radius: 2px; background: rgba(10, 6, 3, 0.6); box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.6); }
.pips i.on { background: linear-gradient(180deg, #b5ec92, #4f9a35); box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35); }
</style>
