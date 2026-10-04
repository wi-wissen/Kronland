<template>
  <div v-if="block.type === 'md'" class="w-md" v-html="html"></div>
  <dl v-else-if="block.type === 'facts'" class="w-facts" v-html="html"></dl>
  <div v-else-if="block.type === 'table'" class="tbl-wrap" tabindex="0" role="region" :aria-label="block.caption || context || null" v-html="html"></div>
  <MapPreview v-else-if="block.type === 'mapPreview'" />
</template>

<script>
import MapPreview from './MapPreview.vue';
import { renderMarkdown } from '../markdown.js';
import { tableHtml, factsHtml } from './render.js';

export default {
  name: 'CompendiumBlock',
  components: { MapPreview },
  props: {
    block: { type: Object, required: true },
    /** Name functions of the language (generate.js namesFor) */
    names: { type: Object, required: true },
    /** Name for tables without a heading (section or entry) so the scrollable region is labelled */
    context: { type: String, default: '' },
  },
  computed: {
    html() {
      const b = this.block;
      if (b.type === 'md') return renderMarkdown(b.text, { base: this.$siteRoot }).html;
      if (b.type === 'facts') return factsHtml(b, this.names);
      if (b.type === 'table') return tableHtml(b, this.names);
      return '';
    },
  },
};
</script>
