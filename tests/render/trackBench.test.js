// Track look test bench (scripts/tracks-bench/): every shape of the bench and a route walked by real serfs give ONE
// connected path in the smoothed field the shader draws from (channel B of the track texture) – never parallel strips.

import { describe, it, expect } from 'vitest';
import { packTracks, trackStages } from '../../src/render/ground.js';
import { BALANCE } from '../../src/sim/data/balance.js';
import { BENCH_CASES, BENCH_STRENGTHS, benchField, shapeTiles } from '../../scripts/tracks-bench/cases.js';
import { walkedField } from '../../scripts/tracks-bench/walked.js';

const grass = trackStages(BALANCE.ground.tracks.grass);

/** Smoothed field (0…255) per tile. */
function smoothed(W, H, tracks) {
  const out = new Uint8Array(W * H * 4);
  packTracks(tracks, out, { W, H, stages: grass });
  return (x, y) => out[(y * W + x) * 4 + 2];
}

/** Number of separate runs above `min` along a line of samples. */
const runs = (values, min) => values.reduce((n, v, i) => n + (v >= min && !(i > 0 && values[i - 1] >= min) ? 1 : 0), 0);

describe('Track bench', () => {
  it('five shapes × three strengths, each shape connected', () => {
    const f = benchField();
    expect(f.cells).toHaveLength(BENCH_CASES.length * Object.keys(BENCH_STRENGTHS).length);
    for (const shape of BENCH_CASES) {
      const tiles = shapeTiles(shape);
      // 8-connected: every tile touches another one
      for (const [x, y] of tiles) expect(tiles.some(([a, b]) => (a !== x || b !== y) && Math.abs(a - x) <= 1 && Math.abs(b - y) <= 1)).toBe(true);
    }
  });

  it('one path across every shape at full strength, diagonals as strong as straight lines', () => {
    const f = benchField();
    const B = smoothed(f.W, f.H, f.tracks);
    for (const c of f.cells.filter((c) => c.level === 'full')) {
      // a cross-section through the middle of the cell (vertical; for the junction across its stem)
      const x = c.x + (c.shape === 'junction' ? 4 : 7), col = [];
      for (let y = c.y; y < c.y + 16; y++) col.push(B(x, y));
      expect(runs(col, 160), `${c.shape}`).toBe(1);
    }
    const diag = f.cells.find((c) => c.shape === 'diagonal' && c.level === 'full');
    const straight = f.cells.find((c) => c.shape === 'straight' && c.level === 'full');
    expect(B(diag.x + 7, diag.y + 7)).toBe(B(straight.x + 7, straight.y + 8));
  });

  it('serfs walking an L-shaped route side by side give one path (a band), not parallel strips', () => {
    const w = walkedField({ minutes: 3 });
    const B = smoothed(w.W, w.H, w.tracks);
    const [a, corner, end] = w.route;
    // across the straight stretch and across the stretch after the bend
    const col = [], row = [];
    for (let y = a.y - 6; y <= a.y + 6; y++) col.push(B((a.x + corner.x) >> 1, y));
    for (let x = corner.x - 6; x <= corner.x + 6; x++) row.push(B(x, (corner.y + end.y) >> 1));
    expect(runs(col, 160)).toBe(1);
    expect(runs(row, 160)).toBe(1);
  });
});
