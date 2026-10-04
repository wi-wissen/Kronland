<template>
  <!-- Code panel in the game (coding adventures, test play from the world editor):
       sections (collapsible, locked or editable), run/debugger, console, variables, help. -->
  <aside v-show="!compact || open" class="script-panel frame" :class="{ compact, full }" data-testid="script-panel" :aria-label="$t('script.panel')">
    <header class="sp-head">
      <strong class="sp-title">{{ $tr(scenario.title) }}</strong>
      <span class="sp-status" :class="status" data-testid="script-status">{{ $t('script.status.' + status) }}</span>
      <button v-if="compact" class="icon-btn ghost" :aria-label="$t(full ? 'script.shrink' : 'script.grow')" @click="full = !full"><Icon :name="full ? 'chevronDown' : 'chevronUp'" /></button>
      <button v-if="compact" class="icon-btn ghost" :aria-label="$t('common.close')" data-testid="script-close" @click="$emit('update:open', false)"><Icon name="close" /></button>
    </header>

    <div class="sp-tools" role="toolbar" :aria-label="$t('script.tools')">
      <button v-if="!busy" class="primary sp-run" data-testid="script-run" @click="run(false)"><Icon name="play" />{{ $t('script.run') }}</button>
      <button v-else-if="paused" class="primary sp-run" data-testid="script-continue" @click="debug('continue')"><Icon name="play" />{{ $t('script.continue') }}</button>
      <button v-else class="sp-run" data-testid="script-pause" @click="debug('pause')"><Icon name="pause" />{{ $t('script.pause') }}</button>
      <button v-tip="$t('script.stepTip')" data-testid="script-step" @click="step('into')"><span class="sp-glyph">⤵</span>{{ $t('script.step') }}</button>
      <button v-tip="$t('script.overTip')" :disabled="!paused" data-testid="script-over" @click="step('over')"><span class="sp-glyph">↷</span><span class="sp-lbl">{{ $t('script.over') }}</span></button>
      <button v-tip="$t('script.outTip')" :disabled="!paused" data-testid="script-out" @click="step('out')"><span class="sp-glyph">↥</span><span class="sp-lbl">{{ $t('script.out') }}</span></button>
      <button v-tip="$t('script.stopTip')" :disabled="!busy" data-testid="script-stop" @click="stop"><span class="sp-glyph">■</span><span class="sp-lbl">{{ $t('script.stop') }}</span></button>
    </div>

    <nav class="seg sp-tabs" role="tablist">
      <button v-for="t in tabs" :key="t" role="tab" :aria-selected="tab === t" :class="{ active: tab === t }" :data-testid="'script-tab-' + t" @click="tab = t">{{ $t('script.tab.' + t) }}</button>
    </nav>

    <div ref="body" class="sp-body scroll-y">
      <template v-if="tab === 'code'">
        <p v-if="scenario.briefing && showBriefing" class="sp-brief parchment">
          {{ $tr(scenario.briefing) }}
          <button class="ghost sp-brief-x" :aria-label="$t('common.close')" @click="showBriefing = false"><Icon name="close" /></button>
        </p>
        <section v-for="s in sections" :key="s.id" class="sp-sec" :data-testid="'section-' + s.id">
          <button v-if="foldable(s)" class="sp-fold" :aria-expanded="!!unfolded[s.id]" :data-testid="'fold-' + s.id" @click="unfolded[s.id] = !unfolded[s.id]">
            <Icon :name="unfolded[s.id] ? 'chevronDown' : 'next'" />
            <span>{{ $tr(s.title) }}</span>
            <small>{{ $t('script.lines', { n: lineCount(s) }) }}</small>
            <Icon v-if="!s.editable" name="lock" class="sp-lock" />
          </button>
          <h3 v-else-if="sections.length > 1" class="sp-sec-title">{{ $tr(s.title) }}<Icon v-if="!s.editable" name="lock" class="sp-lock" /></h3>
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
        <div v-if="error" class="sp-error" role="alert" data-testid="script-error">
          <b>{{ errorText.title }}</b>
          <p>{{ errorText.text }}</p>
        </div>
        <div v-if="consoleLines.length" class="sp-console" data-testid="script-console" aria-live="polite">
          <div v-for="c in consoleLines" :key="c.seq" class="sp-out" :class="{ err: c.err, mission: c.level === 'mission' }">{{ c.err ? errText(c.err) : c.text }}</div>
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
            <p v-for="(f, i) in vars.frames" :key="'f' + i" class="sp-frame">{{ f.name === '<module>' ? $t('script.vars.main') : f.name + '()' }}</p>
          </div>
        </div>
        <button class="ghost sp-reset" data-testid="script-reset" @click="resetCode">{{ $t('script.reset') }}</button>
      </template>
      <ApiHelp v-else :level="mode === 'editor' ? 'mission' : 'player'" @insert="insertExample" />
    </div>
    <KeyBar v-if="touch && focused" @key="key" />
  </aside>
