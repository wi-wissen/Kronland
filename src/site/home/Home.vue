<template>
  <SiteLayout page="home" overlay>
    <section class="hero" data-testid="home-hero">
      <picture class="hero-bg">
        <img :src="img('hero')" :alt="$s('home.heroAlt')" width="1440" height="900" fetchpriority="high">
      </picture>
      <div class="hero-shade" aria-hidden="true"></div>
      <div class="wrap hero-inner">
        <p class="kicker">{{ $s('home.kicker') }}</p>
        <h1 class="hero-title">{{ $t('app.title') }}</h1>
        <p class="hero-tag">{{ $s('home.tagline') }}</p>
        <div class="hero-cta">
          <a class="btn primary big" :href="$links.play" data-testid="home-play"><Icon name="play" />{{ $s('home.play') }}</a>
          <a class="btn big" :href="$links.manual"><Icon name="scroll" />{{ $s('home.manual') }}</a>
        </div>
        <p class="hero-badges">{{ $s('home.badges') }}</p>
      </div>
    </section>

    <section class="wrap what" aria-labelledby="what-title">
      <div class="what-text">
        <h2 id="what-title" class="sec-title">{{ $s('home.what.title') }}</h2>
        <p>{{ $s('home.what.p1') }}</p>
        <p>{{ $s('home.what.p2') }}</p>
        <p>{{ $s('home.what.p3', { n: counts.missions }) }}</p>
      </div>
      <dl class="facts">
        <div v-for="f in facts" :key="f.key" class="fact frame">
          <dt>{{ $s(f.key) }}</dt>
          <dd class="num">{{ f.n }}</dd>
        </div>
      </dl>
    </section>

    <section class="wrap" aria-labelledby="feat-title">
      <h2 id="feat-title" class="sec-title center">{{ $s('home.features.title') }}</h2>
      <ul class="features">
        <li v-for="f in features" :key="f.id" class="feature frame">
          <span class="f-seal"><Icon :name="f.icon" /></span>
          <h3>{{ $s('home.f.' + f.id + '.t') }}</h3>
          <p>{{ $s('home.f.' + f.id + '.d', { n: f.n }) }}</p>
        </li>
      </ul>
    </section>

    <section class="wrap" aria-labelledby="gal-title">
      <h2 id="gal-title" class="sec-title center">{{ $s('home.gallery.title') }}</h2>
      <div class="gallery" data-testid="gallery">
        <ul v-for="(row, r) in rows" :key="r" class="g-row">
          <li v-for="g in row" :key="g" :class="'g-' + g" :style="{ '--ar': ratio[g] }">
            <button type="button" class="g-btn" :aria-label="$s('home.gallery.open', { name: $s('home.shot.' + g) })" @click="open(shots.indexOf(g))">
              <img :src="img(g + '-small')" :alt="$s('home.shot.' + g)" loading="lazy" decoding="async" :style="{ aspectRatio: ratio[g] }">
            </button>
            <p class="g-cap">{{ $s('home.shot.' + g) }}</p>
          </li>
        </ul>
      </div>
    </section>

    <section class="wrap school" aria-labelledby="school-title" data-testid="home-school">
      <div class="school-text">
        <p class="kicker">{{ $s('home.school.kicker') }}</p>
        <h2 id="school-title" class="sec-title">{{ $s('home.school.title') }}</h2>
        <p>{{ $s('home.school.text') }}</p>
        <ul class="school-list">
          <li v-for="k in ['p1', 'p2', 'p3', 'p4']" :key="k"><Icon name="check" />{{ $s('home.school.' + k) }}</li>
        </ul>
        <p class="school-how">{{ $s('home.school.how') }}</p>
        <div class="hero-cta">
          <a class="btn primary" :href="$links.play + '?mission=adv1'" data-testid="home-code-play"><Icon name="play" />{{ $s('home.school.code') }}</a>
          <a class="btn" :href="$links.play + '?dev=1'" data-testid="home-dev-play"><Icon name="keyboard" />{{ $s('home.school.try') }}</a>
          <a class="btn" :href="$links.manual + '#coding'"><Icon name="scroll" />{{ $s('home.school.more') }}</a>
        </div>
      </div>
      <button type="button" class="g-btn school-shot" :aria-label="$s('home.gallery.open', { name: $s('home.shot.developer') })" @click="open(shots.indexOf('developer'))">
        <img :src="img('developer-small')" :alt="$s('home.shot.developer')" loading="lazy" decoding="async" width="720" height="450">
      </button>
    </section>

    <section class="wrap learn" aria-labelledby="learn-title">
      <h2 id="learn-title" class="sec-title center">{{ $s('home.learn.title') }}</h2>
      <div class="learn-grid">
        <a class="learn-card parchment" :href="$links.manual" data-testid="home-manual">
          <Icon name="scroll" class="lc-ico" />
          <h3>{{ $s('nav.manual') }}</h3>
          <p>{{ $s('home.learn.manual') }}</p>
          <span class="lc-go">{{ $s('home.learn.toManual') }} →</span>
        </a>
        <a class="learn-card parchment" :href="$links.compendium" data-testid="home-compendium">
          <Icon name="research" class="lc-ico" />
          <h3>{{ $s('nav.compendium') }}</h3>
          <p>{{ $s('home.learn.compendium') }}</p>
          <span class="lc-go">{{ $s('home.learn.toCompendium') }} →</span>
        </a>
      </div>
    </section>

    <section class="wrap cta frame" aria-labelledby="cta-title">
      <div>
        <h2 id="cta-title" class="sec-title">{{ $s('home.cta.title') }}</h2>
        <p>{{ $s('home.cta.text') }}</p>
      </div>
      <a class="btn primary big" :href="$links.play"><Icon name="play" />{{ $s('home.play') }}</a>
    </section>

    <dialog ref="box" class="lightbox" :aria-label="current !== null ? $s('home.shot.' + shots[current]) : ''" @click.self="close" @close="current = null">
      <figure v-if="current !== null">
        <img :src="img(shots[current])" :alt="$s('home.shot.' + shots[current])">
        <figcaption>{{ $s('home.shot.' + shots[current]) }}</figcaption>
      </figure>
      <div class="lb-ctl">
        <button type="button" class="icon-btn" :aria-label="$s('home.gallery.prev')" @click="step(-1)"><Icon name="back" /></button>
        <button type="button" class="icon-btn" :aria-label="$s('home.gallery.next')" @click="step(1)"><Icon name="next" /></button>
        <button type="button" class="icon-btn" :aria-label="$s('home.gallery.close')" @click="close"><Icon name="close" /></button>
      </div>
    </dialog>
  </SiteLayout>
