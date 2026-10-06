<template>
  <SiteLayout page="blog">
    <!-- Article -->
    <template v-if="post">
      <div class="wrap page-head bl-head">
        <a class="bl-back" :href="$links.blog" data-testid="blog-back">← {{ $s('blog.back') }}</a>
        <p class="bl-kicker">
          <span v-if="ms">{{ $s('blog.milestone', { n: ms.n, total: ms.total }) }} · </span>
          <time :datetime="post.date">{{ dateText(post.date) }}</time>
        </p>
        <h1 class="page-title bl-title" data-testid="blog-title">{{ text.title }}</h1>
        <p class="page-lead">{{ text.teaser }}</p>
      </div>
      <div class="wrap bl-body">
        <aside v-if="ms" class="bl-facts frame" data-testid="blog-facts" :aria-label="$s('blog.facts')">
          <dl>
            <div><dt>{{ $s('blog.fact.when') }}</dt><dd>{{ span(ms.date_start, ms.date_end) }}</dd></div>
            <div v-if="ms.work_start < ms.date_start"><dt>{{ $s('blog.fact.work') }}</dt><dd>{{ span(ms.work_start, ms.date_end) }} · {{ duration(ms.work_start, ms.date_end) }}</dd></div>
            <div><dt>{{ $s('blog.fact.lines') }}</dt><dd>{{ $s('blog.fact.linesVal', { files: num(ms.files_changed), plus: num(ms.insertions), minus: num(ms.deletions) }) }}</dd></div>
            <div><dt>{{ $s('blog.fact.tests') }}</dt><dd>{{ $s('blog.fact.testsVal', { v: signed(ms.tests_vitest_added), e: signed(ms.tests_e2e_added), vt: num(ms.tests_vitest), et: num(ms.tests_e2e) }) }}</dd></div>
          </dl>
          <p class="bl-src">
            <a :href="links.commit" rel="noopener" data-testid="blog-src-commit">{{ $s('blog.src.commit') }} ↗</a>
            <a :href="links.tree" rel="noopener" data-testid="blog-src-tree">{{ $s('blog.src.tree') }} ↗</a>
          </p>
        </aside>
        <article class="doc parchment prose bl-doc" data-testid="blog-article" :lang="$i18n.lang">
          <section v-for="s in sections" :id="'sec-' + s.id" :key="s.id" class="doc-sec" v-html="s.html"></section>
        </article>
        <nav class="bl-pager" :aria-label="$s('blog.pager')">
          <a v-if="prev" class="bl-pg prev frame" :href="href(prev)" data-testid="blog-prev"><span>← {{ $s('blog.prev') }}</span><strong>{{ titleOf(prev) }}</strong></a>
          <span v-else></span>
          <a v-if="next" class="bl-pg next frame" :href="href(next)" data-testid="blog-next"><span>{{ $s('blog.next') }} →</span><strong>{{ titleOf(next) }}</strong></a>
        </nav>
      </div>
    </template>

    <!-- Overview -->
    <template v-else>
      <div class="wrap page-head bl-head">
        <h1 class="page-title">{{ $s('blog.title') }}</h1>
        <p class="page-lead">{{ $s('blog.lead') }}</p>
        <p v-if="missing" class="bl-missing" role="status">{{ $s('blog.notFound') }}</p>
      </div>
      <div class="wrap bl-body">
        <a v-for="p in pinned" :key="p.slug" class="bl-pinned parchment" :href="href(p)" :data-slug="p.slug">
          <span class="bl-kicker dark">{{ $s('blog.pinned') }} · {{ dateText(p.date) }}</span>
          <strong class="bl-pin-title">{{ titleOf(p) }}</strong>
          <span class="bl-teaser">{{ postIn(p).teaser }}</span>
          <span class="bl-more">{{ $s('blog.read') }} →</span>
        </a>
        <ol class="bl-list" data-testid="blog-list">
          <li v-for="p in listed" :key="p.slug" :class="['bl-item', { newday: p.newDay }]" :data-slug="p.slug">
            <p v-if="p.newDay" class="bl-day">{{ p.dayName }}</p>
            <div class="bl-row">
              <span class="bl-seal" aria-hidden="true">{{ p.n }}</span>
              <a class="bl-card parchment" :href="href(p)">
                <span class="bl-when"><time :datetime="p.date">{{ dateText(p.date) }}</time></span>
                <strong class="bl-card-title">{{ titleOf(p) }}</strong>
                <span class="bl-teaser">{{ postIn(p).teaser }}</span>
                <span class="bl-more">{{ $s('blog.read') }} →</span>
              </a>
            </div>
          </li>
        </ol>
      </div>
    </template>
  </SiteLayout>
