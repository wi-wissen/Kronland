<template>
  <!-- Build menu. Wide: all groups side by side, two tile rows each. If they do not fit (medium widths, phone):
       one tab per group, below only its buildings; the last tab is remembered (setting serfBuildTab).
       Details of a building (cost, build time, staff, lock reason) show in the info strip above the panel:
       mouse hover or keyboard focus, on touch a long press (a tap places as usual). -->
  <div class="buildmenu" :class="layout" data-testid="build-menu" :data-layout="layout" >
    <div v-if="layout === 'tabs'" class="bm-tabs" role="tablist" :aria-label="$t('build.title')">
      <button
        v-for="g in groups"
        :key="g.id"
        role="tab"
        class="bm-tab"
        :class="{ active: g.id === activeTab }"
        :aria-selected="g.id === activeTab"
        :data-hint-for="g.id === activeTab ? null : g.items.map((b) => 'build-' + b.type).join(' ')"
        :data-testid="'build-tab-' + g.id"
        @click="setTab(g.id)"
      ><Icon :name="'cat-' + g.id" /><span>{{ $t('build.cat.' + g.id + (compact || mid ? 'Short' : '')) }}</span></button>
    </div>
    <div ref="scroller" class="bm-groups" @pointerleave="leave">
      <section v-for="g in shownGroups" :key="g.id" class="bm-grp" :data-cat="g.id" :data-testid="'build-group-' + g.id" :role="layout === 'tabs' ? 'tabpanel' : null">
        <h4 v-if="layout !== 'tabs'" class="bm-ghead"><Icon :name="'cat-' + g.id" />{{ $t('build.cat.' + g.id + 'Short') }}</h4>
        <div class="bm-tiles">
          <button
            v-for="b in g.items"
            :key="b.type"
            class="bm-tile"
            :class="{ locked: isTech(b), poor: b.reason && !isTech(b), hint: hint.includes('build-' + b.type), info: info === b.type }"
            :aria-disabled="!!b.reason"
            :aria-label="$name.building(b.type) + (b.reason ? ' – ' + $reason(b.reason) : '')"
            :data-testid="'build-' + b.type"
            @click.capture="swallow"
            @click="pick(b)"
            @pointerenter="enter(b, $event)"
            @pointerleave="tileLeave($event)"
            @pointerdown="down(b, $event)"
            @pointermove="lp.move({ x: $event.clientX, y: $event.clientY })"
            @pointerup="up"
            @pointercancel="cancel"
            @contextmenu="onMenu"
            @focus="focus(b, $event)"
            @blur="show(null)"
          >
            <Icon :name="'b-' + b.type" />
            <span class="bm-name">{{ label(b.type) }}</span>
            <Icon v-if="isTech(b)" class="bm-lock" name="lock" />
          </button>
        </div>
      </section>
    </div>
    <p v-if="touch && hints" class="bm-swipe" data-testid="build-touch-hint">{{ $t('build.touchHint') }}</p>
  </div>
</template>

<script>
import { BUILD_CATEGORIES } from '../../game/Engine.js';
import { groupBuildOptions, softHyphens, groupsWrap, buildMenuLayout } from './hudLayout.js';
import { reasonCode } from './buildInfo.js';
import { createLongPress } from '../tooltip.js';
import { settings, set as setSetting } from '../settings.js';

