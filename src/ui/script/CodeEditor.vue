<template>
  <!-- Code editor modelled on python.jetzt: a real <textarea> (keyboard, selection, undo,
       on-screen keyboard on phones) with transparent text above a coloured <pre>.
       Colouring uses the same lexer the VM uses (src/script/lexer.js). -->
  <div class="code-editor" :class="{ readonly }" :style="{ '--lines': lineCount }" data-testid="code-editor">
    <div ref="gutter" class="ce-gutter" aria-hidden="true">
      <div
        v-for="n in lineCount"
        :key="n"
        class="ce-ln"
        :class="{ error: n === errorLine, running: n === runningLine, bp: breakpoints.includes(n) }"
        :data-testid="'ce-line-' + n"
        @click="toggleBreakpoint(n)"
      >
        <i class="ce-dot"></i><span>{{ n + firstLine - 1 }}</span>
      </div>
    </div>
    <div class="ce-area">
      <div class="ce-bg" aria-hidden="true">
        <div v-for="n in lineCount" :key="n" class="ce-bgl" :class="{ error: n === errorLine, running: n === runningLine }"></div>
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
      ></textarea>
    </div>
  </div>
</template>

<script>
import { highlightRanges } from '../../script/index.js';

const INDENT = '    ';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default {
  name: 'CodeEditor',
  props: {
    modelValue: { type: String, default: '' },
    readonly: Boolean,
    /** 1-based lines */
    errorLine: { type: Number, default: -1 },
    runningLine: { type: Number, default: -1 },
    breakpoints: { type: Array, default: () => [] },
    /** Number of the first line (display) */
    firstLine: { type: Number, default: 1 },
    label: { type: String, default: 'Python' },
  },
  emits: ['update:modelValue', 'update:breakpoints', 'focus', 'blur'],
  computed: {
    lineCount() { return Math.max(1, this.modelValue.split('\n').length); },
    html() {
      const src = this.modelValue;
      let out = '', at = 0;
      for (const r of highlightRanges(src)) {
        if (r.from > at) out += esc(src.slice(at, r.from));
        out += `<span class="tk-${r.cls}">${esc(src.slice(r.from, r.to))}</span>`;
        at = r.to;
      }
      // Empty line at the end so the height matches the text field
      return out + esc(src.slice(at)) + '\n';
    },
  },
  watch: {
    runningLine(n) { if (n > 0) this.$nextTick(() => this.reveal(n)); },
    errorLine(n) { if (n > 0) this.$nextTick(() => this.reveal(n)); },
  },
  methods: {
    onInput(e) { this.$emit('update:modelValue', e.target.value); },

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
      if (this.readonly) return;
      const ta = e.target;
      if (e.key === 'Tab') {
        e.preventDefault();
        this.indent(e.shiftKey);
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
.ce-area { position: relative; flex: 1; min-width: 0; }
.ce-bg { position: absolute; inset: 0; padding: 0.5rem 0; pointer-events: none; }
.ce-bgl { height: var(--ce-lh); }
.ce-bgl.running { background: rgba(120, 200, 90, 0.22); box-shadow: inset 3px 0 0 #8bd96f; }
.ce-bgl.error { background: rgba(243, 122, 100, 0.22); box-shadow: inset 3px 0 0 #f37a64; }
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
@media (pointer: coarse) {
  .code-editor { font-size: 0.9375rem; --ce-lh: 1.6rem; }
  .ce-gutter { width: 2.75rem; }
}
</style>
