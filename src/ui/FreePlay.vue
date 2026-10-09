<template>
  <!-- Free play: a map (random or chosen), the players, the rules. No technical words in the main flow. -->
  <div class="freeplay backdrop" data-testid="free-menu">
    <div class="fp-wrap">
      <header class="fp-head">
        <button class="lib-back" data-testid="free-back" @click="onBack"><Icon name="back" />{{ picking ? $t('free.title') : $t('lib.back') }}</button>
        <h1>{{ picking ? $t('free.pickTitle') : $t('free.title') }}</h1>
      </header>

      <!-- Picking a map: all ready-made maps with their picture -->
      <section v-if="picking" class="fp-pick frame" data-testid="map-picker">
        <p class="fp-count">{{ $t('free.maps', { n: maps.length }) }}</p>
        <ul class="fp-maps">
          <li v-for="m in maps" :key="m.id">
            <button class="fp-map" :class="{ active: chosenId === m.id }" :aria-pressed="chosenId === m.id" :data-testid="'map-' + m.id" @click="chosenId = m.id">
              <span class="fp-mapart" aria-hidden="true"><Icon :name="m.icon" /></span>
              <span class="fp-maptext"><b>{{ $tr(m.title) }}</b><small>{{ $tr(m.summary) }}</small></span>
              <span v-if="m.isNew" class="lib-ribbon fp-ribbon">{{ $t('free.mapNew') }}</span>
            </button>
          </li>
        </ul>
        <footer class="fp-pickfoot">
          <span class="fp-chosen">{{ chosen ? $t('free.chosen', { name: $tr(chosen.title) }) : '' }}</span>
          <button data-testid="map-cancel" @click="picking = false">{{ $t('common.cancel') }}</button>
          <button class="primary" :disabled="!chosen" data-testid="map-take" @click="take">{{ $t('free.take') }}</button>
        </footer>
      </section>

      <template v-else>
        <section class="fp-card frame">
          <h2 class="h-label">{{ $t('free.map') }}</h2>
          <div class="seg" role="radiogroup" :aria-label="$t('free.map')">
            <button role="radio" :aria-checked="mode === 'random'" :class="{ active: mode === 'random' }" data-testid="map-random" @click="mode = 'random'">{{ $t('free.random') }}</button>
            <button role="radio" :aria-checked="mode === 'pick'" :class="{ active: mode === 'pick' }" data-testid="map-choose" @click="chooseMap">{{ $t('free.pick') }}</button>
          </div>
          <template v-if="mode === 'random'">
            <div class="fp-seed">
              <input id="seed" v-model.number="seed" type="number" min="1" max="999999" :aria-label="$t('free.number')" data-testid="map-number">
              <button class="fp-roll" data-testid="map-roll" @click="seed = Math.floor(Math.random() * 99999) + 1"><Icon name="dice" />{{ $t('free.roll') }}</button>
            </div>
            <p class="fp-hint">{{ $t('free.numberHint') }}</p>
          </template>
          <div v-else-if="chosen" class="fp-chosen-card inset">
            <span class="fp-mapart" aria-hidden="true"><Icon :name="chosen.icon" /></span>
            <span class="fp-maptext"><b>{{ $tr(chosen.title) }}</b><small>{{ $tr(chosen.summary) }}</small></span>
            <button class="ghost" data-testid="map-other" @click="picking = true">{{ $t('free.other') }}</button>
          </div>
        </section>

        <section v-if="!chosen || mode === 'random'" class="fp-card frame">
          <h2 class="h-label">{{ $t('free.players') }}</h2>
          <ul class="fp-players">
            <li class="fp-player" data-testid="player-you">
              <span class="fp-avatar"><Icon :name="'hero-' + hero" /></span>
              <span class="fp-pname"><b>{{ $t('free.you', { hero: $name.hero(hero) }) }}</b><small>{{ $t('menu.hero.' + hero) }}</small></span>
              <button class="ghost" :aria-expanded="heroOpen" data-testid="hero-change" @click="heroOpen = !heroOpen">{{ heroOpen ? $t('free.heroDone') : $t('free.heroChange') }}</button>
            </li>
            <li v-if="heroOpen" class="fp-heroes">
              <button v-for="h in heroes" :key="h" class="sm-hero" :class="{ active: hero === h }" :aria-pressed="hero === h" :data-testid="'hero-pick-' + h" @click="hero = h">
                <span class="sm-heroimg"><Icon :name="'hero-' + h" /></span>
                <b>{{ $name.hero(h) }}</b>
              </button>
            </li>
            <li v-for="n in opponents" :key="n" class="fp-player" :data-testid="'opponent-' + n">
              <span class="fp-avatar fp-ai" aria-hidden="true">{{ n }}</span>
              <span class="fp-pname"><b>{{ $t('free.opponent', { n }) }}</b><small>{{ $t('menu.diff.' + difficulty) }}</small></span>
              <button class="icon-btn ghost" :aria-label="$t('free.removeOpp')" v-tip="$t('free.removeOpp')" data-testid="opp-remove" @click="opponents--"><Icon name="close" /></button>
            </li>
          </ul>
          <button v-if="opponents < 3" class="fp-add" data-testid="opp-add" @click="opponents++"><Icon name="plus" />{{ $t('free.addOpp') }}</button>
          <div v-if="opponents" class="fp-field">
            <span class="h-label">{{ $t('free.strength') }}</span>
            <div class="seg">
              <button v-for="d in ['easy', 'normal', 'hard']" :key="d" :class="{ active: difficulty === d }" :aria-pressed="difficulty === d" :data-testid="'diff-' + d" @click="difficulty = d">{{ $t('menu.diff.' + d) }}</button>
            </div>
          </div>
        </section>
        <p v-else class="fp-fixed frame" data-testid="map-fixed"><Icon name="info" />{{ $t('free.fixed') }}</p>

        <section v-if="!chosen || mode === 'random'" class="fp-card frame">
          <h2 class="h-label">{{ $t('free.rules') }}</h2>
          <div class="fp-field">
            <span class="fp-rule">{{ $t('menu.fog') }}</span>
            <div class="seg" role="radiogroup" :aria-label="$t('menu.fog')">
              <button v-for="f in [true, false]" :key="String(f)" role="radio" :aria-checked="fog === f" :class="{ active: fog === f }" :data-testid="'fog-' + (f ? 'on' : 'off')" @click="fog = f">{{ $t(f ? 'menu.fog.on' : 'menu.fog.off') }}</button>
            </div>
            <span class="fp-hint">{{ $t(fog ? 'menu.fog.hint.on' : 'menu.fog.hint.off') }}</span>
          </div>
        </section>

        <button class="primary fp-start" data-testid="start" @click="start">{{ mode === 'pick' && chosen ? $t('free.begin') : $t('free.start') }}</button>
      </template>
    </div>
  </div>
