<template>
  <!-- Build menu without tabs: all groups at a glance, each tile with a name.
       Desktop: groups wrap into new rows when space is short; below them a detail row (cost, text).
       Narrow/phone: groups in a horizontally swipeable row, jump marks above. -->
  <div class="buildmenu" :class="{ row: compact }" data-testid="build-menu">
    <nav v-if="compact" class="bm-chips" :aria-label="$t('build.title')">
      <button
        v-for="g in groups"
        :key="g.id"
        v-tip="$t('build.cat.' + g.id)"
        class="bm-chip"
        :class="{ active: cat === g.id }"
        :aria-current="cat === g.id ? 'true' : null"
        :data-testid="'build-cat-' + g.id"
        @click="jump(g.id)"
      ><Icon :name="'cat-' + g.id" /><span>{{ $t('build.cat.' + g.id + 'Short') }}</span></button>
    </nav>
    <div ref="scroller" class="bm-groups" @scroll.passive="onScroll" @wheel="onWheel" @pointerleave="$emit('preview', null)">
      <section v-for="g in groups" :key="g.id" class="bm-grp" :data-cat="g.id" :data-testid="'build-group-' + g.id">
        <h4 class="bm-ghead"><Icon :name="'cat-' + g.id" />{{ $t('build.cat.' + g.id + 'Short') }}</h4>
        <div class="bm-tiles">
          <button
            v-for="b in g.items"
            :key="b.type"
            v-tip="tipFor(b)"
            class="bm-tile"
            :class="{ locked: isTech(b), poor: b.reason && !isTech(b), hint: hint.includes('build-' + b.type) }"
            :aria-disabled="!!b.reason"
            :aria-label="$name.building(b.type) + (b.reason ? ' – ' + $reason(b.reason) : '')"
            :data-testid="'build-' + b.type"
            @click="pick(b)"
            @pointerenter="preview(b)"
            @focus="preview(b)"
          >
            <Icon :name="'b-' + b.type" />
            <span class="bm-name">{{ label(b.type) }}</span>
            <Icon v-if="isTech(b)" class="bm-lock" name="lock" />
          </button>
        </div>
      </section>
    </div>
    <!-- Detail row (mouse only: on phones a long press shows the same as a tooltip) -->
    <div v-if="!touch && shown" class="bm-detail" data-testid="build-detail">
      <b>{{ $name.building(shown.type) }}</b>
      <span v-if="isTech(shown)" class="bm-req"><Icon name="lock" />{{ $reason(shown.reason) }}</span>
      <CostList v-else :cost="shown.cost" :have="have" />
      <span class="bm-desc">{{ $t('bdesc.' + shown.type) }}</span>
    </div>
  </div>
</template>

<script>
import { BUILD_CATEGORIES } from '../../game/Engine.js';
import CostList from '../CostList.vue';
import { groupBuildOptions, softHyphens } from './hudLayout.js';

