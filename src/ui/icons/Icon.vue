<template>
  <!-- Coloured icons as an image, control icons as a mask in the text colour (currentColor). -->
  <span v-if="isGlyph" class="ico glyph" :style="{ '--mask': `url(&quot;${src}&quot;)` }" aria-hidden="true"></span>
  <img v-else class="ico" :src="src" alt="" aria-hidden="true" draggable="false">
</template>

<script>
import { reactive } from 'vue';
import { ICONS, GLYPHS } from './index.js';

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

/** Convert all icons in advance (e.g. during the loading screen). */
export function preloadIcons() { for (const n of Object.keys(ICONS)) rasterize(n); }

export default {
  name: 'Icon',
  props: { name: { type: String, required: true } },
  computed: {
    isGlyph() { return GLYPHS.has(this.name); },
    src() { return iconUrl(this.name); },
  },
};
</script>

<style>
img.ico { object-fit: contain; -webkit-user-drag: none; }
.ico.glyph {
  background-color: currentColor;
  -webkit-mask: var(--mask) center / contain no-repeat;
  mask: var(--mask) center / contain no-repeat;
}
</style>
