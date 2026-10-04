// Campaign 4: Mirror Lake – winter mission. The way to the prisoner island leads only over the ice.

import { t, say } from './common.js';

/** Free Hedda: make the heroine appear for the player on the island. */
function freeHedda(sim, m) {
  const isle = m.state.refs.isle;
  const h = sim.spawnHero(m.human, 'hedda');
  if (isle) { h.px = isle.x * 1000 + 500; h.py = isle.y * 1000 + 500; h.anchor = { x: h.px, y: h.py }; }
  m.state.refs.hedda = h.id;
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
    thaw: t('Das Eis ist geschmolzen, bevor Hedda frei war.', 'The ice melted before Hedda was free.'),
  },
  next: 'c5',
  // 3 minutes of autumn, then 5 minutes of winter, then thaw
  weatherCycle: [['summer', 1800], ['winter', 3000], ['summer', 6000], ['rain', 1200], ['summer', 6000], ['winter', 1800]],
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
    ctx.camp('prison', c, [{ def: 'sword1', count: 2, soldiers: 2 }, { def: 'bow1', count: 1, soldiers: 2 }], { maxR: 4, r: 6 });
    // Winter raid: bandits come over the ice to the castle
    const raid = api.toward(c, hq, 6);
    ctx.ref('raidFrom', { x: raid.x, y: raid.y, r: 3 });
  },

  start: [
    say('bertram', 'Der See ist noch offen. Wir sollten Truppen ausheben, solange es warm ist.', 'The lake is still open. We should raise troops while it is warm.'),
    { type: 'camera', at: 'isle' },
  ],

  objectives: [
    { id: 'prepare', type: 'recruit', count: 2, primary: true, text: t('Hebe 2 Einheiten für den Eismarsch aus', 'Recruit 2 units for the ice march') },
    { id: 'cross', type: 'reach', area: 'isle', who: 'hero', primary: true, hidden: true, text: t('Bring Bertram übers Eis zur Insel', 'Take Bertram across the ice to the island') },
    { id: 'guards', type: 'destroy', ref: 'prisonGuards', primary: true, hidden: true, text: t('Besiege die Kerkerwachen', 'Defeat the prison guards') },
    { id: 'home', type: 'custom', primary: true, hidden: true, text: t('Bring Hedda zurück zu deiner Burg', 'Bring Hedda back to your castle'),
      progress: (sim, m) => {
        const h = sim.entities.get(m.state.refs.hedda);
        const hq = sim.findBuilding(m.human, 'headquarters');
        if (!h || !hq) return { cur: 0, target: 1 };
        const dx = h.px / 1000 - (hq.x + 2), dy = h.py / 1000 - (hq.y + 2);
        return { cur: dx * dx + dy * dy <= 100 ? 1 : 0, target: 1 };
      } },
    { id: 'bertram', type: 'protect', ref: 'hero', primary: true, heroDownFails: false, text: t('Bertram darf nicht sterben', 'Bertram must not die') },
    { id: 'firewood', type: 'stock', res: 'wood', amount: 3000, text: t('Optional: Lagere 3000 Holz für den Winter', 'Optional: Store 3000 wood for the winter'),
      onDone: [{ type: 'give', res: { gold: 300 } }, say('ottilie', 'Die Holzstapel reichen bis zum Frühjahr. Die Leute danken es dir.', 'The woodpiles will last until spring. The people are grateful.')] },
  ],

  events: [
    { id: 'freeze', when: { type: 'weather', state: 'winter' }, do: [
      say('hedda', '… hört mich jemand? Das Eis trägt! Kommt, bevor es taut!', '… can anyone hear me? The ice holds! Come before it thaws!'),
      { type: 'reveal', id: ['cross', 'guards'] },
      { type: 'camera', at: 'isle' },
    ] },
    { id: 'raid', when: { type: 'delay', after: 'freeze', seconds: 60 }, do: [
      say('scout', 'Räuber kommen übers Eis auf unsere Burg zu!', 'Bandits are crossing the ice towards our castle!'),
      { type: 'spawn', owner: 'bandits', at: 'raidFrom', units: [{ def: 'sword1', count: 2, soldiers: 2 }], order: 'attackMove', target: 'humanHq' },
    ] },
    { id: 'freed', when: { type: 'all', of: [{ type: 'objective', id: 'guards' }, { type: 'objective', id: 'cross' }] }, do: [
      freeHedda,
      say('hedda', 'Bertram! Ich wusste, dass ihr kommt. Schnell, das Eis knackt schon.', 'Bertram! I knew you would come. Quickly, the ice is already cracking.'),
      { type: 'reveal', id: 'home' },
    ] },
    { id: 'thawWarn', when: { type: 'time', at: 440 }, do: [
      say('ottilie', 'Das Eis wird mürbe! In einer halben Minute taut der See.', 'The ice is going soft! The lake will thaw in half a minute.'),
    ] },
    { id: 'lateFail', when: { type: 'all', of: [{ type: 'time', at: 482 }, { type: 'not', cond: { type: 'fired', id: 'freed' } }] }, do: [
      say('ottilie', 'Der See ist offen. Bis zum nächsten Winter ist Hedda verloren.', 'The lake is open. Hedda is lost until next winter.'),
      { type: 'defeat', reason: 'thaw' },
    ] },
  ],
};
