// Simulation: state, commands, tick. Pure JavaScript, no DOM, deterministic.

import { Rng } from './rng.js';
import { generateMap } from './mapgen.js';
import { OCCUPIED, RESERVED, WATER } from './map.js';
import { BUILDINGS } from './data/buildings.js';
import { BALANCE } from './data/balance.js';
import { RESOURCES, START_RESOURCES, emptyStock } from './data/resources.js';
import { UNIT, tileCenter, toTile, secondsToTicks } from './fixed.js';
import { Hasher } from './hash.js';
import { updateSerf, clearJob, assignJob } from './systems/serfs.js';
import { updatePayday } from './systems/payday.js';

/** @typedef {import('./data/resources.js').ResourceId} ResourceId */

/**
 * @typedef {Object} Player
 * @property {number} id
 * @property {Record<ResourceId, number>} stock refined resources (taler counts here)
 * @property {Record<ResourceId, number>} raw raw goods
 * @property {number} taxLevel 0 … 4
 * @property {Set<string>} techs
 * @property {boolean} defeated
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
 */

/**
 * @typedef {Object} Unit
 * @property {number} id
 * @property {'unit'} kind
 * @property {'serf'} type
 * @property {number} owner
 * @property {number} px @property {number} py position in milli-tiles
 * @property {number[]} path
 * @property {null|{ kind: 'build'|'gather', target: number, res?: string }} job
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
   * @param {{ seed?: number, players?: number, size?: number }} [opts]
   */
  constructor(opts = {}) {
    this.seed = opts.seed ?? 1;
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

    for (const f of gen.features) {
      if (f.kind === 'spot') this.spots.push({ x: f.x, y: f.y });
      else if (f.kind === 'shaft') this.shafts.push({ x: f.x, y: f.y, res: f.res });
      else if (f.kind === 'tree') this.addNode('tree', f.x, f.y, 'wood', BALANCE.tree.wood);
      else if (f.kind === 'pile') this.addNode('pile', f.x, f.y, f.res, BALANCE.pile.amount);
    }

    for (let p = 0; p < gen.starts.length; p++) {
      const stock = emptyStock();
      for (const r of RESOURCES) stock[r] = START_RESOURCES[r];
      this.players.push({ id: p, stock, raw: emptyStock(), taxLevel: BALANCE.tax.defaultLevel, techs: new Set(), defeated: false });
      const hq = gen.hqs[p];
      this.createBuilding(p, 'headquarters', hq.x, hq.y, true);
      const spot = this.spots.find((s) => this.isOwnStartSpot(s, gen.starts[p]));
      if (spot) this.createBuilding(p, 'villageCenter', spot.x, spot.y, true);
      for (let i = 0; i < BALANCE.startSerfs; i++) this.spawnSerf(p);
    }
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
      hp: done ? lvl.hp : Math.max(1, Math.trunc(lvl.hp / 10)), builders: [],
    };
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
    if (e.kind === 'building') this.map.release(e.x, e.y, e.w, e.h);
    this.entities.delete(e.id);
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

  popUsed(owner) { return this.countUnits(owner); }

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
    if (!p || p.defeated) return this.reject(cmd, 'Unbekannter Spieler');
    switch (cmd.type) {
      case 'buySerf': return this.cmdBuySerf(cmd);
      case 'placeBuilding': return this.cmdPlaceBuilding(cmd);
      case 'assignWork': return this.cmdAssignWork(cmd);
      case 'move': return this.cmdMove(cmd);
      case 'setTax': return this.cmdSetTax(cmd);
      default: return this.reject(cmd, 'Unbekannter Befehl');
    }
  }

  reject(cmd, reason) {
    this.events.push({ type: 'rejected', player: cmd.player, command: cmd.type, reason });
    return false;
  }

  cmdBuySerf(cmd) {
    const n = cmd.count ?? 1;
    for (let i = 0; i < n; i++) {
      if (this.popUsed(cmd.player) >= this.popLimit(cmd.player)) return this.reject(cmd, 'Bevölkerungslimit erreicht');
      if (!this.pay(cmd.player, BALANCE.serf.cost)) return this.reject(cmd, 'Nicht genug Taler');
      const u = this.spawnSerf(cmd.player);
      this.events.push({ type: 'serfBought', player: cmd.player, unit: u?.id });
    }
    return true;
  }

  /** Checks whether a building may be built at (x,y). @returns {string|null} error text or null */
  checkPlacement(owner, type, x, y) {
    const def = BUILDINGS[type];
    if (!def || def.buildable === false) return 'Gebäude nicht baubar';
    if (def.requires && !this.players[owner].techs.has(def.requires)) return 'Technologie fehlt';
    const m = this.map;
    if (def.placement === 'settlement') {
      if (!this.spots.some((s) => s.x === x && s.y === y)) return 'Nur auf Siedlungsplätzen';
      if (!m.rectFree(x, y, def.w, def.h, WATER | OCCUPIED)) return 'Platz belegt';
    } else if (def.placement === 'shaft') {
      if (!this.shafts.some((s) => s.x === x && s.y === y && s.res === def.shaftResource)) return 'Nur auf passendem Schacht';
      if (!m.rectFree(x, y, def.w, def.h, WATER | OCCUPIED)) return 'Platz belegt';
    } else {
      if (!m.rectFree(x, y, def.w, def.h, WATER | OCCUPIED | RESERVED)) return 'Platz nicht frei';
      if (m.slope(x, y, def.w, def.h) > BALANCE.maxSlope) return 'Gelände zu steil';
    }
    if (!this.canPay(owner, def.levels[0].cost)) return 'Nicht genug Rohstoffe';
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
        if (!this.map.rectFree(x - 1, y - 1, def.w + 2, def.h + 2, WATER | OCCUPIED)) continue;
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
    if (!t) return this.reject(cmd, 'Ziel existiert nicht');
    const serfs = this.ownSerfs(cmd);
    if (!serfs.length) return this.reject(cmd, 'Keine Leibeigenen ausgewählt');
    let ok = 0;
    for (const u of serfs) if (assignJob(this, u, t)) ok++;
    if (!ok) return this.reject(cmd, 'Keine Arbeit möglich');
    return true;
  }

  cmdMove(cmd) {
    const serfs = this.ownSerfs(cmd);
    if (!serfs.length) return this.reject(cmd, 'Keine Einheiten ausgewählt');
    if (!this.map.walkable(cmd.x, cmd.y)) return this.reject(cmd, 'Ziel nicht begehbar');
    for (const u of serfs) {
      clearJob(this, u);
      u.goal = this.map.idx(cmd.x, cmd.y);
      u.path = [];
    }
    return true;
  }

  cmdSetTax(cmd) {
    if (!this.players[cmd.player].techs.has('education')) return this.reject(cmd, 'Erst „Bildung“ erforschen');
    if (!(cmd.level >= 0 && cmd.level <= 4)) return this.reject(cmd, 'Ungültige Steuerstufe');
    this.players[cmd.player].taxLevel = cmd.level;
    return true;
  }

  // ---------- Tick ----------

  /** Compute one tick (100 ms). @param {any[]} [commands] additional commands for this tick */
  step(commands = []) {
    this.events = [];
    const cmds = this.pending.concat(commands);
    this.pending = [];
    for (const c of cmds) this.applyCommand(c);

    for (const e of [...this.entities.values()]) {
      if (e.kind === 'unit' && this.entities.has(e.id)) updateSerf(this, e);
    }
    updatePayday(this);
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
      h.int(p.taxLevel);
    }
    for (const e of this.entities.values()) {
      h.int(e.id).str(e.kind);
      if (e.kind === 'unit') h.int(e.px).int(e.py).int(e.timer).int(e.job ? e.job.target : 0).int(e.path.length);
      else if (e.kind === 'building') h.str(e.type).int(e.x).int(e.y).int(e.progress).int(e.done ? 1 : 0).int(e.level).int(e.hp);
      else h.int(e.x).int(e.y).int(e.amount);
    }
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
        if (e.kind === 'unit') return { id: e.id, kind: e.kind, type: e.type, owner: e.owner, x: e.px / UNIT, y: e.py / UNIT, job: e.job?.kind ?? null, working: e.path.length === 0 && !!e.job };
        if (e.kind === 'building') return { id: e.id, kind: e.kind, type: e.type, owner: e.owner, x: e.x, y: e.y, w: e.w, h: e.h, level: e.level, done: e.done, progress: e.work ? e.progress / e.work : 1 };
        return { id: e.id, kind: e.kind, x: e.x, y: e.y, res: e.res, amount: e.amount };
      }),
    };
  }
}