</template>

<script>
import CodeEditor from './CodeEditor.vue';
import KeyBar from './KeyBar.vue';
import ApiHelp from './ApiHelp.vue';
import { scriptErrorText, tr } from '../../i18n/index.js';

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};

export default {
  name: 'ScriptPanel',
  components: { CodeEditor, KeyBar, ApiHelp },
  props: {
    engine: { type: Object, required: true },
    scenario: { type: Object, required: true },
    /** ui.mission.script */
    script: { type: Object, required: true },
    /** 'adventure': player sections; 'editor': all sections, debug mission script */
    mode: { type: String, default: 'adventure' },
    compact: Boolean,
    /** On phones: sheet open (button sits in the quick access of the command bar) */
    open: Boolean,
    touch: Boolean,
  },
  emits: ['update:open'],
  data() {
    const saved = store.get(this.storeKey()) ?? {};
    const codes = {};
    for (const s of this.scenario.sections ?? []) codes[s.id] = s.editable && typeof saved[s.id] === 'string' ? saved[s.id] : s.code;
    return {
      codes, bps: {}, unfolded: {}, tab: 'code', full: false, focused: null,
      showBriefing: true, dirty: {}, editors: {},
    };
  },
  computed: {
    tabs() { return ['code', 'help']; },
    sections() {
      // In the adventure hidden sections (mission logic) stay invisible, in the editor you see everything
      return (this.scenario.sections ?? []).filter((s) => this.mode === 'editor' || (s.visibility ?? 'open') !== 'hidden');
    },
    player() { return this.script.player; },
    status() { return this.player?.status ?? 'idle'; },
    busy() { return this.status === 'running' || this.status === 'paused'; },
    paused() { return this.status === 'paused'; },
    vars() { return this.paused ? this.player.vars : null; },
    error() {
      const e = this.player?.status === 'error' ? this.player.error : null;
      return e && !this.dirty[e.section] ? e : null;
    },
    errorText() { return this.error ? this.errText(this.error, true) : { title: '', text: '' }; },
    consoleLines() {
      // The current error is already in the error box above
      const shown = this.error?.seq;
      return (this.script.console ?? []).filter((c) => (this.mode === 'editor' || c.level === 'player') && !(c.err && c.err.seq === shown)).slice(-60);
    },
  },
  watch: {
    'player.line'(l) { if (l && this.compact && this.status !== 'idle' && !this.open) this.$emit('update:open', true); },
    consoleLines() { this.$nextTick(() => { const b = this.$refs.body; if (b && this.tab === 'code' && this.busy) b.scrollTop = b.scrollHeight; }); },
  },
  methods: {
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
      this.engine.scriptRun(this.editable(), { mode: stepMode ? 'step' : 'run', bps: this.playerBps() });
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
      for (const s of this.scenario.sections ?? []) if (s.editable) this.codes[s.id] = s.code;
      this.persist();
    },
    blurred() { setTimeout(() => { if (!this.$el?.parentNode || !document.activeElement?.closest?.('.script-panel')) this.focused = null; }, 150); },
    key(k) {
      const ed = this.editors[this.focused];
      if (!ed) return;
      if (k.indent) ed.indent(false);
      else if (k.dedent) ed.indent(true);
      else ed.insert(k.text, k.back ?? 0);
    },
    insertExample(text) {
      const sec = (this.scenario.sections ?? []).find((s) => s.editable && s.level === 'player') ?? (this.scenario.sections ?? []).find((s) => s.editable);
      if (!sec) return;
      this.tab = 'code';
      const cur = this.codes[sec.id] ?? '';
      this.codes[sec.id] = cur.replace(/\n*$/, '\n') + text + '\n';
      this.edited(sec.id);
    },
  },
};
</script>

