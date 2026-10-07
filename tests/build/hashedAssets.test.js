// Content hash of the game files (scripts/vite-hashed-assets.js), resolution in the game (src/paths.js) and
// cleanup of stale cache entries (src/cacheCleanup.js).

import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildAssetMap, hashedName, isHashed, HASHED_NAME, EXCLUDE } from '../../scripts/vite-hashed-assets.js';
import { assetPath, assetUrl, siteUrl } from '../../src/paths.js';
import { isStale } from '../../src/cacheCleanup.js';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'kronland-assets-'));
  const put = (p, c) => { mkdirSync(join(dir, p, '..'), { recursive: true }); writeFileSync(join(dir, p), c); };
  put('models/buildings/castle.glb', 'A');
  put('models/buildings/castle.lod1.glb', 'B');
  put('models/characters/manifest.json', '{}');
  put('audio/voice/de/x.wav', 'raw');
  put('audio/voice/de/x.src.mp3', 'raw');
  put('models/LICENSE.txt', 'License');
  put('favicon.ico', 'ico');
  return dir;
}

describe('Content hash in the build', () => {
  it('puts the hash before the last extension (also for LOD levels)', () => {
    expect(hashedName('models/a/castle.lod1.glb', 'abcdef0123456789')).toBe('models/a/castle.lod1.abcdef0123.glb');
    expect(HASHED_NAME.test('models/a/castle.lod1.abcdef0123.glb')).toBe(true);
    expect(HASHED_NAME.test('models/a/castle.lod1.glb')).toBe(false);
  });

  it('hashes only game files, no license texts, root files or raw recordings', () => {
    const map = buildAssetMap(fixture());
    expect(Object.keys(map).sort()).toEqual(['models/buildings/castle.glb', 'models/buildings/castle.lod1.glb', 'models/characters/manifest.json']);
    expect(isHashed('favicon.ico')).toBe(false);
    expect(isHashed('blog/rendering/first-3d.webp')).toBe(true);
    expect(isHashed('blog/simulation-core/astar-de.svg')).toBe(true);
    expect(EXCLUDE.test('audio/voice/de/x.wav')).toBe(true);
    // same content → same name, different content → different name
    expect(map['models/buildings/castle.glb']).not.toBe(map['models/buildings/castle.lod1.glb'].replace('.lod1', ''));
    expect(buildAssetMap(fixture())).toEqual(map);
  });
});

describe('Resolution in the game (src/paths.js)', () => {
  const map = { 'models/buildings/castle.glb': 'models/buildings/castle.0123456789.glb', 'site/hero.webp': 'site/hero.aaaaaaaaaa.webp' };
  afterEach(() => { delete globalThis.KRONLAND_ROOT; });

  it('without a build map paths stay unchanged (dev server, tests)', () => {
    expect(assetPath('models/buildings/castle.glb')).toBe('models/buildings/castle.glb');
    expect(siteUrl('audio/manifest.json')).toBe('./audio/manifest.json');
    expect(assetUrl('../models/x.glb')).toBe('../models/x.glb');
  });

  it('resolves logical paths and composed addresses', () => {
    globalThis.KRONLAND_ROOT = '../';
    expect(assetPath('./models/buildings/castle.glb', map)).toBe('models/buildings/castle.0123456789.glb');
    expect(assetUrl('../models/buildings/castle.glb', map)).toBe('../models/buildings/castle.0123456789.glb');
    // folders, unknown files and foreign addresses stay
    expect(assetUrl('../models/', map)).toBe('../models/');
    expect(assetUrl('../models/new.glb', map)).toBe('../models/new.glb');
    expect(assetUrl('https://example.org/models/buildings/castle.glb', map)).toBe('https://example.org/models/buildings/castle.glb');
  });
});

describe('Cleanup of stale cache entries', () => {
  const current = new Set(['models/buildings/castle.0123456789.glb']);
  it('deletes only hashed files that the current build no longer serves', () => {
    expect(isStale('https://x.de/kronland/models/buildings/castle.0123456789.glb', '/kronland/', current)).toBe(false);
    expect(isStale('https://x.de/kronland/models/buildings/castle.9999999999.glb', '/kronland/', current)).toBe(true);
    // unhashed addresses and foreign paths stay untouched
    expect(isStale('https://x.de/kronland/models/buildings/castle.glb', '/kronland/', current)).toBe(false);
    expect(isStale('https://x.de/other/models/a.9999999999.glb', '/kronland/', current)).toBe(false);
  });
});
