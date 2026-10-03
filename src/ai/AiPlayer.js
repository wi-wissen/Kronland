// AI opponent. Reads the state of the simulation and issues only commands –
// just like a human player. Deterministic (own randomness, fixed order),
// so that it will later decide identically on all machines in lockstep multiplayer.
//
// Structure:
//   Economy:  buy and distribute serfs, build plan with priorities, research, taxes.
//   Military: raise troops, gather the army, attack, withdraw, defend home.

import { Rng } from '../sim/rng.js';
import { BUILDINGS } from '../sim/data/buildings.js';
import { TECHS } from '../sim/data/technologies.js';
import { UNITS, unitOf, fullCost, LINE_UPGRADE_COST, HEROES } from '../sim/data/units.js';
import { workerSlots, averageMotivation } from '../sim/systems/workers.js';
import { UNIT } from '../sim/fixed.js';

export const DIFFICULTY = {
  easy:   { name: 'Leicht', think: 50, serfs: 14, attackSize: 3, firstAttack: 21000, maxSites: 2, bonusGold: 0, reserve: 200, militaryShare: 30 },
  normal: { name: 'Normal', think: 25, serfs: 22, attackSize: 5, firstAttack: 14400, maxSites: 3, bonusGold: 0, reserve: 120, militaryShare: 50 },
  hard:   { name: 'Schwer', think: 12, serfs: 28, attackSize: 6, firstAttack: 9000, maxSites: 4, bonusGold: 250, reserve: 80, militaryShare: 65 },
};

/** Research order. */
const RESEARCH = ['construction', 'education', 'conscription', 'alchemy', 'standingArmy', 'gears', 'alloys', 'trade', 'metallurgy', 'pulley', 'printing', 'tactics', 'chemistry', 'architecture', 'libraries', 'horseBreeding'];

/** Extension wish list: [building, count]. Worked through from top to bottom. */
const BUILD_PLAN = [
  ['residence', 1], ['farm', 1], ['university', 1], ['clayMine', 1], ['stoneMine', 1],
  ['residence', 2], ['farm', 2], ['sawmill', 1], ['ironMine', 1], ['brickworks', 1],
  ['barracks', 1], ['stoneMine', 2], ['sulfurMine', 1], ['smithy', 1], ['stonemason', 1], ['sawmill', 2],
  ['tower', 1], ['archery', 1], ['residence', 3], ['farm', 3], ['alchemist', 1], ['smithy', 2],
  ['foundry', 1], ['chapel', 1], ['bank', 1], ['ironMine', 2], ['residence', 4], ['farm', 4], ['tower', 2],
  ['stonemason', 2], ['clock', 1], ['residence', 5], ['farm', 5], ['sulfurMine', 2], ['bank', 2],
];

export class AiPlayer {
  /**
   * @param {import('../sim/sim.js').Sim} sim
   * @param {number} player
   * @param {keyof typeof DIFFICULTY} [difficulty]
   */
  constructor(sim, player, difficulty = 'normal') {
    this.sim = sim;
    this.player = player;
    this.cfg = DIFFICULTY[difficulty] ?? DIFFICULTY.normal;
    this.difficulty = difficulty;
    this.rng = new Rng(sim.seed * 31 + player * 977 + 13);
    this.offset = player * 7;
    this.armyState = 'gather';
    this.attackStrength = 0;
    this.lastPayday = 0;
  }

  get me() { return this.sim.players[this.player]; }

  /** State for save games. */
  getState() {
    return { player: this.player, difficulty: this.difficulty, rng: this.rng.getState(), armyState: this.armyState, attackStrength: this.attackStrength };
  }

  static fromState(sim, st) {
    const ai = new AiPlayer(sim, st.player, st.difficulty);
    ai.rng.setState(st.rng);
    ai.armyState = st.armyState;
    ai.attackStrength = st.attackStrength;
    return ai;
  }

  /** Call once per tick; issues commands directly to the simulation. */
  update() {
    const sim = this.sim;
    if (this.me.defeated || sim.winner !== null) return;
    // bonus as in the original ("refresh") for the hard level
    if (this.cfg.bonusGold && sim.tick > 0 && sim.tick % 1200 === 0) this.me.stock.gold += this.cfg.bonusGold;
    if ((sim.tick + this.offset) % this.cfg.think !== 0) return;
    this.cmds = [];
    this.scan();
    this.economy();
    this.military();
    for (const c of this.cmds) sim.command({ ...c, player: this.player });
  }