export default {
  name: 'BuildMenu',
  props: {
    options: { type: Array, required: true },
    have: { type: Object, required: true },
    touch: Boolean,
    /** Phone: always tabs, tab labels stacked under the icon */
    compact: Boolean,
    /** Medium desktop width: short tab labels */
    mid: Boolean,
    /** Short help line on touch screens */
    hints: { type: Boolean, default: true },
    /** Controls the tutorial is currently pointing at (data-testids) */
    hint: { type: Array, default: () => [] },
  },
  // info: { type } of the building whose details the info strip shows, or null
  emits: ['build', 'preview', 'info'],
  data() { return { info: null, wraps: null }; },
  computed: {
    groups() { return groupBuildOptions(this.options, BUILD_CATEGORIES); },
    layout() { return buildMenuLayout({ compact: this.compact, wraps: this.wraps }); },
    activeTab() { return this.groups.some((g) => g.id === settings.serfBuildTab) ? settings.serfBuildTab : this.groups[0]?.id; },
    shownGroups() { return this.layout === 'tabs' ? this.groups.filter((g) => g.id === this.activeTab) : this.groups; },
    /** Changes that alter the tile widths: measure the two-row layout again */
    measureKey() { return [this.options.length, settings.uiScale, this.$i18n.lang, this.compact].join('|'); },
  },
  watch: {
    measureKey() { this.remeasure(); },
  },
  created() {
    // Touch: long press shows the info strip while the finger stays down; the click afterwards is swallowed
    this.lp = createLongPress({ onFire: () => { if (this.pressed) this.show(this.pressed.b); try { navigator.vibrate?.(15); } catch { /* never mind */ } } });
    this.pressed = null;
  },
  mounted() {
    // Measure again when the width of the command bar changes (window, split screen, UI size) – after layout,
    // so App.vue's width classes are in place; height changes (our own switch) are ignored
    const bar = this.$el.closest?.('.cmdbar');
    this.barW = bar?.clientWidth ?? 0;
    this.onResize = () => {
      const w = bar?.clientWidth ?? 0;
      if (w === this.barW) return;
      this.barW = w;
      this.remeasure();
    };
    if (bar && typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(this.onResize); this.ro.observe(bar); }
    this.remeasure();
  },
  beforeUnmount() {
    this.ro?.disconnect();
    this.lp.cancel(); this.$emit('preview', null); this.$emit('info', null);
  },
  methods: {
    isTech(b) { return reasonCode(b?.reason) === 'err.techMissing'; },
    label(type) { return softHyphens(this.$name.building(type)); },
    setTab(id) { this.show(null); setSetting('serfBuildTab', id); },
    /**
     * Render the two-row layout (Vue flushes before the browser paints, so it never shows), check whether its
     * groups wrap into a further line in the space the panel gets, then decide between wide and tabs.
     */
    remeasure() {
      if (this.compact) return;
      this.wraps = null;
      this.$nextTick(() => {
        const sc = this.$refs.scroller;
        if (!sc || this.wraps !== null || this.layout !== 'wide') return;
        this.wraps = groupsWrap([...sc.querySelectorAll('.bm-grp')].map((el) => el.getBoundingClientRect().top));
      });
    },
    /** Click: place (hides the info strip); a locked or too expensive tile keeps its info, which says why */
    pick(b) {
      if (b.reason) return;
      this.show(null);
      this.$emit('build', b.type);
    },
    /** Show the info strip for a tile (null hides it) */
    show(b) {
      const type = b?.type ?? null;
      if (type === this.info && type) return;
      this.info = type;
      this.$emit('info', type ? { type } : null);
    },
    enter(b, e) {
      this.$emit('preview', b.reason && this.isTech(b) ? null : b.cost);
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') this.show(b);
    },
    tileLeave(e) { if (e.pointerType !== 'touch') this.show(null); },
    leave() { this.$emit('preview', null); this.show(null); },
    focus(b, e) { if (e.currentTarget.matches(':focus-visible')) this.show(b); },
    down(b, e) {
      if (e.pointerType === 'mouse') return;
      this.pressed = { b };
      this.lp.down({ x: e.clientX, y: e.clientY });
    },
    /** Releasing the finger hides the info strip again */
    up() { this.lp.up(); this.pressed = null; if (this.lp.fired) this.show(null); },
    cancel() { this.lp.cancel(); this.pressed = null; this.show(null); },
    swallow(e) { if (this.lp.consumeClick()) { e.preventDefault(); e.stopImmediatePropagation(); } },
    // Otherwise Android opens the context menu on long press
    onMenu(e) { if (e.pointerType !== 'mouse') e.preventDefault(); },
  },
};
</script>

