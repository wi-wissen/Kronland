// Click confirmation for walk commands: animation course and marker pool.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { OrderMarkers, orderMarkerWave, orderMarkerScale, ORDER_MARKER_TIME } from '../../src/render/orderMarker.js';

describe('orderMarkerWave', () => {
  it('arrows flow inwards, fade in and out; the second wave follows the first', () => {
    const a = orderMarkerWave(0.1, 0), b = orderMarkerWave(0.4, 0);
    expect(b.r).toBeLessThan(a.r);
    expect(orderMarkerWave(0.05, 1)).toBeNull();
    expect(orderMarkerWave(0.3, 1)).not.toBeNull();
    expect(orderMarkerWave(0.539, 0).alpha).toBeLessThan(0.05);
  });
  it('everything is over after the duration', () => {
    expect(orderMarkerWave(ORDER_MARKER_TIME, 0)).toBeNull();
    expect(orderMarkerWave(ORDER_MARKER_TIME, 1)).toBeNull();
  });
});

describe('orderMarkerScale', () => {
  it('grows with camera distance, within limits', () => {
    expect(orderMarkerScale(3)).toBe(0.8);
    expect(orderMarkerScale(50)).toBeGreaterThan(orderMarkerScale(25));
    expect(orderMarkerScale(500)).toBe(2.4);
  });
});

describe('OrderMarkers', () => {
  const make = () => new OrderMarkers(new THREE.Scene(), () => 2);

  it('shows a marker on the ground and hides it afterwards', () => {
    const m = make();
    m.add(5, 6);
    m.update(0.2, 28);
    const p = m.pool.find((x) => x.active);
    expect(p.group.visible).toBe(true);
    expect(p.group.position.toArray()).toEqual([5, 2.05, 6]);
    // arrows lie around the centre and point at it
    p.group.updateMatrixWorld(true);
    for (const a of p.waves[0].mesh) {
      const centre = new THREE.Vector3().setFromMatrixPosition(a.matrixWorld);
      const tip = new THREE.Vector3().fromBufferAttribute(a.geometry.attributes.position, 0).applyMatrix4(a.matrixWorld);
      const r = (v) => Math.hypot(v.x - 5, v.z - 6);
      expect(r(centre)).toBeGreaterThan(0.1);
      expect(r(tip)).toBeLessThan(r(centre));
    }
    m.update(ORDER_MARKER_TIME, 28);
    expect(m.active).toBe(0);
    expect(p.group.visible).toBe(false);
  });

  it('army and serfs at the same spot: only one marker', () => {
    const m = make();
    m.add(5, 6); m.add(5.2, 6.1);
    expect(m.active).toBe(1);
    m.add(9, 6);
    expect(m.active).toBe(2);
  });

  it('many quick clicks reuse the oldest marker', () => {
    const m = make();
    for (let i = 0; i < 20; i++) { m.add(i * 3, 0); m.update(0.01, 28); }
    expect(m.active).toBe(m.pool.length);
    expect(m.pool.some((p) => p.x === 57)).toBe(true);
  });
});
