// Which documented command is under a position in the code? Used by the editor for hover cards,
// Ctrl/Cmd+click → reference and long-press on phones. Pure and testable (tests/ui/hoverDoc.test.js).
// Strings and comments come from the editor's highlighter (src/script/lexer.js, highlightRanges).

import { highlightRanges } from '../../script/index.js';

const ID_PART = /[\p{L}\p{N}_]/u;
const ID_START = /[\p{L}_]/u;
const isId = (c) => c !== undefined && ID_PART.test(c);

/**
 * Method types tried for `x.name` when the type of x is unknown (in this order): Python types first, then the game
 * objects whose methods the reference explains once (every figure under nelia.…, serf.chop, troop.hold …).
 */
export const METHOD_TYPES = ['str', 'list', 'dict', 'tuple', 'nelia', 'serf', 'troop', 'obj', 'place', 'building', 'npc'];

/**
 * Identifier around a character position (the character at `offset`), or null.
 * @param {string} src @param {number} offset
 * @returns {{ from: number, to: number, word: string }|null}
 */
export function identAt(src, offset) {
  if (!isId(src[offset])) return null;
  let a = offset, b = offset + 1;
  while (a > 0 && isId(src[a - 1])) a--;
  while (b < src.length && isId(src[b])) b++;
  const word = src.slice(a, b);
  return ID_START.test(word[0]) ? { from: a, to: b, word } : null;
}

/**
 * Candidate names for the identifier at `offset`, best first: dotted chain (`hero.step`, `math.sqrt`),
 * method on a literal (`"a b".split` → `str.split`), method on an unknown value (`xs.append` → `str.append`,
 * `list.append` …) or the bare name (`len`). Inside strings and comments: none.
 * @param {string} src @param {number} offset
 * @param {{ from: number, to: number, cls: string }[]} [ranges] highlightRanges(src), if already computed
 * @returns {{ from: number, to: number, names: string[] }|null}
 */
export function candidatesAt(src, offset, ranges = highlightRanges(src)) {
  if (ranges.some((r) => (r.cls === 'str' || r.cls === 'comment') && offset >= r.from && offset < r.to)) return null;
  const w = identAt(src, offset);
  if (!w) return null;
  const parts = [w.word];
  let i = w.from, receiver = null;
  while (src[i - 1] === '.') {
    const dot = i - 1;
    if (isId(src[dot - 1])) {
      let j = dot - 1;
      while (j > 0 && isId(src[j - 1])) j--;
      const name = src.slice(j, dot);
      if (!ID_START.test(name[0])) { receiver = 'number'; break; }
      parts.unshift(name);
      i = j;
    } else {
      const c = src[dot - 1];
      if ((c === '"' || c === "'") && ranges.some((r) => r.cls === 'str' && r.to === dot)) receiver = 'str';
      else if (c === ']') receiver = 'list';
      else if (c === '}') receiver = 'dict';
      else receiver = '?';
      break;
    }
  }
  const names = [];
  for (let k = 0; k < parts.length - 1; k++) names.push(parts.slice(k).join('.'));
  const dotted = src[w.from - 1] === '.';
  if (dotted) {
    if (receiver && receiver !== '?' && receiver !== 'number') names.push(`${receiver}.${w.word}`);
    for (const t of METHOD_TYPES) names.push(`${t}.${w.word}`);
  } else names.push(w.word);
  return { from: w.from, to: w.to, names: [...new Set(names)] };
}

/**
 * The documented command at `offset`, or null.
 * @param {string} src @param {number} offset @param {(name: string) => boolean} known
 * @returns {{ name: string, from: number, to: number }|null}
 */
export function commandAt(src, offset, known, ranges) {
  const c = candidatesAt(src, offset, ranges);
  const name = c?.names.find((n) => known(n));
  return name ? { name, from: c.from, to: c.to } : null;
}

/**
 * Character offset in the text for a line/column (0-based) – the editor computes them from the mouse position.
 * Columns behind the end of the line give -1 (no hover in empty space).
 * @param {string} src @param {number} row @param {number} col
 */
export function offsetAt(src, row, col) {
  if (row < 0 || col < 0) return -1;
  let start = 0;
  for (let r = 0; r < row; r++) {
    const nl = src.indexOf('\n', start);
    if (nl < 0) return -1;
    start = nl + 1;
  }
  const end = src.indexOf('\n', start);
  const stop = end < 0 ? src.length : end;
  // Visual columns: tabs jump to the next multiple of 4 (tab-size of the editor)
  for (let i = start, v = 0; i < stop; i++) {
    const next = src[i] === '\t' ? (Math.floor(v / 4) + 1) * 4 : v + 1;
    if (col < next) return i;
    v = next;
  }
  return -1;
}
