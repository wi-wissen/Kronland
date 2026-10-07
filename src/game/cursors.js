// Mouse cursors over the map (desktop): a glove as the normal pointer; with a selection the cursor announces
// what a right click would do (axe on a tree, pickaxe on a pile, hammer on a construction site, sword on an enemy).
// Painted like the icons (scripts/art/, job "cursors"), hot spot generated in cursorHotspots.js.

import { siteUrl } from '../paths.js';
import { CURSOR_HOTSPOTS } from './cursorHotspots.js';

/** @typedef {'attack'|'chop'|'mine'|'build'} CursorKind */

/** All cursor kinds with a picture besides the glove. */
export const CURSOR_KINDS = ['attack', 'chop', 'mine', 'build'];

const cache = new Map();

/**
 * CSS cursor value; null gives the glove. Falls back to the system pointer if the picture does not load.
 * @param {CursorKind|null} kind
 * @param {(path: string) => string} [url] logical path → address (default: siteUrl, with content hash)
 */
export function cursorCss(kind, url = siteUrl) {
  const name = kind && CURSOR_HOTSPOTS[kind] ? kind : 'hand';
  const key = `${name}|${url === siteUrl ? '' : 'x'}`;
  if (!cache.has(key)) {
    const [x, y] = CURSOR_HOTSPOTS[name] ?? [0, 0];
    cache.set(key, `url("${url(`icons/cursor-${name}.png`)}") ${x} ${y}, ${kind ? 'pointer' : 'default'}`);
  }
  return cache.get(key);
}
