<template>
  <SiteLayout page="scripting">
    <div class="wrap page-head">
      <h1 class="page-title">{{ $s('scripting.title') }}</h1>
      <p class="page-lead">{{ $s('scripting.lead') }}</p>
    </div>

    <div class="wrap doc-layout">
      <aside class="doc-side no-print">
        <div class="doc-side-inner frame">
          <label class="h-label" for="scripting-search">{{ $s('scripting.search') }}</label>
          <input id="scripting-search" v-model="query" type="search" class="doc-search" :placeholder="$s('scripting.searchPh')" data-testid="scripting-search" autocomplete="off">
          <details class="doc-toc" :open="tocOpen" @toggle="tocOpen = $event.target.open">
            <summary class="h-label">{{ $s('scripting.toc') }}</summary>
            <nav :aria-label="$s('scripting.toc')" data-testid="scripting-nav">
              <ol>
                <li v-for="c in chapters" :key="c.id">
                  <a :href="'#' + c.id" :class="{ current: c.id === active }">{{ c.title }}</a>
                  <ol v-if="c.subs.length && c.id === active" class="ref-subnav">
                    <li v-for="h in c.subs" :key="h.id"><a :href="'#' + h.id">{{ h.text }}</a></li>
                  </ol>
                </li>
              </ol>
              <p class="h-label ref-toc-head">{{ $s('scripting.reference') }}</p>
              <ol>
                <li v-for="s in reference" :key="s.id">
                  <a :href="'#' + s.id" :class="{ current: s.id === active }"><Icon :name="s.icon" />{{ s.title }}</a>
                  <ol v-if="s.id === active && (s.entries.length || s.classes)" class="ref-subnav">
                    <li v-for="e in s.entries" :key="e.name"><a :href="'#' + e.anchor"><code>{{ e.name }}</code></a></li>
                    <li v-for="c in s.classes || []" :key="c.id"><a :href="'#' + c.id"><code>{{ c.name }}</code></a></li>
                  </ol>
                </li>
              </ol>
            </nav>
          </details>
        </div>
      </aside>

      <div class="ref-main">
        <section v-if="query" class="doc parchment prose ref-results" aria-live="polite" data-testid="scripting-results">
          <p v-if="!hits.length">{{ $s('scripting.noHits') }}</p>
          <ul v-else>
            <li v-for="h in hits" :key="h.href"><a :href="h.href" @click="query = ''"><code v-if="h.code">{{ h.label }}</code><template v-else>{{ h.label }}</template></a> <span class="ref-ctx">{{ h.context }}</span></li>
          </ul>
        </section>
        <ScriptingContent v-show="!query" :chapters="chapters" :reference="reference" />
      </div>
    </div>
  </SiteLayout>
</template>

<script>
import SiteLayout from '../SiteLayout.vue';
import ScriptingContent from './ScriptingContent.vue';
import { introSections, referenceModel } from './content.js';

export default {
  name: 'ScriptingPage',
  components: { SiteLayout, ScriptingContent },
  data() {
    return { query: '', active: 'intro', tocOpen: typeof window === 'undefined' || window.innerWidth > 900 };
  },
  computed: {
    chapters() { return introSections(this.$i18n.lang, this.$siteRoot); },
    reference() { return referenceModel(this.$i18n.lang, this.$siteRoot); },
    /** Search index: chapters, their subheadings, sections and commands. */
    index() {
      const out = [];
      for (const c of this.chapters) {
        out.push({ label: c.title, context: '', href: `#${c.id}`, hay: c.title.toLowerCase() });
        for (const h of c.subs) out.push({ label: h.text, context: c.title, href: `#${h.id}`, hay: `${h.text} ${c.title}`.toLowerCase() });
      }
      for (const s of this.reference) {
        out.push({ label: s.title, context: '', href: `#${s.id}`, hay: s.title.toLowerCase() });
        for (const e of s.entries) out.push({ label: e.sig, code: true, context: s.title, href: `#${e.anchor}`, hay: `${e.plain} ${e.also.join(' ')} ${e.short}`.toLowerCase() });
        for (const c of s.classes ?? []) out.push({ label: c.name, code: true, context: s.title, href: `#${c.id}`, hay: `${c.name} ${c.text} ${c.props.map((p) => p.name).join(' ')}`.toLowerCase() });
      }
      return out;
    },
    hits() {
      const words = this.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (!words.length) return [];
      // Name matches first, then mentions in the text
      const all = this.index.filter((h) => words.every((w) => h.hay.includes(w)));
      const q = words.join(' ');
      return [...all.filter((h) => h.label.toLowerCase().includes(q)), ...all.filter((h) => !h.label.toLowerCase().includes(q))].slice(0, 60);
    },
  },
  watch: {
    '$i18n.lang'() { this.$nextTick(this.observe); },
  },
  mounted() {
    this.observe();
    this.onHash = () => this.jump(location.hash);
    window.addEventListener('hashchange', this.onHash);
    if (location.hash) this.$nextTick(() => this.jump(location.hash));
  },
  beforeUnmount() { this.io?.disconnect(); window.removeEventListener('hashchange', this.onHash); },
  methods: {
    /** Jump to the anchor (command, chapter, subheading) and highlight its section in the sidebar. */
    jump(hash) {
      const id = decodeURIComponent((hash || '').slice(1));
      if (!id) return;
      this.query = '';
      this.$nextTick(() => {
        const el = document.getElementById(id);
        if (!el) return;
        const sec = el.closest('.ref-sec, .ref-chapter');
        if (sec) this.active = sec.id.replace(/^sec-/, '');
        el.scrollIntoView({ block: 'start' });
      });
    },
    observe() {
      this.io?.disconnect();
      if (typeof IntersectionObserver === 'undefined') return;
      this.io = new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) this.active = e.target.id.replace(/^sec-/, '');
      }, { rootMargin: '-15% 0px -75% 0px' });
      document.querySelectorAll('.ref-sec, .ref-chapter').forEach((el) => this.io.observe(el));
    },
  },
};
</script>

