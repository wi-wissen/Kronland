// Moving lines in the code editor (Alt+↑/↓, key bar on phones) for Parsons tasks.
import { describe, it, expect } from 'vitest';
import { moveLines } from '../../src/ui/script/editText.js';

const apply = (text, r) => text.slice(0, r.from) + r.replacement + text.slice(r.to);

describe('moveLines', () => {
  const src = 'a = 1\nwhile x:\n    step()\nprint(a)\n';

  it('moves the caret line up and down, the caret goes along', () => {
    const at = src.indexOf('step');
    const up = moveLines(src, at, at, -1);
    expect(up.text).toBe('a = 1\n    step()\nwhile x:\nprint(a)\n');
    expect(up.text.slice(up.start, up.start + 4)).toBe('step');
    expect(apply(src, up)).toBe(up.text);
    const down = moveLines(src, at, at, 1);
    expect(down.text).toBe('a = 1\nwhile x:\nprint(a)\n    step()\n');
    expect(down.text.slice(down.start, down.start + 4)).toBe('step');
    expect(apply(src, down)).toBe(down.text);
  });

  it('moves every selected line as a block', () => {
    const a = src.indexOf('while'), b = src.indexOf('()') + 1;
    const r = moveLines(src, a, b, -1);
    expect(r.text).toBe('while x:\n    step()\na = 1\nprint(a)\n');
    expect(r.text.slice(r.start, r.end)).toBe(src.slice(a, b));
    // A selection ending right after a line break does not take the next line
    const line = moveLines(src, 0, src.indexOf('while'), 1);
    expect(line.text).toBe('while x:\na = 1\n    step()\nprint(a)\n');
  });

  it('nothing to move at the edges; the final line break stays', () => {
    expect(moveLines(src, 0, 0, -1)).toBeNull();
    const last = src.indexOf('print');
    expect(moveLines(src, last, last, 1)).toBeNull();
    expect(moveLines('x\ny', 3, 3, 1)).toBeNull();
    expect(moveLines('x\ny', 3, 3, -1).text).toBe('y\nx');
  });
});
