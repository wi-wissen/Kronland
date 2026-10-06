// Regions of the tile map (TileMap.regionAt): local recalculation after occupy/release must give exactly the
// result of the full calculation (canonical numbers: smallest tile index + 1).

import { describe, it, expect } from 'vitest';
import { TileMap, WATER, CLIFF, BRIDGE } from '../../src/sim/map.js';
import { Rng } from '../../src/sim/rng.js';

function randomMap(seed, W = 48, H = 40) {
  const m = new TileMap(W, H);
  const rng = new Rng(seed);
  for (let k = 0; k < W * H; k++) {
    const r = rng.int(100);
    if (r < 6) m.flags[k] |= WATER;
    else if (r < 9) m.flags[k] |= CLIFF;
  }
  // a river with a bridge
  for (let y = 0; y < H; y++) m.flags[y * W + 20] |= WATER;
  m.flags[10 * W + 20] |= BRIDGE;
  return { m, rng };
}

const fresh = (m, frozen) => m.computeRegions(frozen, null);

describe('Regions of the map', () => {
  it('local recalculation = full calculation, over many build and demolition steps', () => {
    for (const seed of [1, 2, 3]) {
      const { m, rng } = randomMap(seed);
      const W = m.width, H = m.height;
      const placed = [];
      let incremental = 0;
      for (let step = 0; step < 300; step++) {
        // now and then several changes without a query in between
        const n = 1 + rng.int(3);
        for (let i = 0; i < n; i++) {
          if (placed.length && rng.int(3) === 0) {
            const [x, y, w, h] = placed.splice(rng.int(placed.length), 1)[0];
            m.release(x, y, w, h);
          } else {
            const w = 1 + rng.int(4), h = 1 + rng.int(4), x = rng.int(W - w), y = rng.int(H - h);
            m.occupy(x, y, w, h, 1000 + step);
            placed.push([x, y, w, h]);
          }
        }
        if (m.regionCache[0].dirty.length) incremental++;
        const want = fresh(m, false);
        for (let k = 0; k < W * H; k++) if (m.landRegionAt(k) !== want[k]) throw new Error(`Seed ${seed}, step ${step}, tile ${k}: ${m.landRegionAt(k)} instead of ${want[k]}`);
        // winter: ice connects across the water
        m.frozen = step % 7 === 0;
        const wantF = fresh(m, m.frozen);
        for (let k = 0; k < W * H; k++) if (m.regionAt(k) !== wantF[k]) throw new Error(`Seed ${seed}, step ${step} (ice), tile ${k}`);
        m.frozen = false;
      }
      expect(incremental).toBeGreaterThan(200); // really calculated locally, not always everything
    }
  });

  it('numbers are canonical and stay the same for untouched regions', () => {
    const m = new TileMap(20, 10);
    for (let y = 0; y < 10; y++) m.flags[y * 20 + 10] |= CLIFF; // two halves
    const left = m.regionAt(0), right = m.regionAt(11);
    expect(left).toBe(1);
    expect(right).toBe(12);
    m.occupy(14, 0, 1, 10, 5); // split the right half
    expect(m.regionAt(0)).toBe(left);
    expect(m.regionAt(11)).toBe(right);
    expect(m.regionAt(15)).toBe(16);
    m.release(14, 0, 1, 10);
    expect(m.regionAt(15)).toBe(right);
  });

  it('other changes (version without rectangle) recalculate everything', () => {
    const m = new TileMap(12, 6);
    expect(m.regionAt(0)).toBe(1);
    for (let y = 0; y < 6; y++) m.flags[y * 12 + 5] |= WATER;
    m.version++;
    expect(m.regionAt(7)).toBe(7);
    expect(m.regionAt(0)).toBe(1);
  });
});
