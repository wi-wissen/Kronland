// Pure text operations of the code editor (CodeEditor.vue), testable without DOM (tests/ui/editText.test.js).

/**
 * Move the lines touched by the selection one line up (dir -1) or down (dir +1) – Alt+↑/↓ and the key bar on
 * phones, for putting mixed-up lines in order (Parsons tasks). The selection moves along.
 * @param {string} text @param {number} a selection start @param {number} b selection end @param {-1|1} dir
 * @returns {{ text: string, start: number, end: number, from: number, to: number, replacement: string }|null}
 *   new text and selection; `from`/`to` is the range of the old text that `replacement` replaces (for undo).
 *   null if there is nothing to move (first line up, last line down).
 */
export function moveLines(text, a, b, dir) {
  const lines = text.split('\n');
  const lineAt = (off) => text.slice(0, off).split('\n').length - 1;
  const first = lineAt(a);
  // A selection that ends right after a line break does not take the next line along
  const last = Math.max(first, lineAt(b > a && text[b - 1] === '\n' ? b - 1 : b));
  // The empty line after a final line break stays at the end
  const end = lines.length - 1 - (lines.length > 1 && lines[lines.length - 1] === '' ? 1 : 0);
  if (dir < 0 ? first === 0 : last >= end) return null;
  const lo = dir < 0 ? first - 1 : first, hi = dir < 0 ? last : last + 1;
  const block = lines.slice(first, last + 1);
  const moved = dir < 0 ? [...block, lines[first - 1]] : [lines[last + 1], ...block];
  const out = [...lines.slice(0, lo), ...moved, ...lines.slice(hi + 1)];
  const from = lines.slice(0, lo).reduce((n, l) => n + l.length + 1, 0);
  const to = from + lines.slice(lo, hi + 1).join('\n').length;
  const shift = dir < 0 ? -(lines[first - 1].length + 1) : lines[last + 1].length + 1;
  return { text: out.join('\n'), start: a + shift, end: b + shift, from, to, replacement: moved.join('\n') };
}
