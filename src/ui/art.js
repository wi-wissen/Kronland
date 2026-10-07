// Painted backdrops of the menus (scripts/art/, origin in CREDITS.md). The addresses depend on the site root
// (src/paths.js), so this module sets them as CSS variables; .backdrop in StartMenu.vue reads them.
import { siteUrl } from '../paths.js';

/** Image per backdrop, relative to the site root. */
export const ART = { title: 'art/title.webp', loading: 'art/loading.webp' };

/**
 * CSS variables of the backdrops.
 * @param {(path: string) => string} [url] path → address (default: siteUrl)
 * @returns {Record<string, string>}
 */
export function artVars(url = siteUrl) {
  return { '--art-title': `url("${url(ART.title)}")`, '--art-loading': `url("${url(ART.loading)}")` };
}

/** Sets the variables on <html> and preloads the title image (it is the first thing you see). */
export function applyArt(el = globalThis.document?.documentElement) {
  if (!el) return;
  for (const [k, v] of Object.entries(artVars())) el.style.setProperty(k, v);
  if (typeof Image !== 'undefined') new Image().src = siteUrl(ART.title);
}
