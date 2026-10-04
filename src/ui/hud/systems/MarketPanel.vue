<template>
  <!-- Marketplace: choose goods (pay with / receive), amount in steps of 50, live price, running trade -->
  <section class="bp-sec mk" data-testid="market-panel">
    <h4 class="h-label">
      <Icon name="market" />{{ $t('sys.market') }}
      <span class="bp-running num" :class="{ warnc: !market.traders }"><Icon name="worker" />{{ $t('sys.marketTraders', { n: market.traders }) }}</span>
    </h4>

    <div v-if="market.trade" class="mk-running inset" data-testid="trade-running">
      <span class="mk-pair">
        <Icon :name="market.trade.give" /><b class="num">{{ market.trade.cost }}</b>
        <Icon name="next" class="mk-arrow" />
        <Icon :name="market.trade.take" /><b class="num">{{ market.trade.amount }}</b>
      </span>
      <span class="meter"><i :style="{ width: market.trade.percent + '%' }"></i></span>
      <b class="num mk-pct">{{ $t('sys.tradeRunning', { p: market.trade.percent }) }}</b>
    </div>
    <p v-else-if="!market.traders" class="bp-note warnc"><Icon name="warning" />{{ $t('sys.marketNoTraders') }}</p>

    <div class="mk-form">
      <div class="mk-side">
        <span class="mk-lbl">{{ $t('sys.give') }}</span>
        <div class="mk-res" role="radiogroup" :aria-label="$t('sys.give')">
          <button
            v-for="r in resList"
            :key="r"
            v-tip="{ title: $name.res(r), text: priceText(r) }"
            role="radio"
            class="mk-chip"
            :class="{ active: give === r }"
            :aria-checked="give === r"
            :aria-label="$name.res(r)"
            :disabled="take === r"
            :data-testid="'market-give-' + r"
            @click="setGive(r)"
          ><Icon :name="r" /><small class="num">{{ fmt(have[r] ?? 0) }}</small></button>
        </div>
      </div>
      <button v-tip="$t('sys.swap')" class="icon-btn mk-swap" :aria-label="$t('sys.swap')" data-testid="market-swap" @click="swap"><Icon name="trade" /></button>
      <div class="mk-side">
        <span class="mk-lbl">{{ $t('sys.take') }}</span>
        <div class="mk-res" role="radiogroup" :aria-label="$t('sys.take')">
          <button
            v-for="r in resList"
            :key="r"
            v-tip="{ title: $name.res(r), text: priceText(r) }"
            role="radio"
            class="mk-chip"
            :class="{ active: take === r }"
            :aria-checked="take === r"
            :aria-label="$name.res(r)"
            :disabled="give === r"
            :data-testid="'market-take-' + r"
            @click="setTake(r)"
          ><Icon :name="r" /><small class="num" :class="trendClass(r)">{{ trend(r) }}</small></button>
        </div>
      </div>
    </div>

    <div class="mk-deal">
      <div class="mk-amount" role="group" :aria-label="$t('sys.amount')">
        <button class="icon-btn" :aria-label="'−' + market.step" :disabled="amount <= market.step" data-testid="market-minus" @click="amount -= market.step"><Icon name="minus" /></button>
        <b class="num mk-amt" data-testid="market-amount">{{ amount }}</b>
        <button class="icon-btn" :aria-label="'+' + market.step" :disabled="amount >= market.maxAmount" data-testid="market-plus" @click="amount += market.step"><Icon name="plus" /></button>
      </div>
      <div class="mk-preview" data-testid="market-preview">
        <span><small>{{ $t('sys.youPay') }}</small><b class="num" :class="{ short: quote && (have[give] ?? 0) < quote.cost }"><Icon :name="give" />{{ quote ? quote.cost : '–' }}</b></span>
        <Icon name="next" class="mk-arrow" />
        <span><small>{{ $t('sys.youGet') }}</small><b class="num"><Icon :name="take" />{{ amount }}</b></span>
      </div>
      <button
        v-tip="{ title: $t('sys.tradeOf', { amount, take: $name.res(take), cost: quote?.cost ?? '–', give: $name.res(give) }), reason: quote?.reason ? $reason(quote.reason) : null }"
        class="mk-go"
        :class="{ primary: quote && !quote.reason }"
        :aria-disabled="!quote || !!quote.reason"
        data-testid="trade-go"
        @click="go"
      ><Icon name="trade" />{{ $t('sys.tradeGo') }}</button>
    </div>
    <p v-if="quote?.reason && !market.trade" class="bp-note mk-why"><Icon name="info" />{{ $reason(quote.reason) }}</p>
  </section>
</template>