  issue(cmd) { this.cmds.push(cmd); }

  // ---------- Situation picture ----------

  scan() {
    const sim = this.sim, me = this.player;
    this.buildings = []; this.serfs = []; this.leaders = []; this.heroes = []; this.workers = 0;
    this.enemyNearHome = [];
    const hq = sim.findBuilding(me, 'headquarters');
    this.hq = hq;
    this.home = hq ? { x: hq.x + 2, y: hq.y + 2 } : { x: 0, y: 0 };
    for (const e of sim.entities.values()) {
      if (e.owner === me) {
        if (e.kind === 'building') this.buildings.push(e);
        else if (e.kind === 'unit') this.serfs.push(e);
        else if (e.kind === 'leader') this.leaders.push(e);
        else if (e.kind === 'hero') this.heroes.push(e);
        else if (e.kind === 'worker') this.workers++;
      } else if (e.owner !== undefined && e.owner >= 0 && !sim.allied(me, e.owner) && (e.kind === 'leader' || e.kind === 'soldier' || e.kind === 'hero')) {
        if (e.kind === 'hero' && e.down) continue;
        const d = Math.hypot(e.px / UNIT - this.home.x, e.py / UNIT - this.home.y);
        if (d < 22) this.enemyNearHome.push(e);
      }
    }
    this.count = {};
    this.sites = 0;
    for (const b of this.buildings) {
      this.count[b.type] = (this.count[b.type] ?? 0) + 1;
      if (!b.done) this.sites++;
    }
  }

  has(type, n = 1) { return (this.count[type] ?? 0) >= n; }

  // ---------- Economy ----------

  economy() {
    this.buySerfs();
    this.research();
    this.taxes();
    this.planBuildings();
    this.upgradeBuildings();
    this.assignSerfs();
  }

  buySerfs() {
    const sim = this.sim;
    const free = sim.popLimit(this.player) - sim.popUsed(this.player);
    const want = Math.min(this.cfg.serfs - this.serfs.length, free - 2, Math.floor((this.me.stock.gold - this.cfg.reserve) / 50));
    if (want > 0) this.issue({ type: 'buySerf', count: Math.min(want, 4) });
  }

  research() {
    const sim = this.sim;
    for (const b of this.buildings) {
      if (b.type !== 'university' || !b.done || b.research) continue;
      for (const t of RESEARCH) {
        if (this.me.techs.has(t)) continue;
        if (sim.checkResearch(this.player, b, t)) continue;
        // leave a reserve for the extension
        if (!this.affordable(TECHS[t].cost, 1)) continue;
        this.issue({ type: 'research', building: b.id, tech: t });
        return;
      }
    }
  }

  taxes() {
    if (!this.me.techs.has('education')) return;
    const mot = averageMotivation(this.sim, this.player);
    const want = mot > 130 ? 4 : mot > 90 ? 3 : mot < 60 ? 1 : 2;
    if (want !== this.me.taxLevel) this.issue({ type: 'setTax', level: want });
  }

  /** Can one afford this and still keep some reserve? */
  affordable(cost, factor = 1.2) {
    for (const [r, n] of Object.entries(cost)) if (this.sim.available(this.player, r) < n * factor + (r === 'gold' ? this.cfg.reserve : 0)) return false;
    return true;
  }

  planBuildings() {
    if (this.sites >= this.cfg.maxSites) return;
    const sim = this.sim;
    // Demand: beds and eating places for the workers
    const beds = this.buildings.filter((b) => b.type === 'residence' && b.done).reduce((s, b) => s + BUILDINGS.residence.levels[b.level].beds, 0);
    const seats = this.buildings.filter((b) => b.type === 'farm' && b.done).reduce((s, b) => s + BUILDINGS.farm.levels[b.level].seats, 0);
    const slots = this.buildings.reduce((s, b) => s + (b.done ? workerSlots(b) : 0), 0);
    const urgent = [];
    if (beds < slots - 2) urgent.push('residence');
    if (seats < slots - 2) urgent.push('farm');
    // New village centre if the limit presses
    if (sim.popLimit(this.player) - sim.popUsed(this.player) < 10) urgent.push('villageCenter');
    for (const type of urgent) if (this.tryBuild(type)) return;
    for (const [type, n] of BUILD_PLAN) {
      if (this.has(type, n)) continue;
      if (this.tryBuild(type)) return;
      // Do not get stuck on expensive but reachable targets: keep searching in the list
    }
  }

