<template>
  <!-- Discover levels: level packs from all sources (docs/SERVER.md). Locked packs show a lock and "Learn more". -->
  <div class="campaign backdrop" data-testid="discover-menu">
    <div class="cm-wrap">
      <header class="cm-head">
        <button class="cm-back" data-testid="discover-back" @click="$emit('back')"><Icon name="back" />{{ $t('mission.back') }}</button>
        <div class="cm-titles">
          <h1>{{ $t('disc.title') }}</h1>
          <p>{{ $t('disc.sub') }}</p>
        </div>
        <button class="disc-refresh ghost" :disabled="loading" :aria-label="$t('disc.refresh')" data-testid="discover-refresh" @click="load"><Icon name="load" /><span class="disc-refresh-lbl">{{ $t('disc.refresh') }}</span></button>
      </header>

      <p v-if="notice" class="disc-note-err" role="alert" data-testid="discover-notice">{{ notice }}</p>
      <p v-if="sourceErrors.length" class="disc-note-err" role="status" data-testid="discover-source-errors">
        <Icon name="warning" />{{ $t('disc.sourceErrors', { n: sourceErrors.length }) }}
        <small v-for="e in sourceErrors" :key="e.source">{{ hostOf(e.source) }}: {{ text(e.error) }}</small>
      </p>

      <div class="cm-body">
        <ol class="cm-list frame" data-testid="discover-list">
          <li v-if="loading" class="disc-empty" data-testid="discover-loading">{{ $t('disc.loading') }}</li>
          <li v-else-if="!packs.length" class="disc-empty" data-testid="discover-empty"><b>{{ $t('disc.empty') }}</b><br>{{ $t('disc.emptyHint') }}</li>
          <li v-for="p in packs" :key="p.id">
            <button class="cm-item" :class="{ active: p.id === selectedId, locked: p.access === 'locked' }" :data-testid="'pack-' + p.id" @click="select(p)">
              <span class="seal" aria-hidden="true"><Icon :name="p.access === 'locked' ? 'lock' : p.own ? 'user' : 'banner'" /></span>
              <span class="cm-text">
                <b>{{ $tr(p.title) }}</b>
                <small>{{ meta(p) }}</small>
              </span>
            </button>
          </li>
        </ol>

        <article v-if="selected" class="cm-brief parchment" data-testid="discover-brief">
          <span class="cm-chapter">{{ selected.own ? $t('disc.mine') : $t('disc.pack') }}<template v-if="selected.access === 'locked'"> · <Icon name="lock" class="disc-lockico" />{{ $t('disc.locked') }}</template></span>
          <h2>{{ $tr(selected.title) }}</h2>
          <img v-if="selected.preview" class="disc-preview" :src="selected.preview" alt="" loading="lazy" data-testid="discover-preview">
          <p v-if="selected.summary && $tr(selected.summary)" class="cm-story">{{ $tr(selected.summary) }}</p>

          <template v-if="selected.access === 'locked'">
            <p class="cm-story" data-testid="discover-locked">{{ $t('disc.lockedText') }}</p>
            <div class="cm-foot">
              <a class="cm-start disc-learn" :href="selected.link" target="_blank" rel="noopener noreferrer" data-testid="discover-learn">{{ $t('disc.learnMore') }}<Icon name="next" /></a>
            </div>
          </template>

          <template v-else>
            <p v-if="packBusy" class="cm-story" data-testid="discover-pack-loading">{{ $t('disc.loadingPack') }}</p>
            <p v-else-if="packError" class="disc-err" role="alert" data-testid="discover-pack-error">{{ packError }}</p>
            <div v-if="needsUpdate" class="cm-foot"><button class="cm-start" data-testid="discover-update" @click="reload">{{ $t('disc.reloadPage') }}<Icon name="load" /></button></div>
            <template v-if="pack">
              <p v-if="byline" class="disc-by">{{ byline }}</p>
              <p v-if="pack.offline" class="disc-by" data-testid="discover-offline"><Icon name="info" />{{ $t('disc.offline') }}</p>
              <p v-if="pack.warnings.length" class="disc-by"><Icon name="warning" />{{ $t('disc.bigModel') }}</p>
              <ul class="disc-levels" data-testid="discover-levels">
                <li v-for="l in levels" :key="l.id" :data-testid="'level-' + l.id">
                  <span class="disc-lvl-text"><b><Icon v-if="l.done" name="check" class="disc-done" :title="$t('disc.done')" />{{ $tr(l.title) }}</b><small v-if="l.summary">{{ $tr(l.summary) }}</small></span>
                  <span class="disc-lvl-act">
                    <button class="cm-start disc-play" :data-testid="'start-' + l.id" @click="start(l.id)">{{ $t('disc.start') }}<Icon name="next" /></button>
                    <button v-if="selected.own" class="disc-small" :data-testid="'edit-' + l.id" @click="edit(l.id)"><Icon name="edit" />{{ $t('disc.edit') }}</button>
                  </span>
                </li>
              </ul>
            </template>
            <div v-if="selected.own" class="cm-foot">
              <button class="disc-small danger" data-testid="discover-delete" @click="confirmDelete = true"><Icon name="trash" />{{ $t('disc.delete') }}</button>
            </div>
          </template>
        </article>
        <p v-else-if="!loading && packs.length" class="disc-pick">{{ $t('disc.select') }}</p>
      </div>
    </div>
    <ConfirmDialog v-if="confirmDelete" :title="$t('disc.confirmDelete.title')" :text="$t('disc.confirmDelete.text', { name: selected ? $tr(selected.title) : '' })" :confirm-label="$t('disc.delete')" danger @cancel="confirmDelete = false" @confirm="remove" />
  </div>
