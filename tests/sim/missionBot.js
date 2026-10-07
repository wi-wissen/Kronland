// "Player" for mission tests: gives only the commands a human would give via the UI
// (no direct intervention in the state). It may read everything (perfect information).
//
// Two levels:
//   1. Small helpers (act, build, gatherWood, until …) for scripted playthroughs (playthroughs.js).
//   2. MissionBot: a usable player with build plan, serf management, housing/food,
//      mines/refiners, research, taxes, troops, defence, attacks on targets,
//      hero abilities, repair, militia and (mission 4) weather. One strategy per mission
//      (STRATEGIES) with build plan, army and a small script for the mission objectives.
//
// playMission(id, seed, opts) plays a mission through headless and returns a report
// (victory/defeat, objective times, resource curves, army size, losses).

import { UNIT } from '../../src/sim/fixed.js';
import { createMissionSim } from '../../src/sim/missions/runtime.js';
import { AiPlayer } from '../../src/ai/AiPlayer.js';
import { BUILDINGS, buildersOf, isUpgrading } from '../../src/sim/data/buildings.js';
import { TECHS } from '../../src/sim/data/technologies.js';
import { UNITS, unitOf, fullCost, LINE_UPGRADE_COST, HEROES } from '../../src/sim/data/units.js';
import { BUILDING_TECHS } from '../../src/sim/data/buildingTechs.js';
import { workerSlots, averageMotivation } from '../../src/sim/systems/workers.js';
import { isDamaged } from '../../src/sim/systems/damage.js';
import { siteRoom } from '../../src/sim/systems/serfs.js';
import { checkBuildingResearch } from '../../src/sim/systems/techs.js';
import { checkWeatherChange } from '../../src/sim/systems/weather.js';
import { checkTrade, tradeCost } from '../../src/sim/systems/market.js';
import { targetable } from '../../src/sim/systems/military.js';
import * as api from '../../src/sim/missions/setupApi.js';

export const P = 0;

// ---------------------------------------------------------------------------------------------
// Small helpers (for scripted playthroughs)
// ---------------------------------------------------------------------------------------------

export const serfs = (sim, owner = P) => [...sim.entities.values()].filter((e) => e.kind === 'unit' && e.owner === owner && !e.militia);
export const idle = (sim, owner = P) => serfs(sim, owner).filter((u) => !u.job && u.goal === undefined);
export const own = (sim, type, owner = P) => [...sim.entities.values()].filter((e) => e.kind === 'building' && e.owner === owner && e.type === type);
export const leaders = (sim, owner = P) => [...sim.entities.values()].filter((e) => e.kind === 'leader' && e.owner === owner);
export const hero = (sim, owner = P) => [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === owner);

/** Player command in the next tick; returns the events of this tick. */
export const act = (sim, cmd) => sim.step([{ player: P, ...cmd }]);

/** Place a building near the castle (or `near`) and build it with serfs. */
export function build(sim, type, n = 4, near = null) {
  const hq = sim.findBuilding(P, 'headquarters');
  const c = near ?? { x: hq.x + 2, y: hq.y + 2 };
  const pos = sim.findPlacement(P, type, c.x, c.y, 30);
  if (!pos) throw new Error(`no spot for ${type}: ${sim.checkPlacement(P, type, c.x, c.y)}`);
  const units = idle(sim).slice(0, n).map((u) => u.id);
  const ev = act(sim, { type: 'placeBuilding', building: type, x: pos.x, y: pos.y, units: units.length ? units : serfs(sim).slice(0, n).map((u) => u.id) });
  const placed = ev.find((e) => e.type === 'buildingPlaced');
  if (!placed) throw new Error(`Bau abgelehnt: ${JSON.stringify(ev.filter((e) => e.type === 'rejected'))}`);
  return placed.building;
}

/** Let free serfs chop wood. */
export function gatherWood(sim, k = 99) {
  const hq = sim.findBuilding(P, 'headquarters');
  const trees = [...sim.entities.values()].filter((e) => e.kind === 'tree')
    .sort((a, b) => ((a.x - hq.x) ** 2 + (a.y - hq.y) ** 2) - ((b.x - hq.x) ** 2 + (b.y - hq.y) ** 2) || a.id - b.id);
  idle(sim).slice(0, k).forEach((u, i) => sim.command({ player: P, type: 'assignWork', units: [u.id], target: trees[i % trees.length].id }));
}

/** Step until cond is met. */
export function until(sim, cond, max, every = null) {
  for (let i = 0; i < max; i++) {
    if (every && i % 50 === 0) every(sim);
    sim.step();
    if (cond(sim)) return true;
  }
  return false;
}

/** Let troops attack a point (tile). */
export function attackMove(sim, ids, p) {
  sim.command({ player: P, type: 'order', units: ids, order: 'attackMove', x: p.x, y: p.y });
}

export const tileOf = (e) => ({ x: Math.floor(e.px / UNIT), y: Math.floor(e.py / UNIT) });

export const objective = (sim, id) => sim.mission.state.objectives.find((o) => o.id === id);
export const stepId = (sim) => sim.mission.currentStep()?.id ?? null;

// ---------------------------------------------------------------------------------------------
// MissionBot
// ---------------------------------------------------------------------------------------------

const T = 10; // ticks per second
const RES = ['gold', 'wood', 'clay', 'stone', 'iron', 'sulfur'];
const FIGHTER = new Set(['leader', 'soldier', 'hero']);
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const tile = (e) => (e.kind === 'building' ? api.centerOf(e) : e.px !== undefined ? { x: Math.floor(e.px / UNIT), y: Math.floor(e.py / UNIT) } : { x: e.x, y: e.y });

/**
 * Strategies per mission. Fields:
 *   serfs        target number of serfs
 *   build        build plan [type, count, { at, level }] – the bot adds houses/farms itself as needed
 *   research     research order (university)
 *   techs        building technologies [tech ID] (if affordable)
 *   upgrades     upgrades [type, target level] (0-based)
 *   army         recruiting plan [line, count] (order = priority)
 *   lineUps      troop upgrades [line] (if affordable)
 *   reserve      thalers the construction must not touch (for the military)
 *   tax          'auto' | 'mood' (low to high motivation) | 'gold'
 *   script(bot)  mission-specific decisions (attack targets, send hero …)
 */
