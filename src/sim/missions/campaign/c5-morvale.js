// Campaign "Krone aus Eis", mission 5: Morvale – Malvor reveals the lie, the villages become neutral,
// Taran refuses the order and defects. The villages are won back through supplies (tributes).

import { t, say, site } from './common.js';

const VILLAGES = ['moorbrook', 'reedham', 'alderfarm'];

/** Number of villages that are allied again. */
const allies = (sim, m) => VILLAGES.filter((v) => sim.relation(m.human, m.playerOf(v)) === 'allied').length;

/** Taran switches sides: as a hero with the player, two squads come along, the rest attacks Moorbrook. */
function taranDefects(sim, m) {
  const st = m.state;
  const enemy = sim.entities.get(st.refs.taranFoe);
  const at = enemy ? { x: Math.trunc(enemy.px / 1000), y: Math.trunc(enemy.py / 1000) } : st.refs.taranCampArea;
  if (enemy) sim.entities.delete(enemy.id);
  m.runActions(sim, [{ type: 'hero', hero: 'taran', at: { ...at, r: 2 } }]);
  // Two squads of the camp defect too (same spot, new owner)
  const guards = (st.refs.taranCampGuards ?? []).filter((id) => sim.entities.has(id));
  const turn = guards.slice(0, 2), rest = guards.slice(2);
  for (const id of turn) {
    const L = sim.entities.get(id);
    for (const e of [L, ...L.soldiers.map((s) => sim.entities.get(s)).filter(Boolean)]) { e.owner = m.human; e.targetId = 0; e.path = []; }
    L.order = { type: 'idle' }; L.anchor = { x: L.px, y: L.py };
  }
  st.refs.loyalists = rest;
  const target = m.pointOf(sim, 'moorbrookArea');
  if (rest.length && target) sim.applyCommand({ type: 'order', player: st.bandits, units: rest, order: 'attackMove', x: target.x, y: target.y });
}

