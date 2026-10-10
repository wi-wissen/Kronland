<template>
  <!-- Library: everything to play, in one list. Built-in levels and packs from sources/the server look the same (src/library/model.js).
       Left: filters, top: the kinds as tabs. A series opens its detail with one button per level. -->
  <div class="library backdrop" data-testid="library-menu">
    <div class="lib-wrap">
      <header class="lib-head">
        <button class="lib-back" data-testid="library-back" @click="back"><Icon name="back" />{{ openId ? $t('lib.detail.crumb') : $t('lib.back') }}</button>
        <h1 v-if="!openId">{{ $t('lib.title') }}</h1>
        <label v-if="!openId" class="lib-search"><span class="sr-only">{{ $t('lib.search') }}</span><input v-model="query" type="search" :placeholder="$t('lib.search')" data-testid="lib-search"></label>
      </header>

      <p v-if="notice || fileError" class="lib-err" role="alert" data-testid="level-error"><Icon name="warning" />{{ fileError || notice }}</p>

      <SeriesDetail
        v-if="selected"
        :series="selected"
        :saves="latestSaves"
        :busy="busy"
        :error="detailError"
        :loading="detailBusy"
        :needs-update="needsUpdate"
        :offline="detailOffline"
        :big="detailBig"
        :by="detailBy"
        @play="play"
        @restart="restart"
        @edit="edit"
        @delete="confirmDelete = true"
        @reload="reload"
      />

      <template v-else>
        <div class="lib-tabs" role="tablist" :aria-label="$t('lib.tabs')">
          <button v-for="k in tabs" :key="k" role="tab" class="lib-tab" :class="{ active: tab === k }" :aria-selected="tab === k" :data-testid="'lib-tab-' + k" @click="tab = k">
            {{ $t('lib.kind.' + k) }}<em class="num">{{ kindCounts[k] }}</em>
          </button>
        </div>

        <div class="lib-body">
          <aside class="lib-filters frame" :class="{ open: sheet }" :aria-label="$t('lib.filter')" data-testid="lib-filters">
            <header class="lib-sheet-head">
              <h2 class="h-title">{{ $t('lib.filter') }}</h2>
              <button class="ghost" data-testid="lib-filter-reset" :disabled="!activeCount" @click="reset">{{ $t('lib.filter.resetShort') }}</button>
              <button class="icon-btn ghost lib-sheet-close" :aria-label="$t('common.close')" @click="sheet = false"><Icon name="close" /></button>
            </header>
            <fieldset v-for="g in groups" :key="g.id" class="lib-group">
              <legend class="h-label">{{ $t('lib.filter.' + g.id) }}</legend>
              <label v-for="v in g.values" :key="v" class="lib-check" :class="{ none: !counts[g.id][v] && !filters[g.id].includes(v) }">
                <input v-model="filters[g.id]" type="checkbox" :value="v" :data-testid="`lib-f-${g.id}-${v}`">
                <span v-if="g.id === 'difficulty'" class="lib-dots" :data-level="rank(v)" aria-hidden="true"><i></i><i></i><i></i></span>
                <span class="lib-check-text">{{ $t(`${g.prefix}.${v}`) }}</span>
                <em class="num">{{ counts[g.id][v] }}</em>
              </label>
            </fieldset>
            <button class="primary lib-show" data-testid="lib-filter-show" @click="sheet = false">{{ $t('lib.filter.show', { n: list.length }) }}</button>
          </aside>
          <div v-if="sheet" class="lib-sheet-scrim" @click="sheet = false"></div>

          <section class="lib-main">
            <div class="lib-bar">
              <button class="lib-filterbtn" data-testid="lib-filter-open" @click="sheet = true"><Icon name="menu" />{{ activeCount ? $t('lib.filter.active', { n: activeCount }) : $t('lib.filter') }}</button>
              <span class="lib-count num" data-testid="lib-count">{{ $t('lib.results', { n: list.length }) }}</span>
              <span v-if="library.loading" class="lib-loading" role="status" data-testid="lib-loading">{{ $t('lib.loading') }}</span>
              <button v-else-if="library.errors.length" class="ghost lib-partial" data-testid="lib-partial" @click="refresh"><Icon name="warning" />{{ $t('lib.partial') }} {{ $t('lib.retry') }}</button>
            </div>

            <ul v-if="list.length" class="lib-grid" data-testid="lib-list">
              <li v-for="s in list" :key="s.id">
                <button class="lib-card" :class="[ 'k-' + s.kind, { locked: s.access === 'locked' } ]" :data-testid="'series-' + s.id" @click="open(s)">
                  <span class="lib-art" aria-hidden="true">
                    <img v-if="s.preview" class="lib-preview" :src="s.preview" alt="" loading="lazy" draggable="false">
                    <Icon v-else :name="icons[s.kind]" />
                    <span v-if="isNew(s)" class="lib-ribbon" data-testid="lib-new">{{ $t('lib.new') }}</span>
                    <span v-if="s.access === 'locked'" class="lib-lock"><Icon name="lock" /></span>
                  </span>
                  <span class="lib-card-body">
                    <span class="lib-kind">{{ $t('lib.kind.' + s.kind) }}<template v-if="s.own"> · {{ $t('lib.own') }}</template></span>
                    <b class="lib-title">{{ $tr(s.title) }}</b>
                    <small v-if="s.summary" class="lib-sum">{{ $tr(s.summary) }}</small>
                    <span v-if="s.levels.length" class="lib-chain" aria-hidden="true">
                      <i v-for="l in s.levels" :key="l.id" :class="l.state"></i>
                    </span>
                    <span class="lib-state">{{ stateLine(s) }}</span>
                    <span class="lib-facts">
                      <span v-if="s.difficulty" class="lib-fact"><span class="lib-dots" :data-level="rank(s.difficulty)" aria-hidden="true"><i></i><i></i><i></i></span>{{ $t('lib.diff.' + s.difficulty) }}</span>
                      <span v-if="s.minutes" class="lib-fact"><Icon name="time" />{{ minutesText(s.minutes) }}</span>
                    </span>
                  </span>
                </button>
              </li>
            </ul>
            <p v-else-if="!library.loading" class="lib-empty frame" data-testid="lib-empty"><b>{{ $t('lib.empty') }}</b><br>{{ activeCount || query ? $t('lib.emptyFilter') : $t('lib.emptyNone') }}</p>

            <details v-if="tab === 'all' || tab === 'code'" class="lib-mine frame" data-testid="lib-mine">
              <summary>{{ $t('lib.mine.title') }}</summary>
              <div class="lib-mine-body">
                <label class="lib-mine-btn" data-testid="open-file">
                  <Icon name="upload" /><span><b>{{ $t('lib.mine.file') }}</b><small>{{ $t('lib.mine.fileSub') }}</small></span>
                  <input type="file" accept=".zip,.json,application/zip,application/json" class="lib-file" data-testid="scenario-file" @change="loadFile">
                </label>
                <form class="lib-link" data-testid="level-link-form" @submit.prevent="openLink">
                  <input v-model.trim="link" type="url" inputmode="url" :placeholder="$t('adv.linkPlaceholder')" :aria-label="$t('lib.mine.link')" data-testid="level-link">
                  <button class="ghost" type="submit" :disabled="!link" data-testid="level-link-open">{{ $t('lib.mine.go') }}</button>
                </form>
                <a class="lib-mine-btn" :href="referenceUrl" target="_blank" rel="noopener" data-testid="open-reference"><Icon name="book" /><span><b>{{ $t('lib.mine.reference') }}</b><small>{{ $t('lib.mine.referenceSub') }}</small></span></a>
              </div>
            </details>
          </section>
        </div>
      </template>
    </div>
    <ConfirmDialog v-if="confirmDelete" :title="$t('lib.confirmDelete.title')" :text="$t('lib.confirmDelete.text', { name: selected ? $tr(selected.title) : '' })" :confirm-label="$t('lib.delete')" danger @cancel="confirmDelete = false" @confirm="remove" />
  </div>