export const STRATEGIES = {
  c1: {
    serfs: 10,
    build: [['residence', 2], ['farm', 2], ['clayMine', 1], ['residence', 3], ['farm', 3]],
    research: [],
    army: [],
    militia: true,
    script(bot) {
      // the script leads the heroes: root, collectors, village elder
      bot.useHero = false;
      const nelia = bot.heroNamed('nelia'), orrin = bot.heroNamed('orrin');
      const st = bot.m.state;
      // first talk to Orrin on the village square, then to the old tree
      const seat = bot.npcAt('stranger');
      if (bot.objective('meet')?.status === 'active' && nelia && seat) {
        // construction sites on the way stop Nelia: stopped but not there yet → send again
        if (nelia.order?.type === 'idle' && d2(tile(nelia), seat) > 2 * 2) bot.cmd({ type: 'order', units: [nelia.id], order: 'move', x: seat.x, y: seat.y });
        else bot.moveUnits([nelia.id], seat, 'move', 'meet');
      }
      if (bot.objective('root')?.status === 'active' && nelia) bot.moveUnits([nelia.id], st.refs.oldRoot, 'move', 'root');
      const col = bot.m.idsOf('collectors').map((id) => bot.sim.entities.get(id)).find(Boolean);
      if (col) bot.moveUnits([nelia, orrin].filter(Boolean).map((h) => h.id), tile(col), 'attackMove', 'collectors');
      else if (bot.objective('neighbors')?.status === 'active' && orrin && bot.npcAt('elder')) bot.moveUnits([orrin.id], bot.npcAt('elder'), 'move', 'elder');
      bot.heroMicro = !!col;
    },
  },
  c2: {
    serfs: 14,
    build: [['farm', 3], ['storehouse', 1], ['clayMine', 1], ['stoneMine', 1], ['barracks', 1]],
    research: [],
    upgrades: [['storehouse', 1]],
    army: [['sword', 2]],
    reserve: 300,
    goldWant: 1800,
    tax: 'gold',
    militia: true,
    script(bot) {
      bot.useHero = false;
      const orrin = bot.heroNamed('orrin');
      // first Orrin's clay debt at the merchant, then buy Zacke free (the way without combat)
      if (orrin && bot.npcAt('merchant') && bot.m.state.npcs.merchant?.state === 'open') bot.moveUnits([orrin.id], bot.npcAt('merchant'), 'move', 'merchant');
      bot.payTribute('clay', 0);
      // first the market (needs thalers), then buy Zacke free
      if (bot.objective('market')?.status === 'done' && !bot.payTribute('buyShardCheap')) bot.payTribute('buyShard');
      // market: trade at least once
      const market = bot.buildings.find((b) => b.type === 'storehouse' && b.level >= 1 && b.done && !b.trade && b.workers.length);
      if (market && bot.objective('trade')?.status === 'active' && !checkTrade(bot.sim, P, market, 'wood', 'gold', 100)) bot.cmd({ type: 'trade', building: market.id, give: 'wood', take: 'gold', amount: 100 });
      // clay and stone for thalers for the buyout
      else if (market && bot.avail('gold') < 1500) {
        for (const give of ['clay', 'stone']) {
          if (bot.avail(give) >= 900 && !checkTrade(bot.sim, P, market, give, 'gold', 300)) { bot.cmd({ type: 'trade', building: market.id, give, take: 'gold', amount: 300 }); break; }
        }
      }
    },
  },
  c3: {
    script(bot) { scriptWeatherworks(bot); },
  },
  c4: {
    serfs: 16,
    build: [['ironMine', 1], ['sulfurMine', 1], ['clayMine', 1], ['stoneMine', 1], ['residence', 3], ['farm', 3]],
    research: ['standingArmy'],
    army: [],
    armyLater: [['sword', 4], ['bow', 3], ['sword', 6], ['spear', 2]],
    reserve: 400,
    militia: true,
    script(bot) {
      // mercenaries first (ready for combat immediately), then own troops
      if (bot.m.state.tributes.mercs === 'open') { bot.payTribute('mercs'); bot.s.army = []; } else bot.s.army = STRATEGIES.c4.armyLater;
      if (bot.objective('siege')?.status === 'active') bot.attack(['siegeAGuards', 'siegeBGuards'], { minStrength: 350 });
      const nelia = bot.heroNamed('nelia');
      if (nelia && bot.npcAt('miner') && bot.m.state.npcs.miner?.state === 'open') { bot.useHero = false; bot.moveUnits([nelia.id], bot.npcAt('miner'), 'move', 'miner'); }
    },
  },
  c5: {
    serfs: 16,
    build: [['farm', 4], ['clayMine', 1], ['stoneMine', 1], ['ironMine', 1], ['residence', 3]],
    research: ['standingArmy'],
    army: [['sword', 4], ['bow', 2], ['sword', 6]],
    reserve: 300,
    defend: ['moorbrookArea'],
    militia: true,
    script(bot) {
      for (const id of ['supplyAlderfarm', 'supplyMoorbrook', 'supplyReedham']) bot.payTribute(id, 0);
      // thalers first for the deliveries, then for the army
      bot.s.reserve = Object.values(bot.m.state.tributes).includes('open') ? 600 : 300;
      if (bot.objective('drive')?.status === 'active') bot.attack('loyalists', { minStrength: 250 });
      const nelia = bot.heroNamed('nelia');
      if (nelia && bot.npcAt('elder') && bot.m.state.npcs.elder?.state === 'open') { bot.useHero = false; bot.moveUnits([nelia.id], bot.npcAt('elder'), 'move', 'elder'); }
    },
  },
  c6: {
    serfs: 22,
    build: [
      ['weatherPlant', 1], ['archery', 1], ['clayMine', 1], ['stoneMine', 1], ['ironMine', 1], ['farm', 2], ['residence', 3], ['sulfurMine', 1],
      ['smithy', 1], ['storehouse', 1], ['stoneMine', 2], ['ironMine', 2],
    ],
    research: ['standingArmy', 'gears', 'alloys'],
    techs: ['leatherMail', 'softLeather', 'masonry', 'chainMail'],
    techGold: 900,
    army: [['sword', 2], ['bow', 4], ['sword', 6], ['spear', 2], ['sword', 9], ['bow', 5], ['sword', 12]],
    lineUps: ['sword'],
    reserve: 300,
    goldWant: 1200,
    tax: 'gold',
    rally: { toward: 'shore', from: 'humanHq', d: 12 },
    militia: true,
    script(bot) { scriptThroneLake(bot); },
  },
};

/**
 * Mission 3: through the gorge instead of the gate – post at the gorge (Orrin bribes a squad), over the
 * ice to the island, guards and weather works, before the thaw to the solid shore, then a hero into the ruins.
 */
