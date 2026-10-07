<template>
  <!-- Bottom row as a grid: left map panel (quick access and square minimap), middle command panel
       (only as wide as needed, only with a selection), right portrait. The grid prevents any overlap:
       the panel gets the rest of the width and wraps its content. -->
  <div ref="bar" class="cmdbar" :class="{ compact, narrow, collapsed }" :style="infoH ? { '--info-h': infoH + 'px' } : null">
    <div class="cb-map" :class="{ open: mapOpen, frame: !compact }">
      <!-- Heroes and control groups: always visible. Hero: click selects it and brings it into view.
           Group: click selects it, second click brings it into view (keys 1–9). -->
      <div v-if="ui.heroes?.length || ui.groups?.length" class="cb-units" role="toolbar" :aria-label="$t('quick.heroes')">
        <!-- Heroes stacked -->
        <div v-if="ui.heroes?.length" class="cb-herocol">
          <button
            v-for="h in ui.heroes"
            :key="h.id"
            v-tip="heroTip(h)"
            class="cb-hero"
            :class="{ down: h.down, sel: h.selected }"
            :style="h.down ? { '--rv': Math.round(h.reviveFrac * 100) } : null"
            :aria-label="$name.hero(h.hero) + (h.down ? ' – ' + $t('army.heroDown') : '')"
            :data-testid="'quick-hero-' + h.hero"
            @click="$emit('hero', h.id)"
          >
            <span class="cb-pic"><Icon :name="'hero-' + h.hero" /></span>
            <span v-if="!h.down" class="cb-hp"><i :style="{ width: (100 * h.hp) / Math.max(1, h.maxHp) + '%' }"></i></span>
            <span v-else class="cb-downlbl" data-testid="hero-down">{{ h.threatened ? $t('army.heroDown') : h.reviveIn + ' s' }}</span>
            <i v-if="h.ready" class="cb-ready" aria-hidden="true"></i>
          </button>
        </div>
        <div v-if="ui.groups?.length" class="cb-groups">
          <button
            v-for="g in ui.groups"
            :key="'g' + g.n"
            v-tip="{ title: $t('quick.group', { n: g.n }), text: $t('quick.groupTip'), key: ui.touch ? null : String(g.n) }"
            class="cb-group"
            :class="{ sel: g.selected }"
            :aria-label="$t('quick.group', { n: g.n })"
            :data-testid="'group-' + g.n"
            @click="$emit('group', g.n)"
          >
            <Icon :name="g.icon" />
            <span class="cb-gnum num">{{ g.n }}</span>
            <span v-if="g.count > 1" class="cb-gcount num">×{{ g.count }}</span>
          </button>
        </div>
      </div>
      <!-- Desktop: quick access left, minimap right on the map panel -->
      <template v-if="!compact">
        <Minimap :engine="engine" :touch="ui.touch" class="cb-disc" />
        <div class="cb-quick" role="toolbar" :aria-label="$t('quick.title')">
          <button
            v-for="q in quickBtns"
            :key="q.k"
            v-tip="q.tip"
            class="coin cb-q"
            :aria-label="$t('quick.' + q.k)"
            :data-testid="'quick-' + q.k"
            @click="quick(q.k)"
          ><Icon :name="q.icon" /><i v-if="q.badge" class="badge num" data-testid="idle-count">{{ q.badge }}</i><span class="cb-qlbl">{{ $t('quick.' + q.k) }}</span></button>
        </div>
      </template>
      <!-- Phone: bottom right only the map button (and the code button of the coding adventures). It unfolds a panel with
           minimap and quick access; tapping again, the cross or a quick access folds it shut again. -->
      <template v-else>
        <div class="cb-mtools">
          <button
            v-if="code"
            class="coin cb-q cb-code"
            :class="{ on: code.open }"
            :aria-pressed="code.open"
            :aria-label="$t('script.code')"
            data-testid="script-open"
            @click="$emit('code')"
          ><span class="cb-code-ico" aria-hidden="true">&lt;/&gt;</span><i v-if="code.running" class="cb-code-run" aria-hidden="true"></i><span class="cb-qlbl">{{ $t('script.code') }}</span></button>
          <button
            v-tip="{ title: $t('quick.minimap'), text: $t('quick.minimapTip'), key: 'M' }"
            class="coin cb-q cb-maptoggle"
            :class="{ on: mapOpen, alarm: ui.alarm && !mapOpen }"
            :data-alarm="ui.alarm ? '1' : null"
            :aria-expanded="mapOpen"
            :aria-label="$t('quick.minimap')"
            :data-hint-for="mapOpen ? null : 'quick-hq quick-idle quick-all quick-army'"
            data-testid="minimap-toggle"
            @click="mapOpen = !mapOpen"
          ><Icon :name="mapOpen ? 'close' : 'map'" /><span class="cb-qlbl">{{ $t('quick.minimap') }}</span></button>
        </div>
        <div v-if="mapOpen" class="cb-pop frame" role="group" :aria-label="$t('quick.title')" data-testid="map-panel">
          <Minimap :engine="engine" :touch="ui.touch" class="cb-disc" />
          <div class="cb-quick" role="toolbar" :aria-label="$t('quick.title')">
            <button
              v-for="q in quickBtns"
              :key="q.k"
              v-tip="q.tip"
              class="coin cb-q"
              :aria-label="$t('quick.' + q.k)"
              :data-testid="'quick-' + q.k"
              @click="quick(q.k)"
            ><Icon :name="q.icon" /><i v-if="q.badge" class="badge num" data-testid="idle-count">{{ q.badge }}</i><span class="cb-qlbl">{{ $t('quick.' + q.k) }}</span></button>
          </div>
        </div>
      </template>
    </div>

    <section v-if="open" ref="panel" class="context frame" :class="{ wide: sel?.kind === 'building' && sel.own && !compact && !mid, tall: (sel?.kind === 'serfs' || sel?.kind === 'building') && !compact }" data-testid="context-panel" :aria-label="panelTitle">
      <!-- Info strip of the hovered / long-pressed building tile, attached to the top edge of the panel -->
      <BuildInfo v-if="infoOpt" ref="info" :opt="infoOpt" :have="ui.res" :notch="info.x" />
      <header class="cx-head">
        <span v-if="compact" class="cx-mini">
          <img v-if="portrait" :src="portrait" alt="" draggable="false">
          <span v-else class="cx-minipic"><Icon :name="headIcon" /></span>
        </span>
        <button v-if="serfView === 'build'" v-tip="{ text: $t('build.backTip'), key: ui.touch ? null : 'Esc' }" class="back-btn" data-testid="build-back" @click="setBuildView(false)"><Icon name="back" />{{ $t('build.back') }}</button>
        <h3 class="h-title cx-title">{{ panelTitle }}</h3>
        <span v-if="headSub" class="cx-sub">{{ headSub }}</span>
        <span class="cx-tools">
          <button v-if="compact" v-tip="collapsed ? $t('ctx.expand') : $t('ctx.collapse')" class="icon-btn ghost" :aria-label="collapsed ? $t('ctx.expand') : $t('ctx.collapse')" :aria-expanded="!collapsed" data-testid="panel-collapse" @click="collapsed = !collapsed">
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
              <b v-if="ui.placing.hasPos" :class="!ui.placing.valid ? 'err' : ui.placing.level === 'level' ? 'warn' : 'ok'" data-testid="place-state">
                <Icon :name="ui.placing.valid ? 'check' : 'warning'" />{{ !ui.placing.valid ? $reason(ui.placing.reason) : ui.placing.level === 'level' ? $t('slope.willLevel') : $t('build.placeOk') }}
              </b>
              <span v-else class="muted">{{ ui.touch ? $t('build.placeHintTouch') : $t('build.placeHint') }}</span>
            </span>
            <span class="cx-placebtns">
              <button v-if="ui.touch" class="primary" :aria-disabled="!ui.placing.valid" :disabled="!ui.placing.valid" data-testid="place-confirm" @click="$emit('confirm')">{{ $t('build.here') }}</button>
              <button data-testid="place-cancel" @click="$emit('cancel')">{{ $t('common.cancel') }}</button>
            </span>
          </div>
        </template>

        <ArmyPanel v-else-if="sel?.kind === 'army'" :sel="sel" :touch="ui.touch" :hints="hints" :group="ui.group" :details="compact || mid" @action="$emit('action', $event)" />

        <BuildMenu
          v-else-if="serfView === 'build'"
          :options="ui.buildOptions"
          :have="ui.res"
          :touch="ui.touch"
          :compact="compact"
          :mid="mid"
          :hints="hints"
          :hint="hintIds"
          @build="$emit('build', $event)"
          @preview="$emit('preview', $event)"
          @info="onInfo"
        />

        <SerfActions
          v-else-if="serfView === 'actions'"
          :touch="ui.touch"
          :compact="compact"
          :group="ui.group"
          :types="ui.buildOptions.map((o) => o.type)"
          @build-view="setBuildView(true)"
          @action="$emit('action', $event)"
        />

        <BuildingPanel
          v-else-if="sel?.kind === 'building'"
          :sel="sel"
          :have="ui.res"
          :faith="ui.faith"
          :blessing-cost="ui.blessingCost"
          :serf-cost="ui.serfCost"
          :compact="compact || narrow"
          :cols="!compact && !mid"
          :hints="hints"
          @action="$emit('action', $event)"
          @buy-serf="$emit('buy-serf', $event)"
        />

        <p v-else-if="sel?.kind === 'foreign' && sel.entity === 'ruin'" class="cx-empty"><Icon name="fire" />{{ $t('sys.ruin') }}</p>
        <p v-else-if="sel?.kind === 'foreign'" class="cx-empty"><RelationTag v-if="sel.relation?.rel !== 'nature'" :relation="sel.relation" :owner="sel.owner" /><template v-else><Icon name="info" />{{ $t('foreign.nature') }}</template></p>
      </div>
    </section>

    <SelectionCard v-if="!compact && sel" class="cb-card" :ui="ui" :touch="ui.touch" :hints="hints" :narrow="narrow" :mid="mid" @deselect="$emit('deselect')" />
  </div>
