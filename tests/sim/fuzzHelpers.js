// Helpers for the fuzz/endurance test (tests/sim/fuzz.test.js): random but plausible command sequences (with seed) from several players,
// plus occasional nonsensical commands. Checks invariants after each section, determinism
// and that saving/loading mid-run continues exactly the same.

import { Sim } from '../../src/sim/sim.js';
import { createMissionSim } from '../../src/sim/missions/runtime.js';
import { BUILDINGS } from '../../src/sim/data/buildings.js';
import { TECHS } from '../../src/sim/data/technologies.js';
import { BUILDING_TECHS } from '../../src/sim/data/buildingTechs.js';
import { BLESSINGS } from '../../src/sim/data/professions.js';
import { LINES, HEROES } from '../../src/sim/data/units.js';
import { RESOURCES } from '../../src/sim/data/resources.js';

/** Small deterministic randomness for the command generator (mulberry32). */
export function mulberry(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { int: (n) => Math.floor(next() * n), pick: (arr) => arr[Math.floor(next() * arr.length)], chance: (p) => next() < p };
}

const BUILD_TYPES = Object.keys(BUILDINGS).filter((t) => BUILDINGS[t].buildable !== false);
const TECH_IDS = Object.keys(TECHS);
const BTECH_IDS = Object.keys(BUILDING_TECHS);
const LINE_IDS = Object.keys(LINES);
const GARBAGE = ['constructor', '__proto__', 'toString', 'hasOwnProperty', '', 'nope', undefined, null, 42];

/** Generate the commands of a player for this tick. */
export function randomCommand(sim, r, player) {
  const own = [], ownB = [], serfs = [], nodes = [], enemies = [], troops = [];
  for (const e of sim.entities.values()) {
    if (e.kind === 'tree' || e.kind === 'pile') { if (r.chance(0.02)) nodes.push(e); continue; }
    if (e.owner === player) {
      own.push(e);
      if (e.kind === 'building') ownB.push(e);
      else if (e.kind === 'unit') serfs.push(e);
      if (e.kind === 'leader' || e.kind === 'hero' || (e.kind === 'unit' && e.militia)) troops.push(e);
    } else if (e.owner >= 0 && e.kind !== 'ruin') enemies.push(e);
  }
  const W = sim.map.width, H = sim.map.height;
  const hq = ownB.find((b) => b.type === 'headquarters') ?? { x: W >> 1, y: H >> 1 };
  const someSerfs = () => serfs.filter(() => r.chance(0.3)).map((u) => u.id);
  const near = (c, d) => ({ x: c.x + r.int(2 * d + 1) - d, y: c.y + r.int(2 * d + 1) - d });
  const b = () => r.pick(ownB);
  const p = player;
  // now and then deliberately nonsensical commands (foreign IDs, prototype keys, coordinates outside)
  if (r.chance(0.04)) {
    const g = () => r.pick(GARBAGE);
    const bad = r.pick([
      { type: 'placeBuilding', player: p, building: g(), x: r.int(W * 3) - W, y: r.int(H * 3) - H },
      { type: 'research', player: p, building: b()?.id, tech: g() },
      { type: 'recruit', player: p, building: b()?.id, line: g(), full: true },
      { type: 'upgradeLine', player: p, line: g() },
      { type: 'bless', player: p, building: b()?.id, blessing: g() },
      { type: 'trade', player: p, building: b()?.id, give: g(), take: 'wood', amount: 50 },
      { type: 'changeWeather', player: p, building: b()?.id, state: g() },
      { type: 'ability', player: p, hero: troops.find((t) => t.kind === 'hero')?.id, ability: g() },
      { type: 'ability', player: p, hero: troops.find((t) => t.kind === 'hero')?.id, ability: r.pick(['bomb', 'turret', 'trap']), x: r.int(W * 3) - W, y: -5 },
      { type: 'move', player: p, units: someSerfs(), x: -3, y: H + 7 },
      { type: 'order', player: p, units: troops.map((t) => t.id), order: 'move', x: W + 20, y: -20 },
      { type: 'order', player: p, units: troops.map((t) => t.id), order: 'attackMove', x: -1, y: -1 },
      { type: 'buySerf', player: p, count: r.pick([-3, 0, 1e9, NaN, 2.5]) },
      { type: 'setTax', player: p, level: r.pick([-1, 5, 2.5, 'x', NaN]) },
      { type: 'assignWork', player: p, units: [r.int(5000)], target: r.int(5000) },
      { type: g(), player: p },
      { type: 'demolish', player: p, building: enemies.find((e) => e.kind === 'building')?.id },
    ]);
    return bad;
  }
  const kind = r.int(22);
  switch (kind) {
    case 0: return { type: 'buySerf', player: p, count: 1 + r.int(3) };
    case 1: case 2: case 3: {
      const type = r.pick(BUILD_TYPES);
      const pos = sim.findPlacement(p, type, hq.x + r.int(21) - 10, hq.y + r.int(21) - 10, 12);
      if (!pos) return null;
      return { type: 'placeBuilding', player: p, building: type, x: pos.x, y: pos.y, units: someSerfs() };
    }
    case 4: case 5: {
      const t = r.chance(0.5) && nodes.length ? r.pick(nodes) : b();
      if (!t) return null;
      return { type: 'assignWork', player: p, units: someSerfs(), target: t.id };
    }
    case 6: { const q = near(hq, 15); return { type: 'move', player: p, units: someSerfs(), x: q.x, y: q.y }; }
    case 7: return { type: 'setTax', player: p, level: r.int(5) };
    case 8: return { type: 'upgradeBuilding', player: p, building: b()?.id, units: someSerfs() };
    case 9: return r.chance(0.15) ? { type: 'demolish', player: p, building: b()?.id } : null;
    case 10: return { type: 'research', player: p, building: ownB.find((x) => x.type === 'university')?.id, tech: r.pick(TECH_IDS) };
    case 11: {
      const tech = r.pick(BTECH_IDS);
      const bb = ownB.find((x) => x.type === BUILDING_TECHS[tech].building);
      return { type: 'research', player: p, building: bb?.id, tech };
    }
    case 12: return { type: 'setOvertime', player: p, building: b()?.id, on: r.chance(0.5) };
    case 13: return { type: 'bless', player: p, building: ownB.find((x) => x.type === 'chapel')?.id, blessing: r.pick(Object.keys(BLESSINGS)) };
    case 14: {
      const line = r.pick(LINE_IDS);
      const bb = ownB.find((x) => x.type === LINES[line].building);
      return { type: 'recruit', player: p, building: bb?.id, line, full: r.chance(0.7) };
    }
    case 15: {
      const L = troops.find((t) => t.kind === 'leader');
      return L ? { type: 'buySoldiers', player: p, leader: L.id } : { type: 'upgradeLine', player: p, line: r.pick(LINE_IDS) };
    }
    case 16: case 17: {
      if (!troops.length) return null;
      const units = troops.filter(() => r.chance(0.6)).map((t) => t.id);
      const enemy = enemies.length ? r.pick(enemies) : null;
      const o = r.pick(['move', 'attackMove', 'attack', 'hold', 'idle']);
      if (o === 'attack' && enemy) return { type: 'order', player: p, units, order: 'attack', target: enemy.id };
      const q = enemy && r.chance(0.5) ? { x: enemy.x ?? (enemy.px / 1000) | 0, y: enemy.y ?? (enemy.py / 1000) | 0 } : near(hq, 20);
      return { type: 'order', player: p, units, order: o, x: q.x, y: q.y };
    }
    case 18: {
      const h = troops.find((t) => t.kind === 'hero');
      if (!h) return null;
      const ab = r.pick(Object.keys(HEROES[h.hero].abilities));
      const q = near({ x: (h.px / 1000) | 0, y: (h.py / 1000) | 0 }, 4);
      return { type: 'ability', player: p, hero: h.id, ability: ab, x: q.x, y: q.y };
    }
    case 19: return r.chance(0.1) ? { type: 'militia', player: p, on: r.chance(0.5) } : null;
    case 20: {
      const m = ownB.find((x) => x.type === 'storehouse');
      const give = r.pick(RESOURCES), take = r.pick(RESOURCES);
      return { type: 'trade', player: p, building: m?.id, give, take, amount: 50 * (1 + r.int(10)) };
    }
    case 21: return { type: 'changeWeather', player: p, building: ownB.find((x) => x.type === 'weatherPlant')?.id, state: r.pick(['summer', 'rain', 'winter']) };
    default: return null;
  }
}

