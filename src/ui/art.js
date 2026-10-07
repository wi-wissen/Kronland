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

/**
 * Animated title backdrop: seamless loop of the title image (scripts/art/video.mjs + loop.mjs, origin in CREDITS.md).
 * First match wins: AV1 (smallest; Chrome, Firefox, Edge, Safari with AV1 hardware) before H.264 (everyone else).
 * Its first frame is the title image, so the switch from the still to the running clip is invisible.
 */
export const ART_LOOP = [
  { path: 'art/title-loop.av1.mp4', type: 'video/mp4; codecs="av01.0.05M.08"' },
  { path: 'art/title-loop.h264.mp4', type: 'video/mp4; codecs="avc1.4D401F"' },
];

/**
 * May the menu backdrop move? Off by setting, with the system's "reduce motion" and with "save data".
 * @param {{ setting: boolean, reducedMotion?: boolean, saveData?: boolean }} o
 */
export const menuMotionAllowed = ({ setting, reducedMotion = false, saveData = false }) => !!setting && !reducedMotion && !saveData;

/** Sets the variables on <html> and preloads the title image (it is the first thing you see). */
export function applyArt(el = globalThis.document?.documentElement) {
  if (!el) return;
  for (const [k, v] of Object.entries(artVars())) el.style.setProperty(k, v);
  if (typeof Image !== 'undefined') new Image().src = siteUrl(ART.title);
}
