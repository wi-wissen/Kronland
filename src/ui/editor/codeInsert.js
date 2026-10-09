// Inserting code into a section of the world editor: where a snippet goes and how it is indented.
// Pure and testable (tests/ui/codeInsert.test.js); the editor feeds the result to the textarea (undo is kept).
//
// Snippet kinds:
//   expr  – an expression (place("camp"), (12, 8)): replaces the selection as it is.
//   stmt  – one or more statements (several say(), a loop): indented like the line at the caret. With `wrap`
//           (e.g. "@on_start\ndef talk1():") the lines become the body of that header at the top level.
//   top   – definitions with decorators (@on_talk, @every): only at the top level. Inside a function the block goes
//           behind the surrounding top-level block.
// Placeholders: text between « and » is selected after inserting (typing replaces it); the marks are removed.

const INDENT = '    ';
const indentOf = (line) => /^[ \t]*/.exec(line)[0];
const isBlank = (line) => /^\s*$/.test(line);
/** Line ends with a colon (comments allowed): the next line is one level deeper. */
const opensBlock = (line) => /:\s*(#.*)?$/.test(line);

/** Indent every non-empty line of a block. */
export function indentLines(text, ind) {
  return text.split('\n').map((l) => (l.trim() ? ind + l : l)).join('\n');
}

/**
 * Line around a position: start and end offset, text and indentation.
 * @param {string} code @param {number} pos
 */
export function lineAt(code, pos) {
  const start = code.lastIndexOf('\n', pos - 1) + 1;
  const nl = code.indexOf('\n', pos);
  const end = nl < 0 ? code.length : nl;
  const text = code.slice(start, end);
  return { start, end, text, indent: indentOf(text) };
}

/**
 * Indentation for a statement on the blank line at `pos`: the whitespace typed there, otherwise that of the
 * previous non-blank line (one level deeper after a colon).
 * @param {string} code @param {number} pos
 */
export function blankLineIndent(code, pos) {
  const ln = lineAt(code, pos);
  if (ln.text.length) return ln.text.replace(/[^ \t]/g, '');
  let k = ln.start - 1;
  while (k > 0) {
    const prev = lineAt(code, k - 1);
    if (!isBlank(prev.text) && !/^\s*#/.test(prev.text)) return prev.indent + (opensBlock(prev.text) ? INDENT : '');
    k = prev.start - 1;
  }
  return '';
}

/** Remove the placeholder marks «…»; returns the text and the range of the first placeholder (or null). */
export function placeholders(text) {
  const a = text.indexOf('«'), b = text.indexOf('»');
  const clean = text.replace(/[«»]/g, '');
  return { text: clean, sel: a >= 0 && b > a ? [a, b - 1] : null };
}

/**
 * Where and what to insert.
 * @param {string} code section code
 * @param {number} selStart @param {number} selEnd selection (caret: both the same)
 * @param {{ kind: 'expr'|'stmt'|'top', code: string, wrap?: string }} snippet
 * @returns {{ from: number, to: number, text: string, select: [number, number] }} replace code[from, to) by text;
 *   select = absolute selection afterwards (placeholder, otherwise the caret behind the insertion)
 */
export function planInsert(code, selStart, selEnd, snippet) {
  const a = Math.max(0, Math.min(selStart, code.length)), b = Math.max(a, Math.min(selEnd ?? a, code.length));
  if (snippet.kind === 'expr') return finish(a, b, '', snippet.code, '');

  let ln = lineAt(code, a);
  let ind, from, to, before = '', after = '';
  const decorator = (text) => /^\s*@/.test(text);
  if (isBlank(ln.text)) {
    // Blank line: the snippet takes its place
    ind = blankLineIndent(code, a);
    from = ln.start; to = ln.end;
  } else if (a - ln.start <= ln.indent.length && depthAt(code, ln.start) === 0 && !(ln.start > 0 && decorator(lineAt(code, ln.start - 1).text))) {
    // Caret in the indentation of a line: above it, with its indentation
    ind = ln.indent;
    from = to = ln.start;
    after = '\n';
  } else {
    // On a new line below the statement at the caret: behind brackets spread over lines and decorators (they
    // belong to the next line), one level deeper after a colon
    let end = ln.end;
    while (end < code.length && (depthAt(code, end) > 0 || decorator(lineAt(code, end).text))) end = lineAt(code, end + 1).end;
    ln = lineAt(code, end);
    let first = ln;
    while (first.start > 0 && depthAt(code, first.start) > 0) first = lineAt(code, first.start - 1);
    ind = first.indent + (opensBlock(ln.text) ? INDENT : '');
    from = to = ln.end;
    before = '\n';
  }

  let body = snippet.code.replace(/\n+$/, '');
  const topLevel = snippet.kind === 'top' || (snippet.wrap && ind === '');
  if (snippet.kind === 'stmt' && snippet.wrap && ind === '') body = snippet.wrap.replace(/\n+$/, '') + '\n' + indentLines(body, INDENT);
  if (!topLevel) return finish(from, to, before, indentLines(body, ind), after);

  if (ind !== '') {
    // Inside a block: behind the surrounding top-level block, before the next unindented line (comments directly
    // above it belong to it), or at the end
    const lines = code.split('\n');
    const starts = [];
    for (let i = 0, o = 0; i < lines.length; i++) { starts.push(o); o += lines[i].length + 1; }
    const row = code.slice(0, ln.start).split('\n').length - 1;
    const loose = (l) => isBlank(l) || /^#/.test(l);
    let j = row + 1;
    while (j < lines.length && (loose(lines[j]) || indentOf(lines[j]) !== '')) j++;
    if (j >= lines.length) {
      const end = code.replace(/\s+$/, '').length;
      return finish(end, code.length, '\n\n', body, '\n');
    }
    let q = j;
    while (q - 1 > row && loose(lines[q - 1])) q--;
    return finish(starts[q], starts[q], '\n', body, isBlank(lines[q]) ? '\n' : '\n\n');
  }
  // Top level: one blank line around a definition so it stands apart
  const prevText = before ? ln.text : from > 0 ? lineAt(code, from - 1).text : '';
  const nextText = after ? ln.text : to < code.length ? lineAt(code, to + 1).text : '';
  if (!isBlank(prevText)) before += '\n';
  if (!isBlank(nextText)) after += '\n';
  return finish(from, to, before, body, after);
}

/**
 * Depth of open brackets at a position (strings and comments skipped): > 0 inside a call spread over lines.
 * @param {string} code @param {number} pos
 */
export function depthAt(code, pos) {
  let depth = 0;
  for (let i = 0; i < pos; i++) {
    const ch = code[i];
    if (ch === '#') { while (i + 1 < pos && code[i + 1] !== '\n') i++; continue; }
    if (ch === '"' || ch === "'") {
      const q = code.startsWith(ch.repeat(3), i) ? ch.repeat(3) : ch;
      i += q.length;
      while (i < pos && !code.startsWith(q, i) && !(q.length === 1 && code[i] === '\n')) i += code[i] === '\\' ? 2 : 1;
      i += q.length - 1;
      continue;
    }
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);
  }
  return depth;
}

function finish(from, to, before, body, after) {
  const p = placeholders(body);
  const text = before + p.text + after;
  const base = from + before.length;
  const select = p.sel ? [base + p.sel[0], base + p.sel[1]] : [base + p.text.length, base + p.text.length];
  return { from, to, text, select };
}

/**
 * Apply a plan to the code (for sections without a mounted editor and for tests).
 * @param {string} code @param {{ from: number, to: number, text: string }} plan
 */
export const applyPlan = (code, plan) => code.slice(0, plan.from) + plan.text + code.slice(plan.to);

/**
 * A name not used yet in any of the codes: base1, base2 … (identifiers and strings count).
 * @param {string} base @param {string[]} codes
 */
export function uniqueName(base, codes) {
  const all = codes.join('\n');
  for (let n = 1; ; n++) {
    const name = `${base}${n}`;
    if (!new RegExp(`\\b${name}\\b`).test(all)) return name;
  }
}

/**
 * Code for a target on the map (double-click/long-press).
 * @param {{ kind: string, x: number, y: number, name?: string, hero?: string, npc?: string }} t see EditorView.targetAt
 * @returns {{ kind: 'expr', code: string }|null} null: free tile, the editor offers a menu
 */
export function targetSnippet(t) {
  if (!t) return null;
  switch (t.kind) {
    case 'place': return { kind: 'expr', code: `place("${t.name}")` };
    case 'hq': return { kind: 'expr', code: 'hq()' };
    case 'hero': return { kind: 'expr', code: t.hero };
    case 'npc': return { kind: 'expr', code: `"${t.npc}"` };
    case 'free': return null;
    default: return { kind: 'expr', code: `(${t.x}, ${t.y})` };
  }
}

/** Menu entries for a free tile. */
export const FREE_MENU = ['place', 'npc', 'coords'];

/**
 * Code for a menu choice on a free tile.
 * @param {'place'|'npc'|'coords'} choice @param {{ x: number, y: number }} at
 * @param {{ codes: string[], talk: (o: any) => any }} o all section codes (unique names), talk-figure block
 */
export function menuSnippet(choice, at, o) {
  if (choice === 'coords') return { kind: 'expr', code: `(${at.x}, ${at.y})` };
  if (choice === 'place') return { kind: 'stmt', code: `make_place("«${uniqueName('place', o.codes)}»", ${at.x}, ${at.y}, 2)` };
  return o.talk(at);
}
