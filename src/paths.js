// Paths to the site root (folder with models/, audio/, icons …), relative to the current page.
// The game lives under play/, with the start page/manual/compendium next to it. Each page sets, before its scripts,
// window.KRONLAND_ROOT (play/index.html: '../'); if missing, './' applies (page lives in the root).
// All paths stay relative so the build (Vite `base: './'`) can be hosted in any subfolder.
//
// Content hash: in the build, scripts/vite-hashed-assets.js copies the game files from public/ with a hash in the name
// (models/buildings/castle.lod1.glb → models/buildings/castle.lod1.3f2a91c0d7.glb) and injects the mapping
// logical path → file here as __KRONLAND_ASSETS__. In the dev server, in tests and in Node scripts
// it is absent: paths stay unchanged. See docs/PERFORMANCE.md.

/* global __KRONLAND_ASSETS__ */
/** @type {Record<string, string>|null} */
const ASSETS = typeof __KRONLAND_ASSETS__ !== 'undefined' ? __KRONLAND_ASSETS__ : null;

/** Prefix to the site root, always with a trailing '/' (e.g. '../' or './'). */
export function siteRoot() {
  const r = globalThis.KRONLAND_ROOT;
  if (typeof r === 'string' && r) return r.endsWith('/') ? r : `${r}/`;
  return './';
}

const clean = (path) => String(path ?? '').replace(/^(\.\/|\/)+/, '');

/**
 * Logical path (relative to the root) → served path with content hash; unknown paths (folders, pages,
 * files without hash) stay as they are.
 * @param {string} path e.g. 'models/buildings/castle.glb'
 * @param {Record<string, string>|null} [map] mapping (default: the build's)
 */
export function assetPath(path, map = ASSETS) {
  const p = clean(path);
  return map?.[p] ?? p;
}

/**
 * Address of a file relative to the site root (with content hash, if it is a hashed game file).
 * @param {string} path e.g. 'models/', 'audio/manifest.json'
 */
export function siteUrl(path) {
  return siteRoot() + assetPath(path);
}

/**
 * Rewrite an already assembled address (folder prefix + file name, e.g. `${siteUrl('models/')}buildings/village.glb`)
 * to the hashed file. Addresses outside the site root stay unchanged.
 * @param {string} url
 * @param {Record<string, string>|null} [map]
 */
export function assetUrl(url, map = ASSETS) {
  if (!map || typeof url !== 'string') return url;
  const root = siteRoot();
  if (url.startsWith(root)) return root + assetPath(url.slice(root.length), map);
  if (/^[a-z]+:|^\/\//i.test(url) || url.startsWith('../')) return url;
  return assetPath(url, map);
}

/** All served hashed files of this build (empty in the dev server). */
export const hashedAssetFiles = () => new Set(ASSETS ? Object.values(ASSETS) : []);
