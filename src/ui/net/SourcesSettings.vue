<template>
  <!-- Settings: sources of level packs (config file + the player's own) -->
  <section class="st-sec" data-testid="sources">
    <h4 class="h-label"><Icon name="globe" />{{ $t('src.title') }}</h4>
    <p class="st-note">{{ $t('src.note') }}</p>
    <ul v-if="list.length" class="src-list" data-testid="source-list">
      <li v-for="s in list" :key="s.url" class="src-item" :data-testid="'source-' + s.kind">
        <span class="src-text"><b class="src-kind">{{ $t('src.kind.' + s.kind) }}</b><span class="src-url" :title="s.url">{{ s.url }}</span></span>
        <button v-if="s.kind === 'player'" class="icon-btn ghost" :aria-label="$t('src.remove')" data-testid="source-remove" @click="remove(s.url)"><Icon name="trash" /></button>
      </li>
    </ul>
    <p v-else class="st-note" data-testid="source-none">{{ $t('src.none') }}</p>
    <form class="src-add" @submit.prevent="add">
      <input v-model.trim="address" type="url" inputmode="url" autocomplete="off" :placeholder="$t('src.placeholder')" :aria-label="$t('src.address')" data-testid="source-input">
      <button type="submit" :disabled="!address" data-testid="source-add"><Icon name="plus" />{{ $t('src.add') }}</button>
    </form>
    <p v-if="error" class="src-err" role="alert" data-testid="source-error">{{ error }}</p>
  </section>
</template>

<script>
import { net } from '../../net/state.js';
import { sourceList } from '../../net/config.js';
import { errorMessage } from '../../net/errors.js';
import { has, t } from '../../i18n/index.js';

export default {
  name: 'SourcesSettings',
  data() { return { net, address: '', error: '' }; },
  computed: {
    list() { return sourceList({ server: net.server, sources: net.sources }, net.playerSources); },
  },
  mounted() { import('../../net/index.js').then((m) => m.initNet()); },
  methods: {
    async add() {
      this.error = '';
      try {
        const { addSource } = await import('../../net/index.js');
        addSource(this.address);
        this.address = '';
      } catch (e) { this.error = errorMessage(e, t, has); }
    },
    async remove(url) { (await import('../../net/index.js')).removeSource(url); },
  },
};
</script>

<style>
.src-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.src-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0.5rem; border-radius: var(--r-md); background: var(--inset-bg); box-shadow: var(--inset-edge); }
.src-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.src-kind { font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--gold-300); }
.src-url { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--fs-sm); }
.src-add { display: flex; gap: 0.5rem; min-width: 0; }
.src-add input { flex: 1; min-width: 0; }
.src-err { margin: 0; color: var(--bad); font-size: var(--fs-sm); }
</style>