function scriptWeatherworks(bot) {
  const { sim, m } = bot;
  const st = m.state, refs = st.refs;
  bot.useHero = false;
  bot.heroMicro = true;
  const heroes = bot.heroes.filter((h) => !h.down);
  const troops = bot.leaders.map((L) => L.id);
  const all = [...troops, ...heroes.map((h) => h.id)];
  const ww = sim.entities.get(refs.weatherworks);
  const isle = refs.isle;
  const orrin = bot.heroNamed('orrin'), nelia = bot.heroNamed('nelia');
  const near = (e, p, r) => d2(tile(e), p) < r * r;
  bot.c3 ??= 'gorge';
  if (bot.c3 === 'gorge') {
    // gather in front of the gorge (not past the gate)
    bot.moveUnits(all, refs.gorgeNear, 'move', 'gorgeNear');
    const there = all.filter((id) => near(sim.entities.get(id), refs.gorgeNear, 6)).length;
    if (there * 4 >= all.length * 3) bot.c3 = 'ford';
  } else if (bot.c3 === 'ford') {
    // post: Orrin bribes the nearest squad, the others clear the rest
    const guards = m.idsOf('fordGuards').map((id) => sim.entities.get(id)).filter((e) => e && e.owner === st.bandits);
    if (orrin && !orrin.down && guards.some((g) => near(g, tile(orrin), 4.5)) && (orrin.ready.bribe ?? 0) <= sim.tick && bot.avail('gold') >= 350) {
      bot.cmd({ type: 'ability', hero: orrin.id, ability: 'bribe' });
    }
    if (guards.length) bot.moveUnits(all, refs.gorgeFar, 'attackMove', 'gorgeFar');
    else bot.c3 = 'isle';
  } else if (bot.c3 === 'isle') {
    if (!ww) { bot.c3 = 'escape'; return; }
    const foesAtIsle = bot.enemies.some((e) => d2(tile(e), isle) < 14 * 14);
    const close = bot.leaders.some((L) => near(L, isle, 10));
    if (!close || foesAtIsle) bot.moveUnits(troops, isle, 'attackMove', 'isle');
    else bot.attackBuilding(troops, ww);
    // heroes follow the squad a bit behind; encourage on enemy contact
    const lead = bot.leaders.slice().sort((a, b) => d2(tile(a), isle) - d2(tile(b), isle))[0];
    const behind = lead ? api.toward(tile(lead), refs.gorgeFar, 3) : refs.gorgeFar;
    bot.moveUnits(heroes.map((h) => h.id), behind, 'attackMove', `behind${behind.x},${behind.y}`);
    if (nelia && !nelia.down && (nelia.ready.courage ?? 0) <= sim.tick && bot.leaders.some((L) => near(L, tile(nelia), 6)) && foesAtIsle) {
      bot.cmd({ type: 'ability', hero: nelia.id, ability: 'courage' });
    }
  } else if (bot.c3 === 'escape') {
    // off the ice: the heroes to the solid shore towards the ruins, the troops right behind
    bot.moveUnits(heroes.map((h) => h.id), refs.landing, 'move', 'landing');
    bot.moveUnits(troops, api.toward(refs.landing, isle, -4), 'move', 'landing');
    if (bot.objective('escape')?.status === 'done') bot.c3 = 'plans';
  } else if (bot.objective('plans')?.status === 'active') {
    const h = heroes[0];
    if (h) bot.moveUnits([h.id], refs.ruinsArea, 'move', 'ruins');
  }
}

/**
 * Mission 6: buy weather knowledge, weather power plant, gather army; archers shoot Malvor's power plant from the
 * shore together, then in winter over the ice to the castle.
 */
function scriptThroneLake(bot) {
  const { sim, m } = bot;
  bot.payTribute('scholars', 0);
  // first the weather power plant, then the army (otherwise the troops eat all thalers)
  bot.armyPlan ??= bot.s.army;
  bot.s.army = bot.placed.weatherPlant ? bot.armyPlan : [];
  const castle = m.state.refs.castle;
  const ready = bot.leaders.length >= 9;
  const p = sim.players[P];
  // Malvor's power plant first: as long as it stands, he thaws the lake as soon as we go onto the ice
  const malvorPlant = sim.entities.get(m.state.refs.malvorPlant);
  const archers = bot.leaders.filter((L) => UNITS[L.def].line === 'bow').map((L) => L.id);
  const go = malvorPlant && archers.length >= 4 && bot.leaders.length >= 8;
  bot.scriptUnits = new Set(go ? archers : []);
  if (go) {
    bot.attackBuilding(archers, malvorPlant);
    // the rest of the army covers the archers at the shore
    const works = m.state.refs.worksIsle;
    const cover = api.findOpen(sim, ...Object.values(api.toward(works, bot.home, works.r + 7)), { maxR: 5, from: bot.home }) ?? bot.home;
    bot.rallyAt = cover;
  } else bot.rallyAt = null;
  if (malvorPlant) return;
  // winter only when the army is ready and energy is there
  if (ready && sim.weather.state !== 'winter' && (p.weatherEnergy ?? 0) >= 1000) bot.weather('winter');
  if (sim.weather.state === 'winter' || bot.attacking) {
    if (sim.entities.has(castle)) bot.attack(['castle'], { minStrength: 0, minLeaders: 6, retreat: 15, needHero: 'nelia' });
  }
}

export class MissionBot {
  /**
   * @param {import('../../src/sim/sim.js').Sim} sim
   * @param {{ passive?: boolean, strategy?: any, think?: number }} [opts]
   *   passive: economy only, no troops, no defence (control sample for difficulty)
   */
  constructor(sim, opts = {}) {
    this.sim = sim;
    this.m = sim.mission;
    this.id = this.m.def.id;
    this.s = { serfs: 12, build: [], research: [], army: [], reserve: 0, tax: 'auto', ...(opts.strategy ?? STRATEGIES[this.id] ?? {}) };
    this.passive = !!opts.passive;
    this.think = opts.think ?? 10;
    this.useHero = true;
    this.orders = new Map(); // unit → last given command (key), so that not every tick re-commands
    this.attacking = null;
    /** Units that the mission script leads itself */
    this.scriptUnits = new Set();
  }

  // ---------- Situation picture ----------

  objective(id) { return this.m.state.objectives.find((o) => o.id === id); }
  heroEntity() { return this.sim.entities.get(this.m.state.refs.hero) ?? null; }
  /** Own hero with this name (or null). */
  heroNamed(id) { return [...this.sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === P && e.hero === id) ?? null; }
  /** Pay the mission tribute if it is open and affordable (like the button in the UI). */
  payTribute(id, reserve = 0) {
    const d = this.m.def.tributes?.[id];
    if (!d || this.m.state.tributes[id] !== 'open' || !this.canAfford(d.cost, reserve)) return false;
    this.cmd({ type: 'mission', action: 'tribute', id });
    return true;
  }
  /** Position of a conversation figure (or null). */
  npcAt(id) { const n = this.m.state.npcs[id]; const e = n && this.sim.entities.get(n.entity); return e ? tile(e) : null; }

  scan() {
    const sim = this.sim;
    const hq = sim.findBuilding(P, 'headquarters');
    this.hq = hq;
    this.home = hq ? api.centerOf(hq) : this.home ?? sim.starts[P];
    this.buildings = []; this.serfList = []; this.leaders = []; this.heroes = []; this.workers = 0;
    this.enemies = []; this.count = {}; this.placed = {}; this.sites = [];
    for (const e of sim.entities.values()) {
      if (e.owner === P) {
        if (e.kind === 'building') {
          this.buildings.push(e);
          this.placed[e.type] = (this.placed[e.type] ?? 0) + 1;
          if (e.done) this.count[e.type] = (this.count[e.type] ?? 0) + 1;
          if (!e.done) this.sites.push(e);
        } else if (e.kind === 'unit') this.serfList.push(e);
        else if (e.kind === 'leader') this.leaders.push(e);
        else if (e.kind === 'hero') this.heroes.push(e);
        else if (e.kind === 'worker') this.workers++;
      } else if (e.owner !== undefined && e.owner >= 0 && e.owner !== P && sim.hostile(P, e.owner) && !sim.players[e.owner]?.defeated) {
        if ((FIGHTER.has(e.kind) && !(e.kind === 'hero' && e.down)) || (e.kind === 'unit' && e.militia)) this.enemies.push(e);
      }
    }
    // danger zones: bandit camps with guards, enemy castles
    this.danger = [];
    for (const c of this.m.state.camps) if (c.guards.some((id) => sim.entities.has(id))) this.danger.push({ x: c.x, y: c.y, r: c.r + 6 });
    for (const p of sim.players) {
      if (p.id === P || p.neutral || p.defeated || !sim.hostile(P, p.id)) continue;
      const ehq = sim.findBuilding(p.id, 'headquarters');
      if (ehq) this.danger.push({ ...api.centerOf(ehq), r: 26 });
    }
    // enemies that threaten our buildings or protection targets
    const guardPts = [this.home, ...this.buildings.filter((b) => b.type !== 'headquarters').map(api.centerOf)];
    for (const name of this.s.defend ?? []) { const p = this.m.pointOf(sim, name); if (p) guardPts.push(p); }
    // camp guards that stand calmly at their camp are no attack
    const atCamp = new Set();
    for (const c of this.m.state.camps) {
      for (const id of c.guards) {
        const L = sim.entities.get(id);
        if (!L || d2(tile(L), c) > (c.r + 2) ** 2) continue;
        atCamp.add(id);
        for (const s of L.soldiers) atCamp.add(s);
      }
    }
    this.threats = this.enemies.filter((e) => {
      if (atCamp.has(e.id)) return false;
      const p = tile(e);
      return guardPts.some((g) => d2(g, p) <= 13 * 13);
    }).sort((a, b) => d2(tile(a), this.home) - d2(tile(b), this.home) || a.id - b.id);
  }

