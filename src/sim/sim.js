// Simulation: state, commands, tick. Pure JavaScript, no DOM, deterministic.

import { Rng } from './rng.js';
import { generateMap } from './mapgen.js';
import { OCCUPIED, RESERVED, WATER, CLIFF } from './map.js';
import { BUILDINGS, UPGRADE_REQUIRES } from './data/buildings.js';
import { TECHS } from './data/technologies.js';
import { BLESSINGS, WORKER } from './data/professions.js';
import { BALANCE } from './data/balance.js';
import { RESOURCES, START_RESOURCES, emptyStock } from './data/resources.js';
import { UNIT, tileCenter, toTile, secondsToTicks } from './fixed.js';
import { Hasher } from './hash.js';
import { updateSerf, clearJob, assignJob } from './systems/serfs.js';
import { updatePayday } from './systems/payday.js';
import { updateSpawning, updateWorker, removeWorker, workersOf, maxMotivation } from './systems/workers.js';
import { updateMilitary, setMilitia, useAbility, slotOffset } from './systems/military.js';
import { UNITS, LINES, unitOf, fullCost, LINE_UPGRADE_COST, HEROES } from './data/units.js';
import { WEATHER_CYCLE } from './data/weather.js';
import { BUILDING_TECHS } from './data/buildingTechs.js';
import { REASONS } from './reasons.js';
import { checkBuildingResearch, startBuildingResearch, updateBuildingResearch, buildingMaxHp } from './systems/techs.js';
import { createMarket, checkTrade, startTrade, updateMarket } from './systems/market.js';
import { updateDamage, createRuin, isDamaged } from './systems/damage.js';
import { checkWeatherChange, changeWeather } from './systems/weather.js';

/** @typedef {import('./data/resources.js').ResourceId} ResourceId */
/**
 * Rejection reason: stable code ('err.…') or code with parameters (IDs such as technology or building type).
 * Texts only arise in the UI (src/i18n), so that the simulation stays language-independent.
 * @typedef {string|{code: string, params: Record<string, string|number>}} Reason
 */

/**
 * @typedef {Object} Player
 * @property {number} id
 * @property {Record<ResourceId, number>} stock refined resources (taler counts here)
 * @property {Record<ResourceId, number>} raw raw goods
 * @property {number} taxLevel 0 … 4
 * @property {Set<string>} techs
 * @property {boolean} defeated
 * @property {number} faith faith for blessings
 */

/**
 * @typedef {Object} Building
 * @property {number} id
 * @property {'building'} kind
 * @property {string} type
 * @property {number} owner
 * @property {number} x @property {number} y @property {number} w @property {number} h
 * @property {number} level 0-based
 * @property {boolean} done
 * @property {number} progress construction work in serf ticks
 * @property {number} work required construction work
 * @property {number} hp
 * @property {number[]} builders
 * @property {number[]} workers
 * @property {number[]} residents
 * @property {number[]} eaters
 * @property {boolean} overtime
 * @property {null|{tech:string, progress:number}} research
 * @property {null|{give:string, take:string, amount:number, cost:number, progress:number, need:number}} [trade] marketplace
 * @property {boolean} [burning] below 50 % HP
 */

/**
 * @typedef {Object} Unit
 * @property {number} id
 * @property {'unit'} kind
 * @property {'serf'} type
 * @property {number} owner
 * @property {number} px @property {number} py position in milli-tiles
 * @property {number[]} path
 * @property {null|{ kind: 'build'|'repair'|'gather', target: number, res?: string }} job
 * @property {number} timer
 * @property {number} hp
 * @property {number} [goal] target tile of a walk command
 */

/**
 * @typedef {Object} ResourceNode
 * @property {number} id
 * @property {'tree'|'pile'} kind
 * @property {number} x @property {number} y
 * @property {string} res
 * @property {number} amount
 */

