// Rasterise triangles in UV space: every pixel of the texture knows which triangle it belongs to.
// This lets colours and masks be painted into the texture per triangle without bleeding across the borders of the
// UV islands into foreign areas (cause of the blue streaks with the earlier mask dilation).

/**
 * @param {ArrayLike<number>} uv UV per vertex (glTF: v from the top) @param {ArrayLike<number>} idx triangle indices
 * @param {number} W @param {number} H
 * @returns {Int32Array} triangle number per pixel, −1 = free
 */
export function rasterTriangles(uv, idx, W, H) {
  const id = new Int32Array(W * H).fill(-1);
  const nt = idx.length / 3;
  for (let t = 0; t < nt; t++) {
    const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
    const ax = uv[a * 2] * W, ay = uv[a * 2 + 1] * H, bx = uv[b * 2] * W, by = uv[b * 2 + 1] * H, cx = uv[c * 2] * W, cy = uv[c * 2 + 1] * H;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    let hit = false;
    if (Math.abs(area) > 1e-9) {
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
      const s = area > 0 ? 1 : -1, eps = -1e-6 * Math.abs(area);
      for (let y = y0; y <= y1; y++) {
        const py = y + 0.5;
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5;
          const w0 = s * ((bx - px) * (cy - py) - (by - py) * (cx - px));
          const w1 = s * ((cx - px) * (ay - py) - (cy - py) * (ax - px));
          const w2 = s * ((ax - px) * (by - py) - (ay - py) * (bx - px));
          if (w0 >= eps && w1 >= eps && w2 >= eps) { id[y * W + x] = t; hit = true; }
        }
      }
    }
    // Tiny triangle with no pixel centre hit: at least the pixel at the centroid, if free
    if (!hit) {
      const x = Math.min(W - 1, Math.max(0, Math.floor((ax + bx + cx) / 3))), y = Math.min(H - 1, Math.max(0, Math.floor((ay + by + cy) / 3)));
      if (id[y * W + x] < 0) id[y * W + x] = t;
    }
  }
  return id;
}

/**
 * Fill free pixels (edges of the UV islands) from occupied neighbours so that filters and mipmaps at the
 * island edges see the right colour. Also modifies `id` (filled pixels then belong to the neighbour).
 * @param {Int32Array} id @param {number} W @param {number} H
 * @param {{ data: Uint8Array|Buffer, ch: number }[]} layers image data that is filled along
 * @param {number} [passes]
 */
export function fillGutters(id, W, H, layers, passes = 4) {
  for (let p = 0; p < passes; p++) {
    const src = Int32Array.from(id);
    let changed = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (src[i] >= 0) continue;
      let n = -1;
      if (x > 0 && src[i - 1] >= 0) n = i - 1;
      else if (x < W - 1 && src[i + 1] >= 0) n = i + 1;
      else if (y > 0 && src[i - W] >= 0) n = i - W;
      else if (y < H - 1 && src[i + W] >= 0) n = i + W;
      if (n < 0) continue;
      id[i] = src[n];
      for (const l of layers) for (let c = 0; c < l.ch; c++) l.data[i * l.ch + c] = l.data[n * l.ch + c];
      changed++;
    }
    if (!changed) break;
  }
}
