<template>
  <!-- Hero portraits as an image, control icons as a mask in the text colour (currentColor), coloured icons from the atlas,
       while it is not loaded (or missing) as a drawn SVG. -->
  <img v-if="portrait" class="ico" :class="{ portrait: round }" :src="portrait" alt="" aria-hidden="true" draggable="false">
  <span v-else-if="isGlyph" class="ico glyph" :style="{ '--mask': `url(&quot;${src}&quot;)` }" aria-hidden="true"></span>
  <span v-else-if="atlasStyle" class="ico atlas" :data-icon="name" :style="atlasStyle" aria-hidden="true"></span>
  <img v-else class="ico" :src="src" alt="" aria-hidden="true" draggable="false">
</template>

<script>
import { reactive } from 'vue';
import { ICONS, GLYPHS, PORTRAITS, IMAGE_ICONS } from './index.js';
import { ATLAS, ATLAS_INDEX } from './atlas.js';
import { siteUrl } from '../../paths.js';

/*
 * Performance: an SVG image is re-rasterised on every redraw of its tile. Above the 3D scene
 * numbers change several times per second – with software graphics that cost half the frame rate.
 * So every icon is converted once into a PNG (96 px); until then the SVG applies.
 */
const RASTER = 96;
const svgCache = new Map();
/** Icon name → PNG data: URL (reactive, so components follow) */
const png = reactive({});
const pending = new Set();

function svgUrl(name) {
  let u = svgCache.get(name);
  if (!u) {
    const body = ICONS[name] ?? ICONS.info;
    // Control icons serve as a mask: only the opacity counts
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${RASTER}" height="${RASTER}" color="#000">${body}</svg>`;
    u = 'data:image/svg+xml,' + encodeURIComponent(svg);
    svgCache.set(name, u);
  }
  return u;
}

function rasterize(name) {
  if (pending.has(name) || typeof document === 'undefined') return;
  pending.add(name);
  const img = new Image();
  img.onload = () => {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = RASTER;
      c.getContext('2d').drawImage(img, 0, 0, RASTER, RASTER);
      png[name] = c.toDataURL('image/png');
    } catch { /* stays SVG */ }
  };
  img.src = svgUrl(name);
}

/** URL of an icon (PNG once available). */
export function iconUrl(name) {
  const p = png[name];
  if (p) return p;
  rasterize(name);
  return svgUrl(name);
}

/*
 * Coloured icons come from an atlas (public/icons/symbols.webp, produced by scripts/icons/slice.mjs):
 * one image for all, one request, offline in the PWA cache. Until it is loaded – or if it is missing –
 * the drawn SVG applies.
 */
const atlas = reactive({ ready: false });
let atlasRequested = false;
function loadAtlas() {
  if (atlasRequested || typeof Image === 'undefined') return;
  atlasRequested = true;
  const img = new Image();
  img.onload = () => { atlas.ready = true; };
  img.src = siteUrl(ATLAS.url);
}

/** Background style for an atlas icon or null (then SVG). */
export function atlasStyle(name) {
  const i = ATLAS_INDEX[name];
  if (i === undefined) return null;
  loadAtlas();
  if (!atlas.ready) return null;
  const col = i % ATLAS.cols, row = Math.floor(i / ATLAS.cols);
  return {
    backgroundImage: `url("${siteUrl(ATLAS.url)}")`,
    backgroundSize: `${ATLAS.cols * 100}% ${ATLAS.rows * 100}%`,
    backgroundPosition: `${(col / (ATLAS.cols - 1)) * 100}% ${(row / (ATLAS.rows - 1)) * 100}%`,
  };
}

/** Convert all icons in advance (e.g. during the loading screen). */
export function preloadIcons() {
  loadAtlas();
  for (const n of Object.keys(ICONS)) if (GLYPHS.has(n) || ATLAS_INDEX[n] === undefined) rasterize(n);
}

export default {
  name: 'Icon',
  props: { name: { type: String, required: true } },
  computed: {
    portrait() { const p = PORTRAITS[this.name] ?? IMAGE_ICONS[this.name]; return p ? siteUrl(p) : null; },
    round() { return !!PORTRAITS[this.name]; },
    isGlyph() { return GLYPHS.has(this.name); },
    atlasStyle() { return atlasStyle(this.name); },
    src() { return iconUrl(this.name); },
  },
};
</script>

<style>
img.ico { object-fit: contain; -webkit-user-drag: none; }
img.ico.portrait { object-fit: cover; border-radius: 18%; }
.ico.atlas { background-repeat: no-repeat; }
.ico.glyph {
  background-color: currentColor;
  -webkit-mask: var(--mask) center / contain no-repeat;
  mask: var(--mask) center / contain no-repeat;
}
</style>