</template>

<script>
import SeriesDetail from './SeriesDetail.vue';
import ConfirmDialog from '../saves/ConfirmDialog.vue';
import { loadProgress, isUnlocked } from '../mission/progress.js';
import { getStore, SaveError } from '../../save/index.js';
import { library, seen } from '../../net/state.js';
import { loadDone } from '../../net/progress.js';
import { isNewEntry, todayString } from '../../net/seen.js';
import { errorMessage } from '../../net/errors.js';
import { has, t } from '../../i18n/index.js';
import { validateScenario } from '../../sim/scripting/scenario.js';
import { refUrl } from '../script/reference.js';
import {
  builtinSeries, packSeries, filterSeries, facetCounts, countByKind, sortRecommended, latestByMission, DIFFICULTIES, DURATIONS, STATUSES, KINDS, durationOf,
} from '../../library/model.js';

const ICONS = { first: 'scroll', stories: 'banner', code: 'mode-adventure' };
const GROUPS = [
  { id: 'difficulty', prefix: 'lib.diff', values: DIFFICULTIES },
  { id: 'duration', prefix: 'lib.dur', values: DURATIONS.map((d) => d.id) },
  { id: 'status', prefix: 'lib.status', values: STATUSES },
];

export default {
  name: 'LibraryMenu',
  components: { SeriesDetail, ConfirmDialog },
  props: {
    lang: { type: String, default: 'de' },
    /** Why a level from a file or link could not be opened */
    notice: { type: String, default: '' },
    /** Tab to show first: 'all' or a kind */
    kind: { type: String, default: 'all' },
    /** Series to open at once (link ?play=) */
    preselect: { type: String, default: '' },
    /** A pack named by a link (?play=) that no catalog lists */
    extra: { type: Object, default: null },
    /** All save games (entries), newest first */
    saves: { type: Array, default: () => [] },
  },
  emits: ['back', 'start', 'load', 'play-pack', 'open', 'link', 'edit'],
  data() {
    return {
      tab: ['all', ...KINDS].includes(this.kind) ? this.kind : 'all', query: '', sheet: false, openId: '',
      filters: { difficulty: [], duration: [], status: [] },
      progress: loadProgress(), done: loadDone(), library, icons: ICONS, groups: GROUPS, tabs: ['all', ...KINDS],
      busy: false, detailBusy: false, detailError: '', needsUpdate: false, detailOffline: false, detailBig: false, detailBy: '', pack: null, packLevels: [],
      confirmDelete: false, fileError: '', link: '',
    };
  },
  computed: {
    latestSaves() { return latestByMission(this.saves); },
    running() { return new Set(this.latestSaves.keys()); },
    builtin() { return builtinSeries({ progress: this.progress, running: this.running, t, unlocked: isUnlocked }); },
    packs() {
      const entries = [...library.packs];
      if (this.extra && !entries.some((p) => p.id === this.extra.id)) entries.unshift(this.extra);
      return packSeries(entries, this.done, this.running);
    },
    all() { return [...this.builtin, ...this.packs]; },
    today() { return todayString(); },
    textOf() { return (x) => this.$tr(x); },
    /** Without the kind tab: the base for the counts of the tabs */
    base() { return filterSeries(this.all, { ...this.filters, query: this.query }, this.textOf); },
    kindCounts() { return countByKind(this.base); },
    list() { return sortRecommended(filterSeries(this.all, { kind: this.tab, ...this.filters, query: this.query }, this.textOf), (s) => this.isNew(s)); },
    counts() {
      const f = { kind: this.tab, ...this.filters, query: this.query };
      return Object.fromEntries(GROUPS.map((g) => [g.id, facetCounts(this.all.filter((s) => this.tab === 'all' || s.kind === this.tab), f, g.id, g.values)]));
    },
    activeCount() { return Object.values(this.filters).reduce((n, v) => n + v.length, 0); },
    selected() {
      const s = this.all.find((x) => x.id === this.openId);
      if (!s) return null;
      // A pack shows its levels once they are loaded
      return s.source === 'pack' && this.pack?.id === s.id ? { ...s, levels: this.packLevels, count: this.packLevels.length || s.count } : s;
    },
    referenceUrl() { return refUrl(); },
  },
  watch: {
    // Language switch while the library is open: nothing to reload, texts are computed
    saves() { this.syncLevels(); },
  },
  async mounted() {
    this.onKey = (e) => {
      if (e.key !== 'Escape' || document.querySelector('[data-testid="confirm-dialog"]')) return;
      if (this.sheet) this.sheet = false; else if (this.openId) this.back(); else this.$emit('back');
    };
    window.addEventListener('keydown', this.onKey);
    this.refresh();
    if (this.preselect) {
      // The catalogs may still be loading: wait for them before opening
      await this.waitForPacks();
      const hit = this.all.find((s) => s.id === this.preselect);
      if (hit) this.open(hit);
    }
  },
  beforeUnmount() { window.removeEventListener('keydown', this.onKey); },
  methods: {
    rank: (v) => DIFFICULTIES.indexOf(v) + 1,
    minutesText(m) { return m >= 90 ? this.$t('lib.hours', { n: (Math.round(m / 6) / 10).toLocaleString(this.$i18n.lang) }) : this.$t('lib.minutes', { n: m }); },
    isNew(s) { return s.source === 'pack' && isNewEntry(s, seen, this.today); },
    async refresh() {
      const { refreshLibrary } = await import('../../net/index.js');
      await refreshLibrary();
    },
    waitForPacks() {
      return new Promise((resolve) => {
        if (!library.loading) return resolve();
        const stop = this.$watch(() => library.loading, (l) => { if (!l) { stop(); resolve(); } });
      });
    },
    reset() { this.filters = { difficulty: [], duration: [], status: [] }; },
    back() {
      if (!this.openId) { this.$emit('back'); return; }
      this.openId = ''; this.pack = null; this.packLevels = []; this.detailError = ''; this.needsUpdate = false;
      this.progress = loadProgress(); this.done = loadDone();
    },
    stateLine(s) {
      if (s.access === 'locked') return this.$t('lib.locked');
      if (s.status === 'done') return this.$t('lib.state.done');
      if (s.doneCount === 0 && s.status === 'open') return this.$t('lib.state.fresh');
      const cur = s.levels.find((l) => l.state === 'running');
      if (cur) return this.$t('lib.state.running', { done: s.doneCount, total: s.count, level: cur.label ? (s.kind === 'stories' ? this.$t('lib.chapter', { n: cur.label }) : cur.label) : this.$tr(cur.title) });
      return this.$t('lib.state.progress', { done: s.doneCount, total: s.count });
    },
    async open(s) {
      this.openId = s.id;
      this.detailError = ''; this.needsUpdate = false; this.detailOffline = false; this.detailBig = false; this.detailBy = ''; this.pack = null; this.packLevels = [];
      if (s.source !== 'pack') return;
      import('../../net/index.js').then((m) => m.markSeen(s.id));
      if (s.access === 'locked') return;
      this.detailBusy = true;
      try {
        const { openPack } = await import('../../net/index.js');
        const pack = await openPack(s.entry);
        if (this.openId !== s.id) return;
        const { levelDefs } = await import('../../net/packs.js');
        this.pack = pack;
        this.packDefs = levelDefs(pack);
        this.detailOffline = !!pack.offline;
        this.detailBig = !!pack.warnings?.length;
        this.detailBy = [pack.manifest?.author, pack.manifest?.license].filter(Boolean).join(' · ');
        this.syncLevels();
      } catch (e) {
        if (this.openId !== s.id) return;
        this.detailError = errorMessage(e, t, has);
        this.needsUpdate = ['packs.err.minClient', 'packs.err.newer'].includes(e?.code);
      } finally { if (this.openId === s.id) this.detailBusy = false; }
    },
    /** Level states of the open pack (done marks and save games change while the library is open). */
    syncLevels() {
      if (!this.pack) return;
      this.done = loadDone();
      this.packLevels = this.packDefs.map((d) => ({
        id: d.id, title: d.title, summary: d.summary ?? undefined, difficulty: d.difficulty ?? undefined, minutes: d.minutes ?? undefined,
        state: this.running.has(d.id) ? 'running' : this.done[`${this.pack.id}/${d.id}`] ? 'done' : 'open',
      }));
    },
    /** Level button: running -> load the newest save game, otherwise start. */
    async play(level) {
      const s = this.selected;
      if (level.state === 'running') { await this.continueLevel(level.id); return; }
      await this.start(s, level);
    },
    restart(level) { return this.start(this.selected, level); },
    async start(s, level) {
      if (s.source === 'pack') {
        const { levelPackage } = await import('../../net/packs.js');
        this.$emit('play-pack', levelPackage(this.pack, level.id));
      } else this.$emit('start', level.id);
    },
    async continueLevel(id) {
      const entry = this.latestSaves.get(id);
      if (!entry) return;
      this.busy = true;
      this.detailError = '';
      try { this.$emit('load', await (await getStore()).load(entry.id)); } catch (e) {
        this.detailError = this.$t(e instanceof SaveError ? e.code : 'saves.err.unknown', e?.params ?? {});
      } finally { this.busy = false; }
    },
    async edit(levelId) {
      try {
        const { serverPacks } = await import('../../net/index.js');
        this.$emit('edit', await (await serverPacks()).open(this.pack.id), levelId);
      } catch (e) { this.detailError = errorMessage(e, t, has); }
    },
    async remove() {
      this.confirmDelete = false;
      try {
        const { serverPacks, refreshLibrary } = await import('../../net/index.js');
        await (await serverPacks()).remove(this.openId);
        this.back();
        await refreshLibrary();
      } catch (e) { this.detailError = errorMessage(e, t, has); }
    },
    reload() { location.reload(); },
    /** Level from the device: a .zip (folder with scenario.json, .py files, assets/) or a scenario file .json. */
    async loadFile(ev) {
      const f = ev.target.files?.[0];
      ev.target.value = '';
      if (!f) return;
      this.fileError = '';
      try {
        let pkg;
        if (/\.zip$/i.test(f.name) || f.type === 'application/zip') {
          const { readLevelZip } = await import('../../levels/package.js');
          pkg = readLevelZip(await f.arrayBuffer());
        } else {
          const json = JSON.parse((await f.text()).replace(/^﻿/, ''));
          const problems = validateScenario(json);
          pkg = { scenario: problems.length ? null : json, assets: new Map(), problems };
        }
        if (!pkg.scenario) { this.fileError = this.$t('adv.loadFailed', { why: pkg.problems[0] }); return; }
        this.$emit('open', pkg);
      } catch (e) {
        this.fileError = this.$t('adv.loadFailed', { why: e.message });
      }
    },
    openLink() { if (this.link) this.$emit('link', this.link); },
  },
};
</script>

