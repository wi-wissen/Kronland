// Campaign "Krone aus Eis", mission 1: Lindgrund – finding the first prong, Orrin's lie, bringing the village through the winter.

import { t, say, site } from './common.js';

export default {
  id: 'c1',
  order: 1,
  seed: 1101,
  size: 96,
  title: t('Lindgrund', 'Lindgrund'),
  summary: t('Bring dein Dorf durch den Winter und vertreibe Malvors Eintreiber.', 'Get your village through the winter and drive off Malvor’s collectors.'),
  briefing: t(
    'Seit Jahren liegt Schnee auf dem Kronland. Nur Malvor, der Statthalter von Hagenfurt, hat volle Kornspeicher – und er gibt nur denen, die sich ihm unterwerfen. In Lindgrund hungert Nelias Dorf. Nelia ist die Tochter eines Leibeigenen. Sie kann Holz schlagen und bauen. Mehr braucht es jetzt nicht.',
    'For years snow has covered the Crownland. Only Malvor, governor of Hagenfurt, has full granaries – and he only feeds those who submit to him. In Lindgrund, Nelia’s village is starving. Nelia is a serf’s daughter. She can chop wood and build. Right now, nothing more is needed.',
  ),
  victoryText: t('Das Dorf ist versorgt, die Eintreiber sind fort. Lindgrund hat den Winter überstanden.', 'The village is fed and the collectors are gone. Lindgrund has survived the winter.'),
  debrief: t(
    'Die Nachricht von der „verlorenen Prinzessin“ läuft schneller durch den Schnee als jeder Bote. Die Nachbardörfer schicken Leute und Vorräte. Nelia widerspricht – niemand hört zu. Mit Orrin bricht sie nach Beaucroix auf, wo es Märkte gibt und vielleicht die nächste Zacke.',
    'The news of the “lost princess” travels through the snow faster than any messenger. The neighbouring villages send people and supplies. Nelia objects – nobody listens. With Orrin she sets out for Beaucroix, where there are markets and perhaps the next shard.',
  ),
  defeatText: t('Lindgrund ist verloren.', 'Lindgrund is lost.'),
  defeatTexts: {
    hq: t('Euer Hof ist gefallen. Lindgrund ist verloren.', 'Your manor has fallen. Lindgrund is lost.'),
  },
  next: 'c2',
  // Deep winter: the whole mission takes place in the snow
  weatherCycle: [['winter', 18000], ['summer', 6000]],
  players: [
    { kind: 'human', heroes: ['nelia', 'orrin'], serfs: 6, stock: { gold: 500, clay: 1400, wood: 1300, stone: 400, iron: 0, sulfur: 0 } },
    { kind: 'bandits', look: 'soldiers' },
    { kind: 'village', name: 'neighbors' },
  ],

  setup(ctx) {
    const { sim, api, m } = ctx;
    const hq = ctx.hqCenter();
    const mid = ctx.mapCenter();
    // Clay must be within reach
    const shaft = api.ensureShaft(sim, 'clay', hq, 20);
    if (shaft) ctx.ref('clayShaft', { x: shaft.x + 1, y: shaft.y + 1, r: 2 });
    // The old root: a small wood near the manor, where the first prong lies
    const root = site(ctx, api.toward(hq, mid, 11), { from: hq });
    if (root) {
      api.plantTrees(sim, root, 6, 3);
      api.clearNodes(sim, root.x, root.y, 1);
      ctx.ref('oldRoot', { x: root.x, y: root.y, r: 2 });
    } else ctx.warn('Kein Platz für die alte Wurzel');
    // Neighbouring village: a few houses off to the side, the village elder stands in front
    const nb = m.playerOf('neighbors');
    const side = api.toward(hq, { x: mid.x, y: hq.y < mid.y ? sim.map.height - 4 : 4 }, 20);
    const v = site(ctx, side, { from: hq, avoid: [{ ...hq, r: 10 }] });
    if (v) {
      api.placeBuilding(sim, nb, 'residence', v, { minR: 1, radius: 6 });
      api.placeBuilding(sim, nb, 'farm', { x: v.x + 4, y: v.y }, { minR: 1, radius: 6 });
      ctx.ref('villageArea', { x: v.x, y: v.y, r: 4 });
    } else ctx.warn('No space for the neighbouring village');
    // From there Malvor's collectors come
    const from = api.findOpen(sim, ...Object.values(api.toward(hq, mid, 28)), { maxR: 8, from: hq });
    ctx.ref('collectorFrom', from ? { ...from, r: 3 } : { ...mid, r: 3 });
  },

  start: [
    say('nelia', 'Der Speicher ist leer. Wenn wir nicht bald Höfe bauen, überstehen wir den Winter nicht.',
      'The granary is empty. If we don’t build farms soon, we won’t survive the winter.'),
    say('orrin', 'Und ich sitze hier fest, mit leerem Karren. Wer kauft im Schnee schon Seidenbänder?',
      'And I’m stuck here with an empty cart. Who buys silk ribbons in the snow?'),
    say('nelia', 'Hilf lieber mit. Am alten Wurzelstock liegt Holz genug für zwei Häuser.',
      'Lend a hand instead. There’s enough wood at the old root stump for two houses.'),
    { type: 'reveal', area: 'oldRoot', seconds: 60 },
  ],

  objectives: [
    { id: 'root', type: 'reach', area: 'oldRoot', who: 'nelia', primary: true, text: t('Schick Nelia zum alten Wurzelstock', 'Send Nelia to the old root stump'),
      onDone: [
        { type: 'flag', name: 'shard1' },
        say('nelia', 'Unter der Wurzel glänzt etwas … ein Stück Metall, wie eine Zacke. Kalt wie Eis.', 'Something glitters under the root … a piece of metal, like a spike. Cold as ice.'),
        say('orrin', 'Bei allen Märkten! Das ist eine Zacke der Krone! Nur das Königsblut findet so etwas!', 'By all the markets! That’s a shard of the crown! Only royal blood finds such a thing!'),
        say('nelia', 'Ich bin eine Leibeigene, Orrin. Mein Vater schlägt Holz.', 'I’m a serf, Orrin. My father chops wood.'),
        say('orrin', 'Pflegeeltern, Kind! Die Königin ertrank, aber die kleine Prinzessin … Leute! Die verlorene Prinzessin ist zurück!', 'Foster parents, child! The queen drowned, but the little princess … everyone! The lost princess has returned!'),
        say('villager', 'Die Prinzessin! In Lindgrund! Dann wird alles gut!', 'The princess! In Lindgrund! Then all will be well!'),
        { type: 'reveal', id: 'neighbors' },
        { type: 'npc', id: 'elder' },
        { type: 'reveal', area: 'villageArea', seconds: 40 },
      ] },
    { id: 'homes', type: 'build', building: 'residence', count: 2, primary: true, text: t('Baue 2 Wohnhäuser', 'Build 2 residences') },
    { id: 'farms', type: 'build', building: 'farm', count: 2, primary: true, text: t('Baue 2 Bauernhöfe', 'Build 2 farms') },
    { id: 'workers', type: 'workers', count: 6, primary: true, text: t('Gib 6 Arbeitern Bett und Essen', 'Give 6 workers a bed and food') },
    { id: 'collectors', type: 'destroy', ref: 'collectors', primary: true, hidden: true, text: t('Vertreibe Malvors Eintreiber', 'Drive off Malvor’s collectors'),
      onDone: [
        say('collector', 'Das wird Malvor erfahren! Ihr werdet um sein Korn betteln!', 'Malvor will hear of this! You’ll beg for his grain!'),
        say('nelia', 'Wir betteln nicht. Wir bauen.', 'We don’t beg. We build.'),
      ] },
    { id: 'neighbors', type: 'flag', flag: 'neighbors', hidden: true, text: t('Optional: Orrin soll mit der Dorfältesten nebenan reden', 'Optional: Have Orrin talk to the elder next door') },
  ],

  npcs: {
    elder: {
      at: 'villageArea', owner: 'neighbors', look: 'serf', hero: 'orrin', speaker: 'elder',
      wrongHero: t('Schick mir den Händler, Kind. Der redet für zwei.', 'Send me the merchant, child. He talks enough for two.'),
      onTalk: [
        say('orrin', 'Ehrwürdige Mutter! Ihr habt es gehört: Die Prinzessin ist zurück, und sie friert in Lindgrund.', 'Honoured mother! You have heard: the princess has returned, and she is freezing in Lindgrund.'),
        say('elder', 'Ob Prinzessin oder nicht – sie hat Malvor die Stirn geboten. Wir schicken Leute und Holz.', 'Princess or not – she stood up to Malvor. We’ll send people and wood.'),
        { type: 'diplomacy', b: 'neighbors', state: 'allied' },
        { type: 'give', serfs: 3, res: { wood: 300 } },
        { type: 'flag', name: 'neighbors' },
      ],
    },
  },

  events: [
    { id: 'firstWorker', when: { type: 'workers', count: 1 }, do: [say('nelia', 'Der erste Arbeiter! Wer ein Bett und eine warme Suppe hat, bleibt.', 'Our first worker! Whoever has a bed and warm soup stays.')] },
    { id: 'collect', when: { type: 'any', of: [{ type: 'time', at: 240 }, { type: 'all', of: [{ type: 'objective', id: 'root' }, { type: 'time', at: 150 }] }] }, do: [
      { type: 'spawn', owner: 'bandits', ref: 'collectors', at: 'collectorFrom', units: [{ def: 'spear1', count: 2, soldiers: 2 }], order: 'attackMove', target: 'humanHq' },
      say('collector', 'Im Namen des Statthalters! Jeder zehnte Sack Korn gehört Malvor.', 'In the name of the governor! Every tenth sack of grain belongs to Malvor.'),
      say('orrin', 'Eintreiber! Nelia, das sind nur ein paar Speerträger. Ruf deine Leute zusammen – und mach ihnen Mut!', 'Collectors! Nelia, those are only a few spearmen. Gather your people – and rally them!'),
      { type: 'reveal', id: 'collectors' },
      { type: 'reveal', area: 'collectors', seconds: 30 },
      { type: 'camera', at: 'collectors' },
    ] },
  ],
};