</template>

<script>
import { net } from '../../net/state.js';
import { errorMessage } from '../../net/errors.js';
import { has, t } from '../../i18n/index.js';
import { loadDone } from '../../net/progress.js';
import ConfirmDialog from '../saves/ConfirmDialog.vue';

/** Discover levels: catalogs of all sources, details and levels of a pack. */
export default {
  name: 'DiscoverMenu',
  components: { ConfirmDialog },
  props: {
    lang: { type: String, default: 'de' },
    /** Message from outside (a pack opened by link that failed) */
    notice: { type: String, default: '' },
    /** Pack to select at once (link ?play=) */
    preselect: { type: String, default: '' },
    /** A pack named by a link (?play=) that no catalog lists */
    extra: { type: Object, default: null },
  },
  emits: ['back', 'start', 'edit'],
  data() {
    return { loading: true, packs: [], sourceErrors: [], selectedId: '', pack: null, packBusy: false, packError: '', needsUpdate: false, confirmDelete: false, done: loadDone() };
  },
  computed: {
    selected() { return this.packs.find((p) => p.id === this.selectedId) ?? null; },
    levels() {
      if (!this.pack) return [];
      return this.defs.map((d) => ({ id: d.id, title: d.title, summary: d.summary, done: !!this.done[`${this.pack.id}/${d.id}`] }));
    },
    byline() {
      const m = this.pack?.manifest;
      return m ? [m.author, m.license].filter(Boolean).join(' · ') : '';
    },
  },
  created() { this.defs = []; this.stamp = 0; },
  mounted() { this.load(); },
  methods: {
    text(e) { return errorMessage(e, t, has); },
    hostOf(u) { try { return new URL(u).host; } catch { return u; } },
    meta(p) {
      const parts = [];
      if (p.levels) parts.push(this.$t('disc.levels', { n: p.levels }));
      if (p.access === 'locked') parts.push(this.$t('disc.locked'));
      else parts.push(p.origin.kind === 'server' ? this.$t('disc.sourceServer') : this.$t('disc.sourceOther'));
      return parts.join(' · ');
    },
    async load() {
      this.loading = true;
      try {
        const { listPacks } = await import('../../net/index.js');
        const r = await listPacks();
        this.packs = r.packs;
        this.sourceErrors = r.errors;
      } catch (e) {
        this.packs = [];
        this.sourceErrors = [{ source: net.server ?? '', error: e }];
      }
      if (this.extra && !this.packs.some((p) => p.id === this.extra.id)) this.packs = [this.extra, ...this.packs];
      this.loading = false;
      const want = this.selectedId || this.preselect;
      const hit = this.packs.find((p) => p.id === want);
      if (hit) this.select(hit);
    },
    async select(p) {
      this.selectedId = p.id;
      this.pack = null; this.packError = ''; this.needsUpdate = false; this.defs = [];
      if (p.access === 'locked') return;
      const stamp = ++this.stamp;
      this.packBusy = true;
      try {
        const { openPack } = await import('../../net/index.js');
        const pack = await openPack(p);
        if (stamp !== this.stamp) return;
        const { levelDefs } = await import('../../net/packs.js');
        this.defs = levelDefs(pack);
        this.pack = pack;
        this.done = loadDone();
      } catch (e) {
        if (stamp !== this.stamp) return;
        this.packError = this.text(e);
        this.needsUpdate = ['packs.err.minClient', 'packs.err.newer'].includes(e?.code);
      } finally { if (stamp === this.stamp) this.packBusy = false; }
    },
    async start(levelId) {
      const { levelPackage } = await import('../../net/packs.js');
      this.$emit('start', levelPackage(this.pack, levelId));
    },
    async edit(levelId) {
      try {
        const { serverPacks } = await import('../../net/index.js');
        this.$emit('edit', await (await serverPacks()).open(this.pack.id), levelId);
      } catch (e) { this.packError = this.text(e); }
    },
    async remove() {
      this.confirmDelete = false;
      try {
        const { serverPacks } = await import('../../net/index.js');
        await (await serverPacks()).remove(this.selected.id);
        this.selectedId = ''; this.pack = null;
        await this.load();
      } catch (e) { this.packError = this.text(e); }
    },
    reload() { location.reload(); },
  },
};
</script>

