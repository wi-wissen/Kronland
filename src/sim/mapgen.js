// Map generator: relief (hills, valleys, mountains, rivers, lakes, coasts), cliffs, forests,
// resource piles, shafts, settlement spots and start positions.
// Fully deterministic from the seed, integer maths only.

import { Rng } from './rng.js';
import { TileMap, WATER, CLIFF, RESERVED } from './map.js';
import { BALANCE } from './data/balance.js';
import { isqrt } from './fixed.js';
import { ADDON } from './data/addon.js';

function hash32(x, y, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Value noise 0…1023 with smoothed interpolation, integers only. */
export function valueNoise(x, y, cell, s) {
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

/** Fractal noise (fBm) 0…1023 in eighth tiles: x, y are coordinates ×8. */
function fbm8(x, y, cell, octaves, s) {
  let sum = 0, wsum = 0, w = 1 << (octaves - 1);
  for (let o = 0; o < octaves; o++) {
    sum += w * valueNoise(x, y, Math.max(8, cell * 8 >> o), s + o * 101);
    wsum += w;
    w >>= 1;
  }
  return Math.trunc(sum / wsum);
}

/** Ridge noise 0…1023: sharp crests where the base noise crosses the middle. */
function ridged8(x, y, cell, s) {
  const a = 1023 - Math.abs(2 * valueNoise(x, y, cell * 8, s) - 1023);
  const b = 1023 - Math.abs(2 * valueNoise(x, y, cell * 4, s + 7) - 1023);
  const ra = (a * a) >> 10, rb = (b * b) >> 10;
  return Math.trunc((ra * 2 + rb) / 3);
}

/** Smooth falloff 1024 (centre) … 0 (edge), t = 0…1024. */
function smoothFall(t) {
  if (t <= 0) return 1024;
  if (t >= 1024) return 0;
  const u = 1024 - t;
  return (u * u * (3072 - 2 * u)) >> 20;
}

/** Share of the map under water (percent) in the lowlands, before mountains and river appear. */
export const WATER_PERCENT = 9;
/** Height difference (cm) per tile from which a slope counts as a cliff (impassable). */
export const CLIFF_SLOPE = 230;
/** Height above the water level (cm) from which peaks are impassable. */
export const PEAK_HEIGHT = 2900;
/** Possible map sizes (tiles per side). */
export const MAP_SIZES = { small: 96, medium: 128, large: 160 };

/**
 * @typedef {Object} Feature
 * @property {'tree'|'pile'|'shaft'|'spot'} kind
 * @property {number} x @property {number} y
 * @property {string} [res]
 * @property {number} [player] player for whom the spot is intended
 */

// 16 directions as integer vectors (×1000), so that no trigonometric functions are needed.
const DIRS16 = [
  [1000, 0], [924, 383], [707, 707], [383, 924], [0, 1000], [-383, 924], [-707, 707], [-924, 383],
  [-1000, 0], [-924, -383], [-707, -707], [-383, -924], [0, -1000], [383, -924], [707, -707], [924, -383],
];

/** Simple binary heap for Dijkstra (cost, then index – hence deterministic). */
class Heap {
  constructor() { this.c = []; this.i = []; }
  get size() { return this.c.length; }
  less(a, b) { return this.c[a] < this.c[b] || (this.c[a] === this.c[b] && this.i[a] < this.i[b]); }
  swap(a, b) {
    [this.c[a], this.c[b]] = [this.c[b], this.c[a]];
    [this.i[a], this.i[b]] = [this.i[b], this.i[a]];
  }
  push(cost, idx) {
    this.c.push(cost); this.i.push(idx);
    let k = this.c.length - 1;
    while (k > 0) { const p = (k - 1) >> 1; if (!this.less(k, p)) break; this.swap(k, p); k = p; }
  }
  pop() {
    const idx = this.i[0], cost = this.c[0];
    const lc = this.c.pop(), li = this.i.pop();
    if (this.c.length) {
      this.c[0] = lc; this.i[0] = li;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < this.c.length && this.less(l, m)) m = l;
        if (r < this.c.length && this.less(r, m)) m = r;
        if (m === k) break;
        this.swap(k, m); k = m;
      }
    }
    return [cost, idx];
  }
}

/**
 * @param {number} seed
 * @param {{ size?: number, players?: number }} [opts]
 */
