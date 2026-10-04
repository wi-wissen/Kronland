import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { ICONS, GLYPHS } from '../../src/ui/icons/index.js';
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

  // the sheet template lives in assets-src/ (local only, not in Git)
  it.skipIf(!fs.existsSync('assets-src/icons/layout.json'))('matches the sheet template and the file is ready', () => {
    const layout = JSON.parse(fs.readFileSync('assets-src/icons/layout.json', 'utf8'));
    expect(layout.names).toEqual(Object.keys(ATLAS_INDEX));
    expect(fs.existsSync('public/' + ATLAS.url)).toBe(true);
  });
});
