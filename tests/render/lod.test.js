// LOD levels: selection, hysteresis, graphics levels, cull limit (pure logic, without WebGL).
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  selectLod, withinCull, effectiveDistance, lodSettings, LodState, LodCounter, LOD_PROFILES, LOD_TIERS,
  ChunkedInstances, ViewTracker, cameraFrustum,
} from '../../src/render/lod.js';

const T = [20, 40];

describe('selectLod', () => {
  it('picks the level directly by distance without history', () => {
    expect(selectLod(5, -1, T)).toBe(0);
    expect(selectLod(20, -1, T)).toBe(0);
    expect(selectLod(25, -1, T)).toBe(1);
    expect(selectLod(100, -1, T)).toBe(2);
  });

  it('keeps the level within the hysteresis (no flicker at the boundary)', () => {
    // from 0 coarser only from 22 (20 · 1.1)
    expect(selectLod(21.9, 0, T, 0.1)).toBe(0);
    expect(selectLod(22.1, 0, T, 0.1)).toBe(1);
    // from 1 finer only below 18 (20 · 0.9)
    expect(selectLod(18.1, 1, T, 0.1)).toBe(1);
    expect(selectLod(17.9, 1, T, 0.1)).toBe(0);
  });

  it('jumps over several levels on big camera jumps', () => {
    expect(selectLod(200, 0, T, 0.1)).toBe(2);
    expect(selectLod(1, 2, T, 0.1)).toBe(0);
  });

  it('does not oscillate back and forth on small fluctuations around the boundary', () => {
    let lvl = -1, changes = 0;
    for (let i = 0; i < 200; i++) {
      const d = 20 + Math.sin(i * 0.7) * 1.5; // ±1.5 around the boundary 20
      const n = selectLod(d, lvl, T, 0.1);
      if (lvl >= 0 && n !== lvl) changes++;
      lvl = n;
    }
    expect(changes).toBe(0);
  });

  it('works without boundaries (only one level)', () => {
    expect(selectLod(500, -1, [])).toBe(0);
    expect(selectLod(500, 0, [])).toBe(0);
  });
});

describe('withinCull', () => {
  it('fades out and in with hysteresis', () => {
    expect(withinCull(100, true, Infinity)).toBe(true);
    expect(withinCull(65, true, 60, 0.1)).toBe(true);   // still visible up to 66
    expect(withinCull(67, true, 60, 0.1)).toBe(false);
    expect(withinCull(55, false, 60, 0.1)).toBe(false); // visible again only below 54
    expect(withinCull(53, false, 60, 0.1)).toBe(true);
  });
});

describe('effectiveDistance', () => {
  it('is the real distance at 40° field of view and level high', () => {
    expect(effectiveDistance(30, 40, 1)).toBeCloseTo(30, 5);
  });
  it('acts further away with a wider field of view (phone upright)', () => {
    expect(effectiveDistance(30, 55, 1)).toBeGreaterThan(30);
  });
  it('simplifies earlier on a low level', () => {
    const lo = effectiveDistance(30, 40, LOD_TIERS.low.bias), hi = effectiveDistance(30, 40, LOD_TIERS.high.bias);
    expect(lo).toBeGreaterThan(hi);
    // the same distance gives a coarser level on "low"
    const s = LOD_PROFILES.building.thresholds;
    expect(selectLod(effectiveDistance(45, 40, LOD_TIERS.low.bias), -1, s)).toBeGreaterThan(selectLod(effectiveDistance(45, 40, LOD_TIERS.high.bias), -1, s));
  });
});

