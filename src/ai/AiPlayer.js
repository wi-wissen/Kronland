// AI opponent. Reads the state of the simulation and issues only commands –
// just like a human player. Deterministic (own randomness, fixed order),
// so that it will later decide identically on all machines in lockstep multiplayer.
//
// Fog of war: the AI does not cheat. It knows enemy troops only if its team sees them,
// enemy buildings only as the last seen state (src/sim/systems/vision.js). As in the skirmish
// of the original, only the start positions are known; its army marches there and attacks whatever it
// sees there. Only advantage: 'hard' learns of enemies near its own castle even in the fog (DIFFICULTY.intel).
//
// Structure:
//   Economy:  buy and distribute serfs, build plan with priorities, research, taxes.
//   Military: raise troops, gather the army, attack, withdraw, defend home.

import { Rng } from '../sim/rng.js';
import { BUILDINGS, buildersOf, isUpgrading } from '../sim/data/buildings.js';
import { TECHS } from '../sim/data/technologies.js';
import { UNITS, unitOf, fullCost, LINE_UPGRADE_COST, HEROES } from '../sim/data/units.js';
import { workerSlots, averageMotivation } from '../sim/systems/workers.js';
import { UNIT } from '../sim/fixed.js';
import { BUILDING_TECHS } from '../sim/data/buildingTechs.js';
import { checkBuildingResearch } from '../sim/systems/techs.js';
import { checkTrade, tradeCost } from '../sim/systems/market.js';
import { isDamaged } from '../sim/systems/damage.js';
import { siteRoom, hasFreeSpot } from '../sim/systems/serfs.js';
import { takenSpots } from '../sim/systems/spots.js';
import { MARKET } from '../sim/data/market.js';
import { WATER, OCCUPIED, CLIFF, BRIDGE } from '../sim/map.js';
import { canSee, knownBuildings } from '../sim/systems/vision.js';

export const DIFFICULTY = {
  easy:   { name: 'Leicht', think: 50, serfs: 14, attackSize: 3, firstAttack: 21000, maxSites: 2, bonusGold: 0, reserve: 200, militaryShare: 30 },
  normal: { name: 'Normal', think: 25, serfs: 22, attackSize: 5, firstAttack: 14400, maxSites: 3, bonusGold: 0, reserve: 120, militaryShare: 50 },
  hard:   { name: 'Schwer', think: 12, serfs: 28, attackSize: 6, firstAttack: 9000, maxSites: 4, bonusGold: 250, reserve: 80, militaryShare: 65, intel: true },
};
// intel: guards report enemies within 22 tiles around the castle even in the fog (small knowledge advantage)

/** Research order. */
export const RESEARCH = ['construction', 'education', 'conscription', 'alchemy', 'standingArmy', 'trade', 'gears', 'alloys', 'metallurgy', 'pulley', 'printing', 'tactics', 'chemistry', 'architecture', 'libraries', 'horseBreeding'];

/**
 * Building technologies in desired order. The AI researches them only if it is "rich"
 * (cost × 2 plus reserve available), so that build-up and troops do not suffer.
 */
export const BUILDING_RESEARCH = [
  'leatherMail', 'softLeather', 'woodHardening', 'marching', 'masonry', 'loom', 'fletching', 'masterShooter',
  'chainMail', 'paddedLeather', 'masterSmith', 'tracking', 'gunpowder', 'turnery', 'bodkin', 'weatherForecast',
  'plateArmor', 'reinforcedLeather', 'ironCasting', 'heatedShots', 'shoes', 'undercarriage', 'horseshoe', 'cityGuard',
  // bridge building
  'mathematics',
];

