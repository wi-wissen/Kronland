// Sex of the drawn figure (src/render/variants.js): one source for rendering, selection panel and voice.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { pickVariant, roleVariants, figureRole, figureVariant, figureSex } from '../../src/render/variants.js';
import { UNITS, LINES } from '../../src/sim/data/units.js';
import { PROFESSIONS } from '../../src/sim/data/professions.js';
import de from '../../src/i18n/de.js';
import en from '../../src/i18n/en.js';
import { sexKey, profName, setLang } from '../../src/i18n/index.js';
import { selectionPortrait, serfsTitle, foreignName, serfsSex, WORKER_PORTRAITS } from '../../src/ui/hud/hudLayout.js';

const manifest = JSON.parse(readFileSync(new URL('../../public/models/characters/manifest.json', import.meta.url), 'utf8'));
const variantRoles = Object.entries(manifest.roles).filter(([, r]) => r.variants?.length);

describe('figureSex', () => {
  it('every role with variants has exactly one male and one female', () => {
    expect(variantRoles.length).toBeGreaterThan(10);
    for (const [k, r] of variantRoles) expect(r.variants.map((v) => v.sex).sort(), k).toEqual(['f', 'm']);
  });
  it('follows the variant the rendering picks (pickVariant via the ID)', () => {
    const list = roleVariants(manifest, 'serf');
    for (let id = 1; id < 200; id++) {
      const i = pickVariant(list, id);
      expect(figureVariant(manifest, 'serf', id).index).toBe(i);
      expect(figureSex(manifest, 'serf', id)).toBe(list[i].model === 'SerfF' ? 'f' : 'm');
    }
  });
  it('is deterministic and mixed', () => {
    const a = Array.from({ length: 60 }, (_, i) => figureSex(manifest, 'worker.smith', 10 + i));
    const b = Array.from({ length: 60 }, (_, i) => figureSex(manifest, 'worker.smith', 10 + i));
    expect(a).toEqual(b);
    expect(new Set(a)).toEqual(new Set(['m', 'f']));
  });
  it('roles without variants: the role sex field, otherwise male; without manifest male', () => {
    expect(figureSex(manifest, 'hero.nelia', 1)).toBe('f');
    expect(figureSex(manifest, 'hero.orrin', 1)).toBe('m');
    expect(figureSex(manifest, 'soldier.sword.leader', 3)).toBe('m');
    expect(figureSex(null, 'serf', 3)).toBe('m');
  });
  it('figureRole: role as in the rendering', () => {
    expect(figureRole({ kind: 'unit' })).toBe('serf');
    expect(figureRole({ kind: 'unit', militia: true })).toBe('soldier.spear');
    expect(figureRole({ kind: 'worker', prof: 'farmer' })).toBe('worker.farmer');
    expect(figureRole({ kind: 'leader', def: 'bow1', owner: 0 }, [{}], UNITS)).toBe('soldier.bow.leader');
    expect(figureRole({ kind: 'soldier', def: 'bow1', owner: 1 }, [{}, { neutral: true }], UNITS)).toBe('bandit.bow');
    expect(figureRole({ kind: 'soldier', def: 'sword1', owner: 1 }, [{}, { neutral: true, soldierLook: true }], UNITS)).toBe('soldier.sword');
  });
});

describe('Names and portraits by sex', () => {
  it('female names for every role with a female variant, in de and en', () => {
    const keys = ['serfs.one', 'foreign.serf', 'foreign.worker', 'foreign.soldier', 'foreign.hero',
      ...Object.keys(PROFESSIONS).map((p) => `prof.${p}`),
      ...Object.keys(LINES).map((l) => `figure.${l}`), 'figure.bandit', 'figure.banditBow'];
    for (const k of keys) for (const d of [de, en]) {
      expect(d[k], k).toBeTruthy();
      expect(d[`${k}.f`], `${k}.f`).toBeTruthy();
    }
    // every profession role with variants has a profession with a female name
    for (const [k] of variantRoles) if (k.startsWith('worker.')) expect(de[`prof.${k.slice(7)}.f`], k).toBeTruthy();
    expect(de['serfs.one.f']).toBe('1 Leibeigene');
    expect(de['figure.sword.f']).toBe('Schwertkämpferin');
  });
  it('sexKey / profName', () => {
    setLang('de');
    expect(sexKey('foreign.serf', 'f')).toBe('foreign.serf.f');
    expect(sexKey('foreign.serf', 'm')).toBe('foreign.serf');
    expect(sexKey('foreign.unit', 'f')).toBe('foreign.unit'); // no female form → base form
    expect(profName('farmer', 'f')).toBe('Bäuerin');
    expect(profName('farmer')).toBe('Bauer');
  });
  it('titles: one figure by sex, groups in the plural', () => {
    const t = (k, p) => (p ? `${k}:${p.n}` : k);
    expect(serfsTitle({ count: 1, sex: 'f' }, t)).toBe('serfs.one.f');
    expect(serfsTitle({ count: 1, sex: 'm' }, t)).toBe('serfs.one');
    expect(serfsTitle({ count: 3, female: 1, sex: null }, t)).toBe('serfs.count:3');
    const name = { prof: (p, s) => `P:${p}:${s}`, unit: (u) => 'U:' + u, hero: (h) => h };
    expect(foreignName({ entity: 'unit', sex: 'f' }, t, name)).toBe('foreign.serf.f');
    expect(foreignName({ entity: 'worker', prof: 'smith', sex: 'f' }, t, name)).toBe('P:smith:f');
    expect(foreignName({ entity: 'soldier', unit: 'sword1', figure: 'sword', sex: 'f' }, t, name)).toBe('figure.sword.f');
    expect(foreignName({ entity: 'leader', unit: 'sword1', sex: 'm' }, t, name)).toBe('U:sword1');
  });
  it('portrait matching the sex; mixed group: majority', () => {
    expect(selectionPortrait({ kind: 'serfs', count: 1, sex: 'f' }, '/')).toBe('/portraits/serf-f.webp');
    expect(selectionPortrait({ kind: 'serfs', count: 1, sex: 'm' }, '/')).toBe('/portraits/serf.webp');
    expect(serfsSex({ count: 3, female: 2, sex: null })).toBe('f');
    expect(serfsSex({ count: 4, female: 2, sex: null })).toBe('m');
    expect(selectionPortrait({ kind: 'foreign', entity: 'worker', owner: 0, prof: 'smith', sex: 'f' }, '/')).toBe('/portraits/worker-smith-f.webp');
    expect(selectionPortrait({ kind: 'foreign', entity: 'worker', owner: 0, prof: 'smith', sex: 'm' }, '/')).toBe('/portraits/worker-smith.webp');
    expect([...WORKER_PORTRAITS].sort()).toEqual(Object.keys(PROFESSIONS).sort());
    for (const f of ['serf', 'serf-f', ...WORKER_PORTRAITS.flatMap((p) => [`worker-${p}`, `worker-${p}-f`])]) {
      expect(existsSync(`public/portraits/${f}.webp`), f).toBe(true);
    }
  });
});
