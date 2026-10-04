import { describe, it, expect } from 'vitest';
import { fitRound, toTile, groupBuildOptions, missing, softHyphens, selectionIcon, selectionPortrait, MAP_FILL } from '../../src/ui/hud/hudLayout.js';

describe('Runde Minikarte', () => {
  it('fits the map in the centre and converts pixels back to tiles', () => {
    const m = fitRound(200, 128, 128);
    expect(m.s * 128).toBeCloseTo(200 * MAP_FILL);
    expect(m.ox).toBeCloseTo(m.oy);
    expect(toTile(m, 100, 100)).toEqual({ x: 64, y: 64 });
    // edges are limited to the map
    expect(toTile(m, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(toTile(m, 200, 200)).toEqual({ x: 128, y: 128 });
  });

  it('aligns non-square maps to the longer edge', () => {
    const m = fitRound(100, 200, 100);
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
  });
});
