<template>
  <!-- Info strip of the build menu: extension of the command panel along its top edge (same width and frame),
       shown while a building tile is hovered (phone: long pressed). The notch points at the tile. -->
  <section class="binfo frame" :style="notch !== null ? { '--notch': notch + 'px' } : null" role="tooltip" data-testid="build-info">
    <div class="bi-main">
      <span class="bi-pic"><Icon :name="'b-' + opt.type" /></span>
      <div class="bi-title">
        <b data-testid="build-info-name">{{ $name.building(opt.type) }}</b>
        <small>{{ $t('binfo.size', { w: opt.w, h: opt.h }) }} · {{ $t('binfo.place.' + opt.placement) }}</small>
      </div>
      <CostList class="bi-cost" :cost="opt.cost" :have="have" />
    </div>
    <p class="bi-desc">{{ $t('bdesc.' + opt.type) }}</p>
    <div class="bi-rows" data-testid="build-info-rows">
      <span v-for="r in rows" :key="r[1]" :data-row="r[1]"><Icon :name="r[0]" />{{ $t(r[1], r[2]) }}</span>
    </div>
    <p v-if="reason" class="bi-reason" :class="{ tech: reason.tech }" data-testid="build-info-reason">
      <Icon :name="reason.tech ? 'lock' : 'warning'" />
      <span>{{ $reason(opt.reason) }}<small v-if="reason.researchAt"> · {{ $t('binfo.researchAt', { building: $name.building(reason.researchAt) }) }}</small></span>
    </p>
  </section>
</template>

<script>
import CostList from '../CostList.vue';
import { buildInfoRows, buildInfoReason } from './buildInfo.js';

export default {
  name: 'BuildInfo',
  components: { CostList },
  props: {
    /** Entry of uiState().buildOptions */
    opt: { type: Object, required: true },
    have: { type: Object, required: true },
    /** x of the notch relative to the strip (px), null = none */
    notch: { type: Number, default: null },
  },
  computed: {
    rows() {
      return buildInfoRows(this.opt).map(([icon, key, p]) => [icon, key, p.prof ? { ...p, prof: this.$name.prof(p.prof) } : p]);
    },
    reason() { return buildInfoReason(this.opt); },
  },
};
</script>

<style>
.binfo {
  position: absolute; left: 0; right: 0; bottom: calc(100% - 6px); z-index: 1; pointer-events: none;
  display: flex; flex-direction: column; gap: 0.3125rem; padding: 0.5rem 0.75rem 0.625rem; border-radius: var(--r-lg) var(--r-lg) 0 0;
  box-shadow: inset 0 0 0 1px rgba(225, 168, 58, 0.38), inset 0 1px 0 1px rgba(255, 225, 170, 0.12), 0 0 0 1px var(--wood-950), 0 -4px 14px rgba(10, 6, 2, 0.35);
}
.binfo::after { content: ''; position: absolute; left: var(--notch, 50%); bottom: -7px; width: 14px; height: 14px; margin-left: -7px; transform: rotate(45deg); background: var(--wood-800); box-shadow: 1px 1px 0 rgba(225, 168, 58, 0.45); }
.bi-main { display: flex; align-items: center; gap: 0.625rem; }
.bi-pic { flex: none; width: 2.5rem; height: 2.5rem; display: grid; place-items: center; border-radius: var(--r-md); background: var(--tile-bg); box-shadow: var(--tile-edge); }
.bi-pic .ico { width: 2.125rem; height: 2.125rem; }
.bi-title { display: flex; flex-direction: column; min-width: 0; }
.bi-title b { font-family: var(--display); color: var(--gold-200); font-size: var(--fs-lg); line-height: 1.1; text-shadow: 0 1px 0 rgba(0, 0, 0, 0.6); }
.bi-title small { color: var(--ink-dim); font-size: var(--fs-xs); }
.bi-cost { margin-left: auto; align-self: flex-start; justify-content: flex-end; }
.bi-desc { margin: 0; color: var(--ink-muted); font-size: var(--fs-sm); line-height: 1.3; }
.bi-rows { display: grid; grid-template-columns: repeat(3, auto); justify-content: start; gap: 0.25rem 1.25rem; font-size: var(--fs-xs); }
.bi-rows span { display: inline-flex; align-items: center; gap: 0.3125rem; white-space: nowrap; }
.bi-rows .ico { width: 1rem; height: 1rem; }
.bi-reason { margin: 0; display: flex; align-items: center; gap: 0.375rem; padding: 0.25rem 0.5rem; border-radius: var(--r-sm); background: rgba(163, 50, 31, 0.28); color: #ffd4c8; font-size: var(--fs-xs); font-weight: 700; }
.bi-reason.tech { background: var(--inset-bg); box-shadow: var(--inset-edge); color: var(--ink); }
.bi-reason small { color: var(--ink-muted); font-weight: 500; font-size: inherit; }
.bi-reason .ico { width: 1rem; height: 1rem; flex: none; }
.cmdbar.compact .binfo { padding: 0.5rem 0.625rem 0.625rem; }
/* Phone: the small portrait of the panel head stays in front of the strip */
.cmdbar.compact .cx-mini { position: relative; z-index: 2; }
.cmdbar.compact .bi-rows { grid-template-columns: 1fr 1fr; font-size: var(--fs-sm); }
</style>
