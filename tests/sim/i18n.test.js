// Dictionaries: same keys in all languages, no empty texts, all game data and
// rejection reasons translated, placeholders match.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import de from '../../src/i18n/de.js';
import en from '../../src/i18n/en.js';
import { t, tr, reasonText, buildingName } from '../../src/i18n/index.js';
import { BUILDINGS } from '../../src/sim/data/buildings.js';
import { TECHS } from '../../src/sim/data/technologies.js';
import { UNITS, LINES, HEROES } from '../../src/sim/data/units.js';
import { PROFESSIONS, BLESSINGS } from '../../src/sim/data/professions.js';
import { RESOURCES } from '../../src/sim/data/resources.js';
import { WEATHER_CYCLE, WEATHER_NAMES } from '../../src/sim/data/weather.js';
import { BUILDING_TECHS } from '../../src/sim/data/buildingTechs.js';
import { RANK_NAMES } from '../../src/sim/data/experience.js';
import { REASONS } from '../../src/sim/reasons.js';

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('Dictionaries', () => {
  it('de and en have the same keys', () => {
    const a = Object.keys(de).sort(), b = Object.keys(en).sort();
    expect(a.filter((k) => !(k in en))).toEqual([]);
    expect(b.filter((k) => !(k in de))).toEqual([]);
  });

  it('no empty values', () => {
    for (const d of [de, en]) {
      for (const [k, v] of Object.entries(d)) {
        expect(typeof v, k).toBe('string');
        expect(v.trim().length, k).toBeGreaterThan(0);
      }
    }
  });

  it('placeholders match in both languages', () => {
    for (const k of Object.keys(de)) expect(placeholders(en[k]), k).toEqual(placeholders(de[k]));
  });

  it('all game data have names', () => {
    const keys = [
      ...Object.entries(BUILDINGS).flatMap(([id, b]) => b.levels.map((_, i) => `building.${id}.${i}`)),
      ...Object.keys(BUILDINGS).map((id) => `bdesc.${id}`),
      ...Object.keys(TECHS).map((id) => `tech.${id}`),
      ...Object.keys(UNITS).map((id) => `unit.${id}`),
      ...Object.keys(LINES).map((id) => `line.${id}`),
      ...Object.keys(PROFESSIONS).map((id) => `prof.${id}`),
      ...Object.keys(BLESSINGS).map((id) => `blessing.${id}`),
      ...Object.keys(HEROES).map((id) => `hero.${id}.title`),
      ...Object.values(HEROES).flatMap((h) => Object.keys(h.abilities).map((a) => `ability.${a}`)),
      ...RESOURCES.map((r) => `res.${r}`),
      ...new Set(WEATHER_CYCLE.map(([w]) => `weather.${w}`)),
      ...Object.keys(WEATHER_NAMES).map((w) => `weather.${w}`),
      ...Object.keys(BUILDING_TECHS).flatMap((id) => [`tech.${id}`, `tdesc.${id}`]),
      ...RANK_NAMES.map((_, i) => `rank.${i}`),
    ];
    expect(keys.filter((k) => !(k in de))).toEqual([]);
  });

  it('German data names match the data files', () => {
    for (const [id, b] of Object.entries(BUILDINGS)) b.levels.forEach((l, i) => expect(de[`building.${id}.${i}`]).toBe(l.name));
    for (const tech of Object.values(TECHS)) expect(de[`tech.${tech.id}`]).toBe(tech.name);
    for (const u of Object.values(UNITS)) expect(de[`unit.${u.id}`]).toBe(u.name);
    for (const tech of Object.values(BUILDING_TECHS)) {
      expect(de[`tech.${tech.id}`]).toBe(tech.name);
      expect(de[`tdesc.${tech.id}`]).toBe(tech.desc);
    }
    RANK_NAMES.forEach((n, i) => expect(de[`rank.${i}`]).toBe(n));
    for (const [w, n] of Object.entries(WEATHER_NAMES)) expect(de[`weather.${w}`]).toBe(n);
    for (const [id, p] of Object.entries(PROFESSIONS)) expect(de[`prof.${id}`]).toBe(p.name);
  });

  it('rejection reasons of the game systems (reasons.js) are codes and translated', () => {
    for (const [k, code] of Object.entries(REASONS)) {
      expect(code, k).toMatch(/^err\.\w+$/);
      expect(code in de && code in en, code).toBe(true);
    }
  });

  it('game systems return no German texts as a rejection reason', () => {
    // check…() functions return codes, no sentence strings or template strings
    for (const f of ['techs.js', 'market.js', 'weather.js', 'damage.js']) {
      const src = readFileSync(join('src/sim/systems', f), 'utf8');
      expect(src, f).not.toMatch(/return\s+[`'"][A-ZÄÖÜ]/);
      expect(src, f).not.toMatch(/reject\([^)]*['`"][A-ZÄÖÜ]/);
    }
  });

  it('every rejection reason in the sim code is translated', () => {
    const dirs = ['src/sim', 'src/sim/systems', 'src/sim/missions', 'src/game', 'src/ui/hud', 'src/ui/hud/systems'];
    const codes = new Set();
    for (const dir of dirs) {
      for (const f of readdirSync(dir)) {
        if (!/\.(js|vue)$/.test(f)) continue;
        const src = readFileSync(join(dir, f), 'utf8');
        for (const m of src.matchAll(/'(err\.\w+)'/g)) codes.add(m[1]);
        for (const m of src.matchAll(/'(toast\.\w+)'/g)) codes.add(m[1]);
      }
    }
    expect(codes.size).toBeGreaterThan(30);
    expect([...codes].filter((c) => !(c in de) || !(c in en))).toEqual([]);
  });

  it('t, tr and reasonText', () => {
    expect(t('err.popLimit', null, 'de')).toBe('Bevölkerungslimit erreicht');
    expect(t('err.popLimit', null, 'en')).toBe('Population limit reached');
    expect(t('does.not.exist')).toBe('does.not.exist');
    expect(tr({ de: 'Hallo {n}', en: 'Hi {n}' }, 'en', { n: 2 })).toBe('Hi 2');
    expect(tr('fertig')).toBe('fertig');
    expect(reasonText({ code: 'err.techFirst', params: { tech: 'education' } })).toMatch(/Bildung|Education/);
    expect(buildingName('residence', 1)).toMatch(/Wohnhaus|Residence/);
    // unknown buildings of other modules: German name from the data
    expect(buildingName('doesNotExist')).toBe('doesNotExist');
  });
});