/** Extension wish list: [building, count]. Worked through from top to bottom. */
export const BUILD_PLAN = [
  ['residence', 1], ['farm', 1], ['university', 1], ['clayMine', 1], ['stoneMine', 1],
  ['residence', 2], ['farm', 2], ['sawmill', 1], ['ironMine', 1], ['brickworks', 1],
  ['barracks', 1], ['stoneMine', 2], ['sulfurMine', 1], ['smithy', 1], ['storehouse', 1], ['stonemason', 1], ['sawmill', 2],
  ['tower', 1], ['archery', 1], ['residence', 3], ['farm', 3], ['alchemist', 1], ['smithy', 2],
  ['foundry', 1], ['chapel', 1], ['bank', 1], ['ironMine', 2], ['residence', 4], ['farm', 4], ['tower', 2],
  ['stonemason', 2], ['clock', 1], ['residence', 5], ['farm', 5], ['sulfurMine', 2], ['bank', 2],
  ['weatherTower', 1],
];

/** Bridge and ornaments: [building, count, after which entry of the base plan]. */
const EXTRAS = [['fountain', 1, 'tower'], ['bridge', 1, 'archery'], ['statue', 1, 'clock']];
const EXTRA_TYPES = new Set(EXTRAS.map(([t]) => t));

/** Build plan with bridge and ornaments. @param {Array<[string, number]>} base */
function withExtras(base) {
  const out = [];
  for (const entry of base) {
    out.push(entry);
    for (const [type, n, after] of EXTRAS) if (after === entry[0] && entry[1] === 1) out.push([type, n]);
  }
  return out;
}

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
    return {
      player: this.player, difficulty: this.difficulty, rng: this.rng.getState(), armyState: this.armyState, attackStrength: this.attackStrength,
      attackNowSeen: this.attackNowSeen ?? 0, forceAttack: !!this.forceAttack,
      badTargets: [...(this.badTargets ?? [])],
    };
  }

  static fromState(sim, st) {
    const ai = new AiPlayer(sim, st.player, st.difficulty);
    ai.rng.setState(st.rng);
    ai.armyState = st.armyState;
    ai.attackStrength = st.attackStrength;
    ai.attackNowSeen = st.attackNowSeen ?? 0;
    ai.forceAttack = !!st.forceAttack;
    if (st.badTargets?.length) ai.badTargets = new Set(st.badTargets);
    return ai;
  }

  /**
   * Take over mission settings (src/sim/missions): strength, aggressiveness, start delay,
   * forbidden buildings, immediate attack. Without a mission everything stays as in free play.
   * @returns {boolean} false = AI is still waiting
   */
  applyMission() {
    const mc = this.sim.mission?.state?.ai?.[this.player];
    if (!mc) return true;
    if (this.sim.tick < mc.startTick) return false;
    const key = `${mc.difficulty}|${mc.aggression}|${mc.serfs ?? ''}`;
    if (key !== this.missionKey) {
      this.missionKey = key;
      this.difficulty = mc.difficulty;
      const base = DIFFICULTY[mc.difficulty] ?? DIFFICULTY.normal;
      const agg = mc.aggression;
      this.cfg = {
        ...base,
        // passive: never attacks on its own; aggressive: earlier and with smaller armies
        firstAttack: agg === 'passive' ? Infinity : agg === 'aggressive' ? Math.trunc(base.firstAttack / 3) : base.firstAttack,
        attackSize: agg === 'aggressive' ? Math.max(2, base.attackSize - 2) : base.attackSize,
        // mission can limit the number of serfs (less economy and militia)
        serfs: mc.serfs ?? base.serfs,
      };
    }
    this.forbid = mc.forbid ?? [];
    this.noMilitia = mc.militia === false;
    if (mc.attackNow && mc.attackNow !== this.attackNowSeen) {
      this.attackNowSeen = mc.attackNow;
      this.forceAttack = true;
    }
    return true;
  }

  /** Call once per tick; issues commands directly to the simulation. */
  update() {
    const sim = this.sim;
    if (this.me.defeated || sim.winner !== null) return;
    if (!this.applyMission()) return;
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
    // Reachability: regions (without ice) that can be reached on foot from the castle
    const map = sim.map;
    this.regions = new Set();
    if (hq) for (const k of map.ring(hq.x, hq.y, hq.w, hq.h)) { const r = map.landRegionAt(k); if (r) this.regions.add(r); }
    for (const e of sim.entities.values()) {
      if (e.owner === me) {
        if (e.kind === 'building') this.buildings.push(e);
        else if (e.kind === 'unit') this.serfs.push(e);
        else if (e.kind === 'leader') this.leaders.push(e);
        else if (e.kind === 'hero') this.heroes.push(e);
        else if (e.kind === 'worker') this.workers++;
      } else if (e.owner !== undefined && e.owner >= 0 && sim.hostile(me, e.owner) && (e.kind === 'leader' || e.kind === 'soldier' || e.kind === 'hero')) {
        if (e.kind === 'hero' && e.down) continue;
        // Fog: only seen enemies (Hard: guards also report enemies in the fog near the castle)
        if (!this.cfg.intel && !canSee(sim, me, e)) continue;
        const d = Math.hypot(e.px / UNIT - this.home.x, e.py / UNIT - this.home.y);
        // Only enemies the troops can get to (not on the other shore)
        if (d < 22 && this.reachableAt(e.px / UNIT, e.py / UNIT)) this.enemyNearHome.push(e);
      }
    }
    // Bottleneck: one resource is missing while another piles up → the market pays off
    const av = (r) => sim.available(me, r);
    const big = ['clay', 'stone', 'iron', 'sulfur'].some((r) => av(r) > 1500);
    this.starved = big && (av('wood') < 200 || av('gold') < 150 || av('stone') < 150);
    this.count = {};
    this.sites = 0;
    for (const b of this.buildings) {
      this.count[b.type] = (this.count[b.type] ?? 0) + 1;
      if (!b.done) this.sites++;
    }
  }

  has(type, n = 1) { return (this.count[type] ?? 0) >= n; }

  // ---------- Reachability ----------

  /** Is the tile (or a free neighbouring tile) reachable on foot from the castle? */
  reachableAt(x, y) {
    if (!this.hq) return true; // without a castle (mission setup) no check
    const map = this.sim.map, tx = Math.floor(x), ty = Math.floor(y);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!map.inBounds(tx + dx, ty + dy)) continue;
      if (this.regions.has(map.landRegionAt(map.idx(tx + dx, ty + dy)))) return true;
    }
    return false;
  }

  /** Can one step up to a rectangle (building, construction site, tree)? */
  reachableRect(x, y, w, h) {
    if (!this.hq) return true;
    const map = this.sim.map;
    for (let j = y - 1; j <= y + h; j++) for (let i = x - 1; i <= x + w; i++) {
      if ((i >= x && i < x + w && j >= y && j < y + h) || !map.inBounds(i, j)) continue;
      if (this.regions.has(map.landRegionAt(map.idx(i, j)))) return true;
    }
    return false;
  }

  /** Is the figure in the castle region (otherwise it is cut off and gets no jobs)? */
  atHome(u) {
    if (!this.hq) return true;
    const map = this.sim.map;
    return this.regions.has(map.landRegionAt(map.idx(Math.floor(u.px / UNIT), Math.floor(u.py / UNIT))));
  }

  /**
   * Does a building site stay reachable from the castle after construction? The building itself blocks its area –
   * a shaft in a rock niche could otherwise wall up its only access (serfs and workers
   * would be stuck behind it). Flood fill from the castle (without ice) with the area blocked, aborting at the target.
   */
  reachableAfterBuild(x, y, w, h) {
    if (!this.hq) return true;
    if (!this.reachableRect(x, y, w, h)) return false;
    const map = this.sim.map, W = map.width, H = map.height, n = W * H, flags = map.flags;
    if (this.seenBuf?.length !== n) { this.seenBuf = new Uint8Array(n); this.queueBuf = new Int32Array(n); }
    const seen = this.seenBuf.fill(0), queue = this.queueBuf;
    const inRect = (i, j) => i >= x && i < x + w && j >= y && j < y + h;
    const free = (i, j) => {
      if (i < 0 || j < 0 || i >= W || j >= H || inRect(i, j)) return false;
      const f = flags[j * W + i];
      return !(f & (OCCUPIED | CLIFF)) && (!(f & WATER) || !!(f & BRIDGE));
    };
    let head = 0, tail = 0;
    const hq = this.hq;
    for (const k of map.ring(hq.x, hq.y, hq.w, hq.h)) if (free(k % W, (k / W) | 0) && !seen[k]) { seen[k] = 1; queue[tail++] = k; }
    while (head < tail) {
      const k = queue[head++], i = k % W, j = (k / W) | 0;
      if (i >= x - 1 && i <= x + w && j >= y - 1 && j <= y + h) return true; // am Bauplatz angekommen
      if (free(i - 1, j) && !seen[k - 1]) { seen[k - 1] = 1; queue[tail++] = k - 1; }
      if (free(i + 1, j) && !seen[k + 1]) { seen[k + 1] = 1; queue[tail++] = k + 1; }
      if (free(i, j - 1) && !seen[k - W]) { seen[k - W] = 1; queue[tail++] = k - W; }
      if (free(i, j + 1) && !seen[k + W]) { seen[k + W] = 1; queue[tail++] = k + W; }
    }
    return false;
  }

  /** Nearest reachable tile around (x,y) (for rally and attack points), or null. */
  reachPoint(x, y, maxR = 10) {
    const map = this.sim.map, cx = Math.round(x), cy = Math.round(y);
    for (let r = 0; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const px = cx + dx, py = cy + dy;
        if (map.inBounds(px, py) && map.walkable(px, py) && (!this.hq || this.regions.has(map.landRegionAt(map.idx(px, py))))) return { x: px, y: py };
      }
    }
    return null;
  }

  // ---------- Economy ----------

  economy() {
    this.replan();
    this.buySerfs();
    this.research();
    this.researchBuildings();
    this.trade();
    this.taxes();
    this.planBuildings();
    this.upgradeBuildings();
    this.repairBuildings();
    this.assignSerfs();
  }

  /** Building technologies (armour, weapons, pace …) if enough resources are left over. */
  researchBuildings() {
    const sim = this.sim;
    // Only once the basic economy stands
    if (this.workers < 25 || !this.has('barracks')) return;
    for (const t of BUILDING_RESEARCH) {
      if (this.me.techs.has(t)) continue;
      const def = BUILDING_TECHS[t];
      if (!this.affordable(def.cost, 2)) continue;
      const b = this.buildings.find((x) => x.type === def.building && !checkBuildingResearch(sim, this.player, x, t));
      if (!b) continue;
      this.issue({ type: 'research', building: b.id, tech: t });
      return;
    }
  }

  /**
   * Market: trade surpluses (esp. iron/sulphur/clay) for scarce goods (thalers, wood, stone).
   * One trade at a time; only if the exchange is not too unfavourable.
   */
  trade() {
    const sim = this.sim;
    const market = this.buildings.find((b) => b.type === 'storehouse' && b.level >= 1 && b.done && !b.trade && b.workers.length);
    if (!market) return;
    const avail = (r) => sim.available(this.player, r);
    const want = { gold: 400 + this.cfg.reserve, wood: 500, stone: 400, clay: 400, iron: 300, sulfur: 200 };
    // Scarcest resource (relative to demand) and largest surplus
    const res = ['gold', 'wood', 'stone', 'clay', 'iron', 'sulfur'];
    const need = res.filter((r) => avail(r) < want[r]).sort((a, b) => avail(a) / want[a] - avail(b) / want[b])[0];
    if (!need) return;
    const surplus = res.filter((r) => r !== need && avail(r) > want[r] * 3).sort((a, b) => avail(b) / want[b] - avail(a) / want[a]);
    for (const give of surplus) {
      for (const amount of [200, 100, MARKET.step]) {
        const cost = tradeCost(sim, give, need, amount);
        // Use at most half the surplus and do not pay a usurious price
        if (cost > (avail(give) - want[give]) / 2) continue;
        if (cost * MARKET.basePrice[give] > amount * MARKET.basePrice[need] * 1.6) continue;
        if (checkTrade(sim, this.player, market, give, need, amount)) continue;
        this.issue({ type: 'trade', building: market.id, give, take: need, amount });
        return;
      }
    }
  }

  /** Have damaged buildings repaired (burning ones first). */
  repairBuildings() {
    const sim = this.sim;
    if (this.enemyNearHome?.length > 2) return; // do not run into the fight
    const damaged = this.buildings.filter((b) => isDamaged(sim, b) && b.builders.length < 2 && this.reachableRect(b.x, b.y, b.w, b.h))
      .sort((a, b) => (b.burning ? 1 : 0) - (a.burning ? 1 : 0) || a.id - b.id);
    for (const b of damaged.slice(0, 2)) {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const serfs = this.serfs.filter((u) => !u.militia && !this.reserved?.has(u.id) && u.job?.kind !== 'build' && u.job?.kind !== 'repair')
        .sort((u, v) => Math.hypot(u.px / UNIT - cx, u.py / UNIT - cy) - Math.hypot(v.px / UNIT - cx, v.py / UNIT - cy) || u.id - v.id)
        .slice(0, (b.burning ? 3 : 2) - b.builders.length);
      serfs.length = Math.min(serfs.length, serfs.length ? siteRoom(sim, b, serfs[0]) : 0);
      if (!serfs.length) continue;
      this.issue({ type: 'assignWork', units: serfs.map((u) => u.id), target: b.id });
      this.reserved = new Set([...(this.reserved ?? []), ...serfs.map((u) => u.id)]);
    }
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
      const order = this.starved && !this.me.techs.has('trade') ? ['education', 'trade', ...RESEARCH] : RESEARCH;
      for (const t of order) {
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
    if (this.starved && !this.has('storehouse')) urgent.push('storehouse');
    for (const type of urgent) if (this.tryBuild(type)) return;
    for (const [type, n] of (this.plan ??= withExtras(BUILD_PLAN))) {
      if (this.has(type, n)) continue;
      // Bridge and ornaments only once barracks and a small army stand and resources are plentiful
      // (otherwise wood and time are lacking for the village extension, and workers fill the population before the army)
      if (EXTRA_TYPES.has(type) && (!this.has('barracks') || this.leaders.length < 3
        || !this.affordable(BUILDINGS[type].levels[0].cost, type === 'bridge' ? 1.5 : 2.5))) continue;
      if (this.tryBuild(type)) return;
      // Do not get stuck on expensive but reachable targets: keep searching in the list
    }
  }

  tryBuild(type, at = null) {
    const sim = this.sim, def = BUILDINGS[type];
    if (this.forbid?.includes(type)) return false;
    if (def.requires && !this.me.techs.has(def.requires)) return false;
    if (!this.affordable(def.levels[0].cost)) return false;
    const near = at ?? (type.endsWith('Mine') || type === 'villageCenter' ? this.home : this.spotNear(type));
    // Only building sites the serfs can reach from the castle
    const pos = sim.findPlacement(this.player, type, near.x, near.y, 26, (x, y) => this.reachableAfterBuild(x, y, def.w, def.h));
    if (!pos) return false;
    // Shafts and settlement spots: only within sensible proximity
    if (Math.hypot(pos.x - this.home.x, pos.y - this.home.y) > (type === 'bridge' ? 60 : 38)) return false;
    // Bridge only as a shortcut: spot near the middle between own and (known) enemy castle
    if (type === 'bridge' && Math.hypot(pos.x - near.x, pos.y - near.y) > 20) return false;
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
    const enemy = this.enemyHome(true);
    if (['barracks', 'archery', 'stable', 'foundry', 'tower', 'bridge'].includes(type) && enemy) {
      // Bridge: the bridge spot nearest to the route to the opponent
      if (type === 'bridge') return { x: Math.round((h.x + enemy.x) / 2), y: Math.round((h.y + enemy.y) / 2) };
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
    // Bottleneck: extend the storehouse to a market first
    if (this.starved) {
      const st = this.buildings.find((b) => b.type === 'storehouse' && b.done && b.level === 0 && !sim.checkUpgrade(this.player, b));
      if (st) {
        this.issue({ type: 'upgradeBuilding', building: st.id });
        this.sites++;
        return;
      }
    }
    const order = ['headquarters', 'university', 'villageCenter', 'residence', 'farm', 'barracks', 'clayMine', 'stoneMine', 'ironMine', 'tower', 'storehouse', 'smithy', 'sawmill', 'alchemist'];
    for (const type of order) {
      for (const b of this.buildings) {
        if (b.type !== type || !b.done) continue;
        if (type === 'headquarters' && !(this.has('brickworks') && this.has('university'))) continue;
        if (sim.checkUpgrade(this.player, b)) continue;
        const next = BUILDINGS[type].levels[b.level + 1];
        if (!this.affordable(next.cost, type === 'headquarters' ? 1 : 1.3)) continue;
        this.issue({ type: 'upgradeBuilding', building: b.id }); // runs on its own, no serfs
        this.sites++;
        return;
      }
    }
  }

  idleSerfs() {
    return this.serfs.filter((u) => !u.job && u.goal === undefined && !u.militia && !this.reserved?.has(u.id) && this.atHome(u));
  }

  /**
   * Re-plan when targets have become unreachable: finished buildings that nobody can reach
   * from the castle any more are demolished (their workers cannot reach them; the build plan rebuilds them elsewhere).
   * Buildings that a mission placed with `fixed` (e.g. on an island) stay standing.
   */
  replan() {
    for (const b of this.buildings) {
      if (!b.done || b.type === 'headquarters' || b.builders.length || b.fixed) continue;
      if (!this.reachableRect(b.x, b.y, b.w, b.h)) { this.issue({ type: 'demolish', building: b.id }); return; }
    }
  }

  assignSerfs() {
    const sim = this.sim;
    this.reserved = this.reserved ?? new Set();
    // Fill construction sites with serfs first. Demolish new construction sites that have become unreachable (walled in,
    // cut off) – the build plan then looks for a new spot.
    for (const b of this.buildings) {
      if (b.done || isUpgrading(b) || b.builders.length >= buildersOf(b.type)) continue;
      if (!this.reachableRect(b.x, b.y, b.w, b.h)) {
        if (b.level === 0 && b.type !== 'headquarters') this.issue({ type: 'demolish', building: b.id });
        continue;
      }
      // Only as many as there are free spots around (every serf needs its own tile)
      const pool = this.idleSerfs();
      const idle = pool.slice(0, pool.length ? siteRoom(sim, b, pool[0]) : 0);
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

  /** Nearest tree/pile; first within 45 tiles around the castle, otherwise up to 70 tiles. */
  nearestNode(res, from) {
    let best = null, bd = Infinity, far = null, fd = Infinity, taken = null;
    const fx = from.px / UNIT, fy = from.py / UNIT;
    for (const e of this.sim.entities.values()) {
      if ((e.kind !== 'tree' && e.kind !== 'pile') || e.res !== res || e.amount <= 0) continue;
      const d = (e.x - fx) ** 2 + (e.y - fy) ** 2;
      const home = (e.x - this.home.x) ** 2 + (e.y - this.home.y) ** 2;
      // check reachability and a free spot only if the node would otherwise be chosen (saves queries);
      // without a free spot the command would be rejected (err.noWork)
      const ok = () => this.reachableRect(e.x, e.y, 1, 1) && hasFreeSpot(this.sim, from, e, taken ??= takenSpots(this.sim, from.id));
      if (home <= 45 * 45) { if (d < bd && ok()) { bd = d; best = e; } } else if (home <= 70 * 70 && home < fd && ok()) { fd = home; far = e; }
    }
    return best ?? far;
  }

  // ---------- Military ----------

  /**
   * Castle of an opponent, as far as known: with fog only seen ones (last seen state), otherwise the
   * start position as map knowledge (as in the skirmish of the original). id only if the castle is known.
   * @returns {{x:number, y:number, w:number, h:number, id:number|null}|null}
   */
  knownHq(p) {
    const sim = this.sim;
    const known = knownBuildings(sim, this.player);
    if (!known) {
      const hq = sim.findBuilding(p, 'headquarters');
      return hq ? { x: hq.x, y: hq.y, w: hq.w, h: hq.h, id: hq.id } : null;
    }
    for (const g of known.values()) {
      if (g.kind === 'building' && g.type === 'headquarters' && g.owner === p) return { x: g.x, y: g.y, w: g.w, h: g.h, id: g.id };
    }
    const s = sim.starts[p];
    return s ? { x: s.x - 2, y: s.y - 2, w: 5, h: 5, id: null } : null;
  }

  /**
   * Nearest enemy castle. Attack targets only if the troops can reach them on foot (point x/y lies
   * then on a reachable tile at the castle); `anyDirection` also returns unreachable castles
   * (only as a direction for barracks and rally point). With fog: see knownHq.
   */
  enemyHome(anyDirection = false) {
    let best = null, bd = Infinity;
    for (const p of this.sim.players) {
      if (p.id === this.player || p.defeated || !this.sim.hostile(this.player, p.id)) continue;
      const hq = this.knownHq(p.id);
      if (!hq) continue;
      const d = Math.hypot(hq.x - this.home.x, hq.y - this.home.y);
      if (d >= bd) continue;
      if (anyDirection) { bd = d; best = { x: hq.x + 2, y: hq.y + 2, id: hq.id, owner: p.id }; continue; }
      if (!this.reachableRect(hq.x, hq.y, hq.w, hq.h)) continue;
      const at = this.reachPoint(hq.x + (hq.w >> 1), hq.y + hq.h, 6);
      if (!at) continue;
      bd = d; best = { x: at.x, y: at.y, id: hq.id, owner: p.id };
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
      const def = unitOf(fitting, this.me.unitTier[fitting] ?? 1);
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
      const tier = this.me.unitTier[line] ?? 1;
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

  /** Rally point in front of the castle towards the opponent – always a reachable tile. */
  rallyPoint() {
    const enemy = this.enemyHome(true);
    const h = this.home;
    let p = { x: h.x, y: h.y + 4 };
    if (enemy) {
      const dx = enemy.x - h.x, dy = enemy.y - h.y, d = Math.hypot(dx, dy) || 1;
      p = { x: Math.round(h.x + (dx / d) * 8), y: Math.round(h.y + (dy / d) * 8) };
    }
    return this.reachPoint(p.x, p.y) ?? this.reachPoint(h.x, h.y + 4) ?? h;
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
      if (!militia && !this.noMilitia && enemyStrength > this.strength(army) + 40) this.issue({ type: 'militia', on: true });
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
            const at = b && this.reachPoint(b.x + b.w, b.y + 1, 4);
            if (at && this.affordable(d.soldierCost, 3)) { this.issue({ type: 'order', units: [L.id], order: 'move', x: at.x, y: at.y }); continue; }
          }
          this.issue({ type: 'order', units: [L.id], order: 'move', x: rally.x, y: rally.y });
        }
      }
      const late = sim.tick >= this.cfg.firstAttack + 9000 && army.length >= 3;
      const forced = this.forceAttack && army.length > 0;
      this.forceAttack = false;
      const ready = (army.length >= this.cfg.attackSize && sim.tick >= this.cfg.firstAttack) || late || forced;
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
        // Attack in a targeted way only what is currently visible; otherwise keep scouting by attack-move
        const target = near && enemy.id ? sim.entities.get(enemy.id) : null;
        this.issue(target && canSee(sim, this.player, target) ? { type: 'order', units: idle, order: 'attack', target: enemy.id } : { type: 'order', units: idle, order: 'attackMove', x: enemy.x, y: enemy.y });
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
        if (ab === 'salve' && h.hp > HEROES[h.hero].hp * 0.6) continue;
        // Bribing costs thalers: only with a reserve; farsight is useless in a skirmish
        if (ab === 'bribe' && sim.available(this.player, 'gold') < def.gold + def.goldPerSoldier * 8 + 300) continue;
        if (ab === 'farsight') continue;
        this.issue({ type: 'ability', hero: h.id, ability: ab });
        break;
      }
    }
  }
}
