// Clear view for scripted camera moves: trees and houses in front of the figures make the camera turn.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { segmentHits, blockedCount, clearView, figureTargets, angleDelta } from '../../src/render/sightline.js';
import { CameraRig } from '../../src/render/CameraRig.js';

const flat = () => 0;

describe('segmentHits', () => {
  const a = { x: 0, y: 5, z: 0 }, b = { x: 10, y: 0.5, z: 0 };
  it('cylinder on the line at matching height blocks, beside it or below does not', () => {
    expect(segmentHits(a, b, { type: 'cyl', x: 7, z: 0, r: 1, y0: 0.5, y1: 4 })).toBe(true);
    expect(segmentHits(a, b, { type: 'cyl', x: 7, z: 2, r: 1, y0: 0.5, y1: 4 })).toBe(false);
    expect(segmentHits(a, b, { type: 'cyl', x: 3, z: 0, r: 0.5, y0: 0, y1: 1 })).toBe(false); // line passes above
  });
  it('box on the line blocks, off the line not', () => {
    expect(segmentHits(a, b, { type: 'box', x0: 6, z0: -1, x1: 8, z1: 1, y0: 0, y1: 3 })).toBe(true);
    expect(segmentHits(a, b, { type: 'box', x0: 6, z0: 2, x1: 8, z1: 3, y0: 0, y1: 3 })).toBe(false);
  });
});

describe('blockedCount', () => {
  it('ignores a blocker that stands on the target itself', () => {
    const cam = { x: 0, y: 5, z: 0 }, p = { x: 10, y: 0.5, z: 0 };
    expect(blockedCount(cam, [p], [{ type: 'cyl', x: 10, z: 0, r: 1, y0: 0, y1: 4 }], flat)).toBe(0);
  });
  it('counts terrain in between', () => {
    const cam = { x: 0, y: 2, z: 0 }, p = { x: 10, y: 0.5, z: 0 };
    expect(blockedCount(cam, [p], [], (x) => (x > 4 && x < 6 ? 3 : 0))).toBe(1);
  });
});

describe('clearView', () => {
  // camera on a circle around the target, distance 10, height by tilt
  const camAt = (yaw, pitch) => ({ x: Math.sin(yaw) * Math.cos(pitch) * 10, y: Math.sin(pitch) * 10, z: Math.cos(yaw) * Math.cos(pitch) * 10 });
  const targets = figureTargets([{ x: 0, z: 0 }], flat);

  it('keeps the view when nothing is in the way', () => {
    const v = clearView(camAt, 0.7, 0.6, targets, [], flat);
    expect(v).toMatchObject({ yaw: 0.7, pitch: 0.6, blocked: 0, before: 0 });
  });

  it('turns away from a tree in front of the figure, as little as needed', () => {
    const tree = { type: 'cyl', x: 0, z: 3, r: 1.2, y0: 1, y1: 6 }; // straight in front (yaw 0 looks from +z)
    const v = clearView(camAt, 0, 0.6, targets, [tree], flat);
    expect(v.before).toBeGreaterThan(0);
    expect(v.blocked).toBe(0);
    expect(Math.abs(v.yaw)).toBeLessThanOrEqual((50 * Math.PI) / 180 + 1e-9);
    expect(v.pitch).toBe(0.6);
  });

  it('looks steeper when the figure is surrounded on all sides', () => {
    const ring = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * 2 * Math.PI;
      ring.push({ type: 'cyl', x: Math.sin(a) * 3, z: Math.cos(a) * 3, r: 1.3, y0: 0.6, y1: 1.2 });
    }
    const v = clearView(camAt, 0, 0.45, targets, ring, flat);
    expect(v.before).toBeGreaterThan(0);
    expect(v.pitch).toBeGreaterThan(0.45);
    expect(v.blocked).toBe(0);
  });
});

describe('CameraRig.positionFor', () => {
  it('returns the pose of another view without changing the current one', () => {
    const cam = new THREE.PerspectiveCamera(40, 1.6, 0.3, 700);
    const rig = new CameraRig(cam, { w: 64, h: 64 });
    rig.lookAt(20, 20); rig.yaw = 0.3; rig.update(0);
    const before = cam.position.clone();
    const p = rig.positionFor(30, 30, Math.PI, 0.9, 20);
    expect(p.z).toBeLessThan(30); // yaw π: camera on the −z side of the target
    expect(rig.yaw).toBe(0.3);
    expect(rig.target.x).toBe(20);
    expect(cam.position.distanceTo(before)).toBeLessThan(1e-9);
  });
});

describe('angleDelta', () => {
  it('takes the short way round', () => {
    expect(angleDelta(0.1, 2 * Math.PI - 0.1)).toBeCloseTo(-0.2);
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6);
  });
});
