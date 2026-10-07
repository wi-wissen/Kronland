<template>
  <!-- Serf action bar: open the build menu, call to arms, save as control group.
       Desktop: labelled groups with key badges; phone: three large buttons side by side. -->
  <div class="acts serf-acts" :class="{ big: compact }" role="toolbar" :aria-label="$t('serfs.title')" data-testid="serf-actions">
    <div class="act-group">
      <h4 v-if="!compact">{{ $t('build.title') }}</h4>
      <div>
        <button
          v-tip="{ title: $t('build.title'), text: $t('serfs.buildTip'), key: touch ? null : 'B' }"
          class="act primary-act"
          :data-hint-for="buildHints"
          data-testid="serf-build"
          @click="$emit('build-view')"
        ><kbd v-if="!touch" class="k">B</kbd><Icon name="b-residence" /><span class="act-lbl">{{ $t('build.title') }}</span></button>
      </div>
    </div>
    <div class="act-group">
      <h4 v-if="!compact">{{ $t('army.militia') }}</h4>
      <div>
        <button
          v-tip="{ title: $t('serfs.arm'), text: $t('serfs.armTip') }"
          class="act"
          data-testid="serf-arm"
          @click="$emit('action', { kind: 'arm', on: true })"
        ><Icon name="militia" /><span class="act-lbl">{{ $t('serfs.arm') }}</span></button>
      </div>
    </div>
    <div v-if="n" class="act-group">
      <h4 v-if="!compact">{{ $t('army.group') }}</h4>
      <div>
        <button
          v-tip="{ title: groupLabel, text: groupText, key: touch ? null : $t('key.shift') + '+' + n }"
          class="act"
          :aria-pressed="!!group.current"
          data-testid="serf-group"
          @click="!group.current && $emit('action', { kind: 'group', n: group.next })"
        ><kbd v-if="!touch" class="k">⇧{{ n }}</kbd><Icon name="banner" /><span class="act-lbl">{{ groupLabel }}</span></button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SerfActions',
  props: {
    touch: Boolean,
    /** Phone: three large buttons without group titles */
    compact: Boolean,
    /** Control group of the selection: { current, next } */
    group: { type: Object, default: null },
    /** Building types of the build menu: the build button stands in for their tiles (tutorial pointer) */
    types: { type: Array, default: () => [] },
  },
  emits: ['build-view', 'action'],
  computed: {
    n() { return this.group?.current || this.group?.next || 0; },
    groupLabel() { return this.group?.current ? this.$t('army.groupIs', { n: this.n }) : this.$t('army.groupSave', { n: this.n }); },
    groupText() { return this.$t(this.group?.current ? 'army.groupExplainIs' : 'army.groupExplainNew', { n: this.n }); },
    buildHints() { return this.types.map((t) => 'build-' + t).join(' ') || null; },
  },
};
</script>

<style>
kbd.k { position: absolute; z-index: 2; top: 0.1875rem; right: 0.1875rem; min-width: 1.125rem; height: 1.125rem; padding: 0 0.25rem; border-radius: 0.25rem; font: 800 0.625rem/1.125rem var(--body); color: var(--wood-950); background: var(--gold-300); box-shadow: 0 1px 0 var(--gold-800); border: 0; }
button.act.primary-act { background: radial-gradient(circle at 50% 30%, #8a6a2c, #4a3415 80%); box-shadow: inset 0 0 0 2px var(--gold-300), 0 2px 0 var(--wood-950), 0 0 12px rgba(243, 200, 94, 0.35); }
button.act.primary-act .act-lbl { color: var(--gold-100); }
.serf-acts.big { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; align-items: stretch; }
.serf-acts.big .act-group, .serf-acts.big .act-group > div { display: contents; }
.serf-acts.big button.act { width: auto; min-height: 4rem; }
.serf-acts.big button.act > .ico { width: 2rem; height: 2rem; }
.serf-acts.big .act-lbl { font-size: 0.75rem; }
</style>
