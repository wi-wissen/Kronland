// Ground: what lies on a tile (sensor words for scripts), items on tiles (coins, flowers) and tracks
// (footprints, trodden paths). Pure simulation, integers only (docs/SPIELREGELN.md §Spuren und Gegenstände).
//
// - tileKind(sim, x, y): one word per tile with a fixed precedence – edge, cliff, tree/pile/ruin/building,
//   water, coin/flower, ice, track, free. A finished bridge is ground, not water.
// - Items: TileMap.items (tile index → kind), at most one per tile, only on walkable ground. occupy() removes them.
// - Tracks: TileMap.tracks (one byte strength per tile). A figure leaving a tile adds 1 there (updateTracks, one
//   loop over all figures). A broom sweeps the map and takes 1 away; its position follows from the tick, so there
//   is no list and nothing to save beyond the bytes. A tile counts as "track" from a threshold per weather.

import { CLIFF, OCCUPIED, WATER, BRIDGE } from '../map.js';
import { BALANCE } from '../data/balance.js';
import { TICKS_PER_SECOND, toTile, idiv } from '../fixed.js';

const G = BALANCE.ground;

/** Compass directions: 0 = north (−y), 1 = east, 2 = south, 3 = west. */
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const DIR_NAMES = ['north', 'east', 'south', 'west'];

/** Items that can lie on a tile. */
export const ITEM_KINDS = ['coin', 'flower'];

/** Every answer of the sensors (front(), left(), right(), here(), tile()), in order of precedence. */
export const TILE_WORDS = ['edge', 'cliff', 'tree', 'pile', 'ruin', 'building', 'water', 'coin', 'flower', 'ice', 'track', 'free'];

/** Figures that leave tracks. */
const TRACKERS = new Set(['unit', 'worker', 'leader', 'soldier', 'hero']);

/** Look direction of a figure (scripts; east when nothing was set). */
export const faceOf = (e) => e.face ?? 1;

/** Tile of a figure. */
export const figureTile = (e) => ({ x: toTile(e.px), y: toTile(e.py) });

/**
 * Tile next to a figure, relative to its look direction.
 * @param {{px:number, py:number, face?:number}} e
 * @param {0|-1|1|null} rel 0 = in front, −1 = left, +1 = right, null = the tile the figure stands on
 * @returns {{x:number, y:number}}
 */
export function tileToward(e, rel = 0) {
  const t = figureTile(e);
  if (rel === null) return t;
  const d = DIRS[(faceOf(e) + rel + 4) % 4];
  return { x: t.x + d[0], y: t.y + d[1] };
}

/** Track settings of the scenario (world.tracks: threshold, fade, who) or null. */
const trackConfig = (sim) => sim.mission?.def?.tracks ?? null;

/** From which strength a tile counts as "track" (scenario override, otherwise per weather). */
export function trackThreshold(sim) {
  const c = trackConfig(sim);
  if (c && Number.isInteger(c.threshold)) return Math.max(1, c.threshold);
  return G.tracks.threshold[sim.weather?.state] ?? G.tracks.threshold.summer;
}

/** Ticks until a tile loses one level of track strength (0 = never). */
export function trackFadeTicks(sim) {
  const c = trackConfig(sim);
  if (c && typeof c.fade === 'number' && Number.isFinite(c.fade)) return Math.max(0, Math.round(c.fade * TICKS_PER_SECOND));
  return G.tracks.fadeSeconds * TICKS_PER_SECOND;
}

/**
 * What lies on a tile, as one word (fixed precedence: things before ground, the state of the ground before marks).
 * @returns {string} one of TILE_WORDS
 */
export function tileKind(sim, x, y) {
  const m = sim.map;
  if (!m.inBounds(x, y)) return 'edge';
  const k = m.idx(x, y), f = m.flags[k];
  if (f & CLIFF) return 'cliff';
  if (f & OCCUPIED) {
    const kind = sim.entities.get(m.owner[k])?.kind;
    return kind === 'tree' || kind === 'pile' || kind === 'ruin' ? kind : 'building';
  }
  // A finished bridge is ground (walkable), not water
  const wet = (f & WATER) && !(f & BRIDGE);
  if (wet && !m.frozen) return 'water';
  const item = m.items.get(k);
  if (item) return item;
  if (wet) return 'ice';
  if (m.tracks[k] >= trackThreshold(sim)) return 'track';
  return 'free';
}

// ---------- Items ----------

/** Item on a tile or null. */
export function itemAt(map, x, y) {
  return map.inBounds(x, y) ? map.items.get(map.idx(x, y)) ?? null : null;
}

/** Can an item be put on the tile? Walkable ground (ice in winter too) without an item. */
export function itemFits(map, x, y) {
  return map.walkable(x, y) && !map.items.has(map.idx(x, y));
}

