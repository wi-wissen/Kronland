// scripts/asset-gen/weapons.mjs: weapon axis, the weapon's vertices along it, bridges between hand and body.
import { describe, it, expect } from 'vitest';
import { mainAxis, lineDistance, weaponVertices, findBridges } from '../../scripts/asset-gen/weapons.mjs';

describe('weapon axis', () => {
  it('main axis of points along a line, distance from the line', () => {
    const pts = Array.from({ length: 20 }, (_, i) => [1 + i * 0.1, 2 + i * 0.05, 3]);
    const { c, a } = mainAxis(pts);
    const l = Math.hypot(0.1, 0.05);
    expect(Math.abs(a[0] * 0.1 / l + a[1] * 0.05 / l)).toBeCloseTo(1, 6);
    expect(lineDistance([c[0], c[1], c[2] + 0.5], c, a)).toBeCloseTo(0.5, 6);
  });
});

describe('weapon vertices', () => {
  it('a dense sword: all its vertices, none of the body', () => {
    const pos = [], bone = [], nbr = [];
    const add = (p, b) => { pos.push(...p); bone.push(b); nbr.push([]); return bone.length - 1; };
    const link = (a, b) => { nbr[a].push(b); nbr[b].push(a); };
    const body = [];
    for (let k = 0; k <= 40; k++) body.push(add([0, k / 40, 0], 'RightUpLeg'));
    for (let k = 1; k < body.length; k++) link(body[k - 1], body[k]);
    const sword = [];
    for (let k = 0; k <= 60; k++) {
      const y = 0.5 - k * 0.0075;
      sword.push(add([0.3 + 0.004 * (k % 3), y, 0], y > 0.3 ? 'RightHand' : 'RightUpLeg'));
    }
    for (let k = 1; k < sword.length; k++) link(sword[k - 1], sword[k]);
    link(sword.at(-1), body[2]); // welded to the leg
    const w = weaponVertices(new Float32Array(pos), bone, nbr, 'RightHand', [0.3, 0.5, 0], 1);
    expect(w).not.toBeNull();
    const got = new Set(w.verts);
    expect(sword.every((v) => got.has(v))).toBe(true);
    expect(body.some((v) => got.has(v))).toBe(false);
  });

  it('a hand without a weapon has none', () => {
    const pos = new Float32Array([0.3, 0.5, 0, 0.31, 0.49, 0, 0.32, 0.5, 0]);
    expect(weaponVertices(pos, ['RightHand', 'RightHand', 'RightHand'], [[1], [0, 2], [1]], 'RightHand', [0.3, 0.5, 0], 1)).toBeNull();
  });
});

describe('bridges', () => {
  // triangle 0: hand–leg, opens when the hand rises; triangle 1: hand only (the weapon), rigid; triangle 2: leg only
  const idx = [0, 1, 2, 0, 3, 4, 2, 5, 6];
  const boneOf = ['RightHand', 'RightHand', 'RightUpLeg', 'RightHand', 'RightHand', 'RightUpLeg', 'RightUpLeg'];
  const rest = new Float32Array([0.3, 0.3, 0, 0.3, 0.32, 0, 0.29, 0.29, 0, 0.3, 0.4, 0, 0.31, 0.4, 0, 0.29, 0.2, 0, 0.28, 0.25, 0]);
  const up = new Float32Array(rest);
  for (const v of [0, 1, 3, 4]) up[v * 3 + 1] += 0.5; // the hand side rises by half the height
  it('only the triangle joining hand and leg that stretches is a bridge', () => {
    expect(findBridges(idx, rest, [up], boneOf, { RightHand: [0.3, 0.6, 0] }, 1)).toEqual([0]);
  });
  it('no movement, no bridge', () => {
    expect(findBridges(idx, rest, [rest], boneOf, { RightHand: [0.3, 0.6, 0] }, 1)).toEqual([]);
  });
  it('at the wrist hand–forearm triangles are skin, not a bridge', () => {
    const b = ['RightHand', 'RightHand', 'RightForeArm', 'RightHand', 'RightHand', 'RightUpLeg', 'RightUpLeg'];
    expect(findBridges(idx, rest, [up], b, { RightHand: [0.3, 0.3, 0] }, 1)).toEqual([]);
  });
});

