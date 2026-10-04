// Tools for mission scripts: post-process the map, buildings, troops, bandit camps, points.
//
// Principle: never fixed coordinates. Everything is searched starting from castles, start points or
// other found points (rings outwards, fixed order = deterministic).
// This way missions survive changes to the map generator (relief, cliffs, other water layouts).

import { BUILDING_TECHS } from '../data/buildingTechs.js';
import { OCCUPIED, RESERVED, WATER, CLIFF } from '../map.js';
import { BUILDINGS } from '../data/buildings.js';
import { BALANCE } from '../data/balance.js';
import { UNITS, HEROES } from '../data/units.js';
import { findPath } from '../pathfinding.js';
import { tileCenter, toTile, isqrt } from '../fixed.js';
import { TECHS } from '../data/technologies.js';

/** Centre of a building as a tile. */
export const centerOf = (b) => ({ x: b.x + (b.w >> 1), y: b.y + (b.h >> 1) });

/** Tile position of any entity. */
export function tileOf(e) {
  if (e.kind === 'building') return centerOf(e);
  if (e.px !== undefined) return { x: toTile(e.px), y: toTile(e.py) };
  return { x: e.x, y: e.y };
}

/** Tiles in rings around (cx,cy), from inside out, fixed order. */
export function* rings(cx, cy, minR, maxR) {
  for (let r = minR; r <= maxR; r++) {
    if (r === 0) { yield { x: cx, y: cy }; continue; }
    for (let i = -r; i < r; i++) yield { x: cx + i, y: cy - r };
    for (let i = -r; i < r; i++) yield { x: cx + r, y: cy + i };
    for (let i = -r; i < r; i++) yield { x: cx - i, y: cy + r };
    for (let i = -r; i < r; i++) yield { x: cx - r, y: cy - i };
  }
}

/** Is the square with radius `clear` around (x,y) walkable and free of reservations? */
export function openSquare(map, x, y, clear = 1, allowReserved = false) {
  for (let j = y - clear; j <= y + clear; j++) for (let i = x - clear; i <= x + clear; i++) {
    if (!map.walkable(i, j)) return false;
    if (!allowReserved && (map.flags[map.idx(i, j)] & RESERVED)) return false;
  }
  return true;
}

/** Is there a path (with the current ice state)? */
export function reachable(sim, from, to, frozen = sim.map.frozen) {
  const m = sim.map;
  const was = m.frozen;
  m.frozen = frozen;
  try {
    if (!m.walkable(from.x, from.y) || !m.walkable(to.x, to.y)) {
      // Start point in a building: take the nearest walkable tile
      const f = nearestWalkable(sim, from.x, from.y, 4), t = nearestWalkable(sim, to.x, to.y, 4);
      if (!f || !t) return false;
      return findPath(m, f.x, f.y, [m.idx(t.x, t.y)], 60000) !== null;
    }
    return findPath(m, from.x, from.y, [m.idx(to.x, to.y)], 60000) !== null;
  } finally {
    m.frozen = was;
  }
}

export function nearestWalkable(sim, x, y, maxR = 8) {
  for (const p of rings(x, y, 0, maxR)) if (sim.map.walkable(p.x, p.y)) return p;
  return null;
}

/** Point on the line from a to b at distance `dist` (tiles) from a. */
export function toward(a, b, dist) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = isqrt(dx * dx + dy * dy) || 1;
  return { x: a.x + Math.trunc((dx * dist) / d), y: a.y + Math.trunc((dy * dist) / d) };
}

export const dist = (a, b) => isqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

/**
 * Searches a free, walkable spot near (cx,cy).
 * @param {import('../sim.js').Sim} sim
 * @param {{minR?:number, maxR?:number, clear?:number, from?:{x:number,y:number}|null, frozen?:boolean, avoid?:{x:number,y:number,r:number}[]}} [o]
 *   from: must be reachable from there; avoid: circles that should stay free
 */
