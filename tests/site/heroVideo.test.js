// Title video of the start page (src/site/home/heroVideo.js): files, codec order, motion rules.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { HERO_VIDEO, heroMotion } from '../../src/site/home/heroVideo.js';

describe('Title video of the start page', () => {
  it('AV1 before H.264, both MP4 with faststart and at most 2 MB', () => {
    expect(HERO_VIDEO.map((v) => v.type.split('"')[1].slice(0, 4))).toEqual(['av01', 'avc1']);
    for (const v of HERO_VIDEO) {
      const buf = readFileSync('public/' + v.path);
      expect(buf.length, v.path).toBeLessThanOrEqual(2 * 1024 * 1024);
      expect(buf.subarray(4, 8).toString('latin1'), v.path).toBe('ftyp');
      // index (moov) before the data (mdat): playback starts before the file is complete
      expect(buf.indexOf('moov'), v.path).toBeLessThan(buf.indexOf('mdat'));
    }
    // no other videos lie around in public/site
    expect(readdirSync('public/site').filter((f) => f.endsWith('.mp4')).sort()).toEqual(HERO_VIDEO.map((v) => v.path.slice(5)).sort());
  });

  it('moves only without "reduce motion" and "save data"', () => {
    expect(heroMotion()).toBe(true);
    expect(heroMotion({ reducedMotion: true })).toBe(false);
    expect(heroMotion({ saveData: true })).toBe(false);
  });
});
