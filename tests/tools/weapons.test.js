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
