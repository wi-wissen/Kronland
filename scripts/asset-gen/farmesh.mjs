// Put the far model onto the near model's skeleton.
//
// The far model is a dedicated, deliberately simplified Meshy model (few triangles, hair as a single block)
// without its own rig. It is fitted to the near model's rest pose (same height, feet at y = 0,
// same centre), then each vertex gets the skin weights of the nearest vertices of the near model
// (k nearest neighbours, weighted by distance). That way all levels run with the same skeleton and the same
// animations, tools included.

/**
 * @param {{ pos: Float32Array, joints: ArrayLike<number>, weights: ArrayLike<number> }} near near model (rest pose)
 * @param {Float32Array} pos vertices of the far model (already fitted)
 * @param {number} [k] neighbours
 * @returns {{ joints: Uint16Array, weights: Float32Array }}
 */
export function transferWeights(near, pos, k = 4) {
  const n = pos.length / 3, m = near.pos.length / 3;
  // grid over the near model's vertices (fast neighbour search)
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m; i++) for (let c = 0; c < 3; c++) { min[c] = Math.min(min[c], near.pos[i * 3 + c]); max[c] = Math.max(max[c], near.pos[i * 3 + c]); }
  const cell = Math.max(1e-4, Math.cbrt(((max[0] - min[0]) * (max[1] - min[1]) * (max[2] - min[2]) || 1) / Math.max(1, m)) * 2);
  const key = (x, y, z) => `${x},${y},${z}`;
  const ci = (v, c) => Math.floor((v - min[c]) / cell);
  const grid = new Map();
  for (let i = 0; i < m; i++) {
    const kk = key(ci(near.pos[i * 3], 0), ci(near.pos[i * 3 + 1], 1), ci(near.pos[i * 3 + 2], 2));
    (grid.get(kk) ?? grid.set(kk, []).get(kk)).push(i);
  }
  const joints = new Uint16Array(n * 4), weights = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const cx = ci(x, 0), cy = ci(y, 1), cz = ci(z, 2);
    let best = [];
    for (let r = 1; r < 64 && best.length < k; r++) {
      best = [];
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
        for (const i of grid.get(key(cx + dx, cy + dy, cz + dz)) ?? []) {
          const d = (near.pos[i * 3] - x) ** 2 + (near.pos[i * 3 + 1] - y) ** 2 + (near.pos[i * 3 + 2] - z) ** 2;
          best.push([d, i]);
        }
      }
    }
    best.sort((a, b) => a[0] - b[0]);
    const acc = new Map();
    for (const [d, i] of best.slice(0, k)) {
      const w = 1 / (Math.sqrt(d) + 1e-3);
      for (let c = 0; c < 4; c++) {
        const j = near.joints[i * 4 + c], wj = near.weights[i * 4 + c];
        if (wj > 0) acc.set(j, (acc.get(j) ?? 0) + wj * w);
      }
    }
    const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((s, [, w]) => s + w, 0) || 1;
    top.forEach(([j, w], c) => { joints[v * 4 + c] = j; weights[v * 4 + c] = w / sum; });
  }
  return { joints, weights };
}

/**
 * Fit the far model to the near model's rest pose: same height (feet at 0), same centre in X/Z.
 * @param {Float32Array} pos (is copied) @param {Float32Array} nearPos
 */
export function fitTo(pos, nearPos) {
  const box = (p) => {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.length; i += 3) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], p[i + c]); hi[c] = Math.max(hi[c], p[i + c]); }
    return { lo, hi };
  };
  const a = box(pos), b = box(nearPos);
  const s = (b.hi[1] - b.lo[1]) / Math.max(1e-6, a.hi[1] - a.lo[1]);
  const out = new Float32Array(pos.length);
  const cxA = (a.lo[0] + a.hi[0]) / 2, czA = (a.lo[2] + a.hi[2]) / 2, cxB = (b.lo[0] + b.hi[0]) / 2, czB = (b.lo[2] + b.hi[2]) / 2;
  for (let i = 0; i < pos.length; i += 3) {
    out[i] = (pos[i] - cxA) * s + cxB;
    out[i + 1] = (pos[i + 1] - a.lo[1]) * s + b.lo[1];
    out[i + 2] = (pos[i + 2] - czA) * s + czB;
  }
  return out;
}
