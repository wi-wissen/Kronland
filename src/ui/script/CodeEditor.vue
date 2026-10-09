<template>
  <!-- Code editor modelled on python.jetzt: a real <textarea> (keyboard, selection, undo,
       on-screen keyboard on phones) with transparent text above a coloured <pre>.
       Colouring uses the same lexer the VM uses (src/script/lexer.js). -->
  <div class="code-editor" :class="{ readonly, linking: !!link }" :style="{ '--lines': lineCount }" data-testid="code-editor">
    <div ref="gutter" class="ce-gutter" aria-hidden="true">
      <div
        v-for="n in lineCount"
        :key="n"
        class="ce-ln"
        :class="{ error: n === errorLine, running: n === runningLine, bp: breakpoints.includes(n), hint: hintLines.includes(n) && n !== errorLine }"
        :data-testid="'ce-line-' + n"
        @click="toggleBreakpoint(n)"
      >
        <i class="ce-dot"></i><span>{{ n + firstLine - 1 }}</span>
      </div>
    </div>
    <div class="ce-area">
      <div class="ce-bg" aria-hidden="true">
        <div v-for="n in lineCount" :key="n" class="ce-bgl" :class="{ error: n === errorLine, running: n === runningLine, hint: hintLines.includes(n) && n !== errorLine && n !== runningLine }"></div>
      </div>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <pre ref="pre" class="ce-pre" aria-hidden="true" v-html="html"></pre>
      <textarea
        ref="ta"
        class="ce-input"
        :value="modelValue"
        :readonly="readonly"
        :aria-label="label"
        spellcheck="false"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        wrap="off"
        data-testid="code-input"
        @input="onInput"
        @scroll="syncScroll"
        @keydown="onKey"
        @focus="$emit('focus', this)"
        @blur="$emit('blur')"
        @mousemove="onMouseMove"
        @mouseleave="onMouseLeave"
        @mousedown="onMouseDown"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="cancelPress"
        @pointercancel="pressCancelled"
        @touchmove.passive="onTouchMove"
        @touchend.passive="cancelPress"
        @contextmenu="onContextMenu"
      ></textarea>
    </div>
    <!-- Documentation of the command under the mouse (after a short delay) or after a long press on phones -->
    <Teleport to="body">
      <div v-if="doc?.mode === 'touch'" class="ce-doc-scrim" data-testid="doc-card-scrim" @click="scrimClick"></div>
      <div v-if="doc" class="ce-doc" :class="doc.mode" :style="doc.style" @mouseenter="docHovered = true" @mouseleave="docHovered = false; hideDocSoon()">
        <DocCard :card="doc.card" :full="doc.mode === 'touch'" :closable="doc.mode === 'touch'" :hint="doc.mode === 'hover' ? ctrlHint : ''" @close="hideDoc" />
      </div>
    </Teleport>
  </div>
</template>

<script>
import { highlightRanges } from '../../script/index.js';
import DocCard from './DocCard.vue';
import { commandAt, offsetAt } from './hoverDoc.js';
import { docs, loadDocs } from './docsLoader.js';
import { refUrl } from './reference.js';
import { moveLines } from './editText.js';

const INDENT = '    ';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Delay before the doc card appears under the mouse (ms) */
const HOVER_MS = 500;
/** Long press on touch devices (ms) and allowed finger movement (px) */
const PRESS_MS = 550;
const PRESS_SLOP = 10;
const IS_MAC = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '');
/** Ctrl (Cmd on the Mac) held: command links to the reference */
const modifier = (e) => (IS_MAC ? e.metaKey : e.ctrlKey);

/**
 * Highlighted text as HTML; the range `link` (command under the mouse with Ctrl/Cmd) gets the class ce-link.
 * @param {string} src @param {{ from: number, to: number }|null} link
 */
