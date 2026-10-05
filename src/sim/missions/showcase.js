// Showcase ("kitchen sink" map): every displayable object stands once on the map, without fog of
// war – for looking at and judging the models. No victory, no defeat, no enemies (all neutral).
//
// Layout: the random map stays (mountains, rocks, river with bridge sites); a large rectangle is levelled around
// the player's castle, on which everything stands in labelled fields. The fields are side goals with
// "show goal" (camera jump) – so they can also be found on the phone. All without fixed coordinates: space is searched
// from the castle outwards in order (deterministic).

import { t, say } from './campaign/common.js';
import { BUILDINGS } from '../data/buildings.js';
import { UNITS } from '../data/units.js';
import { WORKER as W, PROFESSIONS, professionFor } from '../data/professions.js';
import { RESOURCES } from '../data/resources.js';
import { BALANCE } from '../data/balance.js';
import { WATER, CLIFF, RESERVED, OCCUPIED } from '../map.js';
import { CLIFF_SLOPE, PEAK_HEIGHT, findBridgeSites } from '../mapgen.js';
import { tileCenter, secondsToTicks } from '../fixed.js';
import { useAbility } from '../systems/military.js';
import { setupBridges, checkBridgeSite } from '../systems/bridges.js';
import { buildingMaxHp } from '../systems/techs.js';

export const SHOWCASE_ID = 'showcase';

/** Building rows (player 0): per type all upgrade levels side by side. Bandit camp and bridge stand separately. */
export const BUILDING_ROWS = [
  ['headquarters', 'villageCenter', 'residence', 'farm', 'university', 'storehouse', 'bank', 'chapel'],
  ['clayMine', 'stoneMine', 'ironMine', 'sulfurMine', 'brickworks', 'sawmill', 'stonemason', 'smithy', 'alchemist'],
  ['barracks', 'archery', 'stable', 'foundry', 'tower', 'clock', 'windwheel', 'weatherTower', 'weatherPlant', 'fountain', 'statue'],
];

/** Construction sites: type and progress in percent (build phases); plus a building being upgraded. */
export const SITES = [['residence', 10], ['farm', 30], ['sawmill', 55], ['chapel', 85]];
export const UPGRADE = ['residence', 40];

/** Ruins (type, level). */
export const RUINS = [['villageCenter', 0], ['residence', 1], ['headquarters', 0], ['tower', 1], ['chapel', 0], ['farm', 0]];

/** Levelled area: distance to the map edge, size and transition band to the original terrain. */
const EDGE = 3, AREA_W = 92, AREA_H = 76, BAND = 5;

const BLOCK = WATER | OCCUPIED | RESERVED | CLIFF;

/**
 * Level a rectangle: same height, trees/piles/spots/shafts/bridge sites in it removed. Around it a band in which
 * the height transitions to the old terrain; there water and steep slope are re-determined from the height (as in the editor).
 */
function flatten(sim, R) {
  const m = sim.map, wl = sim.waterLevel, level = wl + 320;
  const outside = (x, y) => Math.max(R.x0 - x, x - R.x1, R.y0 - y, y - R.y1, 0);
  for (let y = R.y0 - BAND; y <= R.y1 + BAND; y++) for (let x = R.x0 - BAND; x <= R.x1 + BAND; x++) {
    if (!m.inBounds(x, y)) continue;
    const k = m.idx(x, y), d = outside(x, y);
    if (d === 0) {
      const e = sim.entities.get(m.owner[k]);
      if (e && (e.kind === 'tree' || e.kind === 'pile')) sim.removeEntity(e);
      m.flags[k] &= ~(WATER | CLIFF | RESERVED);
      m.heights[k] = level;
    } else {
      m.heights[k] = level + Math.trunc(((m.heights[k] - level) * d) / (BAND + 1));
    }
  }
  // Derive water and steep slope in the band from the height
  const H = m.heights, S = m.width;
  for (let y = R.y0 - BAND - 1; y <= R.y1 + BAND + 1; y++) for (let x = R.x0 - BAND - 1; x <= R.x1 + BAND + 1; x++) {
    if (!m.inBounds(x, y) || outside(x, y) === 0) continue;
    const k = m.idx(x, y);
    let f = m.flags[k] & ~(WATER | CLIFF);
    if (H[k] < wl) f |= WATER;
    else {
      const g = Math.max(Math.abs(H[y * S + Math.min(S - 1, x + 1)] - H[y * S + Math.max(0, x - 1)]),
        Math.abs(H[Math.min(m.height - 1, y + 1) * S + x] - H[Math.max(0, y - 1) * S + x]));
      if (g > 2 * CLIFF_SLOPE || H[k] > wl + PEAK_HEIGHT) f |= CLIFF;
    }
    if (f & (WATER | CLIFF) && f & OCCUPIED) {
      const e = sim.entities.get(m.owner[k]);
      if (e && (e.kind === 'tree' || e.kind === 'pile')) { sim.removeEntity(e); f = m.flags[k] & ~(WATER | CLIFF) | (f & (WATER | CLIFF)); } else continue;
    }
    m.flags[k] = f;
  }
  const inside = (s, w, h, pad = 0) => s.x + w > R.x0 - pad && s.x < R.x1 + 1 + pad && s.y + h > R.y0 - pad && s.y < R.y1 + 1 + pad;
  sim.spots = sim.spots.filter((s) => !inside(s, 4, 4));
  sim.shafts = sim.shafts.filter((s) => !inside(s, 3, 3));
  sim.bridgeSites = (sim.bridgeSites ?? []).filter((s) => !inside(s, s.w, s.h, BAND + 2));
  m.version++; m.heightVersion++;
}