  has(type, n = 1) { return (this.count[type] ?? 0) >= n; }
  avail(r) { return this.sim.available(P, r); }
  /** Affordable while keeping the thaler reserve. */
  canAfford(cost, reserve = 0) {
    for (const [r, n] of Object.entries(cost)) if (this.avail(r) < n + (r === 'gold' ? reserve : 0)) return false;
    return true;
  }
  isDangerous(p, extra = 0) { return this.danger.some((z) => d2(z, p) < (z.r + extra) ** 2); }
  cmd(c) { this.sim.command({ player: P, ...c }); }

  // ---------- Tick ----------

  /** Call before every sim.step(). */
  update() {
    if (this.sim.tick % this.think !== 0 || this.m.state.result) return;
    this.scan();
    // without a castle (command mission): only the mission script and the hero abilities
    if (!this.hq) { if (!this.passive) { this.s.script?.(this); this.micro(); this.abilities(); } return; }
    this.reserved = new Set();
    this.economy();
    if (!this.passive) {
      this.s.script?.(this);
      this.military();
    }
    this.assignSerfs();
  }

  // ---------- Economy ----------

  economy() {
    this.buySerfs();
    this.trade();
    this.taxes();
    this.research();
    if (!this.passive) this.buildingTechs();
    this.planBuildings();
    this.upgrades();
    this.repair();
  }

  /** Marketplace: trade surpluses for scarce goods (mainly thalers for the army). */
  trade() {
    const market = this.buildings.find((b) => b.type === 'storehouse' && b.level >= 1 && b.done && !b.trade && b.workers.length);
    if (!market) return;
    const want = { gold: this.s.goldWant ?? 1000, wood: 600, clay: 400, stone: 600, iron: 500, sulfur: 300 };
    const need = RES.filter((r) => this.avail(r) < want[r]).sort((a, b) => this.avail(a) / want[a] - this.avail(b) / want[b])[0];
    if (!need) return;
    const surplus = RES.filter((r) => r !== need && r !== 'gold' && this.avail(r) > want[r] * 3).sort((a, b) => this.avail(b) / want[b] - this.avail(a) / want[a]);
    for (const give of surplus) {
      for (const amount of [300, 150, 50]) {
        if (checkTrade(this.sim, P, market, give, need, amount)) continue;
        if (tradeCost(this.sim, give, need, amount) > (this.avail(give) - want[give]) / 2) continue;
        this.cmd({ type: 'trade', building: market.id, give, take: need, amount });
        return;
      }
    }
  }

  buySerfs() {
    const sim = this.sim;
    const free = sim.popLimit(P) - sim.popUsed(P);
    const n = Math.min(this.s.serfs - this.serfList.length, free - 1, Math.floor((this.avail('gold') - (this.passive ? 0 : this.s.reserve) / 2) / 50), 4);
    if (n > 0) this.cmd({ type: 'buySerf', count: n });
  }

  taxes() {
    const p = this.sim.players[P];
    if (!p.techs.has('education')) return;
    const mot = averageMotivation(this.sim, P);
    let want;
    if (this.s.tax === 'mood') want = this.objective('mood')?.status === 'active' ? (mot < 115 ? 1 : 2) : (mot > 120 ? 3 : 2);
    else if (this.s.tax === 'gold') want = mot > 115 ? 4 : mot > 85 ? 3 : mot < 60 ? 1 : 2;
    else want = mot > 130 ? 3 : mot < 70 ? 1 : 2;
    if (want !== p.taxLevel) this.cmd({ type: 'setTax', level: want });
  }

  research() {
    const sim = this.sim;
    const uni = this.buildings.find((b) => b.type === 'university' && b.done && !b.research);
    if (!uni) return;
    for (const t of this.s.research) {
      if (sim.players[P].techs.has(t)) continue;
      if (sim.checkResearch(P, uni, t)) continue;
      this.cmd({ type: 'research', building: uni.id, tech: t });
      return;
    }
  }

  buildingTechs() {
    for (const t of this.s.techs ?? []) {
      if (this.sim.players[P].techs.has(t)) continue;
      const def = BUILDING_TECHS[t];
      if (!this.canAfford(def.cost, this.s.reserve + (this.s.techGold ?? 200))) continue;
      const b = this.buildings.find((x) => x.type === def.building && !checkBuildingResearch(this.sim, P, x, t));
      if (!b) continue;
      this.cmd({ type: 'research', building: b.id, tech: t });
      return;
    }
  }

  /** Building spot centre for a building type. */
  siteFor(type, o = {}) {
    const sim = this.sim;
    if (o.at) return this.m.pointOf(sim, o.at);
    if (o.toward) {
      const to = this.m.pointOf(sim, o.toward);
      if (to) return api.toward(this.home, to, o.d ?? 8);
    }
    // housing/food/workshops: in a semicircle towards the map centre around the castle
    const mc = { x: sim.map.width >> 1, y: sim.map.height >> 1 };
    return api.toward(this.home, mc, 6);
  }

