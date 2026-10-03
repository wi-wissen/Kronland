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

    <!-- Troops and heroes -->
    <template v-else-if="ui.selection?.kind === 'army'">
      <div class="head">
        <strong>Truppen</strong>
        <span class="hint">
          <template v-for="(g, i) in sel.groups" :key="g.name">{{ i ? ' · ' : '' }}{{ g.count }}× {{ g.name }}</template>
          <template v-if="sel.soldiers"> · {{ sel.soldiers }} Soldaten</template>
          <template v-if="sel.serfs"> · {{ sel.serfs }} Leibeigene</template>
        </span>
        <button class="close" title="Auswahl aufheben" @click="$emit('deselect')">×</button>
      </div>
      <div class="scroll">
        <div v-for="h in sel.heroes" :key="h.id" class="block">
          <span class="label">{{ h.name }}, {{ h.title }} · {{ h.down ? 'bewusstlos' : `LP ${h.hp}/${h.maxHp}` }}</span>
          <div class="row">
            <button
              v-for="a in h.abilities"
              :key="a.id"
              :disabled="h.down || a.readyIn > 0"
              :data-testid="'ability-' + a.id"
              @click="$emit('action', { kind: 'ability', hero: h.id, ability: a.id })"
            >{{ a.name }}<span v-if="a.readyIn" class="num"> · {{ a.readyIn }}s</span></button>
          </div>
        </div>
        <div class="row">
          <button :class="{ active: sel.attackMode }" data-testid="order-attack" @click="$emit('action', { kind: 'order', order: 'attackMove' })">
            {{ sel.attackMode ? (ui.touch ? 'Ziel antippen …' : 'Ziel anklicken …') : 'Angreifen' }}
          </button>
          <button @click="$emit('action', { kind: 'order', order: 'hold' })">Halten</button>
          <button @click="$emit('action', { kind: 'order', order: 'defend' })">Verteidigen</button>
          <button v-if="sel.refill" title="Hauptmann muss am Militärgebäude stehen" @click="$emit('action', { kind: 'refill' })">Soldaten auffüllen</button>
        </div>
        <p class="hint">{{ ui.touch ? 'Tippe auf den Boden zum Laufen, auf Feinde zum Angreifen.' : 'Rechtsklick: laufen bzw. angreifen · Strg+Rechtsklick: Angriffsbewegung' }}</p>
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
        <strong>{{ sel.name }}</strong>
        <span class="hint">Stufe {{ sel.level }}</span>
        <button class="close" title="Auswahl aufheben" @click="$emit('deselect')">×</button>
      </div>
      <div class="stats">
        <span v-if="!sel.done">{{ sel.level > 1 ? 'Ausbau' : 'Bau' }} {{ sel.progress }} % · {{ sel.builders }} Leibeigene</span>
        <span>LP <b class="num">{{ sel.hp }}/{{ sel.maxHp }}</b></span>
        <span v-if="sel.workers">Arbeiter <b class="num">{{ sel.workers[0] }}/{{ sel.workers[1] }}</b></span>
        <span v-if="sel.beds">Betten <b class="num">{{ sel.beds[0] }}/{{ sel.beds[1] }}</b></span>
        <span v-if="sel.seats">Essplätze <b class="num">{{ sel.seats[0] }}/{{ sel.seats[1] }}</b></span>
        <span v-if="sel.population">Bevölkerung <b>+{{ sel.population }}</b></span>
      </div>

      <div class="scroll">
        <div v-if="sel.own && sel.done && sel.type === 'headquarters'" class="row">
          <button class="primary" data-testid="buy-serf" @click="$emit('buy-serf', 1)">Leibeigenen kaufen ({{ ui.serfCost }} Taler)</button>
          <button @click="$emit('buy-serf', 5)">5 kaufen</button>
        </div>

        <div v-if="sel.militia !== null && sel.militia !== undefined" class="row">
          <button :class="{ danger: !sel.militia, active: sel.militia }" data-testid="militia" @click="$emit('action', { kind: 'militia', on: !sel.militia })">
            {{ sel.militia ? 'Entwarnung (Miliz auflösen)' : 'Zu den Waffen! (Leibeigene bewaffnen)' }}
          </button>
        </div>

        <div v-for="r in sel.recruit ?? []" :key="r.line" class="block">
          <span class="label">{{ r.lineName }} · Stufe {{ r.tier }}: {{ r.name }}</span>
          <div class="row">
            <button class="primary" :disabled="!!r.fullReason" :title="r.fullReason || ''" :data-testid="'recruit-full-' + r.line" @click="$emit('action', { kind: 'recruit', id: sel.id, line: r.line, full: true })">
              Volle Einheit (1+{{ r.soldiers }}) · <span class="num">{{ costText(r.fullCost) }}</span>
            </button>
            <button :disabled="!!r.leaderReason" :title="r.leaderReason || ''" @click="$emit('action', { kind: 'recruit', id: sel.id, line: r.line, full: false })">
              Nur Hauptmann · <span class="num">{{ costText(r.leaderCost) }}</span>
            </button>
            <button v-if="r.upgrade" :disabled="!!r.upgrade.reason" :title="r.upgrade.reason || ''" @click="$emit('action', { kind: 'upgradeLine', line: r.line })">
              Aufwerten zu {{ r.upgrade.name }} · <span class="num">{{ costText(r.upgrade.cost) }}</span>
            </button>
          </div>
          <p v-if="r.upgrade?.reason" class="hint">{{ r.upgrade.name }}: {{ r.upgrade.reason }}</p>
        </div>

        <div v-if="sel.tax" class="block">
          <span class="label">Steuern</span>
          <div class="row">
            <button
              v-for="(name, i) in taxNames"
              :key="i"
              :class="{ active: sel.tax.level === i }"
              :disabled="!sel.tax.allowed"
              :title="sel.tax.allowed ? '' : 'Erst „Bildung“ erforschen'"
              @click="$emit('action', { kind: 'tax', level: i })"
            >{{ name }}</button>
          </div>
        </div>

        <div v-if="sel.research" class="block">
          <span class="label">Forschung</span>
          <div class="techs">
            <button
              v-for="t in sel.research"
              :key="t.id"
              :class="{ done: t.done, running: t.running !== null }"
              :disabled="t.done || t.running !== null || !!t.reason"
              :title="t.reason || ''"
              :data-testid="'tech-' + t.id"
              @click="$emit('action', { kind: 'research', id: sel.id, tech: t.id })"
            >
              <span class="bname">{{ t.name }}</span>
              <span class="bcost num">
                <template v-if="t.done">erforscht</template>
                <template v-else-if="t.running !== null">läuft · {{ t.running }} %</template>
                <template v-else>{{ costText(t.cost) }}</template>
              </span>
            </button>
          </div>
        </div>

        <div v-if="sel.blessings" class="block">
          <span class="label">Segnungen · {{ ui.faith }}/{{ ui.blessingCost }} Glaube</span>
          <div class="techs">
            <button v-for="b in sel.blessings" :key="b.id" :disabled="!!b.reason" :title="b.reason || ''" @click="$emit('action', { kind: 'bless', id: sel.id, blessing: b.id })">
              <span class="bname">{{ b.name }}</span>
              <span class="bcost">{{ b.who }}</span>
            </button>
          </div>
        </div>

        <div v-if="sel.own" class="row">
          <button
            v-if="sel.upgrade"
            :disabled="!!sel.upgrade.reason"
            :title="sel.upgrade.reason || ''"
            data-testid="upgrade"
            @click="$emit('action', { kind: 'upgrade', id: sel.id })"
          >Ausbauen zu {{ sel.upgrade.name }} · <span class="num">{{ costText(sel.upgrade.cost) }}</span></button>
          <button v-if="sel.workers && sel.done" :class="{ active: sel.overtime }" @click="$emit('action', { kind: 'overtime', id: sel.id, on: !sel.overtime })">
            Überstunden {{ sel.overtime ? 'an' : 'aus' }}
          </button>
          <button v-if="sel.canDemolish" :class="{ danger: confirmDemolish }" @click="demolish">
            {{ confirmDemolish ? 'Wirklich abreißen?' : 'Abreißen' }}
          </button>
        </div>
        <p v-if="sel.upgrade?.reason" class="hint">{{ sel.upgrade.reason }}</p>
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
  emits: ['build', 'buy-serf', 'confirm', 'cancel', 'deselect', 'action'],
  data() {
    return { buildOpen: false, confirmDemolish: false, taxNames: ['Keine', 'Niedrig', 'Normal', 'Hoch', 'Sehr hoch'] };
  },
  computed: {
    sel() { return this.ui.selection; },
  },
  watch: {
    'ui.selection.id'() { this.confirmDemolish = false; },
  },
  methods: {
    demolish() {
      if (!this.confirmDemolish) { this.confirmDemolish = true; return; }
      this.confirmDemolish = false;
      this.$emit('action', { kind: 'demolish', id: this.sel.id });
    },
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
.context .scroll { overflow-y: auto; min-height: 0; display: flex; flex-direction: column; gap: 8px; }
.context .block { display: flex; flex-direction: column; gap: 5px; }
.context .label { color: var(--muted); font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; }
.context .techs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; }
.context .techs button { display: flex; flex-direction: column; align-items: flex-start; text-align: left; padding: 5px 8px; }
.context .techs button.done { border-color: rgba(111, 207, 122, 0.5); opacity: 0.8; }
.context .techs button.running { border-color: var(--accent); opacity: 1; }
.context button.danger { border-color: var(--bad); color: var(--bad); }
.context p.hint { margin: 0; }
.context .bcost { font-size: 12px; color: var(--muted); }
@media (max-width: 640px) {
  .context { width: calc(100% - 12px); bottom: calc(6px + env(safe-area-inset-bottom, 0px)); padding: 8px; }
  .context .build { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .context .techs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
