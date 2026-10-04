<template>
  <!-- Expansion: selected thieves and scouts (data from src/game/addonUi.js) -->
  <div class="spanel" data-testid="specialist-panel">
    <p v-if="sel.mode" class="sp-mode" data-testid="specialist-mode"><Icon :name="'ab-' + sel.mode" />{{ touch ? $t('addon.pickTouch') : $t('addon.pick.' + sel.mode) }}</p>
    <div class="ap-body">
      <article v-for="u in sel.units" :key="u.id" class="hcard inset sp-card" :class="{ veiled: u.hidden }" :data-testid="'specialist-' + u.spec">
        <span class="hc-portrait"><Icon :name="'sp-' + u.spec" /></span>
        <span class="hc-info">
          <b>{{ $t('addon.spec.' + u.spec) }}</b>
          <small>
            {{ $t('addon.order.' + u.order) }}
            <template v-if="u.spec === 'thief'"> · <span :class="u.hidden ? 'sp-hidden' : 'sp-seen'">{{ $t(u.hidden ? 'addon.hidden' : 'addon.seen') }}</span></template>
          </small>
          <small v-if="u.carry" class="sp-carry" data-testid="specialist-carry">{{ $t('addon.carry', { gold: u.carry.gold, amount: u.carry.amount, res: u.carry.res ? $name.res(u.carry.res) : '' }) }}</small>
          <span class="meter hp"><i :style="{ width: (100 * u.hp) / u.maxHp + '%' }"></i></span>
        </span>
        <span class="hc-abilities">
          <button
            v-for="(a, i) in u.abilities"
            :key="a.id"
            v-tip="{ title: $t('addon.ab.' + a.id), text: $t('addon.abDesc.' + a.id), reason: a.readyIn > 0 ? $t('army.readyIn', { s: a.readyIn }) : null, key: touch || sel.units.length > 1 ? null : String(i + 1) }"
            class="ability"
            :class="{ ready: a.readyIn === 0, active: sel.mode === a.id }"
            :aria-disabled="a.readyIn > 0"
            :aria-pressed="a.targeted ? sel.mode === a.id : null"
            :aria-label="$t('addon.ab.' + a.id) + (a.readyIn ? ' – ' + $t('army.readyIn', { s: a.readyIn }) : '')"
            :data-testid="'special-' + a.id"
            @click="!a.readyIn && act(a.id)"
          >
            <Icon :name="'ab-' + a.id" />
            <span v-if="a.readyIn > 0" class="cd" :style="{ '--cd': Math.round(a.frac * 100) / 100 }" aria-hidden="true"></span>
            <span v-if="a.readyIn > 0" class="cd-num num">{{ a.readyIn }}</span>
            <span class="ab-name">{{ $t('addon.ab.' + a.id) }}</span>
          </button>
          <button v-tip="{ title: $t('addon.ab.stop'), text: $t('addon.abDesc.stop') }" class="ability ready sp-stop" :aria-label="$t('addon.ab.stop')" data-testid="special-stop" @click="act('stop')">
            <Icon name="ab-stop" /><span class="ab-name">{{ $t('addon.ab.stop') }}</span>
          </button>
        </span>
      </article>
    </div>
    <p v-if="hints" class="ap-hint">{{ touch ? $t('addon.hintTouch') : $t('addon.hint') }}</p>
  </div>
</template>

<script>
export default {
  name: 'SpecialistPanel',
  props: { sel: { type: Object, required: true }, touch: Boolean, hints: { type: Boolean, default: true } },
  emits: ['action'],
  mounted() {
    // Keys 1/2: abilities of the first specialist
    this.onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
      const a = this.sel.units[0]?.abilities[Number(e.key) - 1];
      if (a && !a.readyIn) this.act(a.id);
    };
    window.addEventListener('keydown', this.onKey);
  },
  beforeUnmount() { window.removeEventListener('keydown', this.onKey); },
  methods: {
    act(action) { this.$emit('action', { kind: 'special', action }); },
  },
};
</script>

<style>
.spanel { display: flex; flex-direction: column; gap: 0.5rem; }
.sp-mode { margin: 0; display: flex; align-items: center; gap: 0.5rem; font-weight: 700; color: var(--gold-200); }
.sp-mode .ico { width: 1.375rem; height: 1.375rem; }
.sp-card.veiled .hc-portrait { box-shadow: inset 0 0 0 2px #b0a4d0, 0 0 0 2px var(--wood-950), 0 0 10px rgba(176, 164, 208, 0.6); }
.sp-hidden { color: #c9bfe6; font-weight: 700; }
.sp-seen { color: var(--bad); font-weight: 700; }
.sp-carry { color: var(--gold-200); }
.ability.active { box-shadow: inset 0 0 0 2px var(--wood-950), inset 0 0 0 3.5px #fff2b0, 0 0 14px rgba(255, 242, 176, 0.75); }
.sp-stop > .ico { width: 1.625rem; height: 1.625rem; }
</style>
