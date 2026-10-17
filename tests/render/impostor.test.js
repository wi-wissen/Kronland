import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { IMPOSTOR, impostorFit, impostorLayout, impostorCell, impostorRow, captureMatrix, impostorAtlas } from '../../src/render/impostor.js';

const TAU = Math.PI * 2;

describe('impostor cell choice', () => {
  it('camera azimuth minus instance rotation selects the cell', () => {
    const n = 16, step = TAU / n;
    expect(impostorCell(0, 0, n)).toEqual({ i0: 0, i1: 1, t: 0 });
    expect(impostorCell(3 * step, 0, n).i0).toBe(3);
    // tree rotated by the same angle as the camera: seen from the front cell
    expect(impostorCell(3 * step, 3 * step, n)).toMatchObject({ i0: 0, t: 0 });
    // rotated tree: camera azimuth minus rotation
    expect(impostorCell(5 * step, 2 * step, n).i0).toBe(3);
    const c = impostorCell(2.5 * step, 0, n);
    expect(c.i0).toBe(2); expect(c.i1).toBe(3); expect(c.t).toBeCloseTo(0.5);
  });

  it('wraps around the full circle in both directions', () => {
    const n = 16, step = TAU / n;
    expect(impostorCell(-0.5 * step, 0, n)).toMatchObject({ i0: 15, i1: 0 });
    expect(impostorCell(-0.5 * step, 0, n).t).toBeCloseTo(0.5);
    expect(impostorCell(0, 17 * step, n).i0).toBe(15);
    expect(impostorCell(TAU * 3 + step, 0, n).i0).toBe(1);
    for (let a = -10; a < 10; a += 0.37) {
      const { i0, i1, t } = impostorCell(a, 1.3, n);
      expect(i0).toBeGreaterThanOrEqual(0); expect(i0).toBeLessThan(n);
      expect(i1).toBe((i0 + 1) % n);
      expect(t).toBeGreaterThanOrEqual(0); expect(t).toBeLessThan(1);
    }
  });

  it('elevation: clamped outside, blend only in the middle between two rows', () => {
    const els = [0.5, 0.95];
    expect(impostorRow(0.2, els)).toEqual({ r0: 0, r1: 0, t: 0 });
    expect(impostorRow(1.4, els)).toEqual({ r0: 1, r1: 1, t: 0 });
    expect(impostorRow(0.55, els).t).toBe(0); // near the lower row: only it
    expect(impostorRow(0.9, els).t).toBe(1); // near the upper row: only it
    const mid = impostorRow(0.725, els);
    expect(mid.r0).toBe(0); expect(mid.r1).toBe(1); expect(mid.t).toBeCloseTo(0.5);
    // monotonic
    let prev = -1;
    for (let e = 0.5; e <= 0.95; e += 0.01) { const r = impostorRow(e, els); const v = r.r0 + r.t; expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
  });

  it('the default elevations cover the game pitch (CameraRig 0.95) and flatter views of far trees', () => {
    expect(IMPOSTOR.elevations[0]).toBeLessThanOrEqual(0.5);
    expect(IMPOSTOR.elevations.at(-1)).toBeCloseTo(0.95);
    expect(IMPOSTOR.azimuths).toBe(16);
  });
});

describe('impostor atlas layout', () => {
  it('cells line by line, rows of elevation after each other, no overlap', () => {
    const L = impostorLayout(128, 200, { azimuths: 16, elevations: [0.5, 0.95], cols: 8 });
    expect(L).toMatchObject({ cols: 8, lines: 4, width: 1024, height: 800, cells: 32 });
    expect(L.rect(0, 0)).toEqual({ x: 0, y: 0, w: 128, h: 200 });
    expect(L.rect(9, 0)).toEqual({ x: 128, y: 200, w: 128, h: 200 });
    expect(L.rect(0, 1)).toEqual({ x: 0, y: 400, w: 128, h: 200 });
    const seen = new Set();
    for (let r = 0; r < 2; r++) for (let i = 0; i < 16; i++) {
      const c = L.rect(i, r);
      expect(c.x + c.w).toBeLessThanOrEqual(L.width); expect(c.y + c.h).toBeLessThanOrEqual(L.height);
      seen.add(`${c.x},${c.y}`);
    }
    expect(seen.size).toBe(32);
  });

  it('fit: the model outline stays inside the cell minus the margin at every elevation', () => {
    for (const [r, h] of [[1.3, 3.4], [0.9, 4.8], [0.6, 0.95], [0.2, 3]]) {
      const f = impostorFit(r, h, 128);
      expect(f.cellW).toBe(128);
      expect(f.cellH % 8).toBe(0);
      expect(f.cellH).toBeGreaterThanOrEqual(64); expect(f.cellH).toBeLessThanOrEqual(256);
      expect(f.pivotY).toBe(h / 2);
      for (const e of IMPOSTOR.elevations) {
        const halfH = (h / 2) * Math.cos(e) + r * Math.sin(e);
        expect(2 * halfH * f.scale).toBeLessThanOrEqual(f.cellH - 2 * IMPOSTOR.margin + 1e-6);
        expect(2 * r * f.scale).toBeLessThanOrEqual(f.cellW - 2 * IMPOSTOR.margin + 1e-6);
      }
      // the quad covers the whole cell (uv 0…1 = cell)
      expect(f.half[0] * 2 * f.scale).toBeCloseTo(f.cellW);
      expect(f.half[1] * 2 * f.scale).toBeCloseTo(f.cellH);
    }
  });

  it('capture matrix: the camera direction of the cell ends up looking along −Z, the pivot in the cell centre', () => {
    const a = 1.1, e = 0.7, m = captureMatrix(a, e, 10, 2, 64, 100);
    // direction from the tree towards the camera in the model frame
    const dir = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
    const rot = new THREE.Matrix3().setFromMatrix4(m).multiplyScalar(1 / 10);
    const d = dir.clone().applyMatrix3(rot);
    expect(d.x).toBeCloseTo(0); expect(d.y).toBeCloseTo(0); expect(d.z).toBeCloseTo(1);
    const p = new THREE.Vector3(0, 2, 0).applyMatrix4(m);
    expect(p.x).toBeCloseTo(64); expect(p.y).toBeCloseTo(100);
    // up stays up in the image (top of the tree above the pivot)
    expect(new THREE.Vector3(0, 4, 0).applyMatrix4(m).y).toBeGreaterThan(100);
  });

  it('without a WebGL renderer there is no atlas (the mesh level stays)', () => {
    expect(impostorAtlas(null, 'tree_oak:128', () => null, 128)).toBeNull();
    expect(impostorAtlas(undefined, 'tree_oak:128', () => null, 128)).toBeNull();
  });
});
