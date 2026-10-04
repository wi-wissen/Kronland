// Campaign 2: Fire in the Woods – fend off bandit waves, barracks, troops, survival.

import { t, say } from './common.js';

const wave = (n, units, de, en) => ({
  id: `wave${n}`,
  when: { type: 'time', at: [150, 300, 450][n - 1] },
  do: [
    say('kunz', de, en),
    { type: 'spawn', owner: 'bandits', at: 'banditGate', units, order: 'attackMove', target: 'village', ref: 'raiders', append: true },
    { type: 'camera', at: 'banditGate' },
  ],
});

export default {
  id: 'c2',
  order: 2,
  seed: 2202,
  size: 96,
  title: t('Feuer im Wald', 'Fire in the Woods'),
  summary: t('Kunz der Rote will den Erlengrund plündern. Hebe Truppen aus und halte stand.', 'Kunz the Red wants to plunder Aldervale. Raise troops and hold out.'),
  briefing: t(
    'Kunz der Rote, Morwalds Söldnerhauptmann, hat seine Bande im Wald zusammengezogen. Er will das Dorfzentrum niederbrennen, damit niemand mehr in den Erlengrund zieht. Bertram hat die Pläne einer Kaserne mitgebracht. Hebe Truppen aus, halte drei Angriffe stand – und dann räuchere das Lager aus.',
    'Kunz the Red, Morwald\'s mercenary captain, has gathered his gang in the woods. He wants to burn the village centre so that no one settles in Aldervale again. Bertram brought plans for a barracks. Raise troops, withstand three attacks – and then smoke out the camp.',
  ),
  victoryText: t('Das Räuberlager ist zerstört, Kunz ist geflohen.', 'The bandit camp is destroyed and Kunz has fled.'),
  debrief: t(
    'In Kunz\' Zelt findet Bertram einen Brief mit Morwalds Siegel: „Haltet die Furt am Grauen Bach, koste es was es wolle.“ Hinter der Furt liegt fruchtbares Land – und der Weg nach Schwarzenfels.',
    'In Kunz\'s tent Bertram finds a letter bearing Morwald\'s seal: “Hold the ford at Grey Brook, whatever the cost.” Beyond the ford lies fertile land – and the road to Blackcrag.',
  ),
  defeatText: t('Die Räuber haben gesiegt.', 'The bandits have won.'),
  defeatTexts: {
    protectVc: t('Das Dorfzentrum brennt. Ohne es kommt niemand mehr in den Erlengrund.', 'The village centre is burning. Without it, no one will come to Aldervale.'),
    hq: t('Deine Burg ist gefallen.', 'Your castle has fallen.'),
  },
  next: 'c3',
  players: [
    {
      kind: 'human', hero: 'bertram', serfs: 8, techs: ['conscription', 'construction'],
      stock: { gold: 1300, clay: 1800, wood: 2200, stone: 1200, iron: 600, sulfur: 0 },
    },
    { kind: 'bandits' },
  ],

  setup(ctx) {
    const { sim, api } = ctx;
    const hq = ctx.hqCenter();
    // Existing village from mission 1
    api.placeBuilding(sim, ctx.human, 'residence', { x: hq.x, y: hq.y + 7 }, { minR: 2 });
    api.placeBuilding(sim, ctx.human, 'farm', { x: hq.x + 6, y: hq.y + 6 }, { minR: 2 });
    const vc = sim.findBuilding(ctx.human, 'villageCenter');
    ctx.ref('village', vc?.id);
    // Bandit camp towards the map centre, rally point of the waves in between
    const camp = ctx.camp('camp', api.toward(hq, ctx.mapCenter(), 32), [
      { def: 'spear1', count: 1, soldiers: 3 }, { def: 'bow1', count: 1, soldiers: 2 },
    ], { from: hq, avoid: [{ ...hq, r: 22 }] });
    const gate = camp ? api.toward(camp, hq, 7) : api.toward(hq, ctx.mapCenter(), 22);
    const p = api.findOpen(sim, gate.x, gate.y, { maxR: 8, clear: 2, from: hq }) ?? gate;
    ctx.ref('banditGate', { x: p.x, y: p.y, r: 3 });
  },

  start: [
    say('bertram', 'Sie werden kommen, sobald es dunkel wird. Wir brauchen eine Kaserne, und zwar schnell.', 'They will come as soon as it gets dark. We need a barracks, and fast.'),
  ],

  objectives: [
    { id: 'barracks', type: 'build', building: 'barracks', primary: true, text: t('Baue eine Kaserne', 'Build a barracks') },
    { id: 'army', type: 'recruit', count: 3, primary: true, text: t('Hebe 3 Einheiten aus', 'Recruit 3 units') },
    { id: 'survive', type: 'survive', until: 540, primary: true, text: t('Überstehe die Angriffe', 'Survive the attacks') },
    { id: 'protectVc', type: 'protect', ref: 'village', primary: true, text: t('Das Dorfzentrum muss stehen bleiben', 'The village centre must survive') },
    { id: 'camp', type: 'destroy', ref: 'camp', primary: true, hidden: true, text: t('Zerstöre das Räuberlager', 'Destroy the bandit camp') },
    { id: 'bigArmy', type: 'recruit', count: 6, text: t('Optional: Stelle 6 Einheiten auf', 'Optional: Field 6 units'),
      onDone: [{ type: 'give', res: { gold: 250, iron: 150 } }, say('ottilie', 'Die Bauern spenden für die Wache: 250 Taler und Eisen.', 'The farmers donate to the guard: 250 thalers and iron.')] },
    { id: 'militia', type: 'custom', hidden: true, text: t('Optional: Bewaffne die Leibeigenen in der Not', 'Optional: Arm the serfs in an emergency'),
      progress: (sim, m) => ({ cur: [...sim.entities.values()].some((e) => e.kind === 'unit' && e.owner === m.human && e.militia) ? 1 : 0, target: 1 }) },
  ],

  events: [
    wave(1, [{ def: 'sword1', count: 2, soldiers: 2 }],
      'Holt euch das Dorf, Jungs! Was brennt, kann nicht mehr Morwald trotzen!', 'Take the village, lads! What burns cannot defy Morwald!'),
    wave(2, [{ def: 'sword1', count: 2, soldiers: 3 }, { def: 'bow1', count: 1, soldiers: 2 }],
      'Ihr habt Glück gehabt. Jetzt kommen meine Bogenschützen.', 'You got lucky. Now my archers are coming.'),
    wave(3, [{ def: 'sword1', count: 3, soldiers: 3 }, { def: 'bow1', count: 2, soldiers: 2 }],
      'Alle Mann! Brennt alles nieder!', 'All hands! Burn it all down!'),
    { id: 'militiaTip', when: { type: 'fired', id: 'wave2' }, do: [
      say('ottilie', 'Wenn es eng wird: In der Burg kannst du die Leibeigenen bewaffnen. Sie kämpfen dann als Miliz.', 'If it gets tight: in the castle you can arm the serfs. They will then fight as militia.'),
      { type: 'reveal', id: 'militia' },
    ] },
    { id: 'survived', when: { type: 'objective', id: 'survive' }, do: [
      say('bertram', 'Sie weichen zurück! Jetzt drehen wir den Spieß um – zum Lager!', 'They are falling back! Now we turn the tables – to the camp!'),
      say('ottilie', 'Die Holzfäller aus dem Nachbartal schicken zwei Trupps und eine Kriegskasse. Nutze sie gut.', 'The woodcutters from the next valley send two squads and a war chest. Use them well.'),
      { type: 'spawn', owner: 'human', at: 'humanHq', units: [{ def: 'spear1', count: 2, soldiers: 4 }], ref: 'reinforcements' },
      { type: 'give', res: { gold: 400, iron: 200 } },
      { type: 'reveal', id: 'camp' },
      { type: 'camera', at: 'campArea' },
    ] },
  ],
};
