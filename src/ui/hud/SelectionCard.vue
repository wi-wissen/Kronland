<template>
  <!-- Selection bottom right: portrait in a brass frame, next to it a plate with labelled values.
       With little width (narrow) only the portrait remains; the values are then in the command panel. -->
  <section class="selcard" data-testid="selection-card" :aria-label="title">
    <div v-if="!narrow" class="sc-plaque frame">
      <div class="sc-title">
        <b>{{ title }}</b>
        <small>{{ subtitle }}</small>
      </div>
      <SelectionStats v-if="sel.kind === 'building'" :sel="sel" />
      <template v-else-if="sel.kind === 'serfs'">
        <div class="sc-rows">
          <span><Icon name="idle" />{{ $t('serfs.idle', { n: sel.idle }) }}</span>
          <span><Icon name="wood" />{{ $t('serfs.wood', { n: sel.jobs.wood }) }}</span>
          <span><Icon name="stone" />{{ $t('serfs.mining', { n: sel.jobs.mining }) }}</span>
          <span><Icon name="repair" />{{ $t('serfs.building', { n: sel.jobs.building }) }}</span>
        </div>
        <p v-if="hints" class="sc-hint">{{ touch ? $t('serfs.hintTouch') : $t('serfs.hint') }}</p>
      </template>
      <div v-else-if="sel.kind === 'army'" class="sc-rows">
        <span><Icon name="banner" />{{ $t('card.leaders', { n: leaders }) }}</span>
        <span><Icon name="soldiers" />{{ $t('army.soldiers', { n: sel.soldiers }) }}</span>
        <span v-if="sel.heroes.length"><Icon name="crown" />{{ $t('card.heroes', { n: sel.heroes.length }) }}</span>
      </div>
      <p v-else class="sc-hint">{{ relation }}</p>
    </div>
    <div class="sc-portrait" :style="ownerStyle">
      <span class="sc-pic">
        <img v-if="portrait" :src="portrait" alt="" draggable="false">
        <Icon v-else :name="icon" />
      </span>
      <span v-if="badge" class="sc-badge num">{{ badge }}</span>
      <button v-tip="{ text: $t('ctx.deselect'), key: 'Esc' }" class="coin sc-close" :aria-label="$t('ctx.deselect')" @click="$emit('deselect')"><Icon name="close" /></button>
    </div>
  </section>
</template>

<script>
import SelectionStats from './SelectionStats.vue';
import { playerColor } from '../plugin.js';
import { selectionIcon, selectionPortrait } from './hudLayout.js';
import { siteRoot } from '../../paths.js';

export default {
  name: 'SelectionCard',
  components: { SelectionStats },
  props: {
    ui: { type: Object, required: true },
    touch: Boolean,
    hints: { type: Boolean, default: true },
    narrow: Boolean,
  },
  emits: ['deselect'],
  computed: {
    sel() { return this.ui.selection; },
    leaders() { return this.sel.groups.reduce((s, g) => s + g.count, 0); },
    icon() { return selectionIcon(this.sel); },
    portrait() { return selectionPortrait(this.sel, siteRoot()); },
    badge() {
      const s = this.sel;
      if (s.kind === 'serfs' && s.count > 1) return '×' + s.count;
      if (s.kind === 'army' && s.soldiers) return '×' + s.soldiers;
      if (s.kind === 'building') return this.$t('common.levelOf', { n: s.level, max: s.maxLevel });
      return '';
    },
    title() {
      const s = this.sel;
      if (s.kind === 'building') return this.$name.building(s.type, s.levelIndex);
      if (s.kind === 'serfs') return s.count === 1 ? this.$t('serfs.one') : this.$t('serfs.count', { n: s.count });
      if (s.kind === 'army') return s.heroes.length === 1 && !s.groups.length ? this.$name.hero(s.heroes[0].hero) : this.$t('army.title');
      if (s.kind === 'foreign') return s.entity === 'ruin' ? this.$t('sys.ruin') + (s.type ? ' · ' + this.$name.building(s.type, s.level ?? 0) : '') : s.hero ? this.$name.hero(s.hero) : s.unit ? this.$name.unit(s.unit) : this.$t('foreign.' + (s.entity === 'unit' ? 'serf' : s.entity in { worker: 1, hero: 1, soldier: 1 } ? s.entity : 'unit'));
      return '';
    },
    subtitle() {
      const s = this.sel;
      if (s.kind === 'building') return this.$t('common.levelOf', { n: s.level, max: s.maxLevel }) + (s.profession ? ' · ' + this.$name.prof(s.profession) : '');
      if (s.kind === 'serfs') return this.$t('serfs.idle', { n: s.idle });
      if (s.kind === 'army') return s.heroes.length === 1 && !s.groups.length ? this.$name.heroTitle(s.heroes[0].hero) : this.$t('army.soldiers', { n: s.soldiers });
      if (s.kind === 'foreign') return this.relation;
      return '';
    },
    relation() {
      const o = this.sel?.owner;
      if (o === undefined || o < 0) return '';
      return this.$t('foreign.enemy') + ' · ' + this.$t('common.player', { n: o + 1 });
    },
    ownerStyle() {
      const o = this.sel?.kind === 'foreign' || this.sel?.kind === 'building' ? this.sel.owner : 0;
      return { '--owner': playerColor(o ?? 0) };
    },
  },
};
</script>