</template>

<script>
import { HERO_IDS } from '../sim/data/units.js';
import { SPECIAL_MAPS } from '../sim/missions/registry.js';
import { isNewEntry, todayString } from '../net/seen.js';
import { seen } from '../net/state.js';

const KEY = 'kronland-free';

/** Remembered choices (opponents, strength, hero, fog) – a per-player convenience, never required. */
function recall() {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}

export default {
  name: 'FreePlay',
  emits: ['back', 'start', 'mission'],
  data() {
    const r = recall();
    return {
      opponents: [0, 1, 2, 3].includes(r.opponents) ? r.opponents : 1,
      difficulty: ['easy', 'normal', 'hard'].includes(r.difficulty) ? r.difficulty : 'normal',
      hero: HERO_IDS.includes(r.hero) ? r.hero : 'nelia', heroes: HERO_IDS, fog: r.fog !== false,
      seed: Math.floor(Math.random() * 99999) + 1, mode: 'random', picking: false, chosenId: '', heroOpen: false,
    };
  },
  computed: {
    maps() {
      const today = todayString();
      return SPECIAL_MAPS.map((m) => ({ id: m.id, title: m.title, summary: m.summary, icon: m.icon ?? 'map', isNew: isNewEntry({ id: m.id, added: m.added }, seen, today) }));
    },
    chosen() { return this.maps.find((m) => m.id === this.chosenId) ?? null; },
  },
  methods: {
    chooseMap() { this.mode = 'pick'; if (!this.chosen) this.picking = true; },
    take() { this.picking = false; this.mode = 'pick'; },
    onBack() { if (this.picking) { this.picking = false; if (!this.chosen) this.mode = 'random'; } else this.$emit('back'); },
    start() {
      if (this.mode === 'pick' && this.chosen) { this.$emit('mission', this.chosen.id); return; }
      try { localStorage.setItem(KEY, JSON.stringify({ opponents: this.opponents, difficulty: this.difficulty, hero: this.hero, fog: this.fog })); } catch { /* not remembered */ }
      this.$emit('start', { players: this.opponents + 1, difficulty: this.difficulty, hero: this.hero, seed: this.seed || 1, fog: this.fog });
    },
  },
};
</script>