<style>
.disc-refresh { margin-left: auto; display: inline-flex; align-items: center; gap: 0.375rem; min-height: var(--touch); }
.disc-note-err { margin: 0; padding: 0.5rem 0.75rem; border-radius: var(--r-md); background: rgba(20, 12, 8, 0.7); color: #ffcf9a; display: flex; flex-wrap: wrap; gap: 0.25rem 0.5rem; align-items: center; }
.disc-note-err small { flex-basis: 100%; color: var(--ink-muted); }
.disc-empty { padding: 1rem; color: var(--ink-muted); list-style: none; line-height: 1.5; }
.disc-pick { color: #fff3da; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8); margin: 0.5rem; }
.disc-preview { width: 100%; max-width: 22rem; max-height: 12rem; object-fit: cover; border-radius: var(--r-md); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35); }
.disc-lockico { width: 1rem; height: 1rem; vertical-align: -0.125rem; }
.disc-learn { text-decoration: none; }
.disc-by { margin: 0; color: var(--parch-ink-muted); font-size: var(--fs-sm); display: flex; gap: 0.375rem; align-items: center; }
.disc-by .ico { width: 1rem; height: 1rem; }
.disc-err { margin: 0; color: #8c1f12; font-weight: 600; }
.disc-levels { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.disc-levels li { display: flex; gap: 0.75rem; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: 0.5rem 0.625rem; border-radius: var(--r-md); background: rgba(90, 60, 20, 0.1); }
.disc-lvl-text { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; flex: 1 1 12rem; }
.disc-lvl-text b { display: flex; align-items: center; gap: 0.375rem; }
.disc-lvl-text small { color: var(--parch-ink-muted); font-size: var(--fs-sm); line-height: 1.3; }
.disc-done { width: 1.125rem; height: 1.125rem; color: #3f6b2a; }
.disc-lvl-act { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.disc-play { margin-left: 0; min-height: var(--touch); padding: 0.25rem 1rem; font-size: var(--fs-md); }
.disc-small { display: inline-flex; align-items: center; gap: 0.375rem; min-height: var(--touch); }
@media (max-width: 760px) {
  .disc-refresh-lbl { display: none; }
  .disc-preview { max-height: 8rem; }
  .disc-levels li { flex-direction: column; align-items: stretch; }
  .disc-lvl-text { flex: 0 1 auto; }
  .disc-lvl-act .cm-start { flex: 1; }
}
</style>
