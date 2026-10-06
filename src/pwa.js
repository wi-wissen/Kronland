// Register the service worker (vite-plugin-pwa, generateSW). It lives in the site root (sw.js) and
// applies to the whole site; the game under play/ registers it with a path to the root (src/paths.js).
// Build only – the dev server has no sw.js.
import { siteRoot, siteUrl } from './paths.js';
import { cleanupAssetCaches } from './cacheCleanup.js';

export function registerServiceWorker() {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const go = () => {
    navigator.serviceWorker.register(siteUrl('sw.js'), { scope: siteRoot() }).catch(() => {});
    // delete old versions of changed game files later, at leisure (they do not disturb loading)
    setTimeout(() => cleanupAssetCaches().catch(() => {}), 30_000);
  };
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}
