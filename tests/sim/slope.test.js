// Building on a slope: levelling in the simulation (docs/SPIELREGELN.md §6a).
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { WATER, OCCUPIED, RESERVED, CLIFF } from '../../src/sim/map.js';
import { BALANCE } from '../../src/sim/data/balance.js';
import { BUILDINGS } from '../../src/sim/data/buildings.js';
import { padHeight, padPreview, levelSite } from '../../src/sim/systems/terrain.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { generateMap } from '../../src/sim/mapgen.js';

/** Search a building site for `type` with a height difference in [lo, hi] (deterministic, row by row). */
function findSite(sim, type, lo, hi, owner = 0) {
  const def = BUILDINGS[type], m = sim.map;
  for (let y = 2; y < m.height - def.h - 2; y++) for (let x = 2; x < m.width - def.w - 2; x++) {
    if (!m.rectFree(x - 1, y - 1, def.w + 2, def.h + 2, WATER | OCCUPIED | RESERVED | CLIFF)) continue;
    const s = m.slope(x, y, def.w, def.h);
    if (s < lo || s > hi) continue;
    return { x, y, slope: s };
  }
  return null;
}

const rich = (sim, owner = 0) => { for (const r of Object.keys(sim.players[owner].stock)) sim.players[owner].stock[r] = 100000; };
const footprint = (m, x, y, w, h) => { const out = []; for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) out.push(m.heights[m.idx(i, j)]); return out; };

