<template>
  <DevStats v-if="s.stats" :engine="engine" @close="s.stats = false" />

  <button
    v-if="!s.open"
    class="dev-fab"
    data-testid="dev-open"
    :aria-label="$t('dev.expand')"
    @click="s.open = true"
  >&lt;/&gt; DEV</button>

  <section v-else class="dev-panel frame" data-testid="dev-panel" :aria-label="$t('dev.title')">
    <header class="dp-head">
      <span class="dp-badge">&lt;/&gt;</span>
      <h3 class="h-title">{{ $t('dev.title') }}</h3>
      <button class="dp-mini" :class="{ active: s.stats }" :aria-pressed="s.stats" data-testid="dev-stats-toggle" @click="s.stats = !s.stats">{{ $t('dev.statsBtn') }}</button>
      <button class="icon-btn ghost" :aria-label="$t('dev.collapse')" data-testid="dev-collapse" @click="s.open = false"><Icon name="chevronDown" /></button>
      <button class="icon-btn ghost" :aria-label="$t('dev.close')" data-testid="dev-off" @click="turnOff"><Icon name="close" /></button>
    </header>

    <nav class="seg dp-tabs" role="tablist">
      <button
        v-for="tb in tabs" :key="tb" role="tab" :aria-selected="s.tab === tb" :class="{ active: s.tab === tb }"
        :data-testid="'dev-tab-' + tb" @click="s.tab = tb"
      >{{ $t('dev.tab.' + tb) }}</button>
    </nav>

    <div class="dp-body scroll-y">
      <!-- ---------- Polygons ---------- -->
      <template v-if="s.tab === 'render'">
        <p v-if="s.explain" class="dp-ex">{{ $t('dev.ex.polygon') }}</p>
        <h4 class="h-label">{{ $t('dev.wire') }}</h4>
        <div class="dp-checks">
          <label v-for="c in cats" :key="c" class="dp-check" :data-testid="'dev-wire-' + c">
            <input v-model="s.wire[c]" type="checkbox"><span>{{ $t('dev.cat.' + c) }}</span>
          </label>
        </div>
        <div class="seg" role="radiogroup">
          <button v-for="m in ['overlay', 'wire']" :key="m" role="radio" :aria-checked="s.wireMode === m" :class="{ active: s.wireMode === m }" :data-testid="'dev-wiremode-' + m" @click="s.wireMode = m">{{ $t('dev.wireMode.' + m) }}</button>
        </div>
        <button class="switch" role="switch" :aria-checked="s.lodColors" data-testid="dev-lodcolors" @click="s.lodColors = !s.lodColors">
          <span>{{ $t('dev.lodColors') }}</span><span class="track"></span>
        </button>
        <div v-if="s.lodColors" class="dp-legend">
          <span v-for="(c, i) in lodColors" :key="i"><i :style="{ background: c }"></i>{{ $t('dev.lodN', { n: i }) }}</span>
        </div>
        <p v-if="s.explain" class="dp-ex">{{ $t('dev.ex.lod') }}</p>

        <dl class="dp-kv">
          <dt>{{ $t('dev.trisTotal') }}</dt><dd class="num" data-testid="dev-tris">{{ fmt(snap?.triangles ?? 0) }}</dd>
        </dl>

        <h4 class="h-label">{{ $t('dev.selected') }}</h4>
        <p v-if="!snap?.poly" class="dp-note">{{ $t('dev.noSelection') }}</p>
        <div v-else class="dp-poly" data-testid="dev-poly">
          <div class="dp-poly-head">
            <b>#{{ snap.poly.id }} {{ kindName(snap.poly.kind) }}</b>
            <span class="dp-chip" :style="{ background: lodColors[Math.min(Math.max(0, snap.poly.level), 3)] }">{{ $t('dev.lodN', { n: snap.poly.level }) }}</span>
          </div>
          <dl class="dp-kv">
            <dt>{{ $t('dev.verts') }}</dt><dd class="num">{{ fmt(snap.poly.verts) }}</dd>
            <dt>{{ $t('dev.tris') }}</dt><dd class="num" data-testid="dev-poly-tris">{{ fmt(snap.poly.tris) }}</dd>
          </dl>
          <p v-if="snap.poly.anim" class="dp-note">{{ $t('dev.anim.' + snap.poly.anim) }}</p>
          <ol v-if="snap.poly.levels" class="dp-levels">
            <li v-for="(l, i) in snap.poly.levels" :key="i" :class="{ cur: i === snap.poly.level }">
              <i :style="{ background: lodColors[Math.min(i, 3)] }"></i>
              <span>{{ $t('dev.lodN', { n: i }) }}</span>
              <span class="num">{{ fmt(l.tris) }} △</span>
              <span class="bar"><b :style="{ width: (100 * l.tris / snap.poly.levels[0].tris) + '%' }"></b></span>
            </li>
          </ol>
        </div>

        <h4 class="h-label">{{ $t('dev.lodTable') }}</h4>
        <table class="dp-table num">
          <tr><th></th><th v-for="i in 4" :key="i" :style="{ color: lodColors[i - 1] }">{{ i - 1 }}</th></tr>
          <tr v-for="g in lodGroups" :key="g[0]"><th>{{ groupName(g[0]) }}</th><td v-for="i in 4" :key="i">{{ g[1][i - 1] ?? '' }}</td></tr>
        </table>
      </template>

      <!-- ---------- Pathfinding ---------- -->
      <template v-else-if="s.tab === 'path'">
        <p v-if="s.explain" class="dp-ex">{{ $t('dev.ex.astar') }}</p>
        <p v-if="!snap?.figure" class="dp-note" data-testid="dev-pick-figure">{{ $t('dev.pickFigure') }}</p>
        <template v-else>
          <div class="dp-fig">
            <b>#{{ snap.figure.id }} {{ kindName(snap.figure.kind) }}</b>
            <span class="dim">{{ stateName(snap.figure.state) }} · {{ $t('dev.tile') }} {{ snap.figure.tile.x }},{{ snap.figure.tile.y }}</span>
          </div>
          <p v-if="!snap.search" class="dp-note">{{ $t('dev.noPath') }}</p>
          <div v-else class="dp-search" data-testid="dev-search-info">
            <p v-if="snap.search.custom" class="dp-note">{{ $t('dev.searchCustom') }}</p>
            <dl class="dp-kv">
              <dt>{{ $t('dev.result') }}</dt><dd :class="snap.search.result === 'found' || snap.search.result === 'here' ? 'good' : 'bad'">{{ $t('dev.res.' + snap.search.result) }}</dd>
              <dt>{{ $t('dev.open') }} / {{ $t('dev.closed') }}</dt><dd class="num">{{ snap.search.open }} / {{ snap.search.closed }}</dd>
              <dt>{{ $t('dev.pathLen') }}</dt><dd class="num">{{ snap.search.pathLen }}</dd>
            </dl>
            <div class="meter"><i :style="{ width: (snap.search.steps ? 100 * snap.search.step / snap.search.steps : 100) + '%' }"></i></div>
            <p class="dp-steps num" data-testid="dev-steps">{{ $t('dev.steps', { n: snap.search.step, total: snap.search.steps }) }}</p>
            <div class="dp-player">
              <button class="icon-btn" :aria-label="$t('dev.restart')" data-testid="dev-restart" @click="dev('restart')">⏮</button>
              <button class="icon-btn" :aria-label="$t('dev.stepBack')" @click="dev('stepBy', -1)">◀</button>
              <button class="icon-btn primary" :aria-label="snap.search.playing ? $t('dev.pause') : $t('dev.play')" data-testid="dev-play" @click="snap.search.playing ? dev('pause') : dev('play')">
                <Icon :name="snap.search.playing ? 'pause' : 'play'" />
              </button>
              <button class="icon-btn" :aria-label="$t('dev.stepFwd')" data-testid="dev-step" @click="dev('stepBy', 1)">▶</button>
              <button class="icon-btn" :aria-label="$t('dev.toEnd')" @click="dev('toEnd')">⏭</button>
            </div>
            <label class="dp-speed">
              <span>{{ $t('dev.speed') }}</span>
              <input
                type="range" min="0" max="100" :value="speedPos" :style="{ '--fill': speedPos + '%' }" :aria-label="$t('dev.speed')"
                data-testid="dev-speed" @input="setSpeed($event.target.value)"
              >
              <b class="num">{{ $t('dev.speedVal', { n: s.playSpeed }) }}</b>
            </label>
          </div>
          <div class="dp-row">
            <button :class="{ active: snap.pickMode === 'goal' }" data-testid="dev-pick-goal" @click="dev('pick', 'goal')"><Icon name="target" />{{ snap.pickMode === 'goal' ? $t('dev.pickActive') : $t('dev.pickGoal') }}</button>
            <button v-if="snap.search?.custom" @click="dev('clearGoal')">{{ $t('dev.ownPath') }}</button>
            <button v-else @click="dev('recompute')">{{ $t('dev.recompute') }}</button>
          </div>
        </template>
        <button class="switch" role="switch" :aria-checked="s.path" data-testid="dev-path" @click="s.path = !s.path"><span>{{ $t('dev.showPath') }}</span><span class="track"></span></button>
        <button class="switch" role="switch" :aria-checked="s.search" data-testid="dev-search" @click="s.search = !s.search"><span>{{ $t('dev.showSearch') }}</span><span class="track"></span></button>
        <button class="switch" role="switch" :aria-checked="s.regions" data-testid="dev-regions" @click="s.regions = !s.regions">
          <span>{{ $t('dev.showRegions') }}<small v-if="snap?.regions !== null && snap?.regions !== undefined" class="dim"> · {{ $t('dev.regionsCount', { n: snap.regions }) }}</small></span><span class="track"></span>
        </button>
        <p v-if="s.explain && s.regions" class="dp-ex">{{ $t('dev.ex.regions') }}</p>

        <div v-if="s.search" class="dp-legend">
          <span v-for="k in ['open', 'closed', 'path', 'start', 'goal', 'current']" :key="k"><i :style="{ background: rgba(k) }"></i>{{ $t('dev.legend.' + k) }}</span>
        </div>
        <p v-if="s.explain && s.search" class="dp-ex">{{ $t('dev.ex.lists') }}</p>
        <p class="dp-note">{{ touch ? '' : $t('dev.hoverHint') }}</p>
        <button v-if="touch" :class="{ active: snap?.pickMode === 'inspect' }" @click="dev('pick', 'inspect')"><Icon name="info" />{{ snap?.pickMode === 'inspect' ? $t('dev.pickActive') : $t('dev.inspect') }}</button>
      </template>

      <!-- ---------- Grid ---------- -->
      <template v-else-if="s.tab === 'grid'">
        <p v-if="s.explain" class="dp-ex">{{ $t('dev.ex.grid') }}</p>
        <div class="dp-radios" role="radiogroup">
          <button
            v-for="g in grids" :key="g" role="radio" :aria-checked="s.grid === g" :class="{ active: s.grid === g }"
            :data-testid="'dev-grid-' + g" @click="s.grid = g"
          >{{ $t('dev.grid.' + g) }}</button>
        </div>
        <button class="switch" role="switch" :aria-checked="s.gridLines" data-testid="dev-gridlines" @click="s.gridLines = !s.gridLines"><span>{{ $t('dev.gridLines') }}</span><span class="track"></span></button>
        <div v-if="legend.length" class="dp-legend" data-testid="dev-grid-legend">
          <span v-for="l in legend" :key="l.key"><i :style="{ background: l.color }"></i>{{ $t(l.key) }}</span>
        </div>
        <div v-if="s.grid === 'height'" class="dp-ramp"><span>{{ $t('dev.low') }}</span><i></i><span>{{ $t('dev.high') }}</span></div>
        <p v-if="s.grid === 'height' && snap?.heightRange" class="dp-note num">{{ $t('dev.heightRange', snap.heightRange) }}</p>
        <p v-if="s.grid === 'build' && s.explain" class="dp-ex">{{ $t('dev.ex.build', { max: maxSlope }) }}</p>
        <p v-if="s.grid === 'vision'" class="dp-note">{{ snap?.fog ? $t('dev.circles', { n: snap?.circles ?? 0 }) : $t('dev.fogOff') }}</p>
        <p v-if="s.grid === 'territory'" class="dp-note">{{ $t('dev.territoryNote') }}</p>
        <p class="dp-note">{{ touch ? '' : $t('dev.hoverHintGrid') }}</p>
        <button v-if="touch" :class="{ active: snap?.pickMode === 'inspect' }" @click="dev('pick', 'inspect')"><Icon name="info" />{{ snap?.pickMode === 'inspect' ? $t('dev.pickActive') : $t('dev.inspect') }}</button>
      </template>

      <!-- ---------- Figures ---------- -->
      <template v-else>
        <h4 class="h-label">{{ $t('dev.labels') }}</h4>
        <div class="seg" role="radiogroup">
          <button v-for="m in ['off', 'selected', 'all']" :key="m" role="radio" :aria-checked="s.labels === m" :class="{ active: s.labels === m }" :data-testid="'dev-labels-' + m" @click="s.labels = m">{{ $t('dev.labels.' + m) }}</button>
        </div>
        <p v-if="s.explain" class="dp-ex">{{ $t('dev.ex.fsm') }}</p>
        <h4 class="h-label">{{ $t('dev.figure') }}</h4>
        <p v-if="!snap?.figure" class="dp-note">{{ $t('dev.pickFigure') }}</p>
        <dl v-else class="dp-kv" data-testid="dev-figure">
          <dt>#</dt><dd>{{ snap.figure.id }} {{ kindName(snap.figure.kind) }}</dd>
          <dt>{{ $t('dev.stateLabel') }}</dt><dd><b>{{ stateName(snap.figure.state) }}</b><span v-if="snap.figure.raw" class="dim"> ({{ snap.figure.raw }})</span></dd>
          <dt>{{ $t('dev.hp') }}</dt><dd><span class="meter hp dp-hp"><i :style="{ width: (100 * snap.figure.hp / snap.figure.maxHp) + '%' }"></i></span> {{ Math.round(snap.figure.hp) }}/{{ snap.figure.maxHp }}</dd>
          <template v-if="snap.figure.job"><dt>{{ $t('dev.job') }}</dt><dd>{{ snap.figure.job }}<span v-if="snap.figure.target"> #{{ snap.figure.target }}</span></dd></template>
          <template v-else-if="snap.figure.target"><dt>{{ $t('dev.target') }}</dt><dd>#{{ snap.figure.target }}</dd></template>
          <dt>{{ $t('dev.goal') }}</dt><dd>{{ snap.figure.goal ? snap.figure.goal.x + ',' + snap.figure.goal.y : '–' }}</dd>
          <dt>{{ $t('dev.pathLen') }}</dt><dd class="num">{{ snap.figure.pathLen }}</dd>
          <dt>{{ $t('dev.tile') }}</dt><dd class="num">{{ snap.figure.tile.x }}, {{ snap.figure.tile.y }}</dd>
        </dl>
        <h4 class="h-label">{{ $t('dev.hash') }}</h4>
        <p class="dp-hash num" data-testid="dev-hash">{{ stats?.hash ?? '…' }} <span class="dim">· {{ $t('dev.hashAt', { n: stats?.hashTick ?? 0 }) }}</span></p>
        <p v-if="s.explain" class="dp-ex">{{ $t('dev.ex.hash') }}</p>
        <h4 class="h-label">{{ $t('dev.entities') }}</h4>
        <table class="dp-table num">
          <tr v-for="(n, k) in stats?.entities ?? {}" :key="k"><th>{{ kindName(k) }}</th><td>{{ n }}</td></tr>
        </table>
      </template>
    </div>

    <footer class="dp-foot">
      <button class="switch dp-explain" role="switch" :aria-checked="s.explain" data-testid="dev-explain" @click="s.explain = !s.explain"><span>{{ $t('dev.explainToggle') }}</span><span class="track"></span></button>
      <button class="ghost" data-testid="dev-reset" @click="reset">{{ $t('dev.reset') }}</button>
    </footer>
  </section>
