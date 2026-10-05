<template>
  <!-- Desktop: panel with a header for folding open and shut. Phone (compact): only a small button top left; it opens the
       goals full-screen for reading (teleport to <body>, so nothing from the HUD layer lies above it). -->
  <aside class="objpanel frame" :class="{ closed: !open, chip: compact, fresh: compact && fresh }" data-testid="objectives">
    <button class="op-head" :aria-expanded="open" :aria-haspopup="compact ? 'dialog' : null" data-testid="objectives-toggle" @click="toggle">
      <Icon name="objective" />
      <span class="op-title">{{ $t('mission.objectives') }}</span>
      <span v-if="primary.length" class="op-count num">{{ doneCount }}/{{ primary.length }}</span>
      <Icon v-if="!compact" :name="open ? 'chevronUp' : 'chevronDown'" class="op-chev" />
    </button>
    <Teleport to="body" :disabled="!compact">
      <div v-if="open" :class="compact ? 'op-scrim' : 'op-inline'" @click.self="open = false">
        <div
          :class="compact ? 'op-sheet frame' : 'op-inline'"
          :role="compact ? 'dialog' : null"
          :aria-modal="compact ? 'true' : null"
          :aria-label="compact ? $t('mission.objectives') : null"
          :data-testid="compact ? 'objectives-sheet' : null"
        >
          <header v-if="compact" class="op-sheethead">
            <Icon name="objective" />
            <h2 class="op-title">{{ $t('mission.objectives') }}</h2>
            <span v-if="primary.length" class="op-count num">{{ doneCount }}/{{ primary.length }}</span>
            <button class="icon-btn ghost op-close" :aria-label="$t('common.close')" data-testid="objectives-close" @click="open = false"><Icon name="close" /></button>
          </header>
          <ul class="op-list scroll-y">
            <li v-for="o in sorted" :key="o.id" :class="['op-' + o.status, { opt: !o.primary }]" :data-testid="'objective-' + o.id">
              <Icon class="op-mark" :name="o.status === 'done' ? 'objectiveDone' : o.status === 'failed' ? 'objectiveFailed' : o.primary ? 'objective' : 'scroll'" />
              <span class="op-text">
                {{ $tr(o.text) }}
                <span v-if="o.progress && o.status === 'active'" class="op-prog">
                  <span class="meter"><i :style="{ width: (100 * o.progress[0] / o.progress[1]) + '%' }"></i></span>
                  <em class="num">{{ o.time ? clock(o.progress[1] - o.progress[0]) : o.progress[0] + '/' + o.progress[1] }}</em>
                </span>
              </span>
              <button v-if="o.hint && (o.hint.entity || o.hint.area)" class="icon-btn ghost op-go" :aria-label="$t('mission.showGoal')" :title="$t('mission.showGoal')" :data-testid="'objective-go-' + o.id" @click="go(o)"><Icon name="target" /></button>
            </li>
          </ul>
        </div>
      </div>
    </Teleport>
  </aside>
</template>

<script>
export default {
  name: 'ObjectivePanel',
  props: {
    objectives: { type: Array, required: true },
    lang: { type: String, default: 'de' },
    /** Phone/narrow: button instead of panel, goals full-screen */
    compact: Boolean,
  },
  emits: ['focus'],
  data() {
    // Phone: closed at first (only the button); desktop: open
    return { open: !this.compact, fresh: false };
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
    // New goal revealed: desktop unfolds, the phone lets the button glow (instead of covering the view)
    'objectives.length'(n, o) {
      if (n <= o) return;
      if (this.compact) this.fresh = true;
      else this.open = true;
    },
    // Switching phone ↔ desktop (rotating, window size): do not suddenly open the view full-screen
    compact(v) { this.open = !v; },
    open(v) { if (v) this.fresh = false; },
  },
  mounted() {
    // Esc closes the full-screen view (before the game menu)
    this.onKey = (e) => { if (e.key === 'Escape' && this.compact && this.open) { e.stopPropagation(); this.open = false; } };
    window.addEventListener('keydown', this.onKey, true);
  },
  beforeUnmount() { window.removeEventListener('keydown', this.onKey, true); },
  methods: {
    toggle() { this.open = !this.open; },
    /** Camera to the goal; on phones close the view so the place lies free. */
    go(o) {
      this.$emit('focus', o.hint);
      if (this.compact) this.open = false;
    },
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
.op-go { flex: none; width: var(--touch); height: var(--touch); margin: -0.5rem -0.5rem -0.5rem 0; color: var(--gold-200); }
.op-go .ico { width: 1.125rem; height: 1.125rem; }
/* Desktop: wrappers without a box of their own, the list scrolls in the panel */
.op-inline { display: contents; }

/* Phone: compact button top left */
.objpanel.chip { align-self: flex-start; overflow: visible; }
.objpanel.chip .op-head { min-height: 2.5rem; padding: 0.25rem 0.75rem 0.25rem 0.625rem; gap: 0.375rem; border-radius: inherit; }
.objpanel.chip .op-title { font-size: var(--fs-md); flex: none; }
.objpanel.chip.fresh { animation: op-fresh 1.4s ease-in-out infinite; }
@keyframes op-fresh { 50% { box-shadow: var(--panel-edge), 0 0 0 2px var(--gold-300), 0 0 16px rgba(243, 200, 94, 0.75); } }
/* Phone: goals full-screen */
.op-scrim {
  position: fixed; inset: 0; z-index: 27; display: flex; justify-content: center; background: rgba(10, 6, 3, 0.6);
  padding: max(0.5rem, var(--safe-t)) max(0.5rem, var(--safe-r)) max(0.5rem, var(--safe-b)) max(0.5rem, var(--safe-l));
}
.op-sheet { width: 100%; max-width: 40rem; height: 100%; display: flex; flex-direction: column; padding: 0; overflow: hidden; }
.op-sheethead { display: flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0.375rem 0.375rem 0.875rem; border-bottom: 1px solid rgba(225, 168, 58, 0.25); flex: none; }
.op-sheethead > .ico { width: 1.375rem; height: 1.375rem; }
.op-sheethead h2 { margin: 0; font-size: var(--fs-xl); font-weight: 400; flex: none; }
.op-close { margin-left: auto; width: var(--touch); min-width: var(--touch); height: var(--touch); }
.op-sheet .op-list { flex: 1; padding: 0.75rem 0.875rem 1rem; gap: 0.75rem; }
.op-sheet .op-list li { font-size: var(--fs-md); line-height: 1.4; }
.op-sheet .op-go { margin: -0.375rem -0.25rem -0.375rem 0; }
.op-prog em { font-style: normal; font-size: var(--fs-xs); color: var(--gold-200); font-weight: 700; }
</style>
