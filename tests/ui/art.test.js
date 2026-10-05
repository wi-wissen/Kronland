import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import sharp from 'sharp';
import { ART, artVars } from '../../src/ui/art.js';

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
});
