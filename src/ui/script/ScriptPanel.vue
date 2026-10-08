<template>
  <!-- Code panel in the game (coding adventures, test play from the world editor):
       sections (collapsible, locked or editable), run/debugger, output, variables, link to the scripting reference.
       Layout (splitLayout.js): 'split' – game left, program right with a draggable divider, collapsible to a strip;
       'sheet' – phones: full-screen sheet with tabs, while a program runs the game is shown with a run strip. -->
  <div class="sp-host">
    <aside
      v-show="split || open"
      ref="panel"
      class="script-panel"
      :class="[layout, { collapsed: isCollapsed, dragging }]"
      :style="split ? { width: occupied + 'px' } : null"
      data-testid="script-panel"
      :data-layout="layout"
      :data-status="status"
      :aria-label="$t('script.panel')"
    >
      <template v-if="split">
        <button v-if="isCollapsed" class="sp-strip" :aria-label="$t('script.expand')" data-testid="script-expand" @click="setCollapsed(false)">
          <Icon name="back" class="sp-strip-ico" />
          <span class="sp-strip-lbl">{{ $t('script.panel') }}</span>
          <i v-if="busy" class="sp-strip-run" aria-hidden="true"></i>
        </button>
        <div
          v-else
          class="sp-divider"
          role="separator"
          aria-orientation="vertical"
          tabindex="0"
          :aria-label="$t('script.divider')"
          :aria-valuenow="occupied"
          data-testid="script-divider"
          @pointerdown="dragStart"
          @keydown="dividerKey"
        ></div>
        <!-- Drag preview: a guide line moved by CSS transform only (no layout, no canvas resize until the drop) -->
        <div v-show="dragging" ref="guide" class="sp-guide" aria-hidden="true" data-testid="script-guide"></div>
      </template>

      <div v-show="!isCollapsed" class="sp-inner">
        <header class="sp-head">
          <strong class="sp-title">{{ $tr(scenario.title) }}</strong>
          <button v-if="split" v-tip="$t('script.collapse')" class="icon-btn ghost" :aria-label="$t('script.collapse')" data-testid="script-collapse" @click="setCollapsed(true)"><Icon name="next" /></button>
          <button v-else class="sp-watchbtn" :aria-label="$t('script.watchTip')" data-testid="script-watch" @click="watchGame"><Icon name="map" />{{ $t('script.watch') }}</button>
        </header>

        <div v-if="split" class="sp-tools" role="toolbar" :aria-label="$t('script.tools')">
          <button v-if="!busy" class="primary sp-run" :aria-label="$t('script.run')" data-testid="script-run" @click="run(false)"><Icon name="play" /><span class="sp-run-lbl">{{ $t('script.run') }}</span></button>
          <button v-else-if="paused" class="primary sp-run" :aria-label="$t('script.continue')" data-testid="script-continue" @click="debug('continue')"><Icon name="play" /><span class="sp-run-lbl">{{ $t('script.continue') }}</span></button>
          <button v-else class="sp-run" :aria-label="$t('script.pause')" data-testid="script-pause" @click="debug('pause')"><Icon name="pause" /><span class="sp-run-lbl">{{ $t('script.pause') }}</span></button>
          <button v-tip="$t('script.stepTip')" :aria-label="$t('script.step')" data-testid="script-step" @click="step('into')"><span class="sp-glyph" aria-hidden="true">⤵</span><span class="sp-lbl">{{ $t('script.step') }}</span></button>
          <button v-tip="$t('script.overTip')" :aria-label="$t('script.over')" :disabled="!paused" data-testid="script-over" @click="step('over')"><span class="sp-glyph" aria-hidden="true">↷</span><span class="sp-lbl sp-lbl-dbg">{{ $t('script.over') }}</span></button>
          <button v-tip="$t('script.outTip')" :aria-label="$t('script.out')" :disabled="!paused" data-testid="script-out" @click="step('out')"><span class="sp-glyph" aria-hidden="true">↥</span><span class="sp-lbl sp-lbl-dbg">{{ $t('script.out') }}</span></button>
          <button v-tip="$t('script.stopTip')" :aria-label="$t('script.stop')" :disabled="!busy" data-testid="script-stop" @click="stop"><span class="sp-glyph" aria-hidden="true">■</span><span class="sp-lbl">{{ $t('script.stop') }}</span></button>
          <span class="sp-sep" aria-hidden="true"></span>
          <button v-tip="$t('script.downloadTip')" class="ghost" :disabled="!fileSection" :aria-label="$t('script.download')" data-testid="script-download" @click="download"><Icon name="download" /><span class="sp-lbl sp-lbl-file">{{ $t('script.download') }}</span></button>
          <button v-tip="$t('script.openTip')" class="ghost" :disabled="!fileSection" :aria-label="$t('script.open')" data-testid="script-open-file" @click="$refs.file.click()"><Icon name="upload" /><span class="sp-lbl sp-lbl-file">{{ $t('script.open') }}</span></button>
          <span class="sp-grow"></span>
          <button v-tip="$t('script.gridTip')" class="ghost sp-grid" :aria-pressed="grid" :class="{ on: grid }" data-testid="script-grid" @click="toggleGrid"><span class="sp-glyph" aria-hidden="true">#</span><span class="sp-lbl sp-lbl-file">{{ $t('script.grid') }}</span></button>
          <a v-tip="$t('script.referenceTip')" class="sp-ref" :href="refUrl()" target="_blank" rel="noopener" :aria-label="$t('script.referenceTip')" data-testid="script-reference"><Icon name="book" /><span class="sp-lbl">{{ $t('script.reference') }}</span></a>
        </div>

        <nav v-if="!split" class="seg sp-tabs" role="tablist">
          <button v-for="t in tabs" :key="t" role="tab" :aria-selected="tab === t" :class="{ active: tab === t }" :data-testid="'script-tab-' + t" @click="tab = t">
            {{ $t('script.tab.' + t) }}<i v-if="t === 'output' && errCount" class="sp-badge" data-testid="script-err-count">{{ errCount }}</i>
          </button>
        </nav>

        <div class="sp-main">
          <div v-show="split || tab === 'code'" ref="body" class="sp-body scroll-y">
            <p v-if="scenario.briefing && showBriefing" class="sp-brief parchment">
              {{ $tr(scenario.briefing) }}
              <button class="ghost sp-brief-x" :aria-label="$t('common.close')" @click="showBriefing = false"><Icon name="close" /></button>
            </p>
            <section v-for="s in sections" :key="s.id" class="sp-sec" :data-testid="'section-' + s.id">
              <button v-if="foldable(s)" class="sp-fold" :class="{ open: unfolded[s.id] }" :aria-expanded="!!unfolded[s.id]" :data-testid="'fold-' + s.id" @click="unfolded[s.id] = !unfolded[s.id]">
                <Icon :name="unfolded[s.id] ? 'chevronDown' : 'next'" class="sp-fold-chev" />
                <span class="sp-fold-title">{{ $tr(s.title) }}</span>
                <span class="sp-fold-meta">
                  <small class="sp-fold-lines">{{ $t('script.lines', { n: lineCount(s) }) }}</small>
                  <span v-if="!s.editable" class="sp-locked" data-testid="section-locked"><Icon name="lock" />{{ $t('script.locked') }}</span>
                </span>
              </button>
              <h3 v-else-if="sections.length > 1" class="sp-sec-title">
                <span class="sp-fold-title">{{ $tr(s.title) }}</span>
                <span v-if="!s.editable" class="sp-locked"><Icon name="lock" />{{ $t('script.locked') }}</span>
              </h3>
              <CodeEditor
                v-if="!foldable(s) || unfolded[s.id]"
                :ref="(el) => setEditor(s.id, el)"
                v-model="codes[s.id]"
                :readonly="!s.editable"
                :running-line="runningLine(s)"
                :error-line="errorLine(s)"
                :breakpoints="bps[s.id] ?? []"
                :label="$tr(s.title)"
                @update:model-value="edited(s.id)"
                @update:breakpoints="setBps(s.id, $event)"
                @focus="focused = s.id"
                @blur="blurred"
              />
            </section>
            <div v-if="error" ref="error" class="sp-error" role="alert" data-testid="script-error">
              <b>{{ errorText.title }}</b>
              <p>{{ errorText.text }}</p>
            </div>
            <div v-if="vars" class="sp-vars" data-testid="script-vars">
              <div class="sp-var-col">
                <h4>{{ $t('script.vars.globals') }}</h4>
                <p v-for="v in vars.globals" :key="'g' + v.name"><b>{{ v.name }}</b> <code :class="v.type">{{ v.value }}</code></p>
                <p v-if="!vars.globals.length" class="sp-none">{{ $t('script.vars.none') }}</p>
              </div>
              <div v-if="vars.frames.length > 1" class="sp-var-col">
                <h4>{{ $t('script.vars.args') }}</h4>
                <p v-for="v in vars.args" :key="'a' + v.name"><b>{{ v.name }}</b> <code :class="v.type">{{ v.value }}</code></p>
                <p v-if="!vars.args.length" class="sp-none">{{ $t('script.vars.none') }}</p>
                <h4>{{ $t('script.vars.locals') }}</h4>
                <p v-for="v in vars.locals" :key="'l' + v.name"><b>{{ v.name }}</b> <code :class="v.type">{{ v.value }}</code></p>
                <p v-if="!vars.locals.length" class="sp-none">{{ $t('script.vars.none') }}</p>
                <h4>{{ $t('script.vars.stack') }}</h4>
                <p v-for="(f, i) in vars.frames" :key="'f' + i" class="sp-frame">{{ f.skipped ? $t('script.vars.skipped', { n: f.skipped }) : f.name === '<module>' ? $t('script.vars.main') : `${f.name}(${f.args ?? ''})` }}</p>
              </div>
            </div>
            <button v-if="split" class="ghost sp-reset" data-testid="script-reset" @click="resetCode">{{ $t('script.reset') }}</button>
          </div>

          <!-- Output: in the split screen below the code, on phones its own tab -->
          <div v-show="split || tab === 'output'" class="sp-output" :class="{ tabbed: !split }" data-testid="script-output">
            <h4 class="sp-console-title">{{ $t('script.output') }}</h4>
            <div ref="console" class="sp-console scroll-y" aria-live="polite">
              <div v-if="!split && error" class="sp-out err">{{ errorText.title }}: {{ errorText.text }}</div>
              <div v-if="consoleLines.length" data-testid="script-console">
                <div v-for="c in consoleLines" :key="c.seq" class="sp-out" :class="{ err: c.err, mission: c.level === 'mission' }">{{ c.err ? errText(c.err) : c.text }}</div>
              </div>
              <p v-else-if="split || !error" class="sp-none">{{ $t('script.noOutput') }}</p>
            </div>
          </div>
        </div>

        <template v-if="!split">
          <KeyBar v-if="touch && focused && tab === 'code'" @key="key" />
          <div class="sp-actbar" role="toolbar" :aria-label="$t('script.tools')">
            <button v-if="!busy" class="primary sp-run" data-testid="script-run" @click="run(false)"><Icon name="play" />{{ $t('script.run') }}</button>
            <button v-else-if="paused" class="primary sp-run" data-testid="script-continue" @click="debug('continue')"><Icon name="play" />{{ $t('script.continue') }}</button>
            <button v-else class="sp-run" data-testid="script-pause" @click="debug('pause')"><Icon name="pause" />{{ $t('script.pause') }}</button>
            <button :aria-label="$t('script.step')" data-testid="script-step" @click="step('into')"><span class="sp-glyph" aria-hidden="true">⤵</span></button>
            <template v-if="paused">
              <button :aria-label="$t('script.over')" data-testid="script-over" @click="step('over')"><span class="sp-glyph" aria-hidden="true">↷</span></button>
              <button :aria-label="$t('script.out')" data-testid="script-out" @click="step('out')"><span class="sp-glyph" aria-hidden="true">↥</span></button>
            </template>
            <button :aria-label="$t('script.stop')" :disabled="!busy" data-testid="script-stop" @click="stop"><span class="sp-glyph" aria-hidden="true">■</span></button>
            <button :aria-label="$t('script.more')" :aria-expanded="menu" data-testid="script-menu" @click="menu = !menu"><span class="sp-glyph" aria-hidden="true">⋯</span></button>
            <div v-if="menu" class="sp-menu" role="menu" data-testid="script-menu-list">
              <button role="menuitem" :disabled="!fileSection" data-testid="script-download" @click="menu = false; download()"><Icon name="download" />{{ $t('script.download') }}<small>.py</small></button>
              <button role="menuitem" :disabled="!fileSection" data-testid="script-open-file" @click="menu = false; $refs.file.click()"><Icon name="upload" />{{ $t('script.open') }}<small>.py</small></button>
              <button role="menuitemcheckbox" :aria-checked="grid" :class="{ on: grid }" data-testid="script-grid" @click="toggleGrid"><span class="sp-glyph sp-menu-glyph" aria-hidden="true">#</span>{{ $t('script.grid') }}<small>{{ grid ? '✓' : '' }}</small></button>
              <button role="menuitem" data-testid="script-reset" @click="menu = false; resetCode()"><Icon name="back" />{{ $t('script.reset') }}</button>
              <a role="menuitem" :href="refUrl()" target="_blank" rel="noopener" data-testid="script-reference" @click="menu = false"><Icon name="book" />{{ $t('script.reference') }}<small>↗</small></a>
            </div>
          </div>
        </template>
      </div>
      <input ref="file" class="sp-file" type="file" :accept="touch ? null : '.py,.txt,text/plain,text/x-python'" tabindex="-1" aria-hidden="true" data-testid="script-file" @change="openFile" />
    </aside>

    <!-- Phone, "watch game": the game in full, below the current line and the controls -->
    <div v-if="showStrip" ref="strip" class="sp-watch frame" data-testid="script-watch-strip">
      <div class="sp-watch-line" :class="status">
        <i v-if="watchLine" class="num">{{ watchLine.n }}</i>
        <code data-testid="script-watch-line">{{ watchLine?.text ?? '' }}</code>
        <span class="sp-watch-status">{{ $t('script.status.' + status) }}</span>
      </div>
      <div class="sp-watch-row">
        <template v-if="busy">
          <button v-if="paused" data-testid="script-watch-continue" @click="debug('continue')"><Icon name="play" />{{ $t('script.continue') }}</button>
          <button v-else data-testid="script-watch-pause" @click="debug('pause')"><Icon name="pause" />{{ $t('script.pause') }}</button>
          <button data-testid="script-watch-stop" @click="stop"><span class="sp-glyph" aria-hidden="true">■</span>{{ $t('script.stop') }}</button>
        </template>
        <button v-else class="ghost" data-testid="script-watch-hide" @click="stripHidden = true"><Icon name="close" />{{ $t('script.hide') }}</button>
        <button class="primary" data-testid="script-watch-code" @click="toCode"><span class="sp-code-ico" aria-hidden="true">&lt;/&gt;</span>{{ $t('script.code') }}</button>
      </div>
    </div>
  </div>
