<template>
  <div class="bpanel">
    <!-- Compact key figures only if the selection card on the right is missing (narrow screens) -->
    <SelectionStats v-if="compact" :sel="sel" class="bp-stats" />

    <!-- Fire / damage: at the very top so it is not overlooked -->
    <RepairState v-if="sel.repair?.damaged" :repair="sel.repair" :own="sel.own" @repair="act({ kind: 'repair', id: sel.id })" />

    <div v-if="sel.own" class="bp-actions">
      <button
        v-if="sel.upgrade"
        v-tip="{ title: $t('bld.upgrade', { name: $name.building(sel.type, sel.upgrade.level) }), cost: sel.upgrade.cost, have, reason: sel.upgrade.reason ? $reason(sel.upgrade.reason) : null }"
        class="bp-act"
        :class="{ primary: !sel.upgrade.reason }"
        :aria-disabled="!!sel.upgrade.reason"
        data-testid="upgrade"
        @click="!sel.upgrade.reason && act({ kind: 'upgrade', id: sel.id })"
      >
        <Icon name="upgrade" />
        <span class="bp-acttext">
          <b>{{ $t('bld.upgrade', { name: $name.building(sel.type, sel.upgrade.level) }) }}</b>
          <span v-if="sel.upgrade.reason && reasonCode(sel.upgrade.reason) !== 'err.notEnoughResources'" class="bp-why">{{ $reason(sel.upgrade.reason) }}</span>
          <CostList v-else :cost="sel.upgrade.cost" :have="have" />
        </span>
      </button>
      <button
        v-if="sel.workers && sel.done"
        v-tip="$t('bld.overtimeTip')"
        class="bp-act small"
        role="switch"
        :aria-checked="!!sel.overtime"
        :class="{ active: sel.overtime }"
        data-testid="overtime"
        @click="act({ kind: 'overtime', id: sel.id, on: !sel.overtime })"
      ><Icon name="overtime" /><span>{{ $t('bld.overtime') }}</span></button>
      <button
        v-if="sel.canDemolish"
        v-tip="$t('bld.demolishTip')"
        class="bp-act small"
        :class="{ danger: confirmDemolish }"
        data-testid="demolish"
        @click="demolish"
      ><Icon name="demolish" /><span>{{ confirmDemolish ? $t('bld.demolishConfirm') : $t('bld.demolish') }}</span></button>
    </div>

    <!-- Castle: serfs, militia, taxes -->
    <section v-if="sel.own && sel.done && sel.type === 'headquarters'" class="bp-sec">
      <h4 class="h-label">{{ $t('bld.serfsTitle') }}</h4>
      <div class="bp-row">
        <button v-tip="{ title: $t('bld.buySerf'), cost: [['gold', serfCost]], have }" class="primary bp-buy" data-testid="buy-serf" @click="$emit('buy-serf', 1)">
          <Icon name="serf" /><span>{{ $t('bld.buySerf') }}</span><CostList :cost="[['gold', serfCost]]" />
        </button>
        <button v-tip="{ title: $t('bld.buySerfs'), cost: [['gold', serfCost * 5]], have }" data-testid="buy-serf-5" @click="$emit('buy-serf', 5)">{{ $t('bld.buySerfs') }}</button>
        <button
          v-if="sel.militia !== null && sel.militia !== undefined"
          v-tip="sel.militia ? $t('bld.militiaOffTip') : $t('bld.militiaOnTip')"
          :class="sel.militia ? 'active' : 'danger'"
          :aria-pressed="!!sel.militia"
          data-testid="militia"
          @click="act({ kind: 'militia', on: !sel.militia })"
        ><Icon name="militia" /> {{ sel.militia ? $t('bld.militiaOff') : $t('bld.militiaOn') }}</button>
      </div>
    </section>

    <section v-if="sel.tax" class="bp-sec">
      <h4 class="h-label"><Icon name="tax" />{{ $t('bld.tax') }}</h4>
      <div class="seg bp-tax" role="radiogroup" :aria-label="$t('bld.tax')">
        <button
          v-for="i in 5"
          :key="i"
          v-tip="sel.tax.allowed ? $t('bld.taxEffect', { p: sel.tax.percent[i - 1], m: signed(sel.tax.motivation[i - 1]) }) : $t('bld.taxLocked', { tech: $name.tech('education') })"
          role="radio"
          :aria-checked="sel.tax.level === i - 1"
          :class="{ active: sel.tax.level === i - 1 }"
          :aria-disabled="!sel.tax.allowed"
          :data-testid="'tax-' + (i - 1)"
          @click="sel.tax.allowed && act({ kind: 'tax', level: i - 1 })"
        >{{ $t('bld.tax.' + (i - 1)) }}</button>
      </div>
      <p v-if="!sel.tax.allowed" class="bp-note"><Icon name="lock" />{{ $t('bld.taxLocked', { tech: $name.tech('education') }) }}</p>
    </section>

    <!-- College -->
    <section v-if="sel.research" class="bp-sec">
      <h4 class="h-label">
        <Icon name="research" />{{ $t('bld.research') }}
        <span v-if="sel.researching" class="bp-running num">{{ $t('bld.researching', { tech: $name.tech(sel.researching.tech), p: sel.researching.progress }) }}</span>
      </h4>
      <div class="scroll-x bp-gridwrap"><ResearchGrid :techs="sel.research" :have="have" @research="act({ kind: 'research', id: sel.id, tech: $event })" /></div>
    </section>

    <!-- Military buildings -->
    <section v-if="sel.recruit?.length" class="bp-sec">
      <h4 class="h-label"><Icon name="banner" />{{ $t('bld.recruit') }}</h4>
      <div class="bp-cards">
        <article v-for="r in sel.recruit" :key="r.line" class="rcard inset">
          <header class="rc-head">
            <span class="rc-icon"><Icon :name="'u-' + r.line" /></span>
            <span class="rc-title">
              <b>{{ $name.unit(r.unit) }}</b>
              <span class="rc-sub">{{ $name.line(r.line) }} · <span class="rc-pips" :aria-label="$t('common.levelOf', { n: r.tier, max: r.maxTier })"><i v-for="n in r.maxTier" :key="n" :class="{ on: n <= r.tier }"></i></span></span>
            </span>
            <span class="rc-stats num">
              <span v-tip="$t('bld.statAttack')"><Icon name="attack" />{{ r.stats.attack }}</span>
              <span v-tip="$t('bld.statArmor')"><Icon name="hold" />{{ r.stats.armor }}</span>
            </span>
          </header>
          <div class="rc-btns">
            <button
              v-tip="{ title: $t('bld.recruitFull'), text: $t('bld.recruitFullSub', { n: r.soldiers }), cost: r.fullCost, have, reason: r.fullReason ? $reason(r.fullReason) : null }"
              class="rc-btn"
              :class="{ primary: !r.fullReason }"
              :aria-disabled="!!r.fullReason"
              :data-testid="'recruit-full-' + r.line"
              @click="!r.fullReason && act({ kind: 'recruit', id: sel.id, line: r.line, full: true })"
            >
              <span class="rc-btnlabel">{{ $t('bld.recruitFull') }} <small class="num">1+{{ r.soldiers }}</small></span>
              <CostList :cost="r.fullCost" :have="have" />
            </button>
            <button
              v-tip="{ title: $t('bld.recruitLeader'), cost: r.leaderCost, have, reason: r.leaderReason ? $reason(r.leaderReason) : null }"
              class="rc-btn"
              :aria-disabled="!!r.leaderReason"
              :data-testid="'recruit-leader-' + r.line"
              @click="!r.leaderReason && act({ kind: 'recruit', id: sel.id, line: r.line, full: false })"
            >
              <span class="rc-btnlabel">{{ $t('bld.recruitLeader') }}</span>
              <CostList :cost="r.leaderCost" :have="have" />
            </button>
          </div>
          <button
            v-if="r.upgrade"
            v-tip="{ title: $t('bld.upgradeLine', { unit: $name.unit(r.upgrade.unit) }), cost: r.upgrade.cost, have, reason: r.upgrade.reason ? $reason(r.upgrade.reason) : null }"
            class="rc-up"
            :aria-disabled="!!r.upgrade.reason"
            :data-testid="'upgrade-line-' + r.line"
            @click="!r.upgrade.reason && act({ kind: 'upgradeLine', line: r.line })"
          >
            <Icon name="upgrade" />
            <span>{{ $t('bld.upgradeLine', { unit: $name.unit(r.upgrade.unit) }) }}</span>
            <span v-if="r.upgrade.reason && reasonCode(r.upgrade.reason) !== 'err.notEnoughResources'" class="bp-why">{{ $reason(r.upgrade.reason) }}</span>
            <CostList v-else :cost="r.upgrade.cost" :have="have" />
          </button>
          <p v-else class="rc-max"><Icon name="crown" />{{ $t('bld.lineMax') }}</p>
        </article>
      </div>
    </section>

    <!-- Chapel -->
    <section v-if="sel.blessings" class="bp-sec">
      <h4 class="h-label"><Icon name="faith" />{{ $t('bld.blessings') }} <span class="bp-running num">{{ $t('bld.faithOf', { v: faith, cost: blessingCost }) }}</span></h4>
      <div class="meter bp-faith"><i :style="{ width: Math.min(100, (100 * faith) / blessingCost) + '%' }"></i></div>
      <div class="bp-bless">
        <button
          v-for="b in sel.blessings"
          :key="b.id"
          v-tip="{ title: $name.blessing(b.id), text: whoText(b), reason: b.reason ? $reason(b.reason) : null }"
          class="bless"
          :aria-disabled="!!b.reason"
          :data-testid="'bless-' + b.id"
          @click="!b.reason && act({ kind: 'bless', id: sel.id, blessing: b.id })"
        >
          <b>{{ $name.blessing(b.id) }}</b>
          <small>{{ whoText(b) }}</small>
        </button>
      </div>
    </section>

    <!-- Game systems: building technologies, marketplace, weather tower/power plant -->
    <MarketPanel v-if="sel.market" :market="sel.market" :have="have" :building-id="sel.id" @trade="act({ kind: 'trade', ...$event })" />
    <WeatherPanel v-if="sel.weather" :weather="sel.weather" :hints="hints" @change="act({ kind: 'changeWeather', id: sel.id, state: $event })" />
    <BuildingTechs v-if="sel.techs" :techs="sel.techs" :have="have" :researching="sel.techResearching ?? null" :speed="sel.researchSpeed ?? null" @research="act({ kind: 'researchBuilding', id: sel.id, tech: $event })" />

    <!-- Extensions of other modules (trade, weather machine, …) -->
    <section v-for="s in sel.sections ?? []" :key="s.id" class="bp-sec" :data-testid="'section-' + s.id">
      <h4 class="h-label"><Icon v-if="s.icon" :name="s.icon" />{{ label(s.title) }}</h4>
      <p v-if="s.text" class="bp-note">{{ label(s.text) }}</p>
      <div class="bp-row">
        <button
          v-for="a in s.actions ?? []"
          :key="a.id"
          v-tip="{ title: label(a.label), text: a.tip ? label(a.tip) : null, cost: a.cost, have, reason: a.reason ? $reason(a.reason) : null }"
          :class="{ active: a.active }"
          :aria-disabled="!!a.reason"
          :data-testid="'action-' + s.id + '-' + a.id"
          @click="!a.reason && act({ kind: 'command', cmd: a.cmd })"
        >
          <Icon v-if="a.icon" :name="a.icon" />{{ label(a.label) }}
          <CostList v-if="a.cost?.length" :cost="a.cost" :have="have" />
        </button>
      </div>
    </section>

    <p v-if="!sel.own" class="bp-note"><Icon name="info" />{{ $t('bld.foreign') }}</p>
    <p v-else-if="hints && !hasContent" class="bp-note"><Icon name="info" />{{ $t('bdesc.' + sel.type) }}</p>
  </div>