export function findOpen(sim, cx, cy, o = {}) {
  const { minR = 0, maxR = 24, clear = 1, from = null, frozen, avoid = [] } = o;
  let tries = 0;
  for (const p of rings(cx, cy, minR, maxR)) {
    if (!openSquare(sim.map, p.x, p.y, clear)) continue;
    if (avoid.some((a) => dist(a, p) < a.r)) continue;
    if (from && tries++ < 40 && !reachable(sim, from, p, frozen)) continue;
    if (from && tries > 40) return null;
    return p;
  }
  return null;
}

/** Place a building without cost and tech check (searches a free spot). */
export function placeBuilding(sim, owner, type, near, o = {}) {
  const def = BUILDINGS[type];
  const { radius = 24, done = true, level = 0, minR = 0, margin = 1 } = o;
  let pos = null;
  if (def.placement !== 'free') {
    const list = def.placement === 'settlement' ? sim.spots : sim.shafts.filter((s) => s.res === def.shaftResource);
    let bd = Infinity;
    for (const s of list) {
      const d = (s.x - near.x) ** 2 + (s.y - near.y) ** 2;
      if (d < bd && d <= radius * radius && sim.map.rectFree(s.x, s.y, def.w, def.h, WATER | OCCUPIED)) { bd = d; pos = s; }
    }
  } else {
    for (const p of rings(near.x - (def.w >> 1), near.y - (def.h >> 1), minR, radius)) {
      if (!sim.map.rectFree(p.x - margin, p.y - margin, def.w + 2 * margin, def.h + 2 * margin, WATER | OCCUPIED | RESERVED)) continue;
      if (sim.map.slope(p.x, p.y, def.w, def.h) > BALANCE.maxSlope) continue;
      // Buildings must not cut off paths: the border must be walkable
      if (sim.map.ring(p.x, p.y, def.w, def.h).length < def.w + def.h) continue;
      pos = p; break;
    }
  }
  if (!pos) return null;
  const b = sim.createBuilding(owner, type, pos.x, pos.y, done);
  if (level > 0) {
    b.level = Math.min(level, def.levels.length - 1);
    b.hp = def.levels[b.level].hp;
  }
  return b;
}

/** Create a squad leader with soldiers at a free spot near `near`. */
export function spawnTroop(sim, owner, defId, near, soldiers) {
  const p = findOpen(sim, near.x, near.y, { maxR: 12, clear: 1 }) ?? nearestWalkable(sim, near.x, near.y, 12);
  if (!p) return null;
  return sim.spawnLeader(owner, defId, p.x, p.y, soldiers ?? UNITS[defId].soldiers);
}

/** Remove trees and piles in a circle (e.g. clearing for a camp). */
export function clearNodes(sim, x, y, r) {
  for (const e of [...sim.entities.values()]) {
    if ((e.kind === 'tree' || e.kind === 'pile') && dist(e, { x, y }) <= r) sim.removeEntity(e);
  }
}

/** Plant n trees around a point. */
export function plantTrees(sim, near, n, r = 5) {
  let k = 0;
  for (const p of rings(near.x, near.y, 1, r)) {
    if (k >= n) break;
    if ((p.x + p.y) % 2 !== 0) continue; // sparse forest, paths stay free
    if (!sim.map.rectFree(p.x, p.y, 1, 1)) continue;
    if (sim.addNode('tree', p.x, p.y, 'wood', BALANCE.tree.wood)) k++;
  }
  return k;
}

/** Resource pile near a point. */
export function addPile(sim, res, near, amount = BALANCE.pile.amount) {
  const p = findOpen(sim, near.x, near.y, { maxR: 10, clear: 1 });
  if (!p) return null;
  const n = sim.addNode('pile', p.x, p.y, res, amount);
  if (n) sim.map.reserve(p.x, p.y, 1, 1);
  return n;
}

/** Create an additional settlement spot (4×4). */
export function addSpot(sim, near, o = {}) {
  const { minR = 0, maxR = 16 } = o;
  for (const p of rings(near.x - 2, near.y - 2, minR, maxR)) {
    if (!sim.map.rectFree(p.x - 1, p.y - 1, 6, 6)) continue;
    if (sim.map.slope(p.x, p.y, 4, 4) > BALANCE.maxSlope) continue;
    sim.map.reserve(p.x, p.y, 4, 4);
    const s = { x: p.x, y: p.y };
    sim.spots.push(s);
    return s;
  }
  return null;
}

