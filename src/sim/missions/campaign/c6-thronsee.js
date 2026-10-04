// Campaign "Krone aus Eis", mission 6: Thronsee – Malvor sits in the island castle. Research up to the
// weather plant (or buy knowledge via Orrin), freeze the lake, attack over the ice.
// Malvor has a weather plant of his own on a small works island in front of the castle and follows the same
// rules: it charges energy (like three weather technicians), with a full charge he thaws the lake as soon as our people stand on
// the ice – afterwards he has to recharge and wait. From the bank archers and cannons hit the
// plant; in summer nobody gets there to repair it.
// Orrin is mortally wounded in the assault on the island (fixed scene).

import { t, say } from './common.js';
import { BUILDINGS } from '../../data/buildings.js';
import { PROFESSIONS } from '../../data/professions.js';
import { WATER } from '../../map.js';
import { toTile } from '../../fixed.js';
import { addWeatherEnergy, checkWeatherChange } from '../../systems/weather.js';

/** Malvor's plant charges like three weather technicians: energy per 5 seconds. */
export const MALVOR_CHARGE = 3 * PROFESSIONS.weatherman.yield * (50 / PROFESSIONS.weatherman.cycle);

/** Malvor's weather plant (or null if destroyed). */
const malvorPlant = (sim, m) => sim.entities.get(m.state.refs.malvorPlant) ?? null;

/** Do the player's people (troops, heroes, serfs) stand on the frozen Thronsee or around the works island? */
export function onIce(sim, m) {
  const { isle, worksIsle } = m.state.refs;
  if (!sim.map.frozen || !isle) return false;
  const me = m.state.human;
  const near = (x, y, c, r) => !!c && (x - c.x) ** 2 + (y - c.y) ** 2 <= r * r;
  for (const e of sim.entities.values()) {
    if (e.owner !== me || !(e.kind === 'leader' || e.kind === 'soldier' || e.kind === 'unit' || (e.kind === 'hero' && !e.down))) continue;
    const x = toTile(e.px), y = toTile(e.py);
    if (!(sim.map.flags[sim.map.idx(x, y)] & WATER)) continue;
    if (near(x, y, isle, isle.r + 7) || near(x, y, worksIsle, worksIsle?.r + 6)) return true;
  }
  return false;
}

/** Malvor thaws the lake – via the same command as a player, with energy and waiting time. */
function malvorThaws(sim, m) {
  const plant = malvorPlant(sim, m);
  sim.applyCommand({ type: 'changeWeather', player: m.playerOf('enemy'), building: plant.id, state: 'summer' });
}

/** Orrin is carried off the ice wounded: unconscious, then removed from the game (fixed story scene). */
function orrinFalls(sim, m) {
  const o = sim.entities.get(m.state.refs.orrin);
  if (o) sim.entities.delete(o.id);
  m.state.flags.orrinWounded = true;
}

