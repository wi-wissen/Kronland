<template>
  <!-- Right card: portrait and key figures of the selection -->
  <section class="selcard frame" data-testid="selection-card" :aria-label="title">
    <header class="sc-head">
      <span class="sc-portrait" :style="ownerStyle"><Icon :name="icon" /></span>
      <span class="sc-title">
        <b>{{ title }}</b>
        <small>{{ subtitle }}</small>
      </span>
      <button v-if="sel" v-tip="{ text: $t('ctx.deselect'), key: 'Esc' }" class="icon-btn ghost sc-close" :aria-label="$t('ctx.deselect')" @click="$emit('deselect')"><Icon name="close" /></button>
    </header>
    <div class="sc-body scroll-y">
      <SelectionStats v-if="sel?.kind === 'building'" :sel="sel" />
      <template v-else-if="sel?.kind === 'serfs'">
        <div class="sc-kpis">
          <span v-tip="$t('serfs.idle', { n: sel.idle })" class="kpi"><Icon name="idle" /><b class="num">{{ sel.idle }}</b></span>
          <span v-tip="$t('serfs.wood', { n: sel.jobs.wood })" class="kpi"><Icon name="wood" /><b class="num">{{ sel.jobs.wood }}</b></span>
          <span v-tip="$t('serfs.mining', { n: sel.jobs.mining })" class="kpi"><Icon name="stone" /><b class="num">{{ sel.jobs.mining }}</b></span>
          <span v-tip="$t('serfs.building', { n: sel.jobs.building })" class="kpi"><Icon name="b-residence" /><b class="num">{{ sel.jobs.building }}</b></span>
        </div>
        <p v-if="hints" class="sc-hint">{{ touch ? $t('serfs.hintTouch') : $t('serfs.hint') }}</p>
      </template>
      <template v-else-if="sel?.kind === 'army'">
        <div class="sc-kpis">
          <span class="kpi"><Icon name="banner" /><b class="num">{{ leaders }}</b></span>
          <span class="kpi"><Icon name="soldiers" /><b class="num">{{ sel.soldiers }}</b></span>
          <span v-if="sel.heroes.length" class="kpi"><Icon name="crown" /><b class="num">{{ sel.heroes.length }}</b></span>
        </div>
      </template>
      <template v-else-if="sel?.kind === 'foreign'">
        <p class="sc-hint">{{ relation }}</p>
      </template>
      <template v-else>
        <div class="sc-kpis">
          <span v-tip="$t('top.workers')" class="kpi"><Icon name="worker" /><b class="num">{{ ui.workers }}</b></span>
          <span v-tip="$t('top.faith')" class="kpi"><Icon name="faith" /><b class="num">{{ ui.faith }}</b></span>
        </div>
        <p class="sc-hint">{{ touch ? $t('ctx.nothingTouch') : $t('ctx.nothing') }}</p>
      </template>
    </div>
  </section>
</template>

<script>
import SelectionStats from './SelectionStats.vue';
import { clock, playerColor } from '../plugin.js';

