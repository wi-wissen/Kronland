// Campaign 4: Mirror Lake – winter mission. The way to the prisoner island leads only over the ice.

import { t, say } from './common.js';
import * as api from '../setupApi.js';
import { WATER, OCCUPIED, CLIFF } from '../../map.js';

/** Autumn and winter in seconds: the lake freezes after AUTUMN and thaws after AUTUMN + WINTER. */
const AUTUMN = 180;
const WINTER = 300;
const THAW = AUTUMN + WINTER;

/**
 * Free Hedda: make the heroine appear for the player on the island – on solid, free
 * ground next to the dungeon (the island centre may be occupied by the camp, ice does not count).
 */
function freeHedda(sim, m) {
  const isle = m.state.refs.isle;
  const h = sim.spawnHero(m.human, 'hedda');
  if (isle) {
    const near = m.state.refs.prisonArea ?? isle;
    const map = sim.map;
    let p = null;
    for (const q of api.rings(near.x, near.y, 2, isle.r + 2)) {
      if (!map.inBounds(q.x, q.y) || api.dist(q, isle) > isle.r) continue;
      if (map.flags[map.idx(q.x, q.y)] & (WATER | OCCUPIED | CLIFF)) continue;
      p = q; break;
    }
    p ??= isle;
    h.px = p.x * 1000 + 500; h.py = p.y * 1000 + 500; h.anchor = { x: h.px, y: h.py };
  }
  m.state.refs.hedda = h.id;
}

/** Is Hedda back at the castle (at most 10 tiles from the castle centre)? */
function heddaHome(sim, m) {
  const h = sim.entities.get(m.state.refs.hedda);
  const hq = sim.findBuilding(m.human, 'headquarters');
  if (!h || !hq) return false;
  const dx = h.px / 1000 - (hq.x + 2), dy = h.py / 1000 - (hq.y + 2);
  return dx * dx + dy * dy <= 100;
}

