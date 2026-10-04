<template>
  <!-- Command bar at the bottom: minimap and quick access on the left, context panel in the middle, selection card on the right -->
  <div ref="bar" class="cmdbar" :class="{ compact, collapsed }">
    <div class="cb-left">
      <div class="cb-quick frame" role="toolbar" :aria-label="$t('ctx.overview')">
        <button v-tip="{ text: $t('quick.hqTip'), key: 'H' }" class="cb-q" data-testid="quick-hq" @click="$emit('quick', 'hq')"><Icon name="castle" /><span>{{ $t('quick.hq') }}</span></button>
        <button v-tip="{ text: $t('quick.idleTip'), key: '.' }" class="cb-q" data-testid="quick-idle" @click="$emit('quick', 'idle')"><Icon name="idle" /><span>{{ $t('quick.idle') }}</span></button>
        <button v-tip="$t('quick.allTip')" class="cb-q" data-testid="quick-all" @click="$emit('quick', 'all')"><Icon name="serf" /><span>{{ $t('quick.all') }}</span></button>
        <button
          v-if="compact"
          v-tip="{ text: $t('quick.minimapTip'), key: 'M' }"
          class="cb-q"
          :class="{ active: mapOpen }"
          :aria-pressed="mapOpen"
          data-testid="minimap-toggle"
          @click="mapOpen = !mapOpen"
        ><Icon name="map" /><span>{{ $t('quick.minimap') }}</span></button>
      </div>
      <Minimap v-if="!compact || mapOpen" :engine="engine" :touch="ui.touch" class="cb-map" />
    </div>

    <section class="context frame" :class="{ empty: !ui.placing && !sel }" data-testid="context-panel" :aria-label="panelTitle">
      <header v-if="showHead && !(compact && !ui.placing && !sel)" class="cx-head">
        <span v-if="compact && headIcon" class="cx-icon"><Icon :name="headIcon" /></span>
        <h3 class="h-title cx-title">{{ panelTitle }}</h3>
        <span v-if="headSub" class="cx-sub">{{ headSub }}</span>
        <span class="cx-tools">
          <button v-if="ui.touch && buildOpen && sel?.kind === 'serfs'" class="icon-btn ghost" :aria-label="$t('build.closeMenu')" data-testid="build-toggle" @click="buildOpen = false"><Icon name="back" /></button>
          <button v-if="compact" class="icon-btn ghost" :aria-label="collapsed ? $t('ctx.expand') : $t('ctx.collapse')" :aria-expanded="!collapsed" data-testid="panel-collapse" @click="collapsed = !collapsed">
            <Icon :name="collapsed ? 'chevronUp' : 'chevronDown'" />
          </button>
          <button v-if="ui.selection && compact" v-tip="$t('ctx.deselect')" class="icon-btn ghost" :aria-label="$t('ctx.deselect')" @click="$emit('deselect')"><Icon name="close" /></button>
        </span>
      </header>

      <div v-show="!collapsed" class="cx-body scroll-y">
        <!-- Choose building spot -->
        <template v-if="ui.placing">
          <div class="cx-place">
            <span class="cx-placeicon"><Icon :name="'b-' + ui.placing.type" /></span>
            <span class="cx-placestate">
              <b v-if="ui.placing.hasPos" :class="ui.placing.valid ? 'ok' : 'err'">
                <Icon :name="ui.placing.valid ? 'check' : 'warning'" />{{ ui.placing.valid ? $t('build.placeOk') : $reason(ui.placing.reason) }}
              </b>
              <span v-else class="muted">{{ ui.touch ? $t('build.placeHintTouch') : $t('build.placeHint') }}</span>
            </span>
            <span class="cx-placebtns">
              <button v-if="ui.touch" class="primary" :aria-disabled="!ui.placing.valid" :disabled="!ui.placing.valid" data-testid="place-confirm" @click="$emit('confirm')">{{ $t('build.here') }}</button>
              <button data-testid="place-cancel" @click="$emit('cancel')">{{ $t('common.cancel') }}</button>
            </span>
          </div>
        </template>

        <ArmyPanel v-else-if="sel?.kind === 'army'" :sel="sel" :touch="ui.touch" :hints="hints" @action="$emit('action', $event)" />

        <template v-else-if="sel?.kind === 'serfs'">
          <template v-if="ui.touch && !buildOpen">
            <div class="cx-serfs">
              <button class="primary cx-buildbtn" data-testid="build-toggle" @click="buildOpen = true"><Icon name="cat-home" />{{ $t('build.open') }}</button>
              <span class="muted">{{ $t('serfs.idle', { n: sel.idle }) }} · {{ $t('serfs.hintTouch') }}</span>
            </div>
          </template>
          <template v-else>
            <BuildMenu :options="ui.buildOptions" :have="ui.res" :touch="ui.touch" :hint="hintIds" @build="build" />
          </template>
        </template>

        <BuildingPanel
          v-else-if="sel?.kind === 'building'"
          :sel="sel"
          :have="ui.res"
          :faith="ui.faith"
          :blessing-cost="ui.blessingCost"
          :serf-cost="ui.serfCost"
          :compact="compact"
          :hints="hints"
          @action="$emit('action', $event)"
          @buy-serf="$emit('buy-serf', $event)"
        />

        <p v-else-if="sel?.kind === 'foreign' && sel.entity === 'ruin'" class="cx-empty"><Icon name="fire" />{{ $t('sys.ruin') }}</p>
        <p v-else-if="sel?.kind === 'foreign'" class="cx-empty"><Icon name="info" />{{ $t('foreign.enemy') }} · {{ $t('common.player', { n: sel.owner + 1 }) }}</p>

        <p v-else class="cx-empty"><Icon name="info" />{{ ui.touch ? $t('ctx.nothingTouch') : $t('ctx.nothing') }}</p>
      </div>
    </section>

    <SelectionCard v-if="!compact" class="cb-card" :ui="ui" :touch="ui.touch" :hints="hints" @deselect="$emit('deselect')" />
  </div>