<style>
.ref-main { min-width: 0; }
.doc-toc a .ico { width: 1.125rem; height: 1.125rem; margin-right: 0.375rem; vertical-align: -0.2rem; }
.ref-subnav { max-height: 40vh; overflow-y: auto; scrollbar-width: thin; }
.ref-subnav code { font-size: 0.8125rem; color: inherit; background: none; }
.ref-toc-head { margin: 0.75rem 0 0.25rem; }
.scripting h2 { display: flex; align-items: center; gap: 0.5rem; }
.ref-h-ico { width: 1.75rem !important; height: 1.75rem !important; }
.ref-anchor { margin-left: auto; font-size: 1rem; text-decoration: none; opacity: 0.45; font-family: var(--body, inherit); }
.ref-anchor:hover { opacity: 1; }
.ref-sec h2, .ref-chapter + .ref-chapter h2 { margin-top: 3rem; }
.ref-entry { margin: 1.5rem 0 0; padding: 0.875rem 1rem 1rem; border-radius: var(--r-md); background: rgba(255, 252, 240, 0.45); box-shadow: 0 0 0 1px rgba(90, 60, 20, 0.18); }
.ref-entry:target { background: linear-gradient(90deg, rgba(243, 200, 94, 0.32), rgba(255, 252, 240, 0.45) 70%); box-shadow: 0 0 0 2px rgba(155, 108, 28, 0.55); }
.ref-entry h3 { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.625rem; margin: 0 0 0.375rem; font-family: inherit; }
.prose .ref-sig { font-size: 1rem; font-weight: 700; color: #3b2408; background: none; padding: 0; word-break: break-word; }
.ref-badge { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.125rem 0.5rem; border-radius: 999px; background: rgba(125, 90, 166, 0.16); color: #4d2f73; white-space: nowrap; }
.ref-badge.small { font-size: 0.6875rem; padding: 0 0.375rem; margin-left: 0.25rem; }
.ref-label { font-size: 0.8125rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--parch-ink-muted); }
.ref-desc p { margin: 0.375rem 0; }
.ref-block { margin: 0.625rem 0; }
.ref-params, .ref-props { display: grid; grid-template-columns: minmax(8rem, max-content) 1fr; gap: 0.25rem 1rem; margin: 0.25rem 0 0; }
.ref-params dt, .ref-props dt { font-weight: 400; }
.ref-params dd, .ref-props dd { margin: 0; }
.ref-type { font-size: 0.875rem; font-style: italic; color: var(--parch-ink-muted); }
.ref-returns, .ref-also, .ref-methods { margin: 0.5rem 0; }
.ref-also code + code { margin-left: 0.375rem; }
.ref-example { margin-top: 0.75rem; }
.ref-ex-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.ref-copy { min-height: 2rem !important; padding: 0.125rem 0.75rem !important; font-size: 0.8125rem; }
.prose pre.ref-code { margin: 0.375rem 0 0; }
.ref-out { margin: 0; border-radius: 0 0 var(--r-md) var(--r-md); background: #1b130c; padding: 0.375rem 1rem 0.5rem; border-top: 1px dashed rgba(243, 227, 192, 0.25); }
.prose pre.ref-code:has(+ .ref-out) { border-radius: var(--r-md) var(--r-md) 0 0; }
.ref-out-label { display: block; font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #a8936d; }
.prose .ref-out pre { margin: 0; padding: 0; background: none; color: #cfe8b8; }
.ref-out.err pre { color: #ffb3a6; }
.ref-errors ul { margin: 0.25rem 0 0; padding-left: 1.2rem; }
.ref-kind { font-weight: 700; }
.ref-results ul { list-style: none; padding: 0; }
.ref-results li { padding: 0.375rem 0; border-bottom: 1px solid rgba(90, 60, 20, 0.15); }
.ref-ctx { color: var(--parch-ink-muted); font-size: 0.875rem; margin-left: 0.5rem; }
/* Syntax colours as in the in-game code editor (CodeEditor.vue) */
.scripting .tk-kw { color: #f0a35e; font-weight: 600; }
.scripting .tk-const { color: #d996f2; }
.scripting .tk-str { color: #a8d97a; }
.scripting .tk-num { color: #8fc8f2; }
.scripting .tk-comment { color: #b09c78; font-style: italic; }
.scripting .tk-def { color: #ffd479; }
.scripting .tk-builtin { color: #78d6c6; }
.scripting .tk-call { color: #f5d9a0; }
.scripting .tk-deco { color: #e886b5; }
@media (max-width: 600px) {
  .ref-entry { padding: 0.75rem 0.75rem 0.875rem; margin-inline: -0.25rem; }
  .prose .ref-sig { font-size: 0.9375rem; }
  .ref-params, .ref-props { grid-template-columns: 1fr; gap: 0 0; }
  .ref-params dd, .ref-props dd { margin-bottom: 0.375rem; }
  .prose pre.ref-code, .ref-out { padding-inline: 0.75rem; }
}
@media print { .ref-entry { break-inside: avoid; box-shadow: none; background: none; } .ref-out { background: none; } }
</style>