</template>

<script>
import { watch } from 'vue';
import DevStats from './DevStats.vue';
import { devState, saveDev, setDevMode, resetDev } from '../../dev/state.js';
import { COLORS, LOD_COLORS } from '../../dev/overlayData.js';
import { fmtNum } from '../../dev/statsText.js';
import { BALANCE } from '../../sim/data/balance.js';
import { has } from '../../i18n/index.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const css = (c) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${Math.max(0.55, c[3] / 255)})`;

/** Legends of the grid overlays: [colour, i18n key]. */
const LEGENDS = {
  walk: [['free', 'dev.walk.free'], ['blocked', 'dev.walk.blocked'], ['cliff', 'dev.walk.cliff'], ['water', 'dev.walk.water'], ['ice', 'dev.walk.ice'], ['reserved', 'dev.walk.reserved'], ['bridge', 'dev.walk.bridge']],
  build: [['buildable', 'dev.build.ok'], ['steep', 'dev.build.steep'], ['blocked', 'dev.build.blocked'], ['reserved', 'dev.build.spot']],
  vision: [['visible', 'dev.vis.visible'], ['explored', 'dev.vis.explored'], ['unexplored', 'dev.vis.unexplored']],
};

export default {
  name: 'DevPanel',
  components: { DevStats },
  props: { engine: { type: Object, required: true }, touch: Boolean },
  data() {
    return {
      s: devState, snap: null, stats: null,
      tabs: ['render', 'path', 'grid', 'units'],
      cats: ['terrain', 'buildings', 'figures', 'water', 'nature'],
      grids: ['none', 'walk', 'height', 'build', 'vision', 'territory'],
      lodColors: LOD_COLORS.map(hex),
      maxSlope: BALANCE.maxSlope,
    };
  },
  computed: {
    lodGroups() {
      const lod = this.stats?.lod ?? {};
      return ['building', 'tree', 'character', 'scatterLarge', 'scatterSmall'].filter((k) => lod[k]).map((k) => [k, lod[k]]);
    },
    legend() {
      return (LEGENDS[this.s.grid] ?? []).map(([c, key]) => ({ key, color: css(COLORS[c]) }));
    },
    /** Speed slider logarithmic: 0…100 → 1…400 steps/s */
    speedPos() { return Math.round((Math.log(this.s.playSpeed) / Math.log(400)) * 100); },
  },
  mounted() {
    // Remember options (Vue observes devState deeply)
    this.stopWatch = watch(devState, saveDev, { deep: true });
    this.poll();
    this.timer = setInterval(() => this.poll(), 250);
  },
  beforeUnmount() { clearInterval(this.timer); this.stopWatch?.(); },
  methods: {
    poll() {
      const dev = this.engine.dev;
      if (!dev) return;
      this.snap = dev.snapshot();
      // Hash and counts only when they are shown (the statistics window computes itself)
      if (this.s.tab === 'units' || this.s.tab === 'render') this.stats = dev.stats();
    },
    dev(method, arg) { const d = this.engine.dev; if (d) { d[method](arg); this.poll(); } },
    setSpeed(pos) { this.s.playSpeed = Math.max(1, Math.round(Math.pow(400, pos / 100))); },
    fmt: fmtNum,
    rgba(k) { return css(COLORS[k]); },
    kindName(k) { return has('dev.kind.' + k) ? this.$t('dev.kind.' + k) : k; },
    stateName(st) { return has('dev.state.' + st) ? this.$t('dev.state.' + st) : st; },
    groupName(g) { return has('dev.group.' + g) ? this.$t('dev.group.' + g) : g; },
    turnOff() { setDevMode(false); },
    reset() { resetDev(); },
  },
};
</script>

