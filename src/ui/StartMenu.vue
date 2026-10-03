<template>
  <div class="start">
    <div class="start-card panel">
      <h1>Kronland</h1>
      <p class="sub">Baue dein Dorf, versorge deine Siedler, verteidige deine Burg.</p>

      <button v-if="hasSave" class="primary wide" data-testid="continue" @click="$emit('continue')">Gespeichertes Spiel fortsetzen</button>

      <div class="field">
        <span class="label">Gegner</span>
        <div class="seg">
          <button v-for="n in [1, 2, 3]" :key="n" :class="{ active: opponents === n }" @click="opponents = n">{{ n }}</button>
        </div>
      </div>
      <div class="field">
        <span class="label">Stärke der Computergegner</span>
        <div class="seg">
          <button v-for="d in difficulties" :key="d.id" :class="{ active: difficulty === d.id }" :data-testid="'diff-' + d.id" @click="difficulty = d.id">{{ d.name }}</button>
        </div>
      </div>
      <div class="field">
        <span class="label">Dein Held</span>
        <div class="seg">
          <button v-for="h in heroes" :key="h.id" :class="{ active: hero === h.id }" :title="h.desc" @click="hero = h.id">{{ h.name }}</button>
        </div>
        <span class="hint">{{ heroes.find((h) => h.id === hero).desc }}</span>
      </div>
      <div class="field">
        <span class="label">Karte</span>
        <div class="seg">
          <input id="seed" v-model.number="seed" type="number" min="1" max="999999" aria-label="Kartennummer">
          <button title="Zufällige Karte" @click="seed = Math.floor(Math.random() * 99999) + 1">Würfeln</button>
        </div>
      </div>

      <button class="primary wide" data-testid="start" @click="start">Neues Spiel starten</button>
      <p class="credits">3D-Modelle: KayKit von Kay Lousberg (CC0)</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'StartMenu',
  props: { hasSave: { type: Boolean, default: false } },
  emits: ['start', 'continue'],
  data() {
    return {
      opponents: 1,
      difficulty: 'normal',
      hero: 'bertram',
      seed: Math.floor(Math.random() * 99999) + 1,
      difficulties: [{ id: 'easy', name: 'Leicht' }, { id: 'normal', name: 'Normal' }, { id: 'hard', name: 'Schwer' }],
      heroes: [
        { id: 'bertram', name: 'Bertram', desc: 'Ritter: Wirbelschlag und Aura der Stärke' },
        { id: 'hedda', name: 'Hedda', desc: 'Kräuterkundige: heilt Truppen, legt Fallen' },
        { id: 'gerold', name: 'Gerold', desc: 'Sprengmeister: Bomben und Selbstschuss-Kanone' },
      ],
    };
  },
  methods: {
    start() {
      this.$emit('start', { players: this.opponents + 1, difficulty: this.difficulty, hero: this.hero, seed: this.seed || 1 });
    },
  },
};
</script>

<style>
.start {
  position: fixed; inset: 0; display: grid; place-items: center; padding: 16px;
  background:
    radial-gradient(ellipse at 30% 20%, rgba(224, 169, 59, 0.18), transparent 60%),
    linear-gradient(160deg, #22302a, #141a17 70%);
  overflow-y: auto;
}
.start-card { width: min(440px, 100%); padding: 22px 22px 16px; display: flex; flex-direction: column; gap: 14px; }
.start h1 { font-family: var(--display); font-size: 40px; color: var(--accent); margin: 0; letter-spacing: 0.04em; text-wrap: balance; }
.start .sub { color: var(--muted); margin: -6px 0 2px; }
.start .field { display: flex; flex-direction: column; gap: 6px; }
.start .label { color: var(--muted); font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; }
.start .hint { color: var(--muted); font-size: 14px; }
.start .seg { display: flex; gap: 6px; flex-wrap: wrap; }
.start .seg button { flex: 1; min-width: 0; }
.start input { font: inherit; color: var(--ink); background: rgba(241, 234, 216, 0.06); border: 1px solid var(--line); border-radius: 8px; padding: 7px 10px; min-width: 0; flex: 1; font-variant-numeric: tabular-nums; }
.start .wide { width: 100%; min-height: 46px; font-size: 17px; }
.start .credits { color: var(--muted); font-size: 12px; margin: 0; text-align: center; }
</style>