<style>
.buildmenu { display: flex; flex-direction: column; gap: 0.375rem; flex: none; }
.bm-groups { display: flex; flex-wrap: wrap; gap: 0.5rem 0.875rem; min-height: 0; }
.bm-grp { display: flex; flex-direction: column; gap: 0.3125rem; }
.bm-ghead { margin: 0; display: flex; align-items: center; gap: 0.3125rem; padding-left: 0.125rem; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-dim); white-space: nowrap; }
.bm-ghead .ico { width: 1rem; height: 1rem; }
.bm-tiles { display: grid; grid-auto-flow: column; grid-template-rows: repeat(2, auto); gap: 0.3125rem; }
/* Tile: calm, flat surface – the icon carries the colour */
.bm-tile {
  position: relative; min-width: 4.75rem; max-width: 6.5rem; min-height: 4.5rem; padding: 0.3125rem 0.1875rem; border: 0; border-radius: var(--r-md);
  display: flex; flex-direction: column; align-items: center; gap: 0.125rem;
  background: var(--tile-bg); color: var(--parch-ink); box-shadow: var(--tile-edge), 0 2px 0 var(--wood-950), 0 3px 6px rgba(0, 0, 0, 0.3);
  -webkit-touch-callout: none; user-select: none; -webkit-user-select: none;
}
.bm-tile > .ico { width: 2.375rem; height: 2.375rem; }
.bm-name { font-size: 0.6875rem; font-weight: 700; line-height: 1.1; text-align: center; hyphens: manual; max-width: 100%; }
.bm-tile:hover:not([aria-disabled='true']), .bm-tile:focus-visible, .bm-tile.info { filter: none; box-shadow: inset 0 0 0 2px var(--gold-400), 0 2px 0 var(--wood-950), 0 0 12px rgba(243, 200, 94, 0.5); }
.bm-tile.locked.info { box-shadow: inset 0 0 0 2px var(--gold-400), 0 2px 0 var(--wood-950); }
/* Too expensive: red dot; not yet researched: grey with lock */
.bm-tile.poor { filter: none !important; cursor: not-allowed; }
.bm-tile.poor::after { content: ''; position: absolute; top: 0.25rem; right: 0.25rem; width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--bad); box-shadow: 0 0 0 1.5px var(--wood-950); }
.bm-tile.locked { filter: none !important; background: #a6977b; }
.bm-tile.locked > .ico:not(.bm-lock) { filter: grayscale(1) brightness(0.8); opacity: 0.7; }
.bm-tile.locked .bm-name { color: #2e2418; }
.bm-lock { position: absolute; top: 0.1875rem; right: 0.1875rem; width: 1rem !important; height: 1rem !important; color: var(--parch-50); background: var(--wood-800); border-radius: 50%; padding: 2px; box-shadow: 0 0 0 1px var(--wood-950); }
.bm-tile.hint { box-shadow: inset 0 0 0 2px var(--gold-300), 0 0 0 2px var(--gold-300), 0 0 16px rgba(243, 200, 94, 0.8); }

/* Tabs: a row of category tabs; the active one is filled gold and joins the tile area below,
   the others stay dark – the selection is unmistakable */
.bm-tabs { display: flex; gap: 0.25rem; overflow-x: auto; scrollbar-width: none; border-bottom: 2px solid var(--gold-400); flex: none; }
.bm-tab {
  flex: none; display: inline-flex; align-items: center; gap: 0.375rem; min-height: 2.25rem; padding: 0.25rem 0.75rem; margin-bottom: -2px;
  border: 0; border-radius: var(--r-md) var(--r-md) 0 0; font-size: var(--fs-sm); font-weight: 700; color: var(--ink-dim);
  background: rgba(10, 6, 3, 0.35); box-shadow: inset 0 1px 0 rgba(225, 168, 58, 0.18), inset 1px 0 0 rgba(225, 168, 58, 0.12), inset -1px 0 0 rgba(225, 168, 58, 0.12);
}
.bm-tab .ico { width: 1.25rem; height: 1.25rem; opacity: 0.7; }
.bm-tab:hover:not(.active) { color: var(--ink); background: rgba(10, 6, 3, 0.2); filter: none; }
.bm-tab.active {
  color: var(--wood-950); background: linear-gradient(180deg, var(--gold-200), var(--gold-400));
  box-shadow: inset 0 0 0 1px var(--gold-100), 0 -2px 8px rgba(243, 200, 94, 0.35);
}
.bm-tab.active .ico { opacity: 1; }
.buildmenu.tabs .bm-grp { width: 100%; }
.buildmenu.tabs .bm-tiles { display: flex; flex-wrap: wrap; }
/* Phone: tabs fill the width as five equal columns, icon above the short name */
.compact .buildmenu.tabs .bm-tabs { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.1875rem; }
.compact .buildmenu.tabs .bm-tab { flex-direction: column; gap: 0.125rem; min-height: 2.875rem; padding: 0.25rem 0.125rem; font-size: 0.625rem; letter-spacing: 0.01em; justify-content: center; min-width: 0; }
.compact .buildmenu.tabs .bm-tab span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Phone: two tile rows high so switching tabs does not make the panel jump */
.compact .buildmenu.tabs .bm-tiles { gap: 0.3125rem; min-height: calc(2 * 4.375rem + 0.3125rem); align-content: flex-start; }
.compact .buildmenu.tabs .bm-tile { width: 4.5rem; min-width: 0; min-height: 4.375rem; }
.compact .buildmenu.tabs .bm-tile > .ico { width: 2.25rem; height: 2.25rem; }
.bm-swipe { margin: 0; font-size: 0.6875rem; color: var(--ink-dim); text-align: right; }
</style>
