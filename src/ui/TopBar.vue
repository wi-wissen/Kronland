<template>
  <header class="topbar panel" data-testid="topbar">
    <div class="res">
      <span v-for="r in resources" :key="r.id" class="item" :title="r.name">
        <i :style="{ background: r.color }"></i>
        <span class="label">{{ r.name }}</span>
        <b class="num" :data-testid="'res-' + r.id">{{ ui.res[r.id] }}</b>
      </span>
    </div>
    <div class="meta">
      <span class="item" title="Bevölkerung / Limit"><span class="label">Volk</span> <b class="num">{{ ui.pop[0] }}/{{ ui.pop[1] }}</b></span>
      <span class="item" title="Durchschnittliche Motivation / Maximum"><span class="label">Motivation</span> <b class="num" :class="{ warn: ui.motivation < 70 }">{{ ui.motivation }}%</b></span>
      <span v-if="ui.faith" class="item" title="Glaube für Segnungen"><span class="label">Glaube</span> <b class="num">{{ ui.faith }}</b></span>
      <span class="item" :title="'Wetterwechsel in ' + ui.weather.in + ' s'"><span class="label">Wetter</span> <b :class="'w-' + ui.weather.state">{{ ui.weather.name }}</b></span>
      <span class="item" title="Sekunden bis zum Zahltag"><span class="label">Zahltag</span> <b class="num">{{ ui.paydayIn }}s</b></span>
      <span class="speed">
        <button :class="{ active: ui.paused }" title="Pause (Leertaste)" @click="$emit('pause')">❚❚</button>
        <button v-for="s in [1, 2, 4]" :key="s" :class="{ active: !ui.paused && ui.speed === s }" @click="$emit('speed', s)">{{ s }}×</button>
        <button title="Menü" data-testid="menu" @click="$emit('menu')">Menü</button>
      </span>
    </div>
  </header>
</template>

<script>
import { RES_COLORS } from '../render/models.js';
import { RESOURCE_NAMES, RESOURCES } from '../sim/data/resources.js';

export default {
  name: 'TopBar',
  props: { ui: { type: Object, required: true } },
  emits: ['speed', 'pause', 'menu'],
  computed: {
    resources() {
      return RESOURCES.map((id) => ({ id, name: RESOURCE_NAMES[id], color: '#' + RES_COLORS[id].toString(16).padStart(6, '0') }));
    },
  },
};
</script>

<style>
.topbar {
  position: fixed;
  left: 12px;
  right: 12px;
  top: calc(8px + env(safe-area-inset-top, 0px));
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px 16px;
  padding: 6px 12px;
  flex-wrap: wrap;
  z-index: 4;
}
.topbar .res, .topbar .meta { display: flex; gap: 6px 14px; flex-wrap: wrap; align-items: center; }
.topbar .item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.topbar i { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.topbar .label { color: var(--muted); font-size: 13px; }
.topbar b { font-weight: 700; min-width: 3ch; }
.topbar b.warn { color: var(--bad); }
.topbar .w-winter { color: #bfe0f0; }
.topbar .w-rain { color: #9ab8d0; }
.topbar .speed { display: inline-flex; gap: 4px; }
.topbar .speed button { min-height: 30px; padding: 3px 8px; font-size: 13px; }
@media (max-width: 640px) {
  .topbar { left: 6px; right: 6px; padding: 5px 8px; font-size: 14px; }
  .topbar .res .label { display: none; }
  .topbar .res { gap: 4px 10px; }
}
</style>