/** Create an additional shaft (3×3). */
export function addShaft(sim, res, near, o = {}) {
  const { minR = 0, maxR = 16 } = o;
  for (const p of rings(near.x - 1, near.y - 1, minR, maxR)) {
    if (!sim.map.rectFree(p.x - 1, p.y - 1, 5, 5)) continue;
    sim.map.reserve(p.x, p.y, 3, 3);
    const s = { x: p.x, y: p.y, res };
    sim.shafts.push(s);
    return s;
  }
  return null;
}

/** Nearest existing shaft of a resource (or newly created). */
export function ensureShaft(sim, res, near, maxDist = 22) {
  let best = null, bd = Infinity;
  for (const s of sim.shafts) {
    if (s.res !== res) continue;
    const d = dist(s, near);
    if (d < bd && d <= maxDist && sim.map.rectFree(s.x, s.y, 3, 3, WATER | OCCUPIED)) { bd = d; best = s; }
  }
  return best ?? addShaft(sim, res, near, { minR: 6, maxR: maxDist });
}

/** Set all serfs of a player to n. */
export function setSerfs(sim, owner, n) {
  const serfs = [...sim.entities.values()].filter((e) => e.kind === 'unit' && e.owner === owner);
  for (let i = n; i < serfs.length; i++) sim.entities.delete(serfs[i].id);
  for (let i = serfs.length; i < n; i++) sim.spawnSerf(owner);
}

/** Set resources (refined), missing kinds stay unchanged. */
export function setStock(sim, owner, stock) {
  Object.assign(sim.players[owner].stock, stock);
}

export function giveTechs(sim, owner, techs) {
  for (const t of techs) if (TECHS[t] || BUILDING_TECHS[t]) sim.players[owner].techs.add(t);
}

/**
 * Island: lifts an area out by laying a water ring around it (moat/lake).
 * Walkable only in winter (frozen). Finds a suitable spot between `from` and `to` itself.
 * `o.keep`: points that must stay reachable from `from` in summer (the water ring must not cut off paths).
 * @returns {{x:number,y:number,r:number}|null} centre and inner radius
 */
export function makeIsland(sim, from, to, o = {}) {
  const { inner = 5, width = 2, minDist = 26, keep = [] } = o;
  const m = sim.map;
  const outer = inner + width;
  const tryAt = (c) => {
    // Area must be free of buildings, spots and shafts
    for (let y = c.y - outer - 1; y <= c.y + outer + 1; y++) for (let x = c.x - outer - 1; x <= c.x + outer + 1; x++) {
      if (!m.inBounds(x, y) || x < 2 || y < 2 || x >= m.width - 2 || y >= m.height - 2) return false;
      const f = m.flags[m.idx(x, y)];
      const e = sim.entities.get(m.owner[m.idx(x, y)]);
      if (f & RESERVED) return false;
      if ((f & OCCUPIED) && e?.kind === 'building') return false;
    }
    // There must be walkable space inside
    let inside = 0;
    for (let y = c.y - inner + 1; y < c.y + inner; y++) for (let x = c.x - inner + 1; x < c.x + inner; x++) if (!(m.flags[m.idx(x, y)] & WATER)) inside++;
    return inside >= inner * inner;
  };
  const dirs = [];
  for (let d = minDist; d <= minDist + 20; d += 4) dirs.push(toward(from, to, d));
  for (const base of dirs) {
    for (const c of rings(base.x, base.y, 0, 8)) {
      if (!tryAt(c)) continue;
      // Flood the ring (height below water level, so that it also looks like it)
      const changed = [];
      for (let y = c.y - outer; y <= c.y + outer; y++) for (let x = c.x - outer; x <= c.x + outer; x++) {
        const d = isqrt((x - c.x) ** 2 + (y - c.y) ** 2);
        const k = m.idx(x, y);
        if (d >= inner && d <= outer) {
          const e = sim.entities.get(m.owner[k]);
          if (e && (e.kind === 'tree' || e.kind === 'pile')) sim.removeEntity(e);
          changed.push([k, m.heights[k], m.flags[k]]);
          m.flags[k] |= WATER;
          m.heights[k] = Math.min(m.heights[k], sim.waterLevel - 200);
        } else if (d < inner && (m.flags[k] & WATER)) {
          changed.push([k, m.heights[k], m.flags[k]]);
          m.flags[k] &= ~WATER;
          m.heights[k] = Math.max(m.heights[k], sim.waterLevel + 80);
        }
      }
      m.version++; // recompute the region numbers of the pathfinding
      // Counter-check: cut off in summer, reachable in winter; `keep` stays reachable in summer
      const ok = !reachable(sim, from, c, false) && reachable(sim, from, c, true) && keep.every((k) => reachable(sim, from, k, false));
      if (ok) return { x: c.x, y: c.y, r: inner - 1 };
      for (const [k, h, f] of changed.reverse()) { m.heights[k] = h; m.flags[k] = f; }
      m.version++;
    }
  }
  return null;
}

