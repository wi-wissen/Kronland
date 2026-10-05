import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { ICONS, GLYPHS, PORTRAITS, IMAGE_ICONS } from '../../src/ui/icons/index.js';
import { ATLAS, ATLAS_INDEX } from '../../src/ui/icons/atlas.js';

describe('Icon atlas', () => {
  const colored = Object.keys(ICONS).filter((n) => !GLYPHS.has(n));

  // New icons may be missing (they appear as SVG until the sheet is regenerated, docs/SYMBOLE.md),
  // but the atlas must not point to a removed icon.
  it('only refers to existing coloured icons, UI icons stay vector', () => {
    for (const n of Object.keys(ATLAS_INDEX)) expect(colored).toContain(n);
    const idx = Object.values(ATLAS_INDEX);
    expect(new Set(idx).size).toBe(idx.length);
    expect(Math.max(...idx)).toBeLessThan(ATLAS.cols * ATLAS.rows);
    for (const g of GLYPHS) expect(ATLAS_INDEX[g]).toBeUndefined();
  });

  it('single images complement the atlas: all abilities painted, files are ready', () => {
    const painted = (n) => ATLAS_INDEX[n] !== undefined || !!IMAGE_ICONS[n] || !!PORTRAITS[n];
    // as of 10/2026 every coloured icon is painted; new ones may appear as SVG until the next sheet
    for (const n of colored.filter((n) => n.startsWith('ab-') || n.startsWith('hero-'))) expect(painted(n), n).toBe(true);
    for (const n of Object.keys(IMAGE_ICONS)) { expect(colored).toContain(n); expect(ATLAS_INDEX[n], n).toBeUndefined(); }
    for (const f of Object.values(IMAGE_ICONS)) expect(fs.existsSync('public/' + f), f).toBe(true);
  });

  // the sheet template lives in assets-src/ (local only, not in Git)
  it.skipIf(!fs.existsSync('assets-src/icons/layout.json'))('matches the sheet template and the file is ready', () => {
    const layout = JSON.parse(fs.readFileSync('assets-src/icons/layout.json', 'utf8'));
    // cells 'free-*' are on the sheet but no longer used (old hero images)
    expect(layout.names.filter((n) => !n.startsWith('free-'))).toEqual(Object.keys(ATLAS_INDEX));
    expect(fs.existsSync('public/' + ATLAS.url)).toBe(true);
  });
});

describe('Favicon and app icons (scripts/icons/favicon.py)', () => {
  /** Width and height from the PNG header (IHDR) */
  const pngSize = (f) => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

  it('are available in the right sizes', () => {
    expect(pngSize('public/icon-192.png')).toEqual([192, 192]);
    expect(pngSize('public/icon-512.png')).toEqual([512, 512]);
    expect(pngSize('public/apple-touch-icon.png')).toEqual([180, 180]);
    // ICO: header 0,0,1,0 and three images (16, 32, 48)
    const ico = fs.readFileSync('public/favicon.ico');
    expect([...ico.subarray(0, 4)]).toEqual([0, 0, 1, 0]);
    const sizes = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => ico[6 + i * 16] || 256).sort((a, b) => a - b);
    expect(sizes).toEqual([16, 32, 48]);
  });

  it('every page links favicon and apple icon', () => {
    for (const page of ['index.html', 'play/index.html', 'manual/index.html', 'compendium/index.html']) {
      const html = fs.readFileSync(page, 'utf8');
      expect(html, page).toMatch(/<link rel="icon" href="[.\/]*favicon\.ico"/);
      expect(html, page).toMatch(/<link rel="apple-touch-icon" href="[.\/]*apple-touch-icon\.png"/);
    }
  });
});
