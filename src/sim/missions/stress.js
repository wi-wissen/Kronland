// Swarm (stress test): a large map where a lot is really going on – for checking rendering and
// simulation under load. Four built-up cities (each ~40 buildings with all workers), many serfs at
// work, armies in every city and two permanent battles in the map centre that keep getting reinforcements.
// No fog, no defeat; the three AI opponents keep playing (build, attack).
//
// Order of magnitude: ~1500 figures and ~170 buildings at the start (tests/sim/stress.test.js checks the minimum numbers).

import { t } from './campaign/common.js';
import { BUILDINGS } from '../data/buildings.js';
import { UNITS } from '../data/units.js';
import { secondsToTicks } from '../fixed.js';
import { addWorker } from './showcase.js';
import * as api from './setupApi.js';
import { WATER, CLIFF } from '../map.js';

export const STRESS_ID = 'bustle';

/** Buildings per city: [type, count, level (0-based, at most the last)]. */
export const TOWN = [
  ['residence', 8, 2], ['farm', 8, 2], ['storehouse', 1, 1], ['university', 1, 1], ['chapel', 1, 2], ['bank', 1, 1],
  ['sawmill', 2, 1], ['brickworks', 2, 1], ['stonemason', 2, 1], ['smithy', 2, 1], ['alchemist', 1, 1],
  ['barracks', 1, 1], ['archery', 1, 1], ['stable', 1, 1], ['foundry', 1, 1], ['tower', 3, 2],
  ['fountain', 1, 0], ['statue', 1, 0], ['clock', 1, 0], ['windwheel', 1, 0],
];
/** Shafts per city (created as needed). */
export const MINES = [['clayMine', 'clay'], ['stoneMine', 'stone'], ['ironMine', 'iron'], ['sulfurMine', 'sulfur']];
/** Serfs per player. */
export const SERFS = 50;
/** Home army per player (troops with full soldier count). */
export const HOME_ARMY = ['sword4', 'sword4', 'spear4', 'spear4', 'bow4', 'bow4', 'lightCav2', 'heavyCav2', 'cannon2'];
/** Wave per side of a battle; arrives every WAVE_SECONDS as long as the player has fewer than MAX_LEADERS troops. */
export const WAVE = ['sword4', 'sword4', 'spear4', 'spear4', 'bow4', 'bow4', 'lightCav2', 'heavyCav2'];
export const WAVE_SECONDS = 40;
/** Waves per side at the start. */
export const START_WAVES = 2;
export const MAX_LEADERS = 60;

/**
 * Battlefields: pairs of opponents, desired position relative to the map centre, spacing of the formation. The
 * actual centre is searched by findBattlefield on open land (the map centre can be a mountain).
 */
export const BATTLES = [{ a: 0, b: 1, dy: -14, spread: 14 }, { a: 2, b: 3, dy: 14, spread: 14 }];

/**
 * Centre of a battlefield: nearest point to `near` around which a rectangle (±spread+3 across, ±6 along) is free of
 * water and steep slope (trees are cleared afterwards). Distance to already chosen fields at least `gap`.
 */
export function findBattlefield(sim, near, spread, taken = [], gap = 16) {
  const m = sim.map, rx = spread + 3, ry = 6;
  const open = (cx, cy) => {
    for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
      if (!m.inBounds(x, y) || m.flags[m.idx(x, y)] & (WATER | CLIFF)) return false;
    }
    return true;
  };
  for (const p of api.rings(near.x, near.y, 0, Math.max(m.width, m.height) >> 1)) {
    if (taken.some((t) => Math.abs(t.x - p.x) < 2 * rx && Math.abs(t.y - p.y) < gap)) continue;
    if (open(p.x, p.y)) return p;
  }
  return null;
}

/** Set up a wave and send it to the battlefield centre (attack move: fights everything it meets). */
function wave(sim, owner, at, spread, left) {
  const from = { x: at.x + (left ? -spread : spread), y: at.y };
  const ids = [];
  for (const def of WAVE) {
    const L = api.spawnTroop(sim, owner, def, from, UNITS[def].soldiers);
    if (L) ids.push(L.id);
  }
  if (ids.length) sim.applyCommand({ type: 'order', player: owner, units: ids, order: 'attackMove', x: at.x + (left ? 2 : -2), y: at.y });
  return ids.length;
}

/** Troops of a player. */
const leaders = (sim, owner) => { let n = 0; for (const e of sim.entities.values()) if (e.kind === 'leader' && e.owner === owner) n++; return n; };

/** Build up a city around the castle: buildings, shafts, all workplaces staffed, serfs in the forest. */
function buildTown(ctx, p) {
  const { sim } = ctx;
  const home = ctx.hqCenter(p);
  const placed = [];
  for (const [type, count, level] of TOWN) {
    for (let i = 0; i < count; i++) {
      const b = api.placeBuilding(sim, p, type, home, { minR: 5, radius: 34, level: Math.min(level, BUILDINGS[type].levels.length - 1) });
      if (b) placed.push(b); else ctx.warn(`Player ${p}: no space for ${type}`);
    }
  }
  for (const [type, res] of MINES) {
    api.ensureShaft(sim, res, home, 34);
    const b = api.placeBuilding(sim, p, type, home, { radius: 36, level: 1 });
    if (b) placed.push(b); else ctx.warn(`Player ${p}: no shaft for ${type}`);
  }
  // staff all workplaces (workers go to work immediately, look for bed and eating place)
  for (const b of placed) {
    const n = BUILDINGS[b.type].levels[b.level].workers ?? 0;
    for (let i = b.workers.length; i < n; i++) addWorker(sim, b, api.centerOf(b));
  }
  // Serfs: chop wood at the nearest forest
  api.setSerfs(sim, p, SERFS);
  const serfs = [...sim.entities.values()].filter((e) => e.kind === 'unit' && e.owner === p);
  const trees = [...sim.entities.values()].filter((e) => e.kind === 'tree')
    .sort((x, y) => api.dist(x, home) - api.dist(y, home) || x.id - y.id).slice(0, 10);
  serfs.forEach((u, i) => { if (trees.length) sim.applyCommand({ type: 'assignWork', player: p, units: [u.id], target: trees[i % trees.length].id }); });
  // Army in front of the city
  for (const def of HOME_ARMY) api.spawnTroop(sim, p, def, { x: home.x + ((sim.map.width >> 1) > home.x ? 10 : -10), y: home.y }, UNITS[def].soldiers);
  return placed.length;
}

