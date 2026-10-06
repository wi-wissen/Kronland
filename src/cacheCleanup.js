// Delete outdated game files from the service worker caches. All game files carry a content hash
// (scripts/vite-hashed-assets.js); after an update the old versions remain in the cache but are never
// requested again. The page knows the current list (src/paths.js) and tidies up quietly after loading.
import { siteRoot, hashedAssetFiles } from './paths.js';

/** Caches with hashed game files (names as in vite.config.js → runtimeCaching). */
export const ASSET_CACHES = ['models', 'textures', 'audio', 'site-images'];
const HASHED = /\.[0-9a-f]{10}\.[a-z0-9]+$/i;

/**
 * Outdated: hashed file below the site root that this build no longer serves.
 * @param {string} url absolute address from the cache @param {string} rootPath path of the site root ('/kronland/')
 * @param {Set<string>} current current hashed paths relative to the root
 */
export function isStale(url, rootPath, current) {
  const path = new URL(url).pathname;
  if (!path.startsWith(rootPath) || !HASHED.test(path)) return false;
  return !current.has(decodeURIComponent(path.slice(rootPath.length)));
}

/** @returns {Promise<number>} number of deleted entries */
export async function cleanupAssetCaches() {
  const current = hashedAssetFiles();
  if (!current.size || typeof caches === 'undefined') return 0;
  const rootPath = new URL(siteRoot(), location.href).pathname;
  let n = 0;
  for (const name of ASSET_CACHES) {
    if (!(await caches.has(name))) continue;
    const cache = await caches.open(name);
    for (const req of await cache.keys()) if (isStale(req.url, rootPath, current) && (await cache.delete(req))) n++;
  }
  return n;
}
