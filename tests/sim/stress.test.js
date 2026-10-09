// Stress test "swarm" (src/sim/missions/stress.js) and special map list.

import { describe, it, expect } from 'vitest';
import { createMissionSim } from '../../src/sim/missions/runtime.js';
import { getMission, SPECIAL_MAPS } from '../../src/sim/missions/registry.js';
import { STRESS_ID, BATTLES, WAVE_SECONDS } from '../../src/sim/missions/stress.js';
import { fogEnabled } from '../../src/sim/systems/vision.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { nearestEnemy, isEnemy, targetable, distTo } from '../../src/sim/systems/military.js';
import { COMBAT } from '../../src/sim/data/combat.js';
import { UNIT } from '../../src/sim/fixed.js';
import { ICONS } from '../../src/ui/icons/index.js';

const count = (sim) => { const c = {}; for (const e of sim.entities.values()) c[e.kind] = (c[e.kind] ?? 0) + 1; return c; };
const figures = (c) => (c.unit ?? 0) + (c.worker ?? 0) + (c.leader ?? 0) + (c.soldier ?? 0) + (c.hero ?? 0);

describe('Special maps', () => {
  it('are registered, bilingual and have a description', () => {
    expect(SPECIAL_MAPS.map((m) => m.id)).toEqual(['showcase', STRESS_ID]);
    for (const m of SPECIAL_MAPS) {
      expect(getMission(m.id)).toBe(m);
      for (const k of ['title', 'summary', 'briefing']) { expect(m[k].de, `${m.id}.${k}`).toBeTruthy(); expect(m[k].en, `${m.id}.${k}`).toBeTruthy(); }
      expect(ICONS[m.icon], `${m.id}: Symbol ${m.icon}`).toBeTruthy();
    }
  });
});

describe('Swarm', () => {
  const sim = createMissionSim(STRESS_ID);
  const st = sim.mission.state;

  it('sets itself up without warnings: without fog, many buildings and over a thousand figures', () => {
    expect(st.warnings).toEqual([]);
    expect(fogEnabled(sim)).toBe(false);
    const c = count(sim);
    expect(c.building).toBeGreaterThanOrEqual(150);
    expect(figures(c)).toBeGreaterThanOrEqual(1000);
    for (let p = 0; p < 4; p++) expect([...sim.entities.values()].filter((e) => e.kind === 'building' && e.owner === p).length, `player ${p}`).toBeGreaterThanOrEqual(35);
    for (let i = 1; i <= BATTLES.length; i++) expect(st.refs[`battle${i}`]).toBeTruthy();
  });

  it('fights and gets reinforcements without the number of troops running away', () => {
    const s = createMissionSim(STRESS_ID);
    const before = figures(count(s));
    s.run((WAVE_SECONDS + 5) * 10);
    expect(s.mission.state.refs.waves).toBe(1);
    const c = count(s);
    // battles cost soldiers; waves and AI recruitment top up
    expect(figures(c)).toBeGreaterThan(before * 0.7);
    expect(figures(c)).toBeLessThan(before * 2);
    expect(s.mission.state.result ?? null).toBeNull();
  });

  it('is deterministic and survives saving/loading', () => {
    const a = createMissionSim(STRESS_ID), b = createMissionSim(STRESS_ID);
    expect(a.hash()).toBe(b.hash());
    a.run(200); b.run(200);
    expect(a.hash()).toBe(b.hash());
    const c = loadGame(JSON.parse(JSON.stringify(saveGame(a))));
    expect(c.hash()).toBe(a.hash());
    c.run(50); a.run(50);
    expect(c.hash()).toBe(a.hash());
  });

  it('fast enemy search yields the same targets as the simple version (mid-battle)', () => {
    const s = createMissionSim(STRESS_ID);
    s.run(300);
    // earlier, simple version of nearestEnemy as the yardstick
    const FIGHT = new Set(['leader', 'soldier', 'hero']);
    const combatant = (t) => FIGHT.has(t.kind) || t.kind === 'turret' || (t.kind === 'unit' && !!t.militia);
    const reference = (e, radius, opts) => {
      const C = COMBAT.gridCell * UNIT, p = e.kind === 'building' ? { x: (e.x * 2 + e.w) * 500, y: (e.y * 2 + e.h) * 500 } : { x: e.px, y: e.py };
      let best = null, bd = radius + 1, bestUnit = null, bdu = radius + 1;
      const seen = new Set();
      for (let cy = Math.floor((p.y - radius) / C); cy <= Math.floor((p.y + radius) / C); cy++) {
        for (let cx = Math.floor((p.x - radius) / C); cx <= Math.floor((p.x + radius) / C); cx++) {
          for (const t of s.grid.get(cy * 4096 + cx) ?? []) {
            if (seen.has(t.id)) continue;
            seen.add(t.id);
            if (!isEnemy(s, e.owner, t.owner) || !targetable(s, t)) continue;
            const isB = t.kind === 'building' || t.kind === 'trap';
            if (isB && !opts.buildings) continue;
            if (t.type === 'bridge') continue;
            if (!isB && !opts.units) continue;
            if (opts.fighters && !combatant(t)) continue;
            const d = distTo(e, t);
            if (d > radius) continue;
            if (!isB && d < bdu) { bdu = d; bestUnit = t; }
            if (d < bd) { bd = d; best = t; }
          }
        }
      }
      return bestUnit ?? best;
    };
    let found = 0, checked = 0;
    for (const e of s.entities.values()) {
      if (!['leader', 'soldier', 'hero'].includes(e.kind) && !(e.kind === 'building' && e.type === 'tower')) continue;
      for (const [r, opts] of [[9 * UNIT, { units: true, buildings: false }], [9 * UNIT, { units: true, buildings: true }], [9 * UNIT, { units: true, buildings: false, fighters: true }], [3000, { units: true, buildings: false }]]) {
        const a = nearestEnemy(s, e, r, opts), b = reference(e, r, opts);
        expect(a?.id ?? 0).toBe(b?.id ?? 0);
        checked++; if (a) found++;
      }
    }
    expect(checked).toBeGreaterThan(1000);
    expect(found).toBeGreaterThan(100);
  });
});
