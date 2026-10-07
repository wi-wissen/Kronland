// Click confirmation for walk commands: animation course and the rings handed to GroundMarks.
import { describe, it, expect } from 'vitest';
import { OrderMarkers, orderMarkerPose, orderMarkerScale, ORDER_MARKER_TIME, ORDER_MARKER_COLOR } from '../../src/render/orderMarker.js';

describe('orderMarkerPose', () => {
  it('spreads outwards like a drop and fades evenly, without going back', () => {
    const ages = [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.44];
    const poses = ages.map(orderMarkerPose);
    for (let i = 1; i < poses.length; i++) {
      expect(poses[i].r).toBeGreaterThan(poses[i - 1].r);
      expect(poses[i].alpha).toBeLessThan(poses[i - 1].alpha);
    }
    expect(poses.at(-1).alpha).toBeLessThan(0.1);
  });
  it('is over after its duration', () => {
    expect(orderMarkerPose(ORDER_MARKER_TIME)).toBeNull();
    expect(orderMarkerPose(-0.1)).toBeNull();
  });
});

describe('orderMarkerScale', () => {
  it('grows with camera distance, within limits', () => {
    expect(orderMarkerScale(3)).toBe(1);
    expect(orderMarkerScale(60)).toBeGreaterThan(orderMarkerScale(30));
    expect(orderMarkerScale(500)).toBe(2.4);
  });
});

describe('OrderMarkers', () => {
  const ringsOf = (m, dt) => { const rings = []; m.update(dt, 26, { ring: (...a) => rings.push(a) }, () => 2); return rings; };

  it('draws a dark ring on the ground at the target until it is over', () => {
    const m = new OrderMarkers();
    m.add(5, 6);
    const [ring] = ringsOf(m, 0.1);
    expect(ring.slice(0, 3)).toEqual([5, 2.05, 6]);
    expect(ring[4]).toBe(ORDER_MARKER_COLOR);
    expect(ringsOf(m, ORDER_MARKER_TIME)).toEqual([]);
    expect(m.active).toBe(0);
  });

  it('army and serfs at the same spot: only one marker', () => {
    const m = new OrderMarkers();
    m.add(5, 6); m.add(5.2, 6.1);
    expect(m.active).toBe(1);
    m.add(9, 6);
    expect(m.active).toBe(2);
  });

  it('many quick clicks drop the oldest marker', () => {
    const m = new OrderMarkers();
    for (let i = 0; i < 20; i++) { m.add(i * 3, 0); ringsOf(m, 0.01); }
    expect(m.active).toBe(4);
    expect(m.list.at(-1).x).toBe(57);
  });
});
