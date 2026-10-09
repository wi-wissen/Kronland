import { describe, it, expect } from 'vitest';
import { shownError, shownStatus, shownHints, consoleView, fileName, sourceFromFile } from '../../src/ui/script/panelState.js';

const err = (seq, section = 'player') => ({ seq, section, sline: 2, code: 'err.script.nameUnknown' });
const line = (seq, level, text, e = null) => ({ seq, level, text, ...(e ? { err: e } : {}) });

describe('Code panel: errors', () => {
  it('an error disappears once its section is edited', () => {
    const player = { status: 'error', error: err(5) };
    expect(shownError(player, {})).toBe(player.error);
    expect(shownError(player, { other: true })).toBe(player.error);
    expect(shownError(player, { player: true })).toBeNull();
    expect(shownStatus(player, {})).toBe('error');
    expect(shownStatus(player, { player: true })).toBe('idle');
    expect(shownError({ status: 'running', error: err(5) }, {})).toBeNull();
    expect(shownStatus(null, {})).toBe('idle');
  });
});

describe('Code panel: console', () => {
  const lines = [
    line(1, 'player', '', err(1)), // error of an earlier run
    line(2, 'player', 'old'),
    line(3, 'mission', 'mission says hi'),
    line(4, 'player', 'new'),
    line(5, 'player', '', err(5)),
  ];

  it('shows only the current run, errors not twice', () => {
    expect(consoleView(lines, { mode: 'adventure', since: 3, error: err(5), dirty: {} }).map((c) => c.seq)).toEqual([4]);
    // Error not (any more) in the box, e.g. a background task: stays in the console …
    expect(consoleView(lines, { mode: 'adventure', since: 3, error: null, dirty: {} }).map((c) => c.seq)).toEqual([4, 5]);
    // … until its section is edited: it is no longer in the program
    expect(consoleView(lines, { mode: 'adventure', since: 3, error: null, dirty: { player: true } }).map((c) => c.seq)).toEqual([4]);
  });

  it('mission output only in the world editor, old saves without since show everything', () => {
    expect(consoleView(lines, { mode: 'editor', since: 3, dirty: {} }).map((c) => c.seq)).toEqual([3, 4, 5]);
    expect(consoleView(lines, { mode: 'adventure', dirty: {} }).map((c) => c.seq)).toEqual([1, 2, 4, 5]);
    expect(consoleView(lines, { mode: 'adventure', dirty: {}, max: 1 }).map((c) => c.seq)).toEqual([5]);
  });
});

describe('Code panel: files', () => {
  it('safe .py file names', () => {
    expect(fileName('r1-2')).toBe('r1-2.py');
    expect(fileName('Größe & Weite!')).toBe('grosse-weite.py');
    expect(fileName('')).toBe('programm.py');
    expect(fileName(undefined)).toBe('programm.py');
  });

  it('opened text: BOM and Windows line ends removed, binary refused', () => {
    expect(sourceFromFile('﻿print(1)\r\nprint(2)\r')).toBe('print(1)\nprint(2)\n');
    expect(sourceFromFile('a\0b')).toBeNull();
  });
});

describe('Code panel: hints', () => {
  const hint = (seq, sline, section = 'player', code = 'script.hint.lookOnly') => ({ seq, sline, section, code, params: {}, level: section === 'player' ? 'player' : 'mission' });

  it('player hints with their lines; edited sections hide theirs (like errors)', () => {
    const script = { player: { hints: [hint(1, 4), hint(2, 7, 'player', 'script.hint.busyLoop')] } };
    const h = shownHints(script, { mode: 'adventure', dirty: {} });
    expect(h.list.map((x) => x.seq)).toEqual([1, 2]);
    expect(h.lines).toEqual({ player: [4, 7] });
    expect(h.more).toBe(0);
    expect(shownHints(script, { mode: 'adventure', dirty: { player: true } })).toEqual({ list: [], more: 0, lines: {} });
  });

  it('at most two boxes, the rest counted; all lines marked; duplicates once', () => {
    const script = { player: { hints: [hint(1, 2), hint(2, 3), hint(3, 5), hint(4, 2)] } };
    const h = shownHints(script, { mode: 'adventure', dirty: {} });
    expect(h.list.length).toBe(2);
    expect(h.more).toBe(1);
    expect(h.lines.player).toEqual([2, 3, 5]);
  });

  it('mission hints only in the world editor', () => {
    const script = { player: { hints: [] }, missionHints: [hint(9, 3, 'world')] };
    expect(shownHints(script, { mode: 'adventure', dirty: {} }).list).toEqual([]);
    expect(shownHints(script, { mode: 'editor', dirty: {} }).lines).toEqual({ world: [3] });
    expect(shownHints(null, { mode: 'editor', dirty: {} }).list).toEqual([]);
  });
});
