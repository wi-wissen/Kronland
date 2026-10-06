import { describe, it, expect } from 'vitest';
import { buildStartLink, parseStartLink, normalizeFree, addressFor, shareUrl, cleanSeed } from '../../src/ui/startLink.js';
import { HERO_IDS } from '../../src/sim/data/units.js';

const strip = ({ noAssets: _n, ...rest }) => rest;

describe('Start links', () => {
  it('free game: canonical, readable query', () => {
    expect(buildStartLink({ kind: 'free', seed: 62921, difficulty: 'hard', players: 3, hero: 'orrin', fog: true }))
      .toBe('seed=62921&ai=hard&players=3&hero=orrin');
    expect(buildStartLink({ kind: 'free', seed: 5, difficulty: 'easy', players: 2, hero: 'nelia', fog: false }))
      .toBe('seed=5&ai=easy&players=2&hero=nelia&fog=off');
  });

  it('round trip for all combinations', () => {
    for (const difficulty of ['easy', 'normal', 'hard'])
      for (const players of [2, 3, 4])
        for (const hero of HERO_IDS)
          for (const fog of [true, false]) {
            const start = { kind: 'free', seed: 1 + players * 1000 + HERO_IDS.indexOf(hero), difficulty, players, hero, fog };
            expect(strip(parseStartLink('?' + buildStartLink(start)))).toEqual(start);
          }
    for (const m of [{ kind: 'mission', id: 'tutorial' }, { kind: 'mission', id: 'c3', seed: 77 }])
      expect(strip(parseStartLink(buildStartLink(m)))).toEqual(m);
  });

  it('mission: only id, seed only if given', () => {
    expect(buildStartLink({ kind: 'mission', id: 'c1' })).toBe('mission=c1');
    expect(buildStartLink({ kind: 'mission', id: 'c1', seed: 9 })).toBe('mission=c1&seed=9');
  });

  it('invalid values → default', () => {
    expect(strip(parseStartLink('?seed=abc&ai=extreme&players=9&hero=gandalf&fog=maybe'))).toEqual(
      { kind: 'free', seed: 1, difficulty: 'normal', players: 4, hero: 'nelia', fog: true });
    expect(strip(parseStartLink('?seed=-3&players=1'))).toMatchObject({ seed: 1, players: 2 });
    expect(parseStartLink('?seed=42&fog=off').fog).toBe(false);
    expect(parseStartLink('?seed=42&fog=0').fog).toBe(false);
    expect(parseStartLink('?seed=42&ai=hard').difficulty).toBe('hard');
    expect(parseStartLink('?seed=42&no-models').noAssets).toBe(true);
    expect(cleanSeed('1e3')).toBeUndefined();
    expect(cleanSeed('99999999999')).toBeUndefined();
  });

  it('no direct start without seed/mission; unknown mission', () => {
    expect(parseStartLink('')).toBeNull();
    expect(parseStartLink('?quality=low')).toBeNull();
    const has = (id) => id === 'c1';
    expect(parseStartLink('?mission=doesnotexist', { hasMission: has })).toBeNull();
    expect(parseStartLink('?mission=doesnotexist&seed=12', { hasMission: has })).toMatchObject({ kind: 'free', seed: 12 });
    expect(parseStartLink('?mission=c1&seed=x', { hasMission: has })).toEqual({ kind: 'mission', id: 'c1', noAssets: false });
  });

  it('normalizeFree fills in missing values', () => {
    expect(normalizeFree({})).toEqual({ kind: 'free', seed: 1, difficulty: 'normal', players: 2, hero: 'nelia', fog: true });
  });

  it('address bar keeps local parameters, link never', () => {
    expect(addressFor('/play/', '?quality=low&seed=3', 'seed=4&ai=normal&players=2&hero=nelia'))
      .toBe('/play/?seed=4&ai=normal&players=2&hero=nelia&quality=low');
    expect(addressFor('/play/', '?seed=3&no-models', null)).toBe('/play/?no-models');
    expect(addressFor('/play/', '?seed=3', null)).toBe('/play/');
    expect(shareUrl('https://example.org/kronland/play/?quality=low#x', 'mission=c1')).toBe('https://example.org/kronland/play/?mission=c1');
  });
});