describe('pole', () => {
  it('shaft from butt to tip, closed, tip marked', async () => {
    const { poleGeometry } = await import('../../scripts/asset-gen/pole.mjs');
    const g = poleGeometry([0, 0, 0], [0, 2, 0], 0.05);
    const n = g.pos.length / 3;
    expect(g.nrm.length).toBe(g.pos.length);
    expect(g.tip.length).toBe(n);
    expect(g.idx.length % 3).toBe(0);
    expect(Math.max(...g.idx)).toBe(n - 1);
    const ys = Array.from({ length: n }, (_, i) => g.pos[i * 3 + 1]);
    expect(Math.min(...ys)).toBeCloseTo(0, 6);
    expect(Math.max(...ys)).toBeCloseTo(2, 6);
    // the point is metal, the butt is wood; the shaft keeps its radius
    expect(g.tip[ys.indexOf(Math.max(...ys))]).toBe(true);
    expect(g.tip[ys.indexOf(Math.min(...ys))]).toBe(false);
    const r = Math.hypot(g.pos[0], g.pos[2]);
    expect(r).toBeCloseTo(0.05, 6);
  });
});

describe('flat tools', () => {
  it('a frame is flat, a shaft is not', async () => {
    const { flatPart } = await import('../../scripts/asset-gen/weapons.mjs');
    const frame = [];
    for (let k = 0; k <= 20; k++) frame.push([k / 20, 0, 0], [k / 20, 0.8, 0], [0, k / 25, 0.001], [1, k / 25, -0.001]);
    const f = flatPart(frame);
    expect(f).not.toBeNull();
    expect(Math.abs(f.n[2])).toBeCloseTo(1, 3);
    const shaft = Array.from({ length: 40 }, (_, k) => [k / 40, 0.01 * (k % 2), 0.01 * (k % 3)]);
    expect(flatPart(shaft)).toBeNull();
  });
  it('smallest rectangle finds a turned frame', async () => {
    const { minRect } = await import('../../scripts/asset-gen/pole.mjs');
    const t = Math.PI / 6, rot = ([x, y]) => [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];
    const pts = [];
    for (let k = 0; k <= 10; k++) pts.push(rot([k / 10, 0]), rot([k / 10, 0.5]), rot([0, k / 20]), rot([1, k / 20]));
    const r = minRect(pts);
    expect([...r.h].sort()).toEqual([expect.closeTo(0.25, 2), expect.closeTo(0.5, 2)]);
  });
  it('saw: wooden frame, metal blade, handle', async () => {
    const { sawGeometry } = await import('../../scripts/asset-gen/pole.mjs');
    const at = (pu, pv) => [pu, pv, 0];
    const g = sawGeometry({ u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], at, u0: -0.4, u1: 0.4, vb: -0.2, vc: 0.2, vm: 0, r: 0.01, blade: 0.02, bladeThick: 0.002, handle: 0.35 });
    expect(g.pos.length / 3).toBe(6 * 24); // 4 wooden bars, blade, handle
    expect(g.tip.filter(Boolean).length).toBe(24);
    expect(Math.max(...g.idx)).toBe(g.pos.length / 3 - 1);
    const ys = Array.from({ length: g.pos.length / 3 }, (_, i) => g.pos[i * 3 + 1]);
    expect(Math.max(...ys)).toBeCloseTo(0.35, 6);
  });
});