<style>
.selcard { display: flex; align-items: flex-end; }
.sc-plaque { width: 16rem; margin-right: -2.75rem; padding: 0.625rem 3.25rem 0.625rem 0.875rem; border-radius: var(--r-lg) 0 0 var(--r-lg); display: flex; flex-direction: column; gap: 0.4375rem; }
.sc-title { display: flex; flex-direction: column; gap: 0.0625rem; min-width: 0; }
.sc-title b { font-family: var(--display); color: var(--gold-200); font-size: var(--fs-lg); line-height: 1.1; text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.sc-title small { color: var(--ink-muted); font-size: var(--fs-xs); }
.sc-rows { display: grid; grid-template-columns: 1fr 1fr; gap: 0.25rem 0.5rem; font-size: var(--fs-sm); }
.sc-rows span { display: inline-flex; align-items: center; gap: 0.3125rem; white-space: nowrap; }
.sc-rows .ico { width: 1rem; height: 1rem; }
.sc-plaque .sstats { font-size: var(--fs-xs); }
.sc-plaque .ss-row { grid-template-columns: 5.25rem 1fr auto; gap: 0.375rem; }
.sc-plaque .ss-row b { min-width: 2.75rem; }
.sc-hint { margin: 0; color: var(--ink-muted); font-size: var(--fs-xs); }
.sc-portrait { position: relative; z-index: 1; flex: none; width: var(--portrait, 7.25rem); height: var(--portrait, 7.25rem); border-radius: 50%; padding: 0.375rem; background: var(--brass); box-shadow: 0 0 0 2px var(--wood-950), 0 8px 18px rgba(0, 0, 0, 0.55); }
.sc-pic { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; display: grid; place-items: center; background: var(--tile-bg); box-shadow: inset 0 0 0 2px var(--wood-950), inset 0 -0.3125rem 0 var(--owner, var(--royal)); }
.sc-pic img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* Ring and owner colour also above the painted portrait (the image would otherwise cover the inner shadows) */
.sc-pic { position: relative; }
.sc-pic::after { content: ''; position: absolute; inset: 0; border-radius: 50%; box-shadow: inherit; pointer-events: none; }
.sc-pic .ico { width: 64%; height: 64%; }
.sc-badge { position: absolute; bottom: -0.3125rem; left: 50%; transform: translateX(-50%); padding: 0 0.5rem; border-radius: 0.625rem; background: var(--wood-850); color: var(--gold-200); font: 800 var(--fs-xs)/1.25rem var(--body); box-shadow: 0 0 0 2px var(--gold-600), 0 0 0 3px var(--wood-950); white-space: nowrap; }
button.coin.sc-close { position: absolute; top: -0.25rem; right: -0.25rem; width: 1.875rem; height: 1.875rem; min-width: 1.875rem; min-height: 1.875rem; }
button.coin.sc-close .ico { width: 0.875rem; height: 0.875rem; }
</style>
