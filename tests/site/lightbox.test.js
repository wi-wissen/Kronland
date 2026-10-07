// Website lightbox: full-resolution source from srcset, stepping, swipe detection, SVG detection.
import { describe, it, expect } from 'vitest';
import { largestSrc, wrapIndex, swipeStep, isSvg} from '../../src/site/lightbox.js';

describe('Lightbox', () => {
  it('picks the largest srcset candidate, otherwise the src', () => {
    expect(largestSrc('a-small.webp 720w, a.webp 1440w', 'x.webp')).toBe('a.webp');
    expect(largestSrc('b.webp 1440w, b-small.webp 720w', 'x.webp')).toBe('b.webp');
    expect(largestSrc('c.webp 1x, c@2.webp 2x', 'x.webp')).toBe('c@2.webp');
    expect(largestSrc('', 'x.webp')).toBe('x.webp');
    expect(largestSrc(null, 'x.webp')).toBe('x.webp');
  });
  it('wraps around when stepping', () => {
    expect(wrapIndex(0, -1, 3)).toBe(2);
    expect(wrapIndex(2, 1, 3)).toBe(0);
    expect(wrapIndex(1, 1, 3)).toBe(2);
    expect(wrapIndex(0, 1, 0)).toBe(0);
  });
  it('detects horizontal swipes only', () => {
    expect(swipeStep(-80, 5)).toBe(1);
    expect(swipeStep(80, 5)).toBe(-1);
    expect(swipeStep(30, 0)).toBe(0);
    expect(swipeStep(80, 90)).toBe(0);
  });
  it('recognises SVG diagrams', () => {
    expect(isSvg('/blog/rendering/ticks-de.svg')).toBe(true);
    expect(isSvg('/blog/x.svg?v=1')).toBe(true);
    expect(isSvg('/blog/x.webp')).toBe(false);
  });
});
