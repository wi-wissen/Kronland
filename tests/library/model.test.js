// Library model: built-in series, filters, status, buttons, recommended order.
import { describe, it, expect } from 'vitest';
import { builtinSeries, packSeries, filterSeries, facetCounts, countByKind, sortRecommended, nextLevel, locate, latestByMission, durationOf, actionOf, ago, roman } from '../../src/library/model.js';
import { isUnlocked } from '../../src/ui/mission/progress.js';
import { CAMPAIGN } from '../../src/sim/missions/registry.js';
import { t } from '../../src/i18n/index.js';

const build = (progress = { done: {}, tutorial: false }, running = new Set()) => builtinSeries({ progress, running, t, unlocked: isUnlocked });
const get = (list, id) => list.find((s) => s.id === id);

describe('built-in series', () => {
  it('has the three kinds', () => {
    const list = build();
    expect(countByKind(list)).toMatchObject({ first: 1, stories: 1 });
    expect(countByKind(list).code).toBeGreaterThanOrEqual(2);
    expect(get(list, 'campaign').count).toBe(CAMPAIGN.length);
  });
  it('knows difficulty and play time of every built-in level', () => {
    for (const s of build()) {
      expect(s.difficulty, s.id).toBeTruthy();
      expect(s.minutes, s.id).toBeGreaterThan(0);
      for (const l of s.levels) { expect(l.difficulty, l.id).toBeTruthy(); expect(l.minutes, l.id).toBeGreaterThan(0); }
    }
  });
  it('locks campaign chapters in order and unlocks the next after a win', () => {
    let c = get(build(), 'campaign');
    expect(c.levels.map((l) => l.state)).toEqual(['open', ...Array(CAMPAIGN.length - 1).fill('locked')]);
    c = get(build({ done: { c1: { best: 900 } }, tutorial: false }), 'campaign');
    expect(c.levels.slice(0, 3).map((l) => l.state)).toEqual(['done', 'open', 'locked']);
    expect(c.levels[0].best).toBe(900);
    expect(c.status).toBe('running');
    expect(c.doneCount).toBe(1);
  });
  it('a save game makes a level "running" with the continue button', () => {
    const c = get(build({ done: { c1: { best: 1 } } }, new Set(['c2'])), 'campaign');
    expect(c.levels[1].state).toBe('running');
    expect(actionOf(c.levels[1].state)).toBe('continue');
    expect(nextLevel(c.levels).id).toBe('c2');
  });
  it('maps states to buttons', () => {
    expect(['open', 'running', 'done', 'locked'].map(actionOf)).toEqual(['play', 'continue', 'again', null]);
  });
  it('tutorial counts as done from the progress flag', () => {
    expect(get(build({ done: {}, tutorial: true }), 'first-steps').status).toBe('done');
    expect(get(build(), 'first-steps').status).toBe('open');
  });
  it('locates a mission for the saves list', () => {
    const list = build();
    expect(locate('c3', list).series.id).toBe('campaign');
    expect(locate('c3', list).index).toBe(2);
    expect(locate('nope', list)).toBeNull();
  });
});