export function generateMap(seed, opts = {}) {
  const size = opts.size ?? 96;
  const playerCount = opts.players ?? 2;
  const rng = new Rng(seed ^ 0x5eed);
  const map = new TileMap(size, size);
  const H = map.heights;
  const N = size * size;
  const S = size;
  const scale = (v) => Math.trunc((v * size) / 96); // lengths relative to the small map
  const dist = (ax, ay, bx, by) => isqrt((ax - bx) ** 2 + (ay - by) ** 2);

  // ---------- Start positions ----------
  const margin = 16 + ((size - 96) >> 4);
  const corners = [[margin, margin], [S - 1 - margin, S - 1 - margin], [S - 1 - margin, margin], [margin, S - 1 - margin]];
  const starts = [];
  for (let p = 0; p < playerCount; p++) starts.push({ x: corners[p % 4][0], y: corners[p % 4][1] });
  const mid = S >> 1;
  const minStartDist = (x, y) => { let m = 1 << 30; for (const s of starts) m = Math.min(m, dist(x, y, s.x, s.y)); return m; };

  // ---------- Lowlands: distorted fBm (hills and valleys) ----------
  const low = new Int32Array(N);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    // Domain warping: coordinates in eighth tiles, shifted by up to ±6 tiles
    const wx = x * 8 + Math.trunc(((valueNoise(x * 8, y * 8, 160, seed + 31) - 512) * 48) / 512);
    const wy = y * 8 + Math.trunc(((valueNoise(x * 8, y * 8, 160, seed + 37) - 512) * 48) / 512);
    let n = fbm8(wx, wy, 34, 4, seed);
    // fBm scatters tightly around the middle: stretch to the full range
    n = Math.max(0, Math.min(1023, 512 + (n - 512) * 9 / 4 | 0));
    // Contrast: valleys wider, hills rounder
    n = Math.trunc((n * n) / 1023 + n) >> 1;
    low[y * S + x] = Math.trunc((n * 2600) / 1023);
  }

  // Coast: randomly one map side (or none) slopes down to the sea.
  const coast = rng.int(6); // 0–3: side, otherwise no coast
  if (coast < 4) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const d = [y, S - 1 - x, S - 1 - y, x][coast];
      const reach = 7 + Math.trunc((valueNoise(x * 8, y * 8, 96, seed + 41) * 9) / 1023);
      if (d < reach) low[y * S + x] -= (reach - d) * 150;
    }
  }

  // Water level as a percentile, so that every map has a similar amount of water.
  const sorted = Array.from(low).sort((a, b) => a - b);
  const waterLevel = sorted[Math.trunc((N * WATER_PERCENT) / 100)];
  for (let k = 0; k < N; k++) H[k] = low[k];

  // ---------- Mountain massifs ----------
  /** @type {{x:number,y:number,r:number,peak:number}[]} */
  const massifs = [];
  const addMassif = (cx, cy, r, peak, sd) => {
    massifs.push({ x: cx, y: cy, r, peak });
    for (let y = Math.max(0, cy - r - 6); y < Math.min(S, cy + r + 7); y++) {
      for (let x = Math.max(0, cx - r - 6); x < Math.min(S, cx + r + 7); x++) {
        // irregular outline: radius fluctuates with noise
        const wob = valueNoise(x * 8, y * 8, 56, sd + 3) - 512;
        const d = dist(x, y, cx, cy) * 1024 + Math.trunc((wob * r * 1024 * 35) / (512 * 100));
        const f = smoothFall(Math.trunc(d / r));
        if (f <= 0) continue;
        const ridge = ridged8(x * 8, y * 8, 9, sd);
        const body = 900 + Math.trunc((ridge * (peak - 900)) / 1023);
        H[y * S + x] += Math.trunc((f * body) / 1024) + Math.trunc((f * f * 400) >> 20);
      }
    }
  };
  const candidates = [
    [S - 1 - margin, margin], [margin, S - 1 - margin], // free corners
    [mid, scale(12)], [mid, S - 1 - scale(12)], [scale(12), mid], [S - 1 - scale(12), mid], // edge midpoints
    [mid, mid],
  ];
  const freeSites = candidates.filter(([x, y]) => minStartDist(x, y) >= Math.trunc((size * 38) / 100));
  // Shuffle with the seed
  for (let i = freeSites.length - 1; i > 0; i--) { const j = rng.int(i + 1); [freeSites[i], freeSites[j]] = [freeSites[j], freeSites[i]]; }
  const massifCount = Math.min(freeSites.length, 1 + (size >= 128 ? 1 : 0) + (playerCount === 2 ? 1 : 0));
  for (let i = 0; i < massifCount; i++) {
    const [bx, by] = freeSites[i];
    const cx = bx + rng.range(-scale(5), scale(5)), cy = by + rng.range(-scale(5), scale(5));
    const isCenter = bx === mid && by === mid;
    const r = isCenter ? scale(10) + rng.int(3) : scale(13) + rng.int(4);
    addMassif(cx, cy, r, 3400 + rng.int(900), seed + 500 + i * 17);
  }

  // Ore mountains: one small rocky mountain per player in reach, on whose flanks the shafts lie.
  /** @type {{x:number,y:number,r:number}[]} */
  const mineHills = [];
  for (let p = 0; p < playerCount; p++) {
    const s = starts[p];
    const tx = mid - s.x, ty = mid - s.y; // direction to the map centre
    const tl = isqrt(tx * tx + ty * ty) || 1;
    const r = 7;
    const off = 20 + ((size - 96) >> 4);
    let best = null, bestScore = -1;
    const order = rng.int(16);
    for (let k = 0; k < 16; k++) {
      const [dx, dy] = DIRS16[(order + k) % 16];
      const cx = s.x + Math.trunc((dx * off) / 1000), cy = s.y + Math.trunc((dy * off) / 1000);
      if (cx < r + 3 || cy < r + 3 || cx > S - r - 4 || cy > S - r - 4) continue;
      // not exactly in the direction of the centre (the paths to the opponent run there) and far from foreign starts
      const cos = Math.trunc((dx * tx + dy * ty) / tl); // ×1000
      let other = 1 << 30;
      for (let q = 0; q < playerCount; q++) if (q !== p) other = Math.min(other, dist(cx, cy, starts[q].x, starts[q].y));
      const score = (cos < 600 ? 1000 : 0) + Math.min(other, 60) * 10 - Math.abs(cos - 200) / 4;
      if (score > bestScore) { bestScore = score; best = { x: cx, y: cy, r }; }
    }
    if (best) {
      mineHills.push(best);
      addMassif(best.x, best.y, best.r, 2300, seed + 900 + p * 13);
    }
  }

  // ---------- River: follows the valleys (Dijkstra over the heights) from map edge to map edge ----------
  const riverTiles = [];
  let fordCount = 0;
  {
    let a, b;
    const j0 = scale(14) + rng.int(scale(14)), j1 = scale(14) + rng.int(scale(14));
    if (playerCount === 2) { a = [S - 1, j0]; b = [j1, S - 1]; } // between the players (counter-diagonal)
    else { a = [mid - scale(6) + rng.int(scale(12)), 0]; b = [mid - scale(6) + rng.int(scale(12)), S - 1]; }
    const cost = (k) => {
      const x = k % S, y = (k / S) | 0;
      let c = 20 + Math.max(0, H[k] - waterLevel) / 6;
      const ds = minStartDist(x, y);
      if (ds < 22) c += (22 - ds) * 60;
      for (const m of mineHills) if (dist(x, y, m.x, m.y) < m.r + 4) c += 400;
      // large-scale noise lets the river meander instead of drawing straight lines
      return Math.trunc(c + (valueNoise(x * 8, y * 8, 64, seed + 77) >> 1) + (hash32(x, y, seed + 78) & 15));
    };
    const path = dijkstra(S, a[1] * S + a[0], b[1] * S + b[0], cost);
    // Narrow upstream, wider downstream
    for (let i = 0; i < path.length; i++) {
      const k = path[i];
      const x = k % S, y = (k / S) | 0;
      const w = i < path.length / 3 ? 1 : 2;
      riverTiles.push(k);
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= S || ny >= S) continue;
        const d = isqrt((dx * dx + dy * dy) * 100); // ×10
        const n = ny * S + nx;
        let target;
        if (d <= w * 10) target = waterLevel - 300;
        else target = waterLevel - 200 + Math.trunc(((d - w * 10) * (d - w * 10) * 7) / 10) + 100;
        if (H[n] > target) H[n] = target;
      }
    }
    // Fords: flat land bridges at two to three places
    fordCount = size >= 128 ? 3 : 2;
    for (let f = 1; f <= fordCount; f++) {
      const k = path[Math.trunc((path.length * f) / (fordCount + 1))];
      const x = k % S, y = (k / S) | 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= S || ny >= S) continue;
        const n = ny * S + nx;
        if (H[n] < waterLevel + 40) H[n] = waterLevel + 40 + (dx * dx + dy * dy) * 5;
      }
    }
  }

  // ---------- Level start areas, settlement spots and shaft ledges ----------
  const flatten = (cx, cy, r, maxTarget = 1 << 30) => {
    let sum = 0, cnt = 0;
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (!map.inBounds(x, y)) continue;
      sum += H[map.idx(x, y)]; cnt++;
    }
    const target = Math.min(maxTarget, Math.max(Math.trunc(sum / cnt), waterLevel + 160));
    const inner = Math.trunc((r * 2) / 3);
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (!map.inBounds(x, y)) continue;
      const d = isqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d > r) continue;
      const k = map.idx(x, y);
      if (d <= inner) H[k] = target;
      else {
        const w = d - inner, span = r - inner;
        H[k] = Math.trunc((target * (span - w) + H[k] * w) / span);
      }
    }
    return target;
  };
  for (const s of starts) flatten(s.x, s.y, 14, waterLevel + 700);

  // Additional settlement areas between start and map centre
  const expansions = [];
  for (let p = 0; p < playerCount; p++) {
    const s = starts[p];
    for (const t of [40, 70]) {
      const ex = s.x + Math.trunc(((mid - s.x) * t) / 100);
      const ey = s.y + Math.trunc(((mid - s.y) * t) / 100) + (t === 70 ? (p % 2 ? -10 : 10) : 0);
      flatten(ex, ey, 6, waterLevel + 900);
      expansions.push({ x: ex, y: ey, player: p });
    }
  }

  // Shafts on the flanks of the ore mountains (3×3 ledge cut into the slope)
  const shaftRes = ['clay', 'stone', 'iron', 'iron', 'sulfur', 'sulfur'];
  /** @type {{x:number,y:number,res:string,player:number}[]} */
  const shaftSites = [];
  const hqBox = (s) => ({ x: s.x - 3, y: s.y - 3, w: 7, h: 7 });
  const overlaps = (x, y, w, h, list, pad) => list.some((o) => x < o.x + o.w + pad && o.x < x + w + pad && y < o.y + o.h + pad && o.y < y + h + pad);
  for (let p = 0; p < playerCount; p++) {
    const s = starts[p], hill = mineHills[p];
    const blocked = [hqBox(s), ...shaftSites.map((q) => ({ x: q.x, y: q.y, w: 3, h: 3 }))];
    const cands = [];
    if (hill) {
      for (let y = hill.y - hill.r - 4; y <= hill.y + hill.r + 4; y++) for (let x = hill.x - hill.r - 4; x <= hill.x + hill.r + 4; x++) {
        const d = dist(x + 1, y + 1, hill.x, hill.y);
        if (d < hill.r - 2 || d > hill.r + 2) continue;
        const ds = dist(x + 1, y + 1, s.x, s.y);
        if (ds < 10 || ds > 26) continue;
        if (x < 2 || y < 2 || x + 5 > S || y + 5 > S) continue;
        // rather closer to the start and higher on the slope
        cands.push({ x, y, score: ds * 4 - Math.trunc((H[(y + 1) * S + x + 1] - waterLevel) / 60) + (hash32(x, y, seed + p) & 7) });
      }
    }
    cands.sort((a, b) => a.score - b.score || a.y - b.y || a.x - b.x);
    let placed = 0;
    for (const c of cands) {
      if (placed >= shaftRes.length) break;
      if (overlaps(c.x, c.y, 3, 3, blocked, 2)) continue;
      shaftSites.push({ x: c.x, y: c.y, res: shaftRes[placed], player: p });
      blocked.push({ x: c.x, y: c.y, w: 3, h: 3 });
      placed++;
    }
    // Fallback without a mountain: shafts in the surroundings
    for (let tries = 0; tries < 600 && placed < shaftRes.length; tries++) {
      const x = s.x + rng.range(-20, 20), y = s.y + rng.range(-20, 20);
      const d = dist(x, y, s.x, s.y);
      if (d < 12 || d > 20 || x < 2 || y < 2 || x + 5 > S || y + 5 > S) continue;
      if (overlaps(x, y, 3, 3, blocked, 2)) continue;
      shaftSites.push({ x, y, res: shaftRes[placed], player: p });
      blocked.push({ x, y, w: 3, h: 3 });
      placed++;
    }
  }
  for (const sh of shaftSites) flatten(sh.x + 1, sh.y + 1, 3);

  // ---------- Determine water and cliffs, ensure connections ----------
  const computeFlags = () => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const k = y * S + x;
      let f = 0;
      if (H[k] < waterLevel) f |= WATER;
      else {
        const hl = H[y * S + Math.max(0, x - 1)], hr = H[y * S + Math.min(S - 1, x + 1)];
        const hu = H[Math.max(0, y - 1) * S + x], hd = H[Math.min(S - 1, y + 1) * S + x];
        const g = Math.max(Math.abs(hr - hl), Math.abs(hd - hu));
        if (g > 2 * CLIFF_SLOPE || H[k] > waterLevel + PEAK_HEIGHT) f |= CLIFF;
      }
      map.flags[k] = f;
    }
  };
  const passable = (k) => !(map.flags[k] & (WATER | CLIFF));
  const label = (from) => {
    const seen = new Uint8Array(N);
    if (!passable(from)) return seen;
    const q = [from]; seen[from] = 1;
    for (let qi = 0; qi < q.length; qi++) {
      const k = q[qi], x = k % S, y = (k / S) | 0;
      if (x > 0 && !seen[k - 1] && passable(k - 1)) { seen[k - 1] = 1; q.push(k - 1); }
      if (x < S - 1 && !seen[k + 1] && passable(k + 1)) { seen[k + 1] = 1; q.push(k + 1); }
      if (y > 0 && !seen[k - S] && passable(k - S)) { seen[k - S] = 1; q.push(k - S); }
      if (y < S - 1 && !seen[k + S] && passable(k + S)) { seen[k + S] = 1; q.push(k + S); }
    }
    return seen;
  };
  /** Create a walkable path from a to b: ramp through cliffs, ford through water. */
  const carve = (a, b) => {
    const path = dijkstra(S, a, b, (k) => {
      const f = map.flags[k];
      if (f & WATER) return 90 + Math.max(0, waterLevel - H[k]) / 4;
      if (f & CLIFF) return 70 + Math.max(0, H[k] - waterLevel) / 30;
      return 10;
    });
    const L = 150;
    const t = path.map((k) => Math.max(waterLevel + 90, Math.min(waterLevel + PEAK_HEIGHT - 300, H[k])));
    for (let i = 1; i < t.length; i++) t[i] = Math.max(t[i - 1] - L, Math.min(t[i - 1] + L, t[i]));
    for (let i = t.length - 2; i >= 0; i--) t[i] = Math.max(t[i + 1] - L, Math.min(t[i + 1] + L, t[i]));
    // Round brush (distance ×10) with slightly fluctuating width, so that passes and fords look natural
    const want = new Int32Array(N), wd = new Int32Array(N).fill(1 << 20);
    path.forEach((k, i) => {
      const x = k % S, y = (k / S) | 0;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= S || ny >= S) continue;
        const n = ny * S + nx;
        const d = isqrt((dx * dx + dy * dy) * 100) - Math.trunc((valueNoise(nx * 8, ny * 8, 24, seed + 61) * 10) / 1023);
        if (d < wd[n]) { wd[n] = d; want[n] = t[i]; }
      }
    });
    for (let k = 0; k < N; k++) {
      const d = wd[k];
      if (d > 38 || minStartDist(k % S, (k / S) | 0) <= 9) continue; // start plateau stays level
      if (d <= 18) H[k] = want[k];
      else H[k] = Math.trunc((want[k] * (38 - d) + H[k] * (d - 18)) / 20);
    }
  };

  computeFlags();
  const startIdx = (s) => s.y * S + s.x;
  // Connect all starts with each other
  for (let round = 0; round < 8; round++) {
    const seen = label(startIdx(starts[0]));
    const miss = starts.find((s) => !seen[startIdx(s)]);
    if (!miss) break;
    carve(startIdx(starts[0]), startIdx(miss));
    computeFlags();
  }
  // Connect shafts and settlement spots with the own start
  const ringReach = (seen, x, y, w, h) => {
    for (let j = y - 1; j <= y + h; j++) for (let i = x - 1; i <= x + w; i++) {
      if (!map.inBounds(i, j)) continue;
      const inside = i >= x && i < x + w && j >= y && j < y + h;
      if (!inside && seen[j * S + i]) return true;
    }
    return false;
  };
  const padFree = (x, y, w, h) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (map.flags[j * S + i] & (WATER | CLIFF)) return false;
    return true;
  };
  for (let round = 0; round < 12; round++) {
    let fixed = false;
    const seen = label(startIdx(starts[0]));
    for (const sh of shaftSites) {
      if (padFree(sh.x, sh.y, 3, 3) && ringReach(seen, sh.x, sh.y, 3, 3)) continue;
      flatten(sh.x + 1, sh.y + 1, 3);
      computeFlags();
      if (!ringReach(label(startIdx(starts[0])), sh.x, sh.y, 3, 3)) carve(startIdx(starts[sh.player]), (sh.y + 1) * S + sh.x + 1);
      fixed = true;
      break;
    }
    if (!fixed) for (const e of expansions) {
      if (padFree(e.x - 2, e.y - 2, 4, 4) && ringReach(seen, e.x - 2, e.y - 2, 4, 4)) continue;
      carve(startIdx(starts[e.player]), e.y * S + e.x);
      fixed = true;
      break;
    }
    if (!fixed) break;
    computeFlags();
    // Re-check starts after a ramp
    const s2 = label(startIdx(starts[0]));
    const miss = starts.find((s) => !s2[startIdx(s)]);
    if (miss) { carve(startIdx(starts[0]), startIdx(miss)); computeFlags(); }
  }

  /** @type {Feature[]} */
  const features = [];
  const reach = label(startIdx(starts[0]));
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
  /** Find a free, level and reachable spot w×h near (cx,cy) (spiral, deterministic). */
  const findPad = (cx, cy, w, h, rMax, minStart = 0) => {
    for (let r = 0; r <= rMax; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx, y = cy + dy;
        if (taken(x - 1, y - 1, w + 2, h + 2)) continue;
        if (map.slope(x, y, w, h) > BALANCE.maxSlope || !ringReach(reach, x, y, w, h)) continue;
        if (minStart && minStartDist(x + (w >> 1), y + (h >> 1)) < minStart) continue;
        return { x, y };
      }
    }
    return null;
  };
  for (const e of expansions) {
    const pos = findPad(e.x - 2, e.y - 2, 4, 4, 14, 12);
    if (pos) {
      features.push({ kind: 'spot', x: pos.x, y: pos.y, player: e.player });
      claim(pos.x, pos.y, 4, 4);
    }
  }
  const shaftCount = new Array(playerCount).fill(0);
  for (const sh of shaftSites) {
    if (taken(sh.x, sh.y, 3, 3) || !ringReach(reach, sh.x, sh.y, 3, 3)) continue;
    features.push({ kind: 'shaft', res: sh.res, x: sh.x, y: sh.y, player: sh.player });
    claim(sh.x, sh.y, 3, 3);
    shaftCount[sh.player]++;
  }
  // Add missing shafts in the surroundings of the start
  for (let p = 0; p < playerCount; p++) {
    const s = starts[p], hill = mineHills[p];
    const have = new Set(features.filter((f) => f.kind === 'shaft' && f.player === p).map((f) => f.res));
    const missing = shaftRes.filter((r, i) => i >= shaftCount[p] || !have.has(r)).slice(0, shaftRes.length - shaftCount[p]);
    for (const res of missing) {
      const cx = hill ? s.x + Math.trunc(((hill.x - s.x) * 60) / 100) : s.x + 12, cy = hill ? s.y + Math.trunc(((hill.y - s.y) * 60) / 100) : s.y;
      const pos = findPad(cx, cy, 3, 3, 14, 9);
      if (!pos) continue;
      features.push({ kind: 'shaft', res, x: pos.x, y: pos.y, player: p });
      claim(pos.x, pos.y, 3, 3);
    }
  }

  // Resource piles around each start (stone and iron rather towards the ore mountain)
  const placeNear = (cx, cy, rMin, rMax, w, h) => {
    for (let tries = 0; tries < 400; tries++) {
      const x = cx + rng.range(-rMax, rMax), y = cy + rng.range(-rMax, rMax);
      const d = dist(x, y, cx, cy);
      if (d < rMin || d > rMax) continue;
      if (taken(x - 1, y - 1, w + 2, h + 2)) continue;
      if (!ringReach(reach, x, y, w, h)) continue;
      return { x, y };
    }
    return null;
  };
  for (let p = 0; p < playerCount; p++) {
    const s = starts[p], hill = mineHills[p];
    for (const res of ['clay', 'clay', 'stone', 'stone', 'iron', 'sulfur']) {
      let pos = null;
      if (hill && res !== 'clay') {
        const hx = s.x + Math.trunc(((hill.x - s.x) * 45) / 100), hy = s.y + Math.trunc(((hill.y - s.y) * 45) / 100);
        pos = placeNear(hx, hy, 0, 5, 1, 1);
      }
      pos ??= placeNear(s.x, s.y, 7, 12, 1, 1) ?? placeNear(s.x, s.y, 6, 16, 1, 1);
      if (pos) { features.push({ kind: 'pile', res, x: pos.x, y: pos.y, player: p }); claim(pos.x, pos.y, 1, 1); }
    }
  }

  // ---------- Forests: groves with clearings, loose single trees ----------
  const treeAt = new Uint8Array(N);
  const addTree = (x, y) => { treeAt[y * S + x] = 1; features.push({ kind: 'tree', x, y }); };
  const nearStart = (x, y, r2) => starts.some((s) => (x - s.x) ** 2 + (y - s.y) ** 2 < r2);
  const freeForTree = (x, y) => {
    if (x < 2 || y < 2 || x >= S - 2 || y >= S - 2) return false;
    const k = y * S + x;
    if (treeAt[k] || map.flags[k] & (WATER | CLIFF | 2 | 4)) return false;
    // Leave a border free around shafts, settlement spots and cliffs (no overgrown rock niches)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (map.flags[k + dy * S + dx] & (RESERVED | CLIFF)) return false;
    return true;
  };
  for (let y = 2; y < S - 2; y++) for (let x = 2; x < S - 2; x++) {
    if (!freeForTree(x, y) || nearStart(x, y, 100)) continue;
    const alt = H[y * S + x] - waterLevel;
    const forest = fbm8(x * 8, y * 8, 15, 2, seed + 7);
    const clearing = valueNoise(x * 8, y * 8, 40, seed + 8);
    let chance = 0; // per mille
    if (forest > 600 && clearing < 760) chance = Math.min(520, 120 + (forest - 600) * 2);
    else if (forest > 520) chance = 40;
    else chance = 6;
    if (alt < 60) chance >>= 2; // not directly at the shore
    if (alt > 1800) chance = Math.trunc(chance / 2); // thinner at altitude
    if (rng.int(1000) < chance) addTree(x, y);
  }
  // Guaranteed copses near each start (wood is the first bottleneck) and a minimum stock per player,
  // so that all start areas have a similar amount of wood.
  const treesNear = (s, r) => {
    let n = 0;
    for (let y = Math.max(0, s.y - r); y <= Math.min(S - 1, s.y + r); y++) for (let x = Math.max(0, s.x - r); x <= Math.min(S - 1, s.x + r); x++) {
      if (treeAt[y * S + x] && (x - s.x) ** 2 + (y - s.y) ** 2 <= r * r) n++;
    }
    return n;
  };
  const MIN_WOOD = 70; // trees within radius 25 around each start
  for (const s of starts) {
    const groves = [[s.x < mid ? -6 : 6, s.y < mid ? 11 : -11], [s.x < mid ? 11 : -11, s.y < mid ? -6 : 6]];
    for (let g = 0; g < 8 && treesNear(s, 25) < MIN_WOOD; g++) {
      // more groves in turn in all directions
      if (g >= 2) {
        const [dx, dy] = DIRS16[(g * 5 + rng.int(3)) % 16];
        groves.push([Math.trunc((dx * (13 + rng.int(8))) / 1000), Math.trunc((dy * (13 + rng.int(8))) / 1000)]);
      }
      const [ox, oy] = groves[g];
      let placed = 0;
      for (let tries = 0; tries < 220 && placed < 18; tries++) {
        const x = s.x + ox + rng.range(-4, 4), y = s.y + oy + rng.range(-4, 4);
        if (!map.inBounds(x, y) || !freeForTree(x, y) || !reach[y * S + x] || nearStart(x, y, 64)) continue;
        if (taken(x, y, 1, 1)) continue;
        addTree(x, y); placed++;
      }
    }
  }

  // ---------- Check with trees and piles: clear overgrown chokepoints again ----------
  const blockedTile = new Uint8Array(N);
  for (const f of features) if (f.kind === 'tree' || f.kind === 'pile') blockedTile[f.y * S + f.x] = 1;
  for (const hq of hqs) for (let j = hq.y; j < hq.y + 5; j++) for (let i = hq.x; i < hq.x + 5; i++) blockedTile[j * S + i] = 1;
  const open = (k) => !blockedTile[k] && !(map.flags[k] & (WATER | CLIFF));
  const flood = (from) => {
    const seen = new Uint8Array(N);
    const q = [from]; seen[from] = 1;
    for (let qi = 0; qi < q.length; qi++) {
      const k = q[qi], x = k % S;
      for (const n of [x > 0 ? k - 1 : -1, x < S - 1 ? k + 1 : -1, k - S, k + S]) {
        if (n < 0 || n >= N || seen[n] || !open(n)) continue;
        seen[n] = 1; q.push(n);
      }
    }
    return seen;
  };
  const entry = (x, y, w, h) => {
    for (let j = y - 1; j <= y + h; j++) for (let i = x - 1; i <= x + w; i++) {
      if (!map.inBounds(i, j) || (i >= x && i < x + w && j >= y && j < y + h)) continue;
      if (!(map.flags[j * S + i] & (WATER | CLIFF))) return j * S + i;
    }
    return -1;
  };
  const targets = [];
  for (let p = 0; p < playerCount; p++) targets.push([hqs[p].x, hqs[p].y, 5, 5]);
  for (const f of features) {
    if (f.kind === 'shaft') targets.push([f.x, f.y, 3, 3]);
    else if (f.kind === 'spot') targets.push([f.x, f.y, 4, 4]);
    else if (f.kind === 'pile') targets.push([f.x, f.y, 1, 1]);
  }
  const removed = new Set();
  const origin = entry(...targets[0]);
  for (let round = 0; round < 40; round++) {
    const seen = flood(origin);
    const miss = targets.find(([x, y, w, h]) => {
      for (let j = y - 1; j <= y + h; j++) for (let i = x - 1; i <= x + w; i++) {
        if (map.inBounds(i, j) && !(i >= x && i < x + w && j >= y && j < y + h) && seen[j * S + i]) return false;
      }
      return true;
    });
    if (!miss) break;
    const goal = entry(...miss);
    if (goal < 0) break;
    const path = dijkstra(S, origin, goal, (k) => (map.flags[k] & (WATER | CLIFF) ? 1e6 : blockedTile[k] ? 50 : 1));
    for (const k of path) {
      if (!blockedTile[k] || map.flags[k] & RESERVED) continue;
      if (treeAt[k]) { treeAt[k] = 0; blockedTile[k] = 0; removed.add(k); }
    }
  }
  // Leave out trees that no serf can reach (enclosed between cliffs)
  // (only terrain counts: inner forest trees become reachable as soon as the outer ones are felled)
  for (let k = 0; k < N; k++) if (treeAt[k]) blockedTile[k] = 0;
  const seenFinal = flood(origin);
  const reachableTree = (x, y) => {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < S && ny < S && seenFinal[ny * S + nx]) return true;
    }
    return false;
  };
  const finalFeatures = features.filter((f) => f.kind !== 'tree' || (!removed.has(f.y * S + f.x) && reachableTree(f.x, f.y)));

  // Bridge sites (add-on): pure extra data, do not change the map
  const bridges = findBridgeSites(map, riverTiles, fordCount, ADDON.bridge);
  return { map, features: finalFeatures, starts, hqs, waterLevel, massifs, mineHills, river: riverTiles, bridges };
}

