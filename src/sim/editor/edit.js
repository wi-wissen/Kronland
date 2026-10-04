// World editor tools as operations on a (non-running) simulation.
// Deterministic and without rendering: the UI calls applyEdit() and passes the returned
// events (terrainChanged, natureChanged, nodeDepleted) on to the renderer – as in the game.
//
// Water and rocks follow from the height (as in the map generator): below the water level there is water,
// very steep slopes are rocks. Hence raise/lower instead of "paint water".

import { WATER, CLIFF, OCCUPIED, RESERVED } from '../map.js';
import { CLIFF_SLOPE, PEAK_HEIGHT } from '../mapgen.js';
import { BALANCE } from '../data/balance.js';
import { RESOURCES } from '../data/resources.js';
import { isqrt } from '../fixed.js';
import { Sim } from '../sim.js';
import { terrainOf } from '../world.js';
import { playerSetupOf, scenarioToDef } from '../scripting/scenario.js';

export const TOOLS = ['raise', 'lower', 'flatten', 'smooth', 'water', 'land', 'forest', 'erase', 'pile', 'shaft', 'spot'];
export const MIN_H = -1500, MAX_H = 6000;

const hash = (x, y, s) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

/**
 * Apply a tool.
 * @param {import('../sim.js').Sim} sim
 * @param {{ tool: string, x: number, y: number, r?: number, strength?: number, res?: string, amount?: number, seed?: number }} op
 * @returns {{ events: any[], changed: boolean }}
 */
export function applyEdit(sim, op) {
  const m = sim.map;
  const r = Math.max(0, Math.min(12, Math.trunc(op.r ?? 2)));
  const cx = Math.trunc(op.x), cy = Math.trunc(op.y);
  const strength = Math.max(1, Math.min(400, Math.trunc(op.strength ?? 60)));
  const events = [];
  let changed = false;
  const tiles = [];
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if (!m.inBounds(x, y)) continue;
    const d2 = (x - cx) ** 2 + (y - cy) ** 2;
    if (d2 > r * r + r) continue;
    // Falloff towards the edge: centre 1024, edge ~0 (integers)
    const fall = r === 0 ? 1024 : Math.max(0, 1024 - Math.trunc(isqrt(d2 * 1048576) / (r + 1)));
    tiles.push({ x, y, k: m.idx(x, y), fall });
  }
  const building = (k) => (m.flags[k] & OCCUPIED) && sim.entities.get(m.owner[k])?.kind === 'building';
  const H = m.heights;

  switch (op.tool) {
    case 'raise': case 'lower': case 'water': case 'land': {
      for (const t of tiles) {
        if (building(t.k)) continue;
        let h = H[t.k];
        if (op.tool === 'raise') h += Math.trunc((strength * t.fall) / 1024);
        else if (op.tool === 'lower') h -= Math.trunc((strength * t.fall) / 1024);
        else if (op.tool === 'water') h = Math.min(h, sim.waterLevel - 160 - Math.trunc((120 * t.fall) / 1024));
        else h = Math.max(h, sim.waterLevel + 120);
        h = Math.max(MIN_H, Math.min(MAX_H, h));
        if (h !== H[t.k]) { H[t.k] = h; changed = true; }
      }
      break;
    }
    case 'flatten': {
      const target = H[m.idx(Math.max(0, Math.min(m.width - 1, cx)), Math.max(0, Math.min(m.height - 1, cy)))];
      for (const t of tiles) {
        if (building(t.k)) continue;
        const h = H[t.k] + Math.trunc(((target - H[t.k]) * Math.min(1024, t.fall * 2)) / 1024);
        if (h !== H[t.k]) { H[t.k] = h; changed = true; }
      }
      break;
    }
    case 'smooth': {
      const next = tiles.map((t) => {
        let sum = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!m.inBounds(t.x + dx, t.y + dy)) continue;
          sum += H[m.idx(t.x + dx, t.y + dy)]; n++;
        }
        const avg = Math.trunc(sum / n);
        return H[t.k] + Math.trunc(((avg - H[t.k]) * t.fall) / 1024);
      });
      tiles.forEach((t, i) => { if (!building(t.k) && next[i] !== H[t.k]) { H[t.k] = next[i]; changed = true; } });
      break;
    }
    case 'forest': {
      // Sparse forest: deterministically thinned, paths stay free
      const seed = op.seed ?? 7;
      for (const t of tiles) {
        if ((hash(t.x, t.y, seed) & 1023) > 300 + Math.trunc(t.fall / 3)) continue;
        if (!m.rectFree(t.x, t.y, 1, 1)) continue;
        if (sim.addNode('tree', t.x, t.y, 'wood', BALANCE.tree.wood)) changed = true;
      }
      if (changed) events.push({ type: 'natureChanged' });
      return { events, changed };
    }
    case 'erase': {
      for (const t of tiles) {
        const e = sim.entities.get(m.owner[t.k]);
        if (e && (e.kind === 'tree' || e.kind === 'pile')) {
          sim.removeEntity(e);
          if (e.kind === 'pile') m.flags[t.k] &= ~RESERVED;
          events.push({ type: 'nodeDepleted', node: e.id, res: e.res });
          changed = true;
        }
      }
      // Settlement spots and shafts under the brush
      const hit = (s, w) => tiles.some((t) => t.x >= s.x && t.x < s.x + w && t.y >= s.y && t.y < s.y + w);
      const unreserve = (s, w) => { for (let y = s.y; y < s.y + w; y++) for (let x = s.x; x < s.x + w; x++) m.flags[m.idx(x, y)] &= ~RESERVED; };
      for (const s of sim.spots.filter((q) => hit(q, 4) && !building(m.idx(q.x, q.y)))) { unreserve(s, 4); sim.spots.splice(sim.spots.indexOf(s), 1); changed = true; events.push({ type: 'natureChanged' }); }
      for (const s of sim.shafts.filter((q) => hit(q, 3) && !building(m.idx(q.x, q.y)))) { unreserve(s, 3); sim.shafts.splice(sim.shafts.indexOf(s), 1); changed = true; events.push({ type: 'natureChanged' }); }
      if (changed) m.version++;
      return { events, changed };
    }
    case 'pile': {
      const res = RESOURCES.includes(op.res) ? op.res : 'stone';
      if (!m.walkable(cx, cy) || (m.flags[m.idx(cx, cy)] & RESERVED)) return { events, changed };
      const n = sim.addNode('pile', cx, cy, res, Math.max(1, Math.min(5000, Math.trunc(op.amount ?? BALANCE.pile.amount))));
      if (n) { m.reserve(cx, cy, 1, 1); events.push({ type: 'natureChanged' }); changed = true; }
      return { events, changed };
    }
    case 'shaft': case 'spot': {
      const w = op.tool === 'shaft' ? 3 : 4;
      const x = cx - (w >> 1), y = cy - (w >> 1);
      if (!m.rectFree(x - 1, y - 1, w + 2, w + 2)) return { events, changed };
      if (op.tool === 'spot' && m.slope(x, y, w, w) > BALANCE.maxSlope) return { events, changed };
      m.reserve(x, y, w, w);
      if (op.tool === 'shaft') sim.shafts.push({ x, y, res: ['stone', 'iron', 'clay', 'sulfur'].includes(op.res) ? op.res : 'stone' });
      else sim.spots.push({ x, y });
      events.push({ type: 'natureChanged' });
      return { events, changed: true };
    }
    default: return { events, changed };
  }

  if (changed) {
    const x0 = cx - r - 1, y0 = cy - r - 1, w = 2 * r + 3;
    deriveFlags(sim, x0, y0, w, w, events);
    m.heightVersion++;
    m.version++;
    events.push({ type: 'terrainChanged', x: x0 - 1, y: y0 - 1, w: w + 2, h: w + 2 });
  }
  return { events, changed };
}

