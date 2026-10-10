// "New" badge: recent and not opened; what was opened is remembered in the kv store.
import { describe, it, expect } from 'vitest';
import { daysBetween, isRecent, isNewEntry, createSeen, NEW_DAYS, todayString } from '../../src/net/seen.js';
import { memoryKv } from '../../src/net/kv.js';
import { parseCatalog } from '../../src/net/catalog.js';

describe('recent', () => {
  it('counts days between dates and rejects non-dates', () => {
    expect(daysBetween('2026-09-30', '2026-10-02')).toBe(2);
    expect(daysBetween('2026-02-27', '2026-03-01')).toBe(2);
    expect(daysBetween('yesterday', '2026-10-02')).toBeNaN();
    expect(daysBetween(undefined, '2026-10-02')).toBeNaN();
  });
  it('is recent from the day it was added up to NEW_DAYS later, never before', () => {
    expect(isRecent('2026-10-01', '2026-10-01')).toBe(true);
    expect(isRecent('2026-09-01', '2026-10-01')).toBe(true);
    expect(NEW_DAYS).toBe(30);
    expect(isRecent('2026-08-31', '2026-10-01')).toBe(false);
    expect(isRecent('2026-10-05', '2026-10-01')).toBe(false);
  });
  it('formats today as YYYY-MM-DD', () => {
    expect(todayString(new Date('2026-10-09T23:30:00Z'))).toBe('2026-10-09');
  });
});

describe('isNewEntry', () => {
  it('needs an added date and an unopened entry', () => {
    expect(isNewEntry({ id: 'a', added: '2026-10-01' }, {}, '2026-10-09')).toBe(true);
    expect(isNewEntry({ id: 'a', added: '2026-10-01' }, { a: true }, '2026-10-09')).toBe(false);
    expect(isNewEntry({ id: 'a' }, {}, '2026-10-09')).toBe(false);
    expect(isNewEntry({ id: 'a', added: '2025-01-01' }, {}, '2026-10-09')).toBe(false);
  });
});

describe('createSeen', () => {
  it('remembers opened entries across sessions', async () => {
    const kv = memoryKv().kv;
    const a = createSeen(kv);
    await a.load();
    expect(a.isNew({ id: 'p', added: '2026-10-08' }, '2026-10-09')).toBe(true);
    await a.mark('p');
    expect(a.isNew({ id: 'p', added: '2026-10-08' }, '2026-10-09')).toBe(false);
    const b = createSeen(kv);
    await b.load();
    expect(b.has('p')).toBe(true);
    expect(b.has('q')).toBe(false);
  });
  it('survives a broken store', async () => {
    const bad = { get: async () => { throw new Error('x'); }, set: async () => { throw new Error('x'); } };
    const s = createSeen(bad);
    await s.load();
    await s.mark('p');
    expect(s.has('p')).toBe(true);
  });
  it('ignores junk in the stored list', async () => {
    const s = createSeen({ get: async () => ['a', 3, null], set: async () => {} });
    await s.load();
    expect(s.has('a')).toBe(true);
    expect(Object.keys(s.state)).toEqual(['a']);
  });
});

describe('catalog fields', () => {
  const entry = (extra) => ({ id: 'x.y', title: { de: 'a', en: 'a' }, access: 'open', manifest: 'p.json', ...extra });
  const parse = (extra) => parseCatalog({ format: 'kronland-catalog', version: 1, packs: [entry(extra)] }, 'https://s.example/catalog.json');
  it('passes kind, difficulty, minutes and added through', () => {
    const p = parse({ kind: 'code', difficulty: 'hard', minutes: 45, added: '2026-10-01' }).packs[0];
    expect([p.kind, p.difficulty, p.minutes, p.added]).toEqual(['code', 'hard', 45, '2026-10-01']);
  });
  it('drops an entry with an invalid value instead of the whole catalog', () => {
    for (const bad of [{ difficulty: 'brutal' }, { kind: 'maps' }, { minutes: 0 }, { added: 'soon' }]) expect(parse(bad).packs).toHaveLength(0);
  });
  it('accepts entries without any of them', () => {
    expect(parse({}).packs).toHaveLength(1);
  });
});
