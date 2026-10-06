// Determine the opening of a pit from the model geometry (pure computation, without Three.js – testable under Node).
//
// Procedure: lay the triangles on a grid from above (per cell the highest surface up to just above the ground disc;
// posts, beams, buckets above do not count), cells below the ground disc or without a surface are "deep".
// From outside by flood fill remove everything deep that is connected to the edge (gaps in the rim up to 2 cells
// are bridged) – what remains is the hole inside the rim wall. Islands in the hole (bucket, ladder) are
// filled, the mask blurred and read out by marching squares as a smooth, non-convex contour.
// For the texture: distance of each hole cell to the edge (dark earth at the edge → black in the middle).

/**
 * @typedef {{minX: number, maxX: number, minZ: number, maxZ: number}} Bounds
 * @typedef {{n: number, bounds: Bounds, mask: Uint8Array, cover: Float32Array, edge: number, dist: Float32Array, loops: number[][][]}} PitShape
 */

const NEG = -Infinity;

/**
 * Highest surface per cell up to `capY` (seen from above).
 * @param {ArrayLike<number>} tris triangles as x,y,z × 3 per triangle
 * @param {Bounds} b @param {number} n grid n × n @param {number} capY
 */
export function surfaceGrid(tris, b, n, capY) {
  const top = new Float32Array(n * n).fill(NEG);
  const sx = n / (b.maxX - b.minX), sz = n / (b.maxZ - b.minZ);
  const put = (x, y, z) => {
    if (y > capY) return;
    const i = Math.floor((x - b.minX) * sx), j = Math.floor((z - b.minZ) * sz);
    if (i < 0 || j < 0 || i >= n || j >= n) return;
    if (y > top[j * n + i]) top[j * n + i] = y;
  };
  for (let t = 0; t + 8 < tris.length; t += 9) {
    const ax = tris[t], ay = tris[t + 1], az = tris[t + 2], bx = tris[t + 3], by = tris[t + 4], bz = tris[t + 5];
    const cx = tris[t + 6], cy = tris[t + 7], cz = tris[t + 8];
    if (ay > capY && by > capY && cy > capY) continue;
    // walk the edges in half cells (so vertical walls also hit every cell)
    for (const [px, py, pz, qx, qy, qz] of [[ax, ay, az, bx, by, bz], [bx, by, bz, cx, cy, cz], [cx, cy, cz, ax, ay, az]]) {
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(qx - px) * sx, Math.abs(qz - pz) * sz) * 2));
      for (let s = 0; s <= steps; s++) { const f = s / steps; put(px + (qx - px) * f, py + (qy - py) * f, pz + (qz - pz) * f); }
    }
    // interior: cell centres in the triangle (barycentric)
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(det) < 1e-12) continue;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - b.minX) * sx)), i1 = Math.min(n - 1, Math.floor((Math.max(ax, bx, cx) - b.minX) * sx));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - b.minZ) * sz)), j1 = Math.min(n - 1, Math.floor((Math.max(az, bz, cz) - b.minZ) * sz));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = b.minX + (i + 0.5) / sx, z = b.minZ + (j + 0.5) / sz;
      const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det, l3 = 1 - l1 - l2;
      if (l1 < 0 || l2 < 0 || l3 < 0) continue;
      put(x, l1 * ay + l2 * by + l3 * cy, z);
    }
  }
  return top;
}

/** Grow a mask by r cells (square neighbourhood). @param {Uint8Array} m @param {number} n @param {number} r */
export function dilate(m, n, r) {
  const out = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (!m[j * n + i]) continue;
    for (let y = Math.max(0, j - r); y <= Math.min(n - 1, j + r); y++) for (let x = Math.max(0, i - r); x <= Math.min(n - 1, i + r); x++) out[y * n + x] = 1;
  }
  return out;
}

/** Flood fill (4-neighbourhood) from the start cells over passable cells. */
function flood(n, pass, starts) {
  const seen = new Uint8Array(n * n), stack = [];
  for (const s of starts) if (pass(s) && !seen[s]) { seen[s] = 1; stack.push(s); }
  while (stack.length) {
    const c = stack.pop(), i = c % n, j = (c - i) / n;
    for (const d of [i > 0 ? c - 1 : -1, i < n - 1 ? c + 1 : -1, j > 0 ? c - n : -1, j < n - 1 ? c + n : -1]) {
      if (d >= 0 && !seen[d] && pass(d)) { seen[d] = 1; stack.push(d); }
    }
  }
  return seen;
}