</template>

<script>
import Minimap from './Minimap.vue';
import BuildMenu from './BuildMenu.vue';
import BuildingPanel from './BuildingPanel.vue';
import ArmyPanel from './ArmyPanel.vue';
import SelectionCard from './SelectionCard.vue';

export default {
  name: 'CommandBar',
  components: { Minimap, BuildMenu, BuildingPanel, ArmyPanel, SelectionCard },
  props: {
    ui: { type: Object, required: true },
    engine: { type: Object, required: true },
    compact: Boolean,
    hints: { type: Boolean, default: true },
  },
  emits: ['build', 'buy-serf', 'confirm', 'cancel', 'deselect', 'action', 'quick', 'height'],
  data() { return { buildOpen: false, collapsed: false, mapOpen: false }; },
  computed: {
    sel() { return this.ui.selection; },
    hintIds() { return this.ui.mission?.tutorial?.hint?.ui ?? []; },
    showHead() { return this.compact || !!this.ui.placing || this.sel?.kind === 'serfs' || this.sel?.kind === 'army'; },
    panelTitle() {
      const s = this.sel, p = this.ui.placing;
      if (p) return this.$t('build.place', { building: this.$name.building(p.type) });
      if (!s) return this.$t('ctx.overview');
      if (s.kind === 'serfs') return this.compact ? (s.count === 1 ? this.$t('serfs.one') : this.$t('serfs.count', { n: s.count })) : this.$t('build.title');
      if (s.kind === 'army') return this.compact && s.heroes.length === 1 && !s.groups.length ? this.$name.hero(s.heroes[0].hero) : this.$t('army.title');
      if (s.kind === 'building') return this.$name.building(s.type, s.levelIndex);
      return this.$t('foreign.enemy');
    },
    headSub() {
      const s = this.sel;
      if (this.ui.placing || !s) return '';
      if (s.kind === 'building') return this.$t('common.levelOf', { n: s.level, max: s.maxLevel });
      if (s.kind === 'serfs' && !this.compact) return this.$t('serfs.count', { n: s.count }) + ' · ' + this.$t('serfs.idle', { n: s.idle });
      if (s.kind === 'army') return this.$t('army.soldiers', { n: s.soldiers });
      return '';
    },
    headIcon() {
      const s = this.sel, p = this.ui.placing;
      if (p) return 'b-' + p.type;
      if (!s) return 'crown';
      if (s.kind === 'building') return 'b-' + s.type;
      if (s.kind === 'serfs') return 'serf';
      if (s.kind === 'army') return s.heroes[0] ? 'hero-' + s.heroes[0].hero : 'banner';
      return 'skull';
    },
  },
  watch: {
    // A new selection unfolds the panel again
    'ui.selection.kind'() { this.collapsed = false; },
    'ui.selection.id'() { this.collapsed = false; },
    'ui.placing'(v) { if (v) this.collapsed = false; },
  },
  mounted() {
    this.ro = new ResizeObserver(() => this.reportHeight());
    this.ro.observe(this.$refs.bar);
    for (const el of this.$refs.bar.children) this.ro.observe(el);
    this.onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'h') this.$emit('quick', 'hq');
      else if (k === 'm' && this.compact) this.mapOpen = !this.mapOpen;
    };
    window.addEventListener('keydown', this.onKey);
  },
  beforeUnmount() { this.ro?.disconnect(); window.removeEventListener('keydown', this.onKey); },
  methods: {
    build(type) { this.buildOpen = false; this.$emit('build', type); },
    reportHeight() {
      // Height of the command bar (tallest column at the bottom) for space calculations (mission column, notices)
      let top = window.innerHeight;
      for (const el of this.$el.querySelectorAll(this.compact ? '.context' : '.context, .cb-card, .cb-left')) {
        const r = el.getBoundingClientRect();
        if (r.height) top = Math.min(top, r.top);
      }
      this.$emit('height', Math.round(window.innerHeight - top));
    },
  },
};
</script>