<style>
.lib-wrap { max-width: 68rem; margin: 0 auto; display: flex; flex-direction: column; gap: 0.875rem; }
.lib-head { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
.lib-head h1 { font-family: var(--display); color: var(--gold-200); font-size: clamp(2rem, 5vw, 2.75rem); margin: 0; letter-spacing: 0.04em; line-height: 1; text-shadow: 0 2px 0 var(--gold-800), 0 4px 12px rgba(0, 0, 0, 0.6); flex: 1; }
.lib-back { display: inline-flex; align-items: center; gap: 0.375rem; }
.lib-search { margin-left: auto; flex: 0 1 18rem; }
.lib-search input { width: 100%; }
.lib-err { margin: 0; display: flex; gap: 0.5rem; align-items: center; padding: 0.5rem 0.75rem; border-radius: var(--r-md); background: rgba(80, 18, 14, 0.85); color: #ffd9d2; font-size: var(--fs-sm); }

.lib-tabs { display: flex; gap: 0.375rem; flex-wrap: wrap; }
.lib-tab { gap: 0.5rem; background: rgba(20, 12, 8, 0.6); border-color: transparent; border-radius: 999px; padding-inline: 1rem; color: #fff3da; }
.lib-tab em { font-style: normal; font-size: var(--fs-xs); color: var(--ink-muted); }
.lib-tab.active { color: #2a1a06; background: linear-gradient(180deg, var(--gold-200), var(--gold-400)); font-weight: 700; }
.lib-tab.active em { color: #5e3f0d; }

.lib-body { display: grid; grid-template-columns: 14.5rem minmax(0, 1fr); gap: 1rem; align-items: start; }
.lib-filters { padding: 0.75rem 0.875rem 1rem; display: flex; flex-direction: column; gap: 0.75rem; position: sticky; top: 0; }
.lib-sheet-head { display: flex; align-items: center; gap: 0.5rem; justify-content: space-between; }
.lib-sheet-head .h-title { flex: 1; }
.lib-sheet-head button.ghost { font-size: var(--fs-sm); white-space: nowrap; padding-inline: 0.5rem; }
button.lib-sheet-close, .lib-show, .lib-sheet-scrim, .lib-filterbtn { display: none; }
.lib-group { border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; }
.lib-group legend { padding: 0; width: 100%; margin-bottom: 0.25rem; }
.lib-check { display: flex; align-items: center; gap: 0.5rem; min-height: var(--touch); cursor: pointer; border-radius: var(--r-md); padding: 0 0.375rem; }
.lib-check:hover { background: rgba(255, 225, 170, 0.06); }
.lib-check.none .lib-check-text { color: var(--ink-dim); }
.lib-check-text { flex: 1; min-width: 0; }
.lib-check em { font-style: normal; color: var(--ink-dim); font-size: var(--fs-sm); }
.lib-dots { display: inline-flex; gap: 2px; }
.lib-dots i { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: rgba(255, 225, 170, 0.22); }
.lib-dots[data-level='1'] i:nth-child(-n + 1), .lib-dots[data-level='2'] i:nth-child(-n + 2), .lib-dots[data-level='3'] i { background: var(--gold-300); }

.lib-main { display: flex; flex-direction: column; gap: 0.75rem; min-width: 0; }
.lib-bar { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; min-height: 1.5rem; }
.lib-count, .lib-loading { color: #fff3da; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85); font-size: var(--fs-sm); }
.lib-partial { color: var(--warn); font-size: var(--fs-sm); }
.lib-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr)); gap: 0.75rem; }
.lib-grid > li { display: flex; }
.lib-card {
  position: relative; width: 100%; display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start; gap: 0; padding: 0; text-align: left; overflow: hidden;
  background: var(--panel-bg); box-shadow: var(--panel-edge); border-color: transparent; border-radius: var(--r-lg);
}
.lib-art { position: relative; height: 6rem; display: grid; place-items: center; overflow: hidden; background: linear-gradient(160deg, #3d5a73, #1f3140); }
.lib-card.k-stories .lib-art { background: linear-gradient(160deg, #8a5a2a, #3b2616); }
.lib-card.k-first .lib-art { background: linear-gradient(160deg, #6d8a45, #2f4122); }
.lib-card.k-code .lib-art { background: linear-gradient(160deg, #2e6b6a, #14302f); }
.lib-art img.lib-preview { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.lib-art > .ico { width: 3rem; height: 3rem; opacity: 0.9; }
.lib-ribbon { position: absolute; top: 0.5rem; left: 0.5rem; padding: 0 0.625rem; border-radius: 999px; background: var(--bad); color: #2a0b05; font-size: var(--fs-xs); font-weight: 800; line-height: 1.5rem; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5); }
.lib-lock { position: absolute; top: 0.5rem; right: 0.5rem; width: 1.75rem; height: 1.75rem; border-radius: 50%; display: grid; place-items: center; background: rgba(20, 12, 8, 0.8); }
.lib-lock .ico { width: 1rem; height: 1rem; }
.lib-card.locked .lib-art { filter: grayscale(0.7); }
.lib-card-body { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.625rem 0.875rem 0.75rem; min-width: 0; }
.lib-kind { color: var(--gold-300); font-size: var(--fs-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
.lib-title { font-family: var(--display); color: var(--gold-200); font-size: var(--fs-xl); line-height: 1.1; font-weight: 700; }
.lib-sum { color: var(--ink-muted); font-size: var(--fs-sm); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.lib-chain { display: flex; gap: 0.25rem; flex-wrap: wrap; margin-top: 0.125rem; }
.lib-chain i { width: 0.625rem; height: 0.625rem; border-radius: 50%; background: rgba(255, 225, 170, 0.18); box-shadow: inset 0 0 0 1px rgba(225, 168, 58, 0.4); }
.lib-chain i.done { background: var(--good); box-shadow: none; }
.lib-chain i.running { background: var(--gold-300); box-shadow: 0 0 6px rgba(243, 200, 94, 0.7); }
.lib-chain i.locked { background: transparent; box-shadow: inset 0 0 0 1px rgba(205, 187, 152, 0.35); }
.lib-state { color: var(--ink); font-size: var(--fs-sm); }
.lib-facts { display: flex; gap: 0.875rem; flex-wrap: wrap; color: var(--ink-muted); font-size: var(--fs-sm); }
.lib-fact { display: inline-flex; align-items: center; gap: 0.375rem; }
.lib-fact .ico { width: 1rem; height: 1rem; }
.lib-empty { margin: 0; padding: 1.25rem; text-align: center; color: var(--ink-muted); line-height: 1.6; }

.lib-mine { padding: 0; }
.lib-mine summary { cursor: pointer; padding: 0.75rem 1rem; min-height: var(--touch); display: flex; align-items: center; color: var(--ink-muted); }
.lib-mine[open] summary { color: var(--gold-200); }
.lib-mine-body { padding: 0 1rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
.lib-mine-btn { position: relative; display: flex; align-items: center; gap: 0.75rem; text-align: left; padding: 0.625rem 0.75rem; cursor: pointer; border-radius: var(--r-md); background: var(--inset-bg); box-shadow: var(--inset-edge); text-decoration: none; color: inherit; }
.lib-mine-btn b { display: block; color: var(--gold-200); }
.lib-mine-btn small { color: var(--ink-muted); font-size: var(--fs-sm); }
.lib-file { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; }
.lib-link { display: flex; gap: 0.5rem; min-width: 0; }
.lib-link input { flex: 1; min-width: 0; }

@media (max-width: 760px) {
  .lib-body { grid-template-columns: 1fr; }
  .lib-search { flex-basis: 100%; margin-left: 0; order: 3; }
  .lib-tabs { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; margin-inline: -1rem; padding-inline: 1rem; }
  .lib-tab { flex: none; }
  .lib-filterbtn { display: inline-flex; background: rgba(20, 12, 8, 0.6); }
  .lib-count { margin-left: auto; }
  /* Filters: a sheet from below */
  .lib-filters { display: none; position: fixed; left: 0; right: 0; bottom: 0; top: auto; z-index: 31; max-height: 82dvh; overflow-y: auto; border-radius: var(--r-lg) var(--r-lg) 0 0; padding-bottom: max(1rem, var(--safe-b)); }
  .lib-filters.open { display: flex; }
  .lib-sheet-scrim { display: block; position: fixed; inset: 0; z-index: 30; background: rgba(10, 6, 3, 0.6); }
  button.lib-sheet-close, .lib-show { display: inline-flex; }
  .lib-grid { grid-template-columns: 1fr; }
  .lib-card { flex-direction: row; }
  .lib-art { width: 5.5rem; height: auto; min-height: 100%; flex: none; }
  .lib-art > .ico { width: 2.25rem; height: 2.25rem; }
  .lib-ribbon { top: 0.375rem; left: 0.375rem; }
}
</style>