/**
 * Flowing arrangement in rows: take(w, h) returns the top-left corner of a free block (with one tile
 * margin), further right in the same row or in the next row. Occupied tiles (castle, village centre) are skipped.
 */
function flow(sim, R, y) {
  const c = { x: R.x0 + 1, y, rowH: 0 };
  const api = {
    newRow(gap = 2) { if (c.rowH) c.y += c.rowH + gap; c.x = R.x0 + 1; c.rowH = 0; },
    take(w, h, gap = 1) {
      for (;;) {
        if (c.x + w > R.x1) api.newRow(1);
        if (c.y + h > R.y1) return null;
        if (sim.map.rectFree(c.x - 1, c.y - 1, w + 2, h + 2, BLOCK)) {
          const p = { x: c.x, y: c.y };
          c.x += w + gap; c.rowH = Math.max(c.rowH, h);
          return p;
        }
        c.x++;
      }
    },
    get y() { return c.y; },
  };
  return api;
}

/** Area (circle) around a list of rectangles/points – for "show goal". */
function areaOf(boxes) {
  if (!boxes.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of boxes) { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + (b.w ?? 1)); y1 = Math.max(y1, b.y + (b.h ?? 1)); }
  return { x: (x0 + x1) >> 1, y: (y0 + y1) >> 1, r: Math.max(3, Math.max(x1 - x0, y1 - y0) >> 1) };
}

/** Create a worker directly (like systems/workers.js on move-in). */
function addWorker(sim, wp, at, o = {}) {
  const w = {
    id: sim.nextId++, kind: 'worker', prof: professionFor(wp.type), owner: wp.owner,
    px: tileCenter(at.x), py: tileCenter(at.y), path: [],
    workplace: wp.id, home: 0, farm: 0, state: o.state ?? 'idle', intent: '', target: 0, timer: o.timer ?? 0,
    stamina: o.stamina ?? W.startStamina, motivation: W.startMotivation,
    carry: 0, resting: false, ate: false, inside: false,
  };
  sim.entities.set(w.id, w);
  wp.workers.push(w.id);
  return w;
}

/** Construction site with progress in percent. */
function site(sim, owner, type, p, percent) {
  const b = sim.createBuilding(owner, type, p.x, p.y, false);
  b.progress = Math.trunc((b.work * percent) / 100);
  b.hp = Math.max(b.hp, Math.trunc((buildingMaxHp(sim, b) * percent) / 100));
  return b;
}

/**
 * Natural river missing outside the area? Then dig a river course and look for bridge sites there.
 * @returns {{x:number,y:number,w:number,h:number}[]} bridge sites outside the area, nearest first
 */
function bridgeSites(ctx, R, from) {
  const { sim, api } = ctx;
  const byDist = () => [...(sim.bridgeSites ?? [])].filter((s) => !checkBridgeSite(sim, s.x, s.y))
    .sort((a, b) => api.dist(a, from) - api.dist(b, from) || a.y - b.y || a.x - b.x);
  let list = byDist();
  if (list.length >= 2) return list;
  // Fallback: river course across below the area
  const m = sim.map, y = Math.min(m.height - 6, R.y1 + BAND + 8);
  api.channel(sim, { x: 0, y }, { x: m.width - 1, y }, { width: 3 });
  const river = [];
  for (let x = 0; x < m.width; x++) river.push(m.idx(x, y));
  setupBridges(sim, [...(sim.bridgeSites ?? []), ...findBridgeSites(m, river, 1)]);
  list = byDist();
  return list;
}