describe('Building on a slope', () => {
  it('target height is the rounded mean, preview changes nothing', () => {
    const sim = new Sim({ seed: 42 });
    const site = findSite(sim, 'residence', 150, BALANCE.maxSlope);
    expect(site).not.toBeNull();
    const before = footprint(sim.map, site.x, site.y, 3, 3);
    const mean = before.reduce((a, b) => a + b, 0) / before.length;
    const t = padHeight(sim.map, site.x, site.y, 3, 3);
    expect(Number.isInteger(t)).toBe(true);
    expect(Math.abs(t - mean)).toBeLessThanOrEqual(0.5);
    const pv = padPreview(sim.map, site.x, site.y, 3, 3);
    expect(pv.target).toBe(t);
    expect(pv.slope).toBe(site.slope);
    expect(pv.maxCut).toBeGreaterThan(0);
    expect(footprint(sim.map, site.x, site.y, 3, 3)).toEqual(before);
  });

  it('construction site levels the area, edge blends over, flags stay', () => {
    const sim = new Sim({ seed: 42 });
    rich(sim);
    const site = findSite(sim, 'residence', 150, BALANCE.maxSlope);
    const m = sim.map;
    const t = padHeight(m, site.x, site.y, 3, 3);
    const flags = m.flags.slice();
    const ring = [];
    for (let j = site.y - 1; j <= site.y + 3; j++) for (let i = site.x - 1; i <= site.x + 3; i++) {
      if (i >= site.x && i < site.x + 3 && j >= site.y && j < site.y + 3) continue;
      ring.push([m.idx(i, j), m.heights[m.idx(i, j)]]);
    }
    const hv = m.heightVersion;
    const ev = sim.step([{ type: 'placeBuilding', player: 0, building: 'residence', x: site.x, y: site.y }]);
    expect(ev.find((e) => e.type === 'buildingPlaced')).toBeTruthy();
    const tc = ev.find((e) => e.type === 'terrainChanged');
    expect(tc).toEqual({ type: 'terrainChanged', x: site.x - 1, y: site.y - 1, w: 5, h: 5 });
    expect(m.slope(site.x, site.y, 3, 3)).toBe(0);
    expect(m.heights[m.idx(site.x, site.y)]).toBe(t);
    expect(m.heightVersion).toBe(hv + 1);
    // edge: lies between old height and target height (or unchanged)
    for (const [k, old] of ring) {
      const now = m.heights[k];
      expect(Math.min(old, t) <= now && now <= Math.max(old, t)).toBe(true);
    }
    // water/cliff never change; only OCCUPIED is added
    for (let k = 0; k < flags.length; k++) expect(m.flags[k] & (WATER | CLIFF | RESERVED)).toBe(flags[k] & (WATER | CLIFF | RESERVED));
  });

  it('too steep area is rejected (err.tooSteep), heights stay', () => {
    const sim = new Sim({ seed: 42 });
    rich(sim);
    const site = findSite(sim, 'farm', BALANCE.maxSlope + 1, 99999);
    expect(site).not.toBeNull();
    const before = sim.map.heights.slice();
    const ev = sim.step([{ type: 'placeBuilding', player: 0, building: 'farm', x: site.x, y: site.y }]);
    expect(ev.find((e) => e.type === 'rejected')?.reason).toBe('err.tooSteep');
    expect(sim.map.heights).toEqual(before);
  });

  it('limit applies exactly at BALANCE.maxSlope', () => {
    const sim = new Sim({ seed: 42 });
    rich(sim);
    const site = findSite(sim, 'tower', 0, 99999);
    const m = sim.map;
    sim.players[0].techs.add('construction');
    // artificial slope: allowed exactly at the limit, 1 cm above not
    const set = (d) => { const b = m.heights[m.idx(site.x, site.y)]; m.heights[m.idx(site.x + 1, site.y + 1)] = b + d; m.heights[m.idx(site.x + 1, site.y)] = b; m.heights[m.idx(site.x, site.y + 1)] = b; };
    set(BALANCE.maxSlope);
    expect(sim.checkPlacement(0, 'tower', site.x, site.y)).toBeNull();
    set(BALANCE.maxSlope + 1);
    expect(sim.checkPlacement(0, 'tower', site.x, site.y)).toBe('err.tooSteep');
  });

  it('foundation stays level after demolition and destruction', () => {
    const sim = new Sim({ seed: 42 });
    rich(sim);
    const site = findSite(sim, 'residence', 150, BALANCE.maxSlope);
    sim.step([{ type: 'placeBuilding', player: 0, building: 'residence', x: site.x, y: site.y }]);
    const b = [...sim.entities.values()].find((e) => e.kind === 'building' && e.x === site.x && e.y === site.y);
    const flat = footprint(sim.map, site.x, site.y, 3, 3);
    sim.step([{ type: 'demolish', player: 0, building: b.id }]);
    expect(sim.entities.has(b.id)).toBe(false);
    expect(footprint(sim.map, site.x, site.y, 3, 3)).toEqual(flat);
    // build again: already level, no change, no event
    const ev = sim.step([{ type: 'placeBuilding', player: 0, building: 'residence', x: site.x, y: site.y }]);
    expect(ev.find((e) => e.type === 'buildingPlaced')).toBeTruthy();
    expect(footprint(sim.map, site.x, site.y, 3, 3)).toEqual(flat);
    // destruction (ruin) does not change the heights either
    const b2 = [...sim.entities.values()].find((e) => e.kind === 'building' && e.x === site.x && e.y === site.y);
    const hBefore = sim.map.heights.slice();
    sim.destroyBuilding(b2);
    expect(sim.map.heights).toEqual(hBefore);
  });

  it('neighbouring foundations and reserved spots stay unchanged', () => {
    const sim = new Sim({ seed: 7 });
    rich(sim);
    const m = sim.map;
    // remember every existing building and every reserved spot
    const keep = new Map();
    for (let k = 0; k < m.flags.length; k++) if (m.flags[k] & (OCCUPIED | RESERVED)) keep.set(k, m.heights[k]);
    // build many houses close together on slopes (directly adjacent allowed)
    let placed = 0;
    for (let y = 2; y < m.height - 5 && placed < 25; y += 3) for (let x = 2; x < m.width - 5 && placed < 25; x += 3) {
      if (sim.checkPlacement(0, 'residence', x, y)) continue;
      if (m.slope(x, y, 3, 3) < 100) continue;
      // tiles that already belong to a foundation must not change
      for (let k = 0; k < m.flags.length; k++) if ((m.flags[k] & (OCCUPIED | RESERVED)) && !keep.has(k)) keep.set(k, m.heights[k]);
      sim.step([{ type: 'placeBuilding', player: 0, building: 'residence', x, y }]);
      placed++;
      for (const [k, h] of keep) expect(m.heights[k]).toBe(h);
    }
    expect(placed).toBeGreaterThan(5);
    // all building areas are level
    for (const e of sim.entities.values()) if (e.kind === 'building') expect(m.slope(e.x, e.y, e.w, e.h)).toBe(0);
  });

  it('edge changes no water, cliff, tree or reserved tiles', () => {
    const sim = new Sim({ seed: 99 });
    const m = sim.map;
    // search an area whose edge contains such tiles
    let site = null;
    for (let y = 2; y < m.height - 5 && !site; y++) for (let x = 2; x < m.width - 5 && !site; x++) {
      if (!m.rectFree(x, y, 3, 3) || m.slope(x, y, 3, 3) > BALANCE.maxSlope) continue;
      let n = 0;
      for (let j = y - 1; j <= y + 3; j++) for (let i = x - 1; i <= x + 3; i++) if (m.flags[m.idx(i, j)] & (WATER | CLIFF | OCCUPIED | RESERVED)) n++;
      if (n >= 3 && padHeight(m, x, y, 3, 3) !== m.heights[m.idx(x, y)]) site = { x, y };
    }
    expect(site).not.toBeNull();
    const fixed = [];
    for (let j = site.y - 1; j <= site.y + 3; j++) for (let i = site.x - 1; i <= site.x + 3; i++) {
      const k = m.idx(i, j);
      if (m.flags[k] & (WATER | CLIFF | OCCUPIED | RESERVED)) fixed.push([k, m.heights[k]]);
    }
    levelSite(sim, site.x, site.y, 3, 3);
    for (const [k, h] of fixed) expect(m.heights[k]).toBe(h);
  });

  it('deterministic: two runs, same hash; heights go into the hash', () => {
    const run = () => {
      const sim = new Sim({ seed: 42 });
      rich(sim);
      const cmds = [];
      const a = findSite(sim, 'residence', 150, BALANCE.maxSlope);
      cmds.push({ type: 'placeBuilding', player: 0, building: 'residence', x: a.x, y: a.y });
      sim.step(cmds);
      sim.run(50);
      return sim;
    };
    const s1 = run(), s2 = run();
    expect(s1.hash()).toBe(s2.hash());
    const h = s1.hash();
    s1.map.heights[s1.map.idx(10, 10)] += 1;
    expect(s1.hash()).not.toBe(h);
  });

  it('save game: changed heights survive saving and loading', () => {
    const sim = new Sim({ seed: 42 });
    rich(sim);
    const site = findSite(sim, 'residence', 150, BALANCE.maxSlope);
    const fresh = generateMap(42, { size: 96, players: 2 }).map.heights;
    sim.step([{ type: 'placeBuilding', player: 0, building: 'residence', x: site.x, y: site.y }]);
    sim.run(20);
    let diff = 0;
    for (let k = 0; k < fresh.length; k++) if (fresh[k] !== sim.map.heights[k]) diff++;
    expect(diff).toBeGreaterThan(0);
    const loaded = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(loaded.map.heights).toEqual(sim.map.heights);
    expect(loaded.hash()).toBe(sim.hash());
    const next = findSite(sim, 'residence', 150, BALANCE.maxSlope);
    const cmd = { type: 'placeBuilding', player: 0, building: 'residence', x: next.x, y: next.y };
    sim.step([cmd]); loaded.step([{ ...cmd }]);
    sim.run(30); loaded.run(30);
    expect(loaded.hash()).toBe(sim.hash());
  });

  it('map generation and missions use BALANCE.maxSlope (no own limits)', async () => {
    const fs = await import('node:fs');
    for (const f of ['src/sim/mapgen.js', 'src/sim/missions/setupApi.js', 'src/sim/sim.js']) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src).not.toMatch(/slope\([^)]*\)\s*>\s*\d/);
    }
  });
});
