// One list of saves from device and account; the words of a save game row.
import { describe, it, expect } from 'vitest';
import { mergeSaves } from '../../src/ui/saves/merge.js';
import { builtinSeries, describeSave } from '../../src/library/model.js';
import { isUnlocked } from '../../src/ui/mission/progress.js';
import { defaultSaveName } from '../../src/save/format.js';
import { t, tr } from '../../src/i18n/index.js';

const e = (id, savedAt, extra = {}) => ({ id, name: id, savedAt, tick: 100, mission: 'c1', mode: 'mission', seed: 1, players: 2, ...extra });

describe('mergeSaves', () => {
  it('sorts newest first', () => {
    const rows = mergeSaves([e('a', '2026-10-01T10:00:00Z'), e('b', '2026-10-03T10:00:00Z')]);
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
    expect(rows.every((r) => r.device && !r.cloud)).toBe(true);
  });
  it('the same game on the device and in the account is one row', () => {
    const rows = mergeSaves([e('d1', '2026-10-01T10:00:00Z')], [e('c9', '2026-10-01T10:00:00Z'), e('c8', '2026-10-02T10:00:00Z')]);
    expect(rows).toHaveLength(2);
    const both = rows.find((r) => r.device);
    expect(both.cloud.id).toBe('c9');
    expect(rows.find((r) => !r.device).cloud.id).toBe('c8');
  });
  it('saves with another progress are different games', () => {
    expect(mergeSaves([e('a', '2026-10-01T10:00:00Z')], [e('b', '2026-10-01T10:00:00Z', { tick: 200 })])).toHaveLength(2);
  });
  it('two identical device saves stay two rows, a cloud copy joins only one', () => {
    const rows = mergeSaves([e('d1', '2026-10-01T10:00:00Z'), e('d2', '2026-10-01T10:00:00Z')], [e('c1', '2026-10-01T10:00:00Z')]);
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.cloud)).toHaveLength(1);
  });
  it('works without an account list', () => { expect(mergeSaves([])).toEqual([]); });
});

describe('describeSave', () => {
  const series = builtinSeries({ progress: { done: {}, tutorial: false }, running: new Set(), t, unlocked: isUnlocked });
  const io = { t: (k, p) => t(k, p, 'de'), tr: (x) => tr(x, 'de'), defaultName: (x) => defaultSaveName(x, (k, p) => t(k, p, 'de')) };
  it('names a campaign save by story, chapter and level', () => {
    const x = e('a', '2026-10-01T10:00:00Z', { mission: 'c3', tick: 100 });
    const d = describeSave({ ...x, name: io.defaultName(x) }, series, io);
    expect(d).toMatchObject({ kind: 'stories', title: 'Krone aus Eis', subtitle: 'Kapitel III · Das Wetterwerk' });
  });
  it('names a free game by opponents and map number, without technical words', () => {
    const free = { ...e('a', '2026-10-01T10:00:00Z'), mode: 'free', mission: null, seed: 60578, players: 3 };
    const d = describeSave({ ...free, name: io.defaultName(free) }, series, io);
    expect(d).toMatchObject({ kind: 'free', title: 'Freies Spiel', subtitle: '2 Gegner · Karte 60578' });
    const sub = (players) => { const x = { ...free, players }; return describeSave({ ...x, name: io.defaultName(x) }, series, io).subtitle; };
    expect(sub(2)).toMatch(/^1 Gegner/);
    expect(sub(1)).toMatch(/^Karte/);
  });
  it('a name the player typed becomes the title', () => {
    const d = describeSave(e('a', '2026-10-01T10:00:00Z', { mission: 'c1', name: 'Vor dem Angriff' }), series, io);
    expect(d).toMatchObject({ title: 'Vor dem Angriff', custom: true });
    expect(d.subtitle).toContain('Krone aus Eis');
  });
  it('an unknown mission (pack level) keeps its stored name', () => {
    expect(describeSave(e('a', 'x', { mission: 'pack-level', name: 'Mission pack-level – 0:10' }), series, io)).toMatchObject({ kind: 'level', title: 'Mission pack-level – 0:10' });
  });
});