</template>

<script>
import CostList from '../CostList.vue';
import ResearchGrid from './ResearchGrid.vue';
import SelectionStats from './SelectionStats.vue';
import BuildingTechs from './systems/BuildingTechs.vue';
import MarketPanel from './systems/MarketPanel.vue';
import WeatherPanel from './systems/WeatherPanel.vue';
import RepairState from './systems/RepairState.vue';
import { has } from '../../i18n/index.js';

export default {
  name: 'BuildingPanel',
  components: { CostList, ResearchGrid, SelectionStats, BuildingTechs, MarketPanel, WeatherPanel, RepairState },
  props: {
    sel: { type: Object, required: true },
    have: { type: Object, required: true },
    faith: { type: Number, default: 0 },
    blessingCost: { type: Number, default: 1000 },
    serfCost: { type: Number, default: 50 },
    compact: Boolean,
    hints: { type: Boolean, default: true },
  },
  emits: ['action', 'buy-serf'],
  data() { return { confirmDemolish: false }; },
  computed: {
    hasContent() {
      const s = this.sel;
      return s.type === 'headquarters' || s.research || s.recruit?.length || s.blessings || s.sections?.length
        || s.techs || s.market || s.weather || s.repair?.damaged;
    },
  },
  watch: { 'sel.id'() { this.confirmDemolish = false; } },
  methods: {
    act(a) { this.$emit('action', a); },
    reasonCode(r) { return typeof r === 'string' ? r : r?.code; },
    signed(n) { return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0'; },
    label(v) { return typeof v === 'string' ? (has(v) ? this.$t(v) : v) : this.$tr(v); },
    whoText(b) { return b.professions ? b.professions.map((p) => this.$name.prof(p)).join(', ') : this.$t('bld.blessAll'); },
    demolish() {
      if (!this.confirmDemolish) { this.confirmDemolish = true; clearTimeout(this.dt); this.dt = setTimeout(() => { this.confirmDemolish = false; }, 4000); return; }
      this.confirmDemolish = false;
      this.act({ kind: 'demolish', id: this.sel.id });
    },
  },
};
</script>

<style>
.bpanel { display: flex; flex-direction: column; gap: 0.625rem; }
.bp-actions { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.bp-act { display: inline-flex; align-items: center; gap: 0.5rem; text-align: left; }
.bp-act .ico { width: 1.375rem; height: 1.375rem; }
.bp-act.small { font-size: var(--fs-sm); }
.bp-acttext { display: flex; flex-direction: column; gap: 0.0625rem; }
.bp-acttext b { font-weight: 700; }
.bp-act.primary .costs { color: #3b2406; }
.bp-why { font-size: var(--fs-xs); color: var(--warn); font-weight: 700; }
.bp-act.primary .bp-why { color: #6b2a06; }
.bp-sec { display: flex; flex-direction: column; gap: 0.375rem; }
.bp-sec .h-label .ico { width: 1.125rem; height: 1.125rem; }
.bp-running { text-transform: none; letter-spacing: 0; color: var(--gold-200); font-weight: 700; margin-left: auto; order: 3; }
.bp-row { display: flex; flex-wrap: wrap; gap: 0.375rem; align-items: center; }
.bp-row > button { display: inline-flex; align-items: center; gap: 0.4375rem; }
.bp-buy .costs { color: #3b2406; }
.bp-tax { max-width: 34rem; }
.bp-tax > button { font-size: var(--fs-sm); }
.bp-note { margin: 0; display: flex; align-items: center; gap: 0.375rem; color: var(--ink-muted); font-size: var(--fs-sm); }
.bp-note .ico { width: 1rem; height: 1rem; }
.bp-gridwrap { padding-bottom: 2px; }
.bp-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr)); gap: 0.5rem; }
.rcard { padding: 0.5rem; display: flex; flex-direction: column; gap: 0.375rem; }
.rc-head { display: flex; align-items: center; gap: 0.5rem; }
.rc-icon { flex: none; width: 2.5rem; height: 2.5rem; display: grid; place-items: center; border-radius: 50%; background: radial-gradient(circle at 50% 35%, #fbf1d6, #d7bb86); box-shadow: inset 0 0 0 2px var(--gold-500), 0 1px 3px rgba(0, 0, 0, 0.5); }
.rc-icon .ico { width: 1.875rem; height: 1.875rem; }
.rc-title { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.rc-title b { font-family: var(--display); color: var(--gold-200); font-size: var(--fs-md); line-height: 1.1; }
.rc-sub { color: var(--ink-muted); font-size: var(--fs-xs); display: flex; align-items: center; gap: 0.25rem; }
.rc-pips { display: inline-flex; gap: 2px; }
.rc-pips i { width: 0.5rem; height: 0.5rem; border-radius: 1px; transform: rotate(45deg); background: rgba(255, 225, 170, 0.15); }
.rc-pips i.on { background: var(--gold-300); }
.rc-stats { display: flex; gap: 0.5rem; font-size: var(--fs-sm); font-weight: 700; }
.rc-stats span { display: inline-flex; align-items: center; gap: 0.1875rem; }
.rc-stats .ico { width: 1rem; height: 1rem; }
.rc-btns { display: grid; grid-template-columns: 1.3fr 1fr; gap: 0.375rem; }
.rc-btn { display: flex; flex-direction: column; align-items: flex-start; gap: 0.125rem; text-align: left; }
.rc-btnlabel { font-weight: 700; font-size: var(--fs-sm); }
.rc-btnlabel small { opacity: 0.75; }
.rc-btn.primary .costs { color: #3b2406; }
.rc-up { display: flex; align-items: center; gap: 0.4375rem; flex-wrap: wrap; font-size: var(--fs-sm); text-align: left; min-height: 2.25rem; }
.rc-up .ico { width: 1.125rem; height: 1.125rem; }
.rc-max { margin: 0; display: flex; align-items: center; gap: 0.375rem; color: var(--gold-300); font-size: var(--fs-sm); }
.rc-max .ico { width: 1rem; height: 1rem; }
.bp-faith { height: 0.5rem; }
.bp-bless { display: grid; grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr)); gap: 0.375rem; }
.bless { display: flex; flex-direction: column; align-items: flex-start; text-align: left; gap: 0.0625rem; }
.bless small { color: var(--ink-muted); font-size: var(--fs-xs); line-height: 1.2; }
@media (max-width: 760px) {
  .bp-cards { grid-template-columns: 1fr; }
  .bp-tax > button { padding-inline: 0.25rem; font-size: var(--fs-xs); }
}
</style>