  /** Place a building. @returns {boolean} */
  place(type, o = {}) {
    const sim = this.sim, def = BUILDINGS[type];
    if (def.requires && !sim.players[P].techs.has(def.requires)) return 'tech';
    const cost = def.levels[0].cost;
    if (!this.canAfford(cost, ['barracks', 'archery', 'villageCenter', 'foundry'].includes(type) ? 0 : this.s.reserve)) return 'money';
    let pos = null;
    if (def.placement === 'free') {
      // desired location, otherwise around the castle; never in danger zones
      const cands = [this.siteFor(type, o), this.siteFor(type, {})];
      for (const r of [8, 13, 18]) for (const [dx, dy] of [[1, 1], [1, 0], [0, 1], [1, -1], [-1, 1], [-1, 0], [0, -1], [-1, -1]]) cands.push({ x: this.home.x + dx * r, y: this.home.y + dy * r });
      for (const c of cands) {
        pos = sim.findPlacement(P, type, c.x, c.y, 8);
        if (pos && (this.isDangerous({ x: pos.x + 1, y: pos.y + 1 }) || api.dist(pos, this.home) > 34)) pos = null;
        if (pos) break;
      }
    } else {
      const near = o.at ? this.m.pointOf(sim, o.at) : this.home;
      const list = def.placement === 'settlement' ? sim.spots : sim.shafts.filter((s) => s.res === def.shaftResource);
      const ok = list.filter((s) => !sim.checkPlacement(P, type, s.x, s.y) && !this.isDangerous({ x: s.x + 1, y: s.y + 1 }, type === 'villageCenter' ? 0 : 4) && api.dist(s, this.home) <= 45)
        .sort((a, b) => d2(a, near) - d2(b, near) || a.x - b.x || a.y - b.y);
      pos = ok[0] ?? null;
    }
    if (!pos) return 'spot';
    const units = this.idleSerfs().slice(0, 4).map((u) => u.id);
    this.cmd({ type: 'placeBuilding', building: type, x: pos.x, y: pos.y, units });
    units.forEach((id) => this.reserved.add(id));
    this.placed[type] = (this.placed[type] ?? 0) + 1;
    this.sites.push({ type });
    return true;
  }

  planBuildings() {
    const maxSites = this.serfList.length >= 16 ? 4 : 3;
    if (this.sites.length >= maxSites) return;
    // demand for beds and dining places from workplaces (also planned ones)
    let beds = 0, seats = 0, slots = 0;
    for (const b of this.buildings) {
      const lv = BUILDINGS[b.type].levels[b.done ? b.level : Math.max(0, b.level - 1)];
      if (b.type === 'residence') beds += BUILDINGS.residence.levels[b.done ? b.level : 0].beds;
      if (b.type === 'farm') seats += BUILDINGS.farm.levels[b.done ? b.level : 0].seats;
      slots += lv.workers ?? 0;
    }
    // population limit: another village centre on a safe settlement spot or upgrade
    const free = this.sim.popLimit(P) - this.sim.popUsed(P);
    if (free < 14 && !this.sites.some((b) => b.type === 'villageCenter')) {
      const vc = this.buildings.find((b) => b.type === 'villageCenter' && b.done && !this.sim.checkUpgrade(P, b));
      if (vc && this.canAfford(BUILDINGS.villageCenter.levels[vc.level + 1].cost, this.s.reserve)) {
        this.cmd({ type: 'upgradeBuilding', building: vc.id }); // runs on its own, no serfs
        return;
      }
      if (this.place('villageCenter') === true) return;
    }
    if (beds < slots && this.place('residence') === true) return;
    if (seats < slots && this.place('farm') === true) return;
    for (const [type, n, o] of this.s.build) {
      if ((this.placed[type] ?? 0) >= n) continue;
      // only after a goal (e.g. ford free), otherwise skip
      if (o?.after && ['active', 'hidden'].includes(this.objective(o.after)?.status)) continue;
      const r = this.place(type, o ?? {});
      if (r === true) return;
      // wait for resources so that cheaper buildings do not buy everything away
      if (r === 'money' && ['villageCenter', 'barracks', 'university', 'archery', 'foundry'].includes(type)) return;
    }
    // more workplaces as long as the target (worker count) is higher
    if (this.s.workers && slots < this.s.workers + 2) {
      for (const type of ['stoneMine', 'clayMine', 'ironMine', 'sulfurMine', 'sawmill', 'brickworks', 'smithy', 'alchemist', 'stonemason']) {
        if ((this.placed[type] ?? 0) >= (type.endsWith('Mine') ? 3 : 2)) continue;
        if (this.place(type) === true) return;
      }
    }
  }

  upgrades() {
    if (this.sites.length >= 4) return;
    for (const [type, lvl] of this.s.upgrades ?? []) {
      const b = this.buildings.find((x) => x.type === type && x.done && x.level < lvl);
      if (!b || this.sim.checkUpgrade(P, b)) continue;
      if (!this.canAfford(BUILDINGS[type].levels[b.level + 1].cost, this.s.reserve)) continue;
      this.cmd({ type: 'upgradeBuilding', building: b.id }); // runs on its own, no serfs
      return;
    }
  }

  repair() {
    if (this.threats.length > 2) return;
    const damaged = this.buildings.filter((b) => b.done && isDamaged(this.sim, b) && b.builders.length < 3)
      .sort((a, b) => (b.burning ? 1 : 0) - (a.burning ? 1 : 0) || a.hp - b.hp);
    for (const b of damaged.slice(0, 2)) {
      const c = api.centerOf(b);
      if (this.enemies.some((e) => d2(tile(e), c) < 8 * 8)) continue;
      const ids = this.idleSerfs().concat(this.serfList.filter((u) => u.job?.kind === 'gather'))
        .filter((u) => !this.reserved.has(u.id))
        .sort((u, v) => d2(tile(u), c) - d2(tile(v), c) || u.id - v.id)
        .slice(0, (b.burning ? 4 : 2) - b.builders.length).map((u) => u.id);
      const room = ids.length ? siteRoom(this.sim, b, this.sim.entities.get(ids[0])) : 0;
      ids.length = Math.min(ids.length, room);
      if (!ids.length) continue;
      this.cmd({ type: 'assignWork', units: ids, target: b.id });
      ids.forEach((id) => this.reserved.add(id));
    }
  }

  idleSerfs() {
    return this.serfList.filter((u) => !u.militia && !u.job && u.goal === undefined && !this.reserved?.has(u.id));
  }

  /** Serfs: construction sites first, then wood or scarce resources at safe piles. */
  assignSerfs() {
    if (this.serfList.some((u) => u.militia)) return;
    for (const b of this.sites) {
      if (!b.id || isUpgrading(b) || b.builders.length >= buildersOf(b.type)) continue;
      if (this.isDangerous(api.centerOf(b)) || this.enemies.some((e) => d2(tile(e), api.centerOf(b)) < 7 * 7)) continue;
      // idle ones first; if a construction site is completely empty, also pull away gatherers (piles otherwise hold them forever)
      let pool = this.idleSerfs();
      if (!pool.length && !b.builders.length) pool = this.serfList.filter((u) => !u.militia && u.job?.kind === 'gather' && !this.reserved?.has(u.id));
      pool.sort((u, v) => d2(tile(u), api.centerOf(b)) - d2(tile(v), api.centerOf(b)) || u.id - v.id);
      // do not send more than there are free spots around
      const room = pool.length ? siteRoom(this.sim, b, pool[0]) : 0;
      if (pool.length && !room) continue;
      const ids = pool.slice(0, Math.min(room, Math.min(2, buildersOf(b.type) - b.builders.length) + (this.idleSerfs().length ? 2 : 0))).map((u) => u.id);
      if (!ids.length) break;
      this.cmd({ type: 'assignWork', units: ids, target: b.id });
      ids.forEach((id) => this.reserved.add(id));
    }
    // recall serfs at trees that stand too close to enemies (otherwise the follow-up work
    // after a felled tree easily lands on a tree in the middle of the siege ring)
    const nodes = this.safeNodes();
    const recall = this.serfList.filter((u) => {
      if (u.militia || u.job?.kind !== 'gather' || this.reserved?.has(u.id)) return false;
      const t = this.sim.entities.get(u.job.target);
      return t && (this.isDangerous(t, 3) || this.enemies.some((f) => d2(tile(f), t) < 8 * 8));
    });
    const idle = this.idleSerfs().concat(recall);
    if (!idle.length) return;
    const needs = ['stone', 'iron', 'clay', 'sulfur'].filter((r) => this.avail(r) < 400 && !this.has(`${r}Mine`));
    idle.forEach((u, i) => {
      const res = needs.length && i % 3 === 2 ? needs[(i / 3 | 0) % needs.length] : 'wood';
      const list = nodes[res]?.length ? nodes[res] : nodes.wood;
      if (!list?.length) return;
      const p = tile(u);
      let best = null, bd = Infinity;
      for (const n of list.slice(0, 40)) { const d = d2(n, p) + d2(n, this.home) / 2; if (d < bd) { bd = d; best = n; } }
      if (best) this.cmd({ type: 'assignWork', units: [u.id], target: best.id });
    });
  }