<style>
.cmdbar {
  position: fixed; z-index: 4; pointer-events: none;
  left: calc(var(--hud-gap) + var(--safe-l)); right: calc(var(--hud-gap) + var(--safe-r)); bottom: calc(var(--hud-gap) + var(--safe-b));
  display: grid; grid-template-columns: 13.5rem minmax(0, 1fr) 17rem; gap: var(--hud-gap); align-items: end;
}
.cmdbar > * { pointer-events: auto; }
.cb-left { display: flex; flex-direction: column; gap: var(--hud-gap); min-width: 0; }
.cb-quick { display: flex; gap: 0.25rem; padding: 0.3125rem; }
.cb-q { flex: 1 1 0; min-width: 0; display: inline-flex; flex-direction: column; align-items: center; gap: 0.0625rem; padding: 0.25rem 0.125rem; font-size: var(--fs-xs); font-weight: 700; min-height: 2.875rem; }
.cb-q .ico { width: 1.375rem; height: 1.375rem; }
.cb-q span:not(.ico) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.cb-card { height: 15.5rem; }

.context { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.625rem 0.75rem; max-height: min(48vh, 28rem); min-height: 7rem; }
.cx-head { display: flex; align-items: center; gap: 0.5rem; min-height: 2rem; flex: none; }
.cx-icon { flex: none; width: 2.25rem; height: 2.25rem; display: grid; place-items: center; border-radius: 0.375rem; background: radial-gradient(circle at 50% 35%, #fbf1d6, #d7bb86); box-shadow: inset 0 0 0 1px var(--gold-500), 0 1px 2px rgba(0, 0, 0, 0.5); }
.cx-icon .ico { width: 1.875rem; height: 1.875rem; }
.cx-title { flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cx-sub { color: var(--ink-muted); font-size: var(--fs-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cmdbar.compact .cx-sub { flex: none; }
.cmdbar.compact .cx-title { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.05; }
.cx-tools { margin-left: auto; display: flex; gap: 0.25rem; }
.cx-tools .icon-btn { width: 2.25rem; min-width: 2.25rem; min-height: 2.25rem; }
.cx-body { min-height: 0; flex: 1; display: flex; flex-direction: column; gap: 0.5rem; padding-right: 2px; }
.context.empty { min-height: 0; justify-content: center; }
.cx-empty { margin: auto 0; display: flex; align-items: center; gap: 0.5rem; color: var(--ink-muted); }
.cx-empty .ico { width: 1.25rem; height: 1.25rem; }
.cx-place { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.cx-placeicon { flex: none; width: 3.25rem; height: 3.25rem; display: grid; place-items: center; border-radius: 0.5rem; background: radial-gradient(circle at 50% 35%, #fbf1d6, #d7bb86); box-shadow: inset 0 0 0 2px var(--gold-500); }
.cx-placeicon .ico { width: 2.75rem; height: 2.75rem; }
.cx-placestate { flex: 1 1 12rem; }
.cx-placestate b { display: inline-flex; align-items: center; gap: 0.375rem; }
.cx-placestate b .ico { width: 1.125rem; height: 1.125rem; }
.cx-placestate .ok { color: var(--good); }
.cx-placestate .err { color: var(--bad); }
.cx-placebtns { display: flex; gap: 0.375rem; margin-left: auto; }
.cx-placebtns button { min-height: var(--touch); padding-inline: 1rem; }
.cx-serfs { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.cx-buildbtn { display: inline-flex; align-items: center; gap: 0.5rem; min-height: var(--touch); padding-inline: 1rem; font-size: var(--fs-lg); }
.cx-buildbtn .ico { width: 1.5rem; height: 1.5rem; }

/* Narrow screens and phone in landscape: minimap and selection card as overlay, panel full width */
.cmdbar.compact { grid-template-columns: minmax(0, 1fr); }
.cmdbar.compact .cb-left {
  position: fixed; right: calc(var(--hud-gap) + var(--safe-r)); top: calc(var(--top-total, 7rem) + var(--hud-gap));
  width: auto; align-items: flex-end;
}
.cmdbar.compact .cb-quick { flex-direction: column; padding: 0.25rem; width: 3.5rem; }
.cmdbar.compact .cb-q { flex: none; min-height: var(--touch); padding: 0.25rem 0; font-size: 0.625rem; }
.cmdbar.compact .cb-map { position: fixed; right: calc(var(--hud-gap) + var(--safe-r) + 4rem); top: calc(var(--top-total, 7rem) + var(--hud-gap)); width: min(13rem, 46vw, 52vh); }
.cmdbar.compact .context { max-height: min(50dvh, 26rem); min-height: 0; padding: 0.5rem 0.625rem; }
.cmdbar.compact .context.empty { padding: 0.375rem 0.75rem; }
.cmdbar.compact .context.empty .cx-empty { font-size: var(--fs-sm); }
.cmdbar.compact.collapsed .context { padding-block: 0.3125rem; }
@media (max-height: 480px) and (orientation: landscape) {
  .cmdbar.compact .context { max-height: calc(100dvh - var(--top-total, 3rem) - var(--hud-gap) * 2 - var(--safe-b)); margin-left: 0; margin-right: 4.25rem; }
  .cmdbar.compact .context.empty { margin-right: 4.25rem; max-width: 30rem; }
  .cmdbar.compact .cb-q span:not(.ico) { display: none; }
  .cmdbar.compact .cb-quick { width: auto; }
  .cmdbar.compact .cb-map { right: calc(var(--hud-gap) + var(--safe-r) + 3.75rem); width: min(11rem, 40vh); }
}
</style>
