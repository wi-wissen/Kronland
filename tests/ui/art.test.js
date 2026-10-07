import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import sharp from 'sharp';
import { ART, ART_LOOP, artVars, menuMotionAllowed } from '../../src/ui/art.js';

describe('Painted backdrops (src/ui/art.js)', () => {
  it('sets the addresses relative to the website root as CSS variables', () => {
    expect(artVars((p) => '../' + p)).toEqual({ '--art-title': 'url("../art/title.webp")', '--art-loading': 'url("../art/loading.webp")' });
  });

  it('images are ready: wide, WebP, under 400 KB', async () => {
    for (const f of Object.values(ART)) {
      const file = 'public/' + f;
      expect(fs.statSync(file).size, f).toBeLessThan(400 * 1024);
      const m = await sharp(file).metadata();
      expect(m.format).toBe('webp');
      expect(m.width / m.height).toBeGreaterThan(1.7);
      expect(m.width).toBeGreaterThanOrEqual(1920);
    }
  });

  it('the PWA caches them too (globPatterns contains webp, art/ not excluded)', () => {
    const cfg = fs.readFileSync('vite.config.js', 'utf8');
    expect(cfg).toMatch(/globPatterns: \[[^\]]*webp/);
    expect(cfg).not.toMatch(/globIgnores: \[[^\]]*'art\//);
  });

  it('the moving backdrop exists: AV1 before H.264, both MP4 and small (under 1.5 MB)', () => {
    expect(ART_LOOP.map((s) => s.type.split('"')[1].slice(0, 4))).toEqual(['av01', 'avc1']);
    for (const s of ART_LOOP) {
      const buf = fs.readFileSync('public/' + s.path);
      expect(buf.length, s.path).toBeLessThan(1.5 * 1024 * 1024);
      expect(buf.subarray(4, 8).toString('latin1'), s.path).toBe('ftyp'); // MP4 container
      // faststart: the index (moov) comes before the data (mdat), so playback starts before the file is complete
      expect(buf.indexOf('moov'), s.path).toBeLessThan(buf.indexOf('mdat'));
    }
  });

  it('moves only when allowed: setting on, no "reduce motion", no "save data"', () => {
    expect(menuMotionAllowed({ setting: true })).toBe(true);
    expect(menuMotionAllowed({ setting: false })).toBe(false);
    expect(menuMotionAllowed({ setting: true, reducedMotion: true })).toBe(false);
    expect(menuMotionAllowed({ setting: true, saveData: true })).toBe(false);
  });
});
