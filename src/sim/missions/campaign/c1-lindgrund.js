// Campaign "Krone aus Eis", mission 1: Lindgrund – finding the first prong, Orrin's lie, bringing the village through the winter.

import { t, say, site } from './common.js';
import { BALANCE } from '../../data/balance.js';

export default {
  id: 'c1',
  order: 1,
  seed: 1101,
  size: 96,
  title: t('Lindgrund', 'Lindgrund'),
  summary: t('Bring dein Dorf durch den Winter und vertreibe Malvors Eintreiber.', 'Get your village through the winter and drive off Malvor’s collectors.'),
  briefing: t(
    'Seit Jahren liegt Schnee auf dem Kronland. Nur Malvor, der Statthalter von Hagenfurt, hat volle Kornspeicher. Wer Korn will, arbeitet dafür in seinen Lagern – auch die Leute aus Lindgrund sind gegangen. Nelia, die Tochter eines Leibeigenen, ist aus Malvors Kornlager davongelaufen. Jetzt steht sie am Rand ihres Heimatdorfs. Kein Rauch steigt auf, kein Hund bellt.',
    'For years snow has covered the Crownland. Only Malvor, governor of Hagenfurt, has full granaries. Whoever wants grain works for it in his storehouses – the people of Lindgrund left too. Nelia, a serf’s daughter, has run away from Malvor’s granary. Now she stands at the edge of her home village. No smoke rises, no dog barks.',
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
  weatherCycle: [['winter', 360000]], // Malvor's winter: only ends with the weather works (mission 3)
  // Campaign unlocks: only the basics, everything else shows greyed out ("not available in this mission"); only clay pits
  available: { buildings: ['villageCenter', 'residence', 'farm', 'clayMine'], techs: [] },
  shafts: ['clay'],
  players: [
    // Nelia comes alone; Orrin sits on the village square (talk figure) and joins
    { kind: 'human', heroes: ['nelia'], serfs: 0, stock: { gold: 400, clay: 1400, wood: 600, stone: 200, iron: 0, sulfur: 0 } },
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
    // Abandoned village: the village centre has decayed (only foundations left on the village square)
    const vc = sim.findBuilding(m.human, 'villageCenter');
    const sq = vc ? { x: vc.x, y: vc.y } : api.findOpen(sim, hq.x + 6, hq.y + 6, { maxR: 10, clear: 3 });
    if (vc) sim.removeEntity(vc);
    ctx.ref('vcRuin', { x: sq.x, y: sq.y, r: 0 });
    ctx.ref('square', { x: sq.x + 2, y: sq.y + 2, r: 4 });
    // Orrin waits next to the foundations
    const seat = api.findOpen(sim, sq.x + 5, sq.y + 2, { maxR: 6, from: hq });
    ctx.ref('orrinSeat', { x: (seat ?? sq).x, y: (seat ?? sq).y, r: 1 });
    // Collapsed houses; their beams lie next to them as wood piles (serfs carry them off)
    const ruinsAt = api.toward(hq, { x: sq.x + 2, y: sq.y + 2 }, -7);
    const ruins = [];
    for (const off of [[0, 0], [5, 3]]) {
      const r = api.addRuin(sim, 'residence', { x: ruinsAt.x + off[0], y: ruinsAt.y + off[1] }, { radius: 12 });
      if (!r) continue;
      ruins.push(r);
      api.addPile(sim, 'wood', { x: r.x + 4, y: r.y + 1 }, 600);
      api.addPile(sim, 'wood', { x: r.x + 1, y: r.y + 4 }, 600);
    }
    if (ruins.length) ctx.ref('ruins', { x: ruins[0].x + 2, y: ruins[0].y + 2, r: 5 });
    else ctx.warn('No space for the house ruins');
    // The old tree at the forest edge (find spot of the prong), between village and map centre
    const root = site(ctx, api.toward(hq, mid, 11), { from: hq });
    if (root) {
      api.plantTrees(sim, root, 6, 3);
      api.clearNodes(sim, root.x, root.y, 1);
      sim.addNode('tree', root.x, root.y, 'wood', BALANCE.tree.wood);
      ctx.ref('oldRoot', { x: root.x, y: root.y, r: 2 });
    }
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

  // Flow (also introduction, Orrin explains): meet Orrin → old tree (prong, Orrin's lie, three serfs
  // return) → beams from the rubble → village centre → houses → farms → workers; payday explains
  // taxes; only then Malvor's collectors come (militia). Whoever is further along fulfils revealed goals immediately.
  start: [
    say('nelia', 'Lindgrund. Kein Rauch, kein Hund, der bellt. Sie sind alle zu Malvor gegangen – für eine Schüssel Korn.',
      'Lindgrund. No smoke, no barking dog. They’ve all gone to Malvor – for a bowl of grain.'),
    say('orrin', 'He! Du da, mit dem Bündel! Komm her zum Dorfplatz – ich beiße nicht, ich handle nur.',
      'Hey! You there, with the bundle! Come over to the square – I don’t bite, I only trade.'),
    { type: 'npc', id: 'stranger' },
  ],

  objectives: [
    { id: 'meet', type: 'flag', flag: 'orrin', primary: true, hint: { entity: 'stranger' },
      text: t('Wähle Nelia aus und schick sie zum Fremden auf dem Dorfplatz', 'Select Nelia and send her to the stranger on the square') },
    { id: 'root', type: 'reach', area: 'oldRoot', who: 'nelia', primary: true, hidden: true, text: t('Schick Nelia zum alten Baum am Waldrand', 'Send Nelia to the old tree at the edge of the forest'),
      onDone: [
        { type: 'flag', name: 'shard1' },
        say('nelia', 'Unter der Wurzel glänzt etwas … ein Stück Metall, wie eine Zacke. Kalt wie Eis.', 'Something glitters under the root … a piece of metal, like a spike. Cold as ice.'),
        say('orrin', 'Bei allen Märkten! Das ist eine Zacke der Krone! Nur das Königsblut findet so etwas!', 'By all the markets! That’s a shard of the crown! Only royal blood finds such a thing!'),
        say('nelia', 'Ich bin eine Leibeigene, Orrin. Mein Vater schlägt Holz.', 'I’m a serf, Orrin. My father chops wood.'),
        say('orrin', 'König Edrians Krone zerbrach in fünf Zacken. Wer alle fünf vereint, den müssen die Provinzen krönen – so will es das alte Recht.',
          'King Edrian’s crown broke into five shards. Whoever unites all five must be crowned by the provinces – so the old law says.'),
        say('nelia', 'Malvor herrscht doch längst. Wozu braucht er eine Krone?', 'Malvor rules already. What does he need a crown for?'),
        say('orrin', 'Er ist nur Statthalter. Mit der Krone wäre er König, und keiner dürfte ihm widersprechen. Glaub mir, er sucht die Zacken.',
          'He is only governor. With the crown he would be king, and no one could gainsay him. Believe me, he is looking for the shards.'),
        say('orrin', 'Pflegeeltern, Kind! Die Königin ertrank, aber die kleine Prinzessin … Leute! Die verlorene Prinzessin ist zurück!', 'Foster parents, child! The queen drowned, but the little princess … everyone! The lost princess has returned!'),
        { type: 'give', serfs: 3 },
        say('villager', 'Die Prinzessin! In Lindgrund! Dann wird alles gut!', 'The princess! In Lindgrund! Then all will be well!'),
        say('orrin', 'Siehst du? Drei Leute sind schon zurück. Leibeigene tun, was man ihnen sagt: auswählen, dann zeigen, wohin.',
          'You see? Three people are back already. Serfs do what they’re told: select them, then point where.'),
        say('orrin', 'Holz zuerst – ohne Holz kein Dach. Schick sie an die Trümmer der alten Häuser, die Balken dort sind trocken.',
          'Wood first – no wood, no roof. Send them to the ruins of the old houses, the beams there are dry.'),
        { type: 'reveal', id: 'wood' },
      ] },
    { id: 'wood', type: 'flag', flag: 'hauling', primary: true, hidden: true, hint: { area: 'ruins' },
      text: t('Wähle die Leibeigenen und schick sie an die Balken bei den Trümmern', 'Select the serfs and send them to the beams by the ruins'),
      onDone: [
        say('orrin', 'Gut. Jetzt der Dorfplatz. Nur wo ein Dorfzentrum steht, ziehen Leute her – ohne kommt kein einziger Arbeiter.',
          'Good. Now the square. People only settle where a village centre stands – without one, not a single worker comes.'),
        say('orrin', 'Öffne das Baumenü und setz es auf die alten Grundmauern. Wer gerade ausgewählt ist, fängt gleich an zu bauen.',
          'Open the build menu and set it on the old foundations. Whoever is selected starts building right away.'),
        { type: 'reveal', id: 'center' },
      ] },
    { id: 'center', type: 'build', building: 'villageCenter', count: 1, primary: true, hidden: true, hint: { area: 'square', ui: ['build-villageCenter', 'quick-all'] },
      text: t('Bau das Dorfzentrum auf dem Dorfplatz wieder auf', 'Rebuild the village centre on the square'),
      onDone: [
        say('nelia', 'Das Dorfzentrum steht wieder. Wie früher.', 'The village centre stands again. Like it used to.'),
        say('orrin', 'Und jetzt Betten. Wer hier arbeiten soll, muss schlafen können – sonst hockt er am Lagerfeuer und schafft kaum etwas.',
          'And now beds. Whoever works here needs somewhere to sleep – otherwise he huddles at the campfire and gets little done.'),
        { type: 'reveal', id: 'homes' },
      ] },
    { id: 'homes', type: 'build', building: 'residence', count: 2, primary: true, hidden: true, hint: { ui: ['build-residence', 'quick-all'] }, text: t('Baue 2 Wohnhäuser', 'Build 2 residences'),
      onDone: [
        say('orrin', 'Wer geschlafen hat, will essen. Baut Bauernhöfe – und der Bauer ist gleich unser erster Arbeiter.',
          'Whoever has slept wants to eat. Build farms – and the farmer is our very first worker.'),
        { type: 'reveal', id: 'farms' },
      ] },
    { id: 'farms', type: 'build', building: 'farm', count: 2, primary: true, hidden: true, hint: { ui: ['build-farm', 'quick-all'] }, text: t('Baue 2 Bauernhöfe', 'Build 2 farms'),
      onDone: [
        say('orrin', 'Arbeiter kommen von selbst, sobald es Arbeit gibt. Bau beim Lehm dort drüben eine Lehmmine – die braucht Leute.',
          'Workers come on their own when there’s work. The clay pit over there needs hands – build a clay mine.'),
        { type: 'reveal', id: 'workers' },
      ] },
    { id: 'workers', type: 'workers', count: 6, primary: true, hidden: true, hint: { area: 'clayShaft', ui: ['build-clayMine', 'quick-all'], uiWhile: { type: 'not', cond: { type: 'built', building: 'clayMine', placed: true } } }, text: t('Gib 6 Arbeitern Bett und Essen', 'Give 6 workers a bed and food') },
    { id: 'collectors', type: 'destroy', ref: 'collectors', primary: true, hidden: true, text: t('Vertreibe Malvors Eintreiber', 'Drive off Malvor’s collectors'),
      onDone: [
        say('collector', 'Das wird Malvor erfahren! Ihr werdet um sein Korn betteln!', 'Malvor will hear of this! You’ll beg for his grain!'),
        say('nelia', 'Wir betteln nicht. Wir bauen.', 'We don’t beg. We build.'),
      ] },
    { id: 'neighbors', type: 'flag', flag: 'neighbors', hidden: true, text: t('Optional: Orrin soll mit der Dorfältesten nebenan reden', 'Optional: Have Orrin talk to the elder next door') },
  ],

  // Landmark (rendering only): the foundations of the village centre
  landmarks: [{ at: 'vcRuin', model: 'ruin', building: 'villageCenter' }],

  npcs: {
    // Orrin waits on the village square; when spoken to he joins as a hero
    stranger: {
      at: 'orrinSeat', look: 'hero.orrin', speaker: 'orrin', radius: 3,
      onTalk: [
        say('orrin', 'Endlich ein Gesicht! Orrin, Händler in Bändern, Knöpfen und guten Ratschlägen. Mein Karrenrad ist gebrochen – und hier kauft keiner mehr.',
          'Finally a face! Orrin, merchant of ribbons, buttons and good advice. My cart wheel is broken – and nobody here buys anything.'),
        say('nelia', 'Ich bin Nelia. Hier bin ich geboren. Ich bin aus Malvors Kornlager weggelaufen.',
          'I’m Nelia. I was born here. I ran away from Malvor’s granary.'),
        say('orrin', 'Weggelaufen? Dann such dir Freunde, bevor er dich sucht. Ich bleibe – ein Händler ohne Kunden hat Zeit.',
          'Ran away? Then find friends before he finds you. I’ll stay – a merchant without customers has time.'),
        say('orrin', 'Beim alten Baum am Waldrand liegt Holz genug für zwei Häuser. Lauf hin – der goldene Ring zeigt dir den Weg.',
          'By the old tree at the edge of the forest there’s enough wood for two houses. Go there – the golden ring shows the way.'),
        { type: 'remove', ref: 'stranger' },
        { type: 'hero', hero: 'orrin', at: 'orrinSeat' },
        { type: 'flag', name: 'orrin' },
        { type: 'reveal', id: 'root' },
        { type: 'reveal', area: 'oldRoot', seconds: 60 },
      ],
    },
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
    // Serfs haul wood (beams or trees): goal "wood" fulfilled
    { id: 'hauling', when: { type: 'all', of: [{ type: 'flag', name: 'orrin' }, { type: 'job', res: 'wood' }] }, do: [{ type: 'flag', name: 'hauling' }] },
    { id: 'firstWorker', when: { type: 'workers', count: 1 }, do: [say('nelia', 'Der erste Arbeiter! Wer ein Bett und eine warme Suppe hat, bleibt.', 'Our first worker! Whoever has a bed and warm soup stays.')] },
    // First payday with workers: explain taxes and new serfs
    { id: 'payday', when: { type: 'all', of: [{ type: 'event', event: 'payday' }, { type: 'workers', count: 1 }] }, do: [
      say('orrin', 'Hörst du das Klimpern? Zahltag! Jeder Arbeiter zahlt Steuern – endlich Taler in Lindgrund.',
        'Hear that jingle? Payday! Every worker pays taxes – coin in Lindgrund at last.'),
      say('orrin', 'Davon kaufst du in der Burg neue Leibeigene. Und die Steuern stellst du dort auch ein – aber drück die Leute nicht zu sehr.',
        'With it you buy new serfs at the castle. You set the taxes there too – but don’t squeeze the people too hard.'),
    ] },
    // Only when the village lives again (farms stand), Malvor's collectors come – after 25 minutes at the latest
    { id: 'collect', when: { type: 'any', of: [{ type: 'objective', id: 'farms' }, { type: 'time', at: 1500 }] }, do: [
      { type: 'spawn', owner: 'bandits', ref: 'collectors', at: 'collectorFrom', units: [{ def: 'spear1', count: 2, soldiers: 2 }], order: 'attackMove', target: 'humanHq' },
      say('collector', 'Im Namen des Statthalters! Jeder zehnte Sack Korn gehört Malvor – und was ihr unter dem alten Baum gefunden habt, auch.', 'In the name of the governor! Every tenth sack of grain belongs to Malvor – and so does what you found under the old tree.'),
      say('orrin', 'Eintreiber! Nelia, das sind nur ein paar Speerträger. Ruf deine Leute zusammen – und mach ihnen Mut!', 'Collectors! Nelia, those are only a few spearmen. Gather your people – and rally them!'),
      say('orrin', 'In der Burg rufst du „Zu den Waffen!“ – dann greifen die Leibeigenen zu Mistgabeln. Und du, Nelia, hast ein Herz, das andere mitreißt.',
        'At the castle you call “To arms!” – then the serfs grab their pitchforks. And you, Nelia, have a heart that carries others along.'),
      { type: 'reveal', id: 'collectors' },
      { type: 'reveal', area: 'collectors', seconds: 30 },
      { type: 'camera', at: 'collectors' },
    ] },
    // Neighbouring village only after the find (the rumour of the princess)
    { id: 'rumour', when: { type: 'objective', id: 'root' }, do: [
      { type: 'reveal', id: 'neighbors' },
      { type: 'npc', id: 'elder' },
      { type: 'reveal', area: 'villageArea', seconds: 40 },
    ] },
  ],
};
