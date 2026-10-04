<template>
  <!-- Key bar for touch devices: characters that are awkward on phone keyboards, and indenting. -->
  <div class="keybar" role="toolbar" :aria-label="$t('script.keys')" data-testid="keybar" @mousedown.prevent @touchstart.passive="noop">
    <button v-for="k in keys" :key="k.label" class="kb-key" :aria-label="k.aria ?? k.label" @click="$emit('key', k)">{{ k.label }}</button>
  </div>
</template>

<script>
export default {
  name: 'KeyBar',
  emits: ['key'],
  data() {
    return {
      keys: [
        { label: '⇥', aria: 'Tab', indent: true },
        { label: '⇤', aria: 'Shift+Tab', dedent: true },
        { label: ':', text: ':' },
        { label: '( )', text: '()', back: 1 },
        { label: '" "', text: '""', back: 1 },
        { label: '=', text: ' = ' },
        { label: '==', text: ' == ' },
        { label: '[ ]', text: '[]', back: 1 },
        { label: '.', text: '.' },
        { label: '_', text: '_' },
        { label: '#', text: '# ' },
      ],
    };
  },
  methods: { noop() {} },
};
</script>

<style>
.keybar { display: flex; gap: 0.25rem; overflow-x: auto; padding: 0.375rem; background: rgba(0, 0, 0, 0.35); border-top: 1px solid rgba(225, 168, 58, 0.2); scrollbar-width: none; }
.kb-key { flex: none; min-width: 2.75rem; min-height: 2.5rem; padding: 0 0.5rem; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 1rem; }
</style>
