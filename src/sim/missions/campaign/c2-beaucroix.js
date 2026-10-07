// Campaign "Krone aus Eis", mission 2: Beaucroix – market and trade, buy or fight for the second prong.

import { t, say, site } from './common.js';

/** Second prong in hand: close open offers, set marker. */
const gotShard = [
  { type: 'flag', name: 'shard2' },
  { type: 'closeTribute', id: ['buyShard', 'buyShardCheap', 'clay'] },
];

export default {
  id: 'c2',
  order: 2,
  seed: 2202,
  size: 96,
  title: t('Beaucroix', 'Beaucroix'),
  summary: t('Baue einen Markt auf und hol die zweite Zacke – mit Talern oder mit Schwertern.', 'Set up a market and get the second shard – with thalers or with swords.'),
  briefing: t(
    'Beaucroix lebt vom Flusshandel. Die Märkte sind voll, doch das Korn ist teuer: Malvors Agenten kaufen alles auf. Wo gehandelt wird, hört man alles – vielleicht auch, wo die zweite Zacke liegt. Orrin kennt die Preise. Nelia kennt den Hunger.',
    'Beaucroix lives on river trade. The markets are full, but grain is expensive: Malvor’s agents buy up everything. Where people trade, you hear everything – perhaps also where the second shard lies. Orrin knows the prices. Nelia knows hunger.',
  ),
  victoryText: t('Die zweite Zacke ist euer. Beaucroix hat Nahrung und einen Markt.', 'The second shard is yours. Beaucroix has food and a market.'),
  // The debrief follows the path taken: storming the camp leaves a captured robber, buying it a talkative chief
  debrief: (st) => (st.flags.shardStormed ? t(
    'Der gefangene Räuber zittert, aber nicht vor Kälte: „Der Winter ist nicht echt. Im Norden, bei Hagenfurt, steht ein altes Wetterwerk. Malvor hat es wieder angeworfen.“ Orrin wird blass. Nelia packt ihren Mantel.',
    'The captured robber is trembling, but not from the cold: “The winter isn’t real. Up north, near Hagenfurt, there’s an old weatherworks. Malvor has started it up again.” Orrin turns pale. Nelia packs her coat.',
  ) : t(
    'Der Räuberhauptmann zählt Orrins Taler zweimal. Beim Abschied grinst er: „Der Winter ist nicht echt, wisst ihr? Im Norden, bei Hagenfurt, steht ein altes Wetterwerk. Malvor hat es wieder angeworfen.“ Orrin wird blass. Nelia packt ihren Mantel.',
    'The robber chief counts Orrin’s thalers twice. As they leave he grins: “The winter isn’t real, you know? Up north, near Hagenfurt, there’s an old weatherworks. Malvor has started it up again.” Orrin turns pale. Nelia packs her coat.',
  )),
  defeatText: t('Euer Lager ist gefallen.', 'Your camp has fallen.'),
  defeatTexts: { hq: t('Euer Lager ist gefallen. Beaucroix bleibt in Malvors Hand.', 'Your camp has fallen. Beaucroix stays in Malvor’s hands.') },
  next: 'c3',
  weatherCycle: [['winter', 360000]], // Malvor's winter: only ends with the weather works (mission 3)
  // New here: market and stone; the barracks comes with the robbers (milestone "first trade")
  available: { buildings: ['villageCenter', 'residence', 'farm', 'clayMine', 'storehouse', 'stoneMine'], techs: [] },
  shafts: ['clay', 'stone'],
  players: [
    {
      // Few thalers: the price of the shard is earned at the market
      kind: 'human', heroes: ['nelia', 'orrin'], serfs: 10, techs: ['conscription', 'education', 'trade'],
      stock: { gold: 300, clay: 1800, wood: 2000, stone: 1200, iron: 400, sulfur: 0 },
    },
    { kind: 'bandits' },
    { kind: 'village', name: 'beaucroix', diplomacy: { human: 'allied' } },
  ],

  setup(ctx) {
    const { sim, api, m } = ctx;
    const hq = ctx.hqCenter();
    const mid = ctx.mapCenter();
    // Merchants' quarter of Beaucroix (allied): the merchant stands at the market
    const town = m.playerOf('beaucroix');
    const side = api.toward(hq, { x: hq.x < mid.x ? sim.map.width - 4 : 4, y: mid.y }, 20);
    const v = site(ctx, side, { from: hq, avoid: [{ ...hq, r: 10 }] });
    if (v) {
      api.placeBuilding(sim, town, 'storehouse', v, { minR: 1, radius: 6, level: 1 });
      api.placeBuilding(sim, town, 'residence', { x: v.x + 4, y: v.y + 1 }, { minR: 1, radius: 6 });
      ctx.ref('townArea', { x: v.x, y: v.y, r: 4 });
    } else ctx.warn('No space for Beaucroix');
    // Bandit camp in the river forest, towards the map centre
    const far = api.toward(hq, mid, 30);
    ctx.camp('robbers', far, [
      { def: 'sword1', count: 2, soldiers: 3 }, { def: 'bow1', count: 2, soldiers: 3 }, { def: 'spear1', count: 1, soldiers: 3 },
    ], { from: hq, avoid: [{ ...hq, r: 20 }] });
  },

  start: [
    say('orrin', 'Beaucroix! Hier riecht sogar der Schnee nach Geld. Wir brauchen einen eigenen Markt, Nelia.', 'Beaucroix! Even the snow smells of money here. We need a market of our own, Nelia.'),
    say('nelia', 'Wir brauchen Brot für unsere Leute. Wenn der Markt das bringt, bauen wir ihn.', 'We need bread for our people. If a market brings that, we’ll build one.'),
    say('orrin', 'Bau erst ein Lager und dann den Marktplatz daraus. Dort tauschen Händler, was du übrig hast, gegen Taler.',
      'First build a storehouse, then turn it into a marketplace. There, traders swap whatever you have spare for thalers.'),
    say('nelia', 'Und die anderen Zacken? Wenn Malvor sie sucht, sind seine Leute vielleicht schon hier.', 'And the other shards? If Malvor is looking for them, his people may be here already.'),
    say('orrin', 'Darum hören wir uns um. Auf dem Markt erfährt man alles – man muss nur etwas zu tauschen haben.',
      'That’s why we listen. At the market you learn everything – you just need something to trade.'),
  ],

  objectives: [
    { id: 'farms', type: 'build', building: 'farm', count: 3, primary: true, hint: { ui: ['build-farm', 'quick-all'] }, text: t('Sichere Nahrung: Baue 3 Bauernhöfe', 'Secure food: build 3 farms') },
    { id: 'market', type: 'build', building: 'storehouse', level: 1, primary: true, hint: { ui: ['build-storehouse', 'quick-all'], uiWhile: { type: 'not', cond: { type: 'built', building: 'storehouse', placed: true } } }, text: t('Errichte einen Marktplatz (baue ein Lager und baue es aus)', 'Set up a marketplace (build a storehouse and upgrade it)') },
    { id: 'trade', type: 'flag', flag: 'traded', primary: true, text: t('Tausche Waren am Markt', 'Trade goods at the market') },
    // Pointer at the newly unlocked barracks for a while (the way with swords), ring at the camp
    { id: 'shard', type: 'flag', flag: 'shard2', primary: true, hidden: true,
      hint: { area: 'robbersArea', ui: ['build-barracks', 'quick-all'], uiWhile: { type: 'all', of: [
        { type: 'not', cond: { type: 'built', building: 'barracks', placed: true } }, { type: 'not', cond: { type: 'delay', after: 'offer', seconds: 90 } }] } },
      text: t('Hol die zweite Zacke: über Orrin freikaufen oder das Räuberlager stürmen', 'Get the second shard: buy it through Orrin or storm the robbers’ camp') },
    { id: 'clay', type: 'flag', flag: 'clayDelivered', hidden: true, text: t('Optional: Liefere dem Kaufmann den Lehm, den Orrin verkauft hat', 'Optional: Deliver the clay Orrin sold to the merchant') },
  ],

  tributes: {
    buyShard: {
      group: 'shard', cost: { gold: 1200 },
      text: t('Zacke freikaufen (Orrin verhandelt mit den Räubern)', 'Buy the shard free (Orrin bargains with the robbers)'),
      onPaid: [
        say('bandit', 'Taler sind Taler. Nimm dein Blechstück, Händler.', 'Thalers are thalers. Take your bit of tin, merchant.'),
        { type: 'flag', name: 'shardBought' },
        ...gotShard,
      ],
    },
    buyShardCheap: {
      group: 'shard', cost: { gold: 800 },
      text: t('Zacke freikaufen – mit Rabatt des Kaufmanns', 'Buy the shard free – with the merchant’s discount'),
      onPaid: [
        say('bandit', 'Der Kaufmann bürgt für dich? Dann sei’s drum. Nimm dein Blechstück.', 'The merchant vouches for you? Fine then. Take your bit of tin.'),
        { type: 'flag', name: 'shardBought' },
        ...gotShard,
      ],
    },
    clay: {
      cost: { clay: 800 },
      text: t('Den versprochenen Lehm an den Kaufmann liefern', 'Deliver the promised clay to the merchant'),
      onPaid: [
        say('merchant', 'Der Lehm ist da – und sogar trocken! Für so ehrliche Leute rede ich mit den Räubern.', 'The clay is here – and dry, too! For such honest people I’ll talk to the robbers.'),
        say('orrin', 'Ehrlichkeit ist mein zweiter Vorname. Gleich nach Gewinn.', 'Honesty is my middle name. Right after profit.'),
        { type: 'flag', name: 'clayDelivered' },
        { type: 'closeTribute', id: 'buyShard' },
        { type: 'tribute', id: 'buyShardCheap' },
      ],
    },
  },

  npcs: {
    merchant: {
      at: 'townArea', owner: 'beaucroix', look: 'worker', hero: 'orrin', speaker: 'merchant',
      wrongHero: t('Ich warte auf Orrin. Er schuldet mir etwas.', 'I’m waiting for Orrin. He owes me something.'),
      onTalk: [
        say('merchant', 'Orrin! Du hast mir vor einem Monat achthundert Lehm verkauft. Wo ist er?', 'Orrin! A month ago you sold me eight hundred clay. Where is it?'),
        say('orrin', 'Unterwegs! Sozusagen. Er … wächst noch. Nelia, wir sollten ihn liefern. Dann gibt’s Rabatt.', 'On its way! So to speak. It’s … still growing. Nelia, we should deliver it. Then there’s a discount.'),
        say('nelia', 'Du hast etwas verkauft, das du nicht hast?', 'You sold something you don’t have?'),
        { type: 'reveal', id: 'clay' },
        { type: 'tribute', id: 'clay' },
      ],
    },
  },

  events: [
    // Milestone: the first trade. Only now does Malvor's herald come – and with him the robbers' shard
    { id: 'offer', when: { type: 'flag', name: 'traded' }, do: [
      say('herald', 'Hört, Leute von Beaucroix! Statthalter Malvor zahlt für jedes Stück der alten Krone tausend Taler!',
        'Hear, people of Beaucroix! Governor Malvor pays a thousand thalers for every piece of the old crown!'),
      say('orrin', 'Tausend! Die Räuber im Flusswald haben so ein Stück, das weiß hier jeder. Ich biete mehr – oder du holst es dir.',
        'A thousand! The robbers in the river woods have such a piece, everyone here knows it. I’ll bid more – or you go and take it.'),
      say('nelia', 'Verkaufen sie an Malvor, ist die Zacke verloren. Wenn wir sie holen müssen, brauchen wir Schwertkämpfer – eine Kaserne bildet sie aus.',
        'If they sell to Malvor, the shard is lost. If we have to take it, we need swordsmen – a barracks trains them.'),
      { type: 'unlock', buildings: ['barracks'] },
      { type: 'reveal', id: 'shard' },
      { type: 'tribute', id: 'buyShard' },
      { type: 'reveal', area: 'robbersArea', seconds: 30 },
      { type: 'npc', id: 'merchant' },
    ] },
    { id: 'traded', when: { type: 'event', event: 'tradeDone' }, do: [
      { type: 'flag', name: 'traded' },
      say('orrin', 'Hörst du das? Das ist der schönste Klang der Welt: Taler, die klimpern.', 'Hear that? The most beautiful sound in the world: thalers clinking.'),
    ] },
    // Armed with Malvor's money the gang raids the camp as long as it has the shard – first five minutes after the herald
    { id: 'raid', when: { type: 'all', of: [{ type: 'delay', after: 'offer', seconds: 300 }, { type: 'not', cond: { type: 'flag', name: 'shard2' } }] }, every: 300, times: 3, do: [
      say('bandit', 'Holt euch, was die Prinzessin hortet!', 'Grab what the princess is hoarding!'),
      { type: 'spawn', owner: 'bandits', at: 'robbersArea', units: [{ def: 'sword1', count: 2, soldiers: 3 }], order: 'attackMove', target: 'humanHq' },
    ] },
    { id: 'stormed', when: { type: 'destroyed', ref: 'robbersGuards' }, do: [
      say('prisoner', 'Gnade! Hier, nehmt das verfluchte Ding. Es hat uns nur Unglück gebracht.', 'Mercy! Here, take the cursed thing. It has brought us nothing but bad luck.'),
      { type: 'flag', name: 'shardStormed' },
      ...gotShard,
    ] },
  ],
};