</template>

<script>
import Minimap from './Minimap.vue';
import BuildMenu from './BuildMenu.vue';
import BuildInfo from './BuildInfo.vue';
import SerfActions from './SerfActions.vue';
import { settings, set as setSetting } from '../settings.js';
import BuildingPanel from './BuildingPanel.vue';
import ArmyPanel from './ArmyPanel.vue';
import SelectionCard from './SelectionCard.vue';
import RelationTag from './RelationTag.vue';
import { selectionIcon, selectionPortrait, foreignName, serfsTitle } from './hudLayout.js';
import { siteRoot } from '../../paths.js';

export default {
  name: 'CommandBar',
  components: { Minimap, BuildMenu, BuildInfo, SerfActions, BuildingPanel, ArmyPanel, SelectionCard, RelationTag },
  props: {
    ui: { type: Object, required: true },
    engine: { type: Object, required: true },
    /** Phone/narrow: panel across the full width, map as a button */
    compact: Boolean,
    /** Medium width: portrait without shield, key figures are in the panel */
    narrow: Boolean,
    /** Smaller desktop windows: build menu as a swipeable row */
    mid: Boolean,
    hints: { type: Boolean, default: true },
    /** Code panel (coding adventure) on phone: null = no button, otherwise { open, running } */
    code: { type: Object, default: null },
  },
  emits: ['build', 'buy-serf', 'confirm', 'cancel', 'deselect', 'action', 'quick', 'height', 'preview', 'hero', 'group', 'code'],
  data() { return { collapsed: false, mapOpen: false, info: null, infoH: 0 }; },
  computed: {
    sel() { return this.ui.selection; },
    /** Serfs selected: 'build' (build menu) or 'actions' (serf action bar), remembered in the settings */
    serfView() {
      if (this.sel?.kind !== 'serfs' || this.ui.placing) return null;
      return settings.serfBuildView ? 'build' : 'actions';
    },
    /** Build option shown in the info strip */
    infoOpt() {
      if (!this.info || this.serfView !== 'build' || this.collapsed) return null;
      return this.ui.buildOptions.find((o) => o.type === this.info.type) ?? null;
    },
    /** The panel appears only if there is something to do */
    open() { return !!(this.ui.placing || this.sel); },
    hintIds() { const h = this.ui.mission?.tutorial?.hint?.ui ?? []; return Array.isArray(h) ? h : [h]; },
    panelTitle() {
      const s = this.sel, p = this.ui.placing;
      if (p) return this.$t('build.place', { building: this.$name.building(p.type) });
      if (!s) return '';
      if (s.kind === 'serfs') return settings.serfBuildView ? this.$t('build.title') : serfsTitle(s, this.$t);
      if (s.kind === 'army') return s.heroes.length === 1 && !s.groups.length ? this.$name.hero(s.heroes[0].hero) : this.$t('army.title');
      if (s.kind === 'building') return this.$name.building(s.type, s.levelIndex);
      if (s.kind === 'foreign' && s.entity === 'ruin') return this.$t('sys.ruin');
      return foreignName(s, this.$t, this.$name);
    },
    headSub() {
      const s = this.sel;
      if (this.ui.placing || !s) return '';
      if (s.kind === 'building') return this.$t('common.levelOf', { n: s.level, max: s.maxLevel });
      // Phone build view: back button, title, collapse and close leave no room for the counts
      if (s.kind === 'serfs' && settings.serfBuildView && this.compact && !this.collapsed) return '';
      if (s.kind === 'serfs') return settings.serfBuildView ? serfsTitle(s, this.$t) + ' · ' + this.$t('serfs.idle', { n: s.idle }) : this.$t('serfs.idle', { n: s.idle });
      if (s.kind === 'army') return s.soldiers ? this.$t('army.soldiers', { n: s.soldiers }) : '';
      return '';
    },
    headIcon() { return this.ui.placing ? 'b-' + this.ui.placing.type : selectionIcon(this.sel); },
    portrait() { return this.ui.placing ? null : selectionPortrait(this.sel, siteRoot()); },
    /** Quick accesses (desktop on the map panel, phone in the foldable map panel) */
    quickBtns() {
      const tip = (k, key) => ({ title: this.$t('quick.' + k), text: this.$t('quick.' + k + 'Tip'), key });
      return [
        { k: 'hq', icon: 'castle', tip: tip('hq', 'H') },
        { k: 'idle', icon: 'idle', tip: tip('idle', '.'), badge: this.ui.idleSerfs },
        { k: 'all', icon: 'serf', tip: tip('all') },
        { k: 'army', icon: 'soldiers', tip: tip('army') },
      ];
    },
  },
  watch: {
    // A new selection unfolds the panel again
    'ui.selection.kind'() { this.collapsed = false; },
    'ui.selection.id'() { this.collapsed = false; },
    'ui.placing'(v) { if (v) this.collapsed = false; },
    // From phone to desktop: map panel closed again (there it is always visible)
    compact(v) { if (!v) this.mapOpen = false; },
    // The info strip lifts the hero/map strip on the phone by its height
    infoOpt() { this.$nextTick(() => { this.infoH = this.$refs.info?.$el?.offsetHeight ?? 0; }); },
  },
  mounted() {
    this.ro = new ResizeObserver(() => this.reportHeight());
    this.ro.observe(this.$refs.bar);
    this.mo = new MutationObserver(() => { for (const el of this.$refs.bar.children) this.ro.observe(el); });
    this.mo.observe(this.$refs.bar, { childList: true });
    for (const el of this.$refs.bar.children) this.ro.observe(el);
    this.onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'h') this.$emit('quick', 'hq');
      else if (k === 'm' && this.compact) this.mapOpen = !this.mapOpen;
      else if (k === 'b' && this.serfView === 'actions') this.setBuildView(true);
    };
    window.addEventListener('keydown', this.onKey);
  },
  beforeUnmount() { this.ro?.disconnect(); this.mo?.disconnect(); window.removeEventListener('keydown', this.onKey); },
  methods: {
    /** Switch between build view and serf action bar (remembered across selections and reloads) */
    setBuildView(on) {
      this.info = null;
      setSetting('serfBuildView', on);
    },
    onInfo(v) {
      if (!v) { this.info = null; return; }
      const r = this.$refs.panel?.getBoundingClientRect();
      this.info = { type: v.type, x: r && v.x !== null ? Math.round(v.x - r.left) : null };
    },
    /** Quick access: on phones the map panel folds shut afterwards so the result lies free */
    quick(k) {
      this.$emit('quick', k);
      if (this.compact) this.mapOpen = false;
    },
    heroTip(h) {
      const text = !h.down ? this.$t('quick.heroTip')
        : h.threatened ? this.$t('quick.heroDownThreat') : this.$t('quick.heroDownTip', { s: h.reviveIn });
      return { title: this.$name.hero(h.hero) + (h.down ? ' · ' + this.$t('army.heroDown') : ''), text, lines: h.down ? null : [[this.$t('bld.hp'), h.hp + '/' + h.maxHp]] };
    },
    reportHeight() {
      // Covered height at the bottom (highest element of the row) for camera, mission column and notices
      let top = window.innerHeight;
      for (const el of this.$el.querySelectorAll(this.compact ? '.context' : '.context, .cb-card, .cb-map, .cb-units')) {
        const r = el.getBoundingClientRect();
        if (r.height) top = Math.min(top, r.top);
      }
      this.$emit('height', Math.max(0, Math.round(window.innerHeight - top)));
    },
  },
};
</script>

