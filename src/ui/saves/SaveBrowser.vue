<template>
  <div class="saves" :class="{ dragging }" data-testid="save-browser">
    <header v-if="header" class="dialog-head sv-head">
      <div class="sv-titles">
        <h2 class="h-title">{{ $t('sv.title') }}</h2>
        <span v-if="!loading" class="sv-count" data-testid="save-count">{{ rows.length === 1 ? $t('sv.count1') : $t('sv.count', { n: rows.length }) }}</span>
      </div>
      <button class="sv-upload" :disabled="busy" v-tip="$t('sv.uploadTip')" data-testid="save-import" @click="$refs.file.click()"><Icon name="upload" /><span class="sv-upload-label">{{ $t('sv.upload') }}</span></button>
      <button class="icon-btn ghost" :aria-label="$t('common.close')" data-testid="saves-close" @click="$emit('close')"><Icon name="close" /></button>
    </header>
    <div class="sv-body" :class="{ 'scroll-y': header }">
      <div v-if="!header" class="sv-bar">
        <span v-if="!loading" class="sv-count" data-testid="save-count">{{ rows.length === 1 ? $t('sv.count1') : $t('sv.count', { n: rows.length }) }}</span>
        <button class="sv-upload" :disabled="busy" v-tip="$t('sv.uploadTip')" data-testid="save-import" @click="$refs.file.click()"><Icon name="upload" /><span class="sv-upload-label">{{ $t('sv.upload') }}</span></button>
      </div>
      <input ref="file" class="sr-only" type="file" :accept="touch ? null : '.json,application/json,text/plain'" tabindex="-1" aria-hidden="true" data-testid="save-file" @change="picked">

      <!-- Signed out where signing in is possible: one calm note above the list -->
      <p v-if="net.server && !net.signedIn" class="sv-note" data-testid="save-note">
        <Icon name="cloud" /><span class="sv-note-text">{{ $t('sv.noteDevice') }}</span>
        <button class="primary sm" data-testid="save-signin" @click="signIn">{{ $t('sv.signIn') }}</button>
      </p>

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
      <p v-if="storeKind === 'memory' || usage?.full" class="sv-msg bad" role="status" data-testid="save-store"><Icon name="warning" />{{ storeKind === 'memory' ? $t('sv.warnMemory') : $t('sv.warnFull') }}</p>

      <p v-if="loading" class="sv-empty">{{ $t('saves.loading') }}</p>
      <p v-else-if="!rows.length" class="sv-empty" data-testid="save-empty">{{ $t('sv.empty') }}</p>
      <ul v-else class="sv-list" data-testid="save-list">
        <li v-for="r in rows" :key="r.key" class="sv-item" :class="{ fresh: r.id === highlight, auto: r.auto }" :data-save-id="r.id" data-testid="save-item">
          <div class="sv-thumb inset">
            <img v-if="r.thumb" :src="r.thumb" alt="" draggable="false">
            <Icon v-else :name="r.info.kind === 'free' ? 'mode-special' : r.info.kind === 'code' ? 'mode-adventure' : r.info.kind === 'first' ? 'scroll' : 'banner'" />
          </div>
          <div class="sv-info">
            <span class="sv-line num">
              <span class="sv-kind">{{ $t('sv.kind.' + r.info.kind) }}</span>
              <span v-if="r.auto" class="sv-badge">{{ $t('saves.auto') }}</span>
              <span class="sv-when" :title="exact(r.savedAt)">{{ whenText(r.savedAt) }}</span>
            </span>
            <strong class="sv-name" data-testid="save-item-name">{{ r.info.title }}</strong>
            <span class="sv-meta num">{{ r.info.subtitle ? r.info.subtitle + ' · ' : '' }}{{ $t('sv.time', { t: playTime(r.tick) }) }}</span>
            <span v-if="net.signedIn" class="sv-where" :class="{ cloud: !!r.cloud }" data-testid="save-where">
              <Icon :name="r.cloud ? 'cloud' : 'load'" />{{ r.cloud ? $t('sv.inAccount') : $t('sv.deviceOnly') }}
              <button v-if="!r.cloud && !r.auto" class="ghost sm sv-backup" :disabled="busy" data-testid="save-backup" @click="backup(r)">{{ $t('sv.backup') }}</button>
            </span>
          </div>
          <div class="sv-main">
            <button v-if="mode === 'save' && !r.auto" class="sv-act" :disabled="busy" data-testid="save-overwrite" @click="ask('overwrite', r)"><Icon name="save" />{{ $t('sv.overwrite') }}</button>
            <button v-if="mode === 'load'" class="primary sv-act" :disabled="busy" data-testid="save-load" @click="inGame ? ask('load', r) : load(r)">{{ $t('sv.continue') }}</button>
            <div class="sv-more">
              <button class="icon-btn ghost sv-dots" :aria-label="$t('sv.menu')" aria-haspopup="menu" :aria-expanded="menuId === r.key" data-testid="save-more" @click.stop="menuId = menuId === r.key ? null : r.key"><span aria-hidden="true">⋯</span></button>
              <div v-if="menuId === r.key" class="sv-menu frame" role="menu" data-testid="save-menu">
                <button v-if="mode === 'load'" role="menuitem" class="ghost" data-testid="save-menu-load" @click="menuId = null; inGame ? ask('load', r) : load(r)">{{ $t('sv.continue') }}</button>
                <button role="menuitem" class="ghost" data-testid="save-export" @click="menuId = null; download(r)">{{ $t('sv.download') }}</button>
                <button role="menuitem" class="ghost danger-text" data-testid="save-delete" @click="menuId = null; ask('delete', r)">{{ $t('sv.delete') }}</button>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <div v-if="dragging" class="sv-drop" aria-hidden="true"><Icon name="upload" />{{ $t('sv.drop') }}</div>

    <ConfirmDialog
      v-if="confirm"
      :title="$t('saves.confirm.' + confirm.kind + '.title')"
      :text="$t('saves.confirm.' + confirm.kind + '.text', { name: confirm.row.info.title })"
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
import { defaultSaveName, playTime } from '../../save/format.js';
import { makeThumb, thumbFromState } from './thumb.js';
import { net } from '../../net/state.js';
import { has, t, tr } from '../../i18n/index.js';
import { builtinSeries, describeSave } from '../../library/model.js';
import { loadProgress, isUnlocked } from '../mission/progress.js';
import { whenText } from '../when.js';
import { mergeSaves } from './merge.js';

