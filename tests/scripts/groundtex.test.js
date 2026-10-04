// Image tools for the ground textures: make seamlessly tileable, match mean colour (scripts/asset-gen/groundtex.mjs).
import { describe, it, expect } from 'vitest';
import { makeSeamless, seamRatio, edgeWeight, meanColor, shiftMean } from '../../scripts/asset-gen/groundtex.mjs';

/** Test image with gradient (hard edges when tiling) and deterministic noise. */
function image(w, h) {
  const px = new Uint8ClampedArray(w * h * 3);
  let s = 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3, n = rnd() * 30;
    px[i] = 40 + (x / w) * 180 + n; px[i + 1] = 60 + (y / h) * 150 + n; px[i + 2] = 50 + n;
  }
  return px;
}

describe('makeSeamless', () => {
  it('tile edges afterwards do not jump more than the image interior', () => {
    const w = 96, h = 64, px = image(w, h);
    expect(seamRatio(px, w, h)).toBeGreaterThan(5); // gradient: hard seam when tiling
    const out = makeSeamless(px, w, h);
    expect(seamRatio(out, w, h)).toBeLessThan(1.5);
  });

  it('keeps the image centre unchanged and keeps size and channels', () => {
    const w = 64, h = 64, px = image(w, h);
    const out = makeSeamless(px, w, h, 3, 0.2);
    expect(out.length).toBe(px.length);
    const i = (32 * w + 32) * 3;
    expect([out[i], out[i + 1], out[i + 2]]).toEqual([px[i], px[i + 1], px[i + 2]]);
  });

  it('weight of the original: 0 at the edge, 1 in the interior, symmetric', () => {
    expect(edgeWeight(0, 100, 0.2)).toBeLessThan(0.01);
    expect(edgeWeight(99, 100, 0.2)).toBeCloseTo(edgeWeight(0, 100, 0.2), 9);
    expect(edgeWeight(50, 100, 0.2)).toBe(1);
    expect(edgeWeight(25, 100, 0.2)).toBe(1);
    expect(edgeWeight(10, 100, 0.2)).toBeGreaterThan(0.3);
  });
});

describe('shiftMean', () => {
  it('shifts the mean to the target colour and keeps the differences', () => {
    const px = image(32, 32);
    const out = shiftMean(px, [100, 148, 54]);
    const m = meanColor(out);
    expect(m[0]).toBeCloseTo(100, 0); expect(m[1]).toBeCloseTo(148, 0); expect(m[2]).toBeCloseTo(54, 0);
    // distance of two pixels stays (additive shift, without clipping)
    expect(out[3] - out[0]).toBe(px[3] - px[0]);
  });
});