/** Put an item on a tile (world building, put()). @returns {boolean} */
export function addItem(sim, x, y, kind) {
  const m = sim.map;
  if (!ITEM_KINDS.includes(kind) || !itemFits(m, x, y)) return false;
  m.items.set(m.idx(x, y), kind);
  m.groundVersion++;
  return true;
}

/** Remove the item of a tile. @returns {string|null} its kind */
export function removeItem(sim, x, y) {
  const m = sim.map;
  const kind = itemAt(m, x, y);
  if (kind) { m.items.delete(m.idx(x, y)); m.groundVersion++; }
  return kind;
}

/** All items (optionally of one kind), sorted by row, then column. @returns {{x:number, y:number, kind:string}[]} */
export function itemList(map, kind = null) {
  const out = [];
  for (const k of [...map.items.keys()].sort((a, b) => a - b)) {
    const v = map.items.get(k);
    if (!kind || v === kind) out.push({ x: k % map.width, y: (k / map.width) | 0, kind: v });
  }
  return out;
}

/**
 * Figure takes the item it stands on (command { type: 'item', action: 'take' }). A coin goes into the stock as one
 * thaler, a flower is simply picked. @returns {string|{code:string}} kind or rejection reason
 */
export function takeItem(sim, e) {
  const { x, y } = figureTile(e);
  const kind = itemAt(sim.map, x, y);
  if (!kind) return { code: 'err.nothingHere' };
  removeItem(sim, x, y);
  if (kind === 'coin') sim.players[e.owner].stock.gold += G.coinValue;
  sim.events.push({ type: 'item', action: 'take', kind, x, y, unit: e.id, player: e.owner });
  return kind;
}

/** Figure puts an item on its tile: only coins (one thaler from the stock). @returns {string|{code:string}} */
export function putItem(sim, e, kind) {
  const { x, y } = figureTile(e);
  if (kind !== 'coin') return { code: 'err.onlyCoins' };
  if (itemAt(sim.map, x, y)) return { code: 'err.somethingHere' };
  if (!itemFits(sim.map, x, y)) return { code: 'err.notWalkable' };
  if (!sim.pay(e.owner, { gold: G.coinValue })) return { code: 'err.notEnoughGold' };
  addItem(sim, x, y, kind);
  sim.events.push({ type: 'item', action: 'put', kind, x, y, unit: e.id, player: e.owner });
  return kind;
}

/**
 * Thaw (or a bridge gone): items and tracks on open water disappear. Optionally only in a rectangle.
 */
export function thawGround(sim, x0 = 0, y0 = 0, w = sim.map.width, h = sim.map.height) {
  const m = sim.map;
  for (let y = Math.max(0, y0); y < Math.min(m.height, y0 + h); y++) {
    for (let x = Math.max(0, x0); x < Math.min(m.width, x0 + w); x++) {
      const k = m.idx(x, y), f = m.flags[k];
      if (!(f & WATER) || (f & BRIDGE)) continue;
      if (m.items.delete(k)) m.groundVersion++;
      m.tracks[k] = 0;
    }
  }
}

/** A tile became water or rock (world building): no item, no track there. */
export function clearGround(map, k) {
  if (map.items.delete(k)) map.groundVersion++;
  map.tracks[k] = 0;
}

// ---------- Tracks ----------

/** Set the track strength of a tile (world building). */
export function setTrack(map, x, y, strength) {
  map.tracks[map.idx(x, y)] = Math.max(0, Math.min(G.tracks.max, strength));
  map.groundVersion++;
}

/**
 * Once per tick: figures that left their tile add one level of track there (only steps to a neighbouring tile –
 * teleports and returns to the castle leave nothing), and the broom fades a stretch of the map by one level.
 * e.tk is the last tile of a figure (saved with the entity).
 */
export function updateTracks(sim) {
  const m = sim.map, W = m.width, tr = m.tracks, max = G.tracks.max;
  const who = trackConfig(sim)?.who ?? 'all';
  if (who !== 'none') {
    const heroesOnly = who === 'heroes';
    for (const e of sim.entities.values()) {
      if (e.px === undefined || !TRACKERS.has(e.kind) || e.inside) continue;
      if (heroesOnly && e.kind !== 'hero') continue;
      const x = toTile(e.px), y = toTile(e.py), k = y * W + x, o = e.tk;
      if (o === k) continue;
      e.tk = k;
      if (o === undefined) continue;
      const ox = o % W, oy = (o - ox) / W;
      if (ox - x > 1 || x - ox > 1 || oy - y > 1 || y - oy > 1) continue;
      if (tr[o] < max) tr[o]++;
    }
  }
  const fade = trackFadeTicks(sim);
  if (fade > 0) {
    const n = tr.length, chunk = idiv(n + fade - 1, fade), start = (sim.tick % fade) * chunk;
    for (let k = start, end = Math.min(n, start + chunk); k < end; k++) if (tr[k]) tr[k]--;
  }
}
