// Files of the running level (portraits, recordings, 3D models) – display only, the simulation never sees them.
// A level names a file by its path inside the level ("assets/alchemist.glb"). Where it comes from depends on how
// the level was opened: bundled with the game (Vite), from a .zip (in memory) or by link (next to its
// scenario.json on the same server). Unknown or missing files give null: then the caller shows its placeholder
// (procedural figure, the browser's speech output, a seal with the initial letter).

import { assetPathOk } from '../paths.js';

/** File types a level may bring along (display only) → MIME type. */
export const ASSET_TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', glb: 'model/gltf-binary',
};
export const extOf = (p) => (p.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();
/** May a level bring this file along? A path in its folder assets/ with a known type. */
export const assetAllowed = (path) => assetPathOk(path) && path.startsWith('assets/') && Object.hasOwn(ASSET_TYPES, extOf(path));

/** Bundled levels: 'folder/assets/x.png' → address with content hash. */
const BUNDLED = import.meta.env
  ? Object.fromEntries(Object.entries(import.meta.glob('../sim/missions/levels/*/assets/**', { query: '?url', import: 'default', eager: true })).map(([k, v]) => [k.replace('../sim/missions/levels/', ''), v]))
  : {};

const NONE = { resolve: () => null, revoke: () => {} };
let current = NONE;

/**
 * Files for the level that is about to start.
 * @param {{ scenario: any, assets?: Map<string, Blob>|null, base?: string|null }|null} pkg opened package, or null
 * @param {any} scenario scenario of the starting game (bundled ones find their folder by themselves)
 */
export function useLevelAssets(pkg, scenario) {
  current.revoke();
  current = NONE;
  if (!scenario) return;
  const own = pkg && pkg.scenario && pkg.scenario.id === scenario.id ? pkg : null;
  if (own?.assets?.size) {
    const urls = new Map();
    current = {
      resolve: (p) => {
        if (!own.assets.has(p)) return null;
        if (!urls.has(p)) urls.set(p, URL.createObjectURL(own.assets.get(p)));
        return urls.get(p);
      },
      revoke: () => { for (const u of urls.values()) URL.revokeObjectURL(u); },
    };
  } else if (own?.base) {
    const base = own.base;
    current = { resolve: (p) => new URL(p, base).href, revoke: () => {} };
  } else if (scenario.folder) {
    const folder = scenario.folder;
    current = { resolve: (p) => BUNDLED[`${folder}/${p}`] ?? null, revoke: () => {} };
  }
}

/**
 * Address of a file of the running level, or null (not there – show the placeholder).
 * @param {string|null|undefined} path e.g. "assets/alchemist.png"
 */
export function levelAssetUrl(path) {
  if (typeof path !== 'string' || !assetAllowed(path)) return null;
  try { return current.resolve(path); } catch { return null; }
}
