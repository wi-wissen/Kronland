<template>
  <!-- Tributes (offers of the mission): paying triggers an event, e.g. buying off Zacke or hiring mercenaries.
       Two offers of the same group are a choice – the other disappears after paying. -->
  <aside class="tribpanel frame" data-testid="tributes">
    <button class="tp-head" :aria-expanded="open" data-testid="tributes-toggle" @click="open = !open">
      <Icon name="gold" />
      <span class="tp-title">{{ $t('mission.tributes') }}</span>
      <span class="tp-count num">{{ tributes.length }}</span>
      <Icon :name="open ? 'chevronUp' : 'chevronDown'" class="tp-chev" />
    </button>
    <ul v-if="open" class="tp-list">
      <li v-for="t in tributes" :key="t.id" :data-testid="'tribute-' + t.id">
        <span class="tp-text">{{ $tr(t.text) }}</span>
        <span class="tp-row">
          <span class="tp-cost">
            <span v-for="(n, r) in t.cost" :key="r" class="tp-res num"><Icon :name="r" />{{ n }}</span>
          </span>
          <button class="tp-pay" :disabled="!t.affordable" :data-testid="'tribute-pay-' + t.id" @click="$emit('pay', t.id)">
            {{ $t('mission.tributePay') }}
          </button>
        </span>
      </li>
    </ul>
  </aside>
</template>

<script>
export default {
  name: 'TributePanel',
  props: {
    tributes: { type: Array, required: true },
    lang: { type: String, default: 'de' },
  },
  emits: ['pay'],
  data() { return { open: true }; },
  watch: {
    // New offer: unfold so it is seen
    'tributes.length'(n, o) { if (n > o) this.open = true; },
  },
};
</script>

<style>
.tribpanel { padding: 0.375rem 0.75rem 0.625rem; display: flex; flex-direction: column; gap: 0.375rem; flex: none; }
.tp-head {
  display: flex; align-items: center; gap: 0.5rem; width: 100%; min-height: var(--touch); padding: 0; text-align: left;
  border: none; border-radius: 0; box-shadow: none; background: transparent;
}
.tp-head:hover { filter: none !important; }
.tp-count { color: var(--ink-muted); font-size: var(--fs-sm); font-weight: 700; }
.tp-chev { width: 1rem !important; height: 1rem !important; color: var(--ink-muted); }
.tp-head > .ico { width: 1.25rem; height: 1.25rem; }
.tp-title { font-family: var(--display); color: var(--gold-200); font-size: var(--fs-lg); flex: 1; }
.tp-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.tp-list li { display: flex; flex-direction: column; gap: 0.25rem; font-size: var(--fs-sm); line-height: 1.3; }
.tp-row { display: flex; align-items: center; gap: 0.5rem; justify-content: space-between; }
.tp-cost { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.tp-res { display: inline-flex; align-items: center; gap: 0.125rem; font-weight: 700; color: var(--gold-200); }
.tp-res .ico { width: 1rem; height: 1rem; }
.tp-pay { min-height: var(--touch); padding: 0 0.75rem; flex: none; }
</style>
