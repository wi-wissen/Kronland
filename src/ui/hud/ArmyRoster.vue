<template>
  <!-- Who is selected: hero cards, captains with experience, otherwise squads grouped by type, militia and serfs.
       Desktop: in the selection card bottom right (dense); phone and narrow windows: in the command panel. -->
  <div class="ap-body" :class="{ dense }">
    <!-- a single hero: the heading already names him, only health or unconsciousness -->
    <div v-if="solo" class="ar-solo" :data-testid="'hero-' + solo.hero">
      <span class="ar-label"><Icon name="hp" />{{ $t('bld.hp') }}</span>
      <b v-if="solo.down" class="hc-down">{{ $t('army.heroDown') }}</b>
      <template v-else>
        <span class="meter hp"><i :style="{ width: (100 * solo.hp) / Math.max(1, solo.maxHp) + '%' }"></i></span>
        <b class="num">{{ solo.hp }}<small>/{{ solo.maxHp }}</small></b>
      </template>
    </div>
    <article v-for="h in (solo ? [] : sel.heroes)" :key="h.id" class="hcard inset" :class="{ down: h.down }" :data-testid="'hero-' + h.hero">
      <span class="hc-portrait"><Icon :name="'hero-' + h.hero" /></span>
      <span class="hc-info">
        <b>{{ $name.hero(h.hero) }}</b>
        <small>{{ $name.heroTitle(h.hero) }}</small>
        <span v-if="h.down" class="hc-down">{{ $t('army.heroDown') }}</span>
        <span v-else class="meter hp"><i :style="{ width: (100 * h.hp) / h.maxHp + '%' }"></i></span>
      </span>
    </article>

    <!-- Captains with experience (stars, rank, progress to the next star) -->
    <div v-if="sel.leaders?.length" class="ap-leaders" data-testid="leader-cards">
      <article
        v-for="l in shownLeaders"
        :key="l.id"
        v-tip="leaderTip(l)"
        class="lcard inset"
        :class="{ veteran: l.stars > 0 }"
        tabindex="0"
        :data-testid="'leader-' + l.id"
      >
        <span class="lc-icon"><Icon :name="'u-' + l.line" /></span>
        <span class="lc-info">
          <b>{{ $name.unit(l.unit) }}</b>
          <span class="lc-rank">
            <span class="stars" :aria-label="$t('army.stars', { n: l.stars })"><Icon v-for="n in 5" :key="n" :name="n <= l.stars ? 'star' : 'starEmpty'" /></span>
            <small data-testid="leader-rank">{{ $name.rank(l.rank) }}</small>
          </span>
          <span class="meter hp lc-hp"><i :style="{ width: (100 * l.hp) / Math.max(1, l.maxHp) + '%' }"></i></span>
          <span class="meter lc-xp" :aria-label="l.next === null ? $t('army.xpMax') : $t('army.xp', { xp: l.xp, next: l.next })"><i :style="{ width: Math.round(l.frac * 100) + '%' }"></i></span>
        </span>
        <span class="lc-troop num"><Icon name="soldiers" />{{ l.soldiers }}<small>/{{ l.maxSoldiers }}</small></span>
      </article>
      <span v-if="sel.leaders.length > shownLeaders.length" class="lc-more num">+{{ sel.leaders.length - shownLeaders.length }}</span>
    </div>

    <div v-if="showGroups || sel.militia || sel.serfs" class="ap-groups">
      <div v-for="g in (showGroups ? sel.groups : [])" :key="g.unit" v-tip="{ title: $name.unit(g.unit), text: $name.line(g.line), lines: [[$t('army.soldiers', { n: g.soldiers }), g.soldiers + '/' + g.maxSoldiers]] }" class="gcard inset" tabindex="0">
        <span class="gc-icon"><Icon :name="'u-' + g.line" /><i v-if="g.count > 1" class="gc-count num">{{ g.count }}×</i></span>
        <span class="gc-info">
          <b>{{ $name.unit(g.unit) }}<span v-if="g.stars" class="gc-stars" :aria-label="$t('army.stars', { n: g.stars })"><Icon name="star" />{{ g.stars }}</span></b>
          <span class="pips small" :aria-label="g.soldiers + '/' + g.maxSoldiers"><i v-for="n in Math.min(16, g.maxSoldiers)" :key="n" :class="{ on: n <= g.soldiers }"></i></span>
          <span class="meter hp"><i :style="{ width: (100 * g.hp) / Math.max(1, g.maxHp) + '%' }"></i></span>
        </span>
      </div>
      <div v-if="sel.militia" class="gcard inset">
        <span class="gc-icon"><Icon name="militia" /><i class="gc-count num">{{ sel.militia }}×</i></span>
        <span class="gc-info"><b>{{ $t('army.militia') }}</b></span>
      </div>
      <div v-if="sel.serfs" class="gcard inset">
        <span class="gc-icon"><Icon name="serf" /></span>
        <span class="gc-info"><b>{{ $t('army.serfs', { n: sel.serfs }) }}</b></span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ArmyRoster',
  props: {
    sel: { type: Object, required: true },
    /** Selection card on the desktop: one column, fewer captain cards */
    dense: Boolean,
  },
  computed: {
    /** Exactly one hero and nothing else */
    solo() { const s = this.sel; return s.heroes.length === 1 && !s.groups.length && !s.militia && !s.serfs ? s.heroes[0] : null; },
    /** Most experienced first, at most 8 cards in the panel (4 in the card), more do not fit sensibly */
    shownLeaders() { return [...(this.sel.leaders ?? [])].sort((a, b) => b.xp - a.xp).slice(0, this.dense ? 4 : 8); },
    /** Group overview only if not all captains appear as a card */
    showGroups() { return this.sel.groups.length > 0 && (this.sel.leaders?.length ?? 0) > this.shownLeaders.length; },
  },
  methods: {
    leaderTip(l) {
      const perks = [];
      for (let n = 1; n <= l.stars; n++) perks.push(['★'.repeat(n) + ' ' + this.$t('rdesc.' + n), '']);
      return {
        title: this.$name.unit(l.unit) + ' · ' + this.$name.rank(l.rank),
        text: l.next === null ? this.$t('army.xpMax') : this.$t('army.xp', { xp: l.xp, next: l.next }),
        lines: perks.length ? perks : null,
      };
    },
  },
};
</script>

