<template>
  <!-- Like ui/icons/Icon.vue: coloured icons from the game's atlas, control icons as a mask in the
       text colour; without PNG conversion (nothing redraws constantly on reading pages). -->
  <span v-if="glyph" class="ico glyph" :style="{ '--mask': `url(&quot;${src}&quot;)` }" aria-hidden="true"></span>
  <span v-else-if="atlas" class="ico atlas" :data-icon="name" :style="atlas" aria-hidden="true"></span>
  <img v-else class="ico" :src="src" alt="" aria-hidden="true" draggable="false" decoding="async">
</template>

<script>
import { svgIcon, isGlyph, atlasCss } from './icons.js';

export default {
  name: 'SiteIcon',
  props: { name: { type: String, required: true } },
  computed: {
    glyph() { return isGlyph(this.name); },
    atlas() { return atlasCss(this.name)?.replaceAll('&quot;', '"') ?? null; },
    src() { return svgIcon(this.name); },
  },
};
</script>