</template>

<script>
import SiteLayout from '../SiteLayout.vue';
import { BUILDINGS } from '../../sim/data/buildings.js';
import { UNITS, HEROES } from '../../sim/data/units.js';
import { TECHS } from '../../sim/data/technologies.js';
import { BUILDING_TECHS } from '../../sim/data/buildingTechs.js';
import { CAMPAIGN } from '../../sim/missions/registry.js';
import { iconForLine, iconForHero, iconForWeather } from '../../ui/icons/index.js';

export default {
  name: 'HomePage',
  components: { SiteLayout },
  data() {
    return {
      // Order in the enlarged view (arrows); 'developer' is in the section "Für die Schule"
      shots: ['settlement', 'phone', 'combat', 'winter', 'fog', 'slope', 'developer'],
      // Gallery rows; width per image by aspect ratio (equal-height images per row)
      rows: [['settlement', 'phone'], ['combat', 'winter'], ['fog', 'slope']],
      ratio: { settlement: 1.6, combat: 1.6, winter: 1.6, fog: 1.6, slope: 1.6, developer: 1.6, phone: 412 / 915 },
      current: null,
      // What makes the game – from the player's point of view, numbers from the game data
      features: [
        { id: 'serfs', icon: 'serf' },
        { id: 'workers', icon: 'worker' },
        { id: 'payday', icon: 'payday' },
        { id: 'economy', icon: 'gold' },
        { id: 'research', icon: 'research' },
        { id: 'military', icon: iconForLine('sword'), n: new Set(Object.values(UNITS).map((u) => u.line)).size },
        { id: 'heroes', icon: iconForHero('nelia'), n: Object.keys(HEROES).length },
        { id: 'weather', icon: iconForWeather('winter') },
        { id: 'choices', icon: 'gold' },
        { id: 'campaign', icon: 'scroll', n: CAMPAIGN.length },
        { id: 'maps', icon: 'dice' },
        { id: 'everywhere', icon: 'display' },
      ],
      counts: { missions: CAMPAIGN.length },
      // Numbers from the game data – grow with new content
      facts: [
        { key: 'home.facts.missions', n: CAMPAIGN.length },
        { key: 'home.facts.buildings', n: Object.values(BUILDINGS).filter((b) => b.buildable !== false).length },
        { key: 'home.facts.units', n: Object.keys(UNITS).length },
        { key: 'home.facts.techs', n: Object.keys(TECHS).length + Object.keys(BUILDING_TECHS).length },
      ],
    };
  },
  methods: {
    img(name) { return `${this.$siteRoot}site/${name}.webp`; },
    open(i) { this.current = i; this.$refs.box.showModal?.(); },
    close() { this.$refs.box.close?.(); },
    step(d) { this.current = (this.current + d + this.shots.length) % this.shots.length; },
  },
};
</script>

