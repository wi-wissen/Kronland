// Click confirmation for commands: animation course, target point and marker pool.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { OrderMarkers, orderMarkerPose, orderMarkerScale, orderPoint, ORDER_MARKER_TIME, ORDER_COLORS } from '../../src/render/orderMarker.js';

describe('orderMarkerPose', () => {
  it('arrows come down from above and converge, then the ring spreads and fades', () => {
    const start = orderMarkerPose(0.02), land = orderMarkerPose(ORDER_MARKER_TIME * 0.45), late = orderMarkerPose(ORDER_MARKER_TIME * 0.95);
    expect(start.arrowY).toBeGreaterThan(land.arrowY);
    expect(start.arrowR).toBeGreaterThan(land.arrowR);
    expect(start.ringAlpha).toBe(0);
    expect(late.ringR).toBeGreaterThan(land.ringR);
    expect(late.ringAlpha).toBeLessThan(0.3);
    expect(late.arrowAlpha).toBeLessThan(0.2);
  });
  it('is over after its duration', () => {
    expect(orderMarkerPose(ORDER_MARKER_TIME)).toBeNull();
    expect(orderMarkerPose(-0.1)).toBeNull();
  });
});

describe('orderMarkerScale', () => {
  it('grows with camera distance, within limits', () => {
    expect(orderMarkerScale(3)).toBe(1);
    expect(orderMarkerScale(50)).toBeGreaterThan(orderMarkerScale(25));
    expect(orderMarkerScale(500)).toBe(3);
  });
});

describe('orderPoint', () => {
  it('figure in milli-tiles, building and tree centre, plain point', () => {
    expect(orderPoint({ kind: 'unit', px: 12500, py: 3250 })).toEqual({ x: 12.5, y: 3.25 });
    expect(orderPoint({ kind: 'building', x: 10, y: 4, w: 3, h: 2 })).toEqual({ x: 11.5, y: 5 });
    expect(orderPoint({ kind: 'tree', x: 7, y: 8 })).toEqual({ x: 7.5, y: 8.5 });
    expect(orderPoint({ x: 7.2, y: 8.9 })).toEqual({ x: 7.2, y: 8.9 });
    expect(orderPoint(null)).toBeNull();
  });
});

describe('OrderMarkers', () => {
  const make = () => { const scene = new THREE.Scene(); return { scene, m: new OrderMarkers(scene, () => 2) }; };

  it('shows a marker on the ground in the colour of the command and hides it afterwards', () => {
    const { m } = make();
    m.add('attack', 5, 6);
    m.update(0.1, 26);
    const p = m.pool.find((x) => x.active);
    expect(p.group.visible).toBe(true);
    expect(p.group.position.toArray()).toEqual([5, 2.05, 6]);
    expect(p.ringMat.color.getHex()).toBe(ORDER_COLORS.attack);
    m.update(ORDER_MARKER_TIME, 26);
    expect(m.active).toBe(0);
    expect(p.group.visible).toBe(false);
  });

  it('army and serfs at the same spot: only one marker', () => {
    const { m } = make();
    m.add('move', 5, 6); m.add('move', 5.2, 6.1);
    expect(m.active).toBe(1);
    m.add('move', 9, 6);
    expect(m.active).toBe(2);
  });

  it('many quick clicks reuse the oldest marker', () => {
    const { m } = make();
    for (let i = 0; i < 20; i++) { m.add('move', i * 3, 0); m.update(0.01, 26); }
    expect(m.active).toBe(m.pool.length);
    expect(m.pool.some((p) => p.x === 57)).toBe(true);
  });
});
