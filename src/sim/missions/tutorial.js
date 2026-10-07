// Mission 0: First steps – guided tutorial without defeat.
// Each step: text (desktop / touch), hint (UI element, entity or region),
// `done` = condition for automatic advancing; without `done` there is "Next".

const say = (text) => ({ type: 'dialog', speaker: 'orrin', text });

/** Remember an own building of a type as a reference (for hints). */
const refOwn = (type, name) => (sim, m) => {
  for (const e of sim.entities.values()) {
    if (e.kind === 'building' && e.owner === m.human && e.type === type) { m.state.refs[name] = e.id; return; }
  }
};

export default {
  id: 'tutorial',
  order: 0,
  seed: 4242,
  size: 96,
  title: { de: 'Erste Schritte', en: 'First Steps' },
  summary: {
    de: 'Der Händler Orrin zeigt Nelia, wie ein Dorf wächst: Leibeigene, Bauen, Arbeiter, Forschung und ein erstes Gefecht.',
    en: 'The merchant Orrin shows Nelia how a village grows: serfs, building, workers, research and a first skirmish.',
  },
  briefing: {
    de: 'Willkommen in Kronland! Dieses Tal gehört jetzt dir und Nelia. Orrin, ein wandernder Händler, führt dich Schritt für Schritt. Du kannst nichts falsch machen.',
    en: 'Welcome to Kronland! This valley now belongs to you and Nelia. Orrin, a travelling merchant, guides you step by step. You cannot fail here.',
  },
  victoryText: {
    de: 'Das Dorf steht, die Räuber sind vertrieben. Du bist bereit für die Kampagne.',
    en: 'The village stands and the bandits are gone. You are ready for the campaign.',
  },
  defeatText: { de: 'Das Tutorial wurde beendet.', en: 'The tutorial has ended.' },
  noDefeat: true,
  next: 'c1',
  // Fog of war on, but generous: the whole valley around the castle is explored from the start
  vision: { startReveal: 34 },
  players: [
    { kind: 'human', hero: 'nelia', stock: { gold: 1200, clay: 2400, wood: 2400, stone: 1200, iron: 200, sulfur: 100 } },
    { kind: 'bandits' },
  ],

  setup(ctx) {
    const { sim, api: a } = ctx;
    const hq = ctx.hqCenter();
    // Ensure learning material near the castle: trees, a clay pile, a clay shaft
    a.plantTrees(sim, a.toward(hq, ctx.mapCenter(), 9), 8, 3);
    const tree = [...sim.entities.values()].filter((e) => e.kind === 'tree')
      .sort((p, q) => a.dist(p, hq) - a.dist(q, hq) || p.id - q.id)[0];
    ctx.ref('tutTree', tree?.id);
    let pile = [...sim.entities.values()].filter((e) => e.kind === 'pile' && e.res === 'clay')
      .sort((p, q) => a.dist(p, hq) - a.dist(q, hq) || p.id - q.id)[0];
    if (!pile || a.dist(pile, hq) > 14) pile = a.addPile(sim, 'clay', a.toward(hq, ctx.mapCenter(), 7));
    ctx.ref('tutPile', pile?.id);
    const shaft = a.ensureShaft(sim, 'clay', hq, 22);
    if (shaft) ctx.ref('tutShaft', { x: shaft.x + 1, y: shaft.y + 1, r: 2 });
    // Room for the bandits: within reach, but out of sight
    const far = a.toward(hq, ctx.mapCenter(), 16);
    const spot = a.findOpen(sim, far.x, far.y, { maxR: 10, clear: 2, from: hq });
    ctx.ref('tutBanditSpot', spot ? { ...spot, r: 3 } : { ...hq, r: 3 });
  },

  objectives: [],
  events: [],

  tutorial: [
    {
      id: 'welcome',
      title: { de: 'Willkommen', en: 'Welcome' },
      text: {
        de: 'Orrin mein Name, Händler und Kenner aller Preise. Oben siehst du deine Rohstoffe. Lass uns ein Dorf gründen!',
        en: 'Orrin is the name, merchant and connoisseur of every price. Your resources are shown at the top. Let us found a village!',
      },
      hint: { ui: 'topbar' },
    },
    {
      id: 'camera',
      title: { de: 'Umsehen', en: 'Look around' },
      text: {
        de: 'Bewege die Kamera: WASD oder mittlere Maustaste ziehen, Q/E dreht, das Mausrad zoomt.',
        en: 'Move the camera: WASD or drag with the middle mouse button, Q/E rotates, the mouse wheel zooms.',
      },
      touch: {
        de: 'Ziehe mit einem Finger, um die Karte zu verschieben. Mit zwei Fingern drehst und zoomst du.',
        en: 'Drag with one finger to move the map. Use two fingers to rotate and zoom.',
      },
      done: { type: 'ui', check: 'camera' },
      allowNext: true,
    },
    {
      id: 'select',
      title: { de: 'Leibeigene', en: 'Serfs' },
      text: {
        de: 'Leibeigene sind deine Arbeitskräfte. Ziehe einen Rahmen um sie oder klicke auf „Alle“.',
        en: 'Serfs are your labourers. Drag a box around them or click “All”.',
      },
      touch: { de: 'Leibeigene sind deine Arbeitskräfte. Tippe auf „Alle“.', en: 'Serfs are your labourers. Tap “All”.' },
      hint: { ui: 'quick-all' },
      done: { type: 'ui', check: 'selectSerfs' },
    },
    {
      id: 'wood',
      title: { de: 'Holz schlagen', en: 'Chop wood' },
      text: {
        de: 'Holz brauchst du für fast alles. Rechtsklicke mit ausgewählten Leibeigenen auf einen Baum.',
        en: 'You need wood for almost everything. Right-click a tree while serfs are selected.',
      },
      touch: { de: 'Holz brauchst du für fast alles. Tippe mit ausgewählten Leibeigenen auf einen Baum.', en: 'You need wood for almost everything. With serfs selected, tap a tree.' },
      hint: { entity: 'tutTree' },
      onEnter: [{ type: 'camera', at: 'tutTree' }],
      done: { type: 'job', res: 'wood' },
    },
    {
      id: 'pile',
      title: { de: 'Lehm abbauen', en: 'Dig clay' },
      text: {
        de: 'Rohstoffhaufen liefern Lehm, Stein, Eisen oder Schwefel. Schicke einen Leibeigenen zum Lehmhaufen.',
        en: 'Resource piles yield clay, stone, iron or sulfur. Send a serf to the clay pile.',
      },
      hint: { entity: 'tutPile' },
      onEnter: [{ type: 'camera', at: 'tutPile' }],
      done: { type: 'job', res: ['clay', 'stone', 'iron', 'sulfur'] },
    },
    {
      id: 'residence',
      title: { de: 'Wohnhaus', en: 'Residence' },
      text: {
        de: 'Arbeiter wollen schlafen. Wähle Leibeigene, dann im Baumenü „Wohnhaus“ und klicke auf freien Boden.',
        en: 'Workers need a bed. Select serfs, pick “Residence” in the build menu and click on open ground.',
      },
      touch: { de: 'Arbeiter wollen schlafen. Wähle Leibeigene, tippe „Bauen …“, dann „Wohnhaus“ und den Bauplatz.', en: 'Workers need a bed. Select serfs, tap “Build …”, then “Residence” and the spot.' },
      hint: { ui: ['build-residence', 'quick-all'] },
      done: { type: 'built', building: 'residence', placed: true },
    },
    {
      id: 'farm',
      title: { de: 'Bauernhof', en: 'Farm' },
      text: {
        de: 'Und sie wollen essen. Baue einen Bauernhof – am besten nah am Wohnhaus.',
        en: 'And they want to eat. Build a farm – ideally close to the residence.',
      },
      hint: { ui: ['build-farm', 'quick-all'] },
      done: { type: 'built', building: 'farm', placed: true },
    },
    {
      id: 'workers',
      title: { de: 'Arbeiter ziehen ein', en: 'Workers arrive' },
      text: {
        de: 'Arbeiter kommen von selbst aus dem Dorfzentrum, sobald eine Werkstatt frei ist. Ohne Bett und Essen arbeiten sie langsam und werden unzufrieden. Warte, bis der Hof fertig ist.',
        en: 'Workers come from the village centre by themselves once a workplace is free. Without bed and food they work slowly and grow unhappy. Wait until the farm is finished.',
      },
      hint: { entity: 'farm' },
      onEnter: [refOwn('farm', 'farm')],
      done: { type: 'workers', count: 1 },
      allowNext: true,
    },
    {
      id: 'mine',
      title: { de: 'Lehmgrube', en: 'Clay pit' },
      text: {
        de: 'Haufen sind bald leer. Schächte nicht: Baue eine Lehmgrube auf dem markierten Schacht. Dort arbeiten Bergleute.',
        en: 'Piles run dry, shafts do not: build a clay pit on the marked shaft. Miners will work there.',
      },
      hint: { ui: ['build-clayMine', 'quick-all'], area: 'tutShaft' },
      onEnter: [{ type: 'camera', at: 'tutShaft' }],
      done: { type: 'built', building: 'clayMine', placed: true },
    },
    {
      id: 'refiner',
      title: { de: 'Ziegelhütte', en: 'Brickworks' },
      text: {
        de: 'Rohware wird veredelt. Die Baupläne der Ziegelhütte sind eingetroffen – baue sie. Ziegelbrenner machen aus Lehm doppelt so viel Baustoff.',
        en: 'Raw goods get refined. The brickworks plans have arrived – build one. Brickmakers turn clay into twice as much material.',
      },
      hint: { ui: ['build-brickworks', 'quick-all'] },
      onEnter: [{ type: 'give', techs: ['construction'] }],
      done: { type: 'built', building: 'brickworks', placed: true },
    },
    {
      id: 'serfs',
      title: { de: 'Mehr Hände', en: 'More hands' },
      text: {
        de: 'Mehr Leibeigene bauen schneller. Wähle die Burg und kaufe einen Leibeigenen für 50 Taler.',
        en: 'More serfs build faster. Select the castle and buy a serf for 50 thalers.',
      },
      hint: { ui: ['quick-hq', 'buy-serf'], entity: 'hq' },
      done: { type: 'event', event: 'serfBought' },
    },
    {
      id: 'research',
      title: { de: 'Hochschule', en: 'College' },
      text: {
        de: 'Die Gelehrten haben dir eine Hochschule gebaut. Wähle sie und erforsche „Bildung“.',
        en: 'The scholars have built you a college. Select it and research “Education”.',
      },
      hint: { ui: 'tech-education', entity: 'uni' },
      onEnter: [{ type: 'build', building: 'university', ref: 'uni', minR: 6 }, { type: 'camera', at: 'uni' }],
      done: { type: 'event', event: 'researchStarted' },
    },
    {
      id: 'taxes',
      title: { de: 'Zahltag', en: 'Payday' },
      text: {
        de: 'Alle zwei Minuten ist Zahltag: Arbeiter zahlen Steuern, Hauptleute wollen Sold. Mit „Bildung“ stellst du in der Burg die Steuern ein – hohe Steuern drücken die Motivation.',
        en: 'Every two minutes is payday: workers pay taxes, captains want wages. With “Education” you set taxes in the castle – high taxes lower motivation.',
      },
      hint: { ui: 'payday' },
    },
    {
      id: 'upgrade',
      title: { de: 'Ausbauen', en: 'Upgrade' },
      text: {
        de: 'Gebäude lassen sich ausbauen. Wähle dein fertiges Wohnhaus und baue es aus – mehr Betten! Der Ausbau läuft von selbst, ohne Leibeigene.',
        en: 'Buildings can be upgraded. Select your finished residence and upgrade it – more beds! The upgrade runs on its own, no serfs needed.',
      },
      hint: { ui: 'upgrade', entity: 'home' },
      onEnter: [refOwn('residence', 'home')],
      done: { type: 'event', event: 'upgradeStarted' },
      allowNext: true,
    },
    {
      id: 'recruit',
      title: { de: 'Soldaten', en: 'Soldiers' },
      text: {
        de: 'Räuber wurden gesichtet! Eine Kaserne steht bereit. Wähle sie und hebe eine volle Einheit Schwertkämpfer aus.',
        en: 'Bandits have been sighted! A barracks is ready. Select it and recruit a full unit of swordsmen.',
      },
      hint: { ui: 'recruit-full-sword', entity: 'barracks' },
      onEnter: [
        { type: 'give', techs: ['conscription'], res: { gold: 400, iron: 300 } },
        { type: 'build', building: 'barracks', ref: 'barracks', minR: 6 },
        { type: 'camera', at: 'barracks' },
      ],
      done: { type: 'event', event: 'recruited' },
    },
    {
      id: 'fight',
      title: { de: 'Erstes Gefecht', en: 'First skirmish' },
      text: {
        de: 'Da sind sie! Wähle deine Truppe und Nelia und rechtsklicke auf die Räuber.',
        en: 'There they are! Select your troop and Nelia, then right-click the bandits.',
      },
      touch: { de: 'Da sind sie! Wähle deine Truppe und Nelia und tippe auf die Räuber.', en: 'There they are! Select your troop and Nelia, then tap the bandits.' },
      hint: { entity: 'tutBandits' },
      onEnter: [
        { type: 'spawn', owner: 'bandits', ref: 'tutBandits', at: 'tutBanditSpot', units: [{ def: 'sword1', count: 1, soldiers: 2 }] },
        { type: 'dialog', speaker: 'bandit', text: { de: 'He, Bauer! Dein Holz gehört jetzt uns!', en: 'Hey, farmer! Your timber belongs to us now!' } },
        { type: 'reveal', area: 'tutBandits' },
        { type: 'camera', at: 'tutBandits' },
      ],
      done: { type: 'dead', ref: 'tutBandits' },
    },
    {
      id: 'ability',
      title: { de: 'Heldenkraft', en: 'Hero power' },
      text: {
        de: 'Helden haben besondere Fähigkeiten. Wähle Nelia und nutze „Mut machen“: Truppen in ihrer Nähe kämpfen eine Weile doppelt so stark.',
        en: 'Heroes have special abilities. Select Nelia and use “Rally”: troops near her fight twice as hard for a while.',
      },
      hint: { ui: 'ability-courage', entity: 'hero' },
      done: { type: 'event', event: 'ability' },
    },
    {
      id: 'end',
      title: { de: 'Geschafft', en: 'Well done' },
      text: {
        de: 'Hervorragend! Du kennst jetzt die Grundlagen. Die Kampagne wartet – und mit ihr ein langer Winter.',
        en: 'Excellent! You know the basics now. The campaign awaits – and with it a long winter.',
      },
      onEnter: [say({ de: 'Na bitte! Ich sage es ja immer: Mit dem richtigen Lehrer wird aus jedem Holzklotz ein Fürst.', en: 'There you go! I always say: with the right teacher, every blockhead becomes a lord.' })],
    },
  ],
};