/**
 * List of save games, newest first, one calm row each: what it is, when, how long, where it lives (signed in).
 * mode 'save': engine needed (save the current game); mode 'load': continue (emit 'load' with envelope).
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
    /** Draw the title row (title, count, upload, close) – in the game the dialog has its own header */
    header: Boolean,
  },
  emits: ['load', 'saved', 'changed', 'close'],
  data() {
    return {
      deviceList: [], cloudList: [], loading: true, busy: false, message: null, highlight: null,
      newName: '', confirm: null, dragging: false, storeKind: null, menuId: null,
      /** Storage usage according to the browser ({ used, quota } in MB) or null */
      usage: null,
      net,
    };
  },
  computed: {
    confirmLabel() { return { delete: 'sv.delete', overwrite: 'sv.overwrite', load: 'sv.continue' }[this.confirm?.kind]; },
    series() { return builtinSeries({ progress: loadProgress(), running: new Set(), t, unlocked: isUnlocked }); },
    /** One row per save game; the same game on the device and in the account is one row */
    rows() {
      return mergeSaves(this.deviceList, this.cloudList).map((r) => ({
        ...r,
        info: describeSave(r, this.series, { t: (k, p) => this.$t(k, p), tr: (x) => this.$tr(x), defaultName: (e) => defaultSaveName(e, (k, p) => this.$t(k, p)) }),
      }));
    },
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
    this.closeMenu = () => { this.menuId = null; };
    window.addEventListener('click', this.closeMenu);
    await this.refresh();
  },
  beforeUnmount() {
    for (const [k, fn] of Object.entries(this.dnd ?? {})) window.removeEventListener(k, fn);
    window.removeEventListener('click', this.closeMenu);
  },
  methods: {
    playTime,
    whenText(iso) { return whenText(iso, (k, p) => this.$t(k, p), this.$i18n.lang); },
    exact(iso) {
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) || d.getTime() === 0 ? '' : d.toLocaleString(this.$i18n.lang === 'en' ? 'en-GB' : 'de-DE', { dateStyle: 'short', timeStyle: 'short' });
    },
    async device() {
      const s = await getStore({ legacyName: this.$t('saves.legacyName') });
      this.storeKind = s.kind;
      return s;
    },
    async cloud() {
      if (!net.signedIn) return null;
      return (await import('../../net/index.js')).cloudStore();
    },
    async refresh() {
      try {
        this.deviceList = await (await this.device()).list();
      } catch (e) { this.fail(e); }
      try {
        const cloud = await this.cloud();
        this.cloudList = cloud ? await cloud.list() : [];
        // The cloud list swallows errors like the local one; show why it is empty
        if (cloud?.backend.lastError) this.fail(cloud.backend.lastError);
      } catch (e) { this.cloudList = []; this.fail(e); }
      this.loading = false;
      this.$emit('changed', this.deviceList);
      this.estimate();
    },
    /** Show used and available browser storage (not available everywhere). */
    async estimate() {
      if (this.storeKind !== 'indexeddb') { this.usage = null; return; }
      try {
        const est = await navigator.storage?.estimate?.();
        if (!est?.quota) return;
        this.usage = { full: (est.usage ?? 0) > est.quota * 0.9 };
      } catch { /* never mind */ }
    },
    say(key, params, tone = 'good') { this.message = { tone, text: this.$t(key, params) }; },
    fail(e) {
      // Unexpected errors belong in the console, the notice stays understandable
      if (!(e instanceof SaveError)) console.error(e);
      const code = e instanceof SaveError && has(e.code) ? e.code : 'saves.err.unknown';
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
    async writeCurrent(row, name) {
      const store = await this.device();
      const entry = await store.save(this.engine.save(), { id: row?.device?.id, name, thumb: makeThumb(this.engine) });
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
      this.run(() => this.writeCurrent(null, name));
    },
    ask(kind, row) { this.message = null; this.confirm = { kind, row }; },
    confirmed() {
      const { kind, row } = this.confirm;
      this.confirm = null;
      if (kind === 'delete') this.remove(row);
      else if (kind === 'overwrite') this.run(() => this.writeCurrent(row, row.name));
      else if (kind === 'load') this.load(row);
    },
    remove(row) {
      this.run(async () => {
        if (row.device) await (await this.device()).remove(row.device.id);
        if (row.cloud) await (await this.cloud())?.remove(row.cloud.id);
        await this.refresh();
        this.say('saves.deleted', { name: row.info.title });
      });
    },
    /** The envelope of a row: from the device if it is there, otherwise from the account. */
    async docOf(row) {
      if (row.device) return (await this.device()).load(row.device.id);
      return (await this.cloud()).load(row.cloud.id);
    },
    load(row) {
      this.run(async () => { this.$emit('load', await this.docOf(row)); });
    },
    download(row) {
      this.run(async () => {
        const file = downloadDoc(await this.docOf(row), { compact: false });
        this.say('sv.downloaded', { file });
      });
    },
    /** Copy a save that lives only on this device into the account. */
    backup(row) {
      this.run(async () => {
        const cloud = await this.cloud();
        if (!cloud) return;
        const doc = await (await this.device()).load(row.device.id);
        await cloud.importDoc(doc, { thumb: row.device.thumb ?? null });
        await this.refresh();
        this.say('sv.backedUp', { name: row.info.title });
      });
    },
    async signIn() { try { await (await import('../../net/index.js')).login(location.search.replace(/^\?/, '')); } catch (e) { net.error = { code: e.code ?? 'net.err.unknown', params: e.params ?? {} }; } },
    importFile(file) {
      this.message = null;
      this.run(async () => {
        const doc = await readSaveFile(file);
        if (!doc.meta.name) doc.meta.name = file.name?.replace(/\.json$/i, '') || this.$t('saves.legacyName');
        const entry = await (await this.device()).importDoc(doc, { thumb: thumbFromState(doc.state) });
        await this.refresh();
        this.reveal(entry.id);
        this.say('sv.added', { name: entry.name });
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
      if (this.menuId) { this.menuId = null; return true; }
      return false;
    },
  },
};
</script>

<style>
.saves { position: relative; display: flex; flex-direction: column; min-height: 0; max-height: calc(100dvh - 2rem); }
.sv-head { flex: none; }
.sv-titles { flex: 1; display: flex; align-items: baseline; gap: 0.75rem; flex-wrap: wrap; min-width: 0; }
.sv-titles .h-title { font-size: var(--fs-xl); }
.sv-count { color: var(--ink-muted); font-size: var(--fs-sm); }
.sv-body { padding: 0.75rem 1rem 1rem; display: flex; flex-direction: column; gap: 0.75rem; min-height: 0; }
.sv-bar { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
.sv-upload { gap: 0.5rem; background: transparent; border-color: rgba(225, 168, 58, 0.45); color: var(--gold-200); box-shadow: none; }
.sv-upload .ico { width: 1.125rem; height: 1.125rem; }
.sv-note { margin: 0; display: flex; align-items: center; gap: 0.625rem; flex-wrap: wrap; padding: 0.5rem 0.75rem; border-radius: var(--r-md); background: var(--inset-bg); box-shadow: var(--inset-edge); color: var(--ink-muted); font-size: var(--fs-sm); line-height: 1.4; }
.sv-note .ico { width: 1.125rem; height: 1.125rem; }
.sv-note-text { flex: 1 1 14rem; }
.sv-new { display: flex; flex-direction: column; gap: 0.375rem; }
.sv-newrow { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.sv-newrow input { flex: 1 1 12rem; }
.sv-savebtn { display: inline-flex; align-items: center; gap: 0.5rem; padding-inline: 1rem; }
.sv-msg { margin: 0; display: flex; gap: 0.5rem; align-items: flex-start; padding: 0.5rem 0.75rem; border-radius: var(--r-md); font-size: var(--fs-sm); line-height: 1.4; }
.sv-msg .ico { width: 1.125rem; height: 1.125rem; margin-top: 0.0625rem; flex: none; }
.sv-msg.good { background: rgba(70, 160, 82, 0.18); color: #d9f2d2; box-shadow: inset 0 0 0 1px rgba(110, 190, 110, 0.35); }
.sv-msg.bad { background: rgba(192, 58, 63, 0.2); color: #ffd9d2; box-shadow: inset 0 0 0 1px rgba(220, 90, 80, 0.45); }
.sv-empty { margin: 1rem 0; text-align: center; color: var(--ink-muted); }
.sv-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.sv-item {
  display: grid; grid-template-columns: 4.5rem minmax(0, 1fr) auto; gap: 0.75rem; align-items: center;
  padding: 0.5rem 0.625rem; border-radius: var(--r-md); background: rgba(255, 225, 170, 0.05); box-shadow: inset 0 0 0 1px rgba(225, 168, 58, 0.18);
}
.sv-item.fresh { box-shadow: inset 0 0 0 2px var(--gold-400), 0 0 12px rgba(243, 200, 94, 0.25); }
.sv-thumb { width: 4.5rem; height: 4.5rem; display: grid; place-items: center; overflow: hidden; }
.sv-thumb img { width: 100%; height: 100%; object-fit: cover; image-rendering: auto; }
.sv-thumb .ico { width: 2rem; height: 2rem; color: var(--ink-dim); }
.sv-info { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; }
.sv-line { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; font-size: var(--fs-xs); color: var(--ink-muted); }
.sv-kind { font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gold-300); }
.sv-name { color: var(--gold-200); font-size: var(--fs-lg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sv-badge { display: inline-block; padding: 0 0.375rem; border-radius: 0.25rem; background: #3b6fbf; color: #fff; font-size: var(--fs-xs); }
.sv-meta { color: var(--ink-muted); font-size: var(--fs-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sv-where { display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap; color: var(--ink-dim); font-size: var(--fs-xs); }
.sv-where .ico { width: 0.9375rem; height: 0.9375rem; }
.sv-where.cloud { color: var(--good); }
.sv-backup { color: var(--gold-200); }
.sv-main { display: flex; align-items: center; gap: 0.25rem; }
.sv-act { display: inline-flex; align-items: center; justify-content: center; gap: 0.4375rem; padding-inline: 0.875rem; white-space: nowrap; }
.sv-more { position: relative; }
.sv-dots { font-size: 1.5rem; line-height: 1; padding-bottom: 0.375rem; }
.sv-menu { position: absolute; right: 0; top: calc(100% + 0.25rem); z-index: 6; min-width: 11rem; padding: 0.25rem; display: flex; flex-direction: column; gap: 0.125rem; }
.sv-menu button { justify-content: flex-start; color: var(--ink); }
.sv-menu .danger-text { color: var(--bad); }
.sv-drop {
  position: absolute; inset: 0; z-index: 5; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem;
  border: 2px dashed var(--gold-400); border-radius: var(--r-lg); background: rgba(20, 13, 7, 0.88); color: var(--gold-200); font-size: var(--fs-lg); pointer-events: none;
}
.sv-drop .ico { width: 2.5rem; height: 2.5rem; }
@media (max-width: 520px) {
  .sv-item { grid-template-columns: 3.75rem minmax(0, 1fr); }
  .sv-thumb { width: 3.75rem; height: 3.75rem; }
  .sv-main { grid-column: 1 / -1; }
  .sv-main .sv-act { flex: 1; }
  .sv-name { white-space: normal; }
  .sv-titles { flex-direction: column; align-items: flex-start; gap: 0; }
  .sv-upload { padding-inline: 0.75rem; }
}
</style>
