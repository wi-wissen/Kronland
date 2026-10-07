import { describe, it, expect } from 'vitest';
import { escapeStep } from '../../src/game/escape.js';
import { buildSeconds, buildInfoRows, buildInfoReason } from '../../src/ui/hud/buildInfo.js';
import { BUILDINGS } from '../../src/sim/data/buildings.js';
import de from '../../src/i18n/de.js';
import en from '../../src/i18n/en.js';

describe('Escape steps back one level', () => {
  it('placing → build view → action bar → no selection', () => {
    expect(escapeStep({ placing: true, serfs: true, buildView: true, selected: true })).toBe('cancelPlacement');
    expect(escapeStep({ placing: false, serfs: true, buildView: true, selected: true })).toBe('actionBar');
    expect(escapeStep({ placing: false, serfs: true, buildView: false, selected: true })).toBe('deselect');
    expect(escapeStep({ placing: false, serfs: false, buildView: false, selected: false })).toBeNull();
  });
  it('other selections are cleared right away, regardless of the remembered view', () => {
    expect(escapeStep({ placing: false, serfs: false, buildView: true, selected: true })).toBe('deselect');
  });
});

describe('Build info strip', () => {
  it('build time: buildTime is seconds with one serf, n serfs share it, capped at the builder spots', () => {
    expect(buildSeconds(80, 1)).toBe(80);
    expect(buildSeconds(80, 4, 4)).toBe(20);
    expect(buildSeconds(80, 10, 4)).toBe(20);
    expect(buildSeconds(110, 4, 4)).toBe(28);
    expect(buildSeconds(20, 0)).toBe(20);
  });
  it('rows of the residence: time with 1 serf, with all builders, beds', () => {
    const d = BUILDINGS.residence, l = d.levels[0];
    const rows = buildInfoRows({ buildTime: l.buildTime, builders: d.builders, beds: l.beds });
    expect(rows).toEqual([
      ['time', 'binfo.timeOne', { s: l.buildTime }],
      ['serf', 'binfo.timeAll', { s: Math.ceil(l.buildTime / d.builders), n: d.builders }],
      ['bed', 'binfo.beds', { n: l.beds }],
    ]);
  });
  it('one builder spot: no second time row; workers with profession', () => {
    const rows = buildInfoRows({ buildTime: 20, builders: 1, workers: 3, prof: 'smith' });
    expect(rows.map((r) => r[1])).toEqual(['binfo.timeOne', 'binfo.workers']);
  });
  it('lock reason names where to research; lack of resources is no tech reason', () => {
    expect(buildInfoReason({ reason: { code: 'err.techMissing', params: { tech: 'construction' } }, researchAt: 'university' }))
      .toEqual({ tech: true, code: 'err.techMissing', params: { tech: 'construction' }, researchAt: 'university' });
    expect(buildInfoReason({ reason: 'err.notEnoughResources', researchAt: null })).toMatchObject({ tech: false, researchAt: null });
    expect(buildInfoReason({ reason: null })).toBeNull();
  });
  it('every buildable building has a short description in both languages', () => {
    for (const [id, b] of Object.entries(BUILDINGS)) {
      if (b.buildable === false) continue;
      for (const dict of [de, en]) expect(dict['bdesc.' + id] ?? null, id).not.toBeNull();
    }
  });
});

import { groupsWrap, buildMenuLayout } from '../../src/ui/hud/hudLayout.js';

describe('Build menu layout by available width', () => {
  it('groups wrap when one starts lower than the first', () => {
    expect(groupsWrap([100, 100, 100.5, 101, 100])).toBe(false);
    expect(groupsWrap([100, 100, 100, 100, 260])).toBe(true);
    expect(groupsWrap([])).toBe(false);
  });
  it('wide while everything fits side by side in two rows, tabs otherwise; phone always tabs', () => {
    expect(buildMenuLayout({ compact: false, wraps: false })).toBe('wide');
    expect(buildMenuLayout({ compact: false, wraps: true })).toBe('tabs');
    expect(buildMenuLayout({ compact: true, wraps: false })).toBe('tabs');
  });
  it('not measured yet: render wide so it can be measured', () => {
    expect(buildMenuLayout({ compact: false, wraps: null })).toBe('wide');
  });
});