export class Sim {
  /**
   * @param {{ seed?: number, players?: number, size?: number, mission?: any }} [opts]
   *   mission: optional mission script (src/sim/missions/runtime.js). It gets exactly three
   *   entry points: setup(sim) at the end of the constructor, update(sim) at the end of every tick and
   *   command(sim, cmd) for commands of type 'mission'. Without a mission nothing changes.
   */
  constructor(opts = {}) {
    this.seed = opts.seed ?? 1;
    /** Mission script or null (free play) */
    this.mission = opts.mission ?? null;
    this.tick = 0;
    this.rng = new Rng(this.seed);
    const gen = generateMap(this.seed, { size: opts.size ?? 96, players: opts.players ?? 2 });
    this.map = gen.map;
    this.waterLevel = gen.waterLevel;
    this.starts = gen.starts;
    /** @type {{x:number,y:number}[]} */
    this.spots = [];
    /** @type {{x:number,y:number,res:string}[]} */
    this.shafts = [];
    /** @type {Map<number, Building|Unit|ResourceNode>} */
    this.entities = new Map();
    this.nextId = 1;
    /** @type {Player[]} */
    this.players = [];
    /** @type {any[]} */
    this.events = [];
    /** @type {any[]} */
    this.pending = [];
    /** Market prices (the same for all players) */
    this.market = createMarket();

    for (const f of gen.features) {
      if (f.kind === 'spot') this.spots.push({ x: f.x, y: f.y });
      else if (f.kind === 'shaft') this.shafts.push({ x: f.x, y: f.y, res: f.res });
      else if (f.kind === 'tree') this.addNode('tree', f.x, f.y, 'wood', BALANCE.tree.wood);
      else if (f.kind === 'pile') this.addNode('pile', f.x, f.y, f.res, BALANCE.pile.amount);
    }

    for (let p = 0; p < gen.starts.length; p++) {
      const stock = emptyStock();
      for (const r of RESOURCES) stock[r] = START_RESOURCES[r];
      this.players.push({
        id: p, stock, raw: emptyStock(), taxLevel: BALANCE.tax.defaultLevel, techs: new Set(), defeated: false, faith: 0,
        weatherEnergy: 0, weatherReadyAt: 0,
        unitTier: { sword: 1, spear: 1, bow: 1, lightCav: 1, heavyCav: 1, cannon: 1 }, team: opts.teams?.[p] ?? p,
      });
      const hq = gen.hqs[p];
      this.createBuilding(p, 'headquarters', hq.x, hq.y, true);
      const spot = this.spots.find((s) => this.isOwnStartSpot(s, gen.starts[p]));
      if (spot) this.createBuilding(p, 'villageCenter', spot.x, spot.y, true);
      for (let i = 0; i < BALANCE.startSerfs; i++) this.spawnSerf(p);
      const hero = opts.heroes?.[p] ?? ['bertram', 'hedda', 'gerold'][p % 3];
      if (hero) this.spawnHero(p, hero);
    }
    /** Weather: state and tick of the next change */
    this.weatherCycle = opts.weatherCycle ?? WEATHER_CYCLE;
    this.weather = { state: this.weatherCycle[0][0], index: 0, until: this.weatherCycle[0][1] };
    /** @type {number|null} winner team */
    this.winner = null;
    // Mission: post-process the map, start layout, goals (hook 1 of 3)
    this.mission?.setup(this);
  }

  allied(a, b) { return this.players[a]?.team === this.players[b]?.team; }

  spawnHero(owner, hero) {
    const hq = this.findBuilding(owner, 'headquarters');
    const ring = this.map.ring(hq.x, hq.y, hq.w, hq.h);
    const t = ring[(ring.length >> 1) % ring.length];
    const h = {
      id: this.nextId++, kind: 'hero', hero, owner, px: tileCenter(t % this.map.width), py: tileCenter((t / this.map.width) | 0),
      path: [], hp: HEROES[hero].hp, down: false, downTimer: 0, ready: {}, order: { type: 'idle' }, targetId: 0, cooldown: 0,
    };
    this.entities.set(h.id, h);
    return h;
  }

  isOwnStartSpot(spot, start) {
    return Math.abs(spot.x - start.x) <= 9 && Math.abs(spot.y - start.y) <= 3;
  }

  // ---------- Entities ----------

  addNode(kind, x, y, res, amount) {
    if (!this.map.walkable(x, y)) return null;
    /** @type {ResourceNode} */
    const n = { id: this.nextId++, kind, x, y, res, amount };
    this.entities.set(n.id, n);
    this.map.occupy(x, y, 1, 1, n.id);
    return n;
  }

  /** @returns {Building} */
  createBuilding(owner, type, x, y, done = false) {
    const def = BUILDINGS[type];
    const lvl = def.levels[0];
    /** @type {Building} */
    const b = {
      id: this.nextId++, kind: 'building', type, owner, x, y, w: def.w, h: def.h,
      level: 0, done, progress: 0, work: secondsToTicks(lvl.buildTime) * BALANCE.serf.maxBuildersPerSite,
      hp: done ? lvl.hp : Math.max(1, Math.trunc(lvl.hp / 10)), builders: [], cooldown: 0,
      workers: [], residents: [], eaters: [], overtime: false, research: null, trade: null, burning: false,
    };
    if (done) b.hp = buildingMaxHp(this, b);
    this.entities.set(b.id, b);
    this.map.occupy(x, y, def.w, def.h, b.id);
    this.ejectUnits(b);
    return b;
  }

