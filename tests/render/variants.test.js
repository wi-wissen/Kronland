// Variants (serf male/female), tool visibility per clip (without WebGL).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { pickVariant, variantRole, roleVariants, resolveRole, propClipNames, usedModels, clipNamesFor, lodFadeValues, LOD_FADE, maskFileFor, maskFiles, lodTransition, markerWeightSrgb } from '../../src/render/characters.js';

const manifest = JSON.parse(readFileSync(new URL('../../public/models/characters/manifest.json', import.meta.url), 'utf8'));

describe('pickVariant', () => {
  const two = [{ weight: 1 }, { weight: 1 }];
  it('is stable per ID', () => {
    for (let id = 1; id < 50; id++) expect(pickVariant(two, id)).toBe(pickVariant(two, id));
  });
  it('distributes roughly by weight', () => {
    const n = [0, 0];
    for (let id = 1; id <= 4000; id++) n[pickVariant(two, id)]++;
    expect(n[0] / 4000).toBeGreaterThan(0.45);
    expect(n[0] / 4000).toBeLessThan(0.55);
    const w = [0, 0];
    for (let id = 1; id <= 4000; id++) w[pickVariant([{ weight: 3 }, { weight: 1 }], id)]++;
    expect(w[0] / 4000).toBeGreaterThan(0.7);
    expect(w[0] / 4000).toBeLessThan(0.8);
  });
  it('consecutive IDs alternate (no block of the same variant)', () => {
    const seq = Array.from({ length: 20 }, (_, i) => pickVariant(two, 100 + i));
    expect(new Set(seq).size).toBe(2);
  });
  it('edge cases', () => {
    expect(pickVariant([], 5)).toBe(0);
    expect(pickVariant([{ weight: 0 }, { weight: 0 }], 5)).toBe(0);
    expect(pickVariant([{ weight: 0 }, { weight: 2 }], 7)).toBe(1);
  });
});

describe('variantRole / roleVariants', () => {
  const role = { variants: [{ model: 'M' }, { model: 'F' }], procedural: 'serf', tint: { color: '#fff' } };
  it('mixes the variant into the role', () => {
    expect(variantRole(role, 1).model).toBe('F');
    expect(variantRole(role, 1).tint.color).toBe('#fff');
    expect(variantRole(role, 3).model).toBe('F'); // index modulo count
  });
  it('takes the next available variant', () => {
    expect(variantRole(role, 1, (m) => m === 'M').model).toBe('M');
  });
  it('resolveRole returns the chosen variant, otherwise procedural', () => {
    const m = { roles: { serf: role } };
    expect(resolveRole(m, 'serf', () => true, 1).model).toBe('F');
    const r = resolveRole(m, 'serf', () => false, 1);
    expect(r.model).toBeNull();
    expect(r.procedural).toBe('serf');
  });
  it('also finds variants via more general keys', () => {
    const m = { roles: { serf: role, soldier: { model: 'K' } } };
    expect(roleVariants(m, 'serf.x')).toBe(role.variants);
    expect(roleVariants(m, 'soldier.bow')).toBeNull();
  });
  it('serfs in the manifest: male and female', () => {
    const v = roleVariants(manifest, 'serf');
    expect(v.map((x) => x.model)).toEqual(['Serf', 'SerfF']);
    expect(usedModels(manifest)).toEqual(expect.arrayContaining(['Serf', 'SerfF']));
    expect(clipNamesFor(manifest, 'SerfF')).toEqual(expect.arrayContaining(['chop', 'mine', 'hammer', 'walk']));
  });
});

describe('propClipNames', () => {
  it('assigns tools to the animation names', () => {
    const p = propClipNames({ Axe: ['chop'], Hammer: ['hammer', 'build'] }, { chop: 'Chop_A', hammer: 'Hit' });
    expect(p[0].part).toBe('Axe');
    expect([...p[0].names]).toEqual(['Chop_A']);
    expect([...p[1].names]).toEqual(['Hit']); // build without own clip
  });
  it('tools in the manifest belong to existing clips', () => {
    for (const [name, def] of Object.entries(manifest.models)) {
      for (const [part, keys] of Object.entries(def.props ?? {})) for (const k of keys) {
        expect(['build', ...Object.keys(def.clips)], `${name}.${part}`).toContain(k);
      }
    }
  });
});

describe('LOD levels: cross-fade and masks per level', () => {
  it('incoming and outgoing level share the pixels exactly (dither)', () => {
    for (const t of [0, 0.05, LOD_FADE / 2, LOD_FADE * 0.99]) {
      const [fin, fout] = lodFadeValues(t);
      expect(fin).toBeGreaterThan(0);
      expect(fin).toBeLessThan(1);
      expect(fout - 1).toBeCloseTo(fin, 9); // incoming: threshold < fin, outgoing: threshold ≥ fin
    }
    expect(lodFadeValues(LOD_FADE)).toEqual([1, 2]); // done: incoming full, outgoing empty
  });
  it('mesh change: both levels briefly, then only the new one – independent of animation changes', () => {
    const r = { meshLvl: -1, fadeT0: 0 };
    expect(lodTransition(r, 0, 1).from).toBe(-1);          // first frame: no cross-fade
    let t = lodTransition(r, 1, 2);                          // change near → game
    expect(t.from).toBe(0);
    expect(t.fin).toBeLessThan(1);
    r.fadeT0 = 2 + LOD_FADE * 2;                             // animation change sets fadeT0 – must not trigger anything
    t = lodTransition(r, 1, 2 + LOD_FADE * 2);
    expect(t.from).toBe(-1);
    expect(t.fin).toBe(1);
    t = lodTransition(r, 1, 10);
    expect(t.from).toBe(-1);                                 // stays finished
    r.meshLvl = -1;                                          // vanished from the frame → no cross-fade on reappearing
    expect(lodTransition(r, 0, 11).from).toBe(-1);
  });
  it('mask file per level (list, gaps inherit the level before)', () => {
    const def = { mask: ['a.png', 'b.png'] };
    expect(maskFileFor(def, 0)).toBe('a.png');
    expect(maskFileFor(def, 1)).toBe('b.png');
    expect(maskFileFor(def, 3)).toBe('b.png');
    expect(maskFileFor({ mask: 'x.png' }, 2)).toBe('x.png');
    expect(maskFileFor({}, 0)).toBeNull();
    expect(maskFiles({ mask: ['a.png', 'a.png', null, 'c.png'] })).toEqual(['a.png', 'c.png']);
  });
});

describe('markerWeightSrgb (team colour from magenta)', () => {
  it('recognises magenta and Meshy-shaded magenta, not skin, lips, leather', () => {
    expect(markerWeightSrgb(255, 0, 255)).toBe(1);
    expect(markerWeightSrgb(200, 30, 170)).toBe(1);
    expect(markerWeightSrgb(230, 160, 125)).toBe(0); // skin
    expect(markerWeightSrgb(170, 50, 50)).toBe(0);   // lips
    expect(markerWeightSrgb(120, 70, 40)).toBe(0);   // leather
    expect(markerWeightSrgb(40, 0, 40)).toBe(0);     // too dark
  });
});