<script>
export default {
  name: 'MarketPanel',
  props: {
    market: { type: Object, required: true },
    have: { type: Object, required: true },
    buildingId: { type: Number, required: true },
  },
  emits: ['trade'],
  data() { return { give: 'gold', take: 'wood', amount: 50 }; },
  computed: {
    resList() { return this.market.prices.map((p) => p.res); },
    quote() {
      const q = this.market.quotes?.[`${this.give}>${this.take}`];
      return q ? q[Math.max(0, Math.round(this.amount / this.market.step) - 1)] ?? null : null;
    },
  },
  methods: {
    setGive(r) { if (r !== this.take) this.give = r; },
    setTake(r) { if (r !== this.give) this.take = r; },
    swap() { [this.give, this.take] = [this.take, this.give]; },
    price(r) { return this.market.prices.find((p) => p.res === r); },
    priceText(r) {
      const p = this.price(r);
      return p ? this.$t('sys.priceTrend', { base: p.base.toFixed(2), v: p.price.toFixed(2) }) : '';
    },
    trend(r) {
      const p = this.price(r);
      if (!p || r === 'gold') return '';
      const d = Math.round(((p.price - p.base) / p.base) * 100);
      return d > 0 ? `+${d}%` : d < 0 ? `−${-d}%` : '±0';
    },
    trendClass(r) {
      const p = this.price(r);
      if (!p || p.price === p.base) return '';
      return p.price > p.base ? 'up' : 'down';
    },
    fmt(n) { return n >= 10000 ? Math.round(n / 1000) + 'k' : String(n); },
    go() {
      if (!this.quote || this.quote.reason) return;
      this.$emit('trade', { id: this.buildingId, give: this.give, take: this.take, amount: this.amount });
    },
  },
};
</script>

<style>
.mk .bp-running { display: inline-flex; align-items: center; gap: 0.25rem; }
.mk .bp-running .ico { width: 1rem; height: 1rem; }
.warnc { color: var(--warn) !important; }
.mk-running { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.625rem; padding: 0.375rem 0.625rem; box-shadow: inset 0 0 0 1px var(--gold-400), 0 0 10px rgba(243, 200, 94, 0.25); }
.mk-pair { display: inline-flex; align-items: center; gap: 0.25rem; font-size: var(--fs-sm); }
.mk-pair .ico { width: 1.125rem; height: 1.125rem; }
.mk-arrow { width: 1rem !important; height: 1rem !important; color: var(--gold-300); }
.mk-pct { font-size: var(--fs-xs); color: var(--gold-200); }
.mk-running .meter { height: 0.5rem; }
.mk-form { display: grid; grid-template-columns: 1fr auto 1fr; gap: 0.5rem; align-items: end; }
.mk-side { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
.mk-lbl { font-size: var(--fs-xs); color: var(--ink-muted); font-weight: 700; }
.mk-res { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.25rem; }
.mk-chip { display: flex; flex-direction: column; align-items: center; gap: 0.0625rem; padding: 0.25rem 0.125rem; min-height: 2.75rem; }
.mk-chip .ico { width: 1.375rem; height: 1.375rem; }
.mk-chip small { font-size: 0.6875rem; color: var(--ink-muted); line-height: 1; min-height: 0.6875rem; }
.mk-chip small.up { color: var(--bad); }
.mk-chip small.down { color: var(--good); }
.mk-chip.active small { color: var(--gold-100); }
.mk-chip:disabled { opacity: 0.35; }
.mk-swap { align-self: center; }
.mk-deal { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; }
.mk-amount { display: inline-flex; align-items: center; gap: 0.25rem; padding: 3px; border-radius: var(--r-md); background: var(--inset-bg); box-shadow: var(--inset-edge); }
.mk-amt { min-width: 2.75rem; text-align: center; font-size: var(--fs-md); color: var(--gold-200); }
.mk-preview { display: inline-flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 12rem; }
.mk-preview > span { display: flex; flex-direction: column; gap: 0.0625rem; }
.mk-preview small { font-size: var(--fs-xs); color: var(--ink-muted); }
.mk-preview b { display: inline-flex; align-items: center; gap: 0.25rem; font-size: var(--fs-md); }
.mk-preview b .ico { width: 1.25rem; height: 1.25rem; }
.mk-preview b.short { color: var(--bad); }
.mk-go { display: inline-flex; align-items: center; gap: 0.375rem; font-weight: 700; min-width: 7rem; justify-content: center; }
.mk-why { color: var(--warn); }
@media (max-width: 760px) {
  .mk-form { grid-template-columns: 1fr; }
  .mk-form { gap: 0.25rem; }
  .mk-swap { justify-self: center; min-height: 2rem; height: 2rem; transform: rotate(90deg); }
  .mk-chip { min-height: var(--touch); }
  .mk-go { flex: 1; min-height: var(--touch); }
}
</style>