export default {
  id: 'c6',
  order: 6,
  seed: 6606,
  size: 112,
  title: t('Der Thronsee', 'The Throne Lake'),
  summary: t('Lass den Thronsee zufrieren und stürme Malvors Inselschloss über das Eis.', 'Freeze the Throne Lake and storm Malvor’s island castle across the ice.'),
  briefing: t(
    'Malvor hat sich im Inselschloss verschanzt, mitten im Thronsee. Kein Boot kommt dort an, keine Brücke führt hinüber. Nelia hat Hrimgars Bauplan-Bruchstücke. Mit ihnen kann sie selbst einen Wetterturm bauen und den See zufrieren lassen. Aber Malvor kennt die Technik auch.',
    'Malvor has entrenched himself in the island castle in the middle of the Throne Lake. No boat can reach it, no bridge leads across. Nelia has Hrimgar’s plan fragments. With them she can build a weather tower of her own and make the lake freeze. But Malvor knows the technique too.',
  ),
  victoryText: t('Malvor ist gefallen. Die fünf Zacken sind vereint.', 'Malvor has fallen. The five shards are united.'),
  debrief: t(
    'Die Provinzen krönen Nelia zur ersten Königin des Kronlands – weil sie als verlorenes Kind König Edrians gilt. Orrin erlebt die Krönung noch. „Meine Prinzessin“, flüstert er, „ich wusste es immer.“ Nelia hält seine Hand und schweigt. In der Nacht stirbt er. Am nächsten Morgen hebt Königin Nelia die Leibeigenschaft auf. Den Wetterturm lässt sie stehen: Die Technik, mit der Hrimgar und Malvor das Land aushungerten, soll es künftig vor Missernten schützen. Ende der Kampagne – danke fürs Spielen!',
    'The provinces crown Nelia the first queen of the Crownland – because she is believed to be King Edrian’s lost child. Orrin lives to see the coronation. “My princess,” he whispers, “I always knew.” Nelia holds his hand and stays silent. He dies in the night. The next morning Queen Nelia abolishes serfdom. She leaves the weather tower standing: the technique Hrimgar and Malvor used to starve the land shall protect it from failed harvests from now on. End of the campaign – thank you for playing!',
  ),
  defeatText: t('Malvor hat gesiegt.', 'Malvor has won.'),
  defeatTexts: { hq: t('Die Ufersiedlung ist gefallen. Malvor hat gesiegt.', 'The lakeshore settlement has fallen. Malvor has won.') },
  next: null,
  weatherCycle: [['summer', 30000], ['rain', 1500]],
  players: [
    {
      kind: 'human', heroes: ['nelia', 'orrin', 'taran'], serfs: 16, techs: ['conscription', 'education', 'construction', 'alchemy', 'standingArmy'],
      stock: { gold: 3500, clay: 2500, wood: 3000, stone: 2500, iron: 1500, sulfur: 1200 },
    },
    {
      kind: 'ai', hero: 'malvor', difficulty: 'normal', aggression: 'passive', aiSerfs: 14, militia: false,
      techs: ['conscription', 'construction', 'education', 'alchemy', 'standingArmy', 'weatherForecast', 'meteorology'],
      stock: { gold: 1500, clay: 2000, wood: 2500, stone: 2000, iron: 1500, sulfur: 800 },
    },
  ],

  setup(ctx) {
    const { sim, api } = ctx;
    const me = ctx.hqCenter(0), foe = ctx.hqCenter(1);
    for (const [type, dx, dy] of [['residence', 0, 8], ['farm', 6, 7], ['university', 8, 0], ['barracks', 3, 12], ['alchemist', -7, 6]]) {
      api.placeBuilding(sim, 0, type, { x: me.x + dx, y: me.y + dy }, { minR: 2 });
    }
    // Island castle: castle with towers, the lake around it
    const hq = sim.findBuilding(1, 'headquarters');
    ctx.ref('castle', hq.id);
    for (const [type, dx, dy] of [['residence', -5, -5], ['farm', 5, -5], ['barracks', 0, 6]]) {
      api.placeBuilding(sim, 1, type, { x: foe.x + dx, y: foe.y + dy }, { minR: 1, radius: 4 });
    }
    const t1 = api.placeBuilding(sim, 1, 'tower', api.toward(foe, me, 6), { minR: 1, radius: 3, level: 1 });
    if (t1) ctx.ref('tower', t1.id);
    // Lake: as close as possible around the castle, without flooding buildings
    let isle = null;
    for (let inner = 11; inner <= 18 && !isle; inner++) isle = api.moat(sim, foe, me, { inner, width: 4 });
    if (!isle) ctx.warn('No lake around the island castle');
    ctx.ref('isle', isle ?? { ...foe, r: 11 });
    // Malvor's weather plant on the works island in front of the castle: unreachable in summer (also for his
    // serfs – nobody repairs it), but within shooting range from the bank. Fully charged.
    const r = isle?.r ?? 11;
    const gap = api.dist(me, foe) - r - 5;
    const keep = [api.toward(foe, me, r + 8), api.toward(foe, me, -20)].map((p) => api.nearestWalkable(sim, p.x, p.y, 8)).filter((p) => p && api.reachable(sim, me, p, false));
    let works = null;
    for (const d of [14, 18, 22, 10]) works ??= api.makeIsland(sim, me, foe, { inner: 4, width: 2, minDist: Math.max(12, gap - d), keep });
    const plant = works && api.placeBuilding(sim, 1, 'weatherPlant', works, { minR: 0, radius: 2, margin: 0 });
    if (plant) { plant.fixed = true; ctx.ref('malvorPlant', plant.id); } else ctx.warn('Malvor\'s weather power plant cannot be placed');
    ctx.ref('worksIsle', works ?? { ...foe, r: 3 });
    sim.players[1].weatherEnergy = 1000;
    ctx.ref('shore', { ...api.toward(foe, me, r + 8), r: 3 });
    // Malvor's troops from Hagenfurt come over land: behind the lake, otherwise to the side of it or at the lake shore –
    // the reachable spot that is furthest from the own castle
    const ax = api.axis(foe, me);
    let gate = null;
    for (const [p, q] of [[-20, 0], [-14, 0], [-10, 24], [-10, -24], [0, 30], [0, -30], [10, 34], [10, -34], [r + 9, 14], [r + 9, -14]]) {
      const c = ax.at(p, q);
      const g = api.findOpen(sim, c.x, c.y, { maxR: 10, from: me });
      if (g && (!gate || api.dist(g, me) > api.dist(gate, me) + 8)) gate = g;
    }
    if (!gate) ctx.warn('No rally point for Malvor\'s troops');
    ctx.ref('northGate', { ...(gate ?? api.toward(me, foe, 50)), r: 3 });
    for (const d of [8, 10]) api.spawnTroop(sim, 1, 'sword1', api.toward(foe, me, d), 4);
  },

  start: [
    say('malvor', 'Eine Leibeigene mit einem Händler und einem Verräter. Komm nur, Nelia. Der See ist tief.', 'A serf with a merchant and a traitor. Come then, Nelia. The lake is deep.'),
    say('taran', 'Er hat recht, der See ist tief. Aber im Winter trägt er.', 'He’s right, the lake is deep. But in winter it holds.'),
    say('orrin', 'Hrimgars Pläne! Ein Wetterturm, Nelia. Dafür brauchen wir eine Alchimistenhütte, Wissen – oder Geld. Ich kenne Gelehrte in Beaucroix …', 'Hrimgar’s plans! A weather tower, Nelia. For that we need an alchemist’s hut, knowledge – or money. I know scholars in Beaucroix …'),
    say('taran', 'Malvor hat sein eigenes Kraftwerk, dort auf der kleinen Insel vor dem Schloss. Ist es geladen, taut er den See, sobald wir aufs Eis gehen. Aber vom Ufer aus treffen es Bogenschützen und Kanonen.', 'Malvor has his own weather plant, there on the small island in front of the castle. Once it is charged, he thaws the lake as soon as we step onto the ice. But archers and cannons can hit it from the shore.'),
    { type: 'tribute', id: 'scholars' },
    { type: 'reveal', area: 'isle', seconds: 40 },
    { type: 'camera', at: 'isle' },
  ],

  objectives: [
    { id: 'plant', type: 'build', building: 'weatherPlant', primary: true, text: t('Baue den Wetterturm (Wetterkraftwerk; Forschung: Wettervorhersage, Meteorologie)', 'Build the weather tower (weather plant; research: Weather Forecast, Meteorology)') },
    { id: 'freeze', type: 'flag', flag: 'frozen', primary: true, text: t('Lass den Thronsee zufrieren', 'Make the Throne Lake freeze') },
    { id: 'castle', type: 'destroyHq', target: 'enemy', primary: true, text: t('Erobere das Inselschloss', 'Take the island castle') },
    { id: 'malvorPlant', type: 'custom', text: t('Optional: Zerstöre Malvors Wetterkraftwerk (Balken: seine Ladung)', 'Optional: Destroy Malvor’s weather plant (bar: its charge)'),
      progress: (sim, m) => (malvorPlant(sim, m)
        ? { cur: sim.players[m.playerOf('enemy')].weatherEnergy ?? 0, target: 1000, done: false }
        : { cur: 1, target: 1, done: true }),
      onDone: [
        say('malvor', 'Mein Kraftwerk! Ihr wisst nicht, was ihr zerstört!', 'My weather plant! You don’t know what you are destroying!'),
        say('nelia', 'Doch. Jetzt gehört der Winter uns.', 'We do. Now the winter is ours.'),
      ] },
    { id: 'tower', type: 'destroy', ref: 'tower', text: t('Optional: Zerstöre Malvors Turm am Ufer der Insel', 'Optional: Destroy Malvor’s tower on the island shore') },
    { id: 'army', type: 'recruit', count: 8, text: t('Optional: Stelle ein Heer aus 8 Truppen auf', 'Optional: Raise an army of 8 troops'),
      onDone: [{ type: 'give', res: { gold: 500 } }, say('taran', 'Gute Leute. Sie wissen, wofür sie kämpfen.', 'Good people. They know what they fight for.')] },
  ],

  tributes: {
    scholars: {
      cost: { gold: 2200, sulfur: 500 },
      text: t('Wissen der Gelehrten kaufen: Wettervorhersage und Meteorologie', 'Buy the scholars’ knowledge: Weather Forecast and Meteorology'),
      onPaid: [
        { type: 'give', techs: ['weatherForecast', 'meteorology'] },
        say('scholar', 'Hrimgars Zeichnungen sind wirr, aber vollständig. Ihr könnt sofort bauen.', 'Hrimgar’s drawings are confused, but complete. You can build at once.'),
        say('orrin', 'Teuer, ja. Aber Zeit ist das Einzige, was man nicht nachkaufen kann.', 'Expensive, yes. But time is the one thing you can’t buy more of.'),
      ],
    },
  },

  events: [
    { id: 'frozen', when: { type: 'weather', state: 'winter' }, do: [
      { type: 'flag', name: 'frozen' },
      say('taran', 'Der See trägt. Aber seht auf Malvors Kraftwerk: Solange es geladen ist, taut er, sobald wir auf dem Eis stehen.', 'The lake holds. But watch Malvor’s plant: as long as it is charged, he will thaw as soon as we stand on the ice.'),
      say('nelia', 'Dann locken wir ihn – oder wir schießen sein Kraftwerk vom Ufer aus zusammen.', 'Then we lure him – or we shoot his plant to pieces from the shore.'),
    ] },
    // Fixed scene: Orrin is hit in the assault on the island
    { id: 'orrinHit', when: { type: 'all', of: [{ type: 'weather', state: 'winter' }, { type: 'area', area: 'isle', who: 'army' }] }, do: [
      say('orrin', 'Nelia! Das Eis … es bricht …', 'Nelia! The ice … it’s breaking …'),
      orrinFalls,
      say('taran', 'Der Händler ist eingebrochen! Ich hab ihn – er lebt, aber er ist schwer verwundet.', 'The merchant fell through! I’ve got him – he’s alive, but badly wounded.'),
      say('nelia', 'Das war mein Befehl … Bringt ihn ans Ufer. Wir dürfen jetzt nicht umkehren.', 'That was my order … Get him to the shore. We can’t turn back now.'),
    ] },
    // Malvor's plant charges like three weather technicians
    { id: 'malvorCharge', when: (sim, m) => !!malvorPlant(sim, m), every: 5, do: [
      (sim, m) => addWeatherEnergy(sim, m.playerOf('enemy'), MALVOR_CHARGE),
    ] },
    // If our people stand on the ice and he is ready (charge, waiting time), he thaws the lake
    { id: 'malvorThaw', every: 1, when: (sim, m) => {
      const plant = malvorPlant(sim, m);
      return !!plant && onIce(sim, m) && checkWeatherChange(sim, m.playerOf('enemy'), plant, 'summer') === null;
    }, do: [
      say('malvor', 'Tauwetter!', 'Thaw!'),
      malvorThaws,
    ] },
    { id: 'firstThaw', when: { type: 'fired', id: 'malvorThaw' }, do: [
      say('orrin', 'Sein Kraftwerk ist leer – er muss jetzt nachladen und warten wie wir. Frieren wir den See wieder ein, sobald unseres bereit ist, kann er nichts tun.', 'His plant is empty – now he has to recharge and wait, just like us. If we freeze the lake again as soon as ours is ready, he can do nothing.'),
    ] },
    { id: 'raid', when: { type: 'time', at: 360 }, every: 300, do: [
      say('malvor', 'Hagenfurts Garde! Zeigt dieser Bauernmagd, was Ordnung heißt.', 'Guard of Hagenfurt! Show this peasant girl what order means.'),
      { type: 'spawn', owner: 1, at: 'northGate', units: [{ def: 'sword1', count: 2, soldiers: 4 }, { def: 'bow1', count: 1, soldiers: 4 }], order: 'attackMove', target: 'humanHq' },
    ] },
    { id: 'castleHurt', when: (sim, m) => { const c = sim.entities.get(m.state.refs.castle); return !!c && c.hp * 2 < BUILDINGS.headquarters.levels[c.level].hp; }, do: [
      say('malvor', 'Ich habe dieses Land vor dem Chaos bewahrt! Ohne mich hungert ihr alle!', 'I saved this land from chaos! Without me, you’ll all starve!'),
      say('nelia', 'Wir haben gehungert. Wegen dir.', 'We did starve. Because of you.'),
    ] },
  ],
};