  /** Reachable trees/piles outside danger zones, by distance to the castle. */
  safeNodes() {
    const out = {};
    const all = [];
    for (const e of this.sim.entities.values()) {
      if ((e.kind !== 'tree' && e.kind !== 'pile') || e.amount <= 0) continue;
      if (d2(e, this.home) > 36 * 36 || this.isDangerous(e, 3)) continue;
      if (this.enemies.some((f) => d2(tile(f), e) < 8 * 8)) continue;
      all.push(e);
    }
    all.sort((a, b) => d2(a, this.home) - d2(b, this.home) || a.id - b.id);
    for (const e of all) (out[e.res] ??= []).push(e);
    return out;
  }

  // ---------- Military ----------

  army() { return this.leaders; }

  strength(list) {
    let s = 0;
    for (const e of list) {
      if (e.kind === 'leader') s += UNITS[e.def].attack * (e.soldiers.length + 1);
      else if (e.kind === 'hero') s += 40;
      else if (e.kind === 'unit') s += 6;
    }
    return s;
  }

  military() {
    this.lineUps();
    this.recruit();
    this.refill();
    this.commandArmy();
    this.micro();
    this.abilities();
  }

  /**
   * Fine control like a human: whoever attacks a building while enemy troops are
   * nearby is redirected to the nearest enemy unit.
   */
  micro() {
    const sim = this.sim;
    const foes = this.enemies.filter((e) => targetable(this.sim, e));
    if (!foes.length) return;
    for (const e of [...this.leaders, ...this.heroes]) {
      if (e.kind === 'hero' && (e.down || (!this.useHero && !this.heroMicro))) continue;
      if (this.scriptUnits.has(e.id) && !this.heroMicro) continue;
      const t = e.targetId ? sim.entities.get(e.targetId) : null;
      if (t && t.kind !== 'building') continue;
      if (e.order?.type === 'move') continue;
      const p = tile(e);
      const r = this.attacking?.phase === 'strike' ? (this.attacking.microR ?? 6) : 6;
      let best = null, bd = r * r + 1;
      for (const f of foes) { const d = d2(tile(f), p); if (d < bd) { bd = d; best = f; } }
      if (!best) continue;
      this.orders.set(e.id, `micro:${best.id}`);
      this.cmd({ type: 'order', units: [e.id], order: 'attack', target: best.id });
    }
  }

  recruit() {
    const sim = this.sim;
    const byLine = {};
    for (const L of this.leaders) byLine[UNITS[L.def].line] = (byLine[UNITS[L.def].line] ?? 0) + 1;
    for (const [line, n] of this.s.army) {
      if ((byLine[line] ?? 0) >= n) continue;
      const bType = { sword: 'barracks', spear: 'barracks', bow: 'archery', cannon: 'foundry' }[line];
      const b = this.buildings.find((x) => x.type === bType && x.done);
      if (!b) continue;
      const def = unitOf(line, sim.players[P].unitTier[line]);
      if (sim.popUsed(P) + def.pop * (1 + def.soldiers) > sim.popLimit(P)) continue;
      if (!this.canAfford(fullCost(def))) return; // save up instead of buying a cheaper line
      this.cmd({ type: 'recruit', building: b.id, line, full: true });
      return;
    }
  }

  lineUps() {
    for (const line of this.s.lineUps ?? []) {
      const tier = this.sim.players[P].unitTier[line];
      const cost = LINE_UPGRADE_COST[`${line}${tier}`];
      if (!cost || this.sim.checkLineTier(P, line, tier + 1)) continue;
      if (!this.canAfford(cost, this.s.lineUpReserve ?? 600)) continue;
      this.cmd({ type: 'upgradeLine', line });
      return;
    }
  }

  refill() {
    for (const L of this.leaders) {
      const d = UNITS[L.def];
      if (L.soldiers.length >= d.soldiers || !this.canAfford(d.soldierCost)) continue;
      const b = this.buildings.find((x) => x.type === d.building && x.done);
      if (!b) continue;
      const p = tile(L);
      if (p.x >= b.x - 5 && p.x <= b.x + b.w + 5 && p.y >= b.y - 5 && p.y <= b.y + b.h + 5) this.cmd({ type: 'buySoldiers', leader: L.id });
    }
  }

  /** Give a command only if it has changed or the unit is idle. */
  moveUnits(ids, p, order, key) {
    const sim = this.sim;
    const give = ids.filter((id) => {
      const e = sim.entities.get(id);
      if (!e || (e.kind === 'hero' && e.down)) return false;
      const k = `${key}:${p.x},${p.y}`;
      if (this.orders.get(id) !== k) { this.orders.set(id, k); return true; }
      // idle, but not there yet → again
      return e.order?.type === 'idle' && !e.targetId && d2(tile(e), p) > 5 * 5;
    });
    if (give.length) this.cmd({ type: 'order', units: give, order, x: p.x, y: p.y });
  }

  rallyPoint() {
    if (this.rallyAt) return this.rallyAt; // set by the mission script
    const r = this.s.rally;
    if (r) {
      const from = this.m.pointOf(this.sim, r.from) ?? this.home;
      const to = this.m.pointOf(this.sim, r.toward);
      if (to) return api.findOpen(this.sim, ...Object.values(api.toward(from, to, r.d)), { maxR: 6, from: this.home }) ?? from;
    }
    const mc = { x: this.sim.map.width >> 1, y: this.sim.map.height >> 1 };
    return api.findOpen(this.sim, ...Object.values(api.toward(this.home, mc, 8)), { maxR: 6, from: this.home }) ?? this.home;
  }

  /**
   * Attack a target (from the mission script). Gather troops until the strength suffices, then
   * attack-move to the target; retreat on heavy losses.
   */
  attack(ref, o = {}) {
    this.attackGoal = { ref, ...o };
  }

