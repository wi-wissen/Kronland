// Impostor math (src/render/impostor.js): hemi-octahedral layout covers every camera tilt and rotation; the view
// selection blends the views around the actual direction.
import { describe, it, expect } from 'vitest';
import { hemiOctEncode, hemiOctDecode, viewDir, viewBasis, viewBlend, IMPOSTOR_GRID } from '../../src/render/impostor.js';

const norm = (v) => Math.hypot(...v);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const dirFrom = (yaw, pitch) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];

describe('hemi-octahedral mapping', () => {
  it('decode(encode(d)) = d over the whole upper hemisphere', () => {
    for (let yaw = 0; yaw < Math.PI * 2; yaw += 0.37) for (const pitch of [0.02, 0.3, 0.45, 0.95, 1.2, 1.5, Math.PI / 2]) {
      const d = dirFrom(yaw, pitch);
      const back = hemiOctDecode(...hemiOctEncode(...d));
      for (let k = 0; k < 3; k++) expect(back[k]).toBeCloseTo(d[k], 5);
    }
  });
  it('codes lie in [-1, 1]² and the view directions point upwards', () => {
    for (let j = 0; j < IMPOSTOR_GRID; j++) for (let i = 0; i < IMPOSTOR_GRID; i++) {
      const d = viewDir(i, j);
      expect(norm(d)).toBeCloseTo(1, 6);
      expect(d[1]).toBeGreaterThanOrEqual(0);
    }
    for (const d of [dirFrom(0, 0), dirFrom(2, 0.1), [0, 1, 0]]) for (const e of hemiOctEncode(...d)) expect(Math.abs(e)).toBeLessThanOrEqual(1 + 1e-9);
  });
});

describe('view basis', () => {
  it('right, up and the view direction are orthonormal, also straight from above', () => {
    for (const d of [viewDir(0, 0), viewDir(3, 5), [0, 1, 0], dirFrom(1, 0)]) {
      const { right, up } = viewBasis(/** @type {[number, number, number]} */ (d));
      expect(norm(right)).toBeCloseTo(1, 6);
      expect(norm(up)).toBeCloseTo(1, 6);
      expect(dot(right, up)).toBeCloseTo(0, 6);
      expect(dot(right, d)).toBeCloseTo(0, 6);
      expect(dot(up, d)).toBeCloseTo(0, 6);
    }
  });
  it('the image is upright for side views (up has a positive y component)', () => {
    for (let yaw = 0; yaw < 6.2; yaw += 0.5) expect(viewBasis(/** @type {any} */ (dirFrom(yaw, 0.6))).up[1]).toBeGreaterThan(0);
  });
});

describe('view selection', () => {
  it('weights sum to 1 and the nearest view carries the most weight', () => {
    for (let yaw = 0; yaw < Math.PI * 2; yaw += 0.29) for (const pitch of [0.3, 0.45, 0.95, 1.5]) {
      const d = dirFrom(yaw, pitch);
      const { cells, weights } = viewBlend(/** @type {any} */ (d));
      expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
      const best = cells[weights.indexOf(Math.max(...weights))];
      // the heaviest view is close to the actual direction (grid spacing of 8 views over the hemisphere)
      expect(dot(viewDir(best[0], best[1]), d)).toBeGreaterThan(0.85);
    }
  });
  it('a direction exactly on a view centre selects only that view', () => {
    const { cells, weights } = viewBlend(viewDir(5, 2));
    expect(cells[weights.indexOf(Math.max(...weights))]).toEqual([5, 2]);
    expect(Math.max(...weights)).toBeCloseTo(1, 6);
  });
  it('flat views (camera close to the ground) still find a view near the horizon', () => {
    const d = dirFrom(0.8, 0.05);
    const { cells, weights } = viewBlend(/** @type {any} */ (d));
    const best = cells[weights.indexOf(Math.max(...weights))];
    expect(viewDir(best[0], best[1])[1]).toBeLessThan(0.35);
  });
});