/**
 * Derive water and rocks from the height (as in mapgen). Trees and piles on new water/rocks disappear.
 */
export function deriveFlags(sim, x0, y0, w, h, events = []) {
  const m = sim.map, H = m.heights, S = m.width;
  let nature = false;
  for (let y = Math.max(0, y0); y < Math.min(m.height, y0 + h); y++) {
    for (let x = Math.max(0, x0); x < Math.min(S, x0 + w); x++) {
      const k = y * S + x;
      let f = m.flags[k] & ~(WATER | CLIFF);
      if (H[k] < sim.waterLevel) f |= WATER;
      else {
        const hl = H[y * S + Math.max(0, x - 1)], hr = H[y * S + Math.min(S - 1, x + 1)];
        const hu = H[Math.max(0, y - 1) * S + x], hd = H[Math.min(m.height - 1, y + 1) * S + x];
        const g = Math.max(Math.abs(hr - hl), Math.abs(hd - hu));
        if (g > 2 * CLIFF_SLOPE || H[k] > sim.waterLevel + PEAK_HEIGHT) f |= CLIFF;
      }
      if ((f & (WATER | CLIFF)) && (f & OCCUPIED)) {
        const e = sim.entities.get(m.owner[k]);
        if (e && (e.kind === 'tree' || e.kind === 'pile')) {
          sim.removeEntity(e);
          f = (f & ~OCCUPIED) & ~(e.kind === 'pile' ? RESERVED : 0);
          events.push({ type: 'nodeDepleted', node: e.id, res: e.res });
          nature = true;
        } else continue; // building: area stays as it is
      }
      m.flags[k] = f | (m.flags[k] & OCCUPIED);
    }
  }
  return nature;
}

/** Infos about a tile for the editor's status line. */
export function tileInfo(sim, x, y) {
  const m = sim.map;
  if (!m.inBounds(x, y)) return null;
  const k = m.idx(x, y), f = m.flags[k];
  const e = (f & OCCUPIED) ? sim.entities.get(m.owner[k]) : null;
  return {
    x, y, h: m.heights[k],
    kind: f & CLIFF ? 'cliff' : f & WATER ? 'water' : e ? (e.kind === 'building' ? 'building' : e.kind) : (f & RESERVED ? 'reserved' : 'free'),
    res: e?.res ?? null,
  };
}

/**
 * Preview simulation for the editor: world and players of the scenario, without scripts and without fog.
 * It never runs (no step), it is only edited and drawn.
 * @param {any} scenario
 */
export function editorSim(scenario) {
  const def = scenarioToDef(scenario);
  const real = def.players.filter((p) => p.kind !== 'bandits');
  return new Sim({
    seed: def.seed ?? 1,
    size: def.size,
    players: real.length,
    heroes: real.map((p) => p.hero ?? null),
    teams: real.map((p, i) => p.team ?? i),
    world: { ...def.world, size: def.world.size ?? def.size },
    playerSetup: playerSetupOf(def),
    fog: false,
  });
}

/**
 * Apply the edited map to the scenario (world.terrain). Start spots remain those of the scenario.
 * @returns {any} new scenario object
 */
export function withTerrain(scenario, sim) {
  const terrain = terrainOf(sim);
  if (scenario.world?.starts?.length) terrain.starts = scenario.world.starts.map((p) => ({ x: p.x, y: p.y }));
  const { base, seed, size, width, height, ...rest } = scenario.world ?? {};
  void base; void width; void height;
  return { ...scenario, world: { ...rest, seed, size: size ?? terrain.w, base: 'terrain', terrain } };
}