/**
 * Moat (lake) around a fixed centre, e.g. a castle: ring from `inner` to `inner + width`
 * tiles becomes water, buildings in the ring are not allowed (then null). In summer the centre is
 * unreachable from `from`, in winter reachable over the ice. Trees and piles in the ring disappear.
 * @returns {{x:number,y:number,r:number}|null}
 */
export function moat(sim, c, from, o = {}) {
  const { inner = 12, width = 4 } = o;
  const m = sim.map, outer = inner + width;
  const ring = [];
  for (let y = c.y - outer; y <= c.y + outer; y++) for (let x = c.x - outer; x <= c.x + outer; x++) {
    if (!m.inBounds(x, y)) continue;
    const d = isqrt((x - c.x) ** 2 + (y - c.y) ** 2);
    if (d < inner || d > outer) continue;
    const k = m.idx(x, y);
    const e = sim.entities.get(m.owner[k]);
    if ((m.flags[k] & OCCUPIED) && e?.kind === 'building') return null;
    ring.push(k);
  }
  const changed = [];
  for (const k of ring) {
    const e = sim.entities.get(m.owner[k]);
    if (e && (e.kind === 'tree' || e.kind === 'pile')) sim.removeEntity(e);
    changed.push([k, m.heights[k], m.flags[k]]);
    m.flags[k] |= WATER;
    m.heights[k] = Math.min(m.heights[k], sim.waterLevel - 200);
  }
  m.version++;
  if (!reachable(sim, from, c, false) && reachable(sim, from, c, true)) return { x: c.x, y: c.y, r: inner - 1 };
  for (const [k, h, f] of changed.reverse()) { m.heights[k] = h; m.flags[k] = f; }
  m.version++;
  return null;
}

// ---------- Shaping terrain: mountain ridge, gaps, river courses, lake with island ----------
// For missions with fixed landscape (e.g. a valley behind a mountain ridge). All integer and without randomness;
// there are no buildings yet at the time of the call (shape first, then build and place troops).

/** Triangle wave with period `period` and amplitude ±amp (natural-looking, integer edges). */
const tri = (v, period, amp) => { const k = ((v % period) + period) % period; return Math.trunc(((Math.abs(k * 4 - period * 2) - period) * amp) / period); };

/** Remove a tree or pile on a tile. */
function clearTile(sim, k) {
  const e = sim.entities.get(sim.map.owner[k]);
  if (e && (e.kind === 'tree' || e.kind === 'pile')) sim.removeEntity(e);
}

/**
 * Axis from `from` to `to`: p = distance along the axis, q = lateral offset (tiles, integer);
 * at(p, q) returns the tile for it.
 */
export function axis(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y, len = isqrt(dx * dx + dy * dy) || 1;
  return {
    from, len,
    p: (x, y) => Math.trunc(((x - from.x) * dx + (y - from.y) * dy) / len),
    q: (x, y) => Math.trunc(((y - from.y) * dx - (x - from.x) * dy) / len),
    at: (p, q) => ({ x: from.x + Math.trunc((p * dx - q * dy) / len), y: from.y + Math.trunc((p * dy + q * dx) / len) }),
  };
}

/**
 * Smooth relief: compress heights towards the water level (factor 1/`divide`), remove steep slopes and waters of the
 * map generator. With `sites` settlement spots, shafts and bridge sites also disappear
 * (missions without building).
 */
