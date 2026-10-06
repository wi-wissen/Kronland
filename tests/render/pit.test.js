import { describe, it, expect } from 'vitest';
import { pitShape, pitRect, pitTexture, hangerBeam, holeMask, contours, polygonArea, pointInPolygon } from '../../src/render/pit.js';

/** Ring (annulus) at height y made of quads, as a triangle list. */
function ring(r0, r1, y, seg = 48) {
  const t = [];
  for (let k = 0; k < seg; k++) {
    const a = (k / seg) * Math.PI * 2, b = ((k + 1) / seg) * Math.PI * 2;
    const p = (r, w) => [Math.cos(w) * r, y, Math.sin(w) * r];
    t.push(...p(r0, a), ...p(r1, a), ...p(r1, b), ...p(r0, a), ...p(r1, b), ...p(r0, b));
  }
  return t;
}
/** Box (only top and side faces suffice for the top view). */
function box(x0, x1, y0, y1, z0, z1) {
  const q = (a, b, c, d) => [...a, ...b, ...c, ...a, ...c, ...d];
  return [
    ...q([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]),
    ...q([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]),
    ...q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]),
  ];
}
const B = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
const dist = (p) => Math.hypot(p[0], p[1]);

describe('Pit opening (pit.js)', () => {
  it('ring model: hole inside, not outside', () => {
    // ground disc as a ring at y = 0, shaft bottom deep below
    const tris = [...ring(0.5, 1, 0), ...ring(0, 0.5, -1)];
    const s = pitShape(tris, B, 0, 1);
    expect(s).not.toBe(null);
    expect(s.loops).toHaveLength(1);
    const loop = s.loops[0];
    expect(pointInPolygon(0, 0, loop)).toBe(true);
    expect(pointInPolygon(0.8, 0, loop)).toBe(false);
    expect(pointInPolygon(0, -0.95, loop)).toBe(false);
    // contour lies at the inner edge of the ring, never outside; soft, not angular
    for (const p of loop) expect(dist(p)).toBeGreaterThan(0.35);
    for (const p of loop) expect(dist(p)).toBeLessThan(0.62);
    expect(loop.length).toBeGreaterThan(20);
  });

  it('not convex: contour follows a hole with a bulge', () => {
    // ground disc = square with an L-shaped hole
    const solid = [];
    const n = 20, c = (k) => -1 + (k / n) * 2;
    const inHole = (i, j) => (i >= 6 && i < 14 && j >= 6 && j < 10) || (i >= 6 && i < 10 && j >= 6 && j < 14);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (!inHole(i, j)) solid.push(...box(c(i), c(i + 1), -0.1, 0, c(j), c(j + 1)));
    const s = pitShape(solid, B, 0, 1);
    expect(s.loops).toHaveLength(1);
    const loop = s.loops[0];
    expect(pointInPolygon(c(8), c(12), loop)).toBe(true); // in the foot of the L
    expect(pointInPolygon(c(12), c(8), loop)).toBe(true); // in the arm of the L
    expect(pointInPolygon(c(12.5), c(12.5), loop)).toBe(false); // inner corner stays ground
  });

  it('posts and bucket in the hole: island is filled, beam above does not count', () => {
    const tris = [...ring(0.5, 1, 0), ...ring(0, 0.5, -1), ...box(-0.06, 0.06, -0.8, 0.02, -0.06, 0.06), ...box(-0.8, 0.8, 0.5, 0.6, -0.05, 0.05)];
    const s = pitShape(tris, B, 0, 1);
    expect(s.loops).toHaveLength(1);
    expect(pointInPolygon(0, 0, s.loops[0])).toBe(true);
  });

  it('full disc without a hole: null (fallback hull)', () => {
    expect(pitShape(ring(0, 1, 0), B, 0, 1)).toBe(null);
  });

  it('gap in the wall is bridged (open earth wall)', () => {
    // ring with a narrow notch outwards
    const tris = ring(0.5, 1, 0, 64).filter((_, k) => Math.floor(k / 18) !== 0);
    const s = pitShape([...tris, ...ring(0, 0.5, -1)], B, 0, 1);
    expect(s).not.toBe(null);
    expect(pointInPolygon(0, 0, s.loops[0])).toBe(true);
  });

  it('hangerBeam: posts left and right outside the opening, beam at the height of the block', () => {
    const tris = [...ring(0.5, 1, 0), ...ring(0, 0.5, -1), ...box(-0.05, 0.05, 0.3, 0.4, 0.1, 0.2)];
    const s = pitShape(tris, B, 0, 1);
    const b = hangerBeam(tris, s.loops, 0, 1);
    expect(b.x0).toBeLessThan(-0.5);
    expect(b.x1).toBeGreaterThan(0.5);
    expect(b.x1).toBeLessThan(1);
    expect(b.z).toBeCloseTo(0.15, 1);
    expect(b.y).toBeGreaterThan(0.35);
    expect(b.y).toBeLessThan(0.4);
    // nothing above the hole: no gallows
    expect(hangerBeam([...ring(0.5, 1, 0), ...ring(0, 0.5, -1)], s.loops, 0, 1)).toBe(null);
  });

  it('holeMask: deep cells at the edge belong to the outside', () => {
    const n = 8, top = new Float32Array(n * n).fill(-Infinity);
    for (let j = 2; j < 6; j++) for (let i = 2; i < 6; i++) top[j * n + i] = 0; // block
    top[3 * n + 3] = top[3 * n + 4] = top[4 * n + 3] = top[4 * n + 4] = -1; // hole inside
    const m = holeMask(top, n, -0.5, { gap: 0, minCells: 1 });
    expect([...m].reduce((a, b) => a + b, 0)).toBe(4);
    expect(m[0]).toBe(0);
  });

  it('contours: closed contour around a square, area fits', () => {
    const n = 10, f = new Float32Array(n * n);
    for (let j = 3; j < 7; j++) for (let i = 3; i < 7; i++) f[j * n + i] = 1;
    const [loop, ...rest] = contours(f, n, 0.5);
    expect(rest).toHaveLength(0);
    expect(Math.abs(polygonArea(loop))).toBeGreaterThan(12);
    expect(Math.abs(polygonArea(loop))).toBeLessThan(20);
  });

  it('texture: centre black and opaque, edge lighter, outside transparent', () => {
    const s = pitShape([...ring(0.5, 1, 0), ...ring(0, 0.5, -1)], B, 0, 1);
    const rect = pitRect(s), size = 32, tex = pitTexture(s, rect, [120, 70, 40], size);
    const at = (x, z) => {
      const i = Math.floor(((x - rect.minX) / (rect.maxX - rect.minX)) * size), j = Math.floor(((z - rect.minZ) / (rect.maxZ - rect.minZ)) * size);
      return [...tex.slice((j * size + i) * 4, (j * size + i) * 4 + 4)];
    };
    const mid = at(0, 0), edge = at(0.38, 0), corner = at(rect.maxX - 0.01, rect.maxZ - 0.01);
    expect(mid[3]).toBe(255);
    expect(mid[0]).toBeLessThan(15);
    expect(edge[0]).toBeGreaterThan(mid[0] + 25);
    expect(corner[3]).toBeLessThan(10);
  });
});
