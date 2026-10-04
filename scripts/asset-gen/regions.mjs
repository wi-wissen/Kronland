// Regions of a character per triangle: head (via skin weights), face, hair, beard.
// Basis for the face on the flat-coloured game model and for recolouring the beard.
// Coordinates as in the model: Y up, facing +Z, metres.

import { rgbToLab } from './palette.mjs';

const HEAD_JOINTS = /^(head|head_end|headfront|headtop_end)$/i;

/**
 * Properties per triangle.
 * @param {{ pos: ArrayLike<number>, uv: ArrayLike<number>, idx: ArrayLike<number>, joints?: ArrayLike<number>, weights?: ArrayLike<number> }} g
 * @param {string[]} jointNames bone names in the order of the skin indices
 * @param {(u:number, v:number) => number[]} sample colour (RGB 0–255) at a UV position
 */
export function triangleInfo(g, jointNames, sample) {
  const head = new Set(jointNames.map((n, i) => (HEAD_JOINTS.test(n) ? i : -1)).filter((i) => i >= 0));
  const nt = g.idx.length / 3;
  const out = [];
  for (let t = 0; t < nt; t++) {
    const v = [g.idx[t * 3], g.idx[t * 3 + 1], g.idx[t * 3 + 2]];
    const P = v.map((i) => [g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2]]);
    const c = [0, 1, 2].map((k) => (P[0][k] + P[1][k] + P[2][k]) / 3);
    const u = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], w = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const len = Math.hypot(...n) || 1;
    let hw = 0;
    if (g.joints && g.weights) for (const i of v) for (let k = 0; k < 4; k++) if (head.has(g.joints[i * 4 + k])) hw += g.weights[i * 4 + k] / 3;
    const U = [0, 1].map((k) => (g.uv[v[0] * 2 + k] + g.uv[v[1] * 2 + k] + g.uv[v[2] * 2 + k]) / 3);
    const rgb = sample(U[0], U[1]);
    out.push({ c, n: n.map((x) => x / len), area: len / 2, headW: hw, rgb, lab: rgbToLab(...rgb) });
  }
  return out;
}

/**
 * Head, face, hair, beard per triangle.
 * - Head: mostly bound to head bones
 * - Face: head, facing forward, below the hairline (the upper quarter of the head stays hair/cap)
 * - Skin: light and warm; hair: head, no skin, back half; beard: head, no skin, front-bottom, dark
 * @param {ReturnType<typeof triangleInfo>} info @param {(i:number) => boolean} isMarker team area?
 */
export function headRegions(info, isMarker = () => false) {
  const n = info.length;
  const head = info.map((x) => x.headW > 0.6);
  let y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  info.forEach((x, i) => { if (head[i]) { y0 = Math.min(y0, x.c[1]); y1 = Math.max(y1, x.c[1]); z0 = Math.min(z0, x.c[2]); z1 = Math.max(z1, x.c[2]); } });
  const H = Math.max(1e-6, y1 - y0), zc = (z0 + z1) / 2;
  const skin = info.map((x) => x.lab[0] > 58 && x.lab[1] > 4 && x.lab[2] > 8);
  const face = [], hair = [], beard = [];
  for (let i = 0; i < n; i++) {
    const x = info[i];
    const rel = (x.c[1] - y0) / H;
    face.push(head[i] && !isMarker(i) && x.n[2] > 0.25 && x.c[2] > zc && rel < 0.75);
    hair.push(head[i] && !isMarker(i) && !skin[i] && x.c[2] < zc && rel > 0.25);
    beard.push(head[i] && !isMarker(i) && !skin[i] && x.c[2] > zc - 0.1 * H && rel < 0.5 && x.lab[0] < 50);
  }
  return { head, face, hair, beard, skin, box: { y0, y1, z0, z1 } };
}

/** Area-weighted Lab mean of a selection. */
export function meanLab(info, sel) {
  let L = 0, a = 0, b = 0, w = 0;
  info.forEach((x, i) => { if (sel[i]) { L += x.lab[0] * x.area; a += x.lab[1] * x.area; b += x.lab[2] * x.area; w += x.area; } });
  return w ? [L / w, a / w, b / w] : null;
}

/**
 * Match the beard to the hair colour: Lab shift by (hair − beard), gradations stay.
 * Weighted by similarity to the beard colour so that skin at the edge of the beard triangles stays unchanged.
 * @param {number[]} lab colour of the pixel @param {number[]} beard @param {number[]} hair
 * @returns {number[]} new Lab colour
 */
export function shiftBeard(lab, beard, hair, sigma = 22) {
  const d2 = (lab[0] - beard[0]) ** 2 + (lab[1] - beard[1]) ** 2 + (lab[2] - beard[2]) ** 2;
  const w = Math.exp(-d2 / (2 * sigma * sigma));
  return [lab[0] + (hair[0] - beard[0]) * w, lab[1] + (hair[1] - beard[1]) * w, lab[2] + (hair[2] - beard[2]) * w];
}

/**
 * Neighbouring triangles (shared edge; vertices at the same position count as one, also across UV seams).
 * @param {ArrayLike<number>} pos @param {ArrayLike<number>} idx @returns {number[][]}
 */
export function triangleAdjacency(pos, idx) {
  const key = (i) => `${Math.round(pos[i * 3] * 1e4)},${Math.round(pos[i * 3 + 1] * 1e4)},${Math.round(pos[i * 3 + 2] * 1e4)}`;
  const vid = new Map(), ids = [];
  for (let i = 0; i < pos.length / 3; i++) { const k = key(i); if (!vid.has(k)) vid.set(k, vid.size); ids.push(vid.get(k)); }
  const edges = new Map();
  const nt = idx.length / 3;
  for (let t = 0; t < nt; t++) {
    const v = [ids[idx[t * 3]], ids[idx[t * 3 + 1]], ids[idx[t * 3 + 2]]];
    for (let e = 0; e < 3; e++) {
      const a = v[e], b = v[(e + 1) % 3];
      const k = a < b ? a * 1e7 + b : b * 1e7 + a;
      (edges.get(k) ?? edges.set(k, []).get(k)).push(t);
    }
  }
  const nb = Array.from({ length: nt }, () => []);
  for (const list of edges.values()) for (const a of list) for (const b of list) if (a !== b) nb[a].push(b);
  return nb;
}

/**
 * Team area per triangle: safe triangles (fraction of pure marker colour) as seeds, then grown via neighbours by
 * triangles that mostly carry the marker colour darkened by Meshy (carmine/burgundy).
 * Red areas not connected to the team area stay as they are.
 * @param {Float32Array} strict fraction of pure marker colour per triangle @param {Float32Array} relaxed fraction incl. carmine
 * @param {number[][]} nb neighbours @param {{ seed?: number, grow?: number, steps?: number }} [o]
 */
export function growMarker(strict, relaxed, nb, o = {}) {
  const n = strict.length;
  const m = Array.from({ length: n }, (_, t) => strict[t] >= (o.seed ?? 0.15));
  for (let it = 0; it < (o.steps ?? 4); it++) {
    let added = 0;
    const next = m.slice();
    for (let t = 0; t < n; t++) {
      if (m[t] || relaxed[t] < (o.grow ?? 0.4)) continue;
      if (nb[t].some((j) => m[j])) { next[t] = true; added++; }
    }
    for (let t = 0; t < n; t++) m[t] = next[t];
    if (!added) break;
  }
  return m;
}
