<template>
  <div class="buildmenu" data-testid="build-menu">
    <div class="bm-tabs" role="tablist" :aria-label="$t('build.title')">
      <button
        v-for="(c, i) in categories"
        :key="c.id"
        v-tip="{ title: $t('build.cat.' + c.id), key: touch ? null : String(i + 1) }"
        role="tab"
        class="bm-tab"
        :class="{ active: cat === c.id }"
        :aria-selected="cat === c.id"
        :aria-label="$t('build.cat.' + c.id)"
        :data-testid="'build-cat-' + c.id"
        @click="cat = c.id"
      >
        <Icon :name="'cat-' + c.id" />
        <span class="bm-tablabel">{{ $t('build.cat.' + c.id + 'Short') }}</span>
        <i v-if="c.available" class="bm-badge num" aria-hidden="true">{{ c.available }}</i>
      </button>
    </div>
    <div class="bm-grid scroll-y" role="tabpanel" :aria-label="$t('build.cat.' + cat)">
      <button
        v-for="b in visible"
        :key="b.type"
        v-tip="tipFor(b)"
        class="bm-item"
        :class="{ locked: !!b.reason, tech: b.reason && b.requires && reasonCode(b) === 'err.techMissing' }"
        :aria-disabled="!!b.reason"
        :aria-label="$name.building(b.type) + (b.reason ? ' – ' + $reason(b.reason) : '')"
        :data-testid="'build-' + b.type"
        @click="pick(b)"
      >
        <span class="bm-icon"><Icon :name="'b-' + b.type" /><Icon v-if="b.reason" class="bm-lock" name="lock" /></span>
        <span class="bm-text">
          <span class="bm-name">{{ $name.building(b.type) }}</span>
          <span v-if="reasonCode(b) === 'err.techMissing'" class="bm-req">{{ $reason(b.reason) }}</span>
          <CostList v-else :cost="b.cost" :have="have" />
        </span>
      </button>
    </div>
  </div>
</template>

<script>
import { BUILD_CATEGORIES } from '../../game/Engine.js';
import CostList from '../CostList.vue';

export default {
  name: 'BuildMenu',
  components: { CostList },
  props: {
    options: { type: Array, required: true },
    have: { type: Object, required: true },
    touch: Boolean,
    /** Controls the tutorial is currently pointing at (data-testids) */
    hint: { type: Array, default: () => [] },
  },
  emits: ['build'],
  data() {
    let cat = 'home';
    try { cat = sessionStorage.getItem('kronland-buildcat') || 'home'; } catch { /* egal */ }
    return { cat: BUILD_CATEGORIES.includes(cat) ? cat : 'home' };
  },
  computed: {
    categories() {
      return BUILD_CATEGORIES.map((id) => ({ id, available: this.options.filter((o) => o.category === id && !o.reason).length }));
    },
    visible() { return this.options.filter((o) => o.category === this.cat); },
  },
  watch: {
    cat(v) { try { sessionStorage.setItem('kronland-buildcat', v); } catch { /* egal */ } },
    // Tutorial points at a building in another tab: switch to it
    hint: {
      immediate: true,
      handler(ids) {
        for (const id of ids ?? []) {
          const o = id.startsWith('build-') && this.options.find((x) => 'build-' + x.type === id);
          if (o) { this.cat = o.category; return; }
        }
      },
    },
  },
  mounted() {
    this.onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= BUILD_CATEGORIES.length) this.cat = BUILD_CATEGORIES[n - 1];
    };
    window.addEventListener('keydown', this.onKey);
  },
  beforeUnmount() { window.removeEventListener('keydown', this.onKey); },
  methods: {
    reasonCode(b) { return !b.reason ? null : typeof b.reason === 'string' ? b.reason : b.reason.code; },
    pick(b) { if (!b.reason) this.$emit('build', b.type); },
    tipFor(b) {
      return {
        title: this.$name.building(b.type),
        text: this.$t('bdesc.' + b.type),
        cost: b.cost, have: this.have,
        reason: b.reason ? this.$reason(b.reason) : null,
      };
    },
  },
};
</script>

<style>
.buildmenu { display: flex; flex-direction: column; gap: 0.5rem; min-height: 0; flex: 1; }
.bm-tabs { display: flex; gap: 0.25rem; padding: 3px; border-radius: var(--r-md); background: var(--inset-bg); box-shadow: var(--inset-edge); flex: none; }
.bm-tab {
  position: relative; flex: 1 1 0; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem;
  min-height: 2.5rem; padding: 0.25rem 0.375rem; border-radius: 0.375rem;
  background: transparent; border-color: transparent; box-shadow: none; color: var(--ink-muted); font-size: var(--fs-sm); font-weight: 700;
}
.bm-tab:hover { color: var(--ink); background: rgba(255, 225, 170, 0.06); filter: none !important; }
.bm-tab .ico { width: 1.5rem; height: 1.5rem; filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5)); opacity: 0.85; }
.bm-tab.active { color: var(--gold-100); background: linear-gradient(180deg, rgba(243, 200, 94, 0.28), rgba(196, 141, 42, 0.12)); box-shadow: inset 0 0 0 1px var(--gold-500); }
.bm-tab.active .ico { opacity: 1; }
.bm-tablabel { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bm-badge {
  position: absolute; top: 2px; right: 3px; font-style: normal; font-size: 0.625rem; line-height: 1; padding: 2px 4px; border-radius: 1rem;
  background: var(--good-deep); color: #eaffde; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
}
.bm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(11.5rem, 1fr)); gap: 0.375rem; align-content: start; min-height: 0; padding: 1px 2px 2px; }
.bm-item {
  display: flex; align-items: center; gap: 0.5rem; text-align: left; padding: 0.3125rem 0.5rem 0.3125rem 0.3125rem; min-height: 3.25rem;
}
.bm-icon { position: relative; flex: none; width: 2.625rem; height: 2.625rem; display: grid; place-items: center; border-radius: 0.375rem; background: radial-gradient(circle at 50% 35%, #fbf1d6, #dcc290); box-shadow: inset 0 0 0 1px rgba(90, 60, 20, 0.45), 0 1px 2px rgba(0, 0, 0, 0.4); }
.bm-icon > .ico { width: 2.125rem; height: 2.125rem; }
.bm-lock { position: absolute; right: -4px; bottom: -4px; width: 1rem !important; height: 1rem !important; color: var(--parch-50); background: var(--wood-800); border-radius: 50%; padding: 2px; box-shadow: 0 0 0 1px var(--wood-950); }
.bm-text { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; }
.bm-name { font-weight: 700; line-height: 1.15; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bm-req { font-size: var(--fs-xs); color: var(--ink-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bm-item.locked { filter: none !important; }
.bm-item.locked .bm-icon { filter: grayscale(0.85) brightness(0.8); }
.bm-item.locked .bm-name { color: var(--ink-muted); }
.bm-item.tech .bm-icon { opacity: 0.6; }
@media (max-width: 760px), (max-height: 480px) and (orientation: landscape) {
  .bm-tablabel { display: none; }
  .bm-tab { min-height: var(--touch); }
  .bm-grid { grid-template-columns: repeat(auto-fill, minmax(9.75rem, 1fr)); }
  .bm-item { min-height: var(--touch); }
}
</style>
