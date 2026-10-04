// Compendium: the tables are generated from the game data – every record must get an entry,
// even when new buildings/units/technologies are added.
import { describe, it, expect } from 'vitest';
import { wikiModel, cellText, anchor, slopeExample } from '../../src/site/compendium/generate.js';
import { BUILDINGS } from '../../src/sim/data/buildings.js';
import { UNITS, LINES, HEROES } from '../../src/sim/data/units.js';
import { TECHS } from '../../src/sim/data/technologies.js';
import { BUILDING_TECHS } from '../../src/sim/data/buildingTechs.js';
import { RESOURCES } from '../../src/sim/data/resources.js';
import { PROFESSIONS, BLESSINGS } from '../../src/sim/data/professions.js';
import { WEATHER_CYCLE, WEATHER_EFFECTS } from '../../src/sim/data/weather.js';
import { BALANCE } from '../../src/sim/data/balance.js';
import { BUILDING_TECHS as BT } from '../../src/sim/data/buildingTechs.js';
import { DIFFICULTY } from '../../src/ai/AiPlayer.js';
import { EXPERIENCE } from '../../src/sim/data/experience.js';
import { LABELS, KEYS, INTROS } from '../../src/site/compendium/texts.js';

/** All blocks (area and entries) of a model. */
const blocksOf = (m) => m.sections.flatMap((s) => [...s.blocks, ...s.entries.flatMap((e) => e.blocks)]);
const rowIds = (m) => new Set(blocksOf(m).filter((b) => b.type === 'table').flatMap((b) => b.rows.map((r) => r.id).filter(Boolean)));
const entryIds = (m) => new Set(m.sections.flatMap((s) => s.entries.map((e) => e.id)));
const section = (m, id) => m.sections.find((s) => s.id === id);

