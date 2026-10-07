// Addresses of the website for the E2E tests in one place: the game lives under play/.

/** Path of the game (relative to the baseURL from playwright.config.js). */
export const PLAY = '/play/';

/**
 * Address of the game with optional URL parameters.
 * @param {string} [query] e.g. '?seed=42&fog=off'
 */
export const playUrl = (query = '') => PLAY + String(query).replace(/^\/+/, '');

/**
 * Pattern for a game file from public/, with or without content hash in the name (the build appends it:
 * icons/symbols.webp → icons/symbols.477cbc03e9.webp, see docs/PERFORMANCE.md).
 * @param {string} path e.g. 'icons/symbols.webp' @param {string} [end] '$' = must be at the end
 */
export function hashed(path, end = '') {
  const i = path.lastIndexOf('.');
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  return new RegExp(`${esc(path.slice(0, i))}(\\.[0-9a-f]{10})?${esc(path.slice(i))}${end}`);
}

/**
 * Graphics level of specs whose pictures are only evidence (positions, facing and drawn objects are checked in the
 * state, not in the pixels): "low" by default – under software WebGL "high" costs seconds per frame and pushes the
 * runs into timeouts. Pictures in high quality: E2E_SHOT_QUALITY=high npx playwright test e2e/circle.spec.js
 */
export const SHOT_QUALITY = process.env.E2E_SHOT_QUALITY ?? 'low';