describe('bow', () => {
  // points on a parabola s = 0.3·t² in a tilted plane: t along a, s along b
  const a = [0, 0.8, 0.6], b = [1, 0, 0], o = [0.4, 0.8, 0.1];
  const on = (t, off = 0) => [0, 1, 2].map((k) => o[k] + a[k] * t + b[k] * (0.3 * t * t + off));

  it('fitBow finds the plane and the bend; bowDistance measures from the curve', async () => {
    const { fitBow, bowDistance, bowPoint } = await import('../../scripts/asset-gen/pole.mjs');
    const pts = Array.from({ length: 41 }, (_, i) => on(-0.4 + i * 0.02));
    const fit = fitBow(pts);
    expect(Math.abs(fit.k[2])).toBeCloseTo(0.3, 3);
    for (const p of pts) expect(bowDistance(fit, p).d).toBeLessThan(1e-6);
    // a point beside the curve, across the plane
    const n = [0, 0.6, -0.8], q = on(0.1).map((x, k) => x + n[k] * 0.02);
    expect(bowDistance(fit, q).d).toBeCloseTo(0.02, 4);
    // bowPoint lies on the curve
    expect(bowDistance(fit, bowPoint(fit, 0.17)).d).toBeLessThan(1e-9);
  });

  it('fitBow keeps the bend within maxBend', async () => {
    const { fitBow } = await import('../../scripts/asset-gen/pole.mjs');
    const pts = Array.from({ length: 41 }, (_, i) => { const t = -0.4 + i * 0.02; return [0, 1, 2].map((k) => o[k] + a[k] * t + b[k] * 4 * t * t); });
    const fit = fitBow(pts, 0.2);
    let half = 0;
    for (const p of pts) half = Math.max(half, Math.abs((p[0] - fit.c[0]) * fit.u[0] + (p[1] - fit.c[1]) * fit.u[1] + (p[2] - fit.c[2]) * fit.u[2]));
    expect(Math.abs(fit.k[2]) * half * half).toBeLessThanOrEqual(0.2 * half + 1e-9);
  });

  it('bowGeometry: tips behind the grip, straight string between them, closed outward faces', async () => {
    const { bowGeometry } = await import('../../scripts/asset-gen/pole.mjs');
    const grip = [1, 2, 3], up = [0, 1, 0], back = [0, 0, 1], L = 1, sag = 0.12;
    const g = bowGeometry({ grip, a: up, back, length: L, sag, limb: 0.02, tip: 0.008, string: 0.004 });
    const n = g.pos.length / 3, P = (i) => [g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2]];
    expect(g.nrm.length).toBe(g.pos.length);
    expect(g.part.length).toBe(n);
    expect(new Set(g.part)).toEqual(new Set([0, 1, 2]));
    expect(Math.max(...g.idx)).toBe(n - 1);
    const wood = [...Array(n).keys()].filter((i) => g.part[i] === 0), ys = wood.map((i) => P(i)[1]);
    expect(Math.max(...ys)).toBeCloseTo(grip[1] + L / 2, 2);
    expect(Math.min(...ys)).toBeCloseTo(grip[1] - L / 2, 2);
    // the tips bend away from the back (towards the archer), the grip is the deepest point of the back
    const top = wood[ys.indexOf(Math.max(...ys))];
    expect(P(top)[2]).toBeLessThan(grip[2] - sag * 0.9);
    // the string runs straight at the height of the tips, the wrap sits at the grip
    for (let i = 0; i < n; i++) if (g.part[i] === 2) expect(Math.abs(P(i)[2] - (grip[2] - sag * 0.98 ** 2))).toBeLessThan(0.0041);
    for (let i = 0; i < n; i++) if (g.part[i] === 1) expect(Math.abs(P(i)[1] - grip[1])).toBeLessThan(0.08);
    // every face turns outwards: its normal agrees with its vertex normals
    for (let t = 0; t < g.idx.length; t += 3) {
      const [p0, p1, p2] = [g.idx[t], g.idx[t + 1], g.idx[t + 2]].map(P);
      const e1 = p1.map((x, k) => x - p0[k]), e2 = p2.map((x, k) => x - p0[k]);
      const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const vn = [0, 1, 2].map((k) => g.nrm[g.idx[t] * 3 + k] + g.nrm[g.idx[t + 1] * 3 + k] + g.nrm[g.idx[t + 2] * 3 + k]);
      expect(fn[0] * vn[0] + fn[1] * vn[1] + fn[2] * vn[2]).toBeGreaterThan(0);
    }
  });

  it('pickUv: inside the triangle closest to the colour, or the typical colour of the chosen ones', async () => {
    const { pickUv } = await import('../../scripts/asset-gen/pole.mjs');
    // four triangles side by side in UV; the texture is dark left, light right, red in the third quarter
    const UV = [], I = [];
    for (let q = 0; q < 4; q++) { const u = q * 0.25; UV.push(u, 0, u + 0.2, 0, u, 0.2); I.push(q * 3, q * 3 + 1, q * 3 + 2); }
    const tex = (u) => (u < 0.25 ? [60, 40, 30] : u < 0.5 ? [120, 90, 60] : u < 0.75 ? [200, 30, 30] : [225, 215, 185]);
    const light = pickUv(I, UV, tex, null, [230, 220, 190]);
    expect(light[0]).toBeGreaterThan(0.75);
    expect(light[1]).toBeGreaterThan(0);
    const dark = pickUv(I, UV, tex, null, [70, 45, 30]);
    expect(dark[0]).toBeLessThan(0.25);
    // median over the first, second and fourth triangle: the brown one in the middle
    const typical = pickUv(I, UV, tex, (tri) => tri[0] !== 6, 'median');
    expect(typical[0]).toBeGreaterThan(0.25);
    expect(typical[0]).toBeLessThan(0.5);
  });
});
