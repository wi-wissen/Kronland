<template>
  <div class="apanel">
    <!-- Commands in labelled groups: stance, squads, abilities per hero -->
    <div class="acts ap-acts" role="toolbar" :aria-label="$t('army.title')">
      <div class="act-group">
        <h4>{{ $t('army.stance') }}</h4>
        <div>
          <button
            v-tip="{ title: $t('army.attack'), text: $t('army.attackTip'), key: touch ? null : 'Ctrl+⊙' }"
            class="act"
            :aria-pressed="sel.attackMode"
            data-testid="order-attack"
            @click="act({ kind: 'order', order: 'attackMove' })"
          ><Icon name="attack" /><span class="act-lbl">{{ sel.attackMode ? (touch ? $t('army.pickTargetTouch') : $t('army.pickTarget')) : $t('army.attack') }}</span></button>
          <button v-tip="{ title: $t('army.hold'), text: $t('army.holdTip') }" class="act" data-testid="order-hold" @click="act({ kind: 'order', order: 'hold' })">
            <Icon name="hold" /><span class="act-lbl">{{ $t('army.hold') }}</span>
          </button>
          <button v-tip="{ title: $t('army.defend'), text: $t('army.defendTip') }" class="act" data-testid="order-defend" @click="act({ kind: 'order', order: 'defend' })">
            <Icon name="defend" /><span class="act-lbl">{{ $t('army.defend') }}</span>
          </button>
        </div>
      </div>
      <div v-if="sel.militia" class="act-group">
        <h4>{{ $t('army.militia') }}</h4>
        <div>
          <button v-tip="{ title: $t('army.disarm'), text: $t('army.disarmTip') }" class="act" data-testid="militia-off" @click="act({ kind: 'arm', on: false })">
            <Icon name="serf" /><span class="act-lbl">{{ $t('army.disarm') }}</span>
          </button>
        </div>
      </div>
      <div v-if="sel.refill" class="act-group">
        <h4>{{ $t('army.troops') }}</h4>
        <div>
          <button v-tip="{ title: $t('army.refill'), text: $t('army.refillTip') }" class="act" data-testid="order-refill" @click="act({ kind: 'refill' })">
            <Icon name="refill" /><span class="act-lbl">{{ $t('army.refill') }}</span>
          </button>
        </div>
      </div>
      <div v-if="group && (group.current || group.next)" class="act-group">
        <h4>{{ $t('army.group') }}</h4>
        <div>
          <button
            v-tip="{ title: group.current ? $t('army.groupIs', { n: group.current }) : $t('army.groupSave', { n: group.next }), text: groupText, key: touch ? null : $t('key.shift') + '+' + (group.current || group.next) }"
            class="act"
            :aria-pressed="!!group.current"
            data-testid="group-save"
            @click="!group.current && act({ kind: 'group', n: group.next })"
          ><Icon name="banner" /><span class="act-lbl">{{ group.current ? $t('army.groupIs', { n: group.current }) : $t('army.groupSave', { n: group.next }) }}</span></button>
        </div>
      </div>
      <div v-for="h in sel.heroes" :key="h.id" class="act-group">
        <h4>{{ $t('army.abilitiesOf', { hero: $name.hero(h.hero) }) }}</h4>
        <div>
          <button
            v-for="(a, i) in h.abilities"
            :key="a.id"
            v-tip="{ title: $name.ability(a.id), text: $t('adesc.' + a.id), reason: h.down ? $t('army.heroDown') : a.readyIn > 0 ? $t('army.readyIn', { s: a.readyIn }) : null, key: touch ? null : abilityKeys[i]?.toUpperCase() }"
            class="act ability"
            :class="{ ready: !h.down && a.readyIn === 0 }"
            :aria-disabled="h.down || a.readyIn > 0"
            :aria-label="$name.ability(a.id) + (a.readyIn ? ' – ' + $t('army.readyIn', { s: a.readyIn }) : '')"
            :data-testid="'ability-' + a.id"
            @click="!h.down && !a.readyIn && act({ kind: 'ability', hero: h.id, ability: a.id })"
          >
            <span v-if="a.readyIn > 0" class="cd" :style="{ '--cd': Math.round(a.frac * 100) / 100 }" aria-hidden="true"></span>
            <Icon :name="'ab-' + a.id" />
            <span class="act-lbl">{{ $name.ability(a.id) }}<small v-if="a.readyIn > 0" class="num">{{ a.readyIn }} s</small></span>
          </button>
        </div>
      </div>
    </div>

    <!-- What the abilities and the control group do: on touch screens spelled out (no hover), on the
         desktop in the tooltip of the buttons -->
    <ul v-if="touch && explain.length" class="ap-explain" data-testid="army-explain">
      <li v-for="x in explain" :key="x.key"><Icon :name="x.icon" /><span><b>{{ x.name }}</b> {{ x.text }}</span></li>
    </ul>

    <!-- Who is selected: on the desktop in the selection card bottom right instead -->
    <template v-if="details">
      <ArmyRoster :sel="sel" />
      <p v-if="hints" class="ap-hint">{{ touch ? $t('army.hintTouch') : $t('army.hint') }}</p>
    </template>
  </div>
