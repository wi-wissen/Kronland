<template>
  <!-- Documentation card of one command (hover in the editor, long-press on phones, help list):
       signature, short description, parameters, return value, link to the reference. -->
  <article class="doc-card parchment" :class="{ full, closable }" data-testid="doc-card" :data-name="card.name">
    <header class="dc-head">
      <code class="dc-sig">{{ card.sig }}</code>
      <span class="dc-group">{{ card.group }}</span>
      <button v-if="closable" class="ghost dc-close" :aria-label="$t('common.close')" data-testid="doc-card-close" @click="$emit('close')"><Icon name="close" /></button>
    </header>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <p class="dc-text" v-html="full ? card.descHtml || card.shortHtml : card.shortHtml"></p>
    <dl v-if="card.params.length || card.returnsHtml" class="dc-params">
      <template v-for="p in card.params" :key="p.name">
        <dt>{{ p.name }}</dt>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <dd><span class="dc-type">{{ p.type }}</span> – <span v-html="p.html"></span></dd>
      </template>
      <template v-if="card.returnsHtml">
        <dt class="dc-ret" :title="card.labels.returns">→</dt>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <dd v-html="card.returnsHtml"></dd>
      </template>
    </dl>
    <pre v-if="full && card.example" class="dc-example"><code>{{ card.example.replace(/\n+$/, '') }}</code></pre>
    <footer class="dc-foot">
      <button v-if="insertable && card.example" class="dc-insert" data-testid="doc-card-insert" @click="$emit('insert', card.example)"><Icon name="plus" />{{ $t('script.doc.insert') }}</button>
      <a class="dc-ref" :href="card.url" target="_blank" rel="noopener" data-testid="doc-card-ref" @click="$emit('close')">{{ $t('script.doc.reference') }} <Icon name="next" /></a>
      <span v-if="hint" class="dc-hint">{{ hint }}</span>
    </footer>
  </article>
</template>

<script>
export default {
  name: 'DocCard',
  props: {
    /** cardFor() from docCards.js */
    card: { type: Object, required: true },
    /** Long description and example (phones, help list) instead of the short text */
    full: Boolean,
    closable: Boolean,
    insertable: Boolean,
    hint: { type: String, default: '' },
  },
  emits: ['close', 'insert'],
};
</script>

<style>
.doc-card { position: relative; padding: 0.5rem 0.75rem 0.5rem; font-size: var(--fs-sm); line-height: 1.42; color: var(--parch-ink); border-radius: 0.375rem 0.75rem 0.5rem 0.375rem; }
.dc-head { display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }
.dc-sig { flex: 1 1 auto; min-width: 0; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.875rem; font-weight: 700; color: #3b2408; word-break: break-word; }
.dc-group { font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--parch-ink-muted, #6e5536); background: rgba(155, 108, 28, 0.18); padding: 0 0.375rem; border-radius: 3px; }
.dc-close { position: absolute; top: 0.25rem; right: 0.25rem; min-height: 2rem !important; min-width: 2rem; padding: 0; color: var(--parch-ink); }
.doc-card.closable .dc-head { padding-right: 2rem; }
.doc-card .dc-text { margin: 0.25rem 0 0.375rem; color: var(--parch-ink); font-size: var(--fs-sm); }
.doc-card code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.92em; background: rgba(120, 80, 20, 0.12); padding: 0 0.2em; border-radius: 3px; }
.doc-card .dc-sig { background: none; padding: 0; }
.dc-params { margin: 0.25rem 0; display: grid; grid-template-columns: auto 1fr; gap: 0.125rem 0.5rem; }
.dc-params dt { font-family: ui-monospace, Menlo, Consolas, monospace; font-weight: 700; font-size: 0.8125rem; }
.dc-params dd { margin: 0; }
.dc-type { font-style: italic; color: var(--parch-ink-muted, #6e5536); }
.dc-example { margin: 0.375rem 0; padding: 0.375rem 0.5rem; background: #2b1d12; color: #f3e3c0; border-radius: var(--r-sm); font-size: 0.8125rem; line-height: 1.45; overflow-x: auto; }
.dc-example code { background: none; padding: 0; }
.dc-foot { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.25rem; }
.dc-ref { display: inline-flex; align-items: center; gap: 0.25rem; color: #7a4a0c; font-weight: 600; font-size: var(--fs-sm); min-height: 1.75rem; }
.dc-ref .ico { width: 0.875rem; height: 0.875rem; }
.dc-insert { min-height: 2rem; font-size: var(--fs-sm); display: inline-flex; align-items: center; gap: 0.25rem; padding: 0 0.5rem; }
.dc-hint { margin-left: auto; font-size: var(--fs-xs); color: var(--parch-ink-muted, #6e5536); }
</style>
