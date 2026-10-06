<template>
  <div
    class="saves"
    :class="{ dragging }"
    data-testid="save-browser"
  >
    <form v-if="mode === 'save'" class="sv-new" @submit.prevent="saveNew">
      <label class="h-label" for="sv-name">{{ $t('saves.newName') }}</label>
      <div class="sv-newrow">
        <input id="sv-name" v-model="newName" maxlength="80" autocomplete="off" data-testid="save-name">
        <button type="submit" class="primary sv-savebtn" :disabled="busy || !newName.trim()" data-testid="save-new"><Icon name="save" />{{ $t('saves.saveNew') }}</button>
      </div>
    </form>

    <p v-if="message" class="sv-msg" :class="message.tone" :role="message.tone === 'bad' ? 'alert' : 'status'" data-testid="save-message">
      <Icon :name="message.tone === 'bad' ? 'warning' : 'check'" />{{ message.text }}
    </p>

    <p v-if="loading" class="sv-empty">{{ $t('saves.loading') }}</p>
    <p v-else-if="!entries.length" class="sv-empty" data-testid="save-empty">{{ $t('saves.empty') }}</p>
    <ul v-else class="sv-list" data-testid="save-list">
      <li
        v-for="e in entries"
        :key="e.id"
        class="sv-item"
        :class="{ fresh: e.id === highlight, auto: e.auto }"
        :data-save-id="e.id"
        data-testid="save-item"
      >
        <div class="sv-thumb inset">
          <img v-if="e.thumb" :src="e.thumb" alt="" draggable="false">
          <Icon v-else :name="e.mode === 'mission' ? 'banner' : 'mode-special'" />
        </div>
        <div class="sv-info">
          <form v-if="renaming === e.id" class="sv-rename" @submit.prevent="applyRename(e)">
            <input ref="renameInput" v-model="renameText" maxlength="80" :aria-label="$t('saves.rename')" data-testid="rename-input" @keydown.esc.stop.prevent="renaming = null">
            <button type="submit" class="icon-btn primary" :aria-label="$t('saves.renameDone')" data-testid="rename-ok"><Icon name="check" /></button>
          </form>
          <strong v-else class="sv-name" data-testid="save-item-name">
            <span v-if="e.auto" class="sv-badge">{{ $t('saves.auto') }}</span>{{ e.name }}
          </strong>
          <span class="sv-meta num">{{ when(e.savedAt) }} · {{ $t('saves.playTime', { t: playTime(e.tick) }) }}</span>
          <span class="sv-meta">{{ modeLabel(e) }} · {{ $t('saves.players', { n: e.players }) }}<template v-if="!e.fog"> · {{ $t('saves.fogOff') }}</template></span>
          <div class="sv-tools">
            <button v-if="!e.auto" v-tip="$t('saves.rename')" class="icon-btn ghost" :aria-label="$t('saves.rename')" data-testid="save-rename" @click="startRename(e)"><Icon name="edit" /></button>
            <button v-tip="$t('saves.export')" class="icon-btn ghost" :aria-label="$t('saves.export')" data-testid="save-export" @click="exportEntry(e)"><Icon name="download" /></button>
            <button v-tip="$t('saves.delete')" class="icon-btn ghost" :aria-label="$t('saves.delete')" data-testid="save-delete" @click="ask('delete', e)"><Icon name="trash" /></button>
          </div>
        </div>
        <div class="sv-main">
          <button v-if="mode === 'save' && !e.auto" class="sv-act" :disabled="busy" data-testid="save-overwrite" @click="ask('overwrite', e)"><Icon name="save" />{{ $t('saves.overwrite') }}</button>
          <button v-if="mode === 'load'" class="primary sv-act" :disabled="busy" data-testid="save-load" @click="inGame ? ask('load', e) : load(e)"><Icon name="load" />{{ $t('saves.load') }}</button>
        </div>
      </li>
    </ul>

    <footer class="sv-foot">
      <div class="sv-import">
        <button class="sv-importbtn" :disabled="busy" data-testid="save-import" @click="$refs.file.click()"><Icon name="upload" />{{ $t('saves.import') }}</button>
        <span v-if="!touch" class="sv-hint">{{ $t('saves.importHint') }}</span>
        <input ref="file" class="sr-only" type="file" :accept="touch ? null : '.json,application/json,text/plain'" tabindex="-1" aria-hidden="true" data-testid="save-file" @change="picked">
      </div>
      <button class="switch sv-compact" role="switch" :aria-checked="compact" data-testid="save-compact" @click="toggleCompact">
        <span class="st-sl-label">{{ $t('saves.compact') }}</span><span class="track"></span>
      </button>
      <p class="sv-store" :class="{ warn: storeKind === 'memory' || usage?.full }" data-testid="save-store">
        {{ storeKind ? $t('saves.store.' + storeKind) : '' }}
        <span v-if="usage" class="num" data-testid="save-usage"> {{ $t('saves.usage', usage) }}</span>
      </p>
    </footer>

    <div v-if="dragging" class="sv-drop" aria-hidden="true"><Icon name="upload" />{{ $t('saves.dropHere') }}</div>

    <ConfirmDialog
      v-if="confirm"
      :title="$t('saves.confirm.' + confirm.kind + '.title')"
      :text="$t('saves.confirm.' + confirm.kind + '.text', { name: confirm.entry.name })"
      :confirm-label="$t(confirmLabel)"
      :danger="confirm.kind === 'delete'"
      @cancel="confirm = null"
      @confirm="confirmed"
    />
  </div>