export default {
  id: 'c5',
  order: 5,
  seed: 5505,
  size: 96,
  title: t('Morvale', 'Morvale'),
  summary: t('Halte die Moordörfer – auch wenn sie dir nicht mehr glauben.', 'Hold the moor villages – even when they no longer believe you.'),
  briefing: t(
    'Morvale: Wälder, Moore und Dörfer, die niemandem gehorchen. Sie folgen Nelia, weil sie die verlorene Prinzessin sein soll. In der Nähe lagert Hauptmann Taran mit seinen Männern. Malvor hat einen Herold geschickt. Was er verkünden wird, ahnt Nelia schon.',
    'Morvale: forests, moors and villages that obey no one. They follow Nelia because she is said to be the lost princess. Nearby, Captain Taran is camped with his men. Malvor has sent a herald. Nelia already suspects what he will proclaim.',
  ),
  victoryText: t('Die Dörfer stehen wieder hinter Nelia – diesmal ihrer Taten wegen.', 'The villages stand behind Nelia again – this time for what she has done.'),
  debrief: t(
    'Die Dorfälteste legt die vierte Zacke in Nelias Hand. „Ob du Königsblut hast, ist mir gleich. Du hast unser Korn beschützt.“ Taran steht abseits. Er hat nicht gelächelt, seit er hier ist. Aber er ist geblieben.',
    'The elder places the fourth shard in Nelia’s hand. “Whether you have royal blood, I don’t care. You protected our grain.” Taran stands apart. He hasn’t smiled since he arrived. But he has stayed.',
  ),
  defeatText: t('Morvale ist verloren.', 'Morvale is lost.'),
  defeatTexts: {
    hq: t('Euer Lager ist gefallen.', 'Your camp has fallen.'),
    granaries: t('Die Höfe von Moorbrook sind niedergebrannt. Die Dörfer werden Nelia nie wieder folgen.', 'Moorbrook’s farms have burned down. The villages will never follow Nelia again.'),
  },
  next: 'c6',
  weatherCycle: [['summer', 3600], ['rain', 1500], ['summer', 3600], ['winter', 1800]],
  players: [
    {
      kind: 'human', heroes: ['nelia', 'orrin'], serfs: 12, techs: ['conscription', 'education', 'construction'],
      stock: { gold: 1500, clay: 2000, wood: 2500, stone: 1600, iron: 700, sulfur: 200 },
    },
    { kind: 'bandits', look: 'soldiers' },
    { kind: 'village', name: 'moorbrook', diplomacy: { human: 'allied' } },
    { kind: 'village', name: 'reedham', diplomacy: { human: 'allied' } },
    { kind: 'village', name: 'alderfarm', diplomacy: { human: 'allied' } },
  ],

  setup(ctx) {
    const { sim, api, m } = ctx;
    const hq = ctx.hqCenter();
    const mid = ctx.mapCenter();
    api.placeBuilding(sim, ctx.human, 'barracks', { x: hq.x + 4, y: hq.y + 8 }, { minR: 3 });
    // Three moor villages in a semicircle around the map centre
    const W = sim.map.width, H = sim.map.height;
    const corners = [api.toward(hq, mid, 24), api.toward(hq, { x: W - hq.x, y: hq.y }, 26), api.toward(hq, { x: hq.x, y: H - hq.y }, 26)];
    VILLAGES.forEach((v, i) => {
      const owner = m.playerOf(v);
      const c = site(ctx, corners[i], { from: hq, avoid: [{ ...hq, r: 14 }, ...VILLAGES.slice(0, i).map((w) => ({ ...(ctx.ref(`${w}Area`) ?? hq), r: 9 }))] });
      if (!c) { ctx.warn(`No space for ${v}`); return; }
      const farms = [];
      for (const [type, dx, dy] of [['farm', 0, 0], ['residence', 4, 0], ['farm', 0, 4]]) {
        const b = api.placeBuilding(sim, owner, type, { x: c.x + dx, y: c.y + dy }, { minR: 0, radius: 5 });
        if (b && type === 'farm') farms.push(b.id);
      }
      ctx.ref(`${v}Area`, { x: c.x, y: c.y, r: 5 });
      ctx.ref(`${v}Farms`, farms);
    });
    ctx.ref('granaries', ctx.ref('moorbrookFarms'));
    // Auxiliary troops of the villages (withdraw after the revelation)
    const helpers = [];
    for (const dx of [-3, 3]) { const L = api.spawnTroop(sim, ctx.human, 'spear1', { x: hq.x + dx, y: hq.y + 7 }, 3); if (L) helpers.push(L.id); }
    ctx.ref('helpers', helpers);
    // Taran's camp behind Moorbrook
    const mb = ctx.ref('moorbrookArea') ?? mid;
    const campAt = api.toward(hq, mb, api.dist(hq, mb) + 12);
    ctx.camp('taranCamp', campAt, [{ def: 'sword1', count: 3, soldiers: 4 }, { def: 'bow1', count: 2, soldiers: 4 }], { maxR: 8, from: hq, avoid: [{ ...hq, r: 20 }] });
    const ca = ctx.ref('taranCampArea');
    if (ca) {
      const h = sim.spawnHero(ctx.bandits, 'taran');
      const p = api.findOpen(sim, ca.x, ca.y + 2, { maxR: 4 }) ?? ca;
      h.px = p.x * 1000 + 500; h.py = p.y * 1000 + 500; h.anchor = { x: h.px, y: h.py };
      ctx.ref('taranFoe', h.id);
    }
  },

  start: [
    say('elder', 'Prinzessin! Morvale steht zu dir. Unsere Speerträger halten Wache an deinem Lager.', 'Princess! Morvale stands with you. Our spearmen are guarding your camp.'),
    say('orrin', 'Seht ihr? Königsblut öffnet Türen. Und Speicher.', 'You see? Royal blood opens doors. And granaries.'),
    say('nelia', 'Orrin. Hör auf damit.', 'Orrin. Stop it.'),
  ],

  objectives: [
    { id: 'granaries', type: 'protect', ref: 'granaries', primary: true, hidden: true, heroDownFails: false, text: t('Schütze die Höfe von Moorbrook', 'Protect the farms of Moorbrook') },
    { id: 'regain', type: 'custom', primary: true, hidden: true, text: t('Gewinne die Dörfer durch Lieferungen zurück', 'Win back the villages with deliveries'),
      progress: (sim, m) => ({ cur: allies(sim, m), target: VILLAGES.length }) },
    { id: 'drive', type: 'destroy', ref: 'loyalists', primary: true, hidden: true, text: t('Vertreibe Malvors restliche Truppen', 'Drive off Malvor’s remaining troops') },
    { id: 'shard', type: 'flag', flag: 'shard4', primary: true, hidden: true, text: t('Sprich mit der Dorfältesten von Erlenhof', 'Talk to the elder of Alderfarm') },
    { id: 'farms', type: 'build', building: 'farm', count: 4, text: t('Optional: Baue 4 eigene Bauernhöfe', 'Optional: Build 4 farms of your own'),
      onDone: [{ type: 'give', res: { gold: 400 } }, say('villager', 'Wer selbst Korn anbaut, will es uns nicht wegnehmen.', 'Someone who grows grain himself won’t take ours.')] },
  ],

  tributes: {
    supplyMoorbrook: {
      cost: { wood: 500, clay: 300 }, text: t('Moorbrook: Holz und Lehm für neue Dächer liefern', 'Moorbrook: deliver wood and clay for new roofs'),
      onPaid: [{ type: 'diplomacy', b: 'moorbrook', state: 'allied' }, say('villager', 'Ihr habt geliefert, ohne etwas zu verlangen. Moorbrook steht zu euch.', 'You delivered without asking anything in return. Moorbrook stands with you.')],
    },
    supplyReedham: {
      cost: { stone: 400, iron: 200 }, text: t('Schilfheim: Stein und Eisen für den Deich liefern', 'Reedham: deliver stone and iron for the dyke'),
      onPaid: [{ type: 'diplomacy', b: 'reedham', state: 'allied' }, say('villager', 'Der Deich hält wieder. Schilfheim vergisst das nicht.', 'The dyke holds again. Reedham won’t forget that.')],
    },
    supplyAlderfarm: {
      cost: { gold: 300, clay: 500 }, text: t('Erlenhof: Taler für Saatgut und Lehm für die Scheune schicken', 'Alderfarm: send thalers for seed and clay for the barn'),
      onPaid: [{ type: 'diplomacy', b: 'alderfarm', state: 'allied' }, say('elder', 'Saatgut von einer Leibeigenen. Das hat uns noch kein König geschickt.', 'Seed from a serf. No king ever sent us that.')],
    },
  },

  npcs: {
    elder: {
      at: 'alderfarmArea', owner: 'alderfarm', look: 'serf', hero: 'nelia', speaker: 'elder',
      wrongHero: t('Nelia soll selbst kommen.', 'Nelia should come herself.'),
      onTalk: [
        say('elder', 'Du hast nicht gelogen, als es dir geschadet hätte. Und du hast unsere Höfe geschützt.', 'You didn’t lie when it would have hurt you. And you protected our farms.'),
        say('elder', 'Nimm die Zacke. Wir folgen dir – nicht deinem Blut.', 'Take the shard. We follow you – not your blood.'),
        { type: 'flag', name: 'shard4' },
      ],
    },
  },

  events: [
    { id: 'herald', when: { type: 'time', at: 150 }, do: [
      say('herald', 'Hört, Leute von Morvale! Statthalter Malvor lässt verkünden: Die „Prinzessin“ ist die Tochter eines Leibeigenen aus Lindgrund!', 'Hear, people of Morvale! Governor Malvor proclaims: the “princess” is the daughter of a serf from Lindgrund!'),
      say('herald', 'Ein Händler hat die Lüge erfunden, um Geld zu machen. Wer ihr folgt, folgt einem Märchen.', 'A merchant invented the lie to make money. Whoever follows her follows a fairy tale.'),
      say('nelia', 'Es stimmt. Ich bin keine Prinzessin. Ich habe es von Anfang an gesagt.', 'It’s true. I am no princess. I said so from the start.'),
      say('orrin', 'Nelia … nein. Sag so etwas nicht.', 'Nelia … no. Don’t say that.'),
      ...VILLAGES.map((v) => ({ type: 'diplomacy', b: v, state: 'neutral' })),
      { type: 'remove', ref: 'helpers' },
      say('elder', 'Unsere Speerträger gehen nach Hause. Wir wissen nicht mehr, wem wir glauben sollen.', 'Our spearmen are going home. We no longer know whom to believe.'),
      { type: 'reveal', id: 'regain' },
      { type: 'tribute', id: 'supplyMoorbrook' },
      { type: 'tribute', id: 'supplyReedham' },
      { type: 'tribute', id: 'supplyAlderfarm' },
    ] },
    { id: 'order', when: { type: 'time', at: 330 }, do: [
      say('herald', 'Hauptmann Taran! Befehl des Statthalters: Brennt die Höfe von Moorbrook nieder. Wer nicht gehorcht, soll hungern.', 'Captain Taran! The governor’s order: burn Moorbrook’s farms. Whoever disobeys shall starve.'),
      say('taran', '… Nein. Ich habe ein Dorf verhungern sehen. Meine Schwester war sieben. Ich zünde kein Korn an.', '… No. I watched a village starve. My sister was seven. I will not burn grain.'),
      say('taran', 'Wer mit mir geht, kommt mit. Die Leibeigene weiß wenigstens, was Hunger ist.', 'Whoever goes with me, come along. The serf at least knows what hunger is.'),
      taranDefects,
      { type: 'reveal', id: ['granaries', 'drive'] },
      { type: 'camera', at: 'moorbrookArea' },
      say('nelia', 'Taran! Hilf uns, die Höfe zu halten!', 'Taran! Help us hold the farms!'),
    ] },
    { id: 'reinforce', when: { type: 'time', at: 660 }, do: [
      say('herald', 'Verstärkung für die Getreuen! Morvale wird gehorchen!', 'Reinforcements for the loyal! Morvale will obey!'),
      { type: 'spawn', owner: 'bandits', at: 'taranCampArea', ref: 'loyalists', append: true, units: [{ def: 'sword1', count: 2, soldiers: 4 }], order: 'attackMove', target: 'moorbrookArea' },
    ] },
    { id: 'elderReady', when: { type: 'all', of: [{ type: 'objective', id: 'regain' }, { type: 'objective', id: 'drive' }] }, do: [
      say('elder', 'Komm nach Erlenhof, Nelia. Ich habe etwas, das dir gehört.', 'Come to Alderfarm, Nelia. I have something that belongs to you.'),
      { type: 'reveal', id: 'shard' },
      { type: 'npc', id: 'elder' },
    ] },
  ],
};