<style>
.dev-fab {
  position: fixed; z-index: 21; right: calc(0.5rem + var(--safe-r)); top: calc(var(--top-total, 4rem) + 0.5rem);
  font: 700 12px/1 ui-monospace, Menlo, Consolas, monospace; letter-spacing: 0.04em;
  color: #bfe6ff; background: rgba(8, 14, 20, 0.82); border: 1px solid rgba(140, 200, 255, 0.45); min-height: 2.25rem;
}
.dev-panel {
  position: fixed; z-index: 21; display: flex; flex-direction: column;
  right: calc(0.5rem + var(--safe-r)); top: calc(var(--top-total, 4rem) + 0.5rem);
  width: min(22rem, calc(100vw - 1rem));
  /* end above the command bar, but never smaller than 24rem (may cover a large building panel) */
  max-height: min(calc(100dvh - var(--top-total, 4rem) - 1rem), max(24rem, calc(100dvh - var(--top-total, 4rem) - var(--bottom-h, 13rem) - 1.5rem)));
  font-size: var(--fs-sm);
}
.dp-head { display: flex; align-items: center; gap: 0.375rem; padding: 0.5rem 0.375rem 0.375rem 0.75rem; }
.dp-head .h-title { flex: 1; font-size: var(--fs-lg); }
.dp-badge { font: 700 11px/1 ui-monospace, Menlo, monospace; color: #9fdcff; background: rgba(8, 14, 20, 0.6); border-radius: 4px; padding: 3px 5px; }
.dp-mini { min-height: 1.875rem; padding: 0.125rem 0.5rem; font-size: var(--fs-xs); }
.dp-tabs { margin: 0 0.625rem; }
.dp-tabs > button { padding-inline: 0.25rem; font-size: var(--fs-sm); }
.dp-body { display: flex; flex-direction: column; gap: 0.4375rem; padding: 0.625rem 0.75rem 0.5rem; min-height: 0; }
.dp-body .h-label { margin: 0.375rem 0 0; }
.dp-body > button:not(.switch) { display: inline-flex; align-items: center; gap: 0.375rem; justify-content: center; }
.dp-ex {
  margin: 0; padding: 0.4375rem 0.5625rem; border-radius: var(--r-md); font-size: var(--fs-xs); line-height: 1.45;
  background: rgba(120, 190, 255, 0.08); box-shadow: inset 3px 0 0 rgba(140, 200, 255, 0.55); color: var(--ink);
}
.dp-note { margin: 0; font-size: var(--fs-xs); color: var(--ink-muted); line-height: 1.4; }
.dp-note:empty { display: none; }
.dp-checks { display: grid; grid-template-columns: 1fr 1fr; gap: 0.125rem 0.5rem; }
.dp-check { display: flex; align-items: center; gap: 0.4375rem; min-height: 2rem; cursor: pointer; }
.dp-check input { width: 1.0625rem; height: 1.0625rem; accent-color: var(--gold-400); margin: 0; }
.dp-body .switch { min-height: 2.25rem; }
.dp-legend { display: flex; flex-wrap: wrap; gap: 0.25rem 0.625rem; font-size: var(--fs-xs); color: var(--ink-muted); }
.dp-legend span { display: inline-flex; align-items: center; gap: 0.3125rem; }
.dp-legend i, .dp-levels i { width: 0.75rem; height: 0.75rem; border-radius: 3px; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45); display: inline-block; }
.dp-kv { display: grid; grid-template-columns: auto 1fr; gap: 0.1875rem 0.75rem; margin: 0; }
.dp-kv dt { color: var(--ink-muted); }
.dp-kv dd { margin: 0; text-align: right; color: var(--ink); }
.dp-kv dd.good { color: var(--good); } .dp-kv dd.bad { color: var(--bad); }
.dp-poly, .dp-search { display: flex; flex-direction: column; gap: 0.3125rem; padding: 0.5rem; border-radius: var(--r-md); background: var(--inset-bg); box-shadow: var(--inset-edge); }
.dp-poly-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.dp-chip { font-size: var(--fs-xs); font-weight: 700; color: #1a1206; padding: 0.0625rem 0.4375rem; border-radius: 1rem; }
.dp-levels { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.1875rem; font-size: var(--fs-xs); }
.dp-levels li { display: grid; grid-template-columns: 0.75rem 3rem 3.75rem 1fr; align-items: center; gap: 0.375rem; color: var(--ink-muted); }
.dp-levels li.cur { color: var(--gold-200); font-weight: 700; }
.dp-levels .bar { height: 0.375rem; border-radius: 1rem; background: rgba(0, 0, 0, 0.35); overflow: hidden; }
.dp-levels .bar b { display: block; height: 100%; background: var(--gold-400); }
.dp-table { border-collapse: collapse; font-size: var(--fs-xs); width: 100%; }
.dp-table th { text-align: left; font-weight: 400; color: var(--ink-muted); padding: 0.0625rem 0.375rem 0.0625rem 0; }
.dp-table td { text-align: right; padding: 0.0625rem 0.25rem; }
.dp-table tr:first-child th { text-align: right; font-weight: 700; }
.dp-fig { display: flex; flex-direction: column; gap: 0.0625rem; }
.dp-steps { margin: 0; font-size: var(--fs-xs); color: var(--ink-muted); text-align: center; }
.dp-player { display: flex; justify-content: center; gap: 0.3125rem; }
.dp-player .icon-btn { width: 2.5rem; min-width: 2.5rem; font-size: 0.9375rem; }
.dp-speed { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 0.5rem; font-size: var(--fs-xs); color: var(--ink-muted); }
.dp-speed input { height: 1.75rem; }
.dp-speed b { color: var(--gold-200); min-width: 5.5rem; text-align: right; }
.dp-row { display: flex; gap: 0.375rem; flex-wrap: wrap; }
.dp-row > button { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 0.3125rem; font-size: var(--fs-sm); }
.dp-radios { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3125rem; }
.dp-radios > button { font-size: var(--fs-sm); padding-inline: 0.375rem; }
.dp-ramp { display: flex; align-items: center; gap: 0.5rem; font-size: var(--fs-xs); color: var(--ink-muted); }
.dp-ramp i { flex: 1; height: 0.625rem; border-radius: 1rem; background: linear-gradient(90deg, #142a8c, #2878dc, #24804a, #78be46, #ecd65c, #aa703c, #fafafa); box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4); }
.dp-hp { display: inline-block; width: 4rem; vertical-align: middle; }
.dp-hash { margin: 0; font-family: ui-monospace, Menlo, Consolas, monospace; color: var(--gold-200); }
.dp-foot { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0.75rem 0.5rem; border-top: 1px solid rgba(225, 168, 58, 0.18); }
.dp-explain { flex: 1; font-size: var(--fs-xs); }

/* Phone: bottom sheet above the command bar */
@media (max-width: 700px), (max-height: 500px) and (orientation: landscape) {
  .dev-panel {
    left: 0; right: 0; bottom: 0; top: auto; width: auto; max-height: 46dvh;
    border-radius: var(--r-lg) var(--r-lg) 0 0; padding-bottom: var(--safe-b); z-index: 24;
  }
  .dev-fab { top: auto; bottom: calc(var(--bottom-h, 13rem) + 0.5rem); }
  .dp-checks { grid-template-columns: 1fr 1fr; }
  .dp-radios { grid-template-columns: 1fr 1fr 1fr; }
}
</style>
