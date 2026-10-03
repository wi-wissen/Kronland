<template>
  <section class="context panel" data-testid="context-panel">
    <!-- Choose building spot -->
    <template v-if="ui.placing">
      <div class="head">
        <strong>{{ ui.placing.name }} platzieren</strong>
        <span v-if="ui.placing.hasPos" :class="ui.placing.valid ? 'ok' : 'err'">
          {{ ui.placing.valid ? 'Platz passt' : ui.placing.reason }}
        </span>
        <span v-else class="hint">{{ ui.touch ? 'Tippe auf die Karte' : 'Klicke auf die Karte · Rechtsklick bricht ab' }}</span>
      </div>
      <div class="row">
        <button v-if="ui.touch" class="primary" :disabled="!ui.placing.valid" @click="$emit('confirm')">Hier bauen</button>
        <button @click="$emit('cancel')">Abbrechen</button>
      </div>
    </template>

    <!-- Leibeigene -->
    <template v-else-if="ui.selection?.kind === 'serfs'">
      <div class="head">
        <strong>{{ ui.selection.count }} Leibeigene</strong>
        <span class="hint">{{ ui.selection.idle }} untätig · {{ ui.touch ? 'Tippe auf Baum, Haufen oder Baustelle' : 'Rechtsklick auf Baum, Haufen oder Baustelle' }}</span>
        <button class="close" title="Auswahl aufheben" @click="$emit('deselect')">×</button>
      </div>
      <button v-if="ui.touch" class="toggle" :class="{ active: buildOpen }" data-testid="build-toggle" @click="buildOpen = !buildOpen">
        {{ buildOpen ? 'Baumenü schließen' : 'Bauen …' }}
      </button>
      <div v-if="buildOpen || !ui.touch" class="build" data-testid="build-menu">
        <button
          v-for="b in ui.buildOptions"
          :key="b.type"
          :disabled="!!b.reason"
          :title="b.reason || 'Bauen'"
          :data-testid="'build-' + b.type"
          @click="buildOpen = false; $emit('build', b.type)"
        >
          <span class="bname">{{ b.name }}</span>
          <span class="bcost num">{{ costText(b.cost) }}</span>
        </button>
      </div>
    </template>

    <!-- Buildings -->
    <template v-else-if="ui.selection?.kind === 'building'">
      <div class="head">
        <strong>{{ ui.selection.name }}</strong>
        <span class="hint">Stufe {{ ui.selection.level }}</span>
        <button class="close" title="Auswahl aufheben" @click="$emit('deselect')">×</button>
      </div>
      <div class="stats">
        <span v-if="!ui.selection.done">Bau {{ ui.selection.progress }} % · {{ ui.selection.builders }} Leibeigene</span>
        <span>LP <b class="num">{{ ui.selection.hp }}/{{ ui.selection.maxHp }}</b></span>
        <span v-if="ui.selection.beds">Betten <b>{{ ui.selection.beds }}</b></span>
        <span v-if="ui.selection.seats">Essplätze <b>{{ ui.selection.seats }}</b></span>
        <span v-if="ui.selection.population">Bevölkerung <b>+{{ ui.selection.population }}</b></span>
      </div>
      <div v-if="ui.selection.own && ui.selection.done && ui.selection.type === 'headquarters'" class="row">
        <button class="primary" data-testid="buy-serf" @click="$emit('buy-serf', 1)">Leibeigenen kaufen ({{ ui.serfCost }} Taler)</button>
        <button @click="$emit('buy-serf', 5)">5 kaufen</button>
      </div>
    </template>

    <template v-else-if="ui.selection?.kind === 'enemy'">
      <div class="head"><strong>Fremde Einheit</strong><span class="hint">Spieler {{ ui.selection.owner + 1 }}</span></div>
    </template>

    <template v-else>
      <div class="head">
        <span class="hint">{{ ui.touch ? 'Tippe auf deine Leibeigenen oder die Burg.' : 'Wähle Leibeigene (Rahmen ziehen) oder die Burg.' }}</span>
      </div>
    </template>
  </section>
</template>

<script>
import { RESOURCE_NAMES } from '../sim/data/resources.js';

export default {
  name: 'ContextPanel',
  props: { ui: { type: Object, required: true } },
  emits: ['build', 'buy-serf', 'confirm', 'cancel', 'deselect'],
  data() {
    return { buildOpen: false };
  },
  methods: {
    costText(cost) {
      return cost.map(([r, n]) => `${n} ${RESOURCE_NAMES[r]}`).join(' · ');
    },
  },
};
</script>

<style>
.context {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  width: min(760px, calc(100% - 24px));
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 4;
  max-height: 42vh;
}
.context .head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.context .head strong { font-family: var(--display); color: var(--accent); font-size: 17px; letter-spacing: 0.03em; }
.context .hint { color: var(--muted); font-size: 14px; }
.context .ok { color: var(--good); }
.context .err { color: var(--bad); }
.context .close { margin-left: auto; min-height: 30px; padding: 2px 10px; }
.context .row { display: flex; gap: 8px; flex-wrap: wrap; }
.context .stats { display: flex; gap: 14px; flex-wrap: wrap; color: var(--muted); }
.context .stats b { color: var(--ink); }
.context .build {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 6px;
  overflow-y: auto;
  min-height: 0;
}
.context .build button { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; text-align: left; padding: 6px 9px; }
.context .bname { font-weight: 700; }
.context .toggle { align-self: flex-start; }
.context .bcost { font-size: 12px; color: var(--muted); }
@media (max-width: 640px) {
  .context { width: calc(100% - 12px); bottom: calc(6px + env(safe-area-inset-bottom, 0px)); padding: 8px; }
  .context .build { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