describe('lodSettings / LodState', () => {
  it('delivers boundaries per group and hysteresis per level', () => {
    const s = lodSettings('character', 'low');
    expect(s.thresholds).toEqual(LOD_PROFILES.character.thresholds);
    expect(s.h).toBe(LOD_TIERS.low.hysteresis);
    expect(lodSettings('scatterSmall', 'high').cull).toBe(LOD_PROFILES.scatterSmall.cull);
    // figures: lower bound of the factor so that they do not coarsen too early on "low"
    expect(lodSettings('character', 'low').bias).toBe(LOD_PROFILES.character.minBias);
    expect(lodSettings('tree', 'low').bias).toBe(LOD_TIERS.low.bias);
  });

  it('remembers level and visibility', () => {
    const st = new LodState();
    const s = { thresholds: [10, 20], cull: 50, h: 0.1 };
    expect(st.update(5, s)).toBe(0);
    expect(st.update(15, s)).toBe(1);
    expect(st.update(10.5, s)).toBe(1); // hysteresis
    expect(st.update(54, s)).toBe(2);   // still within the cull hysteresis
    expect(st.update(60, s)).toBe(-1);  // discarded
    expect(st.update(52, s)).toBe(-1);  // back only below 45
    expect(st.update(44, s)).toBe(2);
  });

  it('LodCounter counts per group and level', () => {
    const c = new LodCounter();
    c.add('tree', 0, 3); c.add('tree', 2); c.add('building', 1);
    expect(c.groups.tree).toEqual([3, 0, 1]);
    expect(c.groups.building).toEqual([0, 1]);
  });
});

describe('ChunkedInstances', () => {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial();
  const make = () => {
    const ci = new ChunkedInstances({ name: 't', chunkSize: 8, kind: 'tree', levels: [{ geometry: box, material: mat }, { geometry: box, material: mat }] });
    const m = new THREE.Matrix4();
    const handles = [];
    for (let x = 0; x < 64; x += 2) for (let z = 0; z < 64; z += 2) handles.push(ci.add(x, z, m.makeTranslation(x, 0, z)));
    const scene = new THREE.Scene();
    ci.finalize(scene);
    return { ci, handles, scene };
  };
  const camera = (x, y, z, tx, tz) => {
    const c = new THREE.PerspectiveCamera(40, 1.6, 0.3, 700);
    c.position.set(x, y, z); c.lookAt(tx, 0, tz); c.updateMatrixWorld(); c.updateProjectionMatrix();
    return c;
  };

  it('splits instances into chunks and counts them completely', () => {
    const { ci } = make();
    expect(ci.count).toBe(32 * 32);
    expect(ci.chunks.length).toBe(64);
    expect(ci.chunks.reduce((s, c) => s + c.n, 0)).toBe(1024);
  });

  it('discards chunks outside the frame and picks levels by distance', () => {
    const { ci } = make();
    const cam = camera(4, 12, -6, 4, 6); // looks at a corner
    const f = cameraFrustum(cam);
    const counter = new LodCounter();
    ci.update(f, cam.position, (d) => d, { thresholds: [20], cull: Infinity, h: 0.1 }, counter);
    const drawn = ci.meshes[0].count + ci.meshes[1].count;
    expect(drawn).toBeGreaterThan(0);
    expect(drawn).toBeLessThan(1024);              // visibility check works
    expect(ci.meshes[0].count).toBeGreaterThan(0); // near: full level
    expect(ci.meshes[1].count).toBeGreaterThan(0); // far: simple level
    expect(counter.groups.tree[0] + counter.groups.tree[1]).toBe(drawn);
  });

  it('hides single instances via their handle', () => {
    const { ci, handles } = make();
    ci.hide(handles[0]);
    const c = ci.chunks.find((k) => k.key === handles[0].key);
    expect(c.matrices.slice(handles[0].index * 16, handles[0].index * 16 + 16).every((v) => v === 0)).toBe(true);
  });

  it('ViewTracker reports only real camera changes', () => {
    const v = new ViewTracker();
    const cam = camera(0, 10, 10, 0, 0);
    expect(v.changed(cam)).toBe(true);
    expect(v.changed(cam)).toBe(false);
    cam.position.x += 0.01; cam.updateMatrixWorld();
    expect(v.changed(cam)).toBe(false);
    cam.position.x += 1; cam.updateMatrixWorld();
    expect(v.changed(cam)).toBe(true);
  });
});
