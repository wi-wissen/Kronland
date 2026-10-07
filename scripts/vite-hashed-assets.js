// Vite plugin: serve game files from public/ with a content hash in the name (cache busting like Vite's own
// bundles). Vite otherwise copies public/ unchanged – then a browser or service worker cannot tell a changed file
// from the old one. With a hash, same name = same content, so everything may be cached forever
// (CacheFirst, `Cache-Control: immutable`); a changed file gets a new name and
// is the only one reloaded.
//
//   public/models/buildings/castle.lod1.glb  →  dist/models/buildings/castle.lod1.3f2a91c0d7.glb
//
// The mapping logical path → file ends up as __KRONLAND_ASSETS__ in the game code (src/paths.js resolves with it).
// Build only; in the dev server everything stays as it is. Docs: docs/PERFORMANCE.md.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';

/** Folders under public/ whose files are hashed (everything the game or the website loads at runtime). */
export const HASHED_DIRS = ['models', 'textures', 'audio', 'icons', 'portraits', 'art', 'site', 'blog'];
/** Extensions that are hashed; other files (licence texts …) are copied unchanged. */
export const HASHED_EXT = /\.(glb|gltf|json|webp|png|jpg|svg|mp3|ogg|opus|m4a|webm|wav)$/i;
/** Working files that are never shipped (raw voice recordings, see .gitignore). */
export const EXCLUDE = /(^|\/)\.|\.src\.mp3$|^audio\/voice\/.*\.wav$/;
/** Length of the hash in the file name (hex characters of SHA-256). */
export const HASH_LEN = 10;
/** Recognises hashed file names (service worker, cache cleanup). */
export const HASHED_NAME = new RegExp(`\\.[0-9a-f]{${HASH_LEN}}\\.[a-z0-9]+$`, 'i');

/** All files under dir (relative, with '/'). */
export function listFiles(dir, base = dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p, base));
    else if (e.isFile()) out.push(relative(base, p).split(sep).join('/'));
  }
  return out.sort();
}

/** 'models/a/b.lod1.glb' + hash → 'models/a/b.lod1.<hash>.glb' */
export function hashedName(path, hash) {
  const i = path.lastIndexOf('.');
  return `${path.slice(0, i)}.${hash.slice(0, HASH_LEN)}${path.slice(i)}`;
}

/** Is this file hashed? */
export const isHashed = (path) => HASHED_DIRS.includes(path.split('/')[0]) && HASHED_EXT.test(path);

/**
 * Mapping logical path → hashed path for all files in publicDir that are to be hashed.
 * @param {string} publicDir
 * @returns {Record<string, string>}
 */
export function buildAssetMap(publicDir) {
  /** @type {Record<string, string>} */
  const map = {};
  for (const f of listFiles(publicDir)) {
    if (!isHashed(f) || EXCLUDE.test(f)) continue;
    const hash = createHash('sha256').update(readFileSync(join(publicDir, f))).digest('hex');
    map[f] = hashedName(f, hash);
  }
  return map;
}

/** @returns {import('vite').Plugin} */
export default function hashedAssets() {
  /** @type {Record<string, string>} */
  let map = {};
  let publicDir = '', outDir = '';
  return {
    name: 'kronland:hashed-assets',
    config(cfg, { command }) {
      if (command !== 'build') return;
      publicDir = resolve(cfg.root ?? process.cwd(), cfg.publicDir || 'public');
      map = buildAssetMap(publicDir);
      // the plugin copies public/ itself (with hash); Vite should not copy it again unhashed
      return { define: { __KRONLAND_ASSETS__: JSON.stringify(map) }, build: { copyPublicDir: false } };
    },
    configResolved(cfg) {
      outDir = resolve(cfg.root, cfg.build.outDir);
    },
    // before vite-plugin-pwa (closeBundle), so that the service worker already sees the hashed files
    writeBundle() {
      if (!publicDir) return;
      for (const f of listFiles(publicDir)) {
        if (EXCLUDE.test(f)) continue;
        const target = join(outDir, map[f] ?? f);
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(join(publicDir, f), target);
      }
      const bytes = Object.keys(map).reduce((s, f) => s + statSync(join(publicDir, f)).size, 0);
      this.info?.(`${Object.keys(map).length} game files with content hash (${(bytes / 1e6).toFixed(1)} MB)`);
    },
  };
}
