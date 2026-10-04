<template>
  <aside class="objpanel frame" :class="{ closed: !open }" data-testid="objectives">
    <button class="op-head" :aria-expanded="open" data-testid="objectives-toggle" @click="toggle">
      <Icon name="objective" />
      <span class="op-title">{{ $t('mission.objectives') }}</span>
      <span class="op-count num">{{ doneCount }}/{{ primary.length }}</span>
      <Icon :name="open ? 'chevronUp' : 'chevronDown'" class="op-chev" />
    </button>
    <ul v-if="open" class="op-list scroll-y">
      <li v-for="o in sorted" :key="o.id" :class="['op-' + o.status, { opt: !o.primary }]" :data-testid="'objective-' + o.id">
        <Icon class="op-mark" :name="o.status === 'done' ? 'objectiveDone' : o.status === 'failed' ? 'objectiveFailed' : o.primary ? 'objective' : 'scroll'" />
        <span class="op-text">
          {{ $tr(o.text) }}
          <span v-if="o.progress && o.status === 'active'" class="op-prog">
            <span class="meter"><i :style="{ width: (100 * o.progress[0] / o.progress[1]) + '%' }"></i></span>
            <em class="num">{{ o.time ? clock(o.progress[1] - o.progress[0]) : o.progress[0] + '/' + o.progress[1] }}</em>
          </span>
        </span>
      </li>
    </ul>
  </aside>
</template>

<script>
export default {
  name: 'ObjectivePanel',
  props: {
    objectives: { type: Array, required: true },
    lang: { type: String, default: 'de' },
  },
  data() {
    // Auf kleinen Bildschirmen anfangs eingeklappt
    return { open: typeof window === 'undefined' || (window.innerWidth > 640 && window.innerHeight > 480) };
  },
  computed: {
    primary() { return this.objectives.filter((o) => o.primary); },
    doneCount() { return this.primary.filter((o) => o.status === 'done').length; },
    // Open main goals first, completed ones to the bottom
    sorted() {
      const rank = (o) => (o.status === 'active' ? 0 : o.status === 'failed' ? 1 : 2) * 2 + (o.primary ? 0 : 1);
      return [...this.objectives].sort((a, b) => rank(a) - rank(b));
    },
  },
  watch: {
    // New objective revealed: expand so it is seen
    'objectives.length'(n, o) { if (n > o) this.open = true; },
  },
  methods: {
    toggle() { this.open = !this.open; },
    clock(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; },
  },
};
</script>

<style>
.objpanel { padding: 0; overflow: hidden; display: flex; flex-direction: column; min-height: 0; flex: 0 1 auto; }
.op-head {
  display: flex; align-items: center; gap: 0.5rem; width: 100%; border: none; border-radius: 0; box-shadow: none;
  background: transparent; padding: 0.375rem 0.75rem; min-height: var(--touch); text-align: left;
}
.op-head:hover { background: rgba(255, 225, 170, 0.05); filter: none !important; }
.op-head > .ico { width: 1.25rem; height: 1.25rem; }
.op-title { font-family: var(--display); color: var(--gold-200); font-size: var(--fs-lg); flex: 1; }
.op-count { color: var(--ink-muted); font-size: var(--fs-sm); font-weight: 700; }
.op-chev { width: 1rem !important; height: 1rem !important; color: var(--ink-muted); }
.op-list { list-style: none; margin: 0; padding: 0 0.75rem 0.625rem; display: flex; flex-direction: column; gap: 0.4375rem; min-height: 0; }
.op-list li { display: flex; gap: 0.5rem; align-items: flex-start; font-size: var(--fs-sm); line-height: 1.3; }
.op-mark { flex: none; width: 1.125rem !important; height: 1.125rem !important; }
.op-list li.opt { color: var(--ink-muted); }
.op-done { opacity: 0.65; }
.op-done .op-text { text-decoration: line-through; text-decoration-color: rgba(246, 236, 212, 0.4); }
.op-failed { color: var(--bad); }
.op-text { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; flex: 1; }
.op-prog { display: flex; align-items: center; gap: 0.375rem; }
.op-prog .meter { flex: 1; }
.op-prog em { font-style: normal; font-size: var(--fs-xs); color: var(--gold-200); font-weight: 700; }
</style>
