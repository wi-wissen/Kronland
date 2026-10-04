<template>
  <!-- Command reference: game API (English names) with explanations in the UI language,
       plus short Python basics. Tapping "+" inserts an example into your own program. -->
  <div class="api-help" data-testid="api-help">
    <input v-model="query" class="api-search" type="search" :placeholder="$t('script.help.search')" :aria-label="$t('script.help.search')">
    <section v-for="g in groups" :key="g.id" class="api-group">
      <h4>{{ $t('script.group.' + g.id) }}</h4>
      <div v-for="e in g.entries" :key="e.name" class="api-entry">
        <code class="api-sig">{{ e.sig }}</code>
        <button v-if="e.example" class="ghost api-add" :aria-label="$t('script.help.insert')" @click="$emit('insert', e.example)"><Icon name="plus" /></button>
        <p>{{ $t(e.key) }}</p>
      </div>
    </section>
    <p v-if="!groups.length" class="sp-none">{{ $t('script.help.nothing') }}</p>
  </div>
</template>

<script>
import { API_DOC } from '../../sim/scripting/api.js';
import { has, t } from '../../i18n/index.js';

/** Python basics (no game API) with example. */
const BASICS = [
  { name: 'py.print', sig: 'print("Hallo", x)', example: 'print("Hallo!")' },
  { name: 'py.var', sig: 'x = 5', example: 'count = 0' },
  { name: 'py.if', sig: 'if …: … elif …: … else: …', example: 'if hero.can_step():\n    hero.step()\nelse:\n    hero.turn_left()' },
  { name: 'py.for', sig: 'for i in range(10):', example: 'for i in range(3):\n    hero.step()' },
  { name: 'py.while', sig: 'while …:', example: 'while hero.can_step():\n    hero.step()' },
  { name: 'py.def', sig: 'def name(a, b):', example: 'def turn_around():\n    hero.turn_left()\n    hero.turn_left()' },
  { name: 'py.list', sig: '[1, 2, 3], xs.append(4), len(xs)', example: 'trees = trees_near(hero)\nprint(len(trees))' },
  { name: 'py.dict', sig: '{"wood": 5}, d["wood"]', example: 'found = {}' },
  { name: 'py.fstring', sig: 'f"x = {x}"', example: 'print(f"Bertram steht bei {hero.x}, {hero.y}")' },
];

const EXAMPLES = {
  wait: 'wait(1)', wait_until: 'wait_until(lambda: hero.is_at(place("goal")))',
  'hero.step': 'hero.step()', 'hero.turn_left': 'hero.turn_left()', 'hero.turn_right': 'hero.turn_right()', 'hero.turn_to': 'hero.turn_to("north")',
  'hero.ahead': 'print(hero.ahead())', 'hero.can_step': 'if hero.can_step():\n    hero.step()', 'hero.move_to': 'hero.move_to(place("goal"))',
  'hero.is_at': 'print(hero.is_at(place("goal")))', 'hero.take': 'hero.take()', 'hero.chop': 'hero.chop()', 'hero.say': 'hero.say("Hallo!")',
  place: 'goal = place("goal")', tile: 'print(tile(5, 5))', trees_near: 'print(len(trees_near(hero)))', stock: 'print(stock("wood"))',
  serfs: 'for s in serfs(idle=True):\n    print(s)', build: 'spot = find_spot("residence", hq())\nsite = build("residence", spot[0], spot[1])',
  say: 'say("bertram", "Hallo!")', 'camera.fly_to': 'camera.fly_to(hero, seconds=2)', objective: 'objective("goal", "Erreiche das Ziel", lambda: hero.is_at(place("goal")))',
  on_start: '@on_start\ndef intro():\n    say("bertram", "Los geht\'s!")', every: '@every(10)\ndef tick():\n    print(time())',
  spawn: 'spawn(BANDITS, "sword1", place("gate"), count=2)', plant_trees: 'plant_trees((10, 10), 12)', make_place: 'make_place("goal", 10, 10, 1)',
};

export default {
  name: 'ApiHelp',
  props: { level: { type: String, default: 'player' } },
  emits: ['insert'],
  data() { return { query: '' }; },
  computed: {
    groups() {
      const q = this.query.trim().toLowerCase();
      const entries = [
        ...BASICS.map((b) => ({ ...b, group: 'basics', key: `script.api.${b.name}` })),
        ...API_DOC.filter((e) => this.level === 'mission' || e.level === 'player')
          .map((e) => ({ ...e, key: `script.api.${e.name}`, example: EXAMPLES[e.name] ?? null })),
      ].filter((e) => has(e.key) && (!q || e.sig.toLowerCase().includes(q) || t(e.key).toLowerCase().includes(q)));
      const order = ['basics', 'flow', 'hero', 'world', 'village', 'story', 'events', 'goals', 'power', 'terrain', 'const'];
      return order.map((id) => ({ id, entries: entries.filter((e) => e.group === id) })).filter((g) => g.entries.length);
    },
  },
};
</script>

<style>
.api-help { display: flex; flex-direction: column; gap: 0.5rem; }
.api-search { width: 100%; }
.api-group h4 { margin: 0.25rem 0; font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--gold-300); }
.api-entry { display: grid; grid-template-columns: 1fr auto; gap: 0 0.375rem; padding: 0.375rem 0; border-bottom: 1px solid rgba(225, 168, 58, 0.1); }
.api-sig { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.8125rem; color: var(--gold-100); word-break: break-word; }
.api-entry p { grid-column: 1 / -1; margin: 0.125rem 0 0; font-size: var(--fs-sm); color: var(--ink-muted); line-height: 1.4; }
.api-add { min-height: 1.75rem !important; min-width: 1.75rem; padding: 0; }
</style>