export function soften(sim, o = {}) {
  const { divide = 3, floor = 150, sites = false } = o;
  const m = sim.map, wl = sim.waterLevel;
  for (let k = 0; k < m.flags.length; k++) {
    m.flags[k] &= ~(CLIFF | WATER);
    m.heights[k] = wl + floor + Math.trunc(Math.max(0, m.heights[k] - wl - floor) / divide);
  }
  if (sites) {
    for (let k = 0; k < m.flags.length; k++) m.flags[k] &= ~RESERVED;
    sim.spots.length = 0; sim.shafts.length = 0; sim.bridgeSites = [];
  }
  m.version++; m.heightVersion++;
}

/** Edges of the ridge at lateral position q: [lo, hi) along the axis. */
function ridgeSpan(r, q) {
  const lo = r.at + (r.wobble ? tri(q + r.at, 23, r.wobble) + tri(q * 3 + 7, 31, 1) : 0);
  return { lo, hi: lo + r.width };
}

/**
 * Mountain ridge across the whole map, perpendicular to the axis: starts `at` tiles from the axis source and is
 * `width` tiles thick (edges wavy). The ridge is a steep slope (CLIFF): impassable, also over the ice.
 * In front of and behind it a walkable foothill rises. Gaps are cut by ridgeGap().
 * @param {ReturnType<typeof axis>} ax
 * @returns {{ ax: ReturnType<typeof axis>, at: number, width: number, wobble: number, foot: number }}
 */
export function ridge(sim, ax, at, width, o = {}) {
  const { wobble = 2, rise = 520, peak = 2700, foot = 3 } = o;
  const m = sim.map, wl = sim.waterLevel;
  const r = { ax, at, width, wobble, foot };
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
    const { lo, hi } = ridgeSpan(r, ax.q(x, y));
    const p = ax.p(x, y), k = m.idx(x, y);
    if (p < lo - foot || p >= hi + foot) continue;
    if (p >= lo && p < hi) {
      const edge = Math.min(p - lo, hi - 1 - p);
      clearTile(sim, k);
      m.flags[k] = (m.flags[k] | CLIFF) & ~(WATER | RESERVED);
      m.heights[k] = Math.max(m.heights[k], Math.min(wl + peak, wl + 900 + edge * rise));
    } else {
      const d = p < lo ? lo - p : p - hi + 1;
      m.heights[k] = Math.max(m.heights[k], wl + 900 - d * 180);
    }
  }
  m.version++; m.heightVersion++;
  return r;
}

/**
 * Gap through a ridge at lateral position q (`width` tiles wide): a pass (land) or with
 * `water` a gorge through which a river runs (walkable only in winter). Returns the centre and the
 * tiles in front of (`near`) and behind (`far`) the ridge.
 */
export function ridgeGap(sim, r, q, o = {}) {
  const { width = 3, water = false, floor = 350 } = o;
  const m = sim.map, wl = sim.waterLevel, ax = r.ax, half = width >> 1;
  let lo = Infinity, hi = -Infinity;
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
    const tq = ax.q(x, y), dq = Math.abs(tq - q);
    if (dq > half + 2) continue;
    const span = ridgeSpan(r, tq), p = ax.p(x, y);
    if (p < span.lo - r.foot || p >= span.hi + r.foot) continue;
    if (dq <= half) { lo = Math.min(lo, span.lo); hi = Math.max(hi, span.hi); }
    const k = m.idx(x, y);
    if (dq <= half) {
      clearTile(sim, k);
      m.flags[k] &= ~CLIFF;
      if (water) { m.flags[k] |= WATER; m.heights[k] = wl - 160; } else { m.flags[k] &= ~WATER; m.heights[k] = wl + floor; }
    } else if (p < span.lo || p >= span.hi) {
      // Let the foothill next to the gap slope gently down to the floor
      m.heights[k] = Math.min(m.heights[k], wl + floor + (dq - half) * 260);
    }
  }
  m.version++; m.heightVersion++;
  const mid = (lo + hi) >> 1;
  return { q, center: ax.at(mid, q), near: ax.at(lo - r.foot - 1, q), far: ax.at(hi + r.foot, q) };
}