  /** Push units standing on a new building footprint to the edge. */
  ejectUnits(b) {
    const ring = this.map.ring(b.x, b.y, b.w, b.h);
    if (!ring.length) return;
    let k = 0;
    for (const e of this.entities.values()) {
      if (e.kind !== 'unit') continue;
      const tx = toTile(e.px), ty = toTile(e.py);
      if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) {
        const t = ring[k++ % ring.length];
        e.px = tileCenter(t % this.map.width); e.py = tileCenter((t / this.map.width) | 0);
        e.path = [];
      }
    }
  }

  removeEntity(e) {
    if (e.kind === 'tree' || e.kind === 'pile') this.map.release(e.x, e.y, 1, 1);
    if (e.kind === 'ruin') this.map.release(e.x, e.y, e.w, e.h);
    if (e.kind === 'building') {
      this.map.release(e.x, e.y, e.w, e.h);
      for (const id of e.workers) { const w = this.entities.get(id); if (w) removeWorker(this, w, 'noWorkplace'); }
      for (const id of [...e.residents, ...e.eaters]) {
        const w = this.entities.get(id);
        if (w?.kind === 'worker') { if (w.home === e.id) w.home = 0; if (w.farm === e.id) w.farm = 0; }
      }
    }
    this.entities.delete(e.id);
  }

  /**
   * Building destroyed in combat (or by fire): event, ruin, possibly defeat.
   * @param {Building} b @param {any} attacker
   */
  destroyBuilding(b, attacker) {
    for (const id of b.builders) { const u = this.entities.get(id); if (u?.job) { u.job = null; u.path = []; } }
    this.removeEntity(b);
    const ruin = createRuin(this, b);
    this.events.push({ type: 'buildingDestroyed', building: b.id, buildingType: b.type, owner: b.owner, level: b.level, ruin: ruin.id, by: attacker?.owner ?? -1 });
    if (b.type === 'headquarters') this.checkDefeat(b.owner);
  }

  /** Called when a build or upgrade is finished. */
  onBuildingDone(b) {
    this.events.push({ type: 'buildingDone', player: b.owner, building: b.id, buildingType: b.type, level: b.level });
    const effect = BUILDINGS[b.type].motivationEffect;
    if (effect) {
      const max = maxMotivation(this, b.owner);
      for (const w of workersOf(this, b.owner)) w.motivation = Math.min(max, w.motivation + effect);
    }
  }

  spawnSerf(owner) {
    const hq = this.findBuilding(owner, 'headquarters');
    if (!hq) return null;
    const ring = this.map.ring(hq.x, hq.y, hq.w, hq.h);
    if (!ring.length) return null;
    const count = this.countUnits(owner);
    const t = ring[(count * 7) % ring.length];
    /** @type {Unit} */
    const u = {
      id: this.nextId++, kind: 'unit', type: 'serf', owner,
      px: tileCenter(t % this.map.width), py: tileCenter((t / this.map.width) | 0),
      path: [], job: null, timer: 0, hp: BALANCE.serf.hp,
    };
    this.entities.set(u.id, u);
    return u;
  }

  findBuilding(owner, type) {
    for (const e of this.entities.values()) if (e.kind === 'building' && e.owner === owner && e.type === type) return e;
    return null;
  }

  countUnits(owner) {
    let n = 0;
    for (const e of this.entities.values()) if (e.kind === 'unit' && e.owner === owner) n++;
    return n;
  }

  // ---------- Players ----------

  popUsed(owner) {
    let n = 0;
    for (const e of this.entities.values()) {
      if (e.owner !== owner) continue;
      if (e.kind === 'unit' || e.kind === 'worker') n++;
      else if (e.kind === 'leader' || e.kind === 'soldier') n += UNITS[e.def].pop;
    }
    return n;
  }

  popLimit(owner) {
    let n = 0;
    for (const e of this.entities.values()) {
      if (e.kind === 'building' && e.owner === owner && e.done && e.type === 'villageCenter') {
        n += BUILDINGS.villageCenter.levels[e.level].population;
      }
    }
    return n;
  }

  /** Available amount (refined + raw). */
  available(owner, res) {
    const p = this.players[owner];
    return p.stock[res] + p.raw[res];
  }

  canPay(owner, cost) {
    for (const r of Object.keys(cost)) if (this.available(owner, r) < cost[r]) return false;
    return true;
  }

  /** Pays from refined goods first, then from raw goods. */
  pay(owner, cost) {
    if (!this.canPay(owner, cost)) return false;
    const p = this.players[owner];
    for (const r of Object.keys(cost)) {
      let rest = cost[r];
      const fromStock = Math.min(rest, p.stock[r]);
      p.stock[r] -= fromStock; rest -= fromStock;
      p.raw[r] -= rest;
    }
    return true;
  }

  // ---------- Commands ----------

  /** Queue a command for the next tick. Same interface for players, AI and network. */
  command(cmd) { this.pending.push(cmd); }

  applyCommand(cmd) {
    const p = this.players[cmd.player];
    if (!p || p.defeated) return this.reject(cmd, 'err.unknownPlayer');
    switch (cmd.type) {
      case 'buySerf': return this.cmdBuySerf(cmd);
      case 'placeBuilding': return this.cmdPlaceBuilding(cmd);
      case 'assignWork': return this.cmdAssignWork(cmd);
      case 'move': return this.cmdMove(cmd);
      case 'setTax': return this.cmdSetTax(cmd);
      case 'upgradeBuilding': return this.cmdUpgrade(cmd);
      case 'demolish': return this.cmdDemolish(cmd);
      case 'research': return this.cmdResearch(cmd);
      case 'setOvertime': return this.cmdOvertime(cmd);
      case 'bless': return this.cmdBless(cmd);
      case 'recruit': return this.cmdRecruit(cmd);
      case 'buySoldiers': return this.cmdBuySoldiers(cmd);
      case 'upgradeLine': return this.cmdUpgradeLine(cmd);
      case 'order': return this.cmdOrder(cmd);
      case 'ability': return this.cmdAbility(cmd);
      case 'militia': setMilitia(this, cmd.player, !!cmd.on); return true;
      case 'trade': return this.cmdTrade(cmd);
      case 'changeWeather': return this.cmdChangeWeather(cmd);
      // Mission: e.g. confirm or skip a tutorial step (hook 2 of 3)
      case 'mission': return this.mission ? this.mission.command(this, cmd) : this.reject(cmd, 'err.noMission');
      default: return this.reject(cmd, 'err.unknownCommand');
    }
  }

  /**
   * Reject a command. Reasons are language-independent codes ('err.notEnoughResources') with optional
   * parameters (IDs, no texts); the UI translates them (src/i18n).
   * @param {any} cmd
   * @param {string|{code:string, params?:Record<string, any>}} reason code or result of a check…() function
   * @param {Record<string, any>} [params]
   */
  reject(cmd, reason, params) {
    const code = typeof reason === 'string' ? reason : reason.code;
    const p = params ?? (typeof reason === 'string' ? undefined : reason.params);
    this.events.push({ type: 'rejected', player: cmd.player, command: cmd.type, reason: code, ...(p ? { params: p } : {}) });
    return false;
  }

  cmdBuySerf(cmd) {
    const n = cmd.count ?? 1;
    for (let i = 0; i < n; i++) {
      if (this.popUsed(cmd.player) >= this.popLimit(cmd.player)) return this.reject(cmd, 'err.popLimit');
      if (!this.pay(cmd.player, BALANCE.serf.cost)) return this.reject(cmd, 'err.notEnoughGold');
      const u = this.spawnSerf(cmd.player);
      this.events.push({ type: 'serfBought', player: cmd.player, unit: u?.id });
    }
    return true;
  }

  /** Check whether a building may be built at (x,y). @returns {Reason|null} error code or null */
  checkPlacement(owner, type, x, y) {
    const def = BUILDINGS[type];
    if (!def || def.buildable === false) return 'err.notBuildable';
    if (def.requires && !this.players[owner].techs.has(def.requires)) return { code: 'err.techMissing', params: { tech: def.requires } };
    const m = this.map;
    if (def.placement === 'settlement') {
      if (!this.spots.some((s) => s.x === x && s.y === y)) return 'err.settlementOnly';
      if (!m.rectFree(x, y, def.w, def.h, WATER | OCCUPIED | CLIFF)) return 'err.spotTaken';
    } else if (def.placement === 'shaft') {
      if (!this.shafts.some((s) => s.x === x && s.y === y && s.res === def.shaftResource)) return 'err.shaftOnly';
      if (!m.rectFree(x, y, def.w, def.h, WATER | OCCUPIED | CLIFF)) return 'err.spotTaken';
    } else {
      if (!m.rectFree(x, y, def.w, def.h, WATER | OCCUPIED | RESERVED | CLIFF)) return 'err.notFree';
      if (m.slope(x, y, def.w, def.h) > BALANCE.maxSlope) return 'err.tooSteep';
    }
    if (!this.canPay(owner, def.levels[0].cost)) return 'err.notEnoughResources';
    return null;
  }

  /**
   * Searches in a spiral around (cx,cy) for the nearest valid building spot. For AI, tests and build preview.
   * @returns {{x:number,y:number}|null}
   */
  findPlacement(owner, type, cx, cy, radius = 20) {
    const def = BUILDINGS[type];
    if (def.placement !== 'free') {
      const list = def.placement === 'settlement' ? this.spots : this.shafts.filter((s) => s.res === def.shaftResource);
      let best = null, bestD = Infinity;
      for (const s of list) {
        const d = (s.x - cx) ** 2 + (s.y - cy) ** 2;
        if (d < bestD && !this.checkPlacement(owner, type, s.x, s.y)) { best = s; bestD = d; }
      }
      return best ? { x: best.x, y: best.y } : null;
    }
    for (let r = 0; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx, y = cy + dy;
        // Leave a one-tile border free so that paths do not become overgrown.
        if (!this.map.rectFree(x - 1, y - 1, def.w + 2, def.h + 2, WATER | OCCUPIED | CLIFF)) continue;
        if (!this.checkPlacement(owner, type, x, y)) return { x, y };
      }
    }
    return null;
  }

  cmdPlaceBuilding(cmd) {
    const err = this.checkPlacement(cmd.player, cmd.building, cmd.x, cmd.y);
    if (err) return this.reject(cmd, err);
    this.pay(cmd.player, BUILDINGS[cmd.building].levels[0].cost);
    const b = this.createBuilding(cmd.player, cmd.building, cmd.x, cmd.y, false);
    this.events.push({ type: 'buildingPlaced', player: cmd.player, building: b.id, buildingType: b.type });
    if (cmd.units?.length) this.cmdAssignWork({ player: cmd.player, units: cmd.units, target: b.id });
    return true;
  }

  ownSerfs(cmd) {
    const out = [];
    for (const id of cmd.units ?? []) {
      const u = this.entities.get(id);
      if (u && u.kind === 'unit' && u.owner === cmd.player && u.type === 'serf') out.push(u);
    }
    return out;
  }

  cmdAssignWork(cmd) {
    const t = this.entities.get(cmd.target);
    if (!t) return this.reject(cmd, 'err.targetMissing');
    const serfs = this.ownSerfs(cmd);
    if (!serfs.length) return this.reject(cmd, 'err.noSerfs');
    // Finished own building: only repair if damaged
    if (t.kind === 'building' && t.done && t.owner === cmd.player && !isDamaged(this, t)) return this.reject(cmd, REASONS.noRepairNeeded);
    if (t.kind === 'building' && t.done && t.owner === cmd.player && t.builders.length >= BALANCE.serf.maxBuildersPerSite
      && !serfs.some((u) => t.builders.includes(u.id))) return this.reject(cmd, REASONS.repairFull);
    let ok = 0;
    for (const u of serfs) if (assignJob(this, u, t)) ok++;
    if (!ok) return this.reject(cmd, 'err.noWork');
    return true;
  }

  cmdMove(cmd) {
    const serfs = this.ownSerfs(cmd);
    if (!serfs.length) return this.reject(cmd, 'err.noUnits');
    if (!this.map.walkable(cmd.x, cmd.y)) return this.reject(cmd, 'err.notWalkable');
    for (const u of serfs) {
      clearJob(this, u);
      u.goal = this.map.idx(cmd.x, cmd.y);
      u.path = [];
    }
    return true;
  }

  cmdSetTax(cmd) {
    if (!this.players[cmd.player].techs.has('education')) return this.reject(cmd, 'err.techFirst', { tech: 'education' });
    if (!(cmd.level >= 0 && cmd.level <= 4)) return this.reject(cmd, 'err.invalidTax');
    this.players[cmd.player].taxLevel = cmd.level;
    return true;
  }

  /** Own, finished building from a command. */
  ownBuilding(cmd, type) {
    const b = this.entities.get(cmd.building);
    if (!b || b.kind !== 'building' || b.owner !== cmd.player) return null;
    if (type && b.type !== type) return null;
    return b;
  }

  /** Reason why an upgrade is not possible, or null. @returns {Reason|null} */
  checkUpgrade(owner, b) {
    const def = BUILDINGS[b.type];
    if (!b.done) return 'err.underConstruction';
    const next = def.levels[b.level + 1];
    if (!next) return 'err.maxLevel';
    const req = UPGRADE_REQUIRES[b.type]?.[b.level + 1];
    const techs = this.players[owner].techs;
    if (req === 'university4') { if ([...techs].filter((t) => TECHS[t]).length < 4) return 'err.fourTechs'; }
    else if (req && !techs.has(req)) return { code: 'err.techFirst', params: { tech: req } };
    if (b.research) return 'err.researchRunning';
    if (!this.canPay(owner, next.cost)) return 'err.notEnoughResources';
    return null;
  }

  cmdUpgrade(cmd) {
    const b = this.ownBuilding(cmd);
    if (!b) return this.reject(cmd, 'err.notOwnBuilding');
    const err = this.checkUpgrade(cmd.player, b);
    if (err) return this.reject(cmd, err);
    const next = BUILDINGS[b.type].levels[b.level + 1];
    this.pay(cmd.player, next.cost);
    b.level++;
    b.done = false;
    b.progress = 0;
    b.work = secondsToTicks(next.buildTime) * BALANCE.serf.maxBuildersPerSite;
    this.events.push({ type: 'upgradeStarted', player: cmd.player, building: b.id, level: b.level });
    if (cmd.units?.length) this.cmdAssignWork({ player: cmd.player, units: cmd.units, target: b.id });
    return true;
  }

  cmdDemolish(cmd) {
    const b = this.ownBuilding(cmd);
    if (!b) return this.reject(cmd, 'err.notOwnBuilding');
    if (b.type === 'headquarters') return this.reject(cmd, 'err.hqNoDemolish');
    const cost = BUILDINGS[b.type].levels[0].cost;
    const p = this.players[cmd.player];
    for (const r of Object.keys(cost)) p.stock[r] += Math.trunc(cost[r] / 2); // half back (A)
    for (const id of b.builders) { const u = this.entities.get(id); if (u) { u.job = null; u.path = []; } }
    this.removeEntity(b);
    this.events.push({ type: 'demolished', player: cmd.player, building: b.id });
    return true;
  }

  /** Reason why a research is not possible, or null. @returns {Reason|null} */
  checkResearch(owner, b, techId) {
    const t = TECHS[techId];
    if (!t) return 'err.unknownTech';
    const p = this.players[owner];
    if (!b || b.type !== 'university' || !b.done) return 'err.universityNeeded';
    if (b.research) return 'err.busyResearching';
    if (p.techs.has(techId)) return 'err.alreadyResearched';
    for (const e of this.entities.values()) {
      if (e.kind === 'building' && e.owner === owner && e.research?.tech === techId) return 'err.beingResearched';
    }
    if (t.prev && !p.techs.has(t.prev)) return { code: 'err.techFirst', params: { tech: t.prev } };
    if (t.tier >= 2 && (this.findBuilding(owner, 'headquarters')?.level ?? 0) < 1) return 'err.fortressFirst';
    if (t.tier >= 3 && b.level < 1) return 'err.universityFirst';
    if (!this.canPay(owner, t.cost)) return 'err.notEnoughResources';
    return null;
  }

  cmdResearch(cmd) {
    const b = this.ownBuilding(cmd);
    if (BUILDING_TECHS[cmd.tech]) {
      const e = checkBuildingResearch(this, cmd.player, b, cmd.tech);
      if (e) return this.reject(cmd, e);
      startBuildingResearch(this, cmd.player, b, cmd.tech);
      return true;
    }
    const err = this.checkResearch(cmd.player, b, cmd.tech);
    if (err) return this.reject(cmd, err);
    this.pay(cmd.player, TECHS[cmd.tech].cost);
    b.research = { tech: cmd.tech, progress: 0 };
    this.events.push({ type: 'researchStarted', player: cmd.player, tech: cmd.tech });
    return true;
  }

  cmdTrade(cmd) {
    const b = this.ownBuilding(cmd);
    const err = checkTrade(this, cmd.player, b, cmd.give, cmd.take, cmd.amount);
    if (err) return this.reject(cmd, err);
    startTrade(this, cmd.player, b, cmd.give, cmd.take, cmd.amount);
    return true;
  }

  cmdChangeWeather(cmd) {
    const b = this.ownBuilding(cmd);
    const err = checkWeatherChange(this, cmd.player, b, cmd.state);
    if (err) return this.reject(cmd, err);
    changeWeather(this, cmd.player, cmd.state);
    return true;
  }

  cmdOvertime(cmd) {
    const b = this.ownBuilding(cmd);
    if (!b || !b.workers) return this.reject(cmd, 'err.notOwnBuilding');
    b.overtime = !!cmd.on;
    return true;
  }

  cmdBless(cmd) {
    const b = this.ownBuilding(cmd, 'chapel');
    if (!b?.done) return this.reject(cmd, 'err.chapelNeeded');
    const bl = BLESSINGS[cmd.blessing];
    if (!bl) return this.reject(cmd, 'err.unknownBlessing');
    if (bl.minLevel && b.level < bl.minLevel) return this.reject(cmd, 'err.cathedralOnly');
    const p = this.players[cmd.player];
    if (p.faith < WORKER.blessingFaith) return this.reject(cmd, 'err.notEnoughFaith');
    p.faith -= WORKER.blessingFaith;
    const max = maxMotivation(this, cmd.player);
    for (const w of workersOf(this, cmd.player)) {
      if (!bl.professions || bl.professions.includes(w.prof)) w.motivation = Math.min(max, w.motivation + WORKER.blessingMotivation);
    }
    this.events.push({ type: 'blessed', player: cmd.player, blessing: cmd.blessing });
    return true;
  }

  // ---------- Military ----------

  /** Reason why tier `tier` of a line is not available, or null. @returns {Reason|null} */
  checkLineTier(owner, line, tier) {
    if (!unitOf(line, tier)) return 'err.noSuchTier';
    const L = LINES[line];
    const recruit = [...this.entities.values()].filter((e) => e.kind === 'building' && e.owner === owner && e.type === L.building && e.done);
    if (!recruit.length) return { code: 'err.buildingNeeded', params: { building: L.building } };
    if (tier >= 2 && L.refiner && !this.findDone(owner, L.refiner)) return { code: 'err.buildingNeeded', params: { building: L.refiner } };
    if (tier >= 2 && !L.refiner && line !== 'cannon' && !recruit.some((b) => b.level >= 1)) return { code: 'err.upgradeFirst', params: { building: L.building, level: 1 } };
    if (tier >= 3 && !recruit.some((b) => b.level >= 1)) return { code: 'err.upgradeFirst', params: { building: L.building, level: 1 } };
    if (tier >= 4 && (this.findBuilding(owner, 'headquarters')?.level ?? 0) < 1) return 'err.fortressFirst';
    return null;
  }

  findDone(owner, type) {
    for (const e of this.entities.values()) if (e.kind === 'building' && e.owner === owner && e.type === type && e.done) return e;
    return null;
  }

  cmdRecruit(cmd) {
    const b = this.ownBuilding(cmd);
    const L = LINES[cmd.line];
    if (!b || !L || b.type !== L.building || !b.done) return this.reject(cmd, 'err.militaryBuildingNeeded');
    const p = this.players[cmd.player];
    const def = unitOf(cmd.line, p.unitTier[cmd.line]);
    const soldiers = cmd.full ? def.soldiers : 0;
    const cost = cmd.full ? fullCost(def) : def.leaderCost;
    if (this.popUsed(cmd.player) + def.pop * (1 + soldiers) > this.popLimit(cmd.player)) return this.reject(cmd, 'err.popLimit');
    if (!this.pay(cmd.player, cost)) return this.reject(cmd, 'err.notEnoughResources');
    const ring = this.map.ring(b.x, b.y, b.w, b.h);
    const t = ring[(this.tick + b.id) % ring.length];
    const leader = this.spawnLeader(cmd.player, def.id, t % this.map.width, (t / this.map.width) | 0, soldiers);
    this.events.push({ type: 'recruited', player: cmd.player, leader: leader.id, def: def.id });
    return true;
  }

  /** Create a squad leader with soldiers on a tile (without cost). */
  spawnLeader(owner, defId, tx, ty, soldiers = UNITS[defId].soldiers) {
    const def = UNITS[defId];
    const px = tileCenter(tx), py = tileCenter(ty);
    const leader = {
      id: this.nextId++, kind: 'leader', def: def.id, owner, px, py, path: [], hp: def.hp,
      soldiers: [], order: { type: 'idle' }, anchor: { x: px, y: py }, targetId: 0, cooldown: 0, buff: null,
    };
    this.entities.set(leader.id, leader);
    for (let i = 0; i < soldiers; i++) this.addSoldier(leader);
    return leader;
  }

  addSoldier(leader) {
    const def = UNITS[leader.def];
    const off = slotOffset(leader.soldiers.length);
    let px = leader.px + off.x, py = leader.py + off.y;
    if (!this.map.walkable(toTile(px), toTile(py))) { px = leader.px; py = leader.py; }
    const s = { id: this.nextId++, kind: 'soldier', leader: leader.id, def: def.id, owner: leader.owner, px, py, path: [], hp: def.soldierHp, targetId: 0, cooldown: 0 };
    this.entities.set(s.id, s);
    leader.soldiers.push(s.id);
    return s;
  }

  cmdBuySoldiers(cmd) {
    const L = this.entities.get(cmd.leader);
    if (!L || L.kind !== 'leader' || L.owner !== cmd.player) return this.reject(cmd, 'err.notOwnLeader');
    const def = UNITS[L.def];
    const free = def.soldiers - L.soldiers.length;
    if (free <= 0) return this.reject(cmd, 'err.troopFull');
    const near = [...this.entities.values()].some((b) => b.kind === 'building' && b.owner === cmd.player && b.done && b.type === def.building
      && L.px >= (b.x - 5) * UNIT && L.px <= (b.x + b.w + 5) * UNIT && L.py >= (b.y - 5) * UNIT && L.py <= (b.y + b.h + 5) * UNIT);
    if (!near) return this.reject(cmd, 'err.leaderNotNear', { building: def.building });
    const n = Math.min(free, cmd.count ?? free);
    for (let i = 0; i < n; i++) {
      if (this.popUsed(cmd.player) + def.pop > this.popLimit(cmd.player)) return this.reject(cmd, 'err.popLimit');
      if (!this.pay(cmd.player, def.soldierCost)) return this.reject(cmd, 'err.notEnoughResources');
      this.addSoldier(L);
    }
    return true;
  }

  cmdUpgradeLine(cmd) {
    const p = this.players[cmd.player];
    const tier = p.unitTier[cmd.line];
    if (!tier) return this.reject(cmd, 'err.unknownLine');
    const cost = LINE_UPGRADE_COST[`${cmd.line}${tier}`];
    if (!cost) return this.reject(cmd, 'err.maxLevel');
    const err = this.checkLineTier(cmd.player, cmd.line, tier + 1);
    if (err) return this.reject(cmd, err);
    if (!this.pay(cmd.player, cost)) return this.reject(cmd, 'err.notEnoughResources');
    p.unitTier[cmd.line] = tier + 1;
    const next = unitOf(cmd.line, tier + 1);
    for (const e of this.entities.values()) {
      if ((e.kind === 'leader' || e.kind === 'soldier') && e.owner === cmd.player && UNITS[e.def].line === cmd.line) e.def = next.id;
    }
    this.events.push({ type: 'lineUpgraded', player: cmd.player, line: cmd.line, tier: tier + 1 });
    return true;
  }

  cmdOrder(cmd) {
    const units = (cmd.units ?? []).map((id) => this.entities.get(id))
      .filter((e) => e && e.owner === cmd.player && (e.kind === 'leader' || e.kind === 'hero' || (e.kind === 'unit' && e.militia)));
    if (!units.length) return this.reject(cmd, 'err.noTroops');
    units.forEach((e, i) => {
      if (e.kind === 'hero' && e.down) return;
      e.path = []; e.targetId = 0;
      if (cmd.order === 'move' || cmd.order === 'attackMove') {
        // Fan out the targets so the squads do not stand on top of each other
        const ox = ((i % 4) * 2 - 3) * 1000, oy = Math.floor(i / 4) * 2000;
        let x = cmd.x * UNIT + 500 + ox, y = cmd.y * UNIT + 500 + oy;
        if (!this.map.walkable(toTile(x), toTile(y))) { x = cmd.x * UNIT + 500; y = cmd.y * UNIT + 500; }
        e.order = { type: cmd.order, x, y };
      } else if (cmd.order === 'attack') e.order = { type: 'attack', target: cmd.target };
      else if (cmd.order === 'hold') e.order = { type: 'hold' };
      else { e.order = { type: 'idle' }; e.anchor = { x: e.px, y: e.py }; }
    });
    return true;
  }

  cmdAbility(cmd) {
    const h = this.entities.get(cmd.hero);
    if (!h || h.kind !== 'hero' || h.owner !== cmd.player) return this.reject(cmd, 'err.notOwnHero');
    const x = cmd.x !== undefined ? cmd.x * UNIT + 500 : undefined, y = cmd.y !== undefined ? cmd.y * UNIT + 500 : undefined;
    const err = useAbility(this, h, cmd.ability, x, y);
    if (err) return this.reject(cmd, err);
    return true;
  }

  // ---------- Weather and victory ----------

  updateWeather() {
    if (this.tick < this.weather.until) return;
    const i = (this.weather.index + 1) % this.weatherCycle.length;
    const [state, dur] = this.weatherCycle[i];
    this.setWeather(state, dur, i);
  }

  /**
   * Change weather (also for mission scripts). After `dur` ticks the cycle continues
   * after `index`. A thaw makes everyone on the ice drown.
   */
  setWeather(state, dur, index = this.weather.index) {
    const wasWinter = this.weather.state === 'winter';
    this.weather = { state, index, until: this.tick + dur };
    this.map.frozen = state === 'winter';
    this.events.push({ type: 'weather', state });
    if (wasWinter && !this.map.frozen) {
      // Thaw: whoever stands on the ice drowns; heroes return to the castle
      for (const e of [...this.entities.values()]) {
        if (e.px === undefined || !(this.map.flags[this.map.idx(toTile(e.px), toTile(e.py))] & WATER)) continue;
        if (e.kind === 'hero') {
          const hq = this.findBuilding(e.owner, 'headquarters');
          if (hq) { e.px = tileCenter(hq.x + 2); e.py = tileCenter(hq.y + hq.h + 1); e.path = []; }
        } else if (e.kind === 'worker') removeWorker(this, e, 'drowned');
        else if (e.kind === 'leader') { for (const s of e.soldiers) this.entities.delete(s); this.entities.delete(e.id); }
        else if (e.kind === 'soldier') {
          const L = this.entities.get(e.leader);
          if (L) L.soldiers = L.soldiers.filter((x) => x !== e.id);
          this.entities.delete(e.id);
        } else this.entities.delete(e.id);
      }
    }
  }

  /** Players without a castle are eliminated; the last team wins. */
  checkDefeat(owner) {
    const p = this.players[owner];
    if (p.defeated || this.findBuilding(owner, 'headquarters')) return;
    p.defeated = true;
    for (const e of [...this.entities.values()]) {
      if (e.owner === owner && e.kind !== 'building') this.entities.delete(e.id);
    }
    this.events.push({ type: 'defeated', player: owner });
    // Neutrals (bandits) do not count for victory
    const teams = new Set(this.players.filter((q) => !q.defeated && !q.neutral).map((q) => q.team));
    if (teams.size === 1) {
      this.winner = [...teams][0];
      this.events.push({ type: 'victory', team: this.winner });
    }
  }

  // ---------- Tick ----------

  /** Compute one tick (100 ms). @param {any[]} [commands] additional commands for this tick */
  step(commands = []) {
    this.events = [];
    const cmds = this.pending.concat(commands);
    this.pending = [];
    for (const c of cmds) this.applyCommand(c);

    updateSpawning(this);
    for (const e of [...this.entities.values()]) {
      if (!this.entities.has(e.id)) continue;
      if (e.kind === 'unit' && !e.militia) updateSerf(this, e);
      else if (e.kind === 'worker') updateWorker(this, e);
    }
    updateMilitary(this);
    updateBuildingResearch(this);
    updateMarket(this);
    updateDamage(this);
    updatePayday(this);
    this.updateWeather();
    // Mission: goals, triggers, bandits (hook 3 of 3)
    this.mission?.update(this);
    this.tick++;
    return this.events;
  }

  /** Compute several ticks. */
  run(ticks) {
    for (let i = 0; i < ticks; i++) this.step();
  }

  // ---------- Output ----------

  /** State hash for determinism tests and desync detection. */
  hash() {
    const h = new Hasher();
    h.int(this.tick);
    for (const v of this.rng.getState()) h.int(v);
    for (const p of this.players) {
      for (const r of RESOURCES) h.int(p.stock[r]).int(p.raw[r]);
      h.int(p.taxLevel).int(p.faith).int(p.techs.size).int(p.weatherEnergy ?? 0).int(p.weatherReadyAt ?? 0);
    }
    for (const r of RESOURCES) h.int(this.market.prices[r]);
    for (const e of this.entities.values()) {
      h.int(e.id).str(e.kind);
      if (e.kind === 'unit') h.int(e.px).int(e.py).int(e.timer).int(e.job ? e.job.target : 0).int(e.path.length).int(e.hp);
      else if (e.kind === 'leader') h.int(e.px).int(e.py).int(e.hp).int(e.targetId).int(e.cooldown).int(e.xp ?? 0);
      else if (e.kind === 'worker') h.int(e.px).int(e.py).int(e.timer).int(e.stamina).int(e.motivation).int(e.carry).str(e.state);
      else if (e.px !== undefined) h.int(e.px).int(e.py).int(e.hp ?? 0).int(e.targetId ?? 0).int(e.cooldown ?? 0);
      else if (e.kind === 'building') {
        h.str(e.type).int(e.x).int(e.y).int(e.progress).int(e.done ? 1 : 0).int(e.level).int(e.hp).int(e.burning ? 1 : 0);
        h.int(e.research ? e.research.progress : -1).int(e.trade ? e.trade.progress : -1);
      } else if (e.kind === 'ruin') h.int(e.x).int(e.y).int(e.until);
      else h.int(e.x).int(e.y).int(e.amount);
    }
    this.mission?.hash(h);
    return h.value;
  }

  /** Slim state for renderer and UI. */
  snapshot() {
    return {
      tick: this.tick,
      players: this.players.map((p) => ({
        id: p.id, stock: { ...p.stock }, raw: { ...p.raw }, taxLevel: p.taxLevel,
        popUsed: this.popUsed(p.id), popLimit: this.popLimit(p.id),
      })),
      entities: [...this.entities.values()].map((e) => {
        if (e.kind === 'worker') return { id: e.id, kind: e.kind, prof: e.prof, owner: e.owner, x: e.px / UNIT, y: e.py / UNIT, state: e.state, inside: e.inside, motivation: e.motivation };
        if (e.kind === 'unit') return { id: e.id, kind: e.kind, type: e.type, owner: e.owner, x: e.px / UNIT, y: e.py / UNIT, job: e.job?.kind ?? null, working: e.path.length === 0 && !!e.job };
        if (e.kind === 'building') return { id: e.id, kind: e.kind, type: e.type, owner: e.owner, x: e.x, y: e.y, w: e.w, h: e.h, level: e.level, done: e.done, progress: e.work ? e.progress / e.work : 1, hp: e.hp / buildingMaxHp(this, e), burning: !!e.burning };
        if (e.kind === 'ruin') return { id: e.id, kind: e.kind, type: e.type, level: e.level, x: e.x, y: e.y, w: e.w, h: e.h, owner: e.formerOwner };
        return { id: e.id, kind: e.kind, x: e.x, y: e.y, res: e.res, amount: e.amount };
      }),
    };
  }
}
