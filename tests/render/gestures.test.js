// Two-finger gestures (modelled on MapLibre): tilt only with parallel vertical movement, rotate only above a threshold.
import { describe, it, expect } from 'vitest';
import { pinchMode, twistUnlocked, wrapAngle, MODE_PX, ROTATE_PX } from '../../src/game/gestures.js';

describe('Two-finger gestures', () => {
  it('barely moved: gesture still open', () => {
    expect(pinchMode({ x: 2, y: 3 }, { x: -1, y: 4 }, 1)).toBeNull();
    expect(pinchMode({ x: MODE_PX - 1, y: 0 }, { x: 0, y: 0 }, 0)).toBeNull();
  });

  it('both fingers parallel up or down: tilt', () => {
    expect(pinchMode({ x: 1, y: -20 }, { x: -2, y: -18 }, 2)).toBe('tilt');
    expect(pinchMode({ x: 0, y: 15 }, { x: 3, y: 14 }, -1)).toBe('tilt');
  });

  it('spread, pinch, pan, rotate or opposite directions: zoom (never tilt)', () => {
    // apart (vertical, opposite directions)
    expect(pinchMode({ x: 0, y: -20 }, { x: 0, y: 20 }, 40)).toBe('zoom');
    // spread horizontally
    expect(pinchMode({ x: -15, y: 1 }, { x: 15, y: -1 }, 30)).toBe('zoom');
    // both downwards, but clearly spread apart: pinch with a moving centre, do not tilt
    expect(pinchMode({ x: 0, y: 12 }, { x: 0, y: 30 }, 18)).toBe('zoom');
    // pan sideways
    expect(pinchMode({ x: 20, y: 2 }, { x: 22, y: 1 }, 0)).toBe('zoom');
    // one finger stays, the other circles: rotate
    expect(pinchMode({ x: 0, y: 0 }, { x: 8, y: 12 }, 2)).toBe('zoom');
  });

  it('rotating only from 25 px on the finger circle', () => {
    const d = 200; // finger distance
    expect(twistUnlocked(0.1, d)).toBe(false); // 10 px
    expect(twistUnlocked(-0.2, d)).toBe(false); // 20 px
    expect(twistUnlocked(0.26, d)).toBe(true); // 26 px
    expect(twistUnlocked(-0.26, d)).toBe(true);
    expect(twistUnlocked((2 * ROTATE_PX) / 100 + 0.01, 100)).toBe(true);
  });

  it('angle across ±π without a jump', () => {
    expect(wrapAngle(Math.PI - 0.1 - (-Math.PI + 0.1))).toBeCloseTo(-0.2, 9);
    expect(wrapAngle(0.3)).toBeCloseTo(0.3, 9);
  });
});
