// Worlds for the simulation: random map (mapgen), flat base map or saved map from the
// world editor. All deliver the same shape as generateMap: { map, features, starts, hqs, waterLevel }.
//
// Saved map (scenario JSON, world.terrain):
//   { w, h, waterLevel, heights: Base64(Int32Array), flags: Base64(Uint8Array, without OCCUPIED),
//     features: [{ kind: 'tree'|'pile'|'spot'|'shaft'|'coin'|'flower'|'track', x, y, res?, amount?, strength? }], starts: [{x,y}], hqs: [{x,y}] }

import { TileMap, OCCUPIED, RESERVED } from './map.js';
import { generateMap } from './mapgen.js';
import { itemList } from './systems/ground.js';

/** Height of the flat base map above the water level (cm). */
export const FLAT_HEIGHT = 300;

export const toB64 = (typed) => {
  const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
export const fromB64 = (b64, Type) => {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return new Type(bytes.buffer);
};

/** Start spots in the corners (as in mapgen) for a map of size w×h. */
export function cornerStarts(w, h, n) {
  const m = Math.max(6, Math.min(16, Math.trunc(Math.min(w, h) / 6)));
  const corners = [[m, m], [w - 1 - m, h - 1 - m], [w - 1 - m, m], [m, h - 1 - m]];
  const out = [];
  for (let p = 0; p < n; p++) out.push({ x: corners[p % 4][0], y: corners[p % 4][1] });
  return out;
}

/**
 * Create a world.
 * @param {{ seed?: number, size?: number, width?: number, height?: number, base?: 'generate'|'flat', terrain?: any, starts?: {x:number,y:number}[] }} spec
 * @param {number} players number of players with a start spot
 * @param {number} seed seed of the simulation
 */
export function buildWorld(spec, players, seed) {
  if (spec?.terrain) return fromTerrain(spec.terrain, players);
  if (spec?.base === 'flat') return flatWorld(spec.width ?? spec.size ?? 48, spec.height ?? spec.size ?? 48, players, spec.starts);
  return generateMap(spec?.seed ?? seed, { size: spec?.size ?? 96, players });
}

/** Flat meadow without water, trees and resources – basis for learning adventures and the editor. */
export function flatWorld(w, h, players, starts = null) {
  const map = new TileMap(w, h);
  map.heights.fill(FLAT_HEIGHT);
  const st = starts?.length ? starts.slice(0, Math.max(players, starts.length)) : cornerStarts(w, h, players);
  while (st.length < players) st.push(cornerStarts(w, h, players)[st.length]);
  const hqs = st.map((s, p) => ({ x: s.x - 2, y: s.y - 2, player: p }));
  return { map, features: [], starts: st, hqs, waterLevel: 0 };
}

/** Load a saved editor map. */
export function fromTerrain(t, players) {
  const map = new TileMap(t.w, t.h);
  map.heights = fromB64(t.heights, Int32Array);
  map.flags = fromB64(t.flags, Uint8Array);
  for (let k = 0; k < map.flags.length; k++) map.flags[k] &= ~OCCUPIED;
  const starts = (t.starts ?? []).map((s) => ({ x: s.x, y: s.y }));
  const fallback = cornerStarts(t.w, t.h, players);
  while (starts.length < players) starts.push(fallback[starts.length]);
  const hqs = starts.map((s, p) => (t.hqs?.[p] ? { ...t.hqs[p], player: p } : { x: s.x - 2, y: s.y - 2, player: p }));
  const features = (t.features ?? []).map((f) => ({ ...f }));
  for (const f of features) {
    if (f.kind === 'spot') map.reserve(f.x, f.y, 4, 4);
    else if (f.kind === 'shaft') map.reserve(f.x, f.y, 3, 3);
  }
  return { map, features, starts, hqs, waterLevel: t.waterLevel ?? 0 };
}

/**
 * Current map of a simulation as editor data (without buildings and figures).
 * @param {import('../sim.js').Sim} sim
 */
export function terrainOf(sim) {
  const m = sim.map;
  const flags = new Uint8Array(m.flags.length);
  for (let k = 0; k < flags.length; k++) flags[k] = m.flags[k] & ~(OCCUPIED | RESERVED);
  const features = [];
  for (const e of sim.entities.values()) {
    if (e.kind === 'tree') features.push({ kind: 'tree', x: e.x, y: e.y });
    else if (e.kind === 'pile') features.push({ kind: 'pile', x: e.x, y: e.y, res: e.res, amount: e.amount });
  }
  for (const s of sim.spots) features.push({ kind: 'spot', x: s.x, y: s.y });
  for (const s of sim.shafts) features.push({ kind: 'shaft', x: s.x, y: s.y, res: s.res });
  // Ground: items (coins, flowers) and track strength per tile (src/sim/systems/ground.js)
  for (const it of itemList(m)) features.push({ kind: it.kind, x: it.x, y: it.y });
  for (let k = 0; k < m.tracks.length; k++) if (m.tracks[k]) features.push({ kind: 'track', x: k % m.width, y: (k / m.width) | 0, strength: m.tracks[k] });
  features.sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));
  return {
    w: m.width, h: m.height, waterLevel: sim.waterLevel,
    heights: toB64(m.heights), flags: toB64(flags), features,
    starts: sim.starts.map((s) => ({ x: s.x, y: s.y })),
  };
}