export default {
  name: 'BuildMenu',
  components: { CostList },
  props: {
    options: { type: Array, required: true },
    have: { type: Object, required: true },
    touch: Boolean,
    /** Narrow layout: one swipeable row with jump marks */
    compact: Boolean,
    /** Controls the tutorial is currently pointing at (data-testids) */
    hint: { type: Array, default: () => [] },
  },
  emits: ['build', 'preview'],
  data() { return { cat: BUILD_CATEGORIES[0], hover: null }; },
  computed: {
    groups() { return groupBuildOptions(this.options, BUILD_CATEGORIES); },
    /** Building in the detail row: last hovered, otherwise the first buildable */
    shown() {
      return this.options.find((o) => o.type === this.hover) ?? this.options.find((o) => !o.reason) ?? this.options[0] ?? null;
    },
  },
  watch: {
    // Tutorial points at a building: bring it into view (narrow row)
    hint: { immediate: true, handler() { this.$nextTick(() => this.showHint()); } },
    compact() { this.$nextTick(() => this.showHint()); },
  },
  beforeUnmount() { this.$emit('preview', null); },
  methods: {
    reasonCode(b) { return !b?.reason ? null : typeof b.reason === 'string' ? b.reason : b.reason.code; },
    /** Not yet available: missing tech or later in the campaign (grey with lock) */
    isTech(b) { const c = this.reasonCode(b); return c === 'err.techMissing' || c === 'err.laterInCampaign'; },
    label(type) { return softHyphens(this.$name.building(type)); },
    pick(b) { if (!b.reason) this.$emit('build', b.type); },
    preview(b) {
      this.hover = b.type;
      this.$emit('preview', b.reason && this.isTech(b) ? null : b.cost);
    },
    tipFor(b) {
      return {
        title: this.$name.building(b.type),
        text: this.$t('bdesc.' + b.type),
        cost: b.cost, have: this.have,
        reason: b.reason ? this.$reason(b.reason) : null,
      };
    },
    /** Jump mark: bring the group to the start of the row */
    jump(id) {
      this.cat = id;
      const el = this.$refs.scroller?.querySelector(`[data-cat="${id}"]`);
      if (el) this.$refs.scroller.scrollTo({ left: el.offsetLeft - this.$refs.scroller.offsetLeft, behavior: 'smooth' });
    },
    /** Row: mouse wheel scrolls horizontally */
    onWheel(e) {
      const sc = this.$refs.scroller;
      if (!this.compact || !sc || e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (sc.scrollWidth <= sc.clientWidth) return;
      e.preventDefault();
      sc.scrollLeft += e.deltaY;
    },
    /** While swiping, highlight the jump mark of the visible group */
    onScroll() {
      const sc = this.$refs.scroller;
      if (!sc || !this.compact) return;
      let cur = this.groups[0]?.id;
      for (const el of sc.querySelectorAll('[data-cat]')) if (el.offsetLeft - sc.offsetLeft <= sc.scrollLeft + 8) cur = el.dataset.cat;
      this.cat = cur;
    },
    showHint() {
      const id = this.hint.find((h) => h.startsWith('build-') && this.options.some((o) => 'build-' + o.type === h));
      if (!id || !this.compact) return;
      this.$el?.querySelector?.(`[data-testid="${id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center' });
    },
  },
};
</script>

<style>
.buildmenu { display: flex; flex-direction: column; gap: 0.5rem; flex: none; }
.bm-groups { display: flex; flex-wrap: wrap; gap: 0.5rem 0.875rem; min-height: 0; }
.bm-grp { display: flex; flex-direction: column; gap: 0.3125rem; }
.bm-ghead { margin: 0; display: flex; align-items: center; gap: 0.3125rem; padding-left: 0.125rem; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-dim); white-space: nowrap; }
.bm-ghead .ico { width: 1rem; height: 1rem; }
.bm-tiles { display: grid; grid-auto-flow: column; grid-template-rows: repeat(var(--bm-rows, 2), auto); gap: 0.3125rem; }
/* Somewhat narrower: three tile rows per group so everything fits in one row */
.narrow .buildmenu:not(.row) { --bm-rows: 3; }
/* Tile: calm, flat surface – the icon carries the colour */
.bm-tile {
  position: relative; min-width: 4.75rem; max-width: 6.5rem; min-height: 4.5rem; padding: 0.3125rem 0.1875rem; border: 0; border-radius: var(--r-md);
  display: flex; flex-direction: column; align-items: center; gap: 0.125rem;
  background: var(--tile-bg); color: var(--parch-ink); box-shadow: var(--tile-edge), 0 2px 0 var(--wood-950), 0 3px 6px rgba(0, 0, 0, 0.3);
}
.bm-tile > .ico { width: 2.375rem; height: 2.375rem; }
.bm-name { font-size: 0.6875rem; font-weight: 700; line-height: 1.1; text-align: center; hyphens: manual; max-width: 100%; }
.bm-tile:hover:not([aria-disabled='true']), .bm-tile:focus-visible { filter: none; box-shadow: inset 0 0 0 2px var(--gold-400), 0 2px 0 var(--wood-950), 0 0 12px rgba(243, 200, 94, 0.5); }
/* Too expensive: red dot; not yet researched: grey with lock */
.bm-tile.poor { filter: none !important; cursor: not-allowed; }
.bm-tile.poor::after { content: ''; position: absolute; top: 0.25rem; right: 0.25rem; width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--bad); box-shadow: 0 0 0 1.5px var(--wood-950); }
.bm-tile.locked { filter: none !important; background: #a6977b; }
.bm-tile.locked > .ico:not(.bm-lock) { filter: grayscale(1) brightness(0.8); opacity: 0.7; }
.bm-tile.locked .bm-name { color: #2e2418; }
.bm-lock { position: absolute; top: 0.1875rem; right: 0.1875rem; width: 1rem !important; height: 1rem !important; color: var(--parch-50); background: var(--wood-800); border-radius: 50%; padding: 2px; box-shadow: 0 0 0 1px var(--wood-950); }
.bm-tile.hint { box-shadow: inset 0 0 0 2px var(--gold-300), 0 0 0 2px var(--gold-300), 0 0 16px rgba(243, 200, 94, 0.8); }

.bm-detail { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.75rem; padding: 0.375rem 0.5rem; border-radius: var(--r-md); background: var(--inset-bg); box-shadow: var(--inset-edge); font-size: var(--fs-sm); min-height: 2.5rem; }
.bm-detail b { font-family: var(--display); color: var(--gold-200); font-size: var(--fs-md); white-space: nowrap; }
.bm-req { display: inline-flex; align-items: center; gap: 0.25rem; color: var(--ink-dim); }
.bm-req .ico { width: 0.875rem; height: 0.875rem; }
.bm-desc { color: var(--ink-muted); flex: 1 1 14rem; min-width: 0; }

/* Narrow layout: swipeable row */
.bm-chips { display: flex; gap: 0.375rem; overflow-x: auto; scrollbar-width: none; flex: none; }
.bm-chip { flex: none; display: inline-flex; align-items: center; gap: 0.25rem; min-height: 2rem; padding: 0.25rem 0.625rem; border-radius: 1rem; font-size: var(--fs-xs); font-weight: 700; color: var(--ink-muted); background: var(--inset-bg); border: 0; box-shadow: inset 0 0 0 1px rgba(225, 168, 58, 0.25); }
.bm-chip .ico { width: 1rem; height: 1rem; }
.bm-chip.active { color: var(--gold-200); box-shadow: inset 0 0 0 1px var(--gold-400); }
.buildmenu.row .bm-groups { flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden; overscroll-behavior: contain; scroll-snap-type: x proximity; scrollbar-width: none; padding-bottom: 0.125rem; }
.buildmenu.row .bm-grp { scroll-snap-align: start; }
.buildmenu.row .bm-tile { min-width: 4.375rem; }
.mid .bm-tile { min-width: 4.375rem; }
</style>
