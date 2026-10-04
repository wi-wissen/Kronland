// Tools (axe, hammer, pickaxe …) as small meshes made of boxes and cylinders.
// Coloured via swatches in a strip that postprocess.mjs appends to the bottom of the character texture.
// Dimensions in metres, handle along +Z (points forward out of the fist), origin = grip point.

/** Swatches of the strip (order = column). */
export const SWATCHES = {
  wood: '#8a5a33', woodDark: '#5e3c22', steel: '#a7adb3', steelDark: '#6d747b', leather: '#4a2f1d', stone: '#8d8a83',
};
export const SWATCH_KEYS = Object.keys(SWATCHES);

/**
 * Mesh building blocks. Each returns { pos: number[], nrm: number[], sw: string } (non-indexed triangles).
 */
function box(cx, cy, cz, sx, sy, sz, sw) {
  const pos = [], nrm = [];
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const faces = [
    [[1, 0, 0], [[hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], [hx, -hy, hz]]],
    [[-1, 0, 0], [[-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz], [-hx, -hy, -hz]]],
    [[0, 1, 0], [[-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz]]],
    [[0, -1, 0], [[-hx, -hy, hz], [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz]]],
    [[0, 0, 1], [[hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz], [-hx, -hy, hz]]],
    [[0, 0, -1], [[-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz], [hx, -hy, -hz]]],
  ];
  for (const [n, q] of faces) for (const i of [0, 1, 2, 0, 2, 3]) {
    pos.push(cx + q[i][0], cy + q[i][1], cz + q[i][2]);
    nrm.push(...n);
  }
  return { pos, nrm, sw };
}

/** Cylinder along Z from z0 to z1. */
function cylZ(x, y, z0, z1, r, sw, seg = 6) {
  const pos = [], nrm = [];
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const p = (a, z) => [x + Math.cos(a) * r, y + Math.sin(a) * r, z];
    const n = (a) => [Math.cos(a), Math.sin(a), 0];
    const quad = [[p(a0, z0), n(a0)], [p(a1, z0), n(a1)], [p(a1, z1), n(a1)], [p(a0, z1), n(a0)]];
    for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(...quad[k][0]); nrm.push(...quad[k][1]); }
    // caps
    for (const [z, s] of [[z0, -1], [z1, 1]]) {
      const tri = s > 0 ? [[x, y, z], p(a0, z), p(a1, z)] : [[x, y, z], p(a1, z), p(a0, z)];
      for (const v of tri) { pos.push(...v); nrm.push(0, 0, s); }
    }
  }
  return { pos, nrm, sw };
}

/** Axe blade in the Y-Z plane, edge towards −Y: two boxes, wider and thinner towards the edge. */
function blade(cz, w0, w1, depth, thick, sw) {
  return [box(0, -depth * 0.3, cz, thick, depth * 0.6, w0, sw), box(0, -depth * 0.78, cz, thick * 0.6, depth * 0.45, w1, sw)];
}

/** Tools. Grip point at the origin, shaft along +Z, head in front (swing direction −Y). */
export const TOOLS = {
  Axe: () => [
    cylZ(0, 0, -0.12, 0.62, 0.016, 'wood'),
    ...blade(0.55, 0.09, 0.16, 0.16, 0.022, 'steel'),
    box(0, 0.03, 0.55, 0.03, 0.05, 0.06, 'steelDark'),
  ],
  Hammer: () => [
    cylZ(0, 0, -0.08, 0.30, 0.014, 'wood'),
    box(0, -0.01, 0.30, 0.055, 0.13, 0.055, 'steelDark'),
  ],
  Pickaxe: () => [
    cylZ(0, 0, -0.12, 0.58, 0.016, 'wood'),
    box(0, -0.09, 0.56, 0.026, 0.2, 0.036, 'steel'),
    box(0, 0.08, 0.57, 0.022, 0.16, 0.03, 'steel'),
    box(0, -0.2, 0.53, 0.018, 0.05, 0.026, 'steelDark'),
  ],
};

/**
 * Tool as a triangle list with UV into the swatch and vertex colours.
 * @param {string} name @param {(sw:string)=>[number,number]} uvOf swatch → UV centre
 */
export function buildTool(name, uvOf = () => [0, 0]) {
  const parts = TOOLS[name]();
  const pos = [], nrm = [], uv = [], col = [];
  for (const p of parts) {
    pos.push(...p.pos); nrm.push(...p.nrm);
    const [u, v] = uvOf(p.sw);
    const c = parseInt(SWATCHES[p.sw].slice(1), 16);
    for (let i = 0; i < p.pos.length / 3; i++) { uv.push(u, v); col.push((c >> 16) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255); }
  }
  // col: sRGB 0–1 per vertex (for game models with vertex colours)
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), uv: new Float32Array(uv), col: new Float32Array(col) };
}
