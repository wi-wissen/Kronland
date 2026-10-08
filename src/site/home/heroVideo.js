// Title video of the start page: the scene of hero.webp recorded in the game as a seamless loop
// (scripts/site-video.py → scripts/video-loop.mjs, docs/WEBSITE.md). The still stays as poster and fallback.

/**
 * Two sizes: 1440 px and, for large or sharp screens, 1920 px (2880 px like hero-wide.webp would be twice the bytes
 * for little visible gain in motion). Both cut from one recording at 2880 px. Per size, the first playable source wins:
 * AV1 (smallest; Chrome, Edge, Firefox, Safari with AV1 hardware) before H.264 (everyone else).
 * Paths relative to the site root (siteUrl adds the content hash in the build).
 */
export const HERO_VIDEO = {
  normal: [
    { path: 'site/hero-loop.av1.mp4', type: 'video/mp4; codecs="av01.0.08M.08"' },
    { path: 'site/hero-loop.h264.mp4', type: 'video/mp4; codecs="avc1.4D4028"' },
  ],
  wide: [
    { path: 'site/hero-loop-wide.av1.mp4', type: 'video/mp4; codecs="av01.0.12M.08"' },
    { path: 'site/hero-loop-wide.h264.mp4', type: 'video/mp4; codecs="avc1.4D4032"' },
  ],
};

/** Screens wider than this many device pixels (large monitors, 4K, sharp laptops and tablets) get the wide video. */
export const HERO_WIDE_FROM = 1600;

/**
 * Which size fits the screen? Device pixels of the window width, as the browser picks hero-wide.webp from the srcset.
 * @param {{ width?: number, dpr?: number }} o
 * @returns {'normal' | 'wide'}
 */
export const heroSize = ({ width = 0, dpr = 1 } = {}) => (width * (dpr || 1) > HERO_WIDE_FROM ? 'wide' : 'normal');

/**
 * May the title image move? Not with the system's "reduce motion" and not with "save data".
 * @param {{ reducedMotion?: boolean, saveData?: boolean }} o
 */
export const heroMotion = ({ reducedMotion = false, saveData = false } = {}) => !reducedMotion && !saveData;

/** matchMedia without throwing (old browsers, tests without DOM). @param {string} q */
export function matchQuery(q) {
  try { return globalThis.matchMedia?.(q) ?? null; } catch { return null; }
}
