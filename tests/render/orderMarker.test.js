// Click confirmation for walk commands: animation course and marker pool.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { OrderMarkers, orderMarkerPose, orderMarkerScale, ORDER_MARKER_TIME } from '../../src/render/orderMarker.js';

describe('orderMarkerPose', () => {
  it('appears quickly, turns, contracts into the spot and fades', () => {
    const a = orderMarkerPose(0.15), b = orderMarkerPose(0.5), c = orderMarkerPose(ORDER_MARKER_TIME * 0.98);
    expect(a.alpha).toBe(1);
    expect(b.r).toBeLessThan(a.r);
    expect(Math.abs(b.turn)).toBeGreaterThan(Math.abs(a.turn));
    expect(c.alpha).toBeLessThan(0.1);
  });
  it('is over after its duration', () => {
    expect(orderMarkerPose(ORDER_MARKER_TIME)).toBeNull();
    expect(orderMarkerPose(-0.1)).toBeNull();
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
    m.update(0.2, 24);
    const p = m.pool.find((x) => x.active);
    expect(p.mesh.visible).toBe(true);
    expect(p.mesh.position.toArray()).toEqual([5, 2.05, 6]);
    m.update(ORDER_MARKER_TIME, 24);
    expect(m.active).toBe(0);
    expect(p.mesh.visible).toBe(false);
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
    for (let i = 0; i < 20; i++) { m.add(i * 3, 0); m.update(0.01, 24); }
    expect(m.active).toBe(m.pool.length);
    expect(m.pool.some((p) => p.x === 57)).toBe(true);
  });
});