describe.each(['de', 'en'])('Compendium (%s)', (lang) => {
  const m = wikiModel(lang);
  const rows = rowIds(m);
  const entries = entryIds(m);

  it('has all areas with title and content', () => {
    const ids = m.sections.map((s) => s.id);
    expect(ids).toEqual(['buildings', 'units', 'heroes', 'techs', 'resources', 'economy', 'weather', 'experience', 'damage', 'market', 'vision', 'slope', 'ai', 'mapgen']);
    for (const s of m.sections) {
      expect(s.title, s.id).not.toMatch(/^sec\./);
      expect(s.blocks.length + s.entries.length, s.id).toBeGreaterThan(0);
      expect(s.intro, s.id).not.toMatch(/\{\{\w+\}\}/);
    }
  });

  it('every building: entry, overview row and one row per upgrade level', () => {
    for (const [type, def] of Object.entries(BUILDINGS)) {
      expect(entries.has(anchor.building(type)), type).toBe(true);
      expect(rows.has(`row-${type}`), type).toBe(true);
      const e = section(m, 'buildings').entries.find((x) => x.id === anchor.building(type));
      const levels = e.blocks.find((b) => b.type === 'table');
      expect(levels.rows.length, type).toBe(def.levels.length);
    }
    // overview in the order of the data, names translated
    const ov = section(m, 'buildings').blocks[0];
    expect(ov.rows.map((r) => r.id)).toEqual(Object.keys(BUILDINGS).map((t) => `row-${t}`));
  });

  it('every unit, troop type and every hero', () => {
    for (const id of Object.keys(UNITS)) expect(rows.has(anchor.unit(id)), id).toBe(true);
    for (const line of new Set([...Object.keys(LINES), ...Object.values(UNITS).map((u) => u.line)])) expect(entries.has(anchor.line(line)), line).toBe(true);
    for (const id of Object.keys(HEROES)) expect(entries.has(anchor.hero(id)), id).toBe(true);
    const matchups = blocksOf(m).find((b) => b.id === 'matchups');
    expect(matchups.rows.length).toBe(Object.keys(UNITS).length);
  });

  it('every technology (university and buildings)', () => {
    for (const id of [...Object.keys(TECHS), ...Object.keys(BUILDING_TECHS)]) expect(rows.has(anchor.tech(id)), id).toBe(true);
  });

  it('resources, professions, blessings, weather, experience, AI', () => {
    for (const r of RESOURCES) expect(rows.has(anchor.res(r)), r).toBe(true);
    for (const p of Object.keys(PROFESSIONS)) expect(rows.has(anchor.prof(p)), p).toBe(true);
    expect(blocksOf(m).find((b) => b.id === 'blessings').rows.length).toBe(Object.keys(BLESSINGS).length);
    expect(blocksOf(m).find((b) => b.id === 'weather-cycle').rows.length).toBe(WEATHER_CYCLE.length);
    expect(blocksOf(m).find((b) => b.id === 'ranks').rows.length).toBe(EXPERIENCE.thresholds.length + 1);
    expect(blocksOf(m).find((b) => b.id === 'ai-difficulty').cols.length).toBe(Object.keys(DIFFICULTY).length + 1);
  });

  it('no empty or broken cells, column count matches', () => {
    for (const b of blocksOf(m)) {
      if (b.type !== 'table') continue;
      for (const r of b.rows) {
        expect(r.cells.length, b.id ?? b.caption).toBe(b.cols.length);
        for (const c of r.cells) {
          const txt = cellText(c, m.names);
          expect(txt, `${b.id ?? b.caption}`).not.toMatch(/undefined|NaN|\[object|\{\{/);
        }
      }
    }
  });

  it('names come from i18n (no keys visible)', () => {
    const ov = section(m, 'buildings').blocks[0];
    for (const r of ov.rows) expect(cellText(r.cells[0], m.names)).not.toMatch(/^building\./);
    if (lang === 'en') expect(cellText(ov.rows.find((r) => r.id === 'row-residence').cells[0], m.names)).toBe('Residence');
  });

  it('internal links point to existing anchors', () => {
    const ids = new Set([...rows, ...entries, ...m.sections.map((s) => s.id)]);
    const hrefs = [];
    const walk = (c) => {
      if (!c || typeof c !== 'object') return;
      if (c.href) hrefs.push(c.href);
      if (c.list) c.list.forEach(walk);
    };
    for (const b of blocksOf(m)) {
      if (b.type === 'table') b.rows.forEach((r) => r.cells.forEach(walk));
      if (b.type === 'facts') b.items.forEach(([, c]) => walk(c));
      if (b.type === 'md') for (const [, h] of b.text.matchAll(/\]\((#[^)]+)\)/g)) hrefs.push(h);
    }
    expect(hrefs.length).toBeGreaterThan(50);
    for (const h of hrefs) expect(ids.has(h.slice(1)), h).toBe(true);
  });
});

describe('Wiki-Texte', () => {
  it('DE and EN have the same keys', () => {
    for (const T of [LABELS, KEYS, INTROS]) expect(Object.keys(T.en).sort()).toEqual(Object.keys(T.de).sort());
  });
});

describe('Compendium als HTML', () => {
  it('every table becomes HTML with row anchors, texts escaped', async () => {
    const { tableHtml, cellHtml } = await import('../../src/site/compendium/render.js');
    const m = wikiModel('de');
    let tables = 0;
    for (const b of blocksOf(m)) {
      if (b.type !== 'table') continue;
      tables++;
      const html = tableHtml(b, m.names);
      expect(html.match(/<tr/g).length).toBe(b.rows.length + 1);
      for (const r of b.rows) if (r.id) expect(html).toContain(`id="${r.id}"`);
    }
    expect(tables).toBeGreaterThan(50);
    expect(cellHtml({ t: '<b>', href: '#x' }, m.names)).toBe('<a href="#x" class="w-link">&lt;b&gt;</a>');
    expect(cellHtml({ cost: { gold: 5 } }, m.names)).toContain('<span class="num">5</span>');
  });
});

describe('Compendium: building on slopes and weather from the data', () => {
  it('worked example uses the levelling of the simulation', () => {
    const ex = slopeExample();
    expect(ex.preview.slope).toBeGreaterThan(0);
    expect(ex.preview.slope).toBeLessThanOrEqual(BALANCE.maxSlope);
    const at = (a, x, y) => a[y * ex.W + x];
    // footprint flat at the target height, mean of the area
    for (let y = 1; y <= ex.h; y++) for (let x = 1; x <= ex.w; x++) expect(at(ex.after, x, y)).toBe(ex.preview.target);
    // edge neighbour half, corner neighbour a quarter towards the target height
    expect(at(ex.after, 0, 1)).toBe(at(ex.before, 0, 1) + Math.trunc((ex.preview.target - at(ex.before, 0, 1)) / 2));
    expect(at(ex.after, 0, 0)).toBe(at(ex.before, 0, 0) + Math.trunc((ex.preview.target - at(ex.before, 0, 0)) / 4));
    const m = wikiModel('de');
    const sec = m.sections.find((x) => x.id === 'slope');
    expect(sec.intro).toContain(`${BALANCE.maxSlope} cm`);
    expect(sec.blocks.map((b) => b.id)).toEqual(['slope-rules', 'slope-before', 'slope-after']);
  });

  it('weather effects come from WEATHER_EFFECTS', () => {
    const m = wikiModel('de');
    const fx = blocksOf(m).find((b) => b.id === 'weather-effects');
    for (const st of Object.keys(WEATHER_EFFECTS)) expect(fx.rows.some((r) => r.cells[0].icon === `weather-${st}`), st).toBe(true);
    const rain = fx.rows.find((r) => r.cells[0].icon === 'weather-rain');
    expect(cellText(rain.cells[2], m.names)).toBe(`−${100 - WEATHER_EFFECTS.rain.rangedAttackPercent} %`);
    expect(m.sections.find((x) => x.id === 'units').intro).toContain(`−${100 - WEATHER_EFFECTS.rain.rangedAttackPercent} %`);
  });
});

describe('Compendium: new content appears without code changes', () => {
  // As after an add-on: building with a new number field and new placement, unit without attack/armour type,
  // new type, hero with a new ability, building technology, decorative building, weather condition.
  const add = () => {
    BUILDINGS.testTavern = { id: 'testTavern', w: 4, h: 3, placement: 'bridge', requires: 'trade',
      levels: [{ name: 'Testwirtshaus', cost: { wood: 300, gold: 100 }, buildTime: 90, hp: 900, guests: 6 }, { name: 'Testgasthof', cost: { stone: 200 }, buildTime: 60, hp: 1100, guests: 9 }] };
    BUILDINGS.testStatue = { id: 'testStatue', w: 2, h: 2, placement: 'free', motivationEffect: 7, levels: [{ name: 'Teststatue', cost: { stone: 400 }, buildTime: 50, hp: 500 }] };
    UNITS.testScout1 = { id: 'testScout1', name: 'Testkundschafter', line: 'testScout', tier: 1, hp: 120, speed: 260, pop: 1, leaderCost: { gold: 150 }, building: 'testTavern' };
    UNITS.testRifle1 = { id: 'testRifle1', name: 'Testbüchse', line: 'testRifle', tier: 1, attack: 20, armor: 1, hp: 150, soldierHp: 100, soldiers: 4, attackType: 'bullet', armorType: 'padded', range: 7000, cooldown: 30, speed: 180, pop: 1, leaderCost: { gold: 300, sulfur: 80 }, soldierCost: { gold: 60, sulfur: 30 }, building: 'testTavern' };
    HEROES.testHero = { name: 'Testheld', title: 'Prüferin', attack: 15, armor: 3, hp: 600, range: 6000, cooldown: 20, speed: 220,
      abilities: { testShot: { name: 'Testschuss', cooldown: 900, damage: 50, range: 8000 } } };
    BT.testTech = { id: 'testTech', name: 'Testforschung', building: 'testTavern', minLevel: 0, cost: { gold: 100 }, time: 60, effects: [{ target: 'units', lines: ['testRifle'], attack: 2 }] };
  };
  const remove = () => {
    delete BUILDINGS.testTavern; delete BUILDINGS.testStatue; delete UNITS.testScout1; delete UNITS.testRifle1; delete HEROES.testHero; delete BT.testTech;
  };

  it.each(['de', 'en'])('%s: entries, rows, no broken cells, column count', (lang) => {
    add();
    try {
      const m = wikiModel(lang);
      const rows = rowIds(m), entries = entryIds(m);
      expect(entries.has('b-testTavern')).toBe(true);
      expect(entries.has('b-testStatue')).toBe(true);
      expect(rows.has('row-testTavern')).toBe(true);
      expect(entries.has('u-testScout')).toBe(true);
      expect(entries.has('u-testRifle')).toBe(true);
      expect(rows.has('unit-testScout1')).toBe(true);
      expect(entries.has('h-testHero')).toBe(true);
      expect(rows.has('t-testTech')).toBe(true);
      // new number field as its own column
      const tav = section(m, 'buildings').entries.find((e) => e.id === 'b-testTavern');
      const lv = tav.blocks.find((b) => b.type === 'table');
      expect(lv.cols.some((c) => c.label === 'guests')).toBe(true);
      // decorative building appears under motivation
      expect(blocksOf(m).find((b) => b.id === 'ornaments').rows.some((r) => cellText(r.cells[0], m.names) === 'Teststatue')).toBe(true);
      for (const b of blocksOf(m)) {
        if (b.type !== 'table') continue;
        for (const r of b.rows) {
          expect(r.cells.length, b.id ?? b.caption).toBe(b.cols.length);
          for (const c of r.cells) expect(cellText(c, m.names), b.id ?? b.caption).not.toMatch(/undefined|NaN|\[object|\{\{|^(atk|arm|place)\./);
        }
      }
    } finally {
      remove();
    }
  });
});