</template>

<script>
/** Keys of the hero abilities (the numbers belong to the control groups) */
export const ABILITY_KEYS = ['x', 'c', 'v'];

import ArmyRoster from './ArmyRoster.vue';

export default {
  name: 'ArmyPanel',
  components: { ArmyRoster },
  props: {
    sel: { type: Object, required: true },
    touch: Boolean,
    hints: { type: Boolean, default: true },
    /** Control group of the selection: { current, next } */
    group: { type: Object, default: null },
    /** Show heroes, captains and squads here (phone, narrow window without selection card) */
    details: { type: Boolean, default: true },
  },
  emits: ['action'],
  data() { return { abilityKeys: ABILITY_KEYS }; },
  mounted() {
    this.onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
      const h = this.sel.heroes?.[0];
      const a = h?.abilities[ABILITY_KEYS.indexOf(e.key.toLowerCase())];
      if (a && !h.down && !a.readyIn) this.act({ kind: 'ability', hero: h.id, ability: a.id });
    };
    window.addEventListener('keydown', this.onKey);
  },
  beforeUnmount() { window.removeEventListener('keydown', this.onKey); },
  computed: {
    /** Short explanations: abilities of all selected heroes and the control group */
    explain() {
      const out = [];
      for (const h of this.sel.heroes ?? []) {
        for (const a of h.abilities) out.push({ key: h.id + a.id, icon: 'ab-' + a.id, name: this.$name.ability(a.id), text: this.$t('adesc.' + a.id) });
      }
      const g = this.group;
      if (g && (g.current || g.next)) {
        const n = g.current || g.next;
        out.push({ key: 'group', icon: 'banner', name: this.$t('army.groupIs', { n }), text: this.groupText });
      }
      return out;
    },
    /** What the control group button does (explanation on touch, tooltip on the desktop) */
    groupText() {
      const g = this.group, n = g?.current || g?.next;
      if (!n) return '';
      return this.$t((g.current ? 'army.groupExplainIs' : 'army.groupExplainNew') + (this.touch ? 'Touch' : ''), { n });
    },
  },
  methods: {
    act(a) { this.$emit('action', a); },
  },
};
</script>

<style>
.apanel { display: flex; flex-direction: column; gap: 0.5rem; }
.ap-explain { list-style: none; margin: 0; padding: 0.375rem 0.5rem; display: flex; flex-direction: column; gap: 0.25rem; border-radius: var(--r-md); background: var(--inset-bg); box-shadow: var(--inset-edge); font-size: var(--fs-sm); color: var(--ink-muted); }
.ap-explain li { display: flex; align-items: flex-start; gap: 0.375rem; line-height: 1.3; }
.ap-explain .ico { width: 1.125rem; height: 1.125rem; flex: none; }
.ap-explain b { color: var(--gold-200); margin-right: 0.25rem; }
.ability[aria-disabled='true'] { filter: none !important; }
.ability[aria-disabled='true'] > .ico { filter: grayscale(0.7) brightness(0.7); }
.ap-hint { margin: 0; color: var(--ink-dim); font-size: var(--fs-xs); }
@media (max-width: 760px), (max-height: 480px) and (orientation: landscape) {
  /* Wrap instead of swiping sideways: the heroes' abilities otherwise lay invisible off to the right */
  .ap-acts { flex-wrap: wrap; }
}
</style>
