// Register the service worker (vite-plugin-pwa, generateSW). It lives in the site root (sw.js) and
// applies to the whole site; the game under play/ registers it with a path to the root (src/paths.js).
// Build only – the dev server has no sw.js.
import { siteRoot, siteUrl } from './paths.js';

export function registerServiceWorker() {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const go = () => navigator.serviceWorker.register(siteUrl('sw.js'), { scope: siteRoot() }).catch(() => {});
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}
