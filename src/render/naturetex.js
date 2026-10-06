// Painted texture for nature objects: foliage, needles, bark and boulders (public/textures/nature/<kind>-512.webp,
// generated with scripts/asset-gen/ground.mjs, see docs/BODEN.md). In the game only the light-dark texture counts:
// per kind the brightness is brought to mean 0.5 and equal spread and packed into one colour channel of a
// shared texture (R = crown or rock, G = bark). The shader samples it triplanar (3 lookups for
// both kinds) and brightens or darkens the vertex colour; the hue stays that of the model.
// If the files are missing (or level "low"), there is no texture – as before.

import * as THREE from 'three';
import { assetUrl } from '../paths.js';

/** Nature kinds with a painted image file. */
export const NATURE_IMAGE_KINDS = ['leaves', 'needles', 'bark', 'boulder', 'planks', 'masonry'];
/** Edge length of the packed texture (the texture sits on small objects, 512 is enough even up close). */
export const NATURE_TEX_SIZE = 512;
/** Target spread of the brightness per channel (0…255): same strength for all kinds, independent of the image. */
export const DETAIL_STD = 40;

/** @type {Map<string, ImageBitmap|HTMLImageElement|HTMLCanvasElement>} */
const images = new Map();

/**
 * Load nature textures (before game start). Errors are not fatal: without the file no texture.
 * @param {string} baseUrl folder (with '/' at the end) @param {() => void} [onDone] per file
 * @returns {Promise<number>} number of loaded images
 */
export async function loadNatureImages(baseUrl, onDone = () => {}) {
  await Promise.all(NATURE_IMAGE_KINDS.map(async (kind) => {
    try {
      if (!images.has(kind)) {
        const r = await fetch(assetUrl(`${baseUrl}${kind}-512.webp`));
        if (!r.ok) throw new Error(`${r.status}`);
        images.set(kind, await createImageBitmap(await r.blob()));
      }
    } catch { /* without texture */ } finally { onDone(); }
  }));
  return NATURE_IMAGE_KINDS.filter((k) => images.has(k)).length;
}

export const hasNatureImage = (kind) => images.has(kind);

/**
 * Normalize the brightness of an image to mean 128 and spread `std` (one channel).
 * @param {Uint8Array|Uint8ClampedArray} px pixels with `ch` channels (RGB first) @param {number} [ch]
 * @param {number} [std] target spread @returns {Uint8ClampedArray}
 */
export function normalizedLuminance(px, ch = 4, std = DETAIL_STD) {
  const n = px.length / ch, lum = new Float32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) { const l = 0.299 * px[i * ch] + 0.587 * px[i * ch + 1] + 0.114 * px[i * ch + 2]; lum[i] = l; sum += l; }
  const mean = sum / n;
  let v = 0;
  for (let i = 0; i < n; i++) v += (lum[i] - mean) ** 2;
  const s = std / Math.max(1, Math.sqrt(v / n));
  const out = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) out[i] = Math.round(128 + (lum[i] - mean) * s);
  return out;
}

/**
 * Pack up to three channels into an RGBA image (missing channels neutral 128).
 * @param {(Uint8Array|Uint8ClampedArray|null)[]} channels n values each @param {number} n pixel count
 */
export function packChannels(channels, n) {
  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) out[i * 4 + c] = channels[c] ? channels[c][i] : 128;
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** Draw the image tiled `rep`×`rep` times into a square and read the pixels. */
function pixelsOf(img, size, rep) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const t = size / rep;
  for (let y = 0; y < rep; y++) for (let x = 0; x < rep; x++) ctx.drawImage(img, x * t, y * t, t, t);
  return ctx.getImageData(0, 0, size, size).data;
}

/** @type {Map<string, THREE.DataTexture>} */
const cache = new Map();
/** Cached structure textures (for Renderer.dispose). */
export const sharedNatureTextures = () => [...cache.values()];

/**
 * Packed texture: channel R and G from one nature kind each, `rep` repetitions per channel (finer bark
 * at the same coordinates). null if an image is missing.
 * @param {{kind: string, rep?: number}[]} spec at most three entries (R, G, B)
 * @param {number} [anisotropy]
 */
export function natureDetailTexture(spec, anisotropy = 1) {
  if (spec.some((s) => !images.has(s.kind))) return null;
  const key = spec.map((s) => `${s.kind}x${s.rep ?? 1}`).join('+');
  if (cache.has(key)) return cache.get(key);
  const size = NATURE_TEX_SIZE;
  const data = packChannels(spec.map((s) => normalizedLuminance(pixelsOf(images.get(s.kind), size, s.rep ?? 1))), size * size);
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace; // texture values, not colours
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = anisotropy;
  t.needsUpdate = true;
  cache.set(key, t);
  return t;
}
