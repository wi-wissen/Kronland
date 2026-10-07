// Campaign "Krone aus Eis", mission 3: The weather works – without a castle into the valley behind the mountain ridge. Two ways:
// the heavily guarded gate or the frozen river through the gorge (small outpost, defeat or bribe with
// Orrin). The weather works stands on an island in the lake. If it is destroyed, it thaws after 60 seconds –
// then Nelia and Orrin must stand on firm valley floor, not on the ice and not on the island.

import { t, say } from './common.js';
import { WATER } from '../../map.js';
import { toTile } from '../../fixed.js';

/** Seconds between the destruction of the weather works and the thaw. */
export const THAW_AFTER = 60;

/** Where does a hero stand at the thaw? 'ice' (water tile), 'island' (island) or 'firm'. */
export function footing(sim, m, h) {
  const x = toTile(h.px), y = toTile(h.py), isle = m.state.refs.isle;
  if (sim.map.flags[sim.map.idx(x, y)] & WATER) return 'ice';
  if (isle && (x - isle.x) ** 2 + (y - isle.y) ** 2 <= (isle.r + 1) ** 2) return 'island';
  return 'firm';
}

/** Thaw: check heroes (defeat if one stands on the ice or the island), then it thaws. */
function thaw(sim, m) {
  for (const id of m.idsOf('heroes')) {
    const h = sim.entities.get(id);
    if (!h) continue;
    const where = footing(sim, m, h);
    if (where !== 'firm') { m.finish(sim, false, where); return; }
  }
  sim.setWeather('summer', 3600 * 10);
}