function paint(src, link) {
  const segs = [];
  let at = 0;
  for (const r of highlightRanges(src)) {
    if (r.from > at) segs.push({ from: at, to: r.from, cls: null });
    segs.push({ from: r.from, to: r.to, cls: r.cls });
    at = r.to;
  }
  if (at < src.length) segs.push({ from: at, to: src.length, cls: null });
  let out = '';
  for (const g of segs) {
    const cuts = [g.from];
    if (link) for (const c of [link.from, link.to]) if (c > g.from && c < g.to) cuts.push(c);
    cuts.push(g.to);
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1];
      const cls = [g.cls ? `tk-${g.cls}` : '', link && a >= link.from && b <= link.to ? 'ce-link' : ''].filter(Boolean).join(' ');
      const text = esc(src.slice(a, b));
      out += cls ? `<span class="${cls}">${text}</span>` : text;
    }
  }
  return out;
}

export default {
  name: 'CodeEditor',
  components: { DocCard },
  props: {
    modelValue: { type: String, default: '' },
    readonly: Boolean,
    /** 1-based lines */
    errorLine: { type: Number, default: -1 },
    /** Lines with a hint (amber marker, the program keeps running) */
    hintLines: { type: Array, default: () => [] },
    runningLine: { type: Number, default: -1 },
    breakpoints: { type: Array, default: () => [] },
    /** Number of the first line (display) */
    firstLine: { type: Number, default: 1 },
    label: { type: String, default: 'Python' },
  },
  emits: ['update:modelValue', 'update:breakpoints', 'focus', 'blur', 'insert'],
  data() {
    return {
      /** Doc card shown: { mode: 'hover'|'touch', name, from, to, card, style } */
      doc: null,
      docHovered: false,
      /** Command under the mouse while Ctrl/Cmd is held: { name, from, to } */
      link: null,
    };
  },
  computed: {
    lineCount() { return Math.max(1, this.modelValue.split('\n').length); },
    // Empty line at the end so the height matches the text field
    html() { return paint(this.modelValue, this.link) + '\n'; },
    ctrlHint() { return this.$t('script.doc.ctrlClick', { key: IS_MAC ? '⌘' : this.$t('script.doc.ctrl') }); },
  },
  watch: {
    runningLine(n) { if (n > 0) this.$nextTick(() => this.reveal(n)); },
    errorLine(n) { if (n > 0) this.$nextTick(() => this.reveal(n)); },
  },
  mounted() {
    this.onModKey = (e) => {
      if (e.key !== 'Control' && e.key !== 'Meta') return;
      const m = this.mouse;
      this.link = m && modifier(e) ? this.commandAtPoint(m.x, m.y) : null;
    };
    this.onWinBlur = () => { this.link = null; };
    window.addEventListener('keydown', this.onModKey);
    window.addEventListener('keyup', this.onModKey);
    window.addEventListener('blur', this.onWinBlur);
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.onModKey);
    window.removeEventListener('keyup', this.onModKey);
    window.removeEventListener('blur', this.onWinBlur);
    clearTimeout(this.hoverTimer);
    clearTimeout(this.hideTimer);
    clearTimeout(this.pressTimer);
  },
  methods: {
    onInput(e) { this.hideDoc(); this.$emit('update:modelValue', e.target.value); },

    /** Character offset under a screen point (−1: no text there). Monospace: column = x / character width. */
    offsetAtPoint(x, y) {
      const ta = this.$refs.ta;
      if (!ta) return -1;
      const cs = getComputedStyle(ta);
      const r = ta.getBoundingClientRect();
      const lh = parseFloat(cs.lineHeight) || 20;
      const cw = this.charWidth(cs);
      const row = Math.floor((y - r.top - parseFloat(cs.paddingTop) + ta.scrollTop) / lh);
      const col = Math.floor((x - r.left - parseFloat(cs.paddingLeft) + ta.scrollLeft) / cw);
      return offsetAt(this.modelValue, row, col);
    },
    /** Width of one character of the editor font (measured once per font). */
    charWidth(cs) {
      const font = cs.font;
      if (this.cw?.font === font) return this.cw.w;
      const span = document.createElement('span');
      span.textContent = 'M'.repeat(40);
      Object.assign(span.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre', font, letterSpacing: 'normal', fontVariantLigatures: 'none' });
      this.$el.appendChild(span);
      const w = span.getBoundingClientRect().width / 40 || 8;
      span.remove();
      this.cw = { font, w };
      return w;
    },
    /** Documented command under a screen point, or null (loads the docs on first use). */
    commandAtPoint(x, y) {
      const d = docs();
      if (!d) { loadDocs(); return null; }
      const off = this.offsetAtPoint(x, y);
      return off < 0 ? null : commandAt(this.modelValue, off, d.isKnown);
    },
    onMouseMove(e) {
      this.mouse = { x: e.clientX, y: e.clientY };
      if (e.buttons) { this.link = null; return; }
      const hit = this.commandAtPoint(e.clientX, e.clientY);
      this.link = hit && modifier(e) ? hit : null;
      const cur = this.doc;
      if (hit && cur?.mode === 'hover' && cur.name === hit.name && cur.from === hit.from) { clearTimeout(this.hideTimer); return; }
      clearTimeout(this.hoverTimer);
      if (cur?.mode === 'hover') this.hideDocSoon();
      if (!hit && !docs()) {
        // Docs still loading: try again at this point once they are there
        loadDocs().then(() => { if (this.mouse?.x === e.clientX && this.mouse?.y === e.clientY) this.onMouseMove(e); });
        return;
      }
      if (hit) this.hoverTimer = setTimeout(() => this.showDoc(hit, 'hover'), HOVER_MS);
    },
    onMouseLeave() {
      this.mouse = null;
      this.link = null;
      clearTimeout(this.hoverTimer);
      this.hideDocSoon();
    },
    /** Ctrl/Cmd+click on a command: reference at its entry in a new tab. */
    onMouseDown(e) {
      if (e.button !== 0 || !modifier(e)) return;
      const hit = this.commandAtPoint(e.clientX, e.clientY);
      if (!hit) return;
      e.preventDefault();
      this.hideDoc();
      window.open(refUrl(hit.name), '_blank', 'noopener');
    },
    /** Touch: long press on a command shows its card. */
    onPointerDown(e) {
      if (e.pointerType === 'mouse') return;
      loadDocs();
      this.press = { x: e.clientX, y: e.clientY };
      clearTimeout(this.pressTimer);
      this.pressTimer = setTimeout(async () => {
        const p = this.press;
        if (!p) return;
        await loadDocs();
        const hit = this.commandAtPoint(p.x, p.y);
        if (hit) { this.pressedAt = Date.now(); this.showDoc(hit, 'touch'); }
      }, PRESS_MS);
    },
    onPointerMove(e) {
      const p = this.press;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > PRESS_SLOP) this.cancelPress();
    },
    // After a pointercancel (scrolling, selection) only touch events report the finger
    onTouchMove(e) { const t = e.touches?.[0]; if (t) this.onPointerMove(t); },
    cancelPress() {
      // Lifting the finger after the card appeared: the browser's click follows – it must not close the card
      if (this.doc?.mode === 'touch' && this.press) this.releasedAt = Date.now();
      this.press = null;
      clearTimeout(this.pressTimer);
    },
    scrimClick() { if (Date.now() - (this.releasedAt ?? 0) > 400) this.hideDoc(); },
    // The browser may take over a held finger (text selection): the press still counts unless the finger moved
    pressCancelled() { if (this.press) this.press.cancelled = true; },
    /** The browser's own long-press menu would cover the card; on touch it also opens the card itself. */
    onContextMenu(e) {
      if (this.doc?.mode === 'touch' || Date.now() - (this.pressedAt ?? 0) < 1000) { e.preventDefault(); return; }
      const p = this.press;
      if (!p) return;
      const hit = docs() && this.commandAtPoint(p.x, p.y);
      if (hit) { e.preventDefault(); this.cancelPress(); this.pressedAt = Date.now(); this.showDoc(hit, 'touch'); }
    },
    showDoc(hit, mode) {
      const d = docs();
      const card = d?.cardFor(hit.name, this.$i18n?.lang ?? 'de');
      if (!card) return;
      clearTimeout(this.hideTimer);
      this.docHovered = false;
      this.doc = { mode, name: hit.name, from: hit.from, to: hit.to, card, style: mode === 'hover' ? this.hoverStyle(hit) : null };
    },
    /** Card below the hovered line (above it if there is no room), within the window. */
    hoverStyle(hit) {
      const ta = this.$refs.ta;
      const cs = getComputedStyle(ta);
      const r = ta.getBoundingClientRect();
      const lh = parseFloat(cs.lineHeight) || 20;
      const cw = this.charWidth(cs);
      const before = this.modelValue.slice(0, hit.from);
      const row = before.split('\n').length - 1;
      const col = hit.from - (before.lastIndexOf('\n') + 1);
      const top = r.top + parseFloat(cs.paddingTop) + row * lh - ta.scrollTop;
      const left = Math.max(8, Math.min(window.innerWidth - 8 - Math.min(416, window.innerWidth - 16), r.left + parseFloat(cs.paddingLeft) + col * cw - ta.scrollLeft - 12));
      const below = window.innerHeight - (top + lh) > 260 || top < 260;
      return below ? { left: left + 'px', top: top + lh + 4 + 'px' } : { left: left + 'px', bottom: window.innerHeight - top + 4 + 'px' };
    },
    hideDoc() { clearTimeout(this.hideTimer); clearTimeout(this.hoverTimer); this.doc = null; },
    hideDocSoon() {
      clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => { if (!this.docHovered && this.doc?.mode === 'hover') this.doc = null; }, 250);
    },

    syncScroll() {
      const ta = this.$refs.ta;
      this.$refs.pre.scrollLeft = ta.scrollLeft;
    },

    /** Make a line visible (scrolls the surrounding area). */
    reveal(n) {
      const el = this.$refs.gutter?.children[n - 1];
      el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    },

    toggleBreakpoint(n) {
      const list = this.breakpoints.includes(n) ? this.breakpoints.filter((x) => x !== n) : [...this.breakpoints, n].sort((a, b) => a - b);
      this.$emit('update:breakpoints', list);
    },

    /** Insert text at the caret (undo is preserved). Also for the key bar on phones. */
    insert(text, select = 0) {
      const ta = this.$refs.ta;
      if (this.readonly || !ta) return;
      ta.focus();
      const ok = document.execCommand?.('insertText', false, text);
      if (!ok) {
        const { selectionStart: a, selectionEnd: b } = ta;
        ta.setRangeText(text, a, b, 'end');
      }
      if (select) ta.selectionStart = ta.selectionEnd = ta.selectionEnd - select;
      this.$emit('update:modelValue', ta.value);
    },

    /** Current selection { start, end } (also while the editor has no focus), or null. */
    selection() {
      const ta = this.$refs.ta;
      return ta ? { start: ta.selectionStart, end: ta.selectionEnd } : null;
    },

    /**
     * Replace code[from, to) by text and select [a, b] afterwards (world editor: code from the map, building blocks).
     * With focus the browser's undo keeps the change; without (phones: no keyboard popping up) it is set directly.
     */
    replace(from, to, text, select, focus = true) {
      const ta = this.$refs.ta;
      if (this.readonly || !ta) return false;
      const expected = ta.value.slice(0, from) + text + ta.value.slice(to);
      if (focus) ta.focus({ preventScroll: true });
      ta.selectionStart = from;
      ta.selectionEnd = to;
      const ok = focus && document.execCommand?.('insertText', false, text);
      if (!ok || ta.value !== expected) ta.value = expected;
      ta.selectionStart = select[0];
      ta.selectionEnd = select[1];
      this.$emit('update:modelValue', ta.value);
      this.$nextTick(() => this.reveal(ta.value.slice(0, select[0]).split('\n').length));
      return true;
    },

    /** Move the selected lines one up (-1) or down (+1): Alt+↑/↓ and the key bar (undo is preserved). */
    moveLines(dir) {
      const ta = this.$refs.ta;
      if (this.readonly || !ta) return;
      const r = moveLines(ta.value, ta.selectionStart, ta.selectionEnd, dir);
      if (!r) return;
      ta.focus();
      ta.selectionStart = r.from;
      ta.selectionEnd = r.to;
      const ok = document.execCommand?.('insertText', false, r.replacement);
      if (!ok || ta.value !== r.text) { ta.value = r.text; }
      ta.selectionStart = r.start;
      ta.selectionEnd = r.end;
      this.$emit('update:modelValue', ta.value);
    },

    /** Indent or unindent selected lines. */
    indent(out = false) {
      const ta = this.$refs.ta;
      if (this.readonly || !ta) return;
      const v = ta.value;
      const a = ta.selectionStart, b = ta.selectionEnd;
      const start = v.lastIndexOf('\n', a - 1) + 1;
      const endNl = v.indexOf('\n', b === a ? b : b - 1);
      const end = endNl < 0 ? v.length : endNl;
      const block = v.slice(start, end);
      const lines = block.split('\n');
      const changed = lines.map((l) => (out ? l.replace(/^( {1,4}|\t)/, '') : INDENT + l)).join('\n');
      if (!out && a === b) { this.insert(INDENT.slice(0, 4 - ((a - start) % 4))); return; }
      ta.focus();
      ta.selectionStart = start;
      ta.selectionEnd = end;
      const ok = document.execCommand?.('insertText', false, changed);
      if (!ok) ta.setRangeText(changed, start, end, 'select');
      ta.selectionStart = start;
      ta.selectionEnd = start + changed.length;
      this.$emit('update:modelValue', ta.value);
    },

    onKey(e) {
      if (this.doc || this.link) {
        // Escape only closes the card (not also the game menu); typing hides it
        if (e.key === 'Escape' && this.doc) { e.stopPropagation(); this.hideDoc(); return; }
        if (e.key !== 'Control' && e.key !== 'Meta') this.hideDoc();
      }
      if (this.readonly) return;
      const ta = e.target;
      if (e.key === 'Tab') {
        e.preventDefault();
        this.indent(e.shiftKey);
      } else if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        this.moveLines(e.key === 'ArrowUp' ? -1 : 1);
      } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        // Take over the indentation of the line, one level deeper after a colon
        e.preventDefault();
        const v = ta.value, a = ta.selectionStart;
        const lineStart = v.lastIndexOf('\n', a - 1) + 1;
        const line = v.slice(lineStart, a);
        let ind = /^[ \t]*/.exec(line)[0];
        if (/:\s*(#.*)?$/.test(line)) ind += INDENT;
        else if (/^\s*(return|pass|break|continue)\b/.test(line)) ind = ind.slice(0, Math.max(0, ind.length - 4));
        this.insert('\n' + ind);
      } else if (e.key === 'Backspace' && ta.selectionStart === ta.selectionEnd) {
        // In the indentation: delete a whole level
        const v = ta.value, a = ta.selectionStart;
        const lineStart = v.lastIndexOf('\n', a - 1) + 1;
        const before = v.slice(lineStart, a);
        if (before.length >= 4 && /^ +$/.test(before) && before.length % 4 === 0) {
          e.preventDefault();
          ta.selectionStart = a - 4;
          const ok = document.execCommand?.('delete');
          if (!ok) ta.setRangeText('', a - 4, a, 'end');
          this.$emit('update:modelValue', ta.value);
        }
      }
    },

    focus() { this.$refs.ta?.focus(); },
  },
};
</script>

