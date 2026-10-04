// Campaign 3: The Ford at Grauer Bach – second settlement, population and research.

import { t, say, farSpot } from './common.js';

export default {
  id: 'c3',
  order: 3,
  seed: 3303,
  size: 96,
  title: t('Die Furt am Grauen Bach', 'The Ford at Grey Brook'),
  summary: t('Gründe eine zweite Siedlung jenseits der Furt, lass das Volk wachsen und forsche.', 'Found a second settlement beyond the ford, grow your people and research.'),
  briefing: t(
    'Jenseits der Furt am Grauen Bach liegt gutes Land. Ein Siedlungsplatz wartet dort – doch Räuber halten die Furt, und Baron Gisbert, Morwalds Vasall, beobachtet jede Bewegung von seiner Burg aus. Noch hält er still. Wachse schnell, gründe die Siedlung und lass deine Gelehrten forschen, bevor Gisbert begreift, was du vorhast.',
    'Beyond the ford at Grey Brook lies good land. A settlement site waits there – but bandits hold the ford, and Baron Gisbert, Morwald\'s vassal, watches every move from his castle. For now he keeps still. Grow fast, found the settlement and let your scholars research before Gisbert realises what you are up to.',
  ),
  victoryText: t('Zwei Dörfer, ein Volk. Kronland wächst wieder.', 'Two villages, one people. Kronland is growing again.'),
  debrief: t(
    'Gisberts Reiter ziehen sich zurück. Ein Bote berichtet: Im Norden, auf einer Insel im Spiegelsee, hält Morwald eine Kräuterkundige gefangen – Hedda, die einst den alten König heilte. Der Winter naht, und mit ihm das Eis.',
    'Gisbert\'s riders withdraw. A messenger reports: in the north, on an island in Mirror Lake, Morwald holds a herbalist prisoner – Hedda, who once healed the old king. Winter is coming, and with it the ice.',
  ),
  defeatText: t('Deine Burg ist gefallen.', 'Your castle has fallen.'),
  next: 'c4',
  players: [
    {
      kind: 'human', hero: 'bertram', serfs: 10, techs: ['conscription'],
      stock: { gold: 1200, clay: 2200, wood: 2400, stone: 1000, iron: 400, sulfur: 200 },
    },
    { kind: 'ai', hero: 'gerold', difficulty: 'easy', aggression: 'passive', forbid: ['foundry', 'stable'] },
    { kind: 'bandits' },
  ],

  setup(ctx) {
    const { sim, api } = ctx;
    const hq = ctx.hqCenter();
    // Second settlement spot: take an existing one or create a new one
    let spot = farSpot(ctx, 16, 42);
    if (!spot) spot = api.addSpot(sim, api.toward(hq, ctx.mapCenter(), 26), { maxR: 12 });
    if (!spot) { ctx.warn('Kein zweiter Siedlungsplatz'); return; }
    ctx.ref('spot', { x: spot.x + 2, y: spot.y + 2, r: 4 });
    // Bandits at the ford (between castle and spot)
    const ford = api.toward(hq, spot, Math.max(8, api.dist(hq, spot) - 8));
    ctx.camp('ford', ford, [{ def: 'spear1', count: 2, soldiers: 3 }, { def: 'bow1', count: 1, soldiers: 2 }],
      { from: hq, maxR: 8, avoid: [{ ...hq, r: 12 }, { x: spot.x + 2, y: spot.y + 2, r: 5 }] });
    // Stone pile as a reward next to the spot
    api.addPile(sim, 'stone', { x: spot.x + 6, y: spot.y + 2 });
    api.addPile(sim, 'iron', { x: spot.x - 2, y: spot.y + 6 });
  },

  start: [
    say('ottilie', 'Unser Dorfzentrum ist voll. Für mehr Menschen brauchen wir ein zweites – auf dem Platz jenseits der Furt.', 'Our village centre is full. For more people we need a second one – on the site beyond the ford.'),
    { type: 'reveal', area: 'spot' },
    { type: 'camera', at: 'spot' },
  ],

  objectives: [
    { id: 'settle', type: 'build', building: 'villageCenter', count: 2, primary: true, text: t('Baue ein Dorfzentrum auf dem zweiten Siedlungsplatz', 'Build a village centre on the second settlement site') },
    { id: 'people', type: 'workers', count: 40, primary: true, text: t('Erreiche 40 Arbeiter', 'Reach 40 workers') },
    { id: 'science', type: 'research', techs: ['education', 'construction', 'alchemy'], primary: true, text: t('Erforsche Bildung, Konstruktion und Alchimie', 'Research Education, Construction and Alchemy') },
    { id: 'ford', type: 'destroy', ref: 'ford', text: t('Optional: Vertreibe die Räuber an der Furt', 'Optional: Drive the bandits from the ford'),
      onDone: [{ type: 'give', res: { stone: 300, iron: 200 } }, say('bertram', 'Die Furt ist frei. In ihrem Lager lagen Stein und Eisen.', 'The ford is clear. Their camp held stone and iron.')] },
    { id: 'mood', type: 'motivation', value: 110, text: t('Optional: Hebe die Motivation auf 110 %', 'Optional: Raise motivation to 110 %'),
      onDone: [{ type: 'give', res: { gold: 400 } }] },
  ],

  events: [
    { id: 'gisbertWakes', when: { type: 'built', building: 'villageCenter', count: 2, placed: true }, do: [
      say('scout', 'Gisberts Späher haben die Baustelle gesehen. Er rüstet!', 'Gisbert\'s scouts have seen the building site. He is arming!'),
      { type: 'ai', player: 'enemy', aggression: 'normal', difficulty: 'normal' },
    ] },
    { id: 'gisbertAttack', when: { type: 'delay', after: 'gisbertWakes', seconds: 240 }, do: [
      say('scout', 'Gisbert greift an! Halte die neue Siedlung.', 'Gisbert attacks! Hold the new settlement.'),
      // Gisberts Hauswache zieht in jedem Fall los, dazu alles, was seine Kaserne hergibt
      { type: 'spawn', owner: 'enemy', at: 'enemyHq', units: [{ def: 'sword1', count: 4, soldiers: 4 }, { def: 'spear1', count: 2, soldiers: 4 }, { def: 'bow1', count: 2, soldiers: 4 }], order: 'attackMove', target: 'spot', ref: 'gisbertRaid' },
      { type: 'ai', player: 'enemy', attackNow: true },
      { type: 'reveal', area: 'spot' },
      { type: 'camera', at: 'spot' },
    ] },
    { id: 'eduTip', when: { type: 'tech', tech: 'education' }, do: [
      say('ottilie', 'Mit Bildung können wir die Steuern selbst festlegen. Niedrige Steuern machen die Leute froh.', 'With Education we can set taxes ourselves. Low taxes make people happy.'),
    ] },
  ],
};