const UNIT_KINDS = new Set(['unit', 'worker', 'leader', 'soldier', 'hero', 'turret', 'trap', 'bomb']);

/** Invariants of the state. Returns a list of violations (empty = all good). */
export function checkInvariants(sim) {
  const bad = [];
  const W = sim.map.width * 1000, H = sim.map.height * 1000;
  for (const p of sim.players) {
    for (const r of RESOURCES) {
      for (const acc of ['stock', 'raw']) {
        const v = p[acc][r];
        if (!Number.isInteger(v) || v < 0) bad.push(`P${p.id} ${acc}.${r}=${v}`);
      }
    }
    if (!Number.isInteger(p.faith) || p.faith < 0) bad.push(`P${p.id} faith=${p.faith}`);
    if (!(p.weatherEnergy >= 0)) bad.push(`P${p.id} weatherEnergy=${p.weatherEnergy}`);
  }
  for (const r of RESOURCES) if (!Number.isInteger(sim.market.prices[r]) || sim.market.prices[r] <= 0) bad.push(`price ${r}`);
  const get = (id) => sim.entities.get(id);
  for (const e of sim.entities.values()) {
    const tag = `${e.kind}#${e.id}`;
    if (UNIT_KINDS.has(e.kind)) {
      if (!Number.isInteger(e.px) || !Number.isInteger(e.py)) bad.push(`${tag} pos ${e.px},${e.py}`);
      else if (e.px < 0 || e.py < 0 || e.px >= W || e.py >= H) bad.push(`${tag} outside ${e.px},${e.py}`);
      if (e.hp !== undefined && !Number.isFinite(e.hp)) bad.push(`${tag} hp=${e.hp}`);
      if (e.kind !== 'hero' && e.hp !== undefined && e.hp <= 0) bad.push(`${tag} tot, aber vorhanden (hp ${e.hp})`);
      for (const t of e.path ?? []) if (!(t >= 0 && t < sim.map.width * sim.map.height)) { bad.push(`${tag} Pfad ${t}`); break; }
    } else if (e.x !== undefined) {
      if (!sim.map.inBounds(e.x, e.y)) bad.push(`${tag} outside ${e.x},${e.y}`);
    }
    if (e.kind === 'worker') {
      const wp = get(e.workplace);
      if (!wp || wp.kind !== 'building' || !wp.workers.includes(e.id)) bad.push(`${tag} Arbeitsplatz ${e.workplace}`);
      if (e.home && !get(e.home)?.residents?.includes(e.id)) bad.push(`${tag} house ${e.home}`);
      if (e.farm && !get(e.farm)?.eaters?.includes(e.id)) bad.push(`${tag} Hof ${e.farm}`);
    } else if (e.kind === 'building') {
      if (!Number.isFinite(e.hp)) bad.push(`${tag} hp=${e.hp}`);
      for (const [list, kind] of [['workers', 'worker'], ['residents', 'worker'], ['eaters', 'worker'], ['builders', 'unit']]) {
        for (const id of e[list]) if (get(id)?.kind !== kind) bad.push(`${tag} ${list} → ${id} missing`);
      }
      if (new Set(e.builders).size !== e.builders.length) bad.push(`${tag} duplicate builders`);
      for (const id of e.builders) { const u = get(id); if (u && u.job?.target !== e.id) bad.push(`${tag} builder ${id} works elsewhere`); }
      if (e.builders.length > 4) bad.push(`${tag} ${e.builders.length} Bauarbeiter`);
    } else if (e.kind === 'leader') {
      for (const id of e.soldiers) if (get(id)?.leader !== e.id) bad.push(`${tag} soldier ${id} missing`);
    } else if (e.kind === 'soldier') {
      if (get(e.leader)?.kind !== 'leader') bad.push(`${tag} without captain`);
    } else if (e.kind === 'unit' && e.job && (e.job.kind === 'build' || e.job.kind === 'repair')) {
      const t = get(e.job.target);
      if (t && t.kind === 'building' && !t.builders.includes(e.id)) bad.push(`${tag} builds at ${t.id}, but is not in builders`);
    }
    if (sim.players[e.owner]?.defeated && e.kind !== 'building') bad.push(`${tag} belongs to an eliminated player`);
  }
  return bad;
}

