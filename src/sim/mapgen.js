// Map generator: heights, water, forests, resource piles, shafts, settlement spots, start positions.
// Fully deterministic from the seed.

import { Rng } from './rng.js';
import { TileMap, WATER } from './map.js';
import { isqrt } from './fixed.js';

function hash32(x, y, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Value noise 0…1023 with smoothed interpolation, integers only. */
function valueNoise(x, y, cell, s) {
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
  const fx = x - gx * cell, fy = y - gy * cell;
  const c2 = cell * cell;
  const wx = Math.trunc((fx * fx * (3 * cell - 2 * fx)) / c2);
  const wy = Math.trunc((fy * fy * (3 * cell - 2 * fy)) / c2);
  const v00 = hash32(gx, gy, s) & 1023, v10 = hash32(gx + 1, gy, s) & 1023;
  const v01 = hash32(gx, gy + 1, s) & 1023, v11 = hash32(gx + 1, gy + 1, s) & 1023;
  const a = v00 * (cell - wx) + v10 * wx;
  const b = v01 * (cell - wx) + v11 * wx;
  return Math.trunc((a * (cell - wy) + b * wy) / c2);
}

/** Share of the map under water (percent) before start regions are levelled. */
export const WATER_PERCENT = 12;

/**
 * @typedef {Object} Feature
 * @property {'tree'|'pile'|'shaft'|'spot'} kind
 * @property {number} x @property {number} y
 * @property {string} [res]
 * @property {number} [player] player for whom the spot is intended
 */

/**
 * @param {number} seed
 * @param {{ size?: number, players?: number }} [opts]
 */
export function generateMap(seed, opts = {}) {
  const size = opts.size ?? 96;
  const playerCount = opts.players ?? 2;
  const rng = new Rng(seed ^ 0x5eed);
  const map = new TileMap(size, size);

  // Heights
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = 4 * valueNoise(x, y, 32, seed) + 2 * valueNoise(x, y, 16, seed + 1) + valueNoise(x, y, 8, seed + 2);
    map.heights[map.idx(x, y)] = Math.trunc((n * 2) / 7);
  }

  // Water level as a percentile, so that every map has a similar amount of water.
  const sorted = Array.from(map.heights).sort((a, b) => a - b);
  const waterLevel = sorted[Math.trunc((sorted.length * WATER_PERCENT) / 100)];

  // Start positions in the corners (up to 4 players).
  const corners = [[16, 16], [size - 17, size - 17], [size - 17, 16], [16, size - 17]];
  const starts = [];
  for (let p = 0; p < playerCount; p++) starts.push({ x: corners[p % 4][0], y: corners[p % 4][1] });

  // Level start regions and later settlement regions.
  const flatten = (cx, cy, r) => {
    let sum = 0, cnt = 0;
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (!map.inBounds(x, y)) continue;
      sum += map.heights[map.idx(x, y)]; cnt++;
    }
    const target = Math.max(Math.trunc(sum / cnt), waterLevel + 160);
    const inner = Math.trunc((r * 2) / 3);
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (!map.inBounds(x, y)) continue;
      const d = isqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d > r) continue;
      const k = map.idx(x, y);
      if (d <= inner) map.heights[k] = target;
      else {
        const w = d - inner, span = r - inner;
        map.heights[k] = Math.trunc((target * (span - w) + map.heights[k] * w) / span);
      }
    }
  };
  for (const s of starts) flatten(s.x, s.y, 14);

  // Additional settlement areas between start and map centre
  const mid = size >> 1;
  const expansions = [];
  for (let p = 0; p < playerCount; p++) {
    const s = starts[p];
    for (const t of [40, 70]) {
      const ex = s.x + Math.trunc(((mid - s.x) * t) / 100);
      const ey = s.y + Math.trunc(((mid - s.y) * t) / 100) + (t === 70 ? (p % 2 ? -10 : 10) : 0);
      flatten(ex, ey, 6);
      expansions.push({ x: ex, y: ey, player: p });
    }
  }

  // water
  for (let k = 0; k < size * size; k++) if (map.heights[k] < waterLevel) map.flags[k] |= WATER;

  /** @type {Feature[]} */
  const features = [];
  const taken = (x, y, w, h) => !map.rectFree(x, y, w, h);
  const claim = (x, y, w, h) => map.reserve(x, y, w, h);

  // Castle spots and start settlement spot
  const hqs = [];
  for (let p = 0; p < playerCount; p++) {
    const s = starts[p];
    const dir = s.x < mid ? 1 : -1;
    const hq = { x: s.x - 2, y: s.y - 2, player: p };
    claim(hq.x - 1, hq.y - 1, 7, 7);
    hqs.push(hq);
    const sx = dir > 0 ? s.x + 5 : s.x - 8;
    features.push({ kind: 'spot', x: sx, y: s.y - 2, player: p });
    claim(sx, s.y - 2, 4, 4);
  }
  for (const e of expansions) {
    if (!taken(e.x - 2, e.y - 2, 4, 4)) {
      features.push({ kind: 'spot', x: e.x - 2, y: e.y - 2, player: e.player });
      claim(e.x - 2, e.y - 2, 4, 4);
    }
  }

  // Shafts and resource piles around every start
  const placeNear = (cx, cy, rMin, rMax, w, h) => {
    for (let tries = 0; tries < 400; tries++) {
      const x = cx + rng.range(-rMax, rMax), y = cy + rng.range(-rMax, rMax);
      const d = isqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d < rMin || d > rMax) continue;
      if (taken(x - 1, y - 1, w + 2, h + 2)) continue;
      return { x, y };
    }
    return null;
  };
  for (let p = 0; p < playerCount; p++) {
    const s = starts[p];
    for (const res of ['clay', 'stone', 'iron', 'iron', 'sulfur', 'sulfur']) {
      const pos = placeNear(s.x, s.y, 12, 20, 3, 3);
      if (pos) { features.push({ kind: 'shaft', res, x: pos.x, y: pos.y, player: p }); claim(pos.x, pos.y, 3, 3); }
    }
    for (const res of ['clay', 'clay', 'stone', 'stone', 'iron', 'sulfur']) {
      const pos = placeNear(s.x, s.y, 7, 12, 1, 1);
      if (pos) { features.push({ kind: 'pile', res, x: pos.x, y: pos.y, player: p }); claim(pos.x, pos.y, 1, 1); }
    }
  }

  // Forests: noise decides the density, start regions stay free, nearby groves guaranteed.
  for (let y = 2; y < size - 2; y++) for (let x = 2; x < size - 2; x++) {
    if (taken(x, y, 1, 1)) continue;
    let nearStart = false;
    for (const s of starts) if ((x - s.x) ** 2 + (y - s.y) ** 2 < 81) nearStart = true;
    if (nearStart) continue;
    const forest = valueNoise(x, y, 12, seed + 7);
    if (forest > 640 && rng.int(100) < 40) features.push({ kind: 'tree', x, y });
    else if (rng.int(1000) < 8) features.push({ kind: 'tree', x, y });
  }
  for (const s of starts) {
    let placed = 0;
    for (let tries = 0; tries < 300 && placed < 24; tries++) {
      const pos = placeNear(s.x + (s.x < mid ? -6 : 6), s.y + (s.y < mid ? 10 : -10), 0, 5, 1, 1);
      if (pos && !features.some((f) => f.kind === 'tree' && f.x === pos.x && f.y === pos.y)) {
        features.push({ kind: 'tree', x: pos.x, y: pos.y }); placed++;
      }
    }
  }

  return { map, features, starts, hqs, waterLevel };
}
