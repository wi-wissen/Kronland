import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { PORTRAITS, IMAGE_ICONS, speakerPortrait } from '../../src/ui/icons/index.js';
import { SPEAKERS } from '../../src/sim/missions/speakers.js';
import { fitMap, toTile, groupBuildOptions, missing, softHyphens, selectionIcon, selectionPortrait, MAP_FILL, shortAmount, resBarWidth, topbarMode, pauseBannerVisible } from '../../src/ui/hud/hudLayout.js';

describe('Minimap', () => {
  it('fits the map in the centre and converts pixels back to tiles', () => {
    const m = fitMap(200, 128, 128);
    expect(m.s * 128).toBeCloseTo(200 * MAP_FILL);
    expect(m.ox).toBeCloseTo(m.oy);
    expect(toTile(m, 100, 100)).toEqual({ x: 64, y: 64 });
    // edges are limited to the map
    expect(toTile(m, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(toTile(m, 200, 200)).toEqual({ x: 128, y: 128 });
  });

  it('aligns non-square maps to the longer edge', () => {
    const m = fitMap(100, 200, 100);
    expect(m.s * 200).toBeCloseTo(100 * MAP_FILL);
    expect(m.oy).toBeGreaterThan(m.ox);
  });
});

describe('Build menu', () => {
  it('groups in a fixed order and omits empty groups', () => {
    const opts = [{ type: 'barracks', category: 'military' }, { type: 'residence', category: 'home' }, { type: 'farm', category: 'home' }];
    const g = groupBuildOptions(opts, ['home', 'raw', 'military']);
    expect(g.map((x) => x.id)).toEqual(['home', 'military']);
    expect(g[0].items.map((x) => x.type)).toEqual(['residence', 'farm']);
  });

  it('names only missing resources', () => {
    expect(missing([['wood', 200], ['clay', 150]], { wood: 100, clay: 500 })).toEqual({ wood: 200 });
    expect(missing(null, { wood: 1 })).toEqual({});
  });

  it('splits long building names at the word joint', () => {
    expect(softHyphens('Lehmgrube')).toBe('Lehm­grube');
    expect(softHyphens('Kanonengießerei')).toBe('Kanonen­gießerei');
    expect(softHyphens('Wohnhaus')).toBe('Wohnhaus');
    expect(softHyphens('Büchsenmacher')).toBe('Büchsen\u00admacher');
    expect(softHyphens('Büchsenmacherei')).toBe('Büchsen\u00admacherei');
    expect(softHyphens('Clay pit')).toBe('Clay pit');
    expect(softHyphens('Schmiede')).toBe('Schmiede');
  });
});

describe('Selection', () => {
  it('picks icon and portrait matching the selection', () => {
    expect(selectionIcon({ kind: 'building', type: 'farm' })).toBe('b-farm');
    expect(selectionIcon({ kind: 'army', heroes: [{ hero: 'orrin' }], groups: [] })).toBe('hero-orrin');
    expect(selectionIcon({ kind: 'foreign', entity: 'leader', unit: 'sword2' })).toBe('u-sword');
    expect(selectionPortrait({ kind: 'serfs' }, './')).toBe('./portraits/serf.webp');
    expect(selectionPortrait({ kind: 'building', type: 'farm' })).toBeNull();
    // heroes: painted portrait instead of drawn icon, also foreign ones
    expect(selectionPortrait({ kind: 'army', heroes: [{ hero: 'nelia' }], groups: [] }, './')).toBe('./portraits/hero-nelia.webp');
    expect(selectionPortrait({ kind: 'foreign', hero: 'malvor', owner: 1 }, '/')).toBe('/portraits/hero-malvor.webp');
  });
  it('knows portraits of the speakers in missions (narrator without)', () => {
    expect(speakerPortrait('orrin')).toBe('portraits/hero-orrin.webp');
    expect(speakerPortrait('kunz')).toBe('portraits/sp-bandit.webp');
    expect(speakerPortrait('herald')).toBe('portraits/sp-herald.webp');
    expect(speakerPortrait('narrator')).toBeNull();
    // every speaking figure has a painted portrait
    for (const id of Object.keys(SPEAKERS)) expect(speakerPortrait(id), id).not.toBeNull();
    expect(speakerPortrait(null)).toBeNull();
    for (const p of [...Object.values(PORTRAITS), ...Object.values(IMAGE_ICONS), 'portraits/sp-elder.webp', 'portraits/sp-herald.webp']) expect(existsSync(`public/${p}`), p).toBe(true);
  });
});

describe('Resource bar', () => {
  it('abbreviates large amounts from the limit and rounds down', () => {
    expect(shortAmount(500)).toBe('500');
    expect(shortAmount(9999)).toBe('9999');
    expect(shortAmount(10000)).toBe('10k');
    expect(shortAmount(12345)).toBe('12,3k');
    expect(shortAmount(12399)).toBe('12,3k');
    expect(shortAmount(50000)).toBe('50k');
    expect(shortAmount(99999)).toBe('99,9k');
    expect(shortAmount(123456)).toBe('123k');
    expect(shortAmount(2_345_678)).toBe('2,3M');
    expect(shortAmount(12345, { dec: '.' })).toBe('12.3k');
    expect(shortAmount(1500, { limit: 1000 })).toBe('1,5k');
    expect(shortAmount(-25000)).toBe('-25k');
    expect(shortAmount(undefined)).toBe('0');
  });

  it('distributes the entries over two rows and measures the columns', () => {
    const w = [60, 80, 70, 90, 50, 40];
    expect(resBarWidth(w, 2, 20, 1)).toBe(20 + 5 * 2 + 390);
    // columns: max(60,90) + max(80,50) + max(70,40)
    expect(resBarWidth(w, 2, 20, 2)).toBe(20 + 2 * 2 + 90 + 80 + 70);
    expect(resBarWidth([], 2, 20)).toBe(20);
  });

  it('keeps the crest in the row as long as possible', () => {
    const base = { gap: 2, pad: 20, sys: 200, crest: 460, barGap: 16 };
    expect(topbarMode({ ...base, widths: Array(6).fill(70), width: 1408 })).toBe('one');
    expect(topbarMode({ ...base, widths: Array(6).fill(95), width: 1408 })).toBe('two');
    expect(topbarMode({ ...base, widths: Array(6).fill(95), width: 900 })).toBe('tight');
  });
});

describe('pauseBannerVisible', () => {
  it('shows only for a pause by the player', () => {
    expect(pauseBannerVisible({ paused: true })).toBe(true);
    expect(pauseBannerVisible({ paused: false })).toBe(false);
    expect(pauseBannerVisible(null)).toBe(false);
  });
  it('hides behind game menu, crash, end screens and the script debugger', () => {
    expect(pauseBannerVisible({ paused: true }, { menuOpen: true })).toBe(false);
    expect(pauseBannerVisible({ paused: true }, { crash: { area: 'sim' } })).toBe(false);
    expect(pauseBannerVisible({ paused: true, gameOver: { won: true } })).toBe(false);
    expect(pauseBannerVisible({ paused: true, mission: { result: 'won' } })).toBe(false);
    expect(pauseBannerVisible({ paused: true, mission: { result: null } })).toBe(true);
    expect(pauseBannerVisible({ paused: true, halted: true })).toBe(false);
  });
});