<style>
.code-editor {
  --ce-lh: 1.45rem;
  position: relative; display: flex; border-radius: var(--r-md); overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 0.875rem; line-height: var(--ce-lh);
  background: #0f0b08; box-shadow: var(--inset-edge), inset 0 0 0 1px rgba(225, 168, 58, 0.18);
  min-height: calc(var(--ce-lh) * 2 + 1rem);
}
.code-editor:focus-within { box-shadow: var(--inset-edge), inset 0 0 0 1px var(--gold-400); }
.code-editor.readonly { background: #0c0906; }
.code-editor.readonly .ce-pre { color: #ddd0b4; }
.ce-gutter { flex: none; width: 3rem; padding: 0.5rem 0; background: #0a0705; color: #7d6d55; user-select: none; border-right: 1px solid rgba(225, 168, 58, 0.12); }
.ce-ln { height: var(--ce-lh); display: flex; align-items: center; justify-content: space-between; padding: 0 0.4rem 0 0.3rem; cursor: pointer; font-size: 0.8em; }
.ce-ln span { min-width: 1.4em; text-align: right; }
.ce-dot { width: 0.7rem; height: 0.7rem; border-radius: 50%; flex: none; }
.ce-ln:hover .ce-dot { box-shadow: inset 0 0 0 2px rgba(243, 122, 100, 0.6); }
.ce-ln.bp .ce-dot { background: #e2533f; box-shadow: 0 0 0 1px #2a0e08; }
.ce-ln.running { color: #b9f29e; }
.ce-ln.error { color: #ffb3a6; }
.ce-ln.hint { color: #f5c46a; }
.ce-area { position: relative; flex: 1; min-width: 0; }
.ce-bg { position: absolute; inset: 0; padding: 0.5rem 0; pointer-events: none; }
.ce-bgl { height: var(--ce-lh); }
.ce-bgl.running { background: rgba(120, 200, 90, 0.22); box-shadow: inset 3px 0 0 #8bd96f; }
.ce-bgl.error { background: rgba(243, 122, 100, 0.22); box-shadow: inset 3px 0 0 #f37a64; }
.ce-bgl.hint { background: rgba(240, 180, 60, 0.14); box-shadow: inset 3px 0 0 #f0b43c; }
.ce-pre, .ce-input {
  margin: 0; padding: 0.5rem 0.625rem; border: 0; font: inherit; line-height: inherit; letter-spacing: normal;
  white-space: pre; tab-size: 4; font-variant-ligatures: none; overflow-wrap: normal;
}
.ce-pre { position: relative; color: #efe3c8; pointer-events: none; overflow: hidden; min-height: 100%; }
.ce-input {
  position: absolute; inset: 0; width: 100%; height: 100%; resize: none; outline: none; overflow-x: auto; overflow-y: hidden;
  background: transparent; color: transparent; caret-color: var(--gold-200); -webkit-text-fill-color: transparent;
  border-radius: 0; box-shadow: none; min-height: 0;
}
.ce-input::selection { background: rgba(243, 200, 94, 0.32); color: transparent; }
.tk-kw { color: #f0a35e; font-weight: 600; }
.tk-const { color: #d996f2; }
.tk-str { color: #a8d97a; }
.tk-num { color: #8fc8f2; }
.tk-comment { color: #998868; font-style: italic; }
.tk-def { color: #ffd479; }
.tk-builtin { color: #78d6c6; }
.tk-call { color: #f5d9a0; }
.tk-deco { color: #e886b5; }
/* Ctrl/Cmd held over a documented command: link to the reference, like in an IDE */
.code-editor.linking .ce-input { cursor: pointer; }
.ce-link { text-decoration: underline; text-decoration-color: var(--gold-300); text-underline-offset: 3px; color: var(--gold-100); }
.ce-doc { position: fixed; z-index: 70; width: min(26rem, calc(100vw - 16px)); box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55); border-radius: 0.5rem 0.75rem; }
.ce-doc.touch { left: 0.75rem; right: 0.75rem; width: auto; bottom: calc(5rem + var(--safe-b, 0px)); max-height: 60dvh; overflow-y: auto; }
.ce-doc-scrim { position: fixed; inset: 0; z-index: 69; background: rgba(10, 6, 3, 0.35); }
@media (pointer: coarse) {
  .code-editor { font-size: 0.9375rem; --ce-lh: 1.6rem; }
  .ce-gutter { width: 2.75rem; }
}
</style>
