<template>
  <div class="apanel">
    <div class="ap-orders" role="toolbar" :aria-label="$t('army.title')">
      <button
        v-tip="{ title: $t('army.attack'), text: $t('army.attackTip'), key: touch ? null : 'Ctrl+⊙' }"
        class="ap-order"
        :class="{ active: sel.attackMode }"
        :aria-pressed="sel.attackMode"
        data-testid="order-attack"
        @click="act({ kind: 'order', order: 'attackMove' })"
      ><Icon name="attack" /><span>{{ sel.attackMode ? (touch ? $t('army.pickTargetTouch') : $t('army.pickTarget')) : $t('army.attack') }}</span></button>
      <button v-tip="{ title: $t('army.hold'), text: $t('army.holdTip') }" class="ap-order" data-testid="order-hold" @click="act({ kind: 'order', order: 'hold' })">
        <Icon name="hold" /><span>{{ $t('army.hold') }}</span>
      </button>
      <button v-tip="{ title: $t('army.defend'), text: $t('army.defendTip') }" class="ap-order" data-testid="order-defend" @click="act({ kind: 'order', order: 'defend' })">
        <Icon name="defend" /><span>{{ $t('army.defend') }}</span>
      </button>
      <button v-if="sel.refill" v-tip="{ title: $t('army.refill'), text: $t('army.refillTip') }" class="ap-order" data-testid="order-refill" @click="act({ kind: 'refill' })">
        <Icon name="refill" /><span>{{ $t('army.refill') }}</span>
      </button>
    </div>

    <div class="ap-body">
      <article v-for="h in sel.heroes" :key="h.id" class="hcard inset" :class="{ down: h.down }" :data-testid="'hero-' + h.hero">
        <span class="hc-portrait"><Icon :name="'hero-' + h.hero" /></span>
        <span class="hc-info">
          <b>{{ $name.hero(h.hero) }}</b>
          <small>{{ $name.heroTitle(h.hero) }}</small>
          <span v-if="h.down" class="hc-down">{{ $t('army.heroDown') }}</span>
          <span v-else class="meter hp"><i :style="{ width: (100 * h.hp) / h.maxHp + '%' }"></i></span>
        </span>
        <span class="hc-abilities">
          <button
            v-for="(a, i) in h.abilities"
            :key="a.id"
            v-tip="{ title: $name.ability(a.id), text: $t('adesc.' + a.id), reason: h.down ? $t('army.heroDown') : a.readyIn > 0 ? $t('army.readyIn', { s: a.readyIn }) : null, key: touch ? null : String(i + 1) }"
            class="ability"
            :class="{ ready: !h.down && a.readyIn === 0 }"
            :aria-disabled="h.down || a.readyIn > 0"
            :aria-label="$name.ability(a.id) + (a.readyIn ? ' – ' + $t('army.readyIn', { s: a.readyIn }) : '')"
            :data-testid="'ability-' + a.id"
            @click="!h.down && !a.readyIn && act({ kind: 'ability', hero: h.id, ability: a.id })"
          >
            <Icon :name="'ab-' + a.id" />
            <span v-if="a.readyIn > 0" class="cd" :style="{ '--cd': Math.round(a.frac * 100) / 100 }" aria-hidden="true"></span>
            <span v-if="a.readyIn > 0" class="cd-num num">{{ a.readyIn }}</span>
            <span class="ab-name">{{ $name.ability(a.id) }}</span>
          </button>
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
    <p v-if="hints" class="ap-hint">{{ touch ? $t('army.hintTouch') : $t('army.hint') }}</p>
  </div>
</template>

