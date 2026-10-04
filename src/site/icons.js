// Game icons for the website: coloured icons from the same atlas as in the game
// (public/icons/symbols.webp, docs/SYMBOLE.md), control icons and names without an atlas cell as SVG
// (src/ui/icons). Without the game's PNG conversion – nothing redraws constantly on reading pages.
import { ICONS, GLYPHS } from '../ui/icons/index.js';
import { ATLAS, ATLAS_INDEX } from '../ui/icons/atlas.js';
import { siteUrl } from '../paths.js';

const cache = new Map();

/** SVG icon as a data: URL (cached). */
export function svgIcon(name) {
  let u = cache.get(name);
  if (!u) {
    const body = ICONS[name] ?? ICONS.info;
    u = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="64" height="64" color="#000">${body}</svg>`);
    cache.set(name, u);
  }
  return u;
}

export const isGlyph = (name) => GLYPHS.has(name);

/**
 * CSS for an atlas icon (cut-out as background) or null if the atlas has none.
 * The atlas is a single image – the browser loads it once, even for a thousand table cells.
 * @param {string} name @param {string} [url] atlas URL relative to the page
 * @returns {string|null}
 */
export function atlasCss(name, url = siteUrl(ATLAS.url)) {
  const i = ATLAS_INDEX[name];
  if (i === undefined || GLYPHS.has(name)) return null;
  const col = i % ATLAS.cols, row = Math.floor(i / ATLAS.cols);
  const x = (col / (ATLAS.cols - 1)) * 100, y = (row / (ATLAS.rows - 1)) * 100;
  return `background-image:url(&quot;${url}&quot;);background-size:${ATLAS.cols * 100}% ${ATLAS.rows * 100}%;background-position:${+x.toFixed(4)}% ${+y.toFixed(4)}%`;
}

/** Icon as an HTML snippet (for v-html tables). */
export function iconHtml(name) {
  const atlas = atlasCss(name);
  if (atlas) return `<span class="ico atlas" data-icon="${name}" style="${atlas}" aria-hidden="true"></span>`;
  const src = svgIcon(name);
  return isGlyph(name)
    ? `<span class="ico glyph" style="--mask:url(&quot;${src}&quot;)" aria-hidden="true"></span>`
    : `<img class="ico" src="${src}" alt="" aria-hidden="true" decoding="async">`;
}
