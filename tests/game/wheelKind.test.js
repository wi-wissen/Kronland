// Wheel classification: mouse wheel, touchpad swipe, touchpad pinch (src/game/wheelKind.js).
import { describe, it, expect } from 'vitest';
import { wheelKind } from '../../src/game/wheelKind.js';

const ev = (deltaY, deltaX = 0, extra = {}) => ({ deltaX, deltaY, deltaMode: 0, ...extra });
const fresh = () => ({ pad: false, at: 0 });

describe('wheelKind', () => {
  it('Ctrl is a pinch whatever the setting', () => {
    expect(wheelKind(ev(3, 0, { ctrlKey: true }), 'auto', fresh(), 0)).toBe('pinch');
    expect(wheelKind(ev(3, 0, { ctrlKey: true }), 'mouse', fresh(), 0)).toBe('pinch');
  });

  it('the setting overrides the guess', () => {
    expect(wheelKind(ev(100), 'touchpad', fresh(), 0)).toBe('touchpad');
    expect(wheelKind(ev(4, 2), 'mouse', fresh(), 0)).toBe('mouse');
  });

  it('big whole steps and line mode are a mouse', () => {
    expect(wheelKind(ev(100), 'auto', fresh(), 0)).toBe('mouse');
    expect(wheelKind(ev(120), 'auto', fresh(), 0)).toBe('mouse');
    expect(wheelKind({ deltaX: 0, deltaY: 3, deltaMode: 1 }, 'auto', fresh(), 0)).toBe('mouse');
  });

  it('small steps, sideways movement and fractions are a touchpad', () => {
    expect(wheelKind(ev(7), 'auto', fresh(), 0)).toBe('touchpad');
    expect(wheelKind(ev(120, 5), 'auto', fresh(), 0)).toBe('touchpad');
    expect(wheelKind(ev(60.5), 'auto', fresh(), 0)).toBe('touchpad');
  });

  it('a touchpad swipe with a big step stays a touchpad, a mouse notch later switches back', () => {
    const s = fresh();
    expect(wheelKind(ev(8), 'auto', s, 0)).toBe('touchpad');
    expect(wheelKind(ev(90), 'auto', s, 100)).toBe('touchpad');
    expect(wheelKind(ev(100), 'auto', s, 2000)).toBe('mouse');
    expect(wheelKind(ev(100), 'auto', s, 2100)).toBe('mouse');
  });
});