export default {
  name: 'SelectionCard',
  components: { SelectionStats },
  props: { ui: { type: Object, required: true }, touch: Boolean, hints: { type: Boolean, default: true } },
  emits: ['deselect'],
  computed: {
    sel() { return this.ui.selection; },
    leaders() { return this.sel.groups.reduce((s, g) => s + g.count, 0); },
    icon() {
      const s = this.sel;
      if (!s) return 'crown';
      if (s.kind === 'building') return 'b-' + s.type;
      if (s.kind === 'serfs') return 'serf';
      if (s.kind === 'army') return s.heroes.length && !s.groups.length ? 'hero-' + s.heroes[0].hero : s.groups.length ? 'u-' + s.groups[0].line : 'militia';
      if (s.kind === 'foreign') return s.entity === 'ruin' ? 'fire' : s.hero ? 'hero-' + s.hero : s.entity === 'leader' && s.unit ? 'u-' + s.unit.replace(/\d+$/, '') : s.entity === 'worker' ? 'worker' : s.entity === 'unit' ? 'serf' : 'skull';
      return 'info';
    },
    title() {
      const s = this.sel;
      if (!s) return this.$t('card.realm');
      if (s.kind === 'building') return this.$name.building(s.type, s.levelIndex);
      if (s.kind === 'serfs') return s.count === 1 ? this.$t('serfs.one') : this.$t('serfs.count', { n: s.count });
      if (s.kind === 'army') return s.heroes.length === 1 && !s.groups.length ? this.$name.hero(s.heroes[0].hero) : this.$t('army.title');
      if (s.kind === 'foreign') return s.entity === 'ruin' ? this.$t('sys.ruin') + (s.type ? ' · ' + this.$name.building(s.type, s.level ?? 0) : '') : s.hero ? this.$name.hero(s.hero) : s.unit ? this.$name.unit(s.unit) : this.$t('foreign.' + (s.entity === 'unit' ? 'serf' : s.entity in { worker: 1, hero: 1, soldier: 1 } ? s.entity : 'unit'));
      return '';
    },
    subtitle() {
      const s = this.sel;
      if (!s) return this.$t('card.time', { t: clock(this.ui.tick) });
      if (s.kind === 'building') return this.$t('common.levelOf', { n: s.level, max: s.maxLevel }) + (s.profession ? ' · ' + this.$name.prof(s.profession) : '');
      if (s.kind === 'serfs') return this.$t('serfs.idle', { n: s.idle });
      if (s.kind === 'army') return s.heroes.length === 1 && !s.groups.length ? this.$name.heroTitle(s.heroes[0].hero) : this.$t('army.soldiers', { n: s.soldiers });
      if (s.kind === 'foreign') return this.relation;
      return '';
    },
    relation() {
      const o = this.sel?.owner;
      if (o === undefined || o < 0) return '';
      if (o >= 2 && this.ui.mission && false) return this.$t('foreign.bandits');
      return this.$t('foreign.enemy') + ' · ' + this.$t('common.player', { n: o + 1 });
    },
    ownerStyle() {
      const o = this.sel?.kind === 'foreign' ? this.sel.owner : this.sel?.kind === 'building' ? this.sel.owner : 0;
      return { '--owner': playerColor(o ?? 0) };
    },
  },
};
</script>

<style>
.selcard { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.625rem 0.75rem; min-height: 0; overflow: hidden; }
.sc-head { display: flex; align-items: center; gap: 0.625rem; }
.sc-portrait {
  flex: none; width: 3.75rem; height: 3.75rem; border-radius: 0.625rem; display: grid; place-items: center;
  background: radial-gradient(circle at 50% 30%, #fff7e2, #dcc08a 75%);
  box-shadow: inset 0 0 0 2px var(--gold-500), inset 0 -4px 0 var(--owner, var(--royal)), 0 0 0 2px var(--wood-950), 0 3px 8px rgba(0, 0, 0, 0.5);
}
.sc-portrait .ico { width: 3rem; height: 3rem; }
.sc-title { display: flex; flex-direction: column; min-width: 0; flex: 1; gap: 0.125rem; }
.sc-title b { font-family: var(--display); color: var(--gold-200); font-size: var(--fs-lg); line-height: 1.1; text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.sc-title small { color: var(--ink-muted); font-size: var(--fs-xs); }
.sc-close { align-self: flex-start; width: 2rem !important; min-width: 2rem !important; min-height: 2rem; height: 2rem; }
.sc-body { min-height: 0; flex: 1; display: flex; flex-direction: column; gap: 0.5rem; }
.sc-kpis { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.kpi { display: inline-flex; align-items: center; gap: 0.3125rem; padding: 0.25rem 0.5rem; border-radius: var(--r-md); background: var(--inset-bg); box-shadow: var(--inset-edge); }
.kpi .ico { width: 1.25rem; height: 1.25rem; }
.kpi b { font-weight: 700; }
.sc-hint { margin: 0; color: var(--ink-muted); font-size: var(--fs-sm); }
</style>
