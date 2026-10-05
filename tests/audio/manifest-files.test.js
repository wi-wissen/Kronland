// Checks the shipped public/audio/manifest.json: valid names, existing files, nothing silently discarded.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseManifest, CATEGORIES } from '../../src/audio/manifest.js';
import { SFX_NAMES } from '../../src/audio/sfx.js';
import { AMBIENT_LAYERS } from '../../src/audio/ambient.js';
import { MUSIC_THEMES } from '../../src/audio/music.js';

const AUDIO = path.resolve(__dirname, '../../public/audio');
const raw = JSON.parse(fs.readFileSync(path.join(AUDIO, 'manifest.json'), 'utf8'));
const NAMES = { sfx: SFX_NAMES, music: MUSIC_THEMES, ambient: AMBIENT_LAYERS };
const filesOf = (v) => (typeof v === 'string' ? [v] : Array.isArray(v) ? v : v.files);

describe('Audio manifest (public/audio)', () => {
  it('only knows valid names', () => {
    for (const cat of CATEGORIES) for (const name of Object.keys(raw[cat] ?? {})) expect(NAMES[cat], `${cat}.${name}`).toContain(name);
  });

  it('every listed file exists, is small enough and is accepted', () => {
    const m = parseManifest(raw, 'audio/');
    for (const cat of CATEGORIES) {
      for (const [name, v] of Object.entries(raw[cat] ?? {})) {
        const files = filesOf(v);
        expect(m[cat][name]?.files.length, `${cat}.${name} discarded`).toBe(files.length);
        for (const f of files) {
          const p = path.join(AUDIO, f);
          expect(fs.existsSync(p), f).toBe(true);
          if (cat === 'sfx') expect(fs.statSync(p).size, f).toBeLessThan(64 * 1024);
          if (cat === 'music') expect(fs.statSync(p).size, f).toBeLessThan(3 * 1024 * 1024);
        }
        if (typeof v === 'object' && !Array.isArray(v) && 'gain' in v) expect(v.gain).toBeGreaterThan(0);
      }
    }
  });

  it.each(['sfx', 'music'])('every file under %s/ is listed in the manifest', (cat) => {
    const dir = path.join(AUDIO, cat);
    if (!fs.existsSync(dir)) return;
    const listed = new Set(Object.values(raw[cat] ?? {}).flatMap(filesOf));
    for (const f of fs.readdirSync(dir)) expect(listed.has(`${cat}/${f}`), f).toBe(true);
  });
});
