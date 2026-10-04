<template>
  <!-- Separate component so that search and sidebar (Compendium.vue) do not redraw the large content -->
  <article class="doc parchment prose compendium" data-testid="compendium" :lang="$i18n.lang">
    <section v-for="s in model.sections" :id="s.id" :key="s.id" class="w-sec" :data-testid="'compendium-sec-' + s.id">
      <h2><Icon :name="s.icon" class="w-h-ico" />{{ s.title }}</h2>
      <div v-if="s.intro" class="w-intro" v-html="md(s.intro)"></div>
      <CompendiumBlock v-for="(b, i) in s.blocks" :key="i" :block="b" :names="model.names" :context="s.title" />
      <article v-for="e in s.entries" :id="e.id" :key="e.id" class="w-entry">
        <h3><Icon v-if="e.icon" :name="e.icon" class="w-h-ico" />{{ e.title }} <a class="w-anchor no-print" :href="'#' + e.id" :aria-label="'#' + e.id">#</a></h3>
        <p v-if="e.sub" class="w-sub">{{ e.sub }}</p>
        <CompendiumBlock v-for="(b, i) in e.blocks" :key="i" :block="b" :names="model.names" :context="e.title" />
      </article>
    </section>
  </article>
</template>

<script>
import CompendiumBlock from './CompendiumBlock.vue';
import { renderMarkdown } from '../markdown.js';

export default {
  name: 'CompendiumContent',
  components: { CompendiumBlock },
  props: { model: { type: Object, required: true } },
  methods: {
    md(text) { return renderMarkdown(text, { base: this.$siteRoot }).html; },
  },
};
</script>