  tryBuild(type) {
    const sim = this.sim, def = BUILDINGS[type];
    if (def.requires && !this.me.techs.has(def.requires)) return false;
    if (!this.affordable(def.levels[0].cost)) return false;
    const near = type.endsWith('Mine') || type === 'villageCenter' ? this.home : this.spotNear(type);
    const pos = sim.findPlacement(this.player, type, near.x, near.y, 26);
    if (!pos) return false;
    // Shafts and settlement spots: only within sensible proximity
    if (Math.hypot(pos.x - this.home.x, pos.y - this.home.y) > 38) return false;
    const builders = this.idleSerfs().slice(0, 4).map((u) => u.id);
    this.issue({ type: 'placeBuilding', building: type, x: pos.x, y: pos.y, units: builders });
    this.sites++;
    this.count[type] = (this.count[type] ?? 0) + 1;
    this.reserved = new Set([...(this.reserved ?? []), ...builders]);
    return true;
  }

  /** Building site centre: housing and eating near the workshops, military towards the opponent. */
  spotNear(type) {
    const h = this.home;
    const enemy = this.enemyHome();
    if (['barracks', 'archery', 'stable', 'foundry', 'tower'].includes(type) && enemy) {
      const dx = enemy.x - h.x, dy = enemy.y - h.y, d = Math.hypot(dx, dy) || 1;
      return { x: Math.round(h.x + (dx / d) * 9), y: Math.round(h.y + (dy / d) * 9) };
    }
    const r = 4 + this.rng.int(6);
    const corners = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
    const [sx, sy] = corners[this.rng.int(4)];
    return { x: h.x + sx * r, y: h.y + sy * r };
  }

  upgradeBuildings() {
    if (this.sites >= this.cfg.maxSites) return;
    const sim = this.sim;
    // castle to fortress as soon as basic supply stands
    const order = ['headquarters', 'university', 'villageCenter', 'residence', 'farm', 'barracks', 'clayMine', 'stoneMine', 'ironMine', 'tower'];
    for (const type of order) {
      for (const b of this.buildings) {
        if (b.type !== type || !b.done) continue;
        if (type === 'headquarters' && !(this.has('brickworks') && this.has('university'))) continue;
        if (sim.checkUpgrade(this.player, b)) continue;
        const next = BUILDINGS[type].levels[b.level + 1];
        if (!this.affordable(next.cost, type === 'headquarters' ? 1 : 1.3)) continue;
        this.issue({ type: 'upgradeBuilding', building: b.id, units: this.idleSerfs().slice(0, 4).map((u) => u.id) });
        this.sites++;
        return;
      }
    }
  }

  idleSerfs() {
    return this.serfs.filter((u) => !u.job && u.goal === undefined && !u.militia && !this.reserved?.has(u.id));
  }

  assignSerfs() {
    const sim = this.sim;
    this.reserved = this.reserved ?? new Set();
    // Fill construction sites with serfs first
    for (const b of this.buildings) {
      if (b.done || b.builders.length >= 4) continue;
      const idle = this.idleSerfs().slice(0, 4 - b.builders.length);
      if (idle.length) {
        this.issue({ type: 'assignWork', units: idle.map((u) => u.id), target: b.id });
        idle.forEach((u) => this.reserved.add(u.id));
      }
    }
    // Rest: resources. Wood is most important, then whatever is scarcest.
    const idle = this.idleSerfs();
    if (!idle.length) { this.reserved = new Set(); return; }
    const needs = ['clay', 'stone', 'iron', 'sulfur'].sort((a, b) => sim.available(this.player, a) - sim.available(this.player, b));
    const woodShort = sim.available(this.player, 'wood') < 300;
    for (let i = 0; i < idle.length; i++) {
      const res = woodShort || i % 3 !== 2 ? 'wood' : needs[(i / 3 | 0) % 2];
      const node = this.nearestNode(res, idle[i]) ?? this.nearestNode('wood', idle[i]);
      if (node) this.issue({ type: 'assignWork', units: [idle[i].id], target: node.id });
    }
    this.reserved = new Set();
  }

