<template>
  <!-- Diplomacy of a foreign selection: coloured dot (red enemy, gold neutral, green allied) and name -->
  <span v-if="key" class="reltag" :class="'rel-' + tone" data-testid="relation" :data-rel="relation.rel">
    <i class="reltag-dot" aria-hidden="true"></i>{{ text }}
  </span>
</template>

<script>
import { relationKey } from './hudLayout.js';

export default {
  name: 'RelationTag',
  props: {
    /** relationOf(): { rel, bandits, village } */
    relation: { type: Object, default: null },
    owner: { type: Number, default: -1 },
  },
  computed: {
    key() { return relationKey(this.relation); },
    tone() { return this.relation.bandits ? 'hostile' : this.relation.rel; },
    text() {
      const r = this.relation, name = this.$t(this.key);
      if (r.village) return r.village + ' · ' + name;
      if (r.bandits) return name;
      return name + ' · ' + this.$t('common.player', { n: this.owner + 1 });
    },
  },
};
</script>

<style>
.reltag { display: inline-flex; align-items: center; gap: 0.375rem; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.reltag-dot { flex: none; width: 0.625rem; height: 0.625rem; border-radius: 50%; box-shadow: 0 0 0 1.5px var(--wood-950); }
.rel-hostile .reltag-dot { background: var(--bad); }
.rel-neutral .reltag-dot { background: var(--gold-300); }
.rel-allied .reltag-dot { background: var(--good); }
.rel-hostile { color: #f0a08c; }
.rel-allied { color: #b5ec92; }
</style>
