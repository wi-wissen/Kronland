// Flat colours per triangle (game model): instead of the painted Meshy texture each triangle gets one of a few
// palette colours (like KayKit/Synty). From game height (below ~80 px figure height) painted folds are just noise;
// large, clearly separated colour areas read better and stand out from the ground. postprocess.mjs then paints the
// colours into the figure's UV layout (texraster.mjs).
//
// Procedure per mesh
//  1. Colour per triangle from the original texture (mean of centroid and corners), marker fraction (magenta).
//  2. k-means in Lab on the non-marker triangles (area-weighted, deterministic start values).
//  3. Smoothing over neighbouring triangles (majority, area-weighted) – removes speckles.
//  4. Palette colours more vivid (saturation, brightness steps), marker triangles → own neutral swatch.

// ---------- Colour space ----------

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const gam = (c) => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)));

export function rgbToLab(r, g, b) {
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, y = 0.2126 * R + 0.7152 * G + 0.0722 * B, z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export function labToRgb(L, a, b) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const x = inv(fx) * 0.95047, y = inv(fy), z = inv(fz) * 1.08883;
  const R = 3.2406 * x - 1.5372 * y - 0.4986 * z, G = -0.9689 * x + 1.8758 * y + 0.0415 * z, B = 0.0557 * x - 0.204 * y + 1.057 * z;
  return [gam(R), gam(G), gam(B)];
}

// ---------- k-means ----------

/**
 * Weighted k-means (Lab). Start values deterministic: heaviest point, then each time the farthest
 * one (weighted) – no randomness, same input → same palette.
 * @param {Float32Array} pts Lab triples @param {Float32Array} w weights @param {number} k
 */
export function kmeans(pts, w, k, iters = 24) {
  const n = w.length;
  const c = [];
  let best = 0;
  for (let i = 1; i < n; i++) if (w[i] > w[best]) best = i;
  c.push([pts[best * 3], pts[best * 3 + 1], pts[best * 3 + 2]]);
  const d2 = (i, q) => (pts[i * 3] - q[0]) ** 2 + (pts[i * 3 + 1] - q[1]) ** 2 + (pts[i * 3 + 2] - q[2]) ** 2;
  while (c.length < Math.min(k, n)) {
    let far = 0, fd = -1;
    for (let i = 0; i < n; i++) {
      let m = Infinity;
      for (const q of c) m = Math.min(m, d2(i, q));
      const s = m * Math.sqrt(w[i]);
      if (s > fd) { fd = s; far = i; }
    }
    c.push([pts[far * 3], pts[far * 3 + 1], pts[far * 3 + 2]]);
  }
  const label = new Int32Array(n);
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < n; i++) {
      let bi = 0, bd = Infinity;
      for (let j = 0; j < c.length; j++) { const d = d2(i, c[j]); if (d < bd) { bd = d; bi = j; } }
      label[i] = bi;
    }
    const acc = c.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) { const a = acc[label[i]]; a[0] += pts[i * 3] * w[i]; a[1] += pts[i * 3 + 1] * w[i]; a[2] += pts[i * 3 + 2] * w[i]; a[3] += w[i]; }
    acc.forEach((a, j) => { if (a[3] > 0) c[j] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; });
  }
  return { centers: c, label };
}

// ---------- Main function ----------

/**
 * @param {{ data: Buffer, w: number, h: number }} tex original texture (RGB, raw)
 * @param {{ pos: ArrayLike<number>, uv: ArrayLike<number>, idx: ArrayLike<number> }[]} prims
 * @param {(r:number,g:number,b:number)=>number} markerWeight
 * @param {{ colors?: number, smooth?: number, saturation?: number, markerThreshold?: number, markerTris?: boolean[][], extra?: string[] }} opt
 *   extra: further colour swatches (#rrggbb), e.g. for tools; markerTris: preset team area per mesh and triangle
 * @returns {{ labels: Int32Array[], palette: number[][], marker: number, extra: number[], neighbors: number[][], area: Float64Array }}
 */