</template>

<script>
import CodeEditor from './CodeEditor.vue';
import KeyBar from './KeyBar.vue';
import { refUrl } from './reference.js';
import { scriptErrorText, tr } from '../../i18n/index.js';
import { shownError, shownStatus, consoleView, fileName, sourceFromFile, MAX_FILE_BYTES } from './panelState.js';
import { loadSplit, saveSplit, panelWidth, widthFromPointer, guideOffset, clampWidth } from './splitLayout.js';

/** Arrow keys on the divider: the width is applied this long after the last key press (ms) */
const KEY_DELAY = 250;

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};

export default {
  name: 'ScriptPanel',
  components: { CodeEditor, KeyBar },
  props: {
    engine: { type: Object, required: true },
    scenario: { type: Object, required: true },
    /** ui.mission.script */
    script: { type: Object, required: true },
    /** 'adventure': player sections; 'editor': all sections, debug mission script */
    mode: { type: String, default: 'adventure' },
    /** 'split' (desktop, tablet landscape) or 'sheet' (phone), see splitLayout.js */
    layout: { type: String, default: 'split' },
    /** Sheet: open (otherwise the game is shown, "watch game") */
    open: Boolean,
    touch: Boolean,
  },
  emits: ['update:open', 'width'],
  data() {
    const saved = store.get(this.storeKey()) ?? {};
    const codes = {};
    for (const s of this.scenario.sections ?? []) codes[s.id] = s.editable && typeof saved[s.id] === 'string' ? saved[s.id] : s.code;
    return {
      codes, bps: {}, unfolded: {}, tab: 'code', grid: store.get('kronland-grid') ?? true, focused: null,
      showBriefing: true, dirty: {}, editors: {},
      /** Split screen: share of the window and collapsed state (localStorage) */
      splitState: loadSplit(),
      winW: window.innerWidth,
      /** Divider drag (or arrow keys): only the guide line moves, the width is applied once on drop */
      dragging: false,
      /** Sheet: "⋯" menu open; run strip hidden by the player (until the next run) */
      menu: false,
      stripHidden: false,
    };
  },
  computed: {
    split() { return this.layout === 'split'; },
    isCollapsed() { return this.split && this.splitState.collapsed; },
    /** Width the panel takes up on the right (split screen), 0 on phones */
    occupied() { return this.split ? panelWidth(this.splitState, this.winW) : 0; },
    tabs() { return ['code', 'output']; },
    sections() {
      // In the adventure hidden sections (mission logic) stay invisible, in the editor you see everything
      return (this.scenario.sections ?? []).filter((s) => this.mode === 'editor' || (s.visibility ?? 'open') !== 'hidden');
    },
    player() { return this.script.player; },
    status() { return shownStatus(this.player, this.dirty); },
    busy() { return this.status === 'running' || this.status === 'paused'; },
    paused() { return this.status === 'paused'; },
    vars() { return this.paused ? this.player.vars : null; },
    error() { return shownError(this.player, this.dirty); },
    errorText() { return this.error ? this.errText(this.error, true) : { title: '', text: '' }; },
    consoleLines() {
      // Only the current run; the current error is already in the error box above
      return consoleView(this.script.console, { mode: this.mode, since: this.player?.since ?? 0, error: this.error, dirty: this.dirty });
    },
    /** Errors for the badge of the output tab (phones) */
    errCount() { return (this.error ? 1 : 0) + this.consoleLines.filter((c) => c.err).length; },
    /** Section that download and open work on: the focused editable one, otherwise the player program */
    fileSection() {
      const all = this.scenario.sections ?? [];
      return all.find((s) => s.id === this.focused && s.editable) ?? all.find((s) => s.editable && s.level === 'player') ?? all.find((s) => s.editable) ?? null;
    },
    /** Phone, sheet closed: run strip while a program runs (and after it, until hidden) */
    showStrip() { return !this.split && !this.open && !this.stripHidden && ['running', 'paused', 'done', 'stopped'].includes(this.status); },
    /** Current line of the player program for the run strip */
    watchLine() {
      const l = this.player?.line;
      if (!l || !this.busy) return null;
      return { n: l.line, text: ((this.codes[l.section] ?? '').split('\n')[l.line - 1] ?? '').trim() };
    },
  },
  watch: {
    occupied: { immediate: true, handler(w) { this.$emit('width', w); } },
    'error.seq'(seq) {
      if (!seq) return;
      // New error: phones jump back from the game to the code; the line and the box come into view
      this.tab = 'code';
      if (!this.split && !this.open) this.$emit('update:open', true);
      this.revealError();
    },
    status(s, before) {
      // Breakpoint or step while watching the game on the phone: back to the code
      if (s === 'paused' && before !== 'paused' && !this.split && !this.open) { this.tab = 'code'; this.$emit('update:open', true); }
    },
    open(o) { if (o) this.menu = false; },
    consoleLines(now, before) {
      // New output: keep the end of the console in view
      const last = now[now.length - 1]?.seq ?? 0;
      if (!last || last === before?.[before.length - 1]?.seq) return;
      this.$nextTick(() => { const c = this.$refs.console; if (c) c.scrollTop = c.scrollHeight; });
    },
  },
  mounted() {
    this.engine?.setGrid?.(this.grid);
    this.onResize = () => { this.winW = window.innerWidth; };
    window.addEventListener('resize', this.onResize);
    // Whole map into view: after the game area has shrunk to the left part (split screen)
    this.$nextTick(() => requestAnimationFrame(() => { this.engine?.resize?.(); this.engine?.frameOverview?.(0); }));
  },
  beforeUnmount() {
    this.engine?.setGrid?.(false);
    window.removeEventListener('resize', this.onResize);
    clearTimeout(this.keyTimer);
    this.$emit('width', 0);
  },
  methods: {
    /** Tile grid on/off (for counting steps); preference stays in the browser. */
    toggleGrid() {
      this.grid = !this.grid;
      store.set('kronland-grid', this.grid);
      this.engine?.setGrid?.(this.grid);
    },
    storeKey() { return `kronland-code-${this.scenario.id}`; },
    foldable(s) { return (s.visibility ?? 'open') === 'collapsed' || ((s.visibility ?? 'open') === 'hidden' && this.mode === 'editor'); },
    lineCount(s) { return (this.codes[s.id] ?? '').replace(/\n+$/, '').split('\n').length; },
    setEditor(id, el) { if (el) this.editors[id] = el; else delete this.editors[id]; },
    runningLine(s) {
      const l = this.player?.line;
      if (this.mode === 'editor' && this.script.mission?.paused?.line?.section === s.id) return this.script.mission.paused.line.line;
      return l && l.section === s.id && this.busy ? l.line : -1;
    },
    errorLine(s) { return this.error && this.error.section === s.id ? this.error.sline : -1; },
    errText(e, full = false) {
      const sec = (this.scenario.sections ?? []).find((x) => x.id === e.section);
      const r = scriptErrorText(e, { section: sec && this.sections.length > 1 ? tr(sec.title) : undefined, line: e.sline || undefined });
      return full ? r : `${r.title}: ${r.text}`;
    },
    /** Error line and box into view (also after the sheet has just opened). */
    revealError() {
      this.$nextTick(() => requestAnimationFrame(() => {
        const e = this.error;
        if (!e) return;
        if (!this.unfolded[e.section] && this.sections.find((s) => s.id === e.section && this.foldable(s))) this.unfolded[e.section] = true;
        this.$nextTick(() => {
          this.$refs.error?.scrollIntoView?.({ block: 'nearest' });
          if (e.sline > 0) this.editors[e.section]?.reveal?.(e.sline);
        });
      }));
    },
    edited(id) {
      this.dirty = { ...this.dirty, [id]: true };
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.persist(), 400);
    },
    persist() {
      const out = {};
      for (const s of this.scenario.sections ?? []) if (s.editable) out[s.id] = this.codes[s.id];
      store.set(this.storeKey(), out);
    },
    editable() {
      const out = {};
      for (const s of this.scenario.sections ?? []) if (s.level === 'player' && s.editable) out[s.id] = this.codes[s.id];
      return out;
    },
    playerBps() {
      const out = {};
      for (const s of this.scenario.sections ?? []) if (s.level === 'player' && this.bps[s.id]?.length) out[s.id] = this.bps[s.id];
      return out;
    },
    run(stepMode) {
      this.dirty = {};
      this.persist();
      this.menu = false;
      this.stripHidden = false;
      this.engine.scriptRun(this.editable(), { mode: stepMode ? 'step' : 'run', bps: this.playerBps() });
      // Phone: watch the game while the program runs (step mode stays in the code); hero into view above the strip
      if (!this.split && !stepMode) this.watchGame();
    },
    step(kind) {
      if (this.mode === 'editor' && this.script.mission?.paused) { this.engine.scriptDebug(kind, 'mission'); return; }
      if (!this.busy) { if (kind === 'into') this.run(true); return; }
      this.engine.scriptDebug(kind, 'player');
    },
    debug(cmd) {
      if (this.mode === 'editor' && this.script.mission?.paused) { this.engine.scriptDebug(cmd, 'mission'); return; }
      this.engine.scriptDebug(cmd, 'player');
    },
    stop() { this.engine.scriptStop(); },
    /** Phone: close the sheet and show the game; the hero comes into view above the run strip if it is not visible. */
    watchGame() {
      this.$emit('update:open', false);
      this.$nextTick(() => requestAnimationFrame(() => this.engine?.watchFocus?.(this.$refs.strip?.getBoundingClientRect().height ?? 0)));
    },
    /** Run strip → back to the code */
    toCode() { this.tab = 'code'; this.$emit('update:open', true); },
    setBps(id, list) {
      this.bps = { ...this.bps, [id]: list };
      const sec = this.scenario.sections.find((s) => s.id === id);
      if ((sec?.level ?? 'mission') === 'mission') {
        const m = {};
        for (const s of this.scenario.sections) if ((s.level ?? 'mission') === 'mission' && this.bps[s.id]?.length) m[s.id] = this.bps[s.id];
        this.engine.scriptBreakpoints('mission', m);
      } else if (this.busy) this.engine.scriptBreakpoints('player', this.playerBps());
    },
    resetCode() {
      for (const s of this.scenario.sections ?? []) if (s.editable) { this.codes[s.id] = s.code; this.dirty = { ...this.dirty, [s.id]: true }; }
      this.persist();
    },
    // ---------- Split screen: divider and strip ----------
    setCollapsed(on) {
      if (on) { clearTimeout(this.keyTimer); this.keyWidth = null; this.dragging = false; }
      this.splitState = { ...this.splitState, collapsed: on };
      saveSplit(this.splitState);
    },
    /** Move the guide line to where the panel edge would be at width px (direct style, no re-render). */
    showGuide(px) {
      const g = this.$refs.guide;
      if (g) g.style.transform = `translateX(${guideOffset(this.occupied, px)}px)`;
    },
    /** Apply a new panel width: one layout change, so the game canvas is resized once. */
    applyWidth(px) {
      const W = window.innerWidth;
      this.splitState = { ...this.splitState, frac: clampWidth(px, W) / W };
      saveSplit(this.splitState);
    },
    /**
     * Drag the divider (mouse, pen, finger): pointer capture keeps the drag even over the canvas. While dragging
     * only the guide line follows the pointer (once per frame); panel width and canvas change on pointerup.
     */
    dragStart(e) {
      if (e.button > 0) return;
      e.preventDefault();
      const el = e.currentTarget;
      try { el.setPointerCapture?.(e.pointerId); } catch { /* synthetic events */ }
      this.flushKeyWidth();
      let px = this.occupied, frame = 0;
      this.showGuide(px);
      this.dragging = true;
      const move = (ev) => {
        px = widthFromPointer(ev.clientX, window.innerWidth);
        if (!frame) frame = requestAnimationFrame(() => { frame = 0; this.showGuide(px); });
      };
      const end = (ev) => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', end);
        el.removeEventListener('pointercancel', end);
        cancelAnimationFrame(frame);
        this.dragging = false;
        if (ev.type === 'pointerup' && px !== this.occupied) this.applyWidth(px);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    },
    /** Keyboard on the divider: arrows move the guide, the width follows after a short pause; Enter collapses. */
    dividerKey(e) {
      const d = e.key === 'ArrowLeft' ? 32 : e.key === 'ArrowRight' ? -32 : 0;
      if (d) {
        e.preventDefault();
        this.keyWidth = clampWidth((this.keyWidth ?? this.occupied) + d, window.innerWidth);
        this.showGuide(this.keyWidth);
        this.dragging = true;
        clearTimeout(this.keyTimer);
        this.keyTimer = setTimeout(() => this.flushKeyWidth(), KEY_DELAY);
      } else if (e.key === 'Enter') { this.flushKeyWidth(); this.setCollapsed(true); }
    },
    /** Apply a pending keyboard width now. */
    flushKeyWidth() {
      clearTimeout(this.keyTimer);
      const px = this.keyWidth;
      this.keyWidth = null;
      this.dragging = false;
      if (px != null && px !== this.occupied) this.applyWidth(px);
    },
    /** Save the program as a .py file (download; works on phones too). */
    download() {
      const sec = this.fileSection;
      if (!sec) return;
      const text = (this.codes[sec.id] ?? '').replace(/\n*$/, '\n');
      const editable = (this.scenario.sections ?? []).filter((s) => s.editable);
      const name = fileName(editable.length > 1 ? `${this.scenario.id}-${sec.id}` : this.scenario.id);
      const url = URL.createObjectURL(new Blob([text], { type: 'text/x-python;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    },
    /** Load a .py/.txt file from the device into the editor (replaces the section). */
    async openFile(e) {
      const input = e.target, file = input.files?.[0];
      input.value = '';
      const sec = this.fileSection;
      if (!file || !sec) return;
      const warn = (key, params = null) => this.engine?.toast?.(key, params, { icon: 'warning', tone: 'warn', cat: 'feedback' });
      if (file.size > MAX_FILE_BYTES) { warn('script.fileTooBig', { kb: Math.round(MAX_FILE_BYTES / 1000) }); return; }
      let text = null;
      try { text = sourceFromFile(await file.text()); } catch { text = null; }
      if (text === null) { warn('script.fileUnreadable'); return; }
      this.tab = 'code';
      this.unfolded[sec.id] = true;
      this.codes[sec.id] = text;
      this.edited(sec.id);
      if (!this.touch) this.$nextTick(() => this.editors[sec.id]?.focus?.()); // phones: no keyboard popping up
    },
    refUrl,
    blurred() { setTimeout(() => { if (!this.$el?.isConnected || !document.activeElement?.closest?.('.script-panel')) this.focused = null; }, 150); },
    key(k) {
      const ed = this.editors[this.focused];
      if (!ed) return;
      if (k.indent) ed.indent(false);
      else if (k.dedent) ed.indent(true);
      else ed.insert(k.text, k.back ?? 0);
    },
  },
};
</script>

<style>
/* ---------- Split screen (desktop, tablet landscape): program on the right, the game (App.vue .game.split) left of it ---------- */
.sp-host { display: contents; }
.script-panel { position: fixed; z-index: 6; display: flex; color: var(--ink); background: var(--panel-bg), var(--wood-900); }
.script-panel.split {
  top: 0; right: 0; bottom: 0; flex-direction: row;
  box-shadow: inset 1px 0 0 rgba(225, 168, 58, 0.38), -6px 0 18px rgba(10, 6, 2, 0.45);
  padding-right: var(--safe-r);
}
.script-panel.split.dragging { user-select: none; }
.sp-divider {
  position: relative; flex: none; width: 0.75rem; cursor: col-resize; touch-action: none; display: grid; place-items: center;
  background: linear-gradient(90deg, var(--wood-950), var(--wood-800), var(--wood-950));
}
.sp-divider::before { content: ''; width: 3px; height: 2.75rem; border-radius: 2px; background: var(--gold-500); opacity: 0.7; }
.sp-divider:hover::before, .sp-divider:focus-visible::before, .dragging .sp-divider::before { opacity: 1; background: var(--gold-300); }
/* Drag preview: guide line at the future panel edge, moved only by transform */
.sp-guide {
  position: absolute; top: 0; bottom: 0; left: -2px; width: 4px; z-index: 2; pointer-events: none; will-change: transform; border-radius: 2px;
  background: rgba(243, 200, 94, 0.85); box-shadow: 0 0 0 1px rgba(10, 6, 2, 0.5), 0 0 14px rgba(243, 200, 94, 0.55);
}
.sp-guide::after {
  content: ''; position: absolute; top: 0; bottom: 0; left: 4px; width: 2.5rem;
  background: linear-gradient(90deg, rgba(243, 200, 94, 0.18), transparent);
}
.sp-strip {
  position: relative; flex: 1; min-height: 0; width: 100%; padding: 0; border-radius: 0; border: 0; display: flex; flex-direction: column; gap: 0.375rem; align-items: center; justify-content: center;
  background: linear-gradient(90deg, var(--wood-950), var(--wood-800)); color: var(--gold-200); box-shadow: inset 1px 0 0 rgba(225, 168, 58, 0.45);
}
.sp-strip-ico { width: 1rem !important; height: 1rem !important; }
.sp-strip-lbl { writing-mode: vertical-rl; font-family: var(--display); font-size: var(--fs-md); letter-spacing: 0.04em; white-space: nowrap; }
.sp-strip-run { position: absolute; top: 0.75rem; left: 50%; margin-left: -0.3125rem; width: 0.625rem; height: 0.625rem; border-radius: 50%; background: var(--good); box-shadow: 0 0 6px var(--good); }
.sp-inner { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 0.5rem; padding: calc(0.625rem + var(--safe-t)) 0.75rem calc(0.625rem + var(--safe-b)) 0.625rem; position: relative; }
.sp-head { display: flex; align-items: center; gap: 0.5rem; min-height: 2rem; }
.sp-title { flex: 1; min-width: 0; font-family: var(--display); color: var(--gold-200); font-size: var(--fs-lg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sp-head .icon-btn { min-height: 2rem; width: 2rem; min-width: 2rem; }
.sp-tools { display: flex; align-items: center; gap: 0.25rem; flex-wrap: wrap; container-type: inline-size; }
.sp-tools button { display: inline-flex; align-items: center; gap: 0.3rem; min-height: 2.375rem; padding: 0 0.5rem; }
.sp-run { min-width: 6.5rem; justify-content: center; }
.sp-glyph { font-size: 1.05em; line-height: 1; }
.sp-sep { width: 1px; height: 1.5rem; background: rgba(225, 168, 58, 0.25); margin: 0 0.125rem; }
.sp-grow { flex: 1; }
.sp-grid .sp-glyph { font-family: ui-monospace, Menlo, monospace; font-weight: 800; }
.sp-tools .sp-ref {
  display: inline-flex; align-items: center; gap: 0.3rem; min-height: 2.375rem; padding: 0 0.5rem; border-radius: var(--r-md);
  color: var(--ink-muted); text-decoration: none; font-size: inherit;
}
.sp-tools .sp-ref:hover { color: var(--ink); background: rgba(255, 225, 170, 0.07); }
.sp-ref .ico { width: 1.125rem; height: 1.125rem; }
.sp-grid.on { color: var(--gold-200); background: rgba(243, 200, 94, 0.14); box-shadow: inset 0 0 0 1px rgba(243, 200, 94, 0.45); }
/* Narrow panel: icons only for the debugger steps, then for everything but "Run" */
@container (max-width: 50rem) { .sp-lbl-dbg { display: none; } }
@container (max-width: 44rem) { .sp-lbl-file { display: none; } }
@container (max-width: 34.5rem) { .sp-lbl { display: none; } .sp-run { min-width: 0; } .sp-grow, .sp-sep { display: none; } }
/* Minimum width: everything in one row, "Run" as ▶ only (name stays as label for screen readers) */
@container (max-width: 25rem) { .sp-run-lbl { display: none; } .sp-tools button, .sp-tools .sp-ref { padding: 0 0.3125rem; } }
.sp-file { display: none; }
.sp-tabs { align-self: flex-start; }
.sp-tabs > button { min-height: 2rem; padding: 0 0.875rem; gap: 0.375rem; display: inline-flex; align-items: center; justify-content: center; }
.sp-badge { display: inline-grid; place-items: center; min-width: 1.125rem; height: 1.125rem; padding: 0 0.25rem; border-radius: 999px; background: var(--bad-deep, #a3321f); color: #fff; font: 700 0.6875rem/1 var(--body); font-style: normal; }
.sp-main { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.sp-body { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 0.625rem; padding-right: 0.125rem; }
/* The body scrolls; its blocks keep their height */
.sp-body > * { flex-shrink: 0; }
.sp-brief { position: relative; margin: 0; padding: 0.625rem 2.25rem 0.625rem 0.75rem; font-size: var(--fs-sm); line-height: 1.45; }
.sp-brief-x { position: absolute; top: 0.25rem; right: 0.25rem; min-height: 1.75rem !important; min-width: 1.75rem; padding: 0; color: var(--parch-ink); }
.sp-sec { display: flex; flex-direction: column; gap: 0.25rem; container-type: inline-size; }
/* Section header: chevron and title on the left, line count and lock badge on the right edge */
.sp-sec-title { margin: 0; min-height: 1.75rem; font-size: var(--fs-sm); color: var(--ink-muted); display: flex; align-items: center; gap: 0.5rem; }
.sp-fold {
  display: flex; align-items: center; justify-content: flex-start; gap: 0.5rem; width: 100%; min-height: 2.25rem; padding: 0.25rem 0.5rem 0.25rem 0.375rem;
  text-align: left; color: var(--ink); background: var(--inset-bg); box-shadow: var(--inset-edge); border-color: transparent;
}
.sp-fold.open { border-radius: var(--r-md) var(--r-md) var(--r-sm) var(--r-sm); }
.sp-fold-chev { width: 1rem !important; height: 1rem !important; color: var(--gold-300); }
.sp-fold-title { min-width: 0; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sp-fold-meta { margin-left: auto; flex: none; display: inline-flex; align-items: center; gap: 0.5rem; }
.sp-fold-lines { color: var(--ink-dim); font-size: var(--fs-xs); white-space: nowrap; }
.sp-sec-title .sp-locked { margin-left: auto; }
.sp-locked {
  flex: none; display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.0625rem 0.5rem 0.0625rem 0.375rem; border-radius: 999px;
  font-size: var(--fs-xs); font-weight: 400; line-height: 1.4; color: var(--ink-muted); background: rgba(0, 0, 0, 0.28); box-shadow: inset 0 0 0 1px rgba(225, 168, 58, 0.22); white-space: nowrap;
}
.sp-locked .ico { width: 0.75rem; height: 0.75rem; opacity: 0.8; }
/* Narrow panel: the badge keeps only its lock */
@container (max-width: 22rem) { .sp-fold-lines { display: none; } }
.sp-error { padding: 0.5rem 0.75rem; border-radius: var(--r-md); background: rgba(163, 50, 31, 0.28); box-shadow: inset 3px 0 0 var(--bad); }
.sp-error b { color: #ffc2b5; font-size: var(--fs-sm); }
.sp-error p { margin: 0.125rem 0 0; font-size: var(--fs-sm); line-height: 1.4; }
.sp-output { flex: none; display: flex; flex-direction: column; min-height: 0; height: clamp(6.5rem, 24%, 13rem); background: #0a0806; border-radius: var(--r-md); box-shadow: var(--inset-edge); }
.sp-output.tabbed { flex: 1; height: auto; }
.sp-console-title { margin: 0; padding: 0.3125rem 0.75rem; font: 600 var(--fs-xs) var(--body, inherit); color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid rgba(225, 168, 58, 0.12); }
.sp-console { flex: 1; min-height: 0; padding: 0.375rem 0.75rem; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.8125rem; line-height: 1.5; }
.sp-console .sp-none { margin: 0; font-family: var(--body); font-size: var(--fs-sm); }
.sp-out { white-space: pre-wrap; word-break: break-word; color: #e6dbc3; }
.sp-out.mission { color: var(--ink-dim); }
.sp-out.err { color: #ff9f8c; }
.sp-vars { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; padding: 0.5rem; border-radius: var(--r-md); border: 1px dashed rgba(225, 168, 58, 0.3); font-size: var(--fs-sm); }
.sp-var-col h4 { margin: 0.25rem 0 0.125rem; font-size: var(--fs-xs); color: var(--ink-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.sp-var-col p { margin: 0.125rem 0; display: flex; gap: 0.375rem; align-items: baseline; flex-wrap: wrap; }
.sp-var-col code { background: rgba(0, 0, 0, 0.35); padding: 0 0.3em; border-radius: 3px; font-size: 0.85em; word-break: break-all; }
.sp-var-col code.str { color: #a8d97a; }
.sp-var-col code.int, .sp-var-col code.float { color: #8fc8f2; }
.sp-var-col code.bool, .sp-var-col code.NoneType { color: #d996f2; font-style: italic; }
.sp-none { color: var(--ink-dim); font-style: italic; }
.sp-frame { font-family: ui-monospace, Menlo, Consolas, monospace; }
.sp-reset { align-self: flex-start; font-size: var(--fs-sm); min-height: 2rem; }

/* ---------- Sheet (phones): full screen over the game ---------- */
.script-panel.sheet { inset: 0; z-index: 30; flex-direction: column; }
.script-panel.sheet .sp-inner { padding: calc(0.625rem + var(--safe-t)) calc(0.625rem + var(--safe-r)) 0 calc(0.625rem + var(--safe-l)); gap: 0.5rem; }
.script-panel.sheet .sp-tabs { align-self: stretch; }
.script-panel.sheet .sp-tabs > button { flex: 1; min-height: 2.5rem; }
.sp-watchbtn { display: inline-flex; align-items: center; gap: 0.375rem; min-height: 2.5rem; padding: 0 0.75rem; }
.sp-actbar {
  position: relative; flex: none; display: flex; gap: 0.375rem; margin: 0 calc(-0.625rem - var(--safe-r)) 0 calc(-0.625rem - var(--safe-l));
  padding: 0.5rem calc(0.625rem + var(--safe-r)) calc(0.5rem + var(--safe-b)) calc(0.625rem + var(--safe-l));
  background: rgba(10, 6, 3, 0.55); border-top: 1px solid rgba(225, 168, 58, 0.2);
}
.sp-actbar > button { min-height: var(--touch); min-width: var(--touch); justify-content: center; display: inline-flex; align-items: center; gap: 0.375rem; padding: 0 0.5rem; }
.sp-actbar > .sp-run { flex: 1; }
.script-panel.sheet .keybar { margin: 0 calc(-0.625rem - var(--safe-r)) -0.5rem calc(-0.625rem - var(--safe-l)); }
.sp-menu {
  position: absolute; right: calc(0.625rem + var(--safe-r)); bottom: calc(100% + 0.25rem); z-index: 5; min-width: 14rem; padding: 0.375rem; display: flex; flex-direction: column; gap: 2px;
  border-radius: var(--r-lg); background: var(--panel-bg); box-shadow: var(--panel-edge), 0 10px 30px rgba(0, 0, 0, 0.6);
}
.sp-menu > button, .sp-menu > a { justify-content: flex-start; display: flex; align-items: center; gap: 0.5rem; background: transparent; border-color: transparent; box-shadow: none; min-height: var(--touch); text-align: left; }
.sp-menu > a { color: var(--ink); text-decoration: none; padding: 0.4375rem 0.75rem; border-radius: var(--r-md); }
.sp-menu > a:hover { background: rgba(255, 225, 170, 0.07); }
.sp-menu > button small, .sp-menu > a small { margin-left: auto; color: var(--ink-dim); font-family: ui-monospace, Menlo, monospace; }
.sp-menu > button.on small { color: var(--gold-300); }
.sp-menu-glyph { width: 1.25rem; text-align: center; font-family: ui-monospace, Menlo, monospace; font-weight: 800; }
/* "Watch game": run strip at the bottom over the command bar */
.sp-watch {
  position: fixed; z-index: 29; left: var(--safe-l); right: var(--safe-r); bottom: 0; border-radius: var(--r-lg) var(--r-lg) 0 0;
  padding: 0.5rem 0.625rem calc(0.625rem + var(--safe-b)); display: flex; flex-direction: column; gap: 0.5rem;
}
.sp-watch-line { display: flex; align-items: center; gap: 0.5rem; min-height: 2.25rem; padding: 0.25rem 0.625rem; border-radius: var(--r-md); background: #0f0b07; box-shadow: inset 3px 0 0 var(--gold-500); font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.875rem; }
.sp-watch-line.running { box-shadow: inset 3px 0 0 var(--good); }
.sp-watch-line.paused { box-shadow: inset 3px 0 0 var(--warn); }
.sp-watch-line i { font-style: normal; color: #7d6d55; }
.sp-watch-line code { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #efe3c8; }
.sp-watch-status { font-family: var(--body); font-size: var(--fs-xs); color: var(--ink-muted); }
.sp-watch-line.running .sp-watch-status { color: var(--good); }
.sp-watch-row { display: flex; gap: 0.375rem; }
.sp-watch-row > button { flex: 1; min-height: var(--touch); justify-content: center; display: inline-flex; align-items: center; gap: 0.375rem; }
.sp-code-ico { font: 800 0.9375rem/1 ui-monospace, Menlo, Consolas, monospace; letter-spacing: -0.06em; }
</style>
