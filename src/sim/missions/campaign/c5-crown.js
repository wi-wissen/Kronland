// Campaign 5: The Crown of Kronland – final battle against Prince Morwald (hard AI with cannons).

import { t, say } from './common.js';
import { BUILDINGS } from '../../data/buildings.js';

export default {
  id: 'c5',
  order: 5,
  seed: 5505,
  size: 96,
  title: t('Die Krone von Kronland', 'The Crown of Kronland'),
  summary: t('Stelle ein Heer auf und schleife Schwarzenfels, die Festung Fürst Morwalds.', 'Raise an army and raze Blackcrag, the fortress of Prince Morwald.'),
  briefing: t(
    'Schwarzenfels. Hinter diesen Mauern sitzt Fürst Morwald auf dem gestohlenen Thron. Er hat Kanonen gießen lassen und wirbt Söldner aus allen Ecken des Reichs – seine Knechte aber dienen ihm nur aus Angst und greifen für ihn nicht zu den Waffen. Du hast Bertram, Hedda und ein Volk, das an dich glaubt. Baue deine Wirtschaft aus, erforsche bessere Waffen und zerstöre seine Burg. Doch gib acht: Morwald wartet nicht lange.',
    'Blackcrag. Behind these walls Prince Morwald sits on the stolen throne. He has had cannons cast and hires mercenaries from every corner of the realm – but his serfs serve him only out of fear and will not take up arms for him. You have Bertram, Hedda and a people that believes in you. Expand your economy, research better weapons and destroy his castle. But beware: Morwald will not wait long.',
  ),
  victoryText: t('Schwarzenfels ist gefallen. Die Krone kehrt nach Kronland zurück.', 'Blackcrag has fallen. The crown returns to Kronland.'),
  debrief: t(
    'Morwald flieht in die Berge, sein Heer zerstreut sich. Im Thronsaal legt Ottilie dir die alte Krone in die Hände: „Sie ist schwerer, als sie aussieht. Aber du trägst sie nicht allein.“ Ende der Kampagne – danke fürs Spielen!',
    'Morwald flees into the mountains and his army scatters. In the throne hall Ottilie places the old crown in your hands: “It is heavier than it looks. But you do not carry it alone.” End of the campaign – thank you for playing!',
  ),
  defeatText: t('Morwald hat gesiegt. Kronland bleibt in seiner Hand.', 'Morwald has won. Kronland remains in his hands.'),
  defeatTexts: {
    hq: t('Deine Burg ist gefallen. Morwald hat gesiegt.', 'Your castle has fallen. Morwald has won.'),
  },
  next: null,
  players: [
    {
      kind: 'human', hero: 'bertram', serfs: 14, techs: ['conscription', 'construction', 'education', 'alchemy'],
      stock: { gold: 3000, clay: 2500, wood: 3000, stone: 2500, iron: 1500, sulfur: 800 },
    },
    {
      kind: 'ai', hero: 'gerold', difficulty: 'hard', aggression: 'normal', startDelay: 0, aiSerfs: 20, militia: false,
      techs: ['conscription', 'construction', 'education', 'alchemy', 'standingArmy', 'gears', 'alloys', 'metallurgy'],
      stock: { gold: 2500, clay: 2500, wood: 3000, stone: 2500, iron: 2000, sulfur: 1500 },
    },
  ],

  setup(ctx) {
    const { sim, api } = ctx;
    const me = ctx.hqCenter(0), foe = ctx.hqCenter(1);
    // Eigene Grundausstattung
    for (const [type, dx, dy] of [['residence', 0, 8], ['residence', -6, 6], ['farm', 6, 7], ['university', 8, 0], ['barracks', 3, 12]]) {
      api.placeBuilding(sim, 0, type, { x: me.x + dx, y: me.y + dy }, { minR: 2 });
    }
    // Morwald's seat: castle, towers, foundry, first cannons
    const hq = sim.findBuilding(1, 'headquarters');
    // castle (not fortress): Morwald expands on his own if given time
    ctx.ref('castle', hq.id);
    const dir = (d) => api.toward(foe, me, d);
    const t1 = api.placeBuilding(sim, 1, 'tower', dir(7), { minR: 1, level: 1 });
    const t2 = api.placeBuilding(sim, 1, 'tower', { x: foe.x + 6, y: foe.y - 3 }, { minR: 1, level: 1 });
    ctx.ref('towers', [t1?.id, t2?.id].filter(Boolean));
    api.placeBuilding(sim, 1, 'foundry', { x: foe.x - 7, y: foe.y }, { minR: 2 });
    api.placeBuilding(sim, 1, 'barracks', { x: foe.x, y: foe.y - 8 }, { minR: 2 });
    for (const [type, dx, dy] of [['residence', -5, -6], ['farm', 5, -7], ['university', -8, 5], ['smithy', 8, 6]]) {
      api.placeBuilding(sim, 1, type, { x: foe.x + dx, y: foe.y + dy }, { minR: 2 });
    }
    const gate = dir(10);
    ctx.ref('gate', { ...gate, r: 4 });
    api.spawnTroop(sim, 1, 'cannon1', gate);
    api.spawnTroop(sim, 1, 'sword2', dir(11));
    api.spawnTroop(sim, 1, 'bow2', dir(9));
    ctx.ref('ridge', { ...api.toward(me, foe, 16), r: 4 });
  },

  start: [
    say('morwald', 'Ein Bauernkönig mit einem Kräuterweib und einem alten Ritter? Kommt nur. Meine Kanonen sind hungrig.',
      'A peasant king with a herb-woman and an old knight? Come then. My cannons are hungry.'),
    { type: 'reveal', area: 'gate' },
    { type: 'camera', at: 'gate' },
  ],

  objectives: [
    { id: 'castle', type: 'destroyHq', target: 'enemy', primary: true, text: t('Zerstöre die Burg von Schwarzenfels', 'Destroy the castle of Blackcrag') },
    { id: 'army', type: 'recruit', count: 8, text: t('Optional: Stelle ein Heer aus 8 Einheiten auf', 'Optional: Raise an army of 8 units'),
      onDone: [{ type: 'give', res: { gold: 500 } }, say('bertram', 'Das ist ein Heer, das sich sehen lassen kann. Die Dörfer schicken Kriegssteuer.', 'Now that is an army worth seeing. The villages send war tax.')] },
    { id: 'towers', type: 'destroy', ref: 'towers', text: t('Optional: Zerstöre Morwalds Wachtürme', 'Optional: Destroy Morwald\'s watchtowers') },
    { id: 'cannons', type: 'recruit', line: 'cannon', count: 1, hidden: true, text: t('Optional: Gieße eigene Kanonen', 'Optional: Cast your own cannons') },
  ],

  events: [
    { id: 'heddaJoins', when: { type: 'time', at: 2 }, do: [
      (sim, m) => { m.state.refs.hedda = sim.spawnHero(m.human, 'hedda').id; },
      say('hedda', 'Ich bin bei dir. Meine Kräuter heilen deine Leute, meine Fallen halten seine auf.', 'I am with you. My herbs will heal your people, my traps will stop his.'),
    ] },
    { id: 'firstWave', when: { type: 'time', at: 420 }, do: [
      say('morwald', 'Genug gewartet. Holt mir seinen Kopf!', 'Enough waiting. Bring me his head!'),
      { type: 'spawn', owner: 1, at: 'gate', units: [{ def: 'sword1', count: 2, soldiers: 4 }, { def: 'bow1', count: 1, soldiers: 4 }], order: 'attackMove', target: 'humanHq' },
    ] },
    { id: 'metallurgy', when: { type: 'tech', tech: 'metallurgy' }, do: [
      say('gerold', 'Metallurgie! Gebt mir eine Gießerei, und ich gieße euch Kanonen, die Morwalds Mauern zum Wackeln bringen.', 'Metallurgy! Give me a foundry and I will cast cannons that shake Morwald\'s walls.'),
      { type: 'reveal', id: 'cannons' },
    ] },
    { id: 'castleHurt', when: (sim, m) => { const c = sim.entities.get(m.state.refs.castle); return !!c && c.hp * 2 < BUILDINGS.headquarters.levels[c.level].hp; }, do: [
      say('morwald', 'Haltet die Mauern! Jeder Mann auf die Zinnen!', 'Hold the walls! Every man to the battlements!'),
      { type: 'spawn', owner: 1, at: 'castle', units: [{ def: 'spear2', count: 2, soldiers: 4 }], order: 'attackMove', target: 'castle' },
    ] },
    { id: 'rage', when: { type: 'time', at: 1500 }, every: 600, do: [
      { type: 'ai', player: 'enemy', attackNow: true, aggression: 'aggressive' },
    ] },
  ],
};