</template>

<script>
import ConfirmDialog from './ConfirmDialog.vue';
import { getStore, readSaveFile, downloadDoc, SaveError } from '../../save/index.js';
import { defaultSaveName, modeLabel, playTime } from '../../save/format.js';
import { makeThumb, thumbFromState } from './thumb.js';

const COMPACT_KEY = 'kronland-export-compact';

/**
 * List of save games with save, load, rename, delete, export and import.
 * mode 'save': engine needed (save the current game); mode 'load': load (emit 'load' with envelope).
 */
export default {
  name: 'SaveBrowser',
  components: { ConfirmDialog },
  props: {
    mode: { type: String, default: 'load' },
    /** Running engine (markRaw) – only in the game */
    engine: { type: Object, default: null },
    /** Loading replaces a running game → ask first */
    inGame: Boolean,
    touch: Boolean,
  },
  emits: ['load', 'saved', 'changed'],
  data() {
    let compact = false;
    try { compact = localStorage.getItem(COMPACT_KEY) === '1'; } catch { /* never mind */ }
    return {
      entries: [], loading: true, busy: false, message: null, highlight: null,
      newName: '', renaming: null, renameText: '', confirm: null, dragging: false, compact, storeKind: null,
      /** Storage usage according to the browser ({ used, quota } in MB) or null */
      usage: null,
    };
  },
  computed: {
    confirmLabel() { return { delete: 'saves.delete', overwrite: 'saves.overwrite', load: 'saves.load' }[this.confirm?.kind]; },
  },
  async mounted() {
    if (this.mode === 'save' && this.engine) {
      const sim = this.engine.sim;
      this.newName = defaultSaveName({ tick: sim.tick, mode: sim.mission ? 'mission' : 'free', mission: sim.mission?.def?.id ?? null, seed: sim.seed }, this.$t);
    }
    // Drag & drop anywhere in the window: so a save game dropped beside the target does not open the file
    // in the browser (that would leave the running game)
    this.dnd = { dragenter: this.dragEnter, dragover: this.dragOver, dragleave: this.dragLeave, drop: this.drop };
    for (const [k, fn] of Object.entries(this.dnd)) window.addEventListener(k, fn);
    await this.refresh();
  },
  beforeUnmount() {
    for (const [k, fn] of Object.entries(this.dnd ?? {})) window.removeEventListener(k, fn);
  },
  methods: {
    playTime,
    modeLabel(e) { return modeLabel(e, this.$t); },
    when(iso) {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime()) || d.getTime() === 0) return '–';
      return d.toLocaleString(this.$i18n.lang === 'en' ? 'en-GB' : 'de-DE', { dateStyle: 'short', timeStyle: 'short' });
    },
    async store() {
      const s = await getStore({ legacyName: this.$t('saves.legacyName') });
      this.storeKind = s.kind;
      return s;
    },
    async refresh() {
      try { this.entries = await (await this.store()).list(); } catch (e) { this.fail(e); }
      this.loading = false;
      this.$emit('changed', this.entries);
      this.estimate();
    },
    /** Show used and available browser storage (not available everywhere). */
    async estimate() {
      if (this.storeKind !== 'indexeddb') { this.usage = null; return; }
      try {
        const est = await navigator.storage?.estimate?.();
        if (!est?.quota) return;
        const mb = (n) => (n / 1048576).toFixed(n < 10 * 1048576 ? 1 : 0);
        this.usage = { used: mb(est.usage ?? 0), quota: mb(est.quota), full: (est.usage ?? 0) > est.quota * 0.9 };
      } catch { /* never mind */ }
    },
    say(key, params, tone = 'good') { this.message = { tone, text: this.$t(key, params) }; },
    fail(e) {
      // Unexpected errors belong in the console, the notice stays understandable
      if (!(e instanceof SaveError)) console.error(e);
      const code = e instanceof SaveError ? e.code : 'saves.err.unknown';
      this.message = { tone: 'bad', text: this.$t(code, e?.params ?? {}) };
    },
    async run(fn) {
      if (this.busy) { this.say('saves.busy', null, 'bad'); return; }
      this.busy = true;
      try { await fn(); } catch (e) { this.fail(e); } finally { this.busy = false; }
    },
    /** Make the element visible after rendering */
    reveal(id) {
      this.highlight = id;
      this.$nextTick(() => this.$el.querySelector(`[data-save-id="${id}"]`)?.scrollIntoView?.({ block: 'nearest' }));
    },
    async writeCurrent(id, name) {
      const store = await this.store();
      const entry = await store.save(this.engine.save(), { id, name, thumb: makeThumb(this.engine) });
      // Ask for persistent storage: otherwise the browser may clear the data when space runs short
      try { navigator.storage?.persist?.().catch(() => {}); } catch { /* never mind */ }
      await this.refresh();
      this.reveal(entry.id);
      this.$emit('saved', entry);
      return entry;
    },
    saveNew() {
      const name = this.newName.trim();
      if (!name || !this.engine) return;
      this.run(() => this.writeCurrent(undefined, name));
    },
    ask(kind, entry) { this.message = null; this.confirm = { kind, entry }; },
    confirmed() {
      const { kind, entry } = this.confirm;
      this.confirm = null;
      if (kind === 'delete') this.remove(entry);
      else if (kind === 'overwrite') this.run(() => this.writeCurrent(entry.id, entry.name));
      else if (kind === 'load') this.load(entry);
    },
    remove(entry) {
      this.run(async () => {
        await (await this.store()).remove(entry.id);
        await this.refresh();
        this.say('saves.deleted', { name: entry.name });
      });
    },
    load(entry) {
      this.run(async () => {
        const doc = await (await this.store()).load(entry.id);
        this.$emit('load', doc);
      });
    },
    startRename(e) {
      this.renaming = e.id;
      this.renameText = e.name;
      this.$nextTick(() => { const el = this.$refs.renameInput; (Array.isArray(el) ? el[0] : el)?.select(); });
    },
    applyRename(e) {
      const name = this.renameText.trim();
      this.renaming = null;
      if (!name || name === e.name) return;
      this.run(async () => {
        await (await this.store()).rename(e.id, name);
        await this.refresh();
        this.say('saves.renamed', { name });
      });
    },
    exportEntry(e) {
      this.run(async () => {
        const doc = await (await this.store()).load(e.id);
        const file = downloadDoc(doc, { compact: this.compact });
        this.say('saves.exported', { file });
      });
    },
    toggleCompact() {
      this.compact = !this.compact;
      try { localStorage.setItem(COMPACT_KEY, this.compact ? '1' : '0'); } catch { /* never mind */ }
    },
    importFile(file) {
      this.message = null;
      this.run(async () => {
        const doc = await readSaveFile(file);
        if (!doc.meta.name) doc.meta.name = file.name?.replace(/\.json$/i, '') || this.$t('saves.legacyName');
        const entry = await (await this.store()).importDoc(doc, { thumb: thumbFromState(doc.state) });
        await this.refresh();
        this.reveal(entry.id);
        this.say('saves.imported', { name: entry.name });
      });
    },
    picked(ev) {
      const f = ev.target.files?.[0];
      ev.target.value = '';
      if (f) this.importFile(f);
    },
    // Drag & drop (desktop). dragenter/leave are counted because child elements fire their own events.
    hasFiles(ev) { return [...(ev.dataTransfer?.types ?? [])].includes('Files'); },
    dragEnter(ev) { if (!this.hasFiles(ev)) return; ev.preventDefault(); this.depth = (this.depth ?? 0) + 1; this.dragging = true; },
    dragOver(ev) { if (!this.hasFiles(ev)) return; ev.preventDefault(); if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy'; },
    dragLeave(ev) { if (!this.hasFiles(ev)) return; this.depth = Math.max(0, (this.depth ?? 1) - 1); if (!this.depth) this.dragging = false; },
    drop(ev) {
      if (!this.hasFiles(ev)) return;
      ev.preventDefault();
      this.depth = 0;
      this.dragging = false;
      const files = [...(ev.dataTransfer?.files ?? [])];
      if (files.length > 1) { this.say('saves.err.multiple', null, 'bad'); return; }
      if (files[0]) this.importFile(files[0]);
    },
    /** Esc from the surrounding menu: close open sub-states first. @returns {boolean} consumed */
    escape() {
      if (this.confirm) { this.confirm = null; return true; }
      if (this.renaming) { this.renaming = null; return true; }
      return false;
    },
  },
};
</script>