/** River course (water, `width` tiles wide) from a to b; tiles outside the map are skipped. */
export function channel(sim, a, b, o = {}) {
  const { width = 3 } = o;
  const m = sim.map, wl = sim.waterLevel, half = width >> 1;
  const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1);
  for (let i = 0; i <= n; i++) {
    const cx = a.x + Math.trunc(((b.x - a.x) * i) / n), cy = a.y + Math.trunc(((b.y - a.y) * i) / n);
    for (let y = cy - half; y <= cy + half; y++) for (let x = cx - half; x <= cx + half; x++) {
      if (!m.inBounds(x, y)) continue;
      const k = m.idx(x, y);
      clearTile(sim, k);
      m.flags[k] = (m.flags[k] | WATER) & ~(CLIFF | RESERVED);
      m.heights[k] = Math.min(m.heights[k], wl - 160);
    }
  }
  m.version++; m.heightVersion++;
}

/**
 * Lake with island around c: island up to `inner` (flat, walkable), water ring up to `inner + width`, behind it a
 * flat shore (`shore` tiles). In summer the island is cut off, in winter the ice carries.
 * @returns {{x:number,y:number,r:number}} centre and inner radius
 */
export function lakeIsland(sim, c, o = {}) {
  const { inner = 6, width = 4, shore = 3 } = o;
  const m = sim.map, wl = sim.waterLevel, outer = inner + width;
  for (let y = c.y - outer - shore; y <= c.y + outer + shore; y++) for (let x = c.x - outer - shore; x <= c.x + outer + shore; x++) {
    if (!m.inBounds(x, y)) continue;
    const d = isqrt((x - c.x) ** 2 + (y - c.y) ** 2), k = m.idx(x, y);
    if (d > outer + shore) continue;
    if (d >= inner && d <= outer) {
      clearTile(sim, k);
      m.flags[k] = (m.flags[k] | WATER) & ~(CLIFF | RESERVED);
      m.heights[k] = wl - 220;
    } else {
      m.flags[k] &= ~(CLIFF | WATER);
      m.heights[k] = Math.max(wl + 150, Math.min(m.heights[k], wl + (d < inner ? 300 : 450)));
    }
  }
  m.version++; m.heightVersion++;
  return { x: c.x, y: c.y, r: inner - 1 };
}

/**
 * Permanent ruin of a building type near `near` (backdrop, blocks the area, never decays).
 * @returns {any|null} the ruin
 */
export function addRuin(sim, type, near, o = {}) {
  const def = BUILDINGS[type], { level = 0, radius = 8 } = o;
  for (const p of rings(near.x - (def.w >> 1), near.y - (def.h >> 1), 0, radius)) {
    if (!sim.map.rectFree(p.x - 1, p.y - 1, def.w + 2, def.h + 2)) continue;
    const r = { id: sim.nextId++, kind: 'ruin', type, level, owner: -1, formerOwner: -1, x: p.x, y: p.y, w: def.w, h: def.h, until: 0x7fffffff };
    sim.entities.set(r.id, r);
    sim.map.occupy(r.x, r.y, r.w, r.h, r.id);
    return r;
  }
  return null;
}

/** Units (squad leaders, heroes, serfs) of a player within a circle. */
export function unitsInArea(sim, owner, area, who = 'any') {
  const out = [];
  const r2 = area.r * area.r;
  for (const e of sim.entities.values()) {
    if (e.owner !== owner || e.px === undefined) continue;
    const ok = who === 'any' ? (e.kind === 'leader' || e.kind === 'hero' || e.kind === 'unit')
      : who === 'hero' ? e.kind === 'hero' && !e.down
        : who === 'army' ? (e.kind === 'leader' || (e.kind === 'hero' && !e.down))
          : who === 'serf' ? e.kind === 'unit'
            : HEROES[who] ? e.kind === 'hero' && e.hero === who && !e.down : e.kind === who;
    if (!ok) continue;
    const dx = e.px - tileCenter(area.x), dy = e.py - tileCenter(area.y);
    if (dx * dx + dy * dy <= r2 * 1000000) out.push(e);
  }
  return out;
}