/**
 * One fuzz run. Commands are logged so that a loaded save game gets the same ones.
 * @returns {{ sim: Sim, hashes: number[], log: Map<number, any[]>, problems: string[] }}
 */
export function fuzzRun({ seed, size, players, ticks, rich = true, checkEvery = 250, replay = null, sim = null, from = 0, mission = null }) {
  sim ??= mission ? createMissionSim(mission) : new Sim({ seed, size, players });
  if (rich && from === 0) for (const p of sim.players) for (const r of RESOURCES) p.stock[r] += 20000;
  const r = mulberry(seed * 7919 + size);
  const log = new Map();
  const hashes = [];
  const problems = [];
  for (let t = from; t < ticks; t++) {
    let cmds;
    if (replay) cmds = replay.get(t) ?? [];
    else {
      cmds = [];
      for (let p = 0; p < sim.players.length; p++) {
        if (sim.players[p].defeated || sim.players[p].neutral || !r.chance(0.08)) continue;
        const c = randomCommand(sim, r, p);
        if (c) cmds.push(c);
      }
      // As over the network: only JSON content counts (NaN → null, undefined is dropped)
      cmds = JSON.parse(JSON.stringify(cmds));
      if (cmds.length) log.set(t, cmds);
    }
    const before = sim.players.map((p) => [sim.popUsed(p.id), sim.popLimit(p.id)]);
    try {
      sim.step(cmds.map((c) => ({ ...c })));
    } catch (err) {
      problems.push(`tick ${t}: exception ${err.stack}\nCommands: ${JSON.stringify(cmds)}`);
      break;
    }
    // Population: above the limit nothing new may be added (mission scripts deliberately place troops without limit)
    if (!mission) for (const p of sim.players) {
      const [used, lim] = before[p.id];
      const now = sim.popUsed(p.id);
      // Growth (purchase, recruitment, arrival) only up to the limit
      if (now > used && now > Math.max(lim, sim.popLimit(p.id))) problems.push(`tick ${t}: P${p.id} population ${used}→${now} at limit ${lim}`);
    }
    if ((t + 1) % checkEvery === 0) {
      hashes.push(sim.hash());
      const bad = checkInvariants(sim);
      if (bad.length) { problems.push(`tick ${t}: ${bad.slice(0, 8).join('; ')}`); break; }
    }
  }
  return { sim, hashes, log, problems };
}