export default {
  id: 'c4',
  order: 4,
  seed: 4404,
  size: 96,
  title: t('Eis über dem Spiegelsee', 'Ice over Mirror Lake'),
  summary: t('Nutze den Winter: Überquere den gefrorenen See und befreie Hedda, bevor das Eis bricht.', 'Use the winter: cross the frozen lake and free Hedda before the ice breaks.'),
  briefing: t(
    'Auf einer Insel im Spiegelsee hält Morwald Hedda gefangen, die Kräuterkundige des alten Königs. Im Sommer ist die Insel unerreichbar. Doch der Winter steht vor der Tür: Wenn der See zufriert, kann Bertram hinüber. Sei bereit – und kehre zurück, bevor Tauwetter einsetzt. Wer dann auf dem Eis steht, versinkt.',
    'On an island in Mirror Lake, Morwald holds Hedda prisoner, the old king\'s herbalist. In summer the island is out of reach. But winter is at the door: when the lake freezes, Bertram can cross. Be ready – and come back before the thaw. Whoever is on the ice then will sink.',
  ),
  victoryText: t('Hedda ist frei und in Sicherheit.', 'Hedda is free and safe.'),
  debrief: t(
    'Hedda kennt Schwarzenfels wie keine andere: „Morwald hat Kanonen gießen lassen. Aber seine Burg steht auf altem Grund, und ich kenne den Weg der Mühlenleute.“ Der Frühling kommt. Es ist Zeit, die Krone zurückzuholen.',
    'Hedda knows Blackcrag like no one else: “Morwald has had cannons cast. But his castle stands on old ground, and I know the millers\' path.” Spring is coming. It is time to take back the crown.',
  ),
  defeatText: t('Die Mission ist gescheitert.', 'The mission has failed.'),
  defeatTexts: {
    bertram: t('Bertram ist gefallen – ohne ihn gibt es keine Befreiung.', 'Bertram has fallen – without him there is no rescue.'),
    hq: t('Deine Burg ist gefallen.', 'Your castle has fallen.'),
    thaw: t('Das Eis ist geschmolzen, bevor Hedda in Sicherheit war.', 'The ice melted before Hedda was safe.'),
  },
  next: 'c5',
  // autumn, then a short winter, then thaw (ticks; see AUTUMN/WINTER above)
  weatherCycle: [['summer', AUTUMN * 10], ['winter', WINTER * 10], ['summer', 6000], ['rain', 1200], ['summer', 6000], ['winter', 1800]],
  players: [
    {
      kind: 'human', hero: 'bertram', serfs: 10, techs: ['conscription', 'construction', 'education'],
      stock: { gold: 1500, clay: 1800, wood: 2000, stone: 1400, iron: 800, sulfur: 200 },
    },
    { kind: 'bandits' },
  ],

  setup(ctx) {
    const { sim, api } = ctx;
    const hq = ctx.hqCenter();
    api.placeBuilding(sim, ctx.human, 'barracks', { x: hq.x + 4, y: hq.y + 8 }, { minR: 3 });
    api.placeBuilding(sim, ctx.human, 'residence', { x: hq.x - 2, y: hq.y + 8 }, { minR: 2 });
    api.placeBuilding(sim, ctx.human, 'farm', { x: hq.x + 8, y: hq.y + 2 }, { minR: 2 });
    // Island in the lake: water ring, can only be crossed in winter
    const isle = api.makeIsland(sim, hq, ctx.mapCenter(), { inner: 6, width: 3, minDist: 22 });
    if (!isle) { ctx.warn('Keine Insel möglich'); }
    const c = isle ?? api.toward(hq, ctx.mapCenter(), 30);
    ctx.ref('isle', { x: c.x, y: c.y, r: 5 });
    api.clearNodes(sim, c.x, c.y, 5);
    // Dungeon guards on the island
    ctx.camp('prison', c, [{ def: 'sword1', count: 3, soldiers: 3 }, { def: 'bow1', count: 2, soldiers: 3 }], { maxR: 4, r: 6 });
    // Winter raid: bandits come over the ice to the castle
    const raid = api.toward(c, hq, 6);
    ctx.ref('raidFrom', { x: raid.x, y: raid.y, r: 3 });
  },

  start: [
    say('bertram', 'Der See ist noch offen. Wir sollten Truppen ausheben, solange es warm ist.', 'The lake is still open. We should raise troops while it is warm.'),
    { type: 'reveal', area: 'isle' },
    { type: 'camera', at: 'isle' },
  ],

  objectives: [
    { id: 'prepare', type: 'recruit', count: 4, primary: true, text: t('Hebe 4 Einheiten für den Eismarsch aus', 'Recruit 4 units for the ice march') },
    { id: 'cross', type: 'reach', area: 'isle', who: 'hero', primary: true, hidden: true, text: t('Bring Bertram übers Eis zur Insel', 'Take Bertram across the ice to the island') },
    { id: 'guards', type: 'destroy', ref: 'prisonGuards', primary: true, hidden: true, text: t('Besiege die Kerkerwachen', 'Defeat the prison guards') },
    { id: 'home', type: 'custom', primary: true, hidden: true, text: t('Bring Hedda zurück zu deiner Burg', 'Bring Hedda back to your castle'),
      progress: (sim, m) => ({ cur: heddaHome(sim, m) ? 1 : 0, target: 1 }) },
    { id: 'bertram', type: 'protect', ref: 'hero', primary: true, heroDownFails: false, text: t('Bertram darf nicht sterben', 'Bertram must not die') },
    { id: 'firewood', type: 'stock', res: 'wood', amount: 2500, text: t('Optional: Lagere 2500 Holz für den Winter', 'Optional: Store 2500 wood for the winter'),
      onDone: [{ type: 'give', res: { gold: 300 } }, say('ottilie', 'Die Holzstapel reichen bis zum Frühjahr. Die Leute danken es dir.', 'The woodpiles will last until spring. The people are grateful.')] },
  ],

  events: [
    { id: 'freeze', when: { type: 'weather', state: 'winter' }, do: [
      say('hedda', '… hört mich jemand? Das Eis trägt! Kommt, bevor es taut!', '… can anyone hear me? The ice holds! Come before it thaws!'),
      { type: 'reveal', id: ['cross', 'guards'] },
      { type: 'reveal', area: 'isle' },
      { type: 'camera', at: 'isle' },
    ] },
    { id: 'raid', when: { type: 'delay', after: 'freeze', seconds: 40 }, do: [
      say('scout', 'Räuber kommen übers Eis auf unsere Burg zu!', 'Bandits are crossing the ice towards our castle!'),
      { type: 'spawn', owner: 'bandits', at: 'raidFrom', units: [{ def: 'sword1', count: 3, soldiers: 3 }, { def: 'bow1', count: 1, soldiers: 3 }], order: 'attackMove', target: 'humanHq' },
    ] },
    { id: 'freed', when: { type: 'all', of: [{ type: 'objective', id: 'guards' }, { type: 'objective', id: 'cross' }] }, do: [
      freeHedda,
      say('hedda', 'Bertram! Ich wusste, dass ihr kommt. Schnell, das Eis knackt schon.', 'Bertram! I knew you would come. Quickly, the ice is already cracking.'),
      { type: 'reveal', id: 'home' },
    ] },
    { id: 'thawWarn', when: { type: 'time', at: THAW - 40 }, do: [
      say('ottilie', 'Das Eis wird mürbe! In einer halben Minute taut der See.', 'The ice is going soft! The lake will thaw in half a minute.'),
    ] },
    // Thaw: whoever is not back by then is stuck (heroes on the ice are rescued by the shore)
    { id: 'lateFail', when: { type: 'all', of: [{ type: 'fired', id: 'freeze' }, { type: 'not', cond: { type: 'weather', state: 'winter' } }, { type: 'not', cond: { type: 'objective', id: 'home' } }] }, do: [
      say('ottilie', 'Der See ist offen. Bis zum nächsten Winter ist Hedda verloren.', 'The lake is open. Hedda is lost until next winter.'),
      { type: 'defeat', reason: 'thaw' },
    ] },
  ],
};
