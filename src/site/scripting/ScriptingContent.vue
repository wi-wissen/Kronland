<template>
  <!-- Separate component so that search and sidebar (Scripting.vue) do not redraw the long content -->
  <article class="doc parchment prose scripting" data-testid="scripting" :lang="$i18n.lang">
    <section v-for="s in chapters" :id="'sec-' + s.id" :key="s.id" class="doc-sec ref-chapter" v-html="s.html"></section>

    <section v-for="s in reference" :id="s.id" :key="s.id" class="ref-sec" :data-testid="'scripting-sec-' + s.group">
      <h2><Icon :name="s.icon" class="ref-h-ico" />{{ s.title }} <a class="ref-anchor no-print" :href="'#' + s.id" :aria-label="'#' + s.id">#</a></h2>
      <div class="ref-intro" v-html="s.intro"></div>

      <template v-if="s.group === 'classes'">
        <p>{{ s.common.label }}</p>
        <dl class="ref-props">
          <template v-for="p in s.common.props" :key="p.name"><dt><code>.{{ p.name }}</code></dt><dd>{{ p.text }}</dd></template>
        </dl>
        <article v-for="c in s.classes" :id="c.id" :key="c.id" class="ref-entry ref-class">
          <h3><code>{{ c.name }}</code> <a class="ref-anchor no-print" :href="'#' + c.id" :aria-label="'#' + c.id">#</a></h3>
          <p>{{ c.text }}</p>
          <dl v-if="c.props.length" class="ref-props">
            <template v-for="p in c.props" :key="p.name"><dt><code>.{{ p.name }}</code></dt><dd>{{ p.text }}</dd></template>
          </dl>
          <p v-if="c.methods.length" class="ref-methods">
            <span class="ref-label">{{ L.classes.methods }}:</span>
            <template v-for="(m, i) in c.methods" :key="m.name"><a :href="m.href"><code>.{{ m.name }}()</code></a><span v-if="m.mission" class="ref-badge mission small">{{ L.labels.mission }}</span><template v-if="i < c.methods.length - 1">, </template></template>
          </p>
        </article>
      </template>

      <article v-for="e in s.entries" :id="e.anchor" :key="e.name" class="ref-entry" :data-testid="'ref-' + e.name">
        <h3>
          <code class="ref-sig">{{ e.sig }}</code>
          <span v-if="!e.py && e.level === 'mission'" class="ref-badge mission" :title="L.labels.missionNote">{{ L.labels.mission }}</span>
          <a class="ref-anchor no-print" :href="'#' + e.anchor" :aria-label="'#' + e.anchor">#</a>
        </h3>
        <div class="ref-desc" v-html="e.html"></div>
        <p v-if="e.also.length" class="ref-also"><span class="ref-label">{{ L.labels.also }}:</span> <code v-for="a in e.also" :key="a">{{ a }}</code></p>

        <div v-if="e.params.length" class="ref-block">
          <span class="ref-label">{{ L.labels.params }}</span>
          <dl class="ref-params">
            <template v-for="p in e.params" :key="p.name"><dt><code>{{ p.name }}</code> <span class="ref-type">{{ p.type }}</span></dt><dd v-html="p.html"></dd></template>
          </dl>
        </div>
        <div v-if="e.handler && e.handler.length" class="ref-block">
          <span class="ref-label">{{ L.labels.handlerArgs }}</span>
          <dl class="ref-params">
            <template v-for="p in e.handler" :key="p[0]"><dt><code>{{ p[0] }}</code> <span class="ref-type">{{ p[1] }}</span></dt><dd>{{ p[2] }}</dd></template>
          </dl>
        </div>
        <p v-if="e.returns && e.returns !== '–'" class="ref-returns"><span class="ref-label">{{ L.labels.returns }}:</span> <span v-html="e.returns"></span></p>

        <div v-if="e.example" class="ref-example">
          <div class="ref-ex-head">
            <span class="ref-label">{{ L.labels.example }}</span>
            <button type="button" class="ref-copy no-print" :data-testid="'copy-' + e.name" @click="copy(e)">{{ copied === e.name ? L.labels.copied : L.labels.copy }}</button>
          </div>
          <pre class="ref-code"><code v-html="e.example.html"></code></pre>
          <div v-if="e.py" class="ref-out" :class="{ err: e.example.error }">
            <span class="ref-out-label">{{ L.labels.output }}</span>
            <pre><code>{{ outputOf(e) }}</code></pre>
          </div>
        </div>

        <div v-if="e.errors.length" class="ref-errors">
          <span class="ref-label">{{ L.labels.errors }}</span>
          <ul>
            <li v-for="x in e.errors" :key="x.code"><code class="ref-kind">{{ x.kind }}</code> {{ x.text }}</li>
          </ul>
        </div>
      </article>
    </section>
  </article>
</template>

<script>
import { DOCS } from './content.js';

export default {
  name: 'ScriptingContent',
  props: {
    chapters: { type: Array, required: true },
    reference: { type: Array, required: true },
  },
  data() { return { copied: null }; },
  computed: {
    L() { return DOCS[this.$i18n.lang] ?? DOCS.de; },
  },
  methods: {
    outputOf(e) {
      const ex = e.example;
      const out = (ex.output ?? '') + (ex.error ?? '');
      return out.replace(/\n$/, '') || this.L.labels.noOutput;
    },
    async copy(e) {
      try {
        await navigator.clipboard.writeText(e.example.code);
        this.copied = e.name;
        setTimeout(() => { if (this.copied === e.name) this.copied = null; }, 1500);
      } catch { /* clipboard not allowed: the code can still be selected */ }
    },
  },
};
</script>