  commandArmy() {
    const sim = this.sim;
    const hero = this.useHero ? this.heroes.filter((h) => !h.down) : [];
    const army = this.leaders.filter((L) => !this.scriptUnits.has(L.id));
    const ids = army.map((L) => L.id);
    const all = [...ids, ...hero.map((h) => h.id)];
    const goal = this.attackGoal;
    this.attackGoal = null;

    // 1. Defend – unless a small squad disturbs while the army is already attacking (then militia)
    const threatStr = this.strength(this.threats.filter((e) => e.kind !== 'soldier')) + this.threats.filter((e) => e.kind === 'soldier').length * 12;
    const core = [this.home, ...(this.s.defend ?? []).map((n) => this.m.pointOf(sim, n)).filter(Boolean)];
    const nearCore = this.threats.some((e) => core.some((g) => d2(tile(e), g) < 10 * 10));
    const minor = this.attacking && threatStr < Math.max(120, this.strength(army) * 0.3);
    if (this.threats.length && !minor) {
      this.defend(all);
      if (this.s.militia && nearCore && threatStr > this.strength([...army, ...hero]) + 30) this.cmd({ type: 'militia', on: true });
      if (this.attacking) this.attacking = null;
      return;
    }
    if (this.threats.length && minor && nearCore && this.s.militia) this.cmd({ type: 'militia', on: true });
    else if (this.serfList.some((u) => u.militia)) this.cmd({ type: 'militia', on: false });

    // 2. Attack (for lists: first target still standing, e.g. first towers, then castle)
    if (goal) {
      if (Array.isArray(goal.ref)) {
        let pick = null;
        for (const r of goal.ref) {
          const alive = this.m.idsOf(r).map((id) => sim.entities.get(id)).filter(Boolean)
            .sort((a, b) => d2(tile(a), this.home) - d2(tile(b), this.home) || a.id - b.id);
          if (alive.length) { pick = alive[0].id; break; }
        }
        goal.ref = pick ?? goal.ref.at(-1);
      }
      const target = this.m.pointOf(sim, goal.ref);
      // during an attack only the dispatched group counts; reinforcements wait at the rally point
      const group = this.attacking?.group;
      const inGroup = (e) => !group || group.has(e.id);
      const str = this.strength(goal.heroOnly ? hero : [...army.filter(inGroup), ...hero]);
      const units = goal.heroOnly ? hero.map((h) => h.id) : all.filter((id) => !group || group.has(id) || hero.some((h) => h.id === id));
      // superiority: own strength against the whole enemy army (perfect information)
      const foeStr = goal.edge ? this.strength(this.enemies.filter((e) => e.kind === 'leader' && !sim.players[e.owner]?.neutral)) : 0;
      // attack with the hero – unless he lies unconscious far from home (does not get up there)
      const heroReady = !goal.needHero || this.heroes.some((h) => h.hero === goal.needHero
        && ((!h.down && h.hp * 2 > HEROES[h.hero].hp) || (h.down && d2(tile(h), this.home) > 30 * 30)));
      if (!this.attacking && target && heroReady && sim.tick >= (this.retreatUntil ?? 0) && sim.tick >= (goal.notBefore ?? 0) * 600 && str >= Math.max(goal.minStrength ?? 0, foeStr * (goal.edge ?? 0)) && army.length >= (goal.minLeaders ?? 0) && units.length) {
        this.attacking = { start: str, since: sim.tick, phase: goal.stage ? 'approach' : 'strike', microR: goal.microR, group: new Set(army.map((L) => L.id)) };
      }
      if (this.attacking && target) {
        // retreat on heavy losses – unless the target is already half destroyed (then push through)
        const tgt = this.m.entityOf(sim, goal.ref);
        const nearlyDone = tgt?.kind === 'building' && tgt.hp * 2 < BUILDINGS[tgt.type].levels[tgt.level].hp;
        if ((!nearlyDone && str < this.attacking.start * (goal.retreat ?? 35) / 100) || !units.length) {
          this.attacking = null; // retreat, regroup
          this.retreatUntil = sim.tick + 90 * T;
          this.retreats = (this.retreats ?? 0) + 1;
        } else {
          const ent = this.m.entityOf(sim, goal.ref);
          if (this.attacking.phase === 'approach') {
            // rally point in front of the target (outside tower range), then strike together
            const stage = api.findOpen(sim, ...Object.values(api.toward(target, this.home, goal.stage)), { maxR: 5 }) ?? target;
            // attack-move: enemies on the way (gate guard, cannons) are fought, not walked through
            this.moveUnits(units, stage, 'attackMove', `stage${goal.ref}`);
            const there = units.filter((id) => { const e = sim.entities.get(id); return e && d2(tile(e), stage) < 7 * 7; }).length;
            if (there >= units.length * 0.7 || sim.tick - this.attacking.since > 90 * T) {
              this.attacking.phase = 'strike';
              this.attacking.stagePt = stage;
              // encourage at the rally point: lasts 60 s, enough for the assault
              for (const h of hero) if (h.hero === 'nelia' && (h.ready.courage ?? 0) <= sim.tick) this.cmd({ type: 'ability', hero: h.id, ability: 'courage' });
            }
          } else if (ent?.kind === 'building') {
              // attack the building specifically; enemies nearby are handled by micro()
            const close = units.some((id) => { const e = sim.entities.get(id); return e && d2(tile(e), target) < 9 * 9; });
            const foesNear = this.enemies.some((e) => d2(tile(e), target) < 12 * 12 && e.kind !== 'hero');
            if (goal.stage) {
              // heroes stay behind the front (aura of strength, healing), the troops storm
              const heroIds = hero.map((h) => h.id);
              const behind = this.attacking.stagePt ?? target;
              this.attackBuilding(units.filter((id) => !heroIds.includes(id)), ent);
              this.moveUnits(heroIds, behind, 'move', `behind${goal.ref}`);
            } else if (close && !foesNear) this.attackBuilding(units, ent);
            else this.moveUnits(units, target, 'attackMove', `go${goal.ref}`);
          } else this.moveUnits(units, target, 'attackMove', `go${goal.ref}`);
          // regroup after a target has fallen
          if (ent?.kind === 'building' && this.attacking.ref !== undefined && this.attacking.ref !== goal.ref && goal.stage) {
            this.attacking.phase = 'approach'; this.attacking.since = sim.tick;
          }
          this.attacking.ref = goal.ref;
          this.attacking.target = target;
          if (!goal.heroOnly) {
            const rally = this.rallyPoint();
            for (const L of army) if (!group?.has(L.id)) this.moveUnits([L.id], rally, 'move', 'rally');
            return;
          }
        }
      }
    } else this.attacking = null;

    // 3. Gather: incomplete troops to the building to refill, the rest to the rally point
    const rally = this.rallyPoint();
    for (const L of army) {
      const d = UNITS[L.def];
      const b = this.buildings.find((x) => x.type === d.building && x.done);
      if (L.soldiers.length < d.soldiers && b && this.canAfford(d.soldierCost)) this.moveUnits([L.id], { x: b.x + b.w + 1, y: b.y + 1 }, 'move', 'refill');
      else this.moveUnits([L.id], rally, 'move', 'rally');
    }
    if (!goal?.heroOnly || !this.attacking) for (const h of hero) this.moveUnits([h.id], rally, 'move', 'rally');
  }

