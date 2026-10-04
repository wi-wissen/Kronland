<template>
  <SiteLayout page="manual">
    <div class="wrap page-head">
      <h1 class="page-title">{{ $s('manual.title') }}</h1>
      <p class="page-lead">{{ $s('manual.lead') }}</p>
    </div>

    <div class="wrap doc-layout">
      <aside class="doc-side no-print">
        <div class="doc-side-inner frame">
          <label class="h-label" for="manual-search">{{ $s('manual.search') }}</label>
          <input id="manual-search" v-model="query" type="search" class="doc-search" :placeholder="$s('manual.searchPh')" data-testid="manual-search" autocomplete="off">
          <p v-if="query" class="doc-hits" aria-live="polite">{{ visible.length ? $s('manual.hits', { n: visible.length }) : $s('manual.noHits') }}</p>
          <details class="doc-toc" :open="tocOpen" @toggle="tocOpen = $event.target.open">
            <summary class="h-label">{{ $s('manual.toc') }}</summary>
            <nav :aria-label="$s('manual.toc')">
              <ol>
                <li v-for="s in visible" :key="s.id">
                  <a :href="'#' + s.id" :class="{ current: s.id === active }">{{ s.title }}</a>
                  <ol v-if="s.subs.length && !query">
                    <li v-for="h in s.subs" :key="h.id"><a :href="'#' + h.id">{{ h.text }}</a></li>
                  </ol>
                </li>
              </ol>
            </nav>
          </details>
          <button type="button" class="doc-print" @click="print"><Icon name="scroll" />{{ $s('manual.print') }}</button>
        </div>
      </aside>

      <article class="doc parchment prose" data-testid="manual" :lang="$i18n.lang">
        <section v-for="s in visible" :id="'sec-' + s.id" :key="s.id" class="doc-sec" v-html="s.html"></section>
        <p v-if="!visible.length" class="doc-empty">{{ $s('manual.noHits') }}</p>
      </article>
    </div>
  </SiteLayout>
</template>

<script>
import SiteLayout from '../SiteLayout.vue';
import { manualSections } from './content.js';

export default {
  name: 'ManualPage',
  components: { SiteLayout },
  data() {
    return { query: '', active: '', tocOpen: typeof window === 'undefined' || window.innerWidth > 900 };
  },
  computed: {
    sections() { return manualSections(this.$i18n.lang, this.$siteRoot); },
    visible() {
      const q = this.query.trim().toLowerCase();
      if (!q) return this.sections;
      const words = q.split(/\s+/);
      return this.sections.filter((s) => words.every((w) => s.plain.includes(w) || s.title.toLowerCase().includes(w)));
    },
  },
  watch: {
    // After a language switch the anchor stays valid (same IDs in both languages)
    '$i18n.lang'() { this.$nextTick(this.observe); },
    visible() { this.$nextTick(this.observe); },
  },
  mounted() {
    this.observe();
    // Jump to the anchor on first load (content only appears after loading)
    if (location.hash) {
      const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      el?.scrollIntoView();
    }
  },
  beforeUnmount() { this.io?.disconnect(); },
  methods: {
    print() { window.print(); },
    observe() {
      this.io?.disconnect();
      if (typeof IntersectionObserver === 'undefined') return;
      this.io = new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) this.active = e.target.id.replace(/^sec-/, '');
      }, { rootMargin: '-20% 0px -70% 0px' });
      document.querySelectorAll('.doc-sec').forEach((el) => this.io.observe(el));
    },
  },
};
</script>

<style>
.doc-sec + .doc-sec h2 { margin-top: 2.75rem; }
.doc-empty { font-style: italic; }
</style>
