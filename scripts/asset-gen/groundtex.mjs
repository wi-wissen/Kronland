// Image tools for ground textures from the image AI (scripts/asset-gen/ground.mjs): make seamlessly tileable and
// match the mean colour. Pure functions on pixel arrays (tested in tests/scripts/groundtex.test.js).
//
// Seamless: image models rarely deliver tileable images on their own.
// Two passes: first horizontal, then vertical. In each pass the image is blended with a copy shifted by half the
// width (height). At the edge only the copy counts whose content is continuous across the edge there; in the middle
// only the original, where the copy has its seam. The transition zone blends by
// brightness (the brighter one prevails, like the height blending in the terrain shader), so that no
// uniform double-exposure streak appears.

const smooth = (t) => t * t * (3 - 2 * t);

/**
 * Weight of the original at position i (0…n−1): 0 at the edge, 1 from `band`·n away from the edge.
 * @param {number} i @param {number} n @param {number} band fraction of the width (0…0.5)
 */
export function edgeWeight(i, n, band) {
  const d = Math.min(i + 0.5, n - i - 0.5) / Math.max(1, band * n);
  return smooth(Math.max(0, Math.min(1, d)));
}

/** One pass along an axis. */
function pass(src, w, h, ch, band, horizontal) {
  const out = new Uint8ClampedArray(src.length);
  const n = horizontal ? w : h;
  const weights = Float32Array.from({ length: n }, (_, i) => edgeWeight(i, n, band));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = horizontal ? (x + (w >> 1)) % w : x;
      const sy = horizontal ? y : (y + (h >> 1)) % h;
      const a = (y * w + x) * ch, b = (sy * w + sx) * ch;
      const t = weights[horizontal ? x : y];
      // brightness of both sources: the brighter one prevails in the transition zone (0 and 1 stay exact)
      const la = (src[a] * 0.299 + src[a + 1] * 0.587 + src[a + 2] * 0.114) / 255;
      const lb = (src[b] * 0.299 + src[b + 1] * 0.587 + src[b + 2] * 0.114) / 255;
      const m = Math.max(0, Math.min(1, t + (la - lb) * 3 * t * (1 - t) * 4));
      for (let c = 0; c < ch; c++) out[a + c] = src[a + c] * m + src[b + c] * (1 - m);
    }
  }
  return out;
}

/**
 * Make an image seamlessly tileable.
 * @param {Uint8Array|Uint8ClampedArray} src pixels (rows, `ch` channels, RGB first)
 * @param {number} w @param {number} h @param {number} [ch] channels (3 or 4)
 * @param {number} [band] width of the transition zone as a fraction of the edge length
 * @returns {Uint8ClampedArray}
 */
export function makeSeamless(src, w, h, ch = 3, band = 0.22) {
  return pass(pass(src, w, h, ch, band, true), w, h, ch, band, false);
}

/**
 * Mean colour jump across the tile edges (right→left, bottom→top) relative to neighbouring
 * pixels inside the image. ≈ 1 means: no stronger at the seam than elsewhere in the image.
 */
export function seamRatio(px, w, h, ch = 3) {
  const diff = (a, b) => { let s = 0; for (let c = 0; c < 3; c++) s += Math.abs(px[a + c] - px[b + c]); return s; };
  let seam = 0, inner = 0;
  for (let y = 0; y < h; y++) {
    seam += diff((y * w + w - 1) * ch, (y * w) * ch);
    inner += diff((y * w + (w >> 1) - 1) * ch, (y * w + (w >> 1)) * ch);
  }
  for (let x = 0; x < w; x++) {
    seam += diff(((h - 1) * w + x) * ch, x * ch);
    inner += diff((((h >> 1) - 1) * w + x) * ch, ((h >> 1) * w + x) * ch);
  }
  return seam / Math.max(1, inner);
}

/** Mean per colour channel (RGB, `ch` channels per pixel). */
export function meanColor(px, ch = 3) {
  const m = [0, 0, 0];
  for (let i = 0; i < px.length; i += ch) { m[0] += px[i]; m[1] += px[i + 1]; m[2] += px[i + 2]; }
  return m.map((v) => v / (px.length / ch));
}

/**
 * Shift the mean to a target colour (additive: the painted light-dark differences are preserved).
 * @param {Uint8Array|Uint8ClampedArray} px @param {number[]} target RGB 0…255 @param {number} [ch]
 */
export function shiftMean(px, target, ch = 3) {
  const m = meanColor(px, ch), d = target.map((t, c) => t - m[c]);
  const out = new Uint8ClampedArray(px.length);
  for (let i = 0; i < px.length; i += ch) for (let c = 0; c < ch; c++) out[i + c] = px[i + c] + (c < 3 ? d[c] : 0);
  return out;
}
