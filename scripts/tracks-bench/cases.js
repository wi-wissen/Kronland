// Test bench for the look of tracks (docs/BODEN.md, tracks): clean track fields on a flat empty map, set directly
// (no walking figures). Five shapes × three strengths, each in its own cell. Used by scripts/tracks-bench.mjs
// (screenshots) and tests/render/trackBench.test.js (one path per shape, not several).

/** Shapes in the order of the rows. */
export const BENCH_CASES = ['straight', 'diagonal', 'bend', 'scurve', 'junction'];
/** Strengths in the order of the columns: just trodden (flattened grass), medium (earth shows), full path. */
export const BENCH_STRENGTHS = { light: 70, medium: 150, full: 255 };
/** Size of a cell in tiles (square); the shape lies in the middle with a margin of at least 2 tiles. */
export const BENCH_CELL = 16;

/**
 * Tiles of a shape in a cell of size n (8-connected like walking figures leave them).
 * @param {string} shape @param {number} [n] @returns {[number, number][]}
 */
export function shapeTiles(shape, n = BENCH_CELL) {
  const out = new Map();
  const add = (x, y) => { if (x >= 2 && y >= 2 && x < n - 2 && y < n - 2) out.set(`${x},${y}`, [x, y]); };
  const m = n >> 1;
  const line = (x0, y0, x1, y1) => {
    // Bresenham, 8-connected
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (;;) {
      add(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  if (shape === 'straight') line(2, m, n - 3, m);
  else if (shape === 'diagonal') line(2, 2, n - 3, n - 3);
  else if (shape === 'bend') { line(2, m - 2, m + 1, m - 2); line(m + 1, m - 2, m + 1, n - 3); }
  else if (shape === 'scurve') {
    let px = 2, py = m;
    for (let x = 2; x < n - 2; x++) {
      const y = Math.round(m + 2.6 * Math.sin(((x - 2) / (n - 5)) * 2 * Math.PI));
      line(px, py, x, y); px = x; py = y;
    }
  } else if (shape === 'junction') { line(2, m - 2, n - 3, m - 2); line(m, m - 2, m, n - 3); }
  else throw new Error(`unknown shape ${shape}`);
  return [...out.values()];
}

/**
 * The whole bench: map size and the strength per tile.
 * @returns {{ W: number, H: number, tracks: Uint8Array, cells: {shape: string, level: string, x: number, y: number}[] }}
 *   cells: top-left tile of each cell
 */
export function benchField() {
  const levels = Object.keys(BENCH_STRENGTHS);
  const W = BENCH_CELL * levels.length + 4, H = BENCH_CELL * BENCH_CASES.length + 4;
  const tracks = new Uint8Array(W * H);
  const cells = [];
  BENCH_CASES.forEach((shape, r) => levels.forEach((level, c) => {
    const x0 = 2 + c * BENCH_CELL, y0 = 2 + r * BENCH_CELL;
    cells.push({ shape, level, x: x0, y: y0 });
    for (const [x, y] of shapeTiles(shape)) tracks[(y0 + y) * W + x0 + x] = BENCH_STRENGTHS[level];
  }));
  return { W, H, tracks, cells };
}