  /** Set every commander on the nearest attackable threat. */
  defend(ids) {
    const sim = this.sim;
    // Attackable: soldiers, heroes, militia, captains without soldiers – also the soldiers of a
    // threatening captain if they themselves are (still) further away
    const leaderIds = new Set(this.threats.filter((e) => e.kind === 'leader').map((e) => e.id));
    const foes = [...new Set([...this.threats.filter((e) => targetable(sim, e)),
      ...this.enemies.filter((e) => e.kind === 'soldier' && leaderIds.has(e.leader) && d2(tile(e), this.home) < 30 * 30)])];
    if (!foes.length) return;
    for (const id of ids) {
      const e = sim.entities.get(id);
      if (!e || (e.kind === 'hero' && e.down)) continue;
      const cur = e.order?.type === 'attack' ? sim.entities.get(e.order.target) : null;
      if (cur && foes.includes(cur)) continue;
      const p = tile(e);
      let best = null, bd = Infinity;
      for (const f of foes) { const d = d2(tile(f), p); if (d < bd) { bd = d; best = f; } }
      this.orders.set(id, `def:${best.id}`);
      this.cmd({ type: 'order', units: [id], order: 'attack', target: best.id });
    }
  }

  attackBuilding(units, b) {
    const give = units.filter((id) => { const e = this.sim.entities.get(id); return e && !(e.order?.type === 'attack' && e.order.target === b.id); });
    if (give.length) this.cmd({ type: 'order', units: give, order: 'attack', target: b.id });
  }

  /** Hero: use abilities when enemies are near. */
  heroFight(h) { if (h) this.heroAbilities(h); }

  abilities() { for (const h of this.heroes) this.heroAbilities(h); }

  heroAbilities(h) {
    const sim = this.sim;
    if (!h || h.down) return;
    const p = tile(h);
    const near = (r) => this.enemies.filter((e) => e.kind !== 'hero' && d2(tile(e), p) <= r * r).length;
    const ready = (ab) => (h.ready[ab] ?? 0) <= sim.tick;
    const hurt = () => [...this.leaders, ...this.heroes].filter((e) => d2(tile(e), p) < 36 && e.hp < (e.kind === 'hero' ? HEROES[e.hero].hp : UNITS[e.def].hp) * 0.6).length;
    if (h.hero === 'nelia') {
      // encourage also when storming a building (double attack for all troops nearby)
      const siege = this.attacking?.phase === 'strike' && this.attacking.target && d2(this.attacking.target, p) < 10 * 10
        && this.leaders.filter((L) => d2(tile(L), p) < 36).length >= 4;
      if (ready('courage') && (near(3) >= 2 || siege)) this.cmd({ type: 'ability', hero: h.id, ability: 'courage' });
    } else if (h.hero === 'taran') {
      if (ready('shieldBash') && near(2.5) >= 2) this.cmd({ type: 'ability', hero: h.id, ability: 'shieldBash' });
      else if (ready('intimidate') && near(4) >= 4) this.cmd({ type: 'ability', hero: h.id, ability: 'intimidate' });
    } else if (h.hero === 'orrin') {
      // also for a single battered hero (otherwise Nelia never heals and the assault waits for her)
      const heroLow = this.heroes.some((e) => !e.down && d2(tile(e), p) < 36 && e.hp * 2 < HEROES[e.hero].hp);
      if (ready('salve') && (hurt() >= 2 || heroLow)) this.cmd({ type: 'ability', hero: h.id, ability: 'salve' });
      else if (ready('bribe') && near(4) >= 1 && this.avail('gold') >= 900) this.cmd({ type: 'ability', hero: h.id, ability: 'bribe' });
    }
  }

  // ---------- Weather (mission 4) ----------

  weather(state) {
    const plant = this.buildings.find((b) => b.type === 'weatherPlant' && b.done);
    if (plant && !checkWeatherChange(this.sim, P, plant, state)) this.cmd({ type: 'changeWeather', building: plant.id, state });
  }
}

// ---------------------------------------------------------------------------------------------
// Headless run with report
// ---------------------------------------------------------------------------------------------

/** Time limits per mission (game minutes) – guideline for balancing. */
export const TIME_LIMITS = { c1: 20, c2: 30, c3: 20, c4: 40, c5: 40, c6: 60 };

/**
 * Play a mission headless.
 * @param {string} id
 * @param {number} [seed] map seed (default: seed of the mission)
 * @param {{ passive?: boolean, maxMinutes?: number, sample?: number }} [opts]
 */
export function playMission(id, seed, opts = {}) {
  const sim = createMissionSim(id, seed ? { seed } : {});
  const m = sim.mission;
  const ais = m.def.players.map((p, i) => (p.kind === 'ai' ? new AiPlayer(sim, i, p.difficulty ?? 'normal') : null)).filter(Boolean);
  const bot = new MissionBot(sim, opts);
  const maxTicks = (opts.maxMinutes ?? TIME_LIMITS[id] * 1.5) * 600;
  const sampleEvery = (opts.sample ?? 60) * T;
  const report = {
    id, seed: sim.seed, passive: !!bot.passive, won: false, reason: null, ticks: 0, minutes: 0,
    objectives: {}, samples: [], losses: { leaders: 0, soldiers: 0, serfs: 0, workers: 0, buildings: 0, hero: 0 },
    kills: 0, maxArmy: 0, maxSoldiers: 0, warnings: [...m.state.warnings],
  };
  const sample = () => {
    const ls = [...sim.entities.values()].filter((e) => e.kind === 'leader' && e.owner === P);
    const soldiers = ls.reduce((s, L) => s + L.soldiers.length, 0);
    report.maxArmy = Math.max(report.maxArmy, ls.length);
    report.maxSoldiers = Math.max(report.maxSoldiers, soldiers);
    report.samples.push({
      min: Math.round(sim.tick / 60) / 10,
      ...Object.fromEntries(RES.map((r) => [r, sim.available(P, r)])),
      workers: [...sim.entities.values()].filter((e) => e.kind === 'worker' && e.owner === P).length,
      serfs: [...sim.entities.values()].filter((e) => e.kind === 'unit' && e.owner === P).length,
      army: ls.length, soldiers,
      enemyArmy: [...sim.entities.values()].filter((e) => e.kind === 'leader' && e.owner !== P && !sim.players[e.owner]?.neutral).length,
    });
  };
  for (let i = 0; i < maxTicks && !m.state.result; i++) {
    bot.update();
    for (const a of ais) if (!sim.players[a.player].defeated) a.update();
    const ev = sim.step();
    for (const e of ev) {
      if (e.type === 'objective' && !report.objectives[e.id]) {
        if (e.status === 'done' || e.status === 'failed') report.objectives[e.id] = { status: e.status, min: +(sim.tick / 600).toFixed(1) };
      } else if (e.type === 'killed') {
        if (e.owner === P) {
          const k = { leader: 'leaders', soldier: 'soldiers', unit: 'serfs', worker: 'workers', hero: 'hero' }[e.kind];
          if (k) report.losses[k]++;
        } else if (e.by === P) report.kills++;
      } else if (e.type === 'buildingDestroyed' && e.owner === P) report.losses.buildings++;
    }
    if (sim.tick % sampleEvery === 0) sample();
  }
  sample();
  const r = m.state.result;
  report.won = !!r?.won;
  report.reason = r?.reason ?? 'timeout';
  report.ticks = sim.tick;
  report.minutes = +(sim.tick / 600).toFixed(1);
  for (const o of m.state.objectives) if (!report.objectives[o.id]) report.objectives[o.id] = { status: o.status, min: null };
  report.warnings = [...new Set([...report.warnings, ...m.state.warnings])];
  return { sim, bot, report };
}
