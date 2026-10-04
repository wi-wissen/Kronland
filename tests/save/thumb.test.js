import { describe, it, expect } from 'vitest';
import { exploredBox } from '../../src/ui/saves/crop.js';

const fog = (w, h, explored) => {
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  for (const [x, y] of explored) data[(y * w + x) * 4 + 3] = 0;
  return { w, h, data };
};

describe('Preview image crop', () => {
  it('nothing explored: whole map', () => {
    expect(exploredBox(fog(96, 96, []))).toEqual({ x: 0, y: 0, s: 96 });
  });
  it('small explored area: at least 24 tiles, within the map, area included', () => {
    const b = exploredBox(fog(96, 96, [[2, 3], [10, 8]]));
    expect(b.s).toBe(24);
    expect(b.x).toBe(0);
    expect(b.y).toBe(0);
    const c = exploredBox(fog(96, 96, [[90, 90], [60, 70]]));
    expect(c.x + c.s).toBeLessThanOrEqual(96);
    expect(c.x).toBeLessThanOrEqual(60);
    expect(c.y).toBeLessThanOrEqual(70);
    expect(c.s).toBeGreaterThanOrEqual(31);
  });
});
