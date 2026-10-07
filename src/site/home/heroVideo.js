// Title video of the start page: the scene of hero.webp recorded in the game as a seamless loop
// (scripts/site-video.py → scripts/video-loop.mjs, docs/WEBSITE.md). The still stays as poster and fallback.

/**
 * First match wins: AV1 (smallest; Chrome, Edge, Firefox, Safari with AV1 hardware) before H.264 (everyone else).
 * Paths relative to the site root (siteUrl adds the content hash in the build).
 */
export const HERO_VIDEO = [
  { path: 'site/hero-loop.av1.mp4', type: 'video/mp4; codecs="av01.0.08M.08"' },
  { path: 'site/hero-loop.h264.mp4', type: 'video/mp4; codecs="avc1.4D4028"' },
];

/**
 * May the title image move? Not with the system's "reduce motion" and not with "save data".
 * @param {{ reducedMotion?: boolean, saveData?: boolean }} o
 */
export const heroMotion = ({ reducedMotion = false, saveData = false } = {}) => !reducedMotion && !saveData;

/** matchMedia without throwing (old browsers, tests without DOM). @param {string} q */
export function matchQuery(q) {
  try { return globalThis.matchMedia?.(q) ?? null; } catch { return null; }
}
