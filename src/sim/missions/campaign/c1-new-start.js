// Campaign 1: New Start – found a village and secure the supply.

import { t, say } from './common.js';

export default {
  id: 'c1',
  order: 1,
  seed: 1101,
  size: 96,
  title: t('Neubeginn im Erlengrund', 'A New Start in Aldervale'),
  summary: t('Gründe ein Dorf und sichere Brot und Betten für deine ersten Arbeiter.', 'Found a village and secure bread and beds for your first workers.'),
  briefing: t(
    'Der Krieg hat Kronland zerrissen. Fürst Morwald von Schwarzenfels hat die alte Königsstadt besetzt, und wer nicht fliehen konnte, dient ihm. Du hast mit einer Handvoll Getreuer den Erlengrund erreicht – ein stilles Tal, fern der Straßen. Hier soll Kronland neu beginnen. Aber Menschen kommen nur, wo es Betten, Brot und Arbeit gibt.',
    'War has torn Kronland apart. Prince Morwald of Blackcrag holds the old royal city, and those who could not flee now serve him. With a handful of loyal followers you have reached Aldervale – a quiet valley far from the roads. Here Kronland shall begin anew. But people only come where there are beds, bread and work.',
  ),
  victoryText: t('Rauch steigt aus den Schornsteinen, die Grube liefert Lehm. Der Erlengrund lebt.', 'Smoke rises from the chimneys and the pit yields clay. Aldervale is alive.'),
  debrief: t(
    'Ottilie zählt zufrieden die Vorräte. Doch Späherin Wendel bringt schlechte Kunde: Im Wald jenseits des Bachs lagern Räuber – Kunz der Rote, ein Söldner Morwalds.',
    'Ottilie counts the stores with satisfaction. But Scout Wendel brings bad news: bandits are camping in the woods beyond the brook – Kunz the Red, a mercenary of Morwald.',
  ),
  defeatText: t('Deine Burg ist gefallen. Der Erlengrund ist verloren.', 'Your castle has fallen. Aldervale is lost.'),
  next: 'c2',
  players: [
    { kind: 'human', hero: 'bertram', serfs: 6, stock: { gold: 600, clay: 1600, wood: 1500, stone: 400, iron: 0, sulfur: 0 } },
    { kind: 'bandits' },
  ],

  setup(ctx) {
    const { sim, api } = ctx;
    const hq = ctx.hqCenter();
    // A clay shaft must be within reach
    const shaft = api.ensureShaft(sim, 'clay', hq, 20);
    if (shaft) ctx.ref('clayShaft', { x: shaft.x + 1, y: shaft.y + 1, r: 2 });
    // Small bandit lookout towards the map centre
    const far = api.toward(hq, ctx.mapCenter(), 26);
    ctx.camp('lookout', far, [{ def: 'spear1', count: 1, soldiers: 2 }], { from: hq, avoid: [{ ...hq, r: 18 }] });
  },

  start: [
    say('ottilie', 'Willkommen im Erlengrund. Wir haben Holz, Lehm und sechs fleißige Hände. Zuerst brauchen wir Betten und Brot.',
      'Welcome to Aldervale. We have timber, clay and six willing hands. First we need beds and bread.'),
  ],

  objectives: [
    { id: 'homes', type: 'build', building: 'residence', count: 2, primary: true, text: t('Baue 2 Wohnhäuser', 'Build 2 residences') },
    { id: 'farms', type: 'build', building: 'farm', count: 2, primary: true, text: t('Baue 2 Bauernhöfe', 'Build 2 farms') },
    { id: 'pit', type: 'build', building: 'clayMine', primary: true, text: t('Baue eine Lehmgrube am Schacht', 'Build a clay pit on the shaft') },
    { id: 'workers', type: 'workers', count: 6, primary: true, text: t('Gewinne 6 Arbeiter', 'Attract 6 workers') },
    { id: 'lookout', type: 'destroy', ref: 'lookout', hidden: true, text: t('Optional: Zerstöre den Räuberposten', 'Optional: Destroy the bandit lookout'),
      onDone: [{ type: 'give', res: { gold: 300 } }, say('bertram', 'Der Posten brennt. 300 Taler lagen in der Truhe – Raubgut, jetzt unser.', 'The lookout burns. 300 thalers were in the chest – stolen goods, ours now.')] },
  ],

  events: [
    { id: 'homesDone', when: { type: 'objective', id: 'homes' }, do: [say('ottilie', 'Betten stehen. Jetzt fehlt nur noch etwas auf den Tellern.', 'Beds are ready. Now we only need something on the plates.')] },
    { id: 'scout', when: { type: 'time', at: 90 }, do: [
      say('scout', 'Herrin, Herr – östlich im Wald steht ein Räuberposten. Nur ein paar Speerträger, aber sie beobachten uns.', 'My liege – there is a bandit lookout in the eastern woods. Only a few spearmen, but they are watching us.'),
      { type: 'reveal', id: 'lookout' },
      { type: 'camera', at: 'lookoutArea' },
    ] },
    { id: 'firstWorker', when: { type: 'workers', count: 1 }, do: [say('ottilie', 'Der erste Arbeiter ist da! Wo er gut schläft und isst, folgen andere.', 'Our first worker has arrived! Where he sleeps and eats well, others will follow.')] },
  ],
};
