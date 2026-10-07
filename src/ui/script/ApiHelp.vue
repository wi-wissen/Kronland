<template>
  <!-- Command reference: game API (English names) with explanations in the UI language,
       plus short Python basics. Tapping "+" inserts an example into your own program. -->
  <div class="api-help" data-testid="api-help">
    <input v-model="query" class="api-search" type="search" :placeholder="$t('script.help.search')" :aria-label="$t('script.help.search')">
    <section v-for="g in groups" :key="g.id" class="api-group">
      <h4>{{ $t('script.group.' + g.id) }}</h4>
      <div v-for="e in g.entries" :key="e.name" class="api-entry">
        <code class="api-sig">{{ e.sig }}</code>
        <button v-if="e.example" class="ghost api-add" :aria-label="$t('script.help.insert')" @click="$emit('insert', e.example)"><Icon name="plus" /></button>
        <p>{{ $t(e.key) }} <a class="api-more" :href="e.href ?? refUrl(e.name)" target="_blank" rel="noopener" :title="$t('script.help.more')" :aria-label="$t('script.help.more')" :data-testid="'api-more-' + e.name">→</a></p>
      </div>
    </section>
    <p v-if="!groups.length" class="sp-none">{{ $t('script.help.nothing') }}</p>
    <a class="api-ref" :href="refUrl()" target="_blank" rel="noopener" data-testid="api-reference"><Icon name="scroll" />{{ $t('script.help.reference') }}</a>
  </div>
</template>

<script>
import { API_DOC } from '../../sim/scripting/api.js';
import { has, t, i18n } from '../../i18n/index.js';
import { BASICS, refExample, refUrl } from './reference.js';

export default {
  name: 'ApiHelp',
  props: { level: { type: String, default: 'player' } },
  emits: ['insert'],
  data() { return { query: '' }; },
  methods: { refUrl },
  computed: {
    groups() {
      const q = this.query.trim().toLowerCase();
      const entries = [
        ...BASICS.map((b) => ({ ...b, group: 'basics', key: `script.api.${b.name}`, href: refUrl(b.name) })),
        ...API_DOC.filter((e) => this.level === 'mission' || e.level === 'player')
          .map((e) => ({ ...e, key: `script.api.${e.name}`, example: refExample(e.name, i18n.lang) })),
      ].filter((e) => has(e.key) && (!q || e.sig.toLowerCase().includes(q) || t(e.key).toLowerCase().includes(q)));
      const order = ['basics', 'flow', 'hero', 'world', 'village', 'story', 'events', 'goals', 'power', 'terrain', 'const'];
      return order.map((id) => ({ id, entries: entries.filter((e) => e.group === id) })).filter((g) => g.entries.length);
    },
  },
};
</script>

<style>
.api-help { display: flex; flex-direction: column; gap: 0.5rem; }
.api-search { width: 100%; }
.api-group h4 { margin: 0.25rem 0; font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--gold-300); }
.api-entry { display: grid; grid-template-columns: 1fr auto; gap: 0 0.375rem; padding: 0.375rem 0; border-bottom: 1px solid rgba(225, 168, 58, 0.1); }
.api-sig { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.8125rem; color: var(--gold-100); word-break: break-word; }
.api-entry p { grid-column: 1 / -1; margin: 0.125rem 0 0; font-size: var(--fs-sm); color: var(--ink-muted); line-height: 1.4; }
.api-more { color: var(--gold-300); text-decoration: none; padding: 0 0.25rem; }
.api-ref { display: flex; align-items: center; gap: 0.375rem; color: var(--gold-200); font-size: var(--fs-sm); padding: 0.375rem 0; }
.api-ref .ico { width: 1.125rem; height: 1.125rem; }
.api-add { min-height: 1.75rem !important; min-width: 1.75rem; padding: 0; }
</style>