<style>
.cmdbar {
  position: fixed; z-index: 4; pointer-events: none;
  left: calc(var(--hud-gap) * 2 + var(--safe-l)); right: calc(var(--hud-gap) * 2 + var(--safe-r)); bottom: 0;
  display: grid; grid-template-columns: minmax(max-content, 1fr) auto minmax(max-content, 1fr); column-gap: 1rem; align-items: end;
}
.cmdbar > * { pointer-events: auto; }

/* Map panel: quick access as square buttons without names on the left, square minimap on the right, both on one
   shared wooden panel like command panel and portrait */
.cb-map {
  grid-column: 1; justify-self: start; position: relative; margin-bottom: calc(var(--hud-gap) * 2 + var(--safe-b)); --d: 12rem;
  display: grid; grid-template-columns: auto var(--d); align-items: center; gap: 0.5rem; padding: 0.5rem;
}
.cmdbar .cb-disc { grid-column: 2; grid-row: 1; width: var(--d); height: var(--d); }
.cb-quick { grid-column: 1; grid-row: 1; display: flex; flex-direction: column; gap: 0.375rem; }
button.coin.cb-q { border-radius: 0.5rem; box-shadow: inset 0 0 0 1px rgba(225, 168, 58, 0.55), 0 2px 0 var(--wood-950); }
button.coin.cb-q.on { box-shadow: inset 0 0 0 1px var(--gold-300), 0 2px 0 var(--wood-950), 0 0 12px rgba(243, 200, 94, 0.55); }
/* Heroes and control groups above the map panel, with many entries further rows upward */
.cb-units { position: absolute; left: 0; bottom: calc(100% + 1.25rem); width: 100%; display: flex; align-items: flex-end; gap: 0.875rem; }
.cb-herocol { display: flex; flex-direction: column; gap: 1rem; flex: none; }
.cb-groups { display: flex; flex-wrap: wrap-reverse; gap: 0.75rem 0.625rem; align-items: flex-end; min-width: 0; }
button.cb-hero {
  position: relative; width: 3.25rem; height: 3.25rem; min-height: 0; padding: 0.25rem; border: 0; border-radius: 50%;
  background: var(--brass); box-shadow: 0 0 0 2px var(--wood-950), 0 4px 10px rgba(0, 0, 0, 0.5);
}
.cb-pic { width: 100%; height: 100%; border-radius: 50%; display: grid; place-items: center; background: var(--tile-bg); box-shadow: inset 0 0 0 2px var(--wood-950); }
.cb-pic .ico { width: 85%; height: 85%; }
/* Painted portrait fills the circle inside the ring (cut out round, no overhang) */
.cb-pic .ico.portrait { width: calc(100% - 4px); height: calc(100% - 4px); border-radius: 50%; }
button.cb-hero.sel { box-shadow: 0 0 0 2px var(--gold-100), 0 0 12px rgba(243, 200, 94, 0.8); }
/* Unconscious: grey, red border, ring fills green until waking up; remaining time instead of health bar */
button.cb-hero.down { background: conic-gradient(var(--good) calc(var(--rv, 0) * 1%), var(--bad) 0); }
button.cb-hero.down .ico { filter: grayscale(1) brightness(0.65); }
.cb-downlbl { position: absolute; left: 50%; bottom: -0.625rem; transform: translateX(-50%); padding: 0 0.375rem; border-radius: 0.5rem; background: var(--bad-deep); color: #ffe9df; font: 800 0.625rem/1rem var(--body); white-space: nowrap; box-shadow: 0 0 0 1.5px var(--wood-950); }
.cb-hp { position: absolute; left: 0.25rem; right: 0.25rem; bottom: -0.4375rem; height: 0.3125rem; border-radius: 1rem; background: rgba(10, 6, 3, 0.8); box-shadow: 0 0 0 1px var(--wood-950); overflow: hidden; }
.cb-hp i { position: absolute; inset: 0 auto 0 0; background: linear-gradient(180deg, #b5ec92, #4f9a35); }
.cb-ready { position: absolute; top: -0.125rem; right: -0.125rem; width: 0.625rem; height: 0.625rem; border-radius: 50%; background: var(--gold-300); box-shadow: 0 0 0 2px var(--wood-950), 0 0 6px var(--gold-300); }
button.cb-group {
  position: relative; width: 3rem; height: 3rem; min-height: 0; padding: 0; border: 0; border-radius: var(--r-md); display: grid; place-items: center;
  background: var(--tile-bg); box-shadow: 0 0 0 2px var(--gold-600), 0 0 0 3px var(--wood-950), 0 4px 10px rgba(0, 0, 0, 0.45);
}
button.cb-group .ico { width: 2.25rem; height: 2.25rem; }
button.cb-group.sel { box-shadow: 0 0 0 2px var(--gold-100), 0 0 0 3px var(--wood-950), 0 0 14px rgba(243, 200, 94, 0.75); }
.cb-gnum { position: absolute; top: -0.5rem; left: -0.5rem; width: 1.25rem; height: 1.25rem; border-radius: 50%; display: grid; place-items: center; font: 800 0.75rem/1 var(--body); color: var(--wood-950); background: var(--gold-300); box-shadow: 0 0 0 2px var(--wood-950); }
.cb-gcount { position: absolute; bottom: -0.4375rem; right: -0.4375rem; padding: 0 0.3125rem; border-radius: 0.5rem; font: 800 0.6875rem/1.0625rem var(--body); color: var(--gold-100); background: var(--wood-850); box-shadow: 0 0 0 1.5px var(--gold-600); }
.cb-qlbl { display: none; }

/* Command panel: free-standing with a gap to the edge like map and portrait */
.context {
  grid-column: 2; min-width: min(30rem, 100%); max-width: 100%; display: flex; flex-direction: column; gap: 0.5rem;
  padding: 0.5rem 0.75rem 0.75rem; margin-bottom: calc(var(--hud-gap) * 2 + var(--safe-b)); max-height: min(52vh, 30rem);
}
/* Build menu and buildings on desktop: taller (buildings also wider and two-column) instead of scrolling */
.context.tall { max-height: calc(100vh - var(--top-total, 4rem) - 2rem - var(--safe-b)); }
.context.wide { min-width: min(48rem, 100%); }
.context { position: relative; }
.back-btn { flex: none; display: inline-flex; align-items: center; gap: 0.25rem; min-height: 2.25rem; padding: 0.125rem 0.625rem 0.125rem 0.375rem; font-size: var(--fs-sm); font-weight: 700; }
.back-btn .ico { width: 1rem; height: 1rem; }
.cmdbar.compact .back-btn { min-height: var(--touch); }
.cx-head { display: flex; align-items: center; gap: 0.5rem; min-height: 1.75rem; flex: none; }
.cx-mini { flex: none; width: 2.75rem; height: 2.75rem; margin-top: -1.375rem; border-radius: 50%; padding: 3px; background: var(--brass); box-shadow: 0 0 0 2px var(--wood-950), 0 4px 10px rgba(0, 0, 0, 0.5); display: grid; place-items: center; overflow: hidden; }
.cx-mini img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; background: var(--tile-bg); }
.cx-minipic { width: 100%; height: 100%; border-radius: 50%; background: var(--tile-bg); display: grid; place-items: center; }
.cx-minipic .ico { width: 80%; height: 80%; }
.cx-title { flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cx-sub { color: var(--ink-muted); font-size: var(--fs-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.cx-tools { margin-left: auto; display: flex; gap: 0.25rem; }
.cx-tools .icon-btn { width: 2.25rem; min-width: 2.25rem; min-height: 2.25rem; }
.cx-body { min-height: 0; flex: 1; display: flex; flex-direction: column; gap: 0.5rem; padding-right: 2px; }
.cx-empty { margin: 0; display: flex; align-items: center; gap: 0.5rem; color: var(--ink-muted); }
.cx-empty .ico { width: 1.25rem; height: 1.25rem; }
.cx-place { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.cx-placeicon { flex: none; width: 3.25rem; height: 3.25rem; display: grid; place-items: center; border-radius: var(--r-md); background: var(--tile-bg); box-shadow: inset 0 0 0 2px var(--gold-500); }
.cx-placeicon .ico { width: 2.75rem; height: 2.75rem; }
.cx-placestate { flex: 1 1 12rem; }
.cx-placestate b { display: inline-flex; align-items: center; gap: 0.375rem; }
.cx-placestate b .ico { width: 1.125rem; height: 1.125rem; }
.cx-placestate .ok { color: var(--good); }
.cx-placestate .err { color: var(--bad); }
.cx-placestate .warn { color: var(--warn); }
.cx-placebtns { display: flex; gap: 0.375rem; margin-left: auto; }
.cx-placebtns button { min-height: var(--touch); padding-inline: 1rem; }

.cb-card { grid-column: 3; justify-self: end; margin-bottom: calc(var(--hud-gap) * 2 + var(--safe-b)); }

/* Medium width: smaller map and smaller portrait */
.mid .cb-map { --d: 9.5rem; }
.mid .cb-card { --portrait: 5.75rem; }

/* Phone / narrow: panel as a drawer across the full width; above it a strip with heroes on the left and the
   map button on the right, which unfolds minimap and quick access as a small panel */
.cmdbar.compact { display: block; left: var(--safe-l); right: var(--safe-r); }
/* Strip above the panel: heroes left (row), map button right */
.cmdbar.compact .cb-map {
  position: absolute; left: calc(var(--hud-gap) + var(--safe-l)); right: calc(var(--hud-gap) + var(--safe-r)); bottom: calc(100% + 0.75rem + var(--info-h, 0px)); margin: 0;
  width: auto; height: auto; padding: 0; justify-self: stretch; display: flex; flex-wrap: wrap-reverse; align-items: flex-end; justify-content: space-between; gap: 0.625rem;
}
.cmdbar.compact .cb-mtools { display: flex; gap: 0.5rem; margin-left: auto; align-items: flex-end; }
.cmdbar.compact .cb-herocol { flex-direction: row; gap: 0.625rem; }
.cmdbar.compact .cb-pop {
  position: absolute; right: 0; bottom: calc(100% + 0.75rem); z-index: 1;
  display: flex; flex-direction: column; align-items: center; gap: 0.625rem; padding: 0.875rem 0.625rem 0.625rem;
}
.cmdbar.compact .cb-pop .cb-disc { width: min(14rem, 62vw, 40vh); height: min(14rem, 62vw, 40vh); }
.cmdbar.compact .cb-pop .cb-quick { flex-direction: row; gap: 0.5rem; }
.show-labels .cmdbar.compact .cb-pop { padding-bottom: 1.375rem; }
/* Without a panel the buttons stand free above the playing field: strong brass border */
.cmdbar.compact button.coin.cb-q { box-shadow: 0 0 0 2px var(--gold-600), 0 0 0 3px var(--wood-950), inset 0 0 0 1px rgba(255, 225, 170, 0.25), 0 4px 10px rgba(0, 0, 0, 0.45); }
.cmdbar.compact button.coin.cb-q.on { box-shadow: 0 0 0 2px var(--gold-300), 0 0 0 3px var(--wood-950), 0 0 14px rgba(243, 200, 94, 0.55); }
.cmdbar.compact .cb-units { position: static; width: auto; flex: 0 1 auto; min-width: 0; }
.cmdbar.compact .cb-hero { width: 2.75rem; height: 2.75rem; }
.cmdbar.compact .cb-group { width: 2.625rem; height: 2.625rem; }
.cmdbar.compact .context { min-width: 0; margin: 0 calc(var(--hud-gap) + var(--safe-r)) calc(var(--hud-gap) + var(--safe-b)) calc(var(--hud-gap) + var(--safe-l)); max-height: min(50dvh, 26rem); padding: 0.375rem 0.625rem 0.625rem; }
.cmdbar.compact.collapsed .context { padding-bottom: 0.375rem; }
/* Attack while the map is closed: map button pulses red */
.cmdbar button.coin.cb-q.alarm { animation: cb-alarm 0.9s ease-in-out infinite alternate; }
@keyframes cb-alarm { from { box-shadow: 0 0 0 2px var(--bad), 0 0 0 3px var(--wood-950), 0 0 4px rgba(255, 70, 45, 0.4); } to { box-shadow: 0 0 0 2px var(--bad), 0 0 0 3px var(--wood-950), 0 0 16px rgba(255, 70, 45, 0.95); } }
/* Code button of the coding adventures: golden button so it stands out among the quick accesses */
.cb-code { color: var(--gold-100); background: radial-gradient(circle at 50% 35%, #8a6a2c, #4a3415 75%); }
.cb-code-ico { font: 800 0.9375rem/1 ui-monospace, Menlo, Consolas, monospace; letter-spacing: -0.06em; }
.cb-code-run { position: absolute; top: -0.125rem; right: -0.125rem; width: 0.75rem; height: 0.75rem; border-radius: 50%; background: var(--good); box-shadow: 0 0 0 2px var(--wood-950), 0 0 6px var(--good); }
/* "Labels" setting: names under the coins */
.show-labels .cmdbar.compact .cb-qlbl {
  display: block; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 0.125rem;
  font-size: 0.5625rem; font-weight: 700; line-height: 1; color: var(--ink); white-space: nowrap; text-shadow: 0 1px 2px #000, 0 0 3px #000;
}
.show-labels .cmdbar.compact .cb-map { margin-bottom: 0.75rem; }
/* Landscape phone: heroes and map button top right under the top bar, map panel unfolds to the left */
@media (max-height: 480px) and (orientation: landscape) {
  .cmdbar.compact .cb-map { position: fixed; top: calc(var(--top-total, 3rem) + var(--hud-gap)); bottom: auto; left: auto; flex-direction: column; flex-wrap: nowrap; align-items: flex-end; }
  .cmdbar.compact .cb-units, .cmdbar.compact .cb-herocol, .cmdbar.compact .cb-mtools, .cmdbar.compact .cb-groups { flex-direction: column; flex-wrap: nowrap; }
  .cmdbar.compact .cb-pop { right: calc(100% + 0.5rem); top: 0; bottom: auto; flex-direction: row; align-items: flex-start; }
  .cmdbar.compact .cb-pop .cb-quick { flex-direction: column; gap: 0.375rem; }
  .cmdbar.compact .cb-pop .cb-disc { width: min(12rem, 50vh); height: min(12rem, 50vh); }
  /* at the top there is room for the goals button of the missions (otherwise the panel lay above it) */
  .cmdbar.compact .context { max-height: calc(100dvh - var(--top-total, 3rem) - 2.5rem - var(--hud-gap) * 4 - var(--safe-b)); margin-right: calc(4.25rem + var(--safe-r)); }
  .cmdbar.compact .cb-q { width: 2.5rem; height: 2.5rem; min-width: 2.5rem; min-height: 2.5rem; }
  .show-labels .cmdbar.compact .cb-qlbl { display: none; }
}
</style>
