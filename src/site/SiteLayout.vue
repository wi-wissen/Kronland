<template>
  <a class="skip" href="#main">{{ $s('nav.skip') }}</a>
  <header class="site-head" :class="{ overlay: overlay && !scrolled }">
    <div class="sh-inner">
      <a class="sh-brand" :href="$links.home" :aria-current="page === 'home' ? 'page' : null">
        <Icon name="crown" class="sh-crown" />
        <span>{{ $t('app.title') }}</span>
      </a>
      <nav class="sh-nav" :aria-label="$s('nav.main')">
        <a v-for="l in links" :key="l.id" :href="l.href" :class="['sh-link', { current: page === l.id }]" :aria-current="page === l.id ? 'page' : null" :data-testid="'nav-' + l.id">{{ $s(l.label) }}</a>
      </nav>
      <div class="sh-tools">
        <div class="seg sh-lang" role="radiogroup" :aria-label="$s('nav.lang')">
          <button v-for="l in langs" :key="l" type="button" role="radio" :aria-checked="$i18n.lang === l" :class="{ active: $i18n.lang === l }" :lang="l" :data-testid="'site-lang-' + l" @click="choose(l)">{{ l.toUpperCase() }}</button>
        </div>
        <a class="btn primary sh-play" :href="$links.play" data-testid="nav-play-button"><Icon name="play" />{{ $s('nav.play') }}</a>
      </div>
    </div>
  </header>

  <main id="main" tabindex="-1">
    <slot />
  </main>

  <footer class="site-foot">
    <div class="sf-inner">
      <div class="sf-brand">
        <span class="sf-title"><Icon name="crown" /> {{ $t('app.title') }}</span>
        <p>{{ $s('footer.made') }}</p>
        <nav class="sf-nav" :aria-label="$s('nav.main')">
          <a v-for="l in links" :key="l.id" :href="l.href">{{ $s(l.label) }}</a>
        </nav>
      </div>
      <div class="sf-credits" data-testid="credits">
        <h2 class="h-label">{{ $s('footer.credits') }}</h2>
        <ul>
          <li>{{ $s('footer.models') }} – <a href="https://www.kaylousberg.com" rel="noopener">kaylousberg.com</a></li>
          <li>{{ $s('footer.sound') }}</li>
          <li>{{ $s('footer.ui') }}</li>
          <li>{{ $s('footer.fonts') }}</li>
        </ul>
        <p class="sf-note">{{ $s('footer.inspired') }} <a :href="$links.manual + '#licenses'">{{ $s('footer.credits') }} →</a></p>
      </div>
    </div>
  </footer>
</template>

<script>
import { LANGS } from '../i18n/index.js';
import { chooseLang } from './site.js';

export default {
  name: 'SiteLayout',
  props: {
    /** active page: home | play | manual | compendium | scripting | blog */
    page: { type: String, default: 'home' },
    /** header transparent over the title image (home page) */
    overlay: { type: Boolean, default: false },
  },
  data() { return { langs: LANGS, scrolled: false }; },
  computed: {
    links() {
      const L = this.$links;
      return [
        { id: 'home', href: L.home, label: 'nav.home' },
        { id: 'play', href: L.play, label: 'nav.play' },
        { id: 'manual', href: L.manual, label: 'nav.manual' },
        { id: 'compendium', href: L.compendium, label: 'nav.compendium' },
        { id: 'scripting', href: L.scripting, label: 'nav.scripting' },
        { id: 'blog', href: L.blog, label: 'nav.blog' },
      ];
    },
  },
  mounted() {
    // Transparent header only over the title image; opaque when scrolling so no text shows through
    if (!this.overlay) return;
    this.onScroll = () => { this.scrolled = window.scrollY > 40; };
    this.onScroll();
    window.addEventListener('scroll', this.onScroll, { passive: true });
  },
  beforeUnmount() { if (this.onScroll) window.removeEventListener('scroll', this.onScroll); },
  methods: { choose(l) { chooseLang(l); } },
};
</script>