<style>
.fp-wrap { max-width: 40rem; margin: 0 auto; display: flex; flex-direction: column; gap: 0.75rem; }
.fp-head { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
.fp-head h1 { font-family: var(--display); color: var(--gold-200); font-size: clamp(2rem, 5vw, 2.75rem); margin: 0; letter-spacing: 0.04em; line-height: 1; text-shadow: 0 2px 0 var(--gold-800), 0 4px 12px rgba(0, 0, 0, 0.6); }
.fp-card { padding: 0.875rem 1rem 1rem; display: flex; flex-direction: column; gap: 0.625rem; }
.fp-seed { display: flex; gap: 0.5rem; }
.fp-seed input { flex: 1; min-width: 0; }
.fp-roll { gap: 0.375rem; }
.fp-hint { margin: 0; color: var(--ink-muted); font-size: var(--fs-sm); line-height: 1.4; }
.fp-chosen-card { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.625rem; flex-wrap: wrap; }
.fp-mapart { flex: none; width: 3.5rem; height: 3.5rem; border-radius: var(--r-md); display: grid; place-items: center; background: linear-gradient(160deg, #6d8a45, #2f4122); box-shadow: inset 0 0 0 1px rgba(225, 168, 58, 0.4); }
.fp-mapart .ico { width: 2rem; height: 2rem; }
.fp-maptext { display: flex; flex-direction: column; min-width: 0; flex: 1 1 10rem; gap: 0.125rem; }
.fp-maptext b { color: var(--gold-200); font-family: var(--display); font-size: var(--fs-xl); font-weight: 700; line-height: 1.1; }
.fp-maptext small { color: var(--ink-muted); font-size: var(--fs-sm); line-height: 1.35; }
.fp-players { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.375rem; }
.fp-player { display: flex; align-items: center; gap: 0.75rem; padding: 0.375rem 0.5rem; border-radius: var(--r-md); background: var(--inset-bg); box-shadow: var(--inset-edge); }
.fp-pname { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.fp-pname b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fp-pname small { color: var(--ink-muted); font-size: var(--fs-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fp-avatar { flex: none; width: 2.75rem; height: 2.75rem; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 50% 35%, #fbf1d6, #c9a66b); box-shadow: inset 0 0 0 2px var(--gold-500), 0 0 0 2px var(--wood-950); font-weight: 800; color: #3a1f06; overflow: hidden; }
.fp-avatar .ico { width: 2.25rem; height: 2.25rem; }
.fp-avatar .ico.portrait { width: 100%; height: 100%; border-radius: 50%; }
.fp-ai { background: radial-gradient(circle at 50% 35%, #8a96a8, #4b566a); color: #fff; }
.fp-heroes { list-style: none; display: grid; grid-template-columns: repeat(auto-fit, minmax(4.25rem, 1fr)); gap: 0.375rem; padding: 0.25rem 0; }
.fp-add { align-self: flex-start; gap: 0.5rem; }
.fp-field { display: flex; flex-direction: column; gap: 0.375rem; }
.fp-rule { font-weight: 700; }
.fp-start { min-height: 3.5rem; font-size: var(--fs-xl); font-family: var(--display); }
.fp-fixed { margin: 0; padding: 0.875rem 1rem; display: flex; gap: 0.5rem; align-items: center; color: var(--ink-muted); }
.fp-pick { padding: 0.875rem 1rem 1rem; display: flex; flex-direction: column; gap: 0.625rem; }
.fp-count { margin: 0; color: var(--ink-muted); font-size: var(--fs-sm); }
.fp-maps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 0.5rem; }
.fp-map { position: relative; width: 100%; display: flex; align-items: center; gap: 0.75rem; text-align: left; padding: 0.625rem; justify-content: flex-start; }
.fp-ribbon { top: 0.25rem; right: 0.25rem; left: auto; }
.fp-pickfoot { display: flex; align-items: center; gap: 0.5rem; justify-content: flex-end; flex-wrap: wrap; }
.fp-chosen { flex: 1; color: var(--gold-200); font-weight: 700; }
.sm-hero { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 0.5rem 0.25rem; }
.sm-heroimg { width: 3rem; height: 3rem; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 50% 35%, #fbf1d6, #c9a66b); box-shadow: inset 0 0 0 2px rgba(90, 60, 20, 0.5); }
.sm-hero.active .sm-heroimg { box-shadow: inset 0 0 0 2px var(--gold-300), 0 0 10px rgba(243, 200, 94, 0.5); }
.sm-heroimg .ico { width: 2.375rem; height: 2.375rem; }
.sm-heroimg .ico.portrait { width: calc(100% - 4px); height: calc(100% - 4px); border-radius: 50%; }
</style>
