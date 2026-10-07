<template>
  <!-- Command help: game API (English names) with explanations in the UI language, Python basics and – once the
       docs are loaded (docsLoader.js) – the Python functions and methods. Tapping a signature opens the doc card
       (commandDocs.js), "+" inserts an example into your own program. -->
  <div class="api-help" data-testid="api-help">
    <input v-model="query" class="api-search" type="search" :placeholder="$t('script.help.search')" :aria-label="$t('script.help.search')" data-testid="api-search">
    <p class="api-hint">{{ touch ? $t('script.help.tapHint') : $t('script.help.hoverHint', { key: modKey }) }}</p>
    <section v-for="g in groups" :key="g.id" class="api-group">
      <h4>{{ g.title }}</h4>
      <div v-for="e in g.entries" :key="e.name" class="api-entry" :class="{ open: openName === e.name }">
        <button v-if="loaded && known(e.name)" class="api-sig api-sig-btn" :aria-expanded="openName === e.name" :data-testid="'api-sig-' + e.name" @click="toggle(e.name)">{{ e.sig }}</button>
        <code v-else class="api-sig">{{ e.sig }}</code>
        <button v-if="e.example" class="ghost api-add" :aria-label="$t('script.help.insert')" @click="$emit('insert', e.example)"><Icon name="plus" /></button>
        <DocCard v-if="openName === e.name && card" class="api-card" :card="card" full insertable closable @close="openName = null" @insert="$emit('insert', $event)" />
        <p v-else>{{ e.text }} <a class="api-more" :href="e.href ?? refUrl(e.name)" target="_blank" rel="noopener" :title="$t('script.help.more')" :aria-label="$t('script.help.more')" :data-testid="'api-more-' + e.name">→</a></p>
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
import DocCard from './DocCard.vue';
import { docs, loadDocs } from './docsLoader.js';

const IS_MAC = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '');
const ORDER = ['basics', 'flow', 'hero', 'world', 'village', 'story', 'events', 'goals', 'power', 'terrain', 'const', 'pyfunc', 'pymath', 'pyrandom', 'pystr', 'pylist', 'pydict'];

export default {
  name: 'ApiHelp',
  components: { DocCard },
  props: { level: { type: String, default: 'player' } },
  emits: ['insert'],
  data() { return { query: '', openName: null, loaded: !!docs(), touch: globalThis.matchMedia?.('(pointer: coarse)').matches ?? false }; },
  computed: {
    modKey() { return IS_MAC ? '⌘' : t('script.doc.ctrl'); },
    card() { return this.loaded && this.openName ? docs().cardFor(this.openName, i18n.lang) : null; },
    groups() {
      const q = this.query.trim().toLowerCase();
      const lang = i18n.lang;
      const entries = [
        ...BASICS.map((b) => ({ ...b, group: 'basics', key: `script.api.${b.name}`, href: refUrl(b.name) })),
        ...API_DOC.filter((e) => this.level === 'mission' || e.level === 'player')
          .map((e) => ({ ...e, key: `script.api.${e.name}`, example: refExample(e.name, lang) })),
      ].filter((e) => has(e.key)).map((e) => ({ ...e, text: t(e.key) }));
      const titles = {};
      if (this.loaded) {
        // Python functions and methods: short texts from the reference docs
        for (const c of docs().commandList(lang)) {
          if (!c.py) continue;
          titles[c.group] = c.groupTitle;
          entries.push({ name: c.name, sig: c.sig, group: c.group, text: c.short, example: refExample(c.name, lang) });
        }
      }
      const shown = entries.filter((e) => !q || e.sig.toLowerCase().includes(q) || e.name.toLowerCase().includes(q) || e.text.toLowerCase().includes(q));
      return ORDER.map((id) => ({ id, title: titles[id] ?? t('script.group.' + id), entries: shown.filter((e) => e.group === id) })).filter((g) => g.entries.length);
    },
  },
  mounted() { loadDocs().then(() => { this.loaded = true; }); },
  methods: {
    refUrl,
    known(name) { return docs()?.isKnown(name) ?? false; },
    toggle(name) { this.openName = this.openName === name ? null : name; },
  },
};
</script>

<style>
.api-help { display: flex; flex-direction: column; gap: 0.5rem; }
.api-search {
  width: 100%; font: inherit; color: var(--ink); background: var(--inset-bg); box-shadow: var(--inset-edge);
  border: 1px solid var(--wood-950); border-radius: var(--r-md); padding: 0.4375rem 0.625rem; min-height: 2.375rem;
}
.api-search:focus-visible { outline: none; border-color: var(--gold-400); box-shadow: var(--inset-edge), 0 0 0 1px var(--gold-400); }
.api-hint { margin: 0; font-size: var(--fs-xs); color: var(--ink-dim); line-height: 1.35; }
.api-group h4 { margin: 0.25rem 0; font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--gold-300); }
.api-entry { display: grid; grid-template-columns: 1fr auto; gap: 0 0.375rem; padding: 0.375rem 0; border-bottom: 1px solid rgba(225, 168, 58, 0.1); }
.api-sig { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.8125rem; color: var(--gold-100); word-break: break-word; }
.api-sig-btn { justify-self: start; text-align: left; min-height: 0; padding: 0.125rem 0; background: none; border: 0; box-shadow: none; cursor: pointer; text-decoration: underline dotted rgba(243, 200, 94, 0.5); text-underline-offset: 3px; }
.api-sig-btn:hover, .api-entry.open .api-sig-btn { color: var(--gold-300); filter: none; }
.api-entry > p { grid-column: 1 / -1; margin: 0.125rem 0 0; font-size: var(--fs-sm); color: var(--ink-muted); line-height: 1.4; }
.api-card { grid-column: 1 / -1; margin-top: 0.25rem; }
.api-more { color: var(--gold-300); text-decoration: none; padding: 0 0.25rem; }
.api-ref { display: flex; align-items: center; gap: 0.375rem; color: var(--gold-200); font-size: var(--fs-sm); padding: 0.375rem 0; }
.api-ref .ico { width: 1.125rem; height: 1.125rem; }
.api-add { min-height: 1.75rem !important; min-width: 1.75rem; padding: 0; }
</style>
