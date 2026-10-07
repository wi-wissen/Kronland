// Image lightbox of the website (ImageLightbox.vue): pure helpers, testable without a browser.

/** Images that can be enlarged: article images in Markdown pages (figures, not code blocks). */
export const ZOOM_SELECTOR = '.prose figure:not(.code) > img';

/**
 * Largest candidate of a srcset ("a.webp 720w, b.webp 1440w"), otherwise the fallback.
 * Width descriptors win over density descriptors; without descriptors a candidate counts as 1x.
 * @param {string | null | undefined} srcset
 * @param {string} fallback
 */
export function largestSrc(srcset, fallback) {
  let best = fallback;
  let bestN = -1;
  for (const part of String(srcset ?? '').split(',')) {
    const [url, desc = '1x'] = part.trim().split(/\s+/);
    if (!url) continue;
    const m = /^(\d+(?:\.\d+)?)([wx])$/.exec(desc);
    if (!m) continue;
    // w descriptors are pixels, x descriptors are scaled to be comparable but rank below any width
    const n = m[2] === 'w' ? Number(m[1]) : Number(m[1]) / 1000;
    if (n > bestN) { bestN = n; best = url; }
  }
  return best;
}

/** Next index when stepping by d through n images (wraps around). */
export const wrapIndex = (i, d, n) => (n > 0 ? (((i + d) % n) + n) % n : 0);

/**
 * Direction of a horizontal swipe: -1 (to the previous image, finger moved right), 1 (next), 0 (no swipe).
 * @param {number} dx horizontal movement in px
 * @param {number} dy vertical movement in px
 * @param {number} [min] minimum distance in px
 */
export function swipeStep(dx, dy, min = 50) {
  if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx > 0 ? -1 : 1;
}

/** SVG diagrams get a light background in the article and in the lightbox. */
export const isSvg = (src) => /\.svg(?:[?#].*)?$/i.test(String(src ?? ''));