<style>
.script-panel {
  position: fixed; z-index: 6; display: flex; flex-direction: column;
  right: calc(var(--hud-gap) + var(--safe-r)); top: calc(var(--top-total, 4rem) + var(--hud-gap));
  bottom: calc(var(--bottom-h, 13rem) + var(--hud-gap) * 2);
  width: min(30rem, 42vw); padding: 0.625rem; gap: 0.5rem;
}
.script-panel.compact {
  left: var(--safe-l); right: var(--safe-r); bottom: 0; top: auto; width: auto;
  height: min(62dvh, 32rem); border-radius: var(--r-lg) var(--r-lg) 0 0; z-index: 30; padding-bottom: max(0.5rem, var(--safe-b));
}
.script-panel.compact.full { height: calc(100dvh - var(--safe-t)); }
.sp-head { display: flex; align-items: center; gap: 0.5rem; min-height: 2rem; }
.sp-title { flex: 1; min-width: 0; font-family: var(--display); color: var(--gold-200); font-size: var(--fs-lg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sp-status { font-size: var(--fs-xs); padding: 0.125rem 0.5rem; border-radius: 999px; background: var(--inset-bg); color: var(--ink-muted); }
.sp-status.running { color: var(--good); }
.sp-status.paused { color: var(--warn); }
.sp-status.error { color: var(--bad); }
.sp-status.done { color: var(--gold-300); }
.sp-tools { display: flex; gap: 0.25rem; flex-wrap: wrap; }
.sp-tools button { display: inline-flex; align-items: center; gap: 0.3rem; min-height: 2.375rem; padding: 0 0.5rem; }
.sp-run { min-width: 6rem; justify-content: center; }
.sp-glyph { font-size: 1.05em; line-height: 1; }
.sp-tabs { align-self: flex-start; }
.sp-tabs > button { min-height: 2rem; padding: 0 0.875rem; }
.sp-body { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 0.625rem; padding-right: 0.125rem; }
.sp-brief { position: relative; margin: 0; padding: 0.625rem 2.25rem 0.625rem 0.75rem; font-size: var(--fs-sm); line-height: 1.45; }
.sp-brief-x { position: absolute; top: 0.25rem; right: 0.25rem; min-height: 1.75rem !important; min-width: 1.75rem; padding: 0; color: var(--parch-ink); }
.sp-sec { display: flex; flex-direction: column; gap: 0.25rem; }
.sp-sec-title { margin: 0; font-size: var(--fs-sm); color: var(--ink-muted); display: flex; align-items: center; gap: 0.375rem; }
.sp-fold { display: flex; align-items: center; gap: 0.5rem; text-align: left; min-height: 2.25rem; background: var(--inset-bg); box-shadow: var(--inset-edge); border-color: transparent; }
.sp-fold span { flex: 1; }
.sp-fold small { color: var(--ink-dim); }
.sp-lock { width: 0.9rem !important; height: 0.9rem !important; opacity: 0.7; }
.sp-error { padding: 0.5rem 0.75rem; border-radius: var(--r-md); background: rgba(163, 50, 31, 0.28); box-shadow: inset 3px 0 0 var(--bad); }
.sp-error b { color: #ffc2b5; font-size: var(--fs-sm); }
.sp-error p { margin: 0.125rem 0 0; font-size: var(--fs-sm); line-height: 1.4; }
.sp-console { background: #0a0806; border-radius: var(--r-md); padding: 0.375rem 0.625rem; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.8125rem; max-height: 12rem; overflow-y: auto; box-shadow: var(--inset-edge); }
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
@media (max-width: 420px) {
  .sp-lbl { display: none; }
  .sp-run { min-width: 0; }
}
</style>