<style>
/* ---------- Title image ---------- */
.hero { position: relative; margin-top: calc(-3.75rem - var(--safe-t)); min-height: min(92vh, 56rem); display: flex; align-items: flex-end; overflow: hidden; isolation: isolate; }
.hero-bg, .hero-bg img { position: absolute; inset: 0; width: 100%; height: 100%; }
.hero-bg { z-index: -2; pointer-events: none; }
.hero-bg img { object-fit: cover; object-position: 60% 50%; z-index: -2; }
.hero-shade { position: absolute; inset: 0; z-index: -1; pointer-events: none; background:
  linear-gradient(90deg, rgba(23, 15, 9, 0.92) 0%, rgba(23, 15, 9, 0.7) 38%, rgba(23, 15, 9, 0.1) 70%),
  linear-gradient(0deg, var(--wood-900) 0%, rgba(34, 23, 15, 0) 35%); }
.hero-inner { position: relative; width: 100%; padding-top: 7rem; padding-bottom: clamp(3rem, 9vh, 6rem); }
.kicker { margin: 0; color: var(--gold-300); font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; font-size: 0.875rem; }
.hero-title { font-family: var(--display); color: var(--gold-100); font-size: clamp(3.5rem, 11vw, 7rem); line-height: 0.95; margin: 0.25rem 0 0.75rem; letter-spacing: 0.03em; text-shadow: 0 3px 0 var(--gold-800), 0 10px 30px rgba(0, 0, 0, 0.6); }
.hero-tag { max-width: 34rem; font-size: clamp(1.125rem, 2.2vw, 1.375rem); line-height: 1.45; color: var(--ink); margin: 0 0 1.75rem; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6); }
.hero-cta { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.hero-badges { margin: 1.25rem 0 0; color: var(--ink-muted); font-size: 0.9375rem; }

.sec-title { font-family: var(--display); color: var(--gold-300); font-size: clamp(1.75rem, 4vw, 2.5rem); line-height: 1.1; margin: 0 0 1rem; letter-spacing: 0.02em; text-shadow: 0 2px 0 rgba(0, 0, 0, 0.5); }
.sec-title.center { text-align: center; }
.hero + .what, .site main > section.wrap { margin-top: clamp(3rem, 8vw, 5.5rem); }

/* ---------- What is Kronland ---------- */
.what { display: grid; grid-template-columns: 3fr 2fr; gap: 2.5rem; align-items: center; }
.what-text p { color: var(--ink); max-width: 40rem; }
.facts { display: grid; grid-template-columns: 1fr 1fr; gap: 0.875rem; margin: 0; }
.fact { padding: 1.125rem 1rem; display: flex; flex-direction: column-reverse; align-items: center; text-align: center; }
.fact dd { margin: 0; font-family: var(--display); font-size: 2.75rem; line-height: 1; color: var(--gold-200); }
.fact dt { color: var(--ink-muted); font-size: 0.9375rem; margin-top: 0.25rem; }

/* ---------- Features ---------- */
.features { list-style: none; margin: 1.5rem 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(15.5rem, 1fr)); gap: 1rem; }
.feature { padding: 1.25rem 1.25rem 1.125rem; }
.feature h3 { font-family: var(--display); color: var(--gold-200); font-size: 1.3125rem; margin: 0.75rem 0 0.375rem; }
.feature p { margin: 0; color: var(--ink-muted); line-height: 1.5; }
.f-seal { display: grid; place-items: center; width: 3.25rem; height: 3.25rem; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #6f4e2b, #3a2616); box-shadow: inset 0 0 0 2px var(--gold-500), 0 2px 6px rgba(0, 0, 0, 0.4); }
.f-seal .ico { width: 1.875rem; height: 1.875rem; }

/* ---------- Gallery ---------- */
.gallery { margin-top: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
.g-row { list-style: none; margin: 0; padding: 0; display: flex; gap: 1rem; }
.g-row li { flex: var(--ar) 1 0; min-width: 0; display: flex; flex-direction: column; }
.g-btn { display: block; padding: 0; border: 0; border-radius: var(--r-lg); overflow: hidden; background: var(--wood-950); box-shadow: var(--panel-edge); cursor: zoom-in; }
.g-btn { position: relative; }
.g-btn img { display: block; width: 100%; height: auto; object-fit: cover; transition: filter 0.2s; }
/* Hover/focus: only brighten and show a magnifier – nothing moves */
.g-btn::after { content: ''; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 2px transparent; transition: box-shadow 0.2s; pointer-events: none; }
.g-btn:hover img, .g-btn:focus-visible img { filter: brightness(1.12) saturate(1.05); }
.g-btn:hover::after, .g-btn:focus-visible::after { box-shadow: inset 0 0 0 2px var(--gold-300); }
.g-cap { margin: 0.5rem 0 0; color: var(--ink-muted); font-size: 0.9375rem; }
@media (max-width: 760px) {
  .g-row { flex-wrap: wrap; }
  .g-row li { flex: 1 1 100%; }
  .g-row li.g-phone { flex: 0 1 60%; margin-inline: auto; }
}

.lightbox { padding: 0; border: 0; background: transparent; max-width: min(96vw, 1440px); max-height: 96vh; color: var(--ink); }
.lightbox::backdrop { background: rgba(10, 6, 3, 0.88); }
.lightbox figure { margin: 0; }
.lightbox img { display: block; max-width: 100%; max-height: calc(96vh - 5rem); margin: 0 auto; border-radius: var(--r-md); box-shadow: var(--panel-edge); }
.lightbox figcaption { text-align: center; margin-top: 0.5rem; color: var(--ink-muted); }
.lb-ctl { display: flex; justify-content: center; gap: 0.5rem; margin-top: 0.5rem; }

/* ---------- For schools ---------- */
.school { display: grid; grid-template-columns: 5fr 6fr; gap: 2.5rem; align-items: center; }
.school .kicker { margin-bottom: 0.25rem; }
.school-text > p { color: var(--ink); max-width: 36rem; }
.school-list { list-style: none; margin: 1rem 0; padding: 0; display: grid; gap: 0.5rem; }
.school-list li { display: flex; gap: 0.5rem; align-items: flex-start; color: var(--ink); line-height: 1.45; }
.school-list .ico { width: 1.25rem; height: 1.25rem; flex: none; margin-top: 0.125rem; }
.school-how { color: var(--ink-muted) !important; font-size: 0.9375rem; }
.school-shot { width: 100%; }
.school-shot img { aspect-ratio: 1.6; }
@media (max-width: 860px) { .school { grid-template-columns: 1fr; } }

/* ---------- Manual / compendium ---------- */
.learn-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-top: 1.5rem; }
.learn-card { display: block; padding: 1.5rem 1.5rem 1.25rem; text-decoration: none; color: var(--parch-ink) !important; transition: filter 0.15s; }
.learn-card:hover { filter: brightness(1.05); }
.learn-card h3 { font-family: var(--display); color: #5a3a12; font-size: 1.75rem; margin: 0.5rem 0 0.25rem; }
.learn-card p { margin: 0 0 0.75rem; line-height: 1.5; }
.lc-ico { width: 2.5rem !important; height: 2.5rem !important; }
.lc-go { font-weight: 700; color: #7a4a0c; }
@media (max-width: 700px) {
  .what, .learn-grid { grid-template-columns: 1fr; }
}

.cta { width: calc(100% - 2rem); display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap; padding: 1.75rem 2rem; max-width: 72rem; }
.cta p { margin: 0; color: var(--ink-muted); }
.cta .sec-title { margin-bottom: 0.25rem; }
</style>
