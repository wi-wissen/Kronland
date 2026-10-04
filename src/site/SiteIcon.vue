<template>
  <!-- Like ui/icons/Icon.vue, but without conversion to PNG: on reading pages SVG is cheap, and many hundred
       Icons should not all be redrawn when rasterising. -->
  <span v-if="glyph" class="ico glyph" :style="{ '--mask': `url(&quot;${src}&quot;)` }" aria-hidden="true"></span>
  <img v-else class="ico" :src="src" alt="" aria-hidden="true" draggable="false" decoding="async">
</template>

<script>
import { svgIcon, isGlyph } from './icons.js';

export default {
  name: 'SiteIcon',
  props: { name: { type: String, required: true } },
  computed: {
    glyph() { return isGlyph(this.name); },
    src() { return svgIcon(this.name); },
  },
};
</script>