export default {
  id: SHOWCASE_ID,
  showcase: true,
  seed: 1,
  size: 128,
  fog: false,
  noDefeat: true,
  title: t('Schaukasten', 'Showcase'),
  summary: t('Alle Gebäude, Figuren und Kartenobjekte auf einer Karte – zum Anschauen, ohne Nebel und ohne Gegner.',
    'Every building, figure and map object on one map – to look at, without fog and without enemies.'),
  briefing: t(
    'Hier steht alles, was das Spiel zeichnen kann: jedes Gebäude in jeder Ausbaustufe, Baustellen, Ruinen, eine Brücke, Rohstoffe, Arbeiter jedes Berufs, Truppen aller Linien, die vier Helden, Räuber und ein Lagerfeuer. Alle Parteien sind neutral, es gibt weder Sieg noch Niederlage. Die Liste „Ziele“ führt zu den einzelnen Feldern.',
    'Everything the game can draw stands here: every building at every level, construction sites, ruins, a bridge, resources, workers of every profession, troops of every line, the four heroes, bandits and a campfire. All parties are neutral; there is no victory and no defeat. The “Objectives” list takes you to each field.',
  ),
  victoryText: t('Schaukasten beendet.', 'Showcase finished.'),
  defeatText: t('Schaukasten beendet.', 'Showcase finished.'),
  weatherCycle: [['summer', 36000]],
  players: [
    { kind: 'human', heroes: ['nelia', 'orrin', 'taran', 'malvor'], stock: { gold: 50000, clay: 50000, wood: 50000, stone: 50000, iron: 50000, sulfur: 50000 } },
    // Second player (other coat-of-arms colour): without AI, without castle at the start – the mission sets them up
    { kind: 'idle', hq: false, heroes: null, stock: { gold: 5000, clay: 0, wood: 0, stone: 0, iron: 0, sulfur: 0 } },
    { kind: 'bandits' },
  ],

  npcs: {
    villager: {
      at: 'npcSpot', look: 'serf', hero: 'orrin', speaker: 'villager',
      onTalk: [say('villager', 'Schön, dass sich jemand die Mühe macht, alles anzuschauen!', 'Nice that someone takes the trouble to look at everything!')],
    },
    merchant: {
      at: 'npcSpot2', look: 'worker', hero: 'orrin', speaker: 'merchant',
      onTalk: [say('merchant', 'Alles ausgestellt, nichts zu verkaufen.', 'Everything on display, nothing for sale.')],
    },
  },

  setup(ctx) {
    const { sim, api } = ctx;
    const P = ctx.human, P2 = 1, B = ctx.bandits;
    const m = sim.map;
    const hq = ctx.hq();
    const home = api.centerOf(hq);
    // Area at the corner of the castle (start spots are in the corners)
    const left = home.x < m.width >> 1, top = home.y < m.height >> 1;
    const w = Math.min(AREA_W, m.width - 2 * EDGE - 2 * BAND - 4), h = Math.min(AREA_H, m.height - 2 * EDGE - 2 * BAND - 4);
    const x0 = left ? EDGE : m.width - EDGE - w, y0 = top ? EDGE : m.height - EDGE - h;
    const R = { x0, y0, x1: x0 + w - 1, y1: y0 + h - 1 };
    ctx.ref('showcaseArea', { x: (R.x0 + R.x1) >> 1, y: (R.y0 + R.y1) >> 1, r: Math.max(w, h) >> 1 });
    flatten(sim, R);
    for (const q of sim.players) if (q.id !== P) sim.setDiplomacy(P, q.id, 'neutral');
    if (B >= 0) sim.setDiplomacy(P2, B, 'neutral');

    const F = flow(sim, R, R.y0 + 1);
    const field = (name, boxes) => { const a = areaOf(boxes.filter(Boolean)); if (a) ctx.ref(name, a); return a; };

    // ---------- Figures: heroes, devices, talk figures ----------
    const heroes = [...sim.entities.values()].filter((e) => e.kind === 'hero' && e.owner === P);
    const figBoxes = [];
    for (const hero of heroes) {
      const p = F.take(2, 2, 1);
      hero.px = tileCenter(p.x); hero.py = tileCenter(p.y); hero.path = [];
      figBoxes.push({ ...p, w: 2, h: 2 });
    }
    // Field gun and caltrops (Malvor's abilities), they stay put without enemies
    const malvor = heroes.find((e) => e.hero === 'malvor');
    for (const ability of ['fieldGun', 'caltrops']) {
      const p = F.take(2, 2, 1);
      figBoxes.push({ ...p, w: 2, h: 2 });
      if (malvor && useAbility(sim, { ...malvor, ready: {} }, ability, tileCenter(p.x), tileCenter(p.y))) ctx.warn(`Device ${ability} not set up`);
    }
    // Talk figures at a distance from the heroes (otherwise they would be talked to immediately)
    const n1 = F.take(1, 1, 3), n2 = F.take(1, 1, 1);
    ctx.ref('npcSpot', { ...n1, r: 1 }); ctx.ref('npcSpot2', { ...n2, r: 1 });
    figBoxes.push(n1, n2);
    field('heroArea', figBoxes);

    // ---------- Troops: every unit (all lines and tiers) with squad leader ----------
    F.newRow(2);
    const troopBoxes = [];
    for (const id of Object.keys(UNITS)) {
      const p = F.take(3, 3, 2);
      if (!p) { ctx.warn(`No room for squad ${id}`); continue; }
      sim.spawnLeader(P, id, p.x + 1, p.y);
      troopBoxes.push({ ...p, w: 3, h: 3 });
    }
    field('troopArea', troopBoxes);

    // ---------- Buildings in all upgrade levels ----------
    F.newRow(3);
    const shown = {}; // type → buildings per level
    const buildingBoxes = [];
    for (const row of BUILDING_ROWS) {
      for (const type of row) {
        const def = BUILDINGS[type], n = def.levels.length;
        const p = F.take(n * (def.w + 1) - 1, def.h, 2);
        if (!p) { ctx.warn(`No room for ${type}`); continue; }
        shown[type] = [];
        for (let lv = 0; lv < n; lv++) {
          const x = p.x + lv * (def.w + 1);
          if (def.placement === 'settlement') { sim.spots.push({ x, y: p.y }); m.reserve(x, p.y, def.w, def.h); }
          if (def.placement === 'shaft') { sim.shafts.push({ x, y: p.y, res: def.shaftResource }); m.reserve(x, p.y, def.w, def.h); }
          const b = sim.createBuilding(P, type, x, p.y, true);
          b.level = lv;
          b.hp = buildingMaxHp(sim, b);
          shown[type].push(b);
        }
        buildingBoxes.push({ ...p, w: n * (def.w + 1) - 1, h: def.h });
      }
      F.newRow(2);
    }
    field('buildingArea', buildingBoxes);

    // ---------- Workers of every profession (stand still in front of the row) ----------
    const workerBoxes = [];
    const jobs = Object.keys(PROFESSIONS).map((prof) => {
      const types = prof === 'miner' ? ['clayMine'] : Object.keys(BUILDINGS).filter((k) => PROFESSIONS[prof].building === k);
      for (const type of types) {
        const wp = (shown[type] ?? []).find((b) => (BUILDINGS[type].levels[b.level].workers ?? 0) > b.workers.length);
        if (wp) return wp;
      }
      ctx.warn(`No workplace for ${prof}`);
      return null;
    });
    for (const wp of jobs) {
      if (!wp) continue;
      const p = F.take(1, 1, 1);
      // "waits" for a very long time: stays put for viewing (state of the worker simulation, no special case)
      addWorker(sim, wp, p, { state: 'waiting', timer: 36000 * 10 });
      workerBoxes.push(p);
    }
    field('workerArea', workerBoxes);
    F.newRow(3);

    // ---------- Construction sites, upgrade, ruins ----------
    const siteBoxes = [];
    for (const [type, pct] of SITES) {
      const def = BUILDINGS[type], p = F.take(def.w, def.h, 2);
      if (!p) { ctx.warn(`No room for construction site ${type}`); continue; }
      site(sim, P, type, p, pct);
      siteBoxes.push({ ...p, w: def.w, h: def.h });
    }
    {
      const [type, pct] = UPGRADE, def = BUILDINGS[type], p = F.take(def.w, def.h, 4);
      if (p) {
        const b = sim.createBuilding(P, type, p.x, p.y, true);
        const next = def.levels[1];
        b.level = 1; b.done = false;
        b.work = secondsToTicks(next.buildTime) * BALANCE.serf.maxBuildersPerSite;
        b.progress = Math.trunc((b.work * pct) / 100);
        siteBoxes.push({ ...p, w: def.w, h: def.h });
      } else ctx.warn('No room for the upgrade');
    }
    field('siteArea', siteBoxes);
    const ruinBoxes = [];
    for (const [type, level] of RUINS) {
      const def = BUILDINGS[type], p = F.take(def.w, def.h, 2);
      const r = p && api.addRuin(sim, type, { x: p.x + (def.w >> 1), y: p.y + (def.h >> 1) }, { level, radius: 1 });
      if (!r) { ctx.warn(`No room for ruin ${type}`); continue; }
      ruinBoxes.push(r);
    }
    field('ruinArea', ruinBoxes);
    F.newRow(3);

    // ---------- Second player: castle, village centre, workshops without house and farm → campfire ----------
    const rivalBoxes = [];
    const rival = {};
    for (const type of ['headquarters', 'villageCenter', 'sawmill', 'brickworks', 'barracks', 'tower']) {
      const def = BUILDINGS[type], p = F.take(def.w, def.h, 3);
      if (!p) { ctx.warn(`No room for ${type} (player 2)`); continue; }
      if (def.placement === 'settlement') { sim.spots.push({ x: p.x, y: p.y }); m.reserve(p.x, p.y, def.w, def.h); }
      rival[type] = sim.createBuilding(P2, type, p.x, p.y, true);
      rivalBoxes.push({ ...p, w: def.w, h: def.h });
    }
    if (rival.headquarters) for (let i = 0; i < 3; i++) sim.spawnSerf(P2);
    // Without house and farm these workers rest at the campfire (systems/workers.js)
    for (const type of ['sawmill', 'brickworks']) {
      const wp = rival[type];
      if (wp) addWorker(sim, wp, api.centerOf(wp), { stamina: 0 });
    }
    for (const id of ['sword2', 'bow2']) {
      const p = F.take(3, 3, 2);
      if (p) { sim.spawnLeader(P2, id, p.x + 1, p.y); rivalBoxes.push({ ...p, w: 3, h: 3 }); }
    }
    field('rivalArea', rivalBoxes);
    F.newRow(3);

    // ---------- Resources: shafts, settlement spots, piles, forest ----------
    const resBoxes = [];
    for (const res of ['clay', 'stone', 'iron', 'sulfur']) {
      const p = F.take(3, 3, 2);
      if (!p) { ctx.warn(`No room for shaft ${res}`); continue; }
      sim.shafts.push({ x: p.x, y: p.y, res }); m.reserve(p.x, p.y, 3, 3);
      resBoxes.push({ ...p, w: 3, h: 3 });
    }
    for (let i = 0; i < 2; i++) {
      const p = F.take(4, 4, 2);
      if (!p) { ctx.warn('No room for settlement spot'); continue; }
      sim.spots.push({ x: p.x, y: p.y }); m.reserve(p.x, p.y, 4, 4);
      resBoxes.push({ ...p, w: 4, h: 4 });
    }
    for (const res of RESOURCES) {
      const p = F.take(1, 1, 2);
      if (p && sim.addNode('pile', p.x, p.y, res, BALANCE.pile.amount)) { m.reserve(p.x, p.y, 1, 1); resBoxes.push(p); } else ctx.warn(`No room for pile ${res}`);
    }
    field('resourceArea', resBoxes);
    const fp = F.take(12, 7, 2);
    if (fp) {
      for (let y = fp.y; y < fp.y + 7; y++) for (let x = fp.x; x < fp.x + 12; x++) if ((x + y) % 2 === 0) sim.addNode('tree', x, y, 'wood', BALANCE.tree.wood);
      ctx.ref('forestArea', areaOf([{ ...fp, w: 12, h: 7 }]));
      // two serfs chop wood (moving figures at the forest)
      const serfs = [...sim.entities.values()].filter((e) => e.kind === 'unit' && e.owner === P).slice(0, 2);
      const tree = [...sim.entities.values()].find((e) => e.kind === 'tree' && e.x === fp.x && e.y === fp.y);
      if (tree && serfs.length) sim.applyCommand({ type: 'assignWork', player: P, units: serfs.map((u) => u.id), target: tree.id });
    } else ctx.warn('No room for the forest');

    // ---------- Outside the area: bridge, bandit camp, rocks ----------
    const sites = bridgeSites(ctx, R, home);
    if (sites.length >= 1) {
      const s = sites[0];
      const b = sim.createBuilding(P, 'bridge', s.x, s.y, true);
      ctx.ref('bridge', b.id);
      ctx.ref('bridgeArea', { x: s.x + (s.w >> 1), y: s.y + (s.h >> 1), r: Math.max(s.w, s.h) });
    } else ctx.warn('No bridge site found');
    if (sites.length >= 2) ctx.ref('freeBridgeArea', { x: sites[1].x + (sites[1].w >> 1), y: sites[1].y + (sites[1].h >> 1), r: Math.max(sites[1].w, sites[1].h) });
    else ctx.warn('No second bridge site found');

    // Bandit camp outside the area, far from the troops
    const out = BAND + 12;
    const tries = [
      { x: left ? R.x1 + out : R.x0 - out, y: (R.y0 + R.y1) >> 1 },
      { x: (R.x0 + R.x1) >> 1, y: top ? R.y1 + out : R.y0 - out },
      { x: left ? R.x1 + out : R.x0 - out, y: top ? R.y1 + out : R.y0 - out },
    ].filter((p) => m.inBounds(p.x, p.y));
    let camp = null;
    for (const p of tries) {
      if (api.findOpen(sim, p.x, p.y, { maxR: 10, clear: 3, from: home })) { camp = ctx.camp('robbers', p, [{ def: 'sword1', count: 1, soldiers: 4 }, { def: 'bow1', count: 1, soldiers: 4 }], { r: 5, maxR: 10, from: home }); }
      if (camp) break;
    }
    if (!camp) ctx.warn('No room for the bandit camp');

    // Rocks: nearest steep slope outside the area
    let rock = null;
    for (const p of api.rings(home.x, home.y, 4, Math.max(m.width, m.height))) {
      if (!m.inBounds(p.x, p.y) || (p.x >= R.x0 - BAND && p.x <= R.x1 + BAND && p.y >= R.y0 - BAND && p.y <= R.y1 + BAND)) continue;
      if (m.flags[m.idx(p.x, p.y)] & CLIFF) { rock = p; break; }
    }
    if (rock) ctx.ref('rockArea', { ...rock, r: 4 });
  },

  start: [
    { type: 'npc', id: 'villager' },
    { type: 'npc', id: 'merchant' },
  ],

  // Signposts: side goals that are never fulfilled – only for "show goal" (camera jump)
  objectives: [
    ['heroArea', 'Helden, Feldgeschütz, Fußangeln, Gesprächsfiguren', 'Heroes, field gun, caltrops, talking figures'],
    ['troopArea', 'Truppen: jede Linie und Stufe mit Hauptmann', 'Troops: every line and tier with captain'],
    ['buildingArea', 'Gebäude in allen Ausbaustufen (links Stufe 1)', 'Buildings at every level (level 1 on the left)'],
    ['workerArea', 'Arbeiter jedes Berufs (stehen still)', 'Workers of every profession (standing still)'],
    ['siteArea', 'Baustellen 10/30/55/85 % und ein Ausbau', 'Construction sites 10/30/55/85 % and an upgrade'],
    ['ruinArea', 'Ruinen', 'Ruins'],
    ['rivalArea', 'Zweiter Spieler mit Lagerfeuer', 'Second player with campfire'],
    ['resourceArea', 'Schächte, Siedlungsplätze, Rohstoffhaufen', 'Shafts, settlement spots, resource piles'],
    ['forestArea', 'Wald mit Leibeigenen', 'Forest with serfs'],
    ['bridgeArea', 'Brücke über den Fluss', 'Bridge across the river'],
    ['freeBridgeArea', 'Freie Brückenstelle', 'Free bridge site'],
    ['robbersArea', 'Räuberlager', 'Bandit camp'],
    ['rockArea', 'Felsen und Berge', 'Rocks and mountains'],
  ].map(([area, de, en]) => ({ id: `see-${area}`, type: 'flag', flag: 'never', text: t(de, en), hint: { area } })),

  events: [],
};