</template>

<script>
import SiteLayout from '../SiteLayout.vue';
import { POSTS, postIn, postSections, slugFromLocation } from './posts.js';
import { milestone, longDate, spanText, minutesBetween, parts, sourceLinks } from './milestones.js';

const WEEKDAYS = {
  de: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
const MONTHS = {
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

export default {
  name: 'BlogPage',
  components: { SiteLayout },
  data() {
    const slug = typeof location === 'undefined' ? null : slugFromLocation(location);
    return { slug, posts: POSTS };
  },
  computed: {
    lang() { return this.$i18n.lang === 'en' ? 'en' : 'de'; },
    index() { return this.posts.findIndex((p) => p.slug === this.slug); },
    post() { return this.index < 0 ? null : this.posts[this.index]; },
    missing() { return Boolean(this.slug) && !this.post; },
    text() { return this.post ? postIn(this.post, this.lang) : null; },
    ms() { return this.post?.milestone ? milestone(this.post.slug) : null; },
    links() { return sourceLinks(this.ms); },
    sections() { return this.text ? postSections(this.text, this.lang, this.$siteRoot) : []; },
    prev() { return this.index > 0 ? this.posts[this.index - 1] : null; },
    next() { return this.index >= 0 && this.index < this.posts.length - 1 ? this.posts[this.index + 1] : null; },
    pinned() { return this.posts.filter((p) => p.pinned); },
    listed() {
      const days = [];
      let n = 0;
      return this.posts.filter((p) => !p.pinned).map((p) => {
        const pt = parts(p.date);
        const newDay = !days.includes(pt.day);
        if (newDay) days.push(pt.day);
        const wd = WEEKDAYS[this.lang][new Date(Date.UTC(pt.y, pt.mo, pt.d)).getUTCDay()];
        const dayName = this.lang === 'de' ? `${wd}, ${pt.d}. ${MONTHS.de[pt.mo]} ${pt.y}` : `${wd}, ${pt.d} ${MONTHS.en[pt.mo]} ${pt.y}`;
        return { ...p, n: ++n, newDay, dayName };
      });
    },
    pageTitle() { return this.text ? `${this.text.title} – ${this.$s('blog.title')} – Kronland` : `${this.$s('blog.title')} – Kronland`; },
  },
  watch: {
    pageTitle: { immediate: true, handler(t) { if (typeof document !== 'undefined') document.title = t; } },
  },
  mounted() {
    if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  },
  methods: {
    postIn(p) { return postIn(p, this.lang); },
    titleOf(p) { return postIn(p, this.lang).title; },
    href(p) { return `${this.$links.blog}${p.slug}/`; },
    dateText(d) { return longDate(d, this.lang); },
    span(a, b) { return spanText(a, b, this.lang); },
    num(n) { return Number(n).toLocaleString(this.lang === 'de' ? 'de-DE' : 'en-GB'); },
    signed(n) { return `${n >= 0 ? '+' : '−'}${this.num(Math.abs(n))}`; },
    duration(a, b) {
      const m = minutesBetween(a, b);
      return m < 120 ? this.$s('blog.minutes', { n: m }) : this.$s('blog.hours', { n: this.num(Math.round(m / 60)) });
    },
  },
};
</script>

<style>
.bl-head { padding-bottom: 1rem; max-width: 56rem; }
.bl-back { display: inline-flex; align-items: center; min-height: var(--touch); text-decoration: none; font-weight: 500; }
.bl-kicker { margin: 0.25rem 0 0.375rem; color: var(--gold-300); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; font-size: 0.8125rem; }
.bl-kicker.dark { color: #7a4a0c; margin: 0; }
.bl-title { font-size: clamp(1.75rem, 4.5vw, 2.75rem); }
.bl-missing { margin: 0.75rem 0 0; color: var(--gold-200); }
.bl-body { max-width: 56rem; display: flex; flex-direction: column; gap: 1.5rem; }

/* Key figures of the milestone */
.bl-facts { padding: 0.875rem 1.125rem; }
.bl-facts dl { margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 0.5rem 1.5rem; }
.bl-facts dt { color: var(--ink-muted); font-size: 0.8125rem; text-transform: uppercase; letter-spacing: 0.05em; }
.bl-facts dd { margin: 0.125rem 0 0; color: var(--gold-200); font-weight: 700; font-variant-numeric: tabular-nums; }
.bl-facts code { font-size: 0.875rem; color: var(--ink); }
.bl-src { margin: 0.75rem 0 0; display: flex; flex-wrap: wrap; gap: 0.25rem 1.5rem; }
.bl-src a { display: inline-flex; align-items: center; min-height: var(--touch); font-weight: 700; }
.bl-doc .doc-sec + .doc-sec h2 { margin-top: 2.25rem; }

/* Paging */
.bl-pager { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.bl-pg { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.875rem 1.125rem; text-decoration: none; min-height: var(--touch); }
.bl-pg span { color: var(--ink-muted); font-size: 0.875rem; }
.bl-pg strong { color: var(--gold-200); font-family: var(--display); font-size: 1.125rem; line-height: 1.2; }
.bl-pg.next { text-align: right; grid-column: 2; }
.bl-pg:hover strong { color: var(--gold-100); }

/* Overview: pinned article, below it the history as a timeline */
.bl-pinned, .bl-card { display: flex; flex-direction: column; gap: 0.25rem; padding: 1rem 1.25rem; text-decoration: none; color: var(--parch-ink) !important; transition: filter 0.15s; }
.bl-pinned:hover, .bl-card:hover { filter: brightness(1.05); }
.bl-pin-title { font-family: var(--display); color: #5a3a12; font-size: 1.625rem; line-height: 1.15; }
.bl-teaser { line-height: 1.5; }
.bl-more { font-weight: 700; color: #7a4a0c; font-size: 0.9375rem; }
.bl-list { list-style: none; margin: 0; padding: 0; position: relative; }
.bl-list::before { content: ''; position: absolute; left: 1.125rem; top: 0.5rem; bottom: 0.5rem; width: 3px; border-radius: 2px; background: linear-gradient(180deg, var(--gold-400), var(--gold-700)); }
.bl-item { margin: 0 0 0.875rem; }
.bl-day { margin: 1.5rem 0 0.625rem 3rem; font-family: var(--display); color: var(--gold-200); font-size: 1.25rem; }
.bl-item:first-child .bl-day { margin-top: 0.25rem; }
.bl-row { display: grid; grid-template-columns: 2.25rem minmax(0, 1fr); gap: 0.75rem; align-items: start; }
.bl-seal { position: relative; z-index: 1; display: inline-flex; align-items: center; justify-content: center; width: 2.25rem; height: 2.25rem; margin-top: 0.75rem; border-radius: 50%; font-weight: 700; color: #2a1a06; background: radial-gradient(circle at 35% 30%, var(--gold-200), var(--gold-500)); box-shadow: 0 0 0 3px var(--wood-900), 0 2px 6px rgba(0, 0, 0, 0.5); font-variant-numeric: tabular-nums; }
.bl-when { font-size: 0.8125rem; font-weight: 700; color: #7a4a0c; letter-spacing: 0.02em; }
.bl-card-title { font-family: var(--display); color: #5a3a12; font-size: 1.3125rem; line-height: 1.2; }

@media (max-width: 700px) {
  .bl-list::before { left: 0.875rem; }
  .bl-row { grid-template-columns: 1.75rem minmax(0, 1fr); gap: 0.5rem; }
  .bl-seal { width: 1.75rem; height: 1.75rem; font-size: 0.8125rem; }
  .bl-day { margin-left: 2.25rem; font-size: 1.125rem; }
  .bl-pinned, .bl-card { padding: 0.75rem 0.875rem; }
  .bl-pager { grid-template-columns: 1fr; }
  .bl-pg.next { grid-column: 1; }
}
@media print { .bl-pager, .bl-back { display: none; } }
</style>
