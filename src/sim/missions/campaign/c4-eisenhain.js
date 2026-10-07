// Campaign "Krone aus Eis", mission 4: Eisenhain – break the siege of the mining town, first encounter with
// Captain Taran. Via Orrin: mercenaries (immediately ready for battle) or fled serfs (strengthen the economy).

import { t, say, site } from './common.js';

export default {
  id: 'c4',
  order: 4,
  seed: 4404,
  size: 96,
  title: t('Eisenhain', 'Eisenhain'),
  summary: t('Brich die Belagerung der Bergwerksstadt und erschließe Eisen und Schwefel.', 'Break the siege of the mining town and open up iron and sulphur.'),
  briefing: t(
    'Der Frühling ist da, und Malvor hat sein Druckmittel verloren. Jetzt schickt er Soldaten. Hauptmann Taran belagert Eisenhain, die Stadt der Bergleute. Wer die Bergwerke hat, hat Eisen für Schwerter. Nelia will den Bergleuten helfen. Orrin will vor allem nicht in der Nähe der Schwerter sein.',
    'Spring is here, and Malvor has lost his leverage. Now he sends soldiers. Captain Taran is besieging Eisenhain, the miners’ town. Whoever holds the mines has iron for swords. Nelia wants to help the miners. Orrin mostly wants to stay away from the swords.',
  ),
  victoryText: t('Die Belagerung ist gebrochen. Eisenhain ist frei.', 'The siege is broken. Eisenhain is free.'),
  debrief: t(
    'Taran zieht mit dem Rest seiner Männer ab. Nelia sieht ihm nach. „Er hat nicht ausgesehen wie einer, der gern kämpft“, sagt sie. Orrin zählt schon die Eisenbarren, die der Bergmeister als Dank versprochen hat.',
    'Taran withdraws with the rest of his men. Nelia watches him go. “He didn’t look like someone who likes fighting,” she says. Orrin is already counting the iron bars the mine master has promised as thanks.',
  ),
  defeatText: t('Euer Lager ist gefallen.', 'Your camp has fallen.'),
  defeatTexts: { hq: t('Euer Lager ist gefallen. Eisenhain bleibt belagert.', 'Your camp has fallen. Eisenhain stays besieged.') },
  next: 'c5',
  // Changing weather: spring with rain, towards the end a short cold snap
  weatherCycle: [['summer', 4800], ['rain', 1200], ['summer', 4800], ['winter', 1500]],
  // New here: iron and sulphur, university with the first research (archers), towers
  available: {
    buildings: ['villageCenter', 'residence', 'farm', 'clayMine', 'storehouse', 'stoneMine', 'barracks', 'ironMine', 'sulfurMine', 'university', 'archery', 'tower'],
    techs: ['standingArmy'],
  },
  shafts: ['clay', 'stone', 'iron', 'sulfur'],
  players: [
    {
      kind: 'human', heroes: ['nelia', 'orrin'], serfs: 10, techs: ['conscription', 'education', 'construction'],
      stock: { gold: 2000, clay: 1600, wood: 2200, stone: 1500, iron: 600, sulfur: 200 },
    },
    { kind: 'bandits', look: 'soldiers' },
    { kind: 'village', name: 'eisenhain', diplomacy: { human: 'allied' } },
  ],

  setup(ctx) {
    const { sim, api, m } = ctx;
    const hq = ctx.hqCenter();
    const mid = ctx.mapCenter();
    api.placeBuilding(sim, ctx.human, 'barracks', { x: hq.x + 4, y: hq.y + 8 }, { minR: 3 });
    api.ensureShaft(sim, 'iron', hq, 22);
    api.ensureShaft(sim, 'sulfur', hq, 24);
    // The mining town towards the map centre
    const town = m.playerOf('eisenhain');
    const c = site(ctx, api.toward(hq, mid, 30), { from: hq, avoid: [{ ...hq, r: 18 }] });
    if (!c) { ctx.warn('No space for Eisenhain'); return; }
    api.clearNodes(sim, c.x, c.y, 4);
    for (const [type, dx, dy] of [['smithy', 0, 0], ['residence', 4, 1], ['farm', -4, 1], ['residence', 1, 4]]) {
      api.placeBuilding(sim, town, type, { x: c.x + dx, y: c.y + dy }, { minR: 0, radius: 5 });
    }
    ctx.ref('town', { x: c.x, y: c.y, r: 5 });
    // Besiegers: two camps in front of the town, one on our side, one behind it
    const front = api.toward(c, hq, 9), back = api.toward(c, hq, -9);
    ctx.camp('siegeA', front, [{ def: 'sword1', count: 2, soldiers: 4 }, { def: 'bow1', count: 1, soldiers: 4 }], { maxR: 6, from: hq });
    ctx.camp('siegeB', back, [{ def: 'spear1', count: 2, soldiers: 4 }, { def: 'bow1', count: 1, soldiers: 4 }], { maxR: 8, from: hq });
    ctx.ref('siegeGuards', [...(ctx.ref('siegeAGuards') ?? []), ...(ctx.ref('siegeBGuards') ?? [])]);
    // Taran stands at the front camp
    const a = ctx.ref('siegeAArea');
    if (a) {
      const h = sim.spawnHero(ctx.bandits, 'taran');
      const p = api.findOpen(sim, a.x, a.y + 2, { maxR: 4 }) ?? a;
      h.px = p.x * 1000 + 500; h.py = p.y * 1000 + 500; h.anchor = { x: h.px, y: h.py };
      ctx.ref('taran', h.id);
    }
  },

  start: [
    say('orrin', 'Eisenhain. Eisen, Schwefel – und eine Armee davor. Ich hätte Beaucroix nie verlassen sollen.', 'Eisenhain. Iron, sulphur – and an army at the gates. I should never have left Beaucroix.'),
    say('nelia', 'Eine ganze Armee gegen ein paar Bergleute? Nur wegen Eisen?', 'A whole army against a few miners? Just for iron?'),
    say('orrin', 'Man sagt, sie hüten eine Zacke in ihrem tiefsten Stollen. Darum lässt Malvor sie belagern.',
      'They say they’re guarding a shard in their deepest gallery. That’s why Malvor has them besieged.'),
    say('nelia', 'Die Bergleute halten nicht mehr lange durch. Wir brauchen Truppen, Orrin.', 'The miners won’t hold out much longer. We need troops, Orrin.'),
    say('orrin', 'Truppen! Ich kenne zwei Wege. Söldner kosten viel, kämpfen aber sofort. Geflohene Leibeigene kosten wenig, bringen Vorräte – aber du musst sie erst ausbilden.', 'Troops! I know two ways. Mercenaries cost a lot but fight at once. Runaway serfs cost little and bring supplies – but you’ll have to train them first.'),
    { type: 'tribute', id: 'mercs' },
    { type: 'tribute', id: 'refugees' },
    { type: 'reveal', area: 'town', seconds: 40 },
    { type: 'camera', at: 'town' },
  ],

  objectives: [
    { id: 'siege', type: 'destroy', ref: 'siegeGuards', primary: true, text: t('Brich die Belagerung von Eisenhain', 'Break the siege of Eisenhain'),
      onDone: [
        say('miner', 'Sie ziehen ab! Kommt in die Stadt, Prinzessin – ich habe etwas für euch.', 'They’re leaving! Come into town, princess – I have something for you.'),
        { type: 'npc', id: 'miner' },
        { type: 'reveal', id: 'shard' },
      ] },
    { id: 'iron', type: 'build', building: 'ironMine', primary: true, hint: { ui: ['build-ironMine', 'quick-all'] }, text: t('Baue eine Eisengrube', 'Build an iron pit') },
    { id: 'sulfur', type: 'build', building: 'sulfurMine', primary: true, hint: { ui: ['build-sulfurMine', 'quick-all'] }, text: t('Baue eine Schwefelgrube', 'Build a sulphur pit') },
    { id: 'shard', type: 'flag', flag: 'shard3', primary: true, hidden: true, text: t('Sprich mit dem Bergmeister in Eisenhain', 'Talk to the mine master in Eisenhain') },
    { id: 'bows', type: 'research', tech: 'standingArmy', hidden: true,
      hint: { ui: ['build-university', 'quick-all'], uiWhile: { type: 'not', cond: { type: 'built', building: 'university', placed: true } } },
      text: t('Optional: Erforsche „Stehendes Heer“ an einer Hochschule – dann bildet der Schießplatz Bogenschützen aus', 'Optional: Research “Standing Army” at a university – then the archery range trains archers') },
    { id: 'army', type: 'recruit', count: 4, text: t('Optional: Bilde 4 eigene Truppen aus', 'Optional: Train 4 troops of your own'),
      onDone: [{ type: 'give', res: { iron: 300 } }, say('miner', 'Gute Leute! Nehmt Eisen für ihre Klingen.', 'Good people! Take iron for their blades.')] },
  ],

  tributes: {
    mercs: {
      group: 'help', cost: { gold: 1400 },
      text: t('Söldner anheuern: 4 kampfbereite Truppen', 'Hire mercenaries: 4 battle-ready troops'),
      onPaid: [
        { type: 'spawn', owner: 'human', at: 'humanHq', units: [{ def: 'sword1', count: 2, soldiers: 4 }, { def: 'bow1', count: 2, soldiers: 4 }] },
        say('orrin', 'Bezahlt und bereit. Sie fragen nicht, wofür sie kämpfen. Das ist bei Söldnern so.', 'Paid and ready. They don’t ask what they’re fighting for. That’s how mercenaries are.'),
      ],
    },
    refugees: {
      group: 'help', cost: { gold: 400 },
      text: t('Geflohene Leibeigene aufnehmen: 8 Leibeigene und Vorräte', 'Take in runaway serfs: 8 serfs and supplies'),
      onPaid: [
        { type: 'give', serfs: 8, res: { wood: 600, stone: 400, clay: 400, iron: 400 } },
        say('villager', 'Malvor hat uns hungern lassen. Für die Prinzessin arbeiten wir gern.', 'Malvor let us starve. We’ll gladly work for the princess.'),
        say('nelia', 'Ihr arbeitet für euch selbst. Ich bin keine Prinzessin.', 'You work for yourselves. I am no princess.'),
      ],
    },
  },

  npcs: {
    miner: {
      at: 'town', owner: 'eisenhain', look: 'worker.miner', hero: 'nelia', speaker: 'miner',
      wrongHero: t('Die Prinzessin soll selbst kommen.', 'The princess should come herself.'),
      onTalk: [
        say('miner', 'Das ist es, was Malvor wollte. Wir haben es im tiefsten Stollen versteckt. Es gehört zu euch.', 'This is what Malvor wanted. We hid it in the deepest gallery. It belongs with you.'),
        say('nelia', 'Die dritte Zacke … Danke. Wir hätten euch auch ohne sie geholfen.', 'The third shard … Thank you. We would have helped you without it, too.'),
        { type: 'flag', name: 'shard3' },
      ],
    },
  },

  events: [
    { id: 'meetTaran', when: { type: 'area', area: 'siegeAArea', who: 'nelia' }, do: [
      say('taran', 'Du bist also die Prinzessin. Geh nach Hause, Mädchen. Hier wird gekämpft.', 'So you’re the princess. Go home, girl. There’s fighting here.'),
      say('taran', 'Die Bergleute sollen herausgeben, was sie im Stollen verstecken. Dann ziehen wir ab.', 'The miners are to hand over what they’re hiding in the gallery. Then we’ll leave.'),
      say('nelia', 'Warum dient ihr Malvor? Er lässt die Dörfer hungern.', 'Why do you serve Malvor? He lets the villages starve.'),
      say('taran', 'Unter dem milden König sind auch Kinder verhungert. Malvor bringt Ordnung. Volle Speicher.', 'Children starved under the gentle king, too. Malvor brings order. Full granaries.'),
    ] },
    { id: 'taranDown', when: { type: 'heroDown', hero: 'taran' }, do: [
      say('taran', 'Genug! Rückzug! … Wir sehen uns wieder, Prinzessin.', 'Enough! Fall back! … We’ll meet again, princess.'),
      { type: 'remove', ref: 'taran' },
    ] },
    // The iron pit stands: Orrin introduces research (archers)
    { id: 'research', when: { type: 'objective', id: 'iron' }, do: [
      say('orrin', 'Schwerter allein brechen keine Belagerung. In einer Hochschule erforschen Gelehrte „Stehendes Heer“ – dann bildet ein Schießplatz Bogenschützen aus.',
        'Swords alone won’t break a siege. In a university, scholars research “Standing Army” – then an archery range trains archers.'),
      { type: 'reveal', id: 'bows' },
    ] },
    // Milestone: our first troop (hired or trained) – at the latest after 10 minutes. Two minutes later Taran strikes.
    { id: 'armed', when: { type: 'any', of: [(sim, m) => m.count(sim)[m.human].leaders > 0, { type: 'time', at: 600 }] }, do: [] },
    { id: 'sortie', when: { type: 'all', of: [{ type: 'delay', after: 'armed', seconds: 120 }, { type: 'not', cond: { type: 'objective', id: 'siege' } }] }, every: 300, times: 3, do: [
      say('taran', 'Schlagt das Lager dieser Prinzessin, bevor es wächst!', 'Hit this princess’s camp before it grows!'),
      { type: 'spawn', owner: 'bandits', at: 'siegeBArea', units: [{ def: 'sword1', count: 2, soldiers: 3 }], order: 'attackMove', target: 'humanHq' },
    ] },
  ],
};
