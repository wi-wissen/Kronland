<template>
  <!-- Like ui/icons/Icon.vue: coloured icons from the game's atlas, control icons as a mask in the
       text colour; without PNG conversion (nothing redraws constantly on reading pages). -->
  <img v-if="image" class="ico" :class="{ portrait: round }" :src="image" alt="" aria-hidden="true" draggable="false" decoding="async">
  <span v-else-if="glyph" class="ico glyph" :style="{ '--mask': `url(&quot;${src}&quot;)` }" aria-hidden="true"></span>
  <span v-else-if="atlas" class="ico atlas" :data-icon="name" :style="atlas" aria-hidden="true"></span>
  <img v-else class="ico" :src="src" alt="" aria-hidden="true" draggable="false" decoding="async">
</template>

<script>
import { svgIcon, isGlyph, atlasCss } from './icons.js';
import { PORTRAITS, IMAGE_ICONS } from '../ui/icons/index.js';
import { siteUrl } from '../paths.js';

export default {
  name: 'SiteIcon',
  props: { name: { type: String, required: true } },
  computed: {
    /** Painted portraits and building icons without an atlas cell (as in the game) */
    image() { const p = PORTRAITS[this.name] ?? IMAGE_ICONS[this.name]; return p ? siteUrl(p) : null; },
    round() { return !!PORTRAITS[this.name]; },
    glyph() { return isGlyph(this.name); },
    atlas() { return atlasCss(this.name)?.replaceAll('&quot;', '"') ?? null; },
    src() { return svgIcon(this.name); },
  },
};
</script>

<style>
img.ico.portrait { object-fit: cover; border-radius: 18%; }
</style>