export default {
  id: STRESS_ID,
  special: true,
  icon: 'soldiers', // icon in the special maps menu
  // computationally heavy (~1500 figures): endurance tests run shorter here (tests/sim/fuzz.test.js)
  heavy: true,
  seed: 11,
  size: 160,
  fog: false,
  noDefeat: true,
  title: t('Gewimmel', 'Bustle'),
  summary: t('Belastungsprobe: vier volle Städte, über tausend Figuren und zwei Dauerschlachten – ohne Nebel.',
    'Stress test: four full towns, more than a thousand figures and two endless battles – without fog.'),
  briefing: t(
    'Hier ist wirklich viel los: Vier ausgebaute Städte mit allen Arbeitern, Dutzende Leibeigene im Wald, Heere vor jeder Burg und in der Kartenmitte zwei Schlachten, die immer wieder Nachschub bekommen. Die Karte dient zum Prüfen der Darstellung (Bilder pro Sekunde, Zeichenaufrufe: Entwicklermodus mit F3). Es gibt weder Sieg noch Niederlage.',
    'There is a lot going on here: four developed towns with all their workers, dozens of serfs in the woods, armies in front of every castle and two battles in the middle of the map that keep getting reinforcements. The map is meant for testing rendering (frames per second, draw calls: developer mode with F3). There is no victory and no defeat.',
  ),
  victoryText: t('Belastungsprobe beendet.', 'Stress test finished.'),
  defeatText: t('Belastungsprobe beendet.', 'Stress test finished.'),
  weatherCycle: [['summer', secondsToTicks(600)], ['winter', secondsToTicks(240)]],
  players: [
    { kind: 'human', heroes: ['nelia', 'taran'], stock: { gold: 100000, clay: 50000, wood: 50000, stone: 50000, iron: 50000, sulfur: 50000 } },
    { kind: 'ai', hero: 'malvor', difficulty: 'hard', aggression: 'normal', stock: { gold: 100000, clay: 50000, wood: 50000, stone: 50000, iron: 50000, sulfur: 50000 } },
    { kind: 'ai', hero: 'orrin', difficulty: 'hard', aggression: 'normal', stock: { gold: 100000, clay: 50000, wood: 50000, stone: 50000, iron: 50000, sulfur: 50000 } },
    { kind: 'ai', hero: 'nelia', difficulty: 'hard', aggression: 'normal', stock: { gold: 100000, clay: 50000, wood: 50000, stone: 50000, iron: 50000, sulfur: 50000 } },
  ],

  setup(ctx) {
    const { sim } = ctx;
    let buildings = 0;
    for (let p = 0; p < 4; p++) buildings += buildTown(ctx, p);
    ctx.ref('buildings', buildings);
    // Battlefields on open land near the centre: trees gone, set up first waves
    const c = ctx.mapCenter();
    const taken = [];
    for (const [i, battle] of BATTLES.entries()) {
      const at = findBattlefield(sim, { x: c.x, y: c.y + battle.dy }, battle.spread, taken);
      if (!at) { ctx.warn(`Battle ${i + 1}: no open field`); continue; }
      taken.push(at);
      api.clearNodes(sim, at.x, at.y, battle.spread + 6);
      ctx.ref(`battle${i + 1}`, { ...at, r: battle.spread + 4 });
      for (const left of [true, false]) {
        let n = 0;
        for (let k = 0; k < START_WAVES; k++) n += wave(sim, left ? battle.a : battle.b, at, battle.spread, left);
        if (n < START_WAVES * WAVE.length) ctx.warn(`Schlacht ${i + 1}: nur ${n} Truppen aufgestellt`);
      }
    }
    for (let p = 0; p < 4; p++) ctx.ref(`town${p + 1}`, { ...ctx.hqCenter(p), r: 20 });
  },

  // Signposts: side goals that are never fulfilled – only for "show goal" (camera jump)
  objectives: [
    ['battle1', 'Schlacht im Norden', 'Northern battle'],
    ['battle2', 'Schlacht im Süden', 'Southern battle'],
    ['town1', 'Eigene Stadt', 'Your town'],
    ['town2', 'Stadt von Spieler 2', 'Town of player 2'],
    ['town3', 'Stadt von Spieler 3', 'Town of player 3'],
    ['town4', 'Stadt von Spieler 4', 'Town of player 4'],
  ].map(([area, de, en]) => ({ id: `see-${area}`, type: 'flag', flag: 'never', text: t(de, en), hint: { area } })),

  // Reinforcements: each side regularly gets a new wave as long as it does not have too many troops
  events: [{
    id: 'waves', every: WAVE_SECONDS, when: { type: 'time', at: WAVE_SECONDS },
    do: (sim, m) => {
      BATTLES.forEach((battle, i) => {
        const at = m.state.refs[`battle${i + 1}`];
        if (!at) return;
        for (const left of [true, false]) {
          const owner = left ? battle.a : battle.b;
          if (leaders(sim, owner) < MAX_LEADERS) wave(sim, owner, at, battle.spread, left);
        }
      });
    },
  }],
};
