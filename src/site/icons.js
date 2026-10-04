// Icons of the game (src/ui/icons) as SVG data: URL or HTML – for the website without PNG conversion.
import { ICONS, GLYPHS } from '../ui/icons/index.js';

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

/** Icon as an HTML snippet (for v-html tables). */
export function iconHtml(name) {
  const src = svgIcon(name);
  return isGlyph(name)
    ? `<span class="ico glyph" style="--mask:url(&quot;${src}&quot;)" aria-hidden="true"></span>`
    : `<img class="ico" src="${src}" alt="" aria-hidden="true" decoding="async">`;
}