export default {
  id: 'c3',
  order: 3,
  seed: 3303,
  size: 96,
  title: t('Das Wetterwerk', 'The Weatherworks'),
  summary: t('Dring ohne Burg ins Tal hinter dem Bergkamm ein, zerstöre das Wetterwerk und rette dich vor dem Tauwetter.', 'Enter the valley beyond the ridge without a castle, destroy the weatherworks and escape the thaw.'),
  briefing: t(
    'Hinter Hagenfurt schließt ein Bergkamm ein Tal ab. Dort liegen die Ruinen aus Hrimgars Zeit. Hrimgar war der Kriegsherr, der vor Jahrhunderten mit endlosem Winter das Land aushungerte. Sein Wetterwerk auf der Insel im See läuft wieder. Ins Tal führen zwei Wege: das Tor, das Malvors Leute bewachen, und der zugefrorene Fluss durch die Schlucht. Nelia, Orrin und eine Handvoll Freiwilliger haben keine Burg und keinen Nachschub – nur 400 Taler in Orrins Börse.',
    'Beyond Hagenfurt, a mountain ridge closes off a valley. The ruins from Hrimgar’s time lie there. Hrimgar was the warlord who starved the land with endless winter centuries ago. His weatherworks on the island in the lake is running again. Two ways lead into the valley: the gate guarded by Malvor’s men, and the frozen river through the gorge. Nelia, Orrin and a handful of volunteers have no castle and no supplies – only 400 thalers in Orrin’s purse.',
  ),
  victoryText: t('Das Wetterwerk ist zerstört. Über den Bergen reißt der Himmel auf.', 'The weatherworks is destroyed. Above the mountains, the sky breaks open.'),
  debrief: t(
    'Zum ersten Mal seit Jahren tropft es von den Dächern. Der Frühling kommt. In Nelias Tasche knistern die Bruchstücke von Hrimgars Bauplänen. Von den Wachen am Wetterwerk wissen sie jetzt auch: Malvor trägt selbst eine Zacke, an einer Kette um den Hals. In Hagenfurt erfährt Malvor, wer ihm den Winter genommen hat.',
    'For the first time in years, water drips from the roofs. Spring is coming. In Nelia’s bag rustle the fragments of Hrimgar’s plans. From the guards at the weatherworks they now know something else: Malvor wears a shard himself, on a chain around his neck. In Hagenfurt, Malvor learns who took his winter.',
  ),
  defeatText: t('Die Gruppe ist gescheitert.', 'The group has failed.'),
  defeatTexts: {
    heroes: t('Nelia und Orrin sind gefallen. Der Winter bleibt.', 'Nelia and Orrin have fallen. The winter stays.'),
    ice: t('Das Eis ist gebrochen – mitten auf dem See. Der Winter hat sich gerächt.', 'The ice broke – in the middle of the lake. The winter took its revenge.'),
    island: t('Das Eis ist geschmolzen. Auf der Insel sitzen Nelia und Orrin fest, bis Malvors Leute kommen.', 'The ice has melted. Nelia and Orrin are stranded on the island until Malvor’s men arrive.'),
  },
  next: 'c4',
  weatherCycle: [['winter', 36000]],
  noHqDefeat: true,
  players: [
    { kind: 'human', heroes: ['nelia', 'orrin'], hq: false, stock: { gold: 400, clay: 0, wood: 0, stone: 0, iron: 0, sulfur: 0 } },
    { kind: 'bandits', look: 'soldiers' },
  ],

  setup(ctx) {
    const { sim, api } = ctx;
    const start = sim.starts[ctx.human];
    const W = sim.map.width, H = sim.map.height;
    // Landscape: axis from the start spot to the opposite corner; in front the mountain ridge, behind it the valley,
    // at the very back the mountains
    const ax = api.axis(start, { x: W - 1 - start.x, y: H - 1 - start.y });
    api.soften(sim, { sites: true });
    const front = api.ridge(sim, ax, 20, 7);
    api.ridge(sim, ax, 72, 200, { wobble: 3 });
    const gate = api.ridgeGap(sim, front, 24, { width: 4 });
    const gorge = api.ridgeGap(sim, front, -22, { width: 3, water: true });
    // The river comes from the map edge, runs through the gorge and flows into the lake
    const lake = ax.at(50, 0);
    const isle = api.lakeIsland(sim, lake, { inner: 6, width: 4 });
    api.channel(sim, ax.at(-30, -22), gorge.near);
    api.channel(sim, gorge.far, api.toward(lake, gorge.far, 8));
    ctx.ref('isle', isle);
    ctx.ref('gate', { ...gate.center, r: 3 });
    ctx.ref('gorge', { ...gorge.center, r: 3 });
    ctx.ref('gorgeNear', gorge.near);
    ctx.ref('gorgeFar', gorge.far);

    // The volunteers
    const squad = [];
    for (const [def, s, dx] of [['sword1', 3, -2], ['sword1', 3, 2], ['bow1', 3, 0]]) {
      const L = api.spawnTroop(sim, ctx.human, def, { x: start.x + dx, y: start.y + 3 }, s);
      if (L) squad.push(L.id);
    }
    ctx.ref('squad', squad);
    ctx.ref('heroes', [ctx.ref('nelia'), ctx.ref('orrin')]);

    // Weather works on the island, the guard next to it
    api.clearNodes(sim, isle.x, isle.y, isle.r + 1);
    const ww = api.placeBuilding(sim, ctx.bandits, 'weatherPlant', isle, { minR: 0, radius: 3, margin: 0 });
    if (ww) {
      ctx.ref('weatherworks', ww.id);
      ctx.camp('worksCamp', isle, [{ def: 'sword1', count: 2, soldiers: 4 }, { def: 'bow1', count: 1, soldiers: 4 }], { anchor: ww.id, r: 8 });
    } else ctx.warn('Weather plant cannot be placed');
    // The gate: strong guard and a ballista tower behind the pass
    ctx.camp('gateCamp', api.toward(gate.far, lake, 3), [
      { def: 'sword1', count: 2, soldiers: 4 }, { def: 'spear1', count: 2, soldiers: 4 }, { def: 'bow1', count: 1, soldiers: 4 },
    ], { r: 8 });
    const tower = api.placeBuilding(sim, ctx.bandits, 'tower', gate.far, { minR: 2, radius: 6, level: 1 });
    if (tower) ctx.ref('gateTower', tower.id);
    // The outpost at the gorge: small, but a fight costs people; it guards the frozen river itself (onIce)
    const bank = ax.at(ax.p(gorge.far.x, gorge.far.y) + 2, -22 + 5);
    ctx.camp('ford', bank, [{ def: 'spear1', count: 1, soldiers: 3 }, { def: 'bow1', count: 1, soldiers: 4 }], { r: 6, maxR: 6, onIce: true });
    // Prisoners in a camp at the valley edge
    ctx.camp('prison', ax.at(54, 28), [{ def: 'sword1', count: 1, soldiers: 3 }, { def: 'spear1', count: 1, soldiers: 3 }], { r: 6 });
    // Hrimgar's ruins on the other valley edge: blueprint fragments
    const ruins = api.findOpen(sim, ...Object.values(ax.at(62, -24)), { maxR: 6, clear: 2 }) ?? ax.at(62, -24);
    ctx.ref('ruinsArea', { x: ruins.x, y: ruins.y, r: 3 });
    // Firm bank on the way to the ruins (goal of the escape from the thaw)
    const landing = api.toward(isle, ruins, isle.r + 11);
    ctx.ref('landing', { ...(api.findOpen(sim, landing.x, landing.y, { maxR: 4, frozen: false }) ?? landing), r: 3 });
    for (const [type, d] of [['tower', 4], ['residence', 6], ['chapel', 7]]) api.addRuin(sim, type, api.toward(ruins, lake, -d), { radius: 5 });
    api.plantTrees(sim, api.toward(ruins, start, -6), 14, 5);
    ctx.ref('valley', { ...ax.at(46, 14), r: 4 });
  },

  start: [
    say('orrin', 'Kein Dach, kein Feuer, kein Markt. Ich hasse Abenteuer.', 'No roof, no fire, no market. I hate adventures.'),
    say('nelia', 'Hinter dem Kamm liegt das Tal. Das Tor ist zu stark für uns. Aber der Fluss ist zugefroren …', 'Beyond the ridge lies the valley. The gate is too strong for us. But the river is frozen …'),
    { type: 'reveal', area: 'gate', seconds: 20 },
    { type: 'camera', at: 'gate' },
    say('orrin', 'Und an der Schlucht steht sicher auch jemand. Schau mit deinem Weitblick nach, bevor wir hineinlaufen.', 'And surely someone stands guard at the gorge too. Use your farsight before we walk in.'),
  ],

  objectives: [
    { id: 'works', type: 'destroy', ref: 'weatherworks', primary: true, text: t('Zerstöre das Wetterwerk auf der Insel', 'Destroy the weatherworks on the island'),
      onDone: [{ type: 'reveal', id: 'escape' }] },
    { id: 'escape', type: 'survive', seconds: THAW_AFTER, primary: true, hidden: true,
      text: t('Tauwetter! Bring Nelia und Orrin auf festen Talboden – runter vom Eis und von der Insel', 'Thaw! Get Nelia and Orrin onto firm valley ground – off the ice and off the island'),
      onDone: [thaw] },
    { id: 'plans', type: 'reach', area: 'ruinsArea', who: 'hero', primary: true, text: t('Sichere Hrimgars Bauplan-Bruchstücke in den Ruinen am Talrand', 'Secure Hrimgar’s plan fragments in the ruins at the valley edge'),
      onDone: [
        { type: 'flag', name: 'plans' },
        say('orrin', 'Zeichnungen von Türmen, Röhren, Zahlen … das ist mehr wert als mein ganzer Karren.', 'Drawings of towers, pipes, numbers … this is worth more than my whole cart.'),
        say('nelia', 'Dann pass gut darauf auf. Vielleicht brauchen wir sie noch.', 'Then take good care of them. We might need them yet.'),
      ] },
    { id: 'heroes', type: 'protect', ref: 'heroes', primary: true, text: t('Nelia und Orrin dürfen nicht beide fallen', 'Nelia and Orrin must not both fall') },
    { id: 'prisoners', type: 'destroy', ref: 'prisonGuards', text: t('Optional: Befreie die Gefangenen im Lager am Talrand', 'Optional: Free the prisoners in the camp at the valley edge'),
      onDone: [
        say('villager', 'Ihr seid die Leute aus Lindgrund? Wir kämpfen mit euch!', 'You are the people from Lindgrund? We’ll fight with you!'),
        { type: 'spawn', owner: 'human', at: 'prisonArea', units: [{ def: 'spear1', count: 2, soldiers: 3 }] },
      ] },
  ],

  events: [
    { id: 'gorgeSeen', when: { type: 'area', area: 'gorge', who: 'army' }, do: [
      say('orrin', 'Nur zwei Trupps am Ausgang der Schlucht. Für 350 Taler wechselt einer davon die Seiten – glaub mir.', 'Only two squads at the end of the gorge. For 350 thalers one of them will switch sides – trust me.'),
    ] },
    { id: 'gateSeen', when: { type: 'area', area: 'gate', who: 'army' }, do: [
      say('nelia', 'Ein Turm und fünf Trupps. Wenn wir hier durchwollen, brauchen wir Mut – viel Mut.', 'A tower and five squads. If we want through here, we need courage – a lot of courage.'),
    ] },
    { id: 'valley', when: { type: 'area', area: 'valley', who: 'army' }, do: [
      { type: 'reveal', area: 'isle', seconds: 30 },
      say('nelia', 'Da ist es, mitten im See. Das Eis trägt uns hin – Hrimgars Winter bringt uns zu seinem eigenen Werk.', 'There it is, in the middle of the lake. The ice will carry us – Hrimgar’s winter brings us to his own works.'),
    ] },
    { id: 'alarm', when: { type: 'area', area: 'isle', who: 'army' }, do: [
      say('collector', 'Alarm! Eindringlinge am Werk! Wache vom Tor, zum See!', 'Alarm! Intruders at the works! Gate guard, to the lake!'),
      { type: 'spawn', owner: 'bandits', at: 'gateCampArea', units: [{ def: 'sword1', count: 2, soldiers: 4 }, { def: 'bow1', count: 1, soldiers: 3 }], order: 'attackMove', target: 'isle' },
    ] },
    { id: 'worksDown', when: { type: 'objective', id: 'works' }, do: [
      say('nelia', 'Es ist still. Hörst du? Das Brummen ist weg … und das Eis knackt.', 'It’s quiet. Hear that? The humming is gone … and the ice is cracking.'),
      say('orrin', `Runter vom See! In einer Minute ist das hier Wasser!`, 'Off the lake! In a minute this will all be water!'),
    ] },
    { id: 'cutOff', when: { type: 'delay', after: 'worksDown', seconds: 5 }, do: [
      say('collector', 'Das Werk brennt! Fangt sie am Ufer ab, bevor sie entkommen!', 'The works is burning! Catch them at the shore before they escape!'),
      { type: 'spawn', owner: 'bandits', at: 'gateCampArea', units: [{ def: 'spear1', count: 2, soldiers: 3 }], order: 'attackMove', target: 'landing' },
    ] },
    { id: 'thawSoon', when: { type: 'delay', after: 'worksDown', seconds: THAW_AFTER - 15 }, do: [
      say('orrin', 'Das Eis wird grau! Lauf, Nelia!', 'The ice is turning grey! Run, Nelia!'),
    ] },
  ],

  onVictory: [{ type: 'weather', state: 'summer', seconds: 600 }],
};