const borderCells = (n) => { const s = []; for (let k = 0; k < n; k++) s.push(k, (n - 1) * n + k, k * n, k * n + n - 1); return s; };

/**
 * Hole mask: deep cells (below lowY or empty) that are not connected to the outer edge.
 * @param {Float32Array} top result of surfaceGrid @param {number} n @param {number} lowY
 * @param {{gap?: number, minCells?: number}} [o] gap: bridged gaps in the rim (cells), minCells: smallest hole area
 */
export function holeMask(top, n, lowY, { gap = 2, minCells = 6 } = {}) {
  const low = new Uint8Array(n * n), solid = new Uint8Array(n * n);
  for (let c = 0; c < n * n; c++) { if (top[c] < lowY) low[c] = 1; else solid[c] = 1; }
  // outside: flood fill from the edge, narrow gaps in the rim blocked; then grow by the block width into deep cells
  const wall = dilate(solid, n, gap);
  const out0 = flood(n, (c) => !wall[c], borderCells(n));
  const grow = dilate(out0, n, gap + 1);
  const hole = new Uint8Array(n * n);
  for (let c = 0; c < n * n; c++) hole[c] = low[c] && !grow[c] ? 1 : 0;
  // drop pieces that are too small (noise between stones)
  const seen = new Uint8Array(n * n);
  for (let c = 0; c < n * n; c++) {
    if (!hole[c] || seen[c]) continue;
    const part = flood(n, (d) => hole[d] === 1, [c]);
    const cells = [];
    for (let d = 0; d < n * n; d++) if (part[d]) { cells.push(d); seen[d] = 1; }
    if (cells.length < minCells) for (const d of cells) hole[d] = 0;
  }
  // fill islands in the hole (bucket, ladder, beam foot): everything that cannot be reached from outside without the hole
  const outer = flood(n, (c) => !hole[c], borderCells(n));
  for (let c = 0; c < n * n; c++) if (!outer[c]) hole[c] = 1;
  return hole;
}

/**
 * Keep only open holes: pieces that are mostly covered from above (hut, charcoal pile) and small
 * secondary holes next to the main hole are dropped.
 * @param {Uint8Array} mask @param {Float32Array} topAll highest surface per cell without upper limit @param {number} n @param {number} capY
 */
export function openHoles(mask, topAll, n, capY, { covered = 0.6, share = 0.2 } = {}) {
  const parts = [], seen = new Uint8Array(n * n);
  for (let c = 0; c < n * n; c++) {
    if (!mask[c] || seen[c]) continue;
    const part = flood(n, (d) => mask[d] === 1, [c]), cells = [];
    let roof = 0;
    for (let d = 0; d < n * n; d++) if (part[d]) { cells.push(d); seen[d] = 1; if (topAll[d] > capY) roof++; }
    if (roof / cells.length < covered) parts.push(cells);
  }
  const biggest = Math.max(0, ...parts.map((p) => p.length));
  const out = new Uint8Array(n * n);
  for (const p of parts) if (p.length >= biggest * share) for (const d of p) out[d] = 1;
  return out;
}

/** Distance (cells, chamfer 3-4) of each hole cell to the nearest non-hole cell. @param {Uint8Array} m @param {number} n */
export function insideDistance(m, n) {
  const BIG = 1e9, d = new Float32Array(n * n);
  for (let c = 0; c < n * n; c++) d[c] = m[c] ? BIG : 0;
  const at = (i, j) => (i < 0 || j < 0 || i >= n || j >= n ? 0 : d[j * n + i]);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const c = j * n + i; if (!d[c]) continue;
    d[c] = Math.min(d[c], at(i - 1, j) + 3, at(i, j - 1) + 3, at(i - 1, j - 1) + 4, at(i + 1, j - 1) + 4);
  }
  for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) {
    const c = j * n + i; if (!d[c]) continue;
    d[c] = Math.min(d[c], at(i + 1, j) + 3, at(i, j + 1) + 3, at(i + 1, j + 1) + 4, at(i - 1, j + 1) + 4);
  }
  for (let c = 0; c < n * n; c++) d[c] /= 3;
  return d;
}