describe('filters', () => {
  const list = build();
  it('filters by kind, difficulty, duration, status and text', () => {
    expect(filterSeries(list, { kind: 'stories' }).map((s) => s.id)).toEqual(['campaign']);
    expect(filterSeries(list, { kind: 'all' })).toHaveLength(list.length);
    expect(filterSeries(list, { difficulty: ['easy'] }).every((s) => s.difficulty === 'easy')).toBe(true);
    expect(filterSeries(list, { duration: ['long'] }).every((s) => s.minutes >= 60)).toBe(true);
    expect(filterSeries(list, { status: ['done'] })).toHaveLength(0);
    expect(filterSeries(list, { query: 'krone' }, (x) => x.de).map((s) => s.id)).toEqual(['campaign']);
  });
  it('drops entries without a value when a filter on that value is active', () => {
    const packs = packSeries([{ id: 'a.b', title: { de: 'x', en: 'x' }, access: 'open', levels: 2 }, { id: 'a.c', title: { de: 'y', en: 'y' }, access: 'open', levels: 2, difficulty: 'easy', minutes: 20 }]);
    expect(filterSeries(packs, {}).length).toBe(2);
    expect(filterSeries(packs, { difficulty: ['easy'] }).map((s) => s.id)).toEqual(['a.c']);
    expect(filterSeries(packs, { duration: ['short'] }).map((s) => s.id)).toEqual(['a.c']);
  });
  it('counts per value without applying its own group', () => {
    const f = { difficulty: ['hard'], status: [] };
    const counts = facetCounts(list, f, 'difficulty', ['easy', 'normal', 'hard']);
    expect(counts.easy + counts.normal + counts.hard).toBeLessThanOrEqual(list.length);
    expect(counts.easy).toBe(list.filter((s) => s.difficulty === 'easy').length);
  });
  it('buckets play time', () => {
    expect([10, 29, 30, 59, 60, 600].map(durationOf)).toEqual(['short', 'short', 'medium', 'medium', 'long', 'long']);
    expect(durationOf(undefined)).toBeNull();
  });
});

describe('pack series', () => {
  const entries = [
    { id: 'a.one', title: { de: 'Eins', en: 'One' }, access: 'open', levels: 3, kind: 'code', added: '2026-10-01' },
    { id: 'a.two', title: { de: 'Zwei', en: 'Two' }, access: 'locked', levels: 2, link: 'https://x.example/' },
  ];
  it('takes kind from the entry, stories by default, and counts finished levels', () => {
    const s = packSeries(entries, { 'a.one/l1': 'h', 'a.one/l2': 'h', 'other/l1': 'h' });
    expect(s.map((x) => x.kind)).toEqual(['code', 'stories']);
    expect(s[0]).toMatchObject({ doneCount: 2, count: 3, status: 'running', source: 'pack' });
    expect(packSeries(entries, { 'a.one/l1': 1, 'a.one/l2': 1, 'a.one/l3': 1 })[0].status).toBe('done');
  });
  it('sorts running first, new next, locked last', () => {
    const s = packSeries(entries, { 'a.one/l1': 1 });
    const mixed = [...s, ...build().slice(0, 2)];
    const order = sortRecommended(mixed, (x) => x.id === 'first-steps').map((x) => x.id);
    expect(order[0]).toBe('a.one');
    expect(order.at(-1)).toBe('a.two');
    expect(order.indexOf('first-steps')).toBeLessThan(order.indexOf('campaign'));
  });
});

describe('helpers', () => {
  it('latest save per mission', () => {
    const m = latestByMission([{ mission: 'c1', savedAt: '2026-10-01T10:00:00Z', id: 'a' }, { mission: 'c1', savedAt: '2026-10-02T10:00:00Z', id: 'b' }, { mission: null, savedAt: '2026-10-03T00:00:00Z', id: 'c' }]);
    expect([...m.keys()]).toEqual(['c1']);
    expect(m.get('c1').id).toBe('b');
  });
  it('relative time', () => {
    const now = Date.parse('2026-10-09T12:00:00Z');
    expect(ago('2026-10-09T11:59:40Z', now).key).toBe('time.now');
    expect(ago('2026-10-09T11:48:00Z', now)).toEqual({ key: 'time.min', n: 12 });
    expect(ago('2026-10-09T09:00:00Z', now)).toEqual({ key: 'time.hour', n: 3 });
    expect(ago('2026-10-06T12:00:00Z', now)).toEqual({ key: 'time.day', n: 3 });
    expect(ago('2026-07-01T12:00:00Z', now).key).toBe('time.date');
    expect(ago('garbage', now).key).toBe('time.unknown');
  });
  it('roman numerals', () => { expect([1, 3, 6, 12].map(roman)).toEqual(['I', 'III', 'VI', '12']); });
});
