<template>
  <SiteLayout page="compendium">
    <div class="wrap page-head">
      <h1 class="page-title">{{ $s('compendium.title') }}</h1>
      <p class="page-lead">{{ $s('compendium.lead') }}</p>
    </div>

    <div class="wrap doc-layout">
      <aside class="doc-side no-print">
        <div class="doc-side-inner frame">
          <label class="h-label" for="wiki-search">{{ $s('compendium.search') }}</label>
          <input id="wiki-search" v-model="query" type="search" class="doc-search" :placeholder="$s('compendium.searchPh')" data-testid="wiki-search" autocomplete="off">
          <details class="doc-toc" :open="tocOpen" @toggle="tocOpen = $event.target.open">
            <summary class="h-label">{{ $s('compendium.sections') }}</summary>
            <nav :aria-label="$s('compendium.sections')" data-testid="wiki-nav">
              <ol>
                <li v-for="s in model.sections" :key="s.id">
                  <a :href="'#' + s.id" :class="{ current: s.id === active }"><Icon :name="s.icon" />{{ s.title }}</a>
                  <ol v-if="s.entries.length && s.id === active" class="w-subnav">
                    <li v-for="e in s.entries" :key="e.id"><a :href="'#' + e.id">{{ e.title }}</a></li>
                  </ol>
                </li>
              </ol>
            </nav>
          </details>
        </div>
      </aside>

      <div class="w-main">
        <section v-if="query" class="doc parchment prose w-results" aria-live="polite" data-testid="wiki-results">
          <p v-if="!hits.length">{{ $s('compendium.noHits') }}</p>
          <ul v-else>
            <li v-for="h in hits" :key="h.href + h.label"><a :href="h.href" @click="query = ''">{{ h.label }}</a> <span class="w-ctx">{{ h.context }}</span></li>
          </ul>
        </section>

        <CompendiumContent v-show="!query" :model="model" />
      </div>
    </div>
  </SiteLayout>
</template>

<script>
import SiteLayout from '../SiteLayout.vue';
import CompendiumContent from './CompendiumContent.vue';
import { wikiModel, cellText } from './generate.js';

export default {
  name: 'WikiPage',
  components: { SiteLayout, CompendiumContent },
  data() {
    return { query: '', active: 'buildings', tocOpen: typeof window === 'undefined' || window.innerWidth > 900 };
  },
  computed: {
    model() { return wikiModel(this.$i18n.lang); },
    /** Search index: sections, entries and table rows with anchor. */
    index() {
      const out = [];
      const { names } = this.model;
      for (const s of this.model.sections) {
        out.push({ label: s.title, context: '', href: `#${s.id}` });
        for (const e of s.entries) out.push({ label: e.title, context: `${s.title}${e.sub ? ` · ${e.sub}` : ''}`, href: `#${e.id}` });
        const tables = [...s.blocks, ...s.entries.flatMap((e) => e.blocks)].filter((b) => b.type === 'table');
        for (const b of tables) {
          for (const r of b.rows) if (r.id) out.push({ label: cellText(r.cells[0], names) || cellText(r.cells[1], names), context: `${s.title}${b.caption ? ` · ${b.caption}` : ''}`, href: `#${r.id}` });
        }
      }
      return out;
    },
    hits() {
      const words = this.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (!words.length) return [];
      const seen = new Set();
      return this.index.filter((h) => {
        const hay = `${h.label} ${h.context}`.toLowerCase();
        if (!words.every((w) => hay.includes(w)) || seen.has(h.href)) return false;
        seen.add(h.href);
        return true;
      }).slice(0, 60);
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
    /** Jump to the anchor (including table rows), highlight the section in the sidebar. */
    jump(hash) {
      const id = decodeURIComponent((hash || '').slice(1));
      if (!id) return;
      this.query = '';
      this.$nextTick(() => {
        const el = document.getElementById(id);
        if (!el) return;
        const sec = el.closest('.w-sec');
        if (sec) this.active = sec.id;
        el.scrollIntoView({ block: el.tagName === 'TR' ? 'center' : 'start' });
        document.querySelectorAll('tr.hl').forEach((r) => r.classList.remove('hl'));
        if (el.tagName === 'TR') el.classList.add('hl');
      });
    },
    observe() {
      this.io?.disconnect();
      if (typeof IntersectionObserver === 'undefined') return;
      this.io = new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) this.active = e.target.id;
      }, { rootMargin: '-15% 0px -75% 0px' });
      document.querySelectorAll('.w-sec').forEach((el) => this.io.observe(el));
    },
  },
};
</script>

<style>
.w-main { min-width: 0; }
.doc-toc a .ico { width: 1.125rem; height: 1.125rem; margin-right: 0.375rem; vertical-align: -0.2rem; }
.w-subnav { max-height: 40vh; overflow-y: auto; scrollbar-width: thin; }
.compendium h2 { display: flex; align-items: center; gap: 0.5rem; }
.compendium h3 { display: flex; align-items: center; gap: 0.5rem; margin-top: 2rem; }
.w-h-ico { width: 1.75rem !important; height: 1.75rem !important; }
.compendium h3 .w-h-ico { width: 1.5rem !important; height: 1.5rem !important; }
.w-anchor { margin-left: auto; font-size: 1rem; text-decoration: none; opacity: 0.45; }
.w-anchor:hover { opacity: 1; }
.w-sec + .w-sec h2 { margin-top: 3rem; }
.w-sub { margin-top: -0.25rem !important; color: var(--parch-ink-muted); font-style: italic; }
.w-entry:target h3, .w-entry:target { background: linear-gradient(90deg, rgba(243, 200, 94, 0.25), transparent 60%); border-radius: var(--r-md); }
.w-facts { display: grid; grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); gap: 0.375rem 1rem; margin: 0.75rem 0; padding: 0.75rem 1rem; background: rgba(255, 252, 240, 0.5); border-radius: var(--r-md); box-shadow: 0 0 0 1px rgba(90, 60, 20, 0.2); }
.w-facts dt { font-size: 0.8125rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--parch-ink-muted); }
.w-facts dd { margin: 0; }
.w-cost { display: inline-flex; flex-wrap: wrap; gap: 0.125rem 0.625rem; white-space: nowrap; }
.w-res { display: inline-flex; align-items: center; gap: 0.1875rem; }
.w-res .ico, .w-link .ico, .w-t .ico { width: 1.125rem; height: 1.125rem; }
.w-link .ico, .w-t .ico { vertical-align: -0.2em; margin-right: 0.3125rem; }
.prose td .good, .prose td.good { color: #1f6a1a; font-weight: 700; }
.prose td .bad { color: #9a2a1a; }
.prose tbody th { font-weight: 700; white-space: nowrap; text-align: left; }
.w-results ul { list-style: none; padding: 0; }
.w-results li { padding: 0.375rem 0; border-bottom: 1px solid rgba(90, 60, 20, 0.15); }
.prose .w-t.pad { display: block; font-weight: 700; background: rgba(243, 200, 94, 0.35); border-radius: 3px; padding: 0 0.25rem; }
.w-ctx { color: var(--parch-ink-muted); font-size: 0.875rem; margin-left: 0.5rem; }
</style>
