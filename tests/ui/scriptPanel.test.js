import { describe, it, expect } from 'vitest';
import { shownError, shownStatus, consoleView, fileName, sourceFromFile } from '../../src/ui/script/panelState.js';

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
    expect(fileName('adv1')).toBe('adv1.py');
    expect(fileName('Größe & Weite!')).toBe('grosse-weite.py');
    expect(fileName('')).toBe('programm.py');
    expect(fileName(undefined)).toBe('programm.py');
  });

  it('opened text: BOM and Windows line ends removed, binary refused', () => {
    expect(sourceFromFile('﻿print(1)\r\nprint(2)\r')).toBe('print(1)\nprint(2)\n');
    expect(sourceFromFile('a\0b')).toBeNull();
  });
});