/**
 * Bridge sites along the river: per section between fords (and river ends) the shortest straight
 * crossing (horizontal or vertical, 2 tiles wide) with solid bank at both ends. Deterministic,
 * no randomness. Result: rectangles of water tiles only.
 * @param {TileMap} map @param {number[]} river river course (tile indices) @param {number} fordCount
 * @returns {{x:number,y:number,w:number,h:number}[]}
 */
export function findBridgeSites(map, river, fordCount, opts = { minLen: 2, maxLen: 9, spacing: 12 }) {
  const S = map.width, out = [];
  if (!river.length) return out;
  const flag = (x, y) => (map.inBounds(x, y) ? map.flags[y * S + x] : CLIFF);
  const water = (x, y) => !!(flag(x, y) & WATER);
  const shore = (x, y) => x > 0 && y > 0 && x < S - 1 && y < map.height - 1 && !(flag(x, y) & (WATER | CLIFF));
  /** Water stretch of a row/column through (along, across) in direction dir: [a, b] or null. */
  const run = (along, across, dir) => {
    const at = (k) => (dir === 0 ? water(k, across) : water(across, k));
    if (!at(along)) return null;
    let a = along, b = along;
    while (at(a - 1) && along - a <= opts.maxLen) a--;
    while (at(b + 1) && b - along <= opts.maxLen) b++;
    return [a, b];
  };
  /** Crossing through (cx,cy): horizontal (dir 0) or vertical (dir 1), two tiles wide. */
  const crossing = (cx, cy, dir) => {
    const along = dir === 0 ? cx : cy, across = dir === 0 ? cy : cx;
    const r0 = run(along, across, dir);
    if (!r0) return null;
    // second row: water at the same place (banks may be offset by one tile)
    const r1 = run(along, across + 1, dir);
    if (!r1 || Math.abs(r0[0] - r1[0]) > 1 || Math.abs(r0[1] - r1[1]) > 1) return null;
    const A = Math.min(r0[0], r1[0]), B = Math.max(r0[1], r1[1]);
    const len = B - A + 1;
    if (len < opts.minLen || len > opts.maxLen) return null;
    const pt = (k, t) => (dir === 0 ? [k, t] : [t, k]);
    for (const t of [across, across + 1]) {
      if (!shore(...pt(A - 1, t)) || !shore(...pt(B + 1, t))) return null;
      for (let k = A; k <= B; k++) if (flag(...pt(k, t)) & CLIFF) return null;
    }
    return dir === 0 ? { x: A, y: across, w: len, h: 2, len } : { x: across, y: A, w: 2, h: len, len };
  };
  // Per section between the fords the shortest crossing (on a tie near the section centre)
  const n = fordCount + 1;
  for (let seg = 0; seg < n; seg++) {
    const i0 = Math.trunc((river.length * seg) / n) + 3, i1 = Math.trunc((river.length * (seg + 1)) / n) - 3;
    const mid = (i0 + i1) >> 1;
    let best = null;
    for (let i = i0; i <= i1; i++) {
      if (i < 0 || i >= river.length) continue;
      const cx = river[i] % S, cy = (river[i] / S) | 0;
      for (const dir of [0, 1]) for (const off of [0, -1]) {
        const c = crossing(dir === 0 ? cx : cx + off, dir === 0 ? cy + off : cy, dir);
        if (!c) continue;
        const score = c.len * 1000 + Math.abs(i - mid);
        if (out.some((o) => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) < opts.spacing)) continue;
        if (!best || score < best.score) best = { ...c, score };
      }
    }
    if (best) out.push({ x: best.x, y: best.y, w: best.w, h: best.h });
  }
  return out;
}

/**
 * Cheapest 4-neighbourhood path from a to b. Cost per entered tile from cost(k).
 * @param {number} S map width @param {number} a @param {number} b
 * @param {(k:number)=>number} cost
 * @returns {number[]} tile indices from a to b
 */
function dijkstra(S, a, b, cost) {
  const N = S * S;
  const g = new Float64Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const heap = new Heap();
  g[a] = 0; heap.push(0, a);
  while (heap.size) {
    const [c, k] = heap.pop();
    if (c > g[k]) continue;
    if (k === b) break;
    const x = k % S;
    const nb = [x > 0 ? k - 1 : -1, x < S - 1 ? k + 1 : -1, k - S, k + S];
    for (const n of nb) {
      if (n < 0 || n >= N) continue;
      const nc = c + Math.trunc(cost(n));
      if (nc < g[n]) { g[n] = nc; from[n] = k; heap.push(nc, n); }
    }
  }
  const path = [];
  for (let k = b; k !== -1; k = from[k]) { path.push(k); if (k === a) break; }
  return path.reverse();
}
