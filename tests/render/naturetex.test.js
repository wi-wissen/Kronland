// Painted structure for trees, bushes and rocks: normalisation, packing, loading, switching off.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizedLuminance, packChannels, DETAIL_STD } from '../../src/render/naturetex.js';

beforeEach(() => { vi.resetModules(); vi.unstubAllGlobals(); });

/** Test image: dark green with light spots (RGBA). */
function image(n, bright = 1) {
  const px = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const hi = (i * 7919) % 5 === 0;
    px.set(hi ? [180 * bright, 230 * bright, 90 * bright, 255] : [40 * bright, 90 * bright, 30 * bright, 255], i * 4);
  }
  return px;
}
const stats = (a) => {
  const m = a.reduce((s, v) => s + v, 0) / a.length;
  return { mean: m, std: Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length) };
};

describe('normalizedLuminance', () => {
  it('brings every image to mean 128 and equal spread: on average neither lighter nor darker', () => {
    for (const bright of [0.5, 1]) {
      const { mean, std } = stats(normalizedLuminance(image(4000, bright)));
      expect(Math.abs(mean - 128)).toBeLessThan(1);
      expect(Math.abs(std - DETAIL_STD)).toBeLessThan(1.5);
    }
  });

  it('preserves the light-dark order', () => {
    const l = normalizedLuminance(image(10));
    expect(l[0]).toBeGreaterThan(128); // i = 0 is a light spot
    expect(l[1]).toBeLessThan(128);
  });

  it('single-colour image: neutral (no division by zero)', () => {
    const px = new Uint8ClampedArray(16 * 4).fill(90);
    expect([...normalizedLuminance(px)].every((v) => v === 128)).toBe(true);
  });
});

describe('packChannels', () => {
  it('packs channels to R, G, B; missing ones neutral, alpha full', () => {
    const out = packChannels([new Uint8Array([10, 20]), new Uint8Array([30, 40])], 2);
    expect([...out]).toEqual([10, 30, 128, 255, 20, 40, 128, 255]);
  });
});

describe('loadNatureImages', () => {
  it('loads the 512 version per kind; missing files are not fatal', async () => {
    const urls = [];
    vi.stubGlobal('fetch', async (u) => { urls.push(u); return { ok: !u.includes('needles'), status: 404, blob: async () => ({}) }; });
    vi.stubGlobal('createImageBitmap', async () => ({ width: 512, height: 512 }));
    const t = await import('../../src/render/naturetex.js');
    let ticks = 0;
    expect(await t.loadNatureImages('x/', () => ticks++)).toBe(t.NATURE_IMAGE_KINDS.length - 1);
    expect(ticks).toBe(t.NATURE_IMAGE_KINDS.length);
    expect(urls).toContain('x/bark-512.webp');
    expect(t.hasNatureImage('needles')).toBe(false);
    // without an image no texture (→ material without structure)
    expect(t.natureDetailTexture([{ kind: 'needles' }, { kind: 'bark' }])).toBe(null);
  });

  it('without network: nothing loaded, no error', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
    const t = await import('../../src/render/naturetex.js');
    expect(await t.loadNatureImages('x/')).toBe(0);
  });
});

describe('natureDetail', () => {
  it('every nature kind uses existing images, channels matching the mask', async () => {
    const { NATURE_DETAIL } = await import('../../src/render/nature.js');
    const { NATURE_IMAGE_KINDS } = await import('../../src/render/naturetex.js');
    for (const [name, d] of Object.entries(NATURE_DETAIL)) {
      expect(d.spec.length, name).toBeGreaterThanOrEqual(1);
      expect(d.spec.length, name).toBeLessThanOrEqual(2); // shader reads R and G
      for (const s of d.spec) expect(NATURE_IMAGE_KINDS, name).toContain(s.kind);
      expect(['tree', 'all'], name).toContain(d.mask);
      expect(d.k).toHaveLength(2);
      expect(d.tint).toHaveLength(3);
    }
    // bush shares the texture of the deciduous trees (one texture fewer)
    expect(NATURE_DETAIL.bush.spec).toEqual(NATURE_DETAIL.leafy.spec);
  });

  it('switched off at level "low" and with ?nature=off', async () => {
    const q = await import('../../src/render/quality.js');
    const { natureDetailOff } = await import('../../src/render/nature.js');
    q.setQuality('low');
    expect(natureDetailOff()).toBe(true);
    q.setQuality('high');
    expect(natureDetailOff()).toBe(false);
    vi.stubGlobal('location', { search: '?nature=off' });
    expect(natureDetailOff()).toBe(true);
  });
});
