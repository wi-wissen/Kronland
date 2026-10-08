// Title video of the start page (src/site/home/heroVideo.js): files, codec order, size choice, motion rules.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { HERO_VIDEO, heroMotion, heroSize } from '../../src/site/home/heroVideo.js';

const LIMIT = { normal: 1024 * 1024, wide: 1.5 * 1024 * 1024 };

describe('Title video of the start page', () => {
  it('per size AV1 before H.264, both MP4 with faststart and small enough', () => {
    for (const [size, list] of Object.entries(HERO_VIDEO)) {
      expect(list.map((v) => v.type.split('"')[1].slice(0, 4)), size).toEqual(['av01', 'avc1']);
      for (const v of list) {
        const buf = readFileSync('public/' + v.path);
        expect(buf.length, v.path).toBeLessThanOrEqual(LIMIT[size]);
        expect(buf.subarray(4, 8).toString('latin1'), v.path).toBe('ftyp');
        // index (moov) before the data (mdat): playback starts before the file is complete
        expect(buf.indexOf('moov'), v.path).toBeLessThan(buf.indexOf('mdat'));
      }
    }
    // no other videos lie around in public/site
    const all = Object.values(HERO_VIDEO).flat().map((v) => v.path.slice(5)).sort();
    expect(readdirSync('public/site').filter((f) => f.endsWith('.mp4')).sort()).toEqual(all);
  });

  it('wide video only for screens with many device pixels, like the still from its srcset', () => {
    expect(heroSize({ width: 1440, dpr: 1 })).toBe('normal');
    expect(heroSize({ width: 412, dpr: 2.625 })).toBe('normal'); // phone
    expect(heroSize({ width: 1920, dpr: 1 })).toBe('wide');
    expect(heroSize({ width: 3840, dpr: 1 })).toBe('wide'); // 4K monitor
    expect(heroSize({ width: 1440, dpr: 2 })).toBe('wide'); // sharp laptop
    expect(heroSize()).toBe('normal');
  });

  it('moves only without "reduce motion" and "save data"', () => {
    expect(heroMotion()).toBe(true);
    expect(heroMotion({ reducedMotion: true })).toBe(false);
    expect(heroMotion({ saveData: true })).toBe(false);
  });
});