<style>
.ap-body { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: stretch; }
.hcard { display: flex; align-items: center; gap: 0.625rem; padding: 0.4375rem 0.5rem; flex: 1 1 20rem; }
.hcard.down .hc-portrait { filter: grayscale(1) brightness(0.7); }
.hc-portrait { flex: none; width: 3.5rem; height: 3.5rem; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 50% 35%, #fbf1d6, #c9a66b); box-shadow: inset 0 0 0 2px var(--gold-400), 0 0 0 2px var(--wood-950), 0 2px 6px rgba(0, 0, 0, 0.5); }
.hc-portrait .ico { width: 2.75rem; height: 2.75rem; }
/* Painted portrait fills the circle inside the gold ring */
.hc-portrait .ico.portrait { width: calc(100% - 4px); height: calc(100% - 4px); border-radius: 50%; }
.hc-info { display: flex; flex-direction: column; gap: 0.125rem; min-width: 5.5rem; flex: 1; }
.hc-info b { font-family: var(--display); color: var(--gold-200); font-size: var(--fs-lg); line-height: 1; }
.hc-info small { color: var(--ink-muted); font-size: var(--fs-xs); }
.hc-info .meter { margin-top: 0.25rem; height: 0.3125rem; }
.hc-down { color: var(--bad); font-size: var(--fs-xs); font-weight: 700; }

.ap-groups { display: flex; flex-wrap: wrap; gap: 0.375rem; flex: 1 1 18rem; align-content: flex-start; }
.gcard { display: flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0.5rem; min-width: 10.5rem; flex: 1 1 10.5rem; outline-offset: 0; }
.gc-icon { position: relative; flex: none; width: 2.5rem; height: 2.5rem; border-radius: 0.375rem; display: grid; place-items: center; background: radial-gradient(circle at 50% 35%, #fbf1d6, #d7bb86); box-shadow: inset 0 0 0 1px rgba(90, 60, 20, 0.45); }
.gc-icon .ico { width: 2rem; height: 2rem; }
.gc-count { position: absolute; right: -6px; bottom: -6px; font-style: normal; font-size: 0.6875rem; font-weight: 700; padding: 1px 4px; border-radius: 1rem; background: var(--wood-800); color: var(--gold-200); box-shadow: 0 0 0 1px var(--wood-950); }
.gc-info { display: flex; flex-direction: column; gap: 0.1875rem; min-width: 0; flex: 1; }
.gc-info b { font-size: var(--fs-sm); line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gc-info .meter { height: 0.25rem; }
.pips.small i { width: 0.4375rem; height: 0.4375rem; }
.ap-leaders { display: grid; grid-template-columns: repeat(auto-fill, minmax(13.5rem, 1fr)); gap: 0.375rem; flex: 1 1 100%; align-items: stretch; }
.lcard { display: flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0.5rem; min-width: 0; }
.lcard.veteran { box-shadow: inset 0 0 0 1px rgba(243, 200, 94, 0.45), var(--inset-edge); }
.lc-icon { flex: none; width: 2.5rem; height: 2.5rem; border-radius: 0.375rem; display: grid; place-items: center; background: radial-gradient(circle at 50% 35%, #fbf1d6, #d7bb86); box-shadow: inset 0 0 0 1px rgba(90, 60, 20, 0.45); }
.lc-icon .ico { width: 2rem; height: 2rem; }
.lc-info { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; flex: 1; }
.lc-info b { font-size: var(--fs-sm); line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lc-rank { display: flex; align-items: center; flex-wrap: wrap; gap: 0 0.375rem; }
.lc-rank small { font-size: var(--fs-xs); color: var(--gold-200); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.stars { display: inline-flex; gap: 1px; }
.stars .ico { width: 0.875rem; height: 0.875rem; }
.lc-xp, .lc-hp { height: 0.1875rem; }
.lc-xp > i { background: linear-gradient(180deg, #fff1c4, #e1a83a); }
.lc-troop { display: inline-flex; align-items: center; gap: 0.1875rem; font-weight: 700; font-size: var(--fs-sm); }
.lc-troop .ico { width: 1rem; height: 1rem; }
.lc-troop small { color: var(--ink-dim); font-weight: 500; }
.lc-more { align-self: center; color: var(--ink-muted); font-weight: 700; }
.gc-stars { display: inline-flex; align-items: center; gap: 1px; margin-left: 0.25rem; color: var(--gold-200); font-size: var(--fs-xs); }
.gc-stars .ico { width: 0.75rem; height: 0.75rem; }

.ar-solo { flex: 1 1 100%; display: grid; grid-template-columns: auto 1fr auto; gap: 0.5rem; align-items: center; font-size: var(--fs-sm); }
.ar-label { display: inline-flex; align-items: center; gap: 0.3125rem; color: var(--ink-muted); white-space: nowrap; }
.ar-label .ico { width: 1rem; height: 1rem; }
.ar-solo b small { color: var(--ink-dim); font-weight: 500; }
.ap-body.dense .ar-solo { font-size: var(--fs-xs); gap: 0.375rem; }

/* Selection card: one narrow column, smaller cards */
.ap-body.dense { flex-direction: column; flex-wrap: nowrap; gap: 0.3125rem; }
.ap-body.dense .hcard { flex: none; gap: 0.5rem; padding: 0.3125rem 0.4375rem; }
.ap-body.dense .hc-portrait { width: 2.5rem; height: 2.5rem; }
.ap-body.dense .hc-portrait .ico { width: 2rem; height: 2rem; }
.ap-body.dense .hc-info b { font-size: var(--fs-md, 1rem); }
.ap-body.dense .ap-leaders { grid-template-columns: 1fr; gap: 0.3125rem; flex: none; }
.ap-body.dense .lcard, .ap-body.dense .gcard { padding: 0.25rem 0.4375rem; }
.ap-body.dense .lc-icon, .ap-body.dense .gc-icon { width: 2rem; height: 2rem; }
.ap-body.dense .lc-icon .ico, .ap-body.dense .gc-icon .ico { width: 1.625rem; height: 1.625rem; }
.ap-body.dense .lc-more { align-self: flex-end; font-size: var(--fs-sm); }
.ap-body.dense .ap-groups { flex: none; flex-direction: column; flex-wrap: nowrap; gap: 0.3125rem; }
.ap-body.dense .gcard { min-width: 0; flex: none; }

@media (max-width: 760px), (max-height: 480px) and (orientation: landscape) {
  .hc-portrait { width: 3rem; height: 3rem; }
  .ap-leaders { grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr)); }
  .lc-troop { display: none; }
}
</style>
