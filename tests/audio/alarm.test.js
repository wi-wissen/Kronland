// Alarm calls on attacks (src/audio/barks.js): who calls, and never a wrong substitute bark.

import { describe, it, expect } from 'vitest';
import { BARKS, alarmRole, chooseBark } from '../../src/audio/barks.js';

describe('Alarm calls', () => {
  it('buildings and workers: a serf calls for the village; otherwise the hit figure', () => {
    expect(alarmRole({ kind: 'building' })).toBe('serf');
    expect(alarmRole({ kind: 'worker' })).toBe('serf');
    expect(alarmRole({ kind: 'unit' }, undefined, () => 'serfF')).toBe('serfF');
    expect(alarmRole({ kind: 'hero', hero: 'nelia' })).toBe('nelia');
    expect(alarmRole({ kind: 'leader' }, 'bow')).toBe('bow');
  });

  it('every voice role has alarm calls; without an alarm call no substitute from "move"', () => {
    for (const [role, set] of Object.entries(BARKS)) expect(set.alarm?.length, role).toBeGreaterThan(0);
    expect(chooseBark({ move: [{ de: 'x', en: 'x' }] }, 'alarm', () => 0)).toBe(null);
  });
});