  nearestNode(res, from) {
    let best = null, bd = Infinity;
    const fx = from.px / UNIT, fy = from.py / UNIT;
    for (const e of this.sim.entities.values()) {
      if ((e.kind !== 'tree' && e.kind !== 'pile') || e.res !== res || e.amount <= 0) continue;
      const d = (e.x - fx) ** 2 + (e.y - fy) ** 2;
      const home = (e.x - this.home.x) ** 2 + (e.y - this.home.y) ** 2;
      if (home > 45 * 45) continue;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ---------- Military ----------

  enemyHome() {
    let best = null, bd = Infinity;
    for (const p of this.sim.players) {
      if (p.id === this.player || p.defeated || this.sim.allied(this.player, p.id)) continue;
      const hq = this.sim.findBuilding(p.id, 'headquarters');
      if (!hq) continue;
      const d = Math.hypot(hq.x - this.home.x, hq.y - this.home.y);
      if (d < bd) { bd = d; best = { x: hq.x + 2, y: hq.y + 2, id: hq.id, owner: p.id }; }
    }
    return best;
  }

  strength(leaders) {
    let s = 0;
    for (const L of leaders) s += UNITS[L.def].attack * (L.soldiers.length + 1);
    return s;
  }

  military() {
    this.recruit();
    this.upgradeLines();
    this.refill();
    this.commandArmy();
    this.useHeroes();
  }

  recruit() {
    const sim = this.sim;
    const free = sim.popLimit(this.player) - sim.popUsed(this.player);
    if (free < 6) return;
    const mix = ['sword', 'bow', 'spear', 'sword', 'bow', 'cannon'];
    const line = mix[this.leaders.length % mix.length];
    const cannons = this.leaders.filter((L) => UNITS[L.def].line === 'cannon').length;
    for (const b of this.buildings) {
      if (!b.done) continue;
      const fitting = b.type === 'barracks' ? (line === 'bow' || line === 'cannon' ? 'sword' : line)
        : b.type === 'archery' ? 'bow'
          : b.type === 'foundry' && cannons < 3 ? 'cannon' : null;
      if (!fitting) continue;
      const def = unitOf(fitting, this.me.unitTier[fitting]);
      // Share of thalers the AI spends on the military rises with difficulty
      const cost = fullCost(def);
      const gold = this.me.stock.gold;
      if (!this.affordable(cost, 1) || gold - cost.gold < (gold * (100 - this.cfg.militaryShare)) / 100 - 50) continue;
      this.issue({ type: 'recruit', building: b.id, line: fitting, full: true });
      return;
    }
  }

  upgradeLines() {
    for (const line of ['sword', 'bow', 'spear']) {
      const tier = this.me.unitTier[line];
      const cost = LINE_UPGRADE_COST[`${line}${tier}`];
      if (!cost || this.sim.checkLineTier(this.player, line, tier + 1)) continue;
      if (!this.affordable(cost, 1.5)) continue;
      this.issue({ type: 'upgradeLine', line });
      return;
    }
  }

  refill() {
    for (const L of this.leaders) {
      const d = UNITS[L.def];
      if (L.soldiers.length >= d.soldiers || !this.affordable(d.soldierCost, 3)) continue;
      const b = this.buildings.find((x) => x.type === d.building && x.done);
      if (!b) continue;
      const near = Math.abs(L.px / UNIT - b.x - b.w / 2) < 6 && Math.abs(L.py / UNIT - b.y - b.h / 2) < 6;
      if (near) this.issue({ type: 'buySoldiers', leader: L.id });
    }
  }

  rallyPoint() {
    const enemy = this.enemyHome();
    const h = this.home;
    if (!enemy) return h;
    const dx = enemy.x - h.x, dy = enemy.y - h.y, d = Math.hypot(dx, dy) || 1;
    return { x: Math.round(h.x + (dx / d) * 8), y: Math.round(h.y + (dy / d) * 8) };
  }

  commandArmy() {
    const sim = this.sim;
    const army = this.leaders.filter((L) => UNITS[L.def].line !== 'cannon' || true);
    const heroes = this.heroes.filter((h) => !h.down).map((h) => h.id);
    const ids = army.map((L) => L.id);

    // defending home has priority
    if (this.enemyNearHome.length) {
      const t = this.enemyNearHome[0];
      if (ids.length + heroes.length) this.issue({ type: 'order', units: [...ids, ...heroes], order: 'attackMove', x: Math.floor(t.px / UNIT), y: Math.floor(t.py / UNIT) });
      const enemyStrength = this.enemyNearHome.reduce((s, e) => s + (e.kind === 'soldier' ? 10 : 15), 0);
      const militia = this.serfs.some((u) => u.militia);
      if (!militia && enemyStrength > this.strength(army) + 40) this.issue({ type: 'militia', on: true });
      this.armyState = 'defend';
      return;
    }
    if (this.serfs.some((u) => u.militia)) this.issue({ type: 'militia', on: false });
    if (this.armyState === 'defend') this.armyState = 'gather';

    const strength = this.strength(army);
    const enemy = this.enemyHome();
    if (this.armyState === 'gather') {
      const rally = this.rallyPoint();
      for (const L of army) {
        const far = Math.hypot(L.px / UNIT - rally.x, L.py / UNIT - rally.y) > 6;
        if (far && L.order?.type === 'idle' && !L.targetId) {
          // incomplete squads first to the building for refilling
          const d = UNITS[L.def];
          if (L.soldiers.length < d.soldiers) {
            const b = this.buildings.find((x) => x.type === d.building && x.done);
            if (b && this.affordable(d.soldierCost, 3)) { this.issue({ type: 'order', units: [L.id], order: 'move', x: b.x + b.w + 1, y: b.y + 1 }); continue; }
          }
          this.issue({ type: 'order', units: [L.id], order: 'move', x: rally.x, y: rally.y });
        }
      }
      const late = sim.tick >= this.cfg.firstAttack + 9000 && army.length >= 3;
      const ready = (army.length >= this.cfg.attackSize && sim.tick >= this.cfg.firstAttack) || late;
      if (ready && enemy) {
        this.armyState = 'attack';
        this.attackStrength = strength;
        this.issue({ type: 'order', units: [...ids, ...heroes], order: 'attackMove', x: enemy.x, y: enemy.y });
      }
      return;
    }
    if (this.armyState === 'attack') {
      if (!enemy) { this.armyState = 'gather'; return; }
      if (strength < this.attackStrength * 0.35 || army.length === 0) {
        this.armyState = 'gather';
        const rally = this.rallyPoint();
        if (ids.length + heroes.length) this.issue({ type: 'order', units: [...ids, ...heroes], order: 'move', x: rally.x, y: rally.y });
        return;
      }
      // drive stragglers on again
      const idle = army.filter((L) => L.order?.type === 'idle' && !L.targetId).map((L) => L.id);
      if (idle.length) {
        const near = army.some((L) => Math.hypot(L.px / UNIT - enemy.x, L.py / UNIT - enemy.y) < 10);
        this.issue(near ? { type: 'order', units: idle, order: 'attack', target: enemy.id } : { type: 'order', units: idle, order: 'attackMove', x: enemy.x, y: enemy.y });
      }
    }
  }

  useHeroes() {
    const sim = this.sim;
    for (const h of this.heroes) {
      if (h.down) continue;
      const near = h.targetId ? sim.entities.get(h.targetId) : null;
      if (!near) continue;
      for (const [ab, def] of Object.entries(HEROES[h.hero].abilities)) {
        if ((h.ready[ab] ?? 0) > sim.tick) continue;
        if (ab === 'heal' && h.hp > HEROES[h.hero].hp * 0.6) continue;
        void def;
        this.issue({ type: 'ability', hero: h.id, ability: ab });
        break;
      }
    }
  }
}
