<template>
  <!-- Special maps: individual finished maps outside the campaign (showcase, stress test …). The list comes
       from SPECIAL_MAPS in src/sim/missions/registry.js – enter new maps there, they appear here by themselves. -->
  <div class="campaign backdrop" data-testid="special-menu">
    <div class="cm-wrap">
      <header class="cm-head">
        <button class="cm-back" data-testid="special-back" @click="$emit('back')"><Icon name="back" />{{ $t('mission.back') }}</button>
        <div class="cm-titles">
          <h1>{{ $t('menu.special') }}</h1>
          <p>{{ $t('menu.specialSub') }}</p>
        </div>
      </header>

      <div class="cm-body">
        <ol class="cm-list sp-list frame">
          <li v-for="m in maps" :key="m.id">
            <button
              class="cm-item"
              :class="{ active: m.id === selectedId }"
              :aria-current="m.id === selectedId ? 'true' : null"
              :data-testid="'special-' + m.id"
              @click="selectedId = m.id"
            >
              <span class="seal" aria-hidden="true"><Icon :name="m.icon" /></span>
              <span class="cm-text">
                <b>{{ $tr(m.title) }}</b>
                <small>{{ $tr(m.summary) }}</small>
              </span>
            </button>
          </li>
        </ol>

        <article v-if="selected" class="cm-brief parchment" data-testid="special-briefing">
          <h2>{{ $tr(selected.title) }}</h2>
          <p class="cm-story">{{ $tr(selected.briefing) }}</p>
          <h3 class="cm-goalhead">{{ $t('menu.specialPlaces') }}</h3>
          <ul class="cm-goals">
            <li v-for="o in selected.goals" :key="o.id"><Icon name="scroll" /><span>{{ $tr(o.text) }}</span></li>
          </ul>
          <div class="cm-foot">
            <button class="cm-start" data-testid="special-start" @click="$emit('start', selected.id)">{{ $t('mission.start') }}<Icon name="next" /></button>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<script>
import { SPECIAL_MAPS } from '../../sim/missions/registry.js';

export default {
  name: 'SpecialMapsMenu',
  props: { lang: { type: String, default: 'de' } },
  emits: ['back', 'start'],
  data() { return { selectedId: SPECIAL_MAPS[0]?.id ?? null }; },
  computed: {
    maps() {
      return SPECIAL_MAPS.map((m) => ({
        id: m.id, title: m.title, summary: m.summary, briefing: m.briefing, icon: m.icon ?? 'map',
        goals: (m.objectives ?? []).filter((o) => !o.hidden),
      }));
    },
    selected() { return this.maps.find((m) => m.id === this.selectedId) ?? null; },
  },
};
</script>

<style>
/* without the campaign's path stroke: the maps do not depend on each other */
.sp-list::before { display: none; }
</style>