<style>
.saves { position: relative; display: flex; flex-direction: column; gap: 0.75rem; min-height: 12rem; }
.sv-new { display: flex; flex-direction: column; gap: 0.375rem; }
.sv-newrow { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.sv-newrow input { flex: 1 1 12rem; min-height: var(--touch); }
.sv-savebtn { display: inline-flex; align-items: center; gap: 0.5rem; min-height: var(--touch); padding-inline: 1rem; }
.sv-msg { margin: 0; display: flex; gap: 0.5rem; align-items: flex-start; padding: 0.5rem 0.75rem; border-radius: var(--r-md); font-size: var(--fs-sm); line-height: 1.4; }
.sv-msg .ico { width: 1.125rem; height: 1.125rem; margin-top: 0.0625rem; }
.sv-msg.good { background: rgba(70, 160, 82, 0.18); color: #d9f2d2; box-shadow: inset 0 0 0 1px rgba(110, 190, 110, 0.35); }
.sv-msg.bad { background: rgba(192, 58, 63, 0.2); color: #ffd9d2; box-shadow: inset 0 0 0 1px rgba(220, 90, 80, 0.45); }
.sv-empty { margin: 1rem 0; text-align: center; color: var(--ink-muted); }
.sv-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.sv-item {
  display: grid; grid-template-columns: 4.5rem minmax(0, 1fr) auto; gap: 0.75rem; align-items: center;
  padding: 0.5rem 0.625rem; border-radius: var(--r-md); background: rgba(255, 225, 170, 0.05); box-shadow: inset 0 0 0 1px rgba(225, 168, 58, 0.18);
}
.sv-item.fresh { box-shadow: inset 0 0 0 2px var(--gold-400), 0 0 12px rgba(243, 200, 94, 0.25); }
.sv-item.auto { background: rgba(120, 160, 220, 0.07); }
.sv-thumb { width: 4.5rem; height: 4.5rem; display: grid; place-items: center; overflow: hidden; }
.sv-thumb img { width: 100%; height: 100%; object-fit: cover; image-rendering: auto; }
.sv-thumb .ico { width: 2rem; height: 2rem; color: var(--ink-dim); }
.sv-info { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; }
.sv-name { color: var(--gold-200); font-size: var(--fs-md); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sv-badge { display: inline-block; margin-right: 0.375rem; padding: 0 0.375rem; border-radius: 0.25rem; background: #3b6fbf; color: #fff; font-size: var(--fs-xs); vertical-align: 0.0625rem; }
.sv-meta { color: var(--ink-muted); font-size: var(--fs-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sv-tools { display: flex; gap: 0.125rem; margin-top: 0.125rem; margin-left: -0.375rem; }
.sv-tools .icon-btn { width: var(--touch); min-width: var(--touch); height: 2.25rem; }
.sv-tools .ico { width: 1.125rem; height: 1.125rem; }
.sv-rename { display: flex; gap: 0.375rem; }
.sv-rename input { flex: 1; min-width: 0; }
.sv-main { display: flex; flex-direction: column; gap: 0.375rem; }
.sv-act { display: inline-flex; align-items: center; justify-content: center; gap: 0.4375rem; min-height: var(--touch); padding-inline: 0.875rem; white-space: nowrap; }
.sv-foot { display: flex; flex-direction: column; gap: 0.375rem; padding-top: 0.5rem; border-top: 1px solid rgba(225, 168, 58, 0.18); }
.sv-import { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.sv-importbtn { display: inline-flex; align-items: center; gap: 0.5rem; min-height: var(--touch); padding-inline: 1rem; }
.sv-hint { color: var(--ink-dim); font-size: var(--fs-xs); }
.sv-compact .st-sl-label { font-size: var(--fs-sm); }
.sv-store { margin: 0; color: var(--ink-dim); font-size: var(--fs-xs); line-height: 1.4; }
.sv-store.warn { color: #ffcf9a; }
.sv-drop {
  position: absolute; inset: -0.5rem; z-index: 5; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem;
  border: 2px dashed var(--gold-400); border-radius: var(--r-lg); background: rgba(20, 13, 7, 0.88); color: var(--gold-200); font-size: var(--fs-lg); pointer-events: none;
}
.sv-drop .ico { width: 2.5rem; height: 2.5rem; }
@media (max-width: 520px) {
  .sv-item { grid-template-columns: 3.75rem minmax(0, 1fr); }
  .sv-thumb { width: 3.75rem; height: 3.75rem; }
  .sv-main { grid-column: 1 / -1; }
  .sv-main .sv-act { width: 100%; }
}
</style>