<script>
export default {
  name: 'ArmyPanel',
  props: { sel: { type: Object, required: true }, touch: Boolean, hints: { type: Boolean, default: true } },
  emits: ['action'],
  mounted() {
    this.onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
      const h = this.sel.heroes?.[0];
      const a = h?.abilities[Number(e.key) - 1];
      if (a && !h.down && !a.readyIn) this.act({ kind: 'ability', hero: h.id, ability: a.id });
    };
    window.addEventListener('keydown', this.onKey);
  },
  beforeUnmount() { window.removeEventListener('keydown', this.onKey); },
  computed: {
    /** Most experienced first, at most 8 cards (more do not fit sensibly in the bar) */
    shownLeaders() { return [...(this.sel.leaders ?? [])].sort((a, b) => b.xp - a.xp).slice(0, 8); },
    /** Group overview only if not all captains appear as a card */
    showGroups() { return this.sel.groups.length > 0 && (this.sel.leaders?.length ?? 0) > this.shownLeaders.length; },
  },
  methods: {
    act(a) { this.$emit('action', a); },
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
.apanel { display: flex; flex-direction: column; gap: 0.5rem; }
.ap-orders { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.ap-order { display: inline-flex; align-items: center; gap: 0.4375rem; font-weight: 700; }
.ap-order .ico { width: 1.375rem; height: 1.375rem; }
.ap-body { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: stretch; }
.hcard { display: flex; align-items: center; gap: 0.625rem; padding: 0.4375rem 0.5rem; flex: 1 1 20rem; }
.hcard.down .hc-portrait { filter: grayscale(1) brightness(0.7); }
.hc-portrait { flex: none; width: 3.5rem; height: 3.5rem; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 50% 35%, #fbf1d6, #c9a66b); box-shadow: inset 0 0 0 2px var(--gold-400), 0 0 0 2px var(--wood-950), 0 2px 6px rgba(0, 0, 0, 0.5); }
.hc-portrait .ico { width: 2.75rem; height: 2.75rem; }
.hc-info { display: flex; flex-direction: column; gap: 0.125rem; min-width: 5.5rem; flex: 1; }
.hc-info b { font-family: var(--display); color: var(--gold-200); font-size: var(--fs-lg); line-height: 1; }
.hc-info small { color: var(--ink-muted); font-size: var(--fs-xs); }
.hc-info .meter { margin-top: 0.25rem; height: 0.3125rem; }
.hc-down { color: var(--bad); font-size: var(--fs-xs); font-weight: 700; }
.hc-abilities { display: flex; gap: 1rem; }
.ability {
  position: relative; width: 3.25rem; height: 3.25rem; min-width: 3.25rem; padding: 0; border-radius: 50%; display: grid; place-items: center; overflow: visible;
  background: radial-gradient(circle at 50% 35%, #6c4c32, #3a2717);
  box-shadow: inset 0 0 0 2px var(--wood-950), inset 0 0 0 3px rgba(225, 168, 58, 0.35), 0 2px 4px rgba(0, 0, 0, 0.5);
}
.ability > .ico { width: 2.125rem; height: 2.125rem; position: relative; z-index: 1; }
.ability.ready { box-shadow: inset 0 0 0 2px var(--wood-950), inset 0 0 0 3.5px var(--gold-300), 0 0 10px rgba(243, 200, 94, 0.45), 0 2px 4px rgba(0, 0, 0, 0.5); }
.ability[aria-disabled='true'] { filter: none !important; }
.ability[aria-disabled='true'] > .ico { filter: grayscale(0.7) brightness(0.7); }
.cd { position: absolute; inset: 3px; border-radius: 50%; z-index: 2; pointer-events: none; background: conic-gradient(rgba(10, 6, 3, 0.66) calc(var(--cd) * 360deg), transparent 0); }
.cd-num { position: absolute; z-index: 3; font-weight: 700; font-size: var(--fs-sm); color: #fff; text-shadow: 0 1px 2px #000, 0 0 4px #000; }
.ab-name { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 0.125rem; font-size: 0.625rem; line-height: 1.1; color: var(--ink-muted); white-space: nowrap; max-width: 4.25rem; overflow: hidden; text-overflow: ellipsis; }
.hcard { padding-bottom: 1.125rem; }
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
.ap-hint { margin: 0; color: var(--ink-dim); font-size: var(--fs-xs); }
@media (max-width: 760px), (max-height: 480px) and (orientation: landscape) {
  .ap-order span:not(.ico) { display: none; }
  .ap-order { width: var(--touch); min-width: var(--touch); min-height: var(--touch); padding: 0; justify-content: center; }
  .ap-order.active span:not(.ico) { display: inline; }
  .ap-order.active { width: auto; padding: 0 0.625rem; }
  .ability { width: var(--touch); height: var(--touch); min-width: var(--touch); }
  .hc-portrait { width: 3rem; height: 3rem; }
  .ab-name { display: none; }
  .hcard { padding-bottom: 0.4375rem; }
  .hc-abilities { gap: 0.5rem; }
  .ap-leaders { grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr)); }
  .lc-troop { display: none; }
  /* Setting "show labels": commands and abilities with names below the icon */
  .show-labels .ap-order { flex-direction: column; gap: 0; width: auto; min-width: 3.5rem; padding: 0.1875rem 0.375rem; }
  .show-labels .ap-order span:not(.ico) { display: block; font-size: 0.625rem; line-height: 1.1; max-width: 5rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .show-labels .ap-order.active { flex-direction: row; gap: 0.375rem; }
  .show-labels .ap-order.active span:not(.ico) { font-size: var(--fs-sm); max-width: none; }
  .show-labels .ab-name { display: block; max-width: 4rem; }
  .show-labels .hc-abilities { gap: 1.25rem; padding-right: 0.25rem; }
  .show-labels .hcard { padding-bottom: 1.125rem; }
}
</style>