export function paletteize(tex, prims, markerWeight, opt = {}) {
  const K = opt.colors ?? 14;
  const sample = (u, v) => {
    const x = Math.min(tex.w - 1, Math.max(0, Math.floor(u * tex.w))), y = Math.min(tex.h - 1, Math.max(0, Math.floor(v * tex.h)));
    const o = (y * tex.w + x) * 3;
    return [tex.data[o], tex.data[o + 1], tex.data[o + 2]];
  };
  // 1. Colour, area and marker fraction per triangle (all meshes together)
  const tris = [];
  for (const [pi, p] of prims.entries()) {
    for (let t = 0; t < p.idx.length; t += 3) {
      const ia = p.idx[t], ib = p.idx[t + 1], ic = p.idx[t + 2];
      const P = (i) => [p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]];
      const [a, b, c] = [P(ia), P(ib), P(ic)];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const area = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
      // sample points: centroid + towards the corners
      const U = (i) => [p.uv[i * 2], p.uv[i * 2 + 1]];
      const [ua, ub, uc] = [U(ia), U(ib), U(ic)];
      let r = 0, g = 0, bl = 0, mk = 0, n = 0;
      for (const [wa, wb, wc] of [[1 / 3, 1 / 3, 1 / 3], [0.6, 0.2, 0.2], [0.2, 0.6, 0.2], [0.2, 0.2, 0.6]]) {
        const s = sample(ua[0] * wa + ub[0] * wb + uc[0] * wc, ua[1] * wa + ub[1] * wb + uc[1] * wc);
        r += lin(s[0]); g += lin(s[1]); bl += lin(s[2]); mk += markerWeight(s[0], s[1], s[2]); n++;
      }
      const rgb = [gam(r / n), gam(g / n), gam(bl / n)];
      const forced = opt.markerTris?.[pi]?.[t / 3];
      tris.push({ prim: pi, t: t / 3, area, rgb, lab: rgbToLab(...rgb), marker: forced ?? mk / n >= (opt.markerThreshold ?? 0.3) });
    }
  }
  // 2. k-means on non-marker triangles
  const plain = tris.filter((x) => !x.marker);
  const pts = new Float32Array(plain.length * 3), w = new Float32Array(plain.length);
  plain.forEach((x, i) => { pts.set(x.lab, i * 3); w[i] = x.area + 1e-9; });
  const { centers, label } = kmeans(pts, w, K);
  plain.forEach((x, i) => { x.label = label[i]; });
  const MARKER = centers.length;
  for (const x of tris) if (x.marker) x.label = MARKER;
  // Clusters from the fringes of the marker area (Meshy mixes magenta with neighbouring colours into carmine/burgundy):
  // hue 280°–360° with clear saturation → also team area
  centers.forEach((c, j) => {
    const [r, g, b] = labToRgb(...c);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max !== r && max !== b) return;
    const h = max === r ? (60 * (g - b)) / (max - min || 1) : 240 + (60 * (r - g)) / (max - min || 1);
    const hue = (h + 360) % 360;
    if (hue >= 280 && (max - min) / max > 0.35) for (const x of tris) if (x.label === j) { x.label = MARKER; x.marker = true; }
  });

  // 3. Smoothing over neighbours (shared edge, vertices welded by position)
  const key = (p, i) => `${Math.round(p.pos[i * 3] * 1e4)},${Math.round(p.pos[i * 3 + 1] * 1e4)},${Math.round(p.pos[i * 3 + 2] * 1e4)}`;
  const vid = new Map(), edges = new Map();
  const triOf = new Map(); // prim:t → tris index
  tris.forEach((x, i) => triOf.set(`${x.prim}:${x.t}`, i));
  for (const [pi, p] of prims.entries()) {
    const ids = [];
    for (let i = 0; i < p.pos.length / 3; i++) { const k = key(p, i); if (!vid.has(k)) vid.set(k, vid.size); ids.push(vid.get(k)); }
    for (let t = 0; t < p.idx.length; t += 3) {
      const ti = triOf.get(`${pi}:${t / 3}`);
      const v = [ids[p.idx[t]], ids[p.idx[t + 1]], ids[p.idx[t + 2]]];
      for (let e = 0; e < 3; e++) {
        const a = v[e], b = v[(e + 1) % 3];
        const ek = a < b ? `${a}_${b}` : `${b}_${a}`;
        (edges.get(ek) ?? edges.set(ek, []).get(ek)).push(ti);
      }
    }
  }
  const nb = tris.map(() => []);
  for (const list of edges.values()) for (const a of list) for (const b of list) if (a !== b) nb[a].push(b);
  for (let it = 0; it < (opt.smooth ?? 5); it++) {
    const next = tris.map((x, i) => {
      if (x.marker) return x.label; // team areas stay sharp
      const votes = new Map([[x.label, x.area * 1.5]]);
      for (const j of nb[i]) if (!tris[j].marker) votes.set(tris[j].label, (votes.get(tris[j].label) ?? 0) + tris[j].area);
      let bl = x.label, bv = -1;
      for (const [l, v] of votes) if (v > bv) { bv = v; bl = l; }
      return bl;
    });
    tris.forEach((x, i) => { x.label = next[i]; });
  }

  // 4. Palette colours: more vivid (saturation in Lab), brightness slightly stretched
  const sat = opt.saturation ?? 1.3;
  const palette = centers.map(([L, a, b]) => labToRgb(Math.min(96, 50 + (L - 50) * 1.12 + 3), a * sat, b * sat));
  palette.push([140, 140, 140]); // marker → neutral grey, becomes the player colour
  const extra = (opt.extra ?? []).map((hex) => { const c = parseInt(hex.slice(1), 16); palette.push([c >> 16, (c >> 8) & 255, c & 255]); return palette.length - 1; });

  const labels = prims.map((p) => new Int32Array(p.idx.length / 3));
  for (const x of tris) labels[x.prim][x.t] = x.label;
  // Neighbours and areas per triangle (first mesh only; for post-processing of the team areas)
  const neighbors = tris.filter((x) => x.prim === 0).map((x, i) => nb[i]);
  const area = Float64Array.from(tris.filter((x) => x.prim === 0).map((x) => x.area));
  return { labels, palette, marker: MARKER, extra, neighbors, area };
}