/** Box blur (r cells), twice ≈ Gaussian. @param {Float32Array} f @param {number} n @param {number} r */
export function blur(f, n, r) {
  let a = f;
  for (let pass = 0; pass < 2; pass++) {
    const h = new Float32Array(n * n), v = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      let s = 0; for (let k = -r; k <= r; k++) s += a[j * n + Math.min(n - 1, Math.max(0, i + k))]; h[j * n + i] = s / (2 * r + 1);
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      let s = 0; for (let k = -r; k <= r; k++) s += h[Math.min(n - 1, Math.max(0, j + k)) * n + i]; v[j * n + i] = s / (2 * r + 1);
    }
    a = v;
  }
  return a;
}

/**
 * Closed contours (marching squares) of the field at iso; points in grid coordinates (cell centre = i + 0.5).
 * The field is padded with 0 on the outside, so every contour closes.
 * @param {Float32Array} f @param {number} n @param {number} iso @returns {number[][][]}
 */
export function contours(f, n, iso) {
  const val = (i, j) => (i < 0 || j < 0 || i >= n || j >= n ? 0 : f[j * n + i]);
  const pts = new Map(), adj = new Map();
  const edgePoint = (key, i0, j0, i1, j1) => {
    if (!pts.has(key)) {
      const a = val(i0, j0), b = val(i1, j1), t = a === b ? 0.5 : (iso - a) / (b - a);
      pts.set(key, [i0 + 0.5 + (i1 - i0) * t, j0 + 0.5 + (j1 - j0) * t]);
    }
    return key;
  };
  const link = (a, b) => { (adj.get(a) ?? adj.set(a, []).get(a)).push(b); (adj.get(b) ?? adj.set(b, []).get(b)).push(a); };
  for (let j = -1; j < n; j++) for (let i = -1; i < n; i++) {
    const a = val(i, j) > iso, b = val(i + 1, j) > iso, c = val(i + 1, j + 1) > iso, d = val(i, j + 1) > iso;
    const k = (a ? 1 : 0) | (b ? 2 : 0) | (c ? 4 : 0) | (d ? 8 : 0);
    if (k === 0 || k === 15) continue;
    const e0 = () => edgePoint(`h${i},${j}`, i, j, i + 1, j), e1 = () => edgePoint(`v${i + 1},${j}`, i + 1, j, i + 1, j + 1);
    const e2 = () => edgePoint(`h${i},${j + 1}`, i, j + 1, i + 1, j + 1), e3 = () => edgePoint(`v${i},${j}`, i, j, i, j + 1);
    const mid = (val(i, j) + val(i + 1, j) + val(i + 1, j + 1) + val(i, j + 1)) / 4 > iso;
    switch (k) {
      case 1: case 14: link(e3(), e0()); break;
      case 2: case 13: link(e0(), e1()); break;
      case 3: case 12: link(e3(), e1()); break;
      case 4: case 11: link(e1(), e2()); break;
      case 6: case 9: link(e0(), e2()); break;
      case 7: case 8: link(e3(), e2()); break;
      case 5: if (mid) { link(e0(), e1()); link(e2(), e3()); } else { link(e3(), e0()); link(e1(), e2()); } break;
      case 10: if (mid) { link(e3(), e0()); link(e1(), e2()); } else { link(e0(), e1()); link(e2(), e3()); } break;
    }
  }
  const loops = [], used = new Set();
  for (const start of adj.keys()) {
    if (used.has(start)) continue;
    const loop = [];
    let prev = null, cur = start;
    while (cur && !used.has(cur)) {
      used.add(cur); loop.push(pts.get(cur));
      const next = adj.get(cur).find((x) => x !== prev && !used.has(x));
      prev = cur; cur = next;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

/** Area of a polygon (sign = winding direction). @param {number[][]} p */
export const polygonArea = (p) => p.reduce((s, q, k) => { const r = p[(k + 1) % p.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0) / 2;

/** Point in polygon (even/odd). */
export function pointInPolygon(x, y, p) {
  let inside = false;
  for (let k = 0, l = p.length - 1; k < p.length; l = k++) {
    if ((p[k][1] > y) !== (p[l][1] > y) && x < ((p[l][0] - p[k][0]) * (y - p[k][1])) / (p[l][1] - p[k][1]) + p[k][0]) inside = !inside;
  }
  return inside;
}

/** Chaikin smoothing (closed contour). @param {number[][]} p */
export function chaikin(p, rounds = 1) {
  for (let r = 0; r < rounds; r++) {
    const q = [];
    for (let k = 0; k < p.length; k++) {
      const a = p[k], b = p[(k + 1) % p.length];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = q;
  }
  return p;
}

/**
 * Opening of a pit from triangles in model space.
 * @param {ArrayLike<number>} tris x,y,z × 3 per triangle
 * @param {Bounds} bounds footprint of the model
 * @param {number} groundY height of the ground disc
 * @param {number} height model height (reference for the thresholds)
 * @param {{n?: number, cap?: number, low?: number, gap?: number, soft?: number, edge?: number}} [o]
 *   cap: surfaces up to groundY + cap·height count (above that posts, buckets …), low: deeper than groundY − low·height = hole,
 *   soft: blur (cells), edge: height of the contour in the blurred field (0.5 = mask edge)
 * @returns {PitShape|null} null if there is no hole inside the rim
 */
export function pitShape(tris, bounds, groundY, height, { n = 96, cap = 0.05, low = 0.008, gap = 2, soft = 1, edge = 0.12 } = {}) {
  // margin around the model so that "outside" encloses it completely
  const mx = ((bounds.maxX - bounds.minX) * (gap + 3)) / n, mz = ((bounds.maxZ - bounds.minZ) * (gap + 3)) / n;
  bounds = { minX: bounds.minX - mx, maxX: bounds.maxX + mx, minZ: bounds.minZ - mz, maxZ: bounds.maxZ + mz };
  const capY = groundY + cap * height;
  const top = surfaceGrid(tris, bounds, n, capY);
  const mask = openHoles(holeMask(top, n, groundY - low * height, { gap }), surfaceGrid(tris, bounds, n, Infinity), n, capY);
  let cells = 0;
  for (const m of mask) cells += m;
  if (cells < 6) return null;
  const f = new Float32Array(n * n);
  for (let c = 0; c < n * n; c++) f[c] = mask[c];
  // contour slightly outside the mask (edge < 0.5): there the texture fades out softly, beneath the edge of the model
  const cover = blur(f, n, soft);
  const raw = contours(cover, n, edge);
  // only outer contours (no islands in holes), drop small slivers
  const big = raw.filter((p) => Math.abs(polygonArea(p)) >= 4);
  const outer = big.filter((p) => !big.some((q) => q !== p && Math.abs(polygonArea(q)) > Math.abs(polygonArea(p)) && pointInPolygon(p[0][0], p[0][1], q)));
  if (!outer.length) return null;
  const sx = (bounds.maxX - bounds.minX) / n, sz = (bounds.maxZ - bounds.minZ) / n;
  const loops = outer.map((p) => chaikin(p).map(([i, j]) => [bounds.minX + i * sx, bounds.minZ + j * sz]));
  return { n, bounds, mask, cover, edge, dist: insideDistance(mask, n), loops };
}

/** Simple value noise (deterministic, rendering only). */
function noise(x, y) {
  const h = (i, j) => { let s = (i * 374761393 + j * 668265263) | 0; s = Math.imul(s ^ (s >>> 13), 1274126177); return ((s ^ (s >>> 16)) >>> 0) / 4294967295; };
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = h(i, j), b = h(i + 1, j), c = h(i, j + 1), d = h(i + 1, j + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** Bilinear lookup of a grid field in grid coordinates (cell centre = i + 0.5). */
function sampler(field, n) {
  return (gx, gy) => {
    const x = Math.min(n - 1, Math.max(0, gx - 0.5)), y = Math.min(n - 1, Math.max(0, gy - 0.5));
    const i = Math.min(n - 2, Math.floor(x)), j = Math.min(n - 2, Math.floor(y)), fx = x - i, fy = y - j;
    const v = (a, c) => field[c * n + a];
    return (v(i, j) * (1 - fx) + v(i + 1, j) * fx) * (1 - fy) + (v(i, j + 1) * (1 - fx) + v(i + 1, j + 1) * fx) * fy;
  };
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Rectangle around all contours (model space), with some margin. @param {PitShape} shape */
export function pitRect(shape) {
  const xs = shape.loops.flat().map((p) => p[0]), zs = shape.loops.flat().map((p) => p[1]);
  const mx = (Math.max(...xs) - Math.min(...xs)) * 0.04, mz = (Math.max(...zs) - Math.min(...zs)) * 0.04;
  return { minX: Math.min(...xs) - mx, maxX: Math.max(...xs) + mx, minZ: Math.min(...zs) - mz, maxZ: Math.max(...zs) + mz };
}

/**
 * Painted texture of the opening (RGBA, size²) over the rectangle `rect` (model space x/z): at the edge dark earth in the
 * colour `rim`, which fades out softly (alpha), towards the middle (greatest distance to the edge) black like a deep shaft,
 * in between clods of earth as noise.
 * @param {PitShape} shape @param {Bounds} rect @param {number[]} rim RGB 0–255 @param {number} [size]
 */
export function pitTexture(shape, rect, rim, size = 128) {
  const { n, bounds: b } = shape;
  let maxD = 1;
  for (const d of shape.dist) if (d > maxD) maxD = d;
  const depth = sampler(blur(shape.dist, n, 1), n), cover = sampler(shape.cover, n);
  const data = new Uint8Array(size * size * 4);
  // grain in model units (equally coarse, no matter how large the hole is)
  const cell = (b.maxX - b.minX) / n;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const mx = rect.minX + ((x + 0.5) / size) * (rect.maxX - rect.minX), mz = rect.minZ + ((y + 0.5) / size) * (rect.maxZ - rect.minZ);
    const gx = ((mx - b.minX) / (b.maxX - b.minX)) * n, gy = ((mz - b.minZ) / (b.maxZ - b.minZ)) * n;
    // 0 at the edge … 1 in the middle; from a good half depth almost black
    const t = Math.min(1, depth(gx, gy) / Math.max(2.5, maxD * 0.85));
    const light = 1 - smooth(0, 0.75, t);
    const u = mx / cell, v = mz / cell;
    const clods = noise(u * 0.9, v * 0.9) * 0.6 + noise(u * 2.3 + 17, v * 2.3) * 0.4;
    const grain = 0.55 + 0.75 * clods;
    const k = light * grain * 0.95 + 0.03 * (1 - light) + 0.02;
    const o = (y * size + x) * 4;
    data[o] = Math.min(255, rim[0] * k); data[o + 1] = Math.min(255, rim[1] * k); data[o + 2] = Math.min(255, rim[2] * k);
    data[o + 3] = Math.round(255 * smooth(shape.edge, shape.edge + 0.25, cover(gx, gy)));
  }
  return data;
}

/**
 * Gallows for a freely hanging bucket (model without supports): the highest point above the opening in the band
 * groundY + (0.15 … 0.5)·height is the hanging block; two posts stand left and right of it (x axis) on the
 * rim just outside the contour, the crossbeam runs through the block.
 * @param {ArrayLike<number>} tris @param {number[][][]} loops contours of the opening @param {number} groundY @param {number} height
 * @returns {{x0: number, x1: number, z: number, y: number, r: number}|null} posts at x0/x1, beam height y, thickness r
 */
export function hangerBeam(tris, loops, groundY, height) {
  const pts = loops.flat(), xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const hx0 = Math.min(...xs), hx1 = Math.max(...xs), hz0 = Math.min(...zs), hz1 = Math.max(...zs);
  const lo = groundY + 0.15 * height, hi = groundY + 0.5 * height;
  let top = -Infinity;
  const near = [];
  for (let k = 0; k + 2 < tris.length; k += 3) {
    const x = tris[k], y = tris[k + 1], z = tris[k + 2];
    if (y < lo || y > hi || x < hx0 || x > hx1 || z < hz0 || z > hz1) continue;
    near.push(k);
    if (y > top) top = y;
  }
  if (!near.length) return null;
  // block: points in the topmost piece (3 % of the height)
  let sx = 0, sz = 0, m = 0;
  for (const k of near) if (tris[k + 1] > top - 0.03 * height) { sx += tris[k]; sz += tris[k + 2]; m++; }
  const cx = sx / m, z = sz / m;
  // intersect the contour at the height of the block (z) left and right
  let left = hx0, right = hx1;
  for (const loop of loops) for (let a = 0; a < loop.length; a++) {
    const p = loop[a], q = loop[(a + 1) % loop.length];
    if ((p[1] > z) === (q[1] > z)) continue;
    const x = p[0] + ((z - p[1]) / (q[1] - p[1])) * (q[0] - p[0]);
    if (x < cx && x > left) left = x; else if (x >= cx && x < right) right = x;
  }
  const r = 0.016 * height, out = 2.5 * r;
  return { x0: left - out, x1: right + out, z, y: top - 0.012 * height, r };
}
