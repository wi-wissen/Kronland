<template>
  <div v-if="tip.data" ref="box" class="tooltip parchment" :style="pos" role="tooltip" data-testid="tooltip">
    <b v-if="tip.data.title" class="tt-title">{{ tip.data.title }}</b>
    <p v-if="tip.data.text" class="tt-text">{{ tip.data.text }}</p>
    <dl v-if="tip.data.lines?.length" class="tt-lines">
      <template v-for="(l, i) in tip.data.lines" :key="i">
        <dt>
          <Icon v-if="l[2]" :name="l[2]" />{{ l[0] }}
        </dt>
        <dd class="num">{{ l[1] }}</dd>
      </template>
    </dl>
    <CostList v-if="tip.data.cost?.length" class="tt-cost" :cost="tip.data.cost" :have="tip.data.have" light />
    <p v-if="tip.data.reason" class="tt-reason"><Icon name="lock" />{{ tip.data.reason }}</p>
    <p v-if="tip.data.key && !touch" class="tt-key"><kbd>{{ tip.data.key }}</kbd></p>
  </div>
</template>

<script>
import { tip } from './tooltip.js';
import CostList from './CostList.vue';

export default {
  name: 'Tooltip',
  components: { CostList },
  props: { touch: Boolean },
  data() { return { tip, size: { w: 220, h: 60 } }; },
  computed: {
    pos() {
      const r = this.tip.rect;
      if (!r) return {};
      const vw = window.innerWidth, vh = window.innerHeight, m = 8;
      const { w, h } = this.size;
      let left = r.left + r.width / 2 - w / 2;
      left = Math.max(m, Math.min(vw - w - m, left));
      // Above the element, otherwise below
      let top = r.top - h - 8;
      if (top < m) top = Math.min(vh - h - m, r.bottom + 8);
      return { left: `${left}px`, top: `${top}px` };
    },
  },
  updated() { this.measure(); },
  methods: {
    measure() {
      const b = this.$refs.box;
      if (!b) return;
      const w = b.offsetWidth, h = b.offsetHeight;
      if (Math.abs(w - this.size.w) > 1 || Math.abs(h - this.size.h) > 1) this.size = { w, h };
    },
  },
};
</script>

<style>
.tooltip {
  position: fixed; z-index: 60; pointer-events: none; max-width: min(19rem, calc(100vw - 16px));
  padding: 0.5rem 0.6875rem 0.5625rem; font-size: var(--fs-sm); line-height: 1.35;
  display: flex; flex-direction: column; gap: 0.25rem;
  animation: tt-in 0.12s ease-out;
}
@keyframes tt-in { from { opacity: 0; transform: translateY(3px); } }
.tt-title { font-family: var(--display); font-size: var(--fs-md); color: #4a2c0d; }
.tt-text { margin: 0; color: var(--parch-ink); }
.tt-lines { margin: 0; display: grid; grid-template-columns: 1fr auto; gap: 0.125rem 0.875rem; }
.tt-lines dt { color: var(--parch-ink-muted); display: flex; align-items: center; gap: 0.3125rem; }
.tt-lines dt .ico { width: 1rem; height: 1rem; }
.tt-lines dd { margin: 0; font-weight: 700; text-align: right; }
.tt-reason { margin: 0.125rem 0 0; color: #9a2a17; font-weight: 700; display: flex; align-items: center; gap: 0.3125rem; }
.tt-reason .ico { width: 0.9375rem; height: 0.9375rem; }
.tt-key { margin: 0.125rem 0 0; }
</style>
