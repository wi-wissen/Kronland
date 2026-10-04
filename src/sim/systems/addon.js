// Expansion content (modelled on the expansions of the original game, see docs/ADDON.md):
//   Specialists from the tavern: thief (invisible, steals, lays explosive charges) and scout
//   (torch, resource search, discovers thieves), hidden deposits, bridges at bridge sites,
//   abilities of the heroes Falk and Morla, visibility (thieves, fog veil).
// Everything deterministic and integer-based; inputs only via commands ('recruitSpecial', 'special').
// Without `sim.addon` the simulation rejects all expansion commands (err.addonOff).

import { SPECIALISTS, ADDON, ADDON_REASONS as R, STEAL_FROM } from '../data/addon.js';
import { BUILDINGS } from '../data/buildings.js';
import { HEROES, UNITS } from '../data/units.js';
import { WEATHER_EFFECTS } from '../data/weather.js';
import { BRIDGE, WATER, OCCUPIED, RESERVED, CLIFF } from '../map.js';
import { Rng } from '../rng.js';
import { UNIT, toTile, tileCenter, isqrt, idiv } from '../fixed.js';
import { moveAlong, pathTo, nearestWalkable, isAdjacent } from './movement.js';
import { applyDamage, distTo, isEnemy, targetable, nearestEnemy, buildGrid } from './military.js';
import { revealArea } from './vision.js';
import { removeWorker } from './workers.js';
import { hiddenFrom } from './hidden.js';

const own = (table, key) => typeof key === 'string' && Object.hasOwn(table, key);
const GOODS = ['wood', 'clay', 'stone', 'iron', 'sulfur'];
/** Hero abilities implemented here. */
export const ADDON_ABILITIES = new Set(['aimedShot', 'eagleEye', 'poisonFog', 'mistVeil']);

// ---------- Setup ----------

/**
 * Set up the expansion for a new simulation (at the end of the constructor): take over bridge sites,
 * distribute hidden deposits (own randomness, the game RNG stays untouched).
 * @param {import('../sim.js').Sim} sim @param {{x:number,y:number,w:number,h:number}[]} sites
 */
export function setupAddon(sim, sites) {
  sim.bridgeSites = sites ?? [];
  if (!sim.addon) return;
  for (const s of sim.bridgeSites) keepBridgeheads(sim, s);
  const D = ADDON.deposits, m = sim.map;
  const rng = new Rng(((sim.seed * 7919) ^ 0xadd0) >>> 0);
  const placed = [];
  const ok = (x, y) => {
    if (!m.inBounds(x, y) || x < 3 || y < 3 || x >= m.width - 3 || y >= m.height - 3) return false;
    if (!m.walkable(x, y) || (m.flags[m.idx(x, y)] & RESERVED)) return false;
    for (const s of sim.starts) if ((s.x - x) ** 2 + (s.y - y) ** 2 < 14 * 14) return false;
    for (const p of placed) if ((p.x - x) ** 2 + (p.y - y) ** 2 < 36) return false;
    return true;
  };
  const add = (cx, cy, rMin, rMax, res) => {
    for (let tries = 0; tries < 300; tries++) {
      const x = cx + rng.range(-rMax, rMax), y = cy + rng.range(-rMax, rMax);
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      if (d2 < rMin * rMin || d2 > rMax * rMax || !ok(x, y)) continue;
      const e = { id: sim.nextId++, kind: 'deposit', x, y, res, amount: D.amount };
      sim.entities.set(e.id, e);
      placed.push(e);
      return;
    }
  };
  sim.starts.forEach((s, p) => { for (let i = 0; i < D.perPlayer; i++) add(s.x, s.y, D.minDist, D.maxDist, D.res[(i + p) % D.res.length]); });
  const mid = m.width >> 1;
  for (let i = 0; i < D.center; i++) add(mid, mid, 0, 12, D.res[i % D.res.length]);
}

// ---------- Bridges ----------

/** Bridgeheads: the bank tiles at both ends of a bridge site (two each). */
export function bridgeheads(s) {
  const out = [];
  if (s.w >= s.h) for (let j = s.y; j < s.y + s.h; j++) out.push([s.x - 1, j], [s.x + s.w, j]);
  else for (let i = s.x; i < s.x + s.w; i++) out.push([i, s.y - 1], [i, s.y + s.h]);
  return out;
}

/**
 * Keep the bridge site and bridgeheads free: remove trees/piles there and reserve the land tiles
 * (walkable, but not buildable). This way no building blocks the access or the site itself, and the
 * levelling when building (systems/terrain.js) leaves reserved tiles in the transition border unchanged –
 * the banks keep their height, the bridge deck stays at bank height.
 */
function keepBridgeheads(sim, s) {
  const m = sim.map;
  const tiles = bridgeheads(s);
  for (let j = s.y; j < s.y + s.h; j++) for (let i = s.x; i < s.x + s.w; i++) tiles.push([i, j]);
  for (const [x, y] of tiles) {
    if (!m.inBounds(x, y)) continue;
    const k = m.idx(x, y);
    const id = m.owner[k];
    const n = id ? sim.entities.get(id) : null;
    if (n && (n.kind === 'tree' || n.kind === 'pile')) { sim.entities.delete(n.id); m.release(x, y, 1, 1); }
    if (!(m.flags[k] & WATER)) m.flags[k] |= RESERVED;
  }
  m.version++;
}

/** Bridge site with top-left corner (x,y) or null. */
export const bridgeSiteAt = (sim, x, y) => (sim.bridgeSites ?? []).find((s) => s.x === x && s.y === y) ?? null;

/** May a bridge be built at (x,y)? @returns {string|null} */
export function checkBridgeSite(sim, x, y) {
  const s = bridgeSiteAt(sim, x, y);
  if (!s) return 'err.bridgeSiteOnly';
  const m = sim.map;
  for (let j = s.y; j < s.y + s.h; j++) for (let i = s.x; i < s.x + s.w; i++) {
    const f = m.flags[m.idx(i, j)];
    if (f & (OCCUPIED | BRIDGE | CLIFF)) return 'err.spotTaken';
  }
  return null;
}

/** Bridge finished: release the area and mark it as walkable (for all players). */
export function bridgeDone(sim, b) {
  const m = sim.map;
  m.release(b.x, b.y, b.w, b.h);
  for (let j = b.y; j < b.y + b.h; j++) for (let i = b.x; i < b.x + b.w; i++) m.flags[m.idx(i, j)] |= BRIDGE;
  m.version++;
  sim.events.push({ type: 'bridgeBuilt', player: b.owner, building: b.id, x: b.x, y: b.y, w: b.w, h: b.h });
}

/**
 * Bridge gone (destroyed, demolished): tiles become water again. Whoever stands on it falls into the water
 * (as with a thaw: heroes return to the castle, all others drown). In winter the ice carries.
 */
export function bridgeGone(sim, b) {
  const m = sim.map;
  if (!b.done) return;
  for (let j = b.y; j < b.y + b.h; j++) for (let i = b.x; i < b.x + b.w; i++) m.flags[m.idx(i, j)] &= ~BRIDGE;
  m.version++;
  sim.events.push({ type: 'bridgeCollapsed', player: b.owner, building: b.id, x: b.x, y: b.y, w: b.w, h: b.h });
  if (m.frozen) return;
  for (const e of [...sim.entities.values()]) {
    if (e.px === undefined) continue;
    const tx = toTile(e.px), ty = toTile(e.py);
    if (tx < b.x || ty < b.y || tx >= b.x + b.w || ty >= b.y + b.h || !(m.flags[m.idx(tx, ty)] & WATER)) continue;
    drown(sim, e);
  }
}

/** Figure falls into the water. */
function drown(sim, e) {
  if (e.kind === 'hero') {
    const hq = sim.findBuilding(e.owner, 'headquarters');
    if (hq) { e.px = tileCenter(hq.x + 2); e.py = tileCenter(hq.y + hq.h + 1); e.path = []; }
    return;
  }
  sim.events.push({ type: 'killed', id: e.id, kind: e.kind, owner: e.owner, by: -1, drowned: true });
  if (e.kind === 'soldier') {
    const L = sim.entities.get(e.leader);
    if (L) L.soldiers = L.soldiers.filter((x) => x !== e.id);
  } else if (e.kind === 'leader') {
    for (const s of e.soldiers) sim.entities.delete(s);
  } else if (e.kind === 'worker') {
    // Workers: via the normal removal (release workplace/home)
    removeWorker(sim, e, 'drowned');
    return;
  } else if (e.kind === 'unit' && e.job) {
    const site = sim.entities.get(e.job.target);
    if (site?.builders) site.builders = site.builders.filter((id) => id !== e.id);
  }
  sim.entities.delete(e.id);
}

// ---------- Specialists ----------

/** Number of specialists of one kind of a player. */
export function countSpecialists(sim, owner, spec) {
  let n = 0;
  for (const e of sim.entities.values()) if (e.kind === 'specialist' && e.owner === owner && e.spec === spec) n++;
  return n;
}

/** Reason why a specialist cannot be recruited, or null. */
export function checkRecruitSpecial(sim, owner, b, spec) {
  if (!sim.addon) return R.addonOff;
  if (!own(SPECIALISTS, spec)) return R.unknownAction;
  const def = SPECIALISTS[spec];
  if (!b || b.kind !== 'building' || b.owner !== owner || b.type !== def.building || !b.done) return R.tavernNeeded;
  if (countSpecialists(sim, owner, spec) >= def.max) return { code: R.specialistMax, params: { n: def.max } };
  if (sim.popUsed(owner) + def.pop > sim.popLimit(owner)) return 'err.popLimit';
  if (!sim.canPay(owner, def.cost)) return 'err.notEnoughResources';
  return null;
}

export function cmdRecruitSpecial(sim, cmd) {
  const b = sim.entities.get(cmd.building);
  const err = checkRecruitSpecial(sim, cmd.player, b, cmd.spec);
  if (err) return sim.reject(cmd, err);
  const def = SPECIALISTS[cmd.spec];
  sim.pay(cmd.player, def.cost);
  const ring = sim.map.ring(b.x, b.y, b.w, b.h);
  const t = ring.length ? ring[(sim.tick + b.id) % ring.length] : sim.map.idx(b.x, b.y + b.h);
  const e = spawnSpecialist(sim, cmd.player, cmd.spec, t % sim.map.width, (t / sim.map.width) | 0);
  sim.events.push({ type: 'specialistRecruited', player: cmd.player, unit: e.id, spec: cmd.spec });
  return true;
}

/** Place specialists on a tile (without cost; also for missions and tests). */
export function spawnSpecialist(sim, owner, spec, tx, ty) {
  const def = SPECIALISTS[spec];
  const e = {
    id: sim.nextId++, kind: 'specialist', spec, owner, px: tileCenter(tx), py: tileCenter(ty), path: [], hp: def.hp,
    order: { type: 'idle' }, ready: {}, carry: null, timer: 0, hidden: spec === 'thief', targetId: 0, cooldown: 0,
  };
  sim.entities.set(e.id, e);
  return e;
}

/** Own specialists of a command (cmd.units or cmd.unit). */
function ownSpecialists(sim, cmd) {
  const ids = Array.isArray(cmd.units) ? cmd.units : [cmd.unit];
  const out = [];
  for (const id of ids) {
    const e = sim.entities.get(id);
    if (e?.kind === 'specialist' && e.owner === cmd.player) out.push(e);
  }
  return out;
}

/** Check a thief's target. @returns {string|null} */
export function checkThiefTarget(sim, e, action, t) {
  if (!t || t.kind !== 'building' || !isEnemy(sim, e.owner, t.owner)) return R.badTarget;
  if (action === 'steal') {
    if (!STEAL_FROM.includes(t.type) || !t.done) return R.badTarget;
    if (e.carry) return R.carrying;
  }
  return null;
}

/** Reason why a specialist action is not possible right now, or null (for the UI). */
export function checkSpecialAction(sim, e, action, target = null) {
  if (!sim.addon) return R.addonOff;
  const def = SPECIALISTS[e.spec];
  if (action === 'move' || action === 'stop') return null;
  if (!own(def.abilities, action)) return R.unknownAction;
  if ((e.ready[action] ?? 0) > sim.tick) return R.notReady;
  if (e.spec === 'thief' && target) return checkThiefTarget(sim, e, action, target);
  return null;
}

/**
 * Command to specialists: { type: 'special', units: [id] | unit: id, action, x?, y?, target? }
 * action: move, stop, steal (thief), sabotage (thief), torch (scout), findResources (scout)
 */
export function cmdSpecial(sim, cmd) {
  if (!sim.addon) return sim.reject(cmd, R.addonOff);
  const list = ownSpecialists(sim, cmd);
  if (!list.length) return sim.reject(cmd, R.notOwnSpecialist);
  const action = cmd.action;
  const m = sim.map;
  const point = Number.isInteger(cmd.x) && Number.isInteger(cmd.y) && m.inBounds(cmd.x, cmd.y);
  if (action === 'move') {
    if (!point) return sim.reject(cmd, 'err.notWalkable');
    list.forEach((e, i) => {
      // Fan out the targets a bit
      let tx = cmd.x + (i % 3) - (list.length > 1 ? 1 : 0), ty = cmd.y + Math.trunc(i / 3);
      if (!m.walkable(tx, ty)) { const k = nearestWalkable(m, cmd.x, cmd.y, tileCenter(cmd.x), tileCenter(cmd.y), 8); if (k < 0) return; tx = k % m.width; ty = (k / m.width) | 0; }
      e.order = { type: 'move', goal: m.idx(tx, ty) }; e.path = []; e.timer = 0;
    });
    return true;
  }
  if (action === 'stop') { for (const e of list) { e.order = { type: 'idle' }; e.path = []; e.timer = 0; } return true; }
  let ok = 0, last = R.unknownAction;
  for (const e of list) {
    const def = SPECIALISTS[e.spec];
    if (!own(def.abilities, action)) { last = R.unknownAction; continue; }
    if ((e.ready[action] ?? 0) > sim.tick) { last = R.notReady; continue; }
    const ab = def.abilities[action];
    if (action === 'steal' || action === 'sabotage') {
      const t = sim.entities.get(cmd.target);
      const err = checkThiefTarget(sim, e, action, t);
      if (err) { last = err; continue; }
      // same order again: keep progress (otherwise every click would reset the stealing)
      if (e.order?.type !== action || e.order.target !== t.id) { e.order = { type: action, target: t.id }; e.path = []; e.timer = 0; }
      ok++;
    } else if (action === 'torch') {
      let x = e.px, y = e.py;
      if (point) {
        x = tileCenter(cmd.x); y = tileCenter(cmd.y);
        if (isqrt((x - e.px) ** 2 + (y - e.py) ** 2) > ab.range) { last = R.outOfRange; continue; }
      }
      const torch = { id: sim.nextId++, kind: 'torch', owner: e.owner, px: x, py: y, r: ab.radius, until: sim.tick + ab.duration, path: [] };
      sim.entities.set(torch.id, torch);
      e.ready.torch = sim.tick + ab.cooldown;
      sim.events.push({ type: 'torch', player: e.owner, unit: e.id, x, y });
      // make visible immediately (otherwise only at the next vision calculation)
      revealArea(sim, e.owner, toTile(x), toTile(y), ab.radius, 0);
      ok++;
    } else if (action === 'findResources') {
      e.ready.findResources = sim.tick + ab.cooldown;
      findResources(sim, e, ab.radius);
      ok++;
    }
  }
  return ok ? true : sim.reject(cmd, last);
}

/** Uncover hidden deposits nearby: they become normal resource piles. */
export function findResources(sim, e, radius) {
  const tx = toTile(e.px), ty = toTile(e.py), m = sim.map;
  const found = [];
  for (const d of [...sim.entities.values()]) {
    if (d.kind !== 'deposit' || (d.x - tx) ** 2 + (d.y - ty) ** 2 > radius * radius) continue;
    sim.entities.delete(d.id);
    let x = d.x, y = d.y;
    if (!m.walkable(x, y) || (m.flags[m.idx(x, y)] & RESERVED)) {
      const k = nearestWalkable(m, x, y, tileCenter(x), tileCenter(y), 5);
      if (k < 0) continue;
      x = k % m.width; y = (k / m.width) | 0;
    }
    const n = sim.addNode('pile', x, y, d.res, d.amount);
    if (!n) continue;
    found.push({ x, y, res: d.res, node: n.id });
    revealArea(sim, e.owner, x, y, 3, 0);
  }
  sim.events.push({ type: 'resourcesFound', player: e.owner, unit: e.id, count: found.length, found });
  return found;
}

/** Movement of a specialist in this tick (winter: slower). */
const specSpeed = (sim, e) => {
  const s = SPECIALISTS[e.spec].speed;
  const pct = WEATHER_EFFECTS[sim.weather?.state]?.speedPercent ?? 100;
  return pct === 100 ? s : idiv(s * pct, 100);
};

/** Walk to the edge of a building; true = arrived. */
function walkToBuilding(sim, e, b) {
  if (isAdjacent(e, b)) { e.path = []; return true; }
  if (!e.path.length || (sim.tick + e.id) % 20 === 0) e.path = pathTo(sim, e, sim.map.ring(b.x, b.y, b.w, b.h)) ?? [];
  if (!e.path.length) return null; // unreachable
  moveAlong(sim, e, specSpeed(sim, e));
  return false;
}

function idle(e) { e.order = { type: 'idle' }; e.path = []; e.timer = 0; }

function updateSpecialist(sim, e) {
  const o = e.order ?? { type: 'idle' };
  if (o.type === 'move') {
    if (!e.path.length) {
      const k = sim.map.idx(toTile(e.px), toTile(e.py));
      if (k === o.goal) { idle(e); return; }
      e.path = pathTo(sim, e, [o.goal]) ?? [];
      if (!e.path.length) { idle(e); return; }
    }
    moveAlong(sim, e, specSpeed(sim, e));
    return;
  }
  if (o.type === 'steal' || o.type === 'sabotage') {
    const t = sim.entities.get(o.target);
    if (checkThiefTarget(sim, e, o.type, t)) { idle(e); return; }
    const at = walkToBuilding(sim, e, t);
    if (at === null) { idle(e); sim.events.push({ type: 'rejected', player: e.owner, command: 'special', reason: 'err.unreachable' }); return; }
    if (!at) return;
    const ab = SPECIALISTS.thief.abilities[o.type];
    if (o.type === 'sabotage') { plantCharge(sim, e, t, ab); idle(e); return; }
    if (++e.timer >= ab.ticks) steal(sim, e, t, ab);
    return;
  }
  if (o.type === 'deliver') {
    const hq = sim.findBuilding(e.owner, 'headquarters');
    if (!hq || !e.carry) { idle(e); return; }
    const at = walkToBuilding(sim, e, hq);
    if (at === null) { idle(e); return; }
    if (!at) return;
    const p = sim.players[e.owner];
    p.stock.gold += e.carry.gold;
    if (e.carry.res) p.stock[e.carry.res] += e.carry.amount;
    sim.events.push({ type: 'lootDelivered', player: e.owner, unit: e.id, ...e.carry });
    e.carry = null;
    idle(e);
    return;
  }
  // idle: bring the loot home first
  if (e.carry) { e.order = { type: 'deliver' }; e.path = []; }
}

/** Steal resources (thaler and the victim's most plentiful resource). */
function steal(sim, e, t, ab) {
  const victim = sim.players[t.owner];
  const gold = Math.min(ab.goldMax, idiv(victim.stock.gold * ab.goldPercent, 100));
  victim.stock.gold -= gold;
  let res = null, amount = 0, best = 0;
  for (const r of GOODS) { const a = victim.stock[r] + victim.raw[r]; if (a > best) { best = a; res = r; } }
  if (res) {
    amount = Math.min(ab.goods, best);
    const fromStock = Math.min(amount, victim.stock[res]);
    victim.stock[res] -= fromStock; victim.raw[res] -= amount - fromStock;
  }
  e.carry = { gold, res, amount };
  e.ready.steal = sim.tick + ab.cooldown;
  victim.robbed = (victim.robbed ?? 0) + 1;
  sim.events.push({ type: 'stolen', player: e.owner, victim: t.owner, unit: e.id, building: t.id, gold, res, amount, x: e.px, y: e.py });
  e.order = { type: 'deliver' }; e.path = []; e.timer = 0;
}

/** Lay an explosive charge next to a building (ignites after `fuse` ticks). */
function plantCharge(sim, e, t, ab) {
  const c = {
    id: sim.nextId++, kind: 'charge', owner: e.owner, px: e.px, py: e.py, target: t.id, fuse: ab.fuse,
    damage: t.type === 'bridge' ? idiv(ab.damage * ab.bridgePercent, 100) : ab.damage, radius: ab.radius, unitDamage: ab.unitDamage, path: [],
  };
  sim.entities.set(c.id, c);
  e.ready.sabotage = sim.tick + ab.cooldown;
  sim.events.push({ type: 'chargePlaced', player: e.owner, victim: t.owner, unit: e.id, building: t.id, x: c.px, y: c.py });
}

function updateCharge(sim, c) {
  if (--c.fuse > 0) return;
  const t = sim.entities.get(c.target);
  for (const u of [...sim.entities.values()]) {
    if (u.px === undefined || u.kind === 'charge' || !isEnemy(sim, c.owner, u.owner) || !targetableIgnoringHidden(sim, u)) continue;
    if (distTo(c, u) <= c.radius) applyDamage(sim, u, c.unitDamage, c);
  }
  if (t && t.kind === 'building' && sim.entities.has(t.id) && distTo(c, t) <= 2000) applyDamage(sim, t, c.damage, c);
  sim.events.push({ type: 'explosion', x: c.px, y: c.py, charge: true });
  sim.entities.delete(c.id);
}

/** Attackable; invisibility does not count for area damage. */
function targetableIgnoringHidden(sim, u) {
  if (!u.hidden) return targetable(sim, u);
  u.hidden = false;
  const ok = targetable(sim, u);
  u.hidden = true;
  return ok;
}

// ---------- Visibility (thieves, fog veil) ----------

/**
 * Who is invisible: thieves always, troops under the fog veil until it expires or they attack –
 * unless an enemy tower (ADDON.detect.buildings, distance to the building edge) or scout is near.
 * Invisible figures are neither visible nor attackable for opponents (canSee, targetable).
 */
export function updateHidden(sim) {
  let detectors = null;
  for (const e of sim.entities.values()) {
    const veiled = e.veilUntil !== undefined && e.veilUntil > sim.tick;
    if (!(e.kind === 'specialist' && e.spec === 'thief') && !veiled) {
      if (e.hidden) e.hidden = false;
      if (e.seenBy !== undefined) delete e.seenBy;
      if (e.veilUntil !== undefined && !veiled) delete e.veilUntil;
      continue;
    }
    if (e.kind === 'hero' && e.down) { e.hidden = false; delete e.seenBy; continue; }
    detectors ??= collectDetectors(sim);
    // Bitmask of the teams that discover the figure (each opponent on its own)
    let mask = 0;
    for (const d of detectors) {
      const team = sim.players[d.e.owner]?.team ?? d.e.owner;
      if (mask & (1 << team) || !isEnemy(sim, d.e.owner, e.owner)) continue;
      if (distTo(e, d.e) <= d.r) mask |= 1 << team;
    }
    e.hidden = mask === 0;
    e.seenBy = mask;
  }
}

function collectDetectors(sim) {
  const out = [], B = ADDON.detect.buildings;
  for (const e of sim.entities.values()) {
    if (e.kind === 'building' && e.done && B[e.type]) out.push({ e, r: B[e.type] * UNIT });
    else if (e.kind === 'specialist' && e.spec === 'scout') out.push({ e, r: ADDON.detect.scout * UNIT });
  }
  return out;
}

// ---------- Hero abilities (Falk, Morla) ----------

/**
 * Execute the ability of an expansion hero. Cooldown and event are set by useAbility (military.js).
 * @returns {string|null} error code
 */
export function heroAbility(sim, h, ability, def, x, y) {
  const near = (radius, pred) => [...sim.entities.values()].filter((e) => pred(e) && distTo(h, e) <= radius);
  switch (ability) {
    case 'aimedShot': {
      let t = h.targetId ? sim.entities.get(h.targetId) : null;
      if (x !== undefined) {
        // Target point: nearest enemy there
        t = null; let bd = 1600;
        for (const e of sim.entities.values()) {
          if (e.px === undefined || !isEnemy(sim, h.owner, e.owner) || !targetable(sim, e) || hiddenFrom(sim, h.owner, e)) continue;
          const d = isqrt((e.px - x) ** 2 + (e.py - y) ** 2);
          if (d < bd) { bd = d; t = e; }
        }
      }
      if (!t || !targetable(sim, t) || hiddenFrom(sim, h.owner, t) || !isEnemy(sim, h.owner, t.owner) || t.kind === 'building' || distTo(h, t) > def.range) {
        buildGrid(sim); // bring the search grid up to date for this tick (commands run before the military)
        t = nearestEnemy(sim, h, def.range, { units: true, buildings: false });
      }
      if (!t || distTo(h, t) > def.range) return R.noTarget;
      const target = t.kind === 'leader' && t.soldiers.length ? sim.entities.get(t.soldiers[0]) ?? t : t;
      sim.events.push({ type: 'shot', from: { x: h.px, y: h.py }, to: { x: target.px, y: target.py }, owner: h.owner, kind: 'bullet' });
      applyDamage(sim, target, def.damage, h);
      return null;
    }
    case 'eagleEye':
      for (const e of near(def.radius, (e) => e.owner === h.owner && ((e.kind === 'leader' && UNITS[e.def].range > 2000) || e === h))) {
        e.buff = { attackPercent: def.attackPercent, until: sim.tick + def.duration, range: def.rangeBonus };
      }
      return null;
    case 'poisonFog': {
      const c = {
        id: sim.nextId++, kind: 'cloud', owner: h.owner, px: x ?? h.px, py: y ?? h.py, radius: def.radius, until: sim.tick + def.duration,
        interval: def.interval, damage: def.damage, slow: def.slowPercent, path: [],
      };
      sim.entities.set(c.id, c);
      return null;
    }
    case 'mistVeil':
      for (const e of near(def.radius, (e) => e.owner === h.owner && (e.kind === 'leader' || e.kind === 'soldier' || e.kind === 'hero'))) e.veilUntil = sim.tick + def.duration;
      return null;
    default: return 'err.unknownAbility';
  }
}

function updateCloud(sim, c) {
  if (sim.tick >= c.until) { sim.entities.delete(c.id); return; }
  if ((sim.tick - c.id) % c.interval !== 0) return;
  for (const e of [...sim.entities.values()]) {
    if (e.px === undefined || e.kind === 'cloud' || e.kind === 'torch' || e.kind === 'charge') continue;
    if (!isEnemy(sim, c.owner, e.owner)) continue;
    // Captains with soldiers cannot be attacked but are slowed (damage hits the soldiers)
    const hit = targetable(sim, e);
    if (!hit && !(e.kind === 'leader' && !e.hidden)) continue;
    if (isqrt((e.px - c.px) ** 2 + (e.py - c.py) ** 2) > c.radius) continue;
    e.slowUntil = sim.tick + c.interval + 1;
    e.slowPercent = c.slow;
    if (hit) applyDamage(sim, e, c.damage, c);
  }
}

/** Speed under poison fog. */
export const slowed = (sim, e, speed) => (e.slowUntil > sim.tick ? idiv(speed * (e.slowPercent ?? 60), 100) : speed);

// ---------- Tick ----------

/** Expansion tick (before the military: visibility already applies to target choice of this tick). */
export function updateAddon(sim) {
  for (const e of [...sim.entities.values()]) {
    if (!sim.entities.has(e.id)) continue;
    switch (e.kind) {
      case 'specialist': updateSpecialist(sim, e); break;
      case 'charge': updateCharge(sim, e); break;
      case 'torch': if (sim.tick >= e.until) sim.entities.delete(e.id); break;
      case 'cloud': updateCloud(sim, e); break;
      default: break;
    }
  }
  updateHidden(sim);
}

/** Contribution to the state hash. */
export function hashAddon(sim, h) {
  h.int(sim.addon ? 1 : 0).int(sim.bridgeSites?.length ?? 0);
  for (const p of sim.players) h.int(p.robbed ?? 0);
  for (const e of sim.entities.values()) {
    if (e.kind === 'specialist') {
      h.str(e.spec).str(e.order?.type ?? '').int(e.timer).int(e.hidden ? 1 : 0).int(e.carry ? e.carry.gold + e.carry.amount : -1);
      for (const k of Object.keys(e.ready)) h.int(e.ready[k]);
    } else if (e.kind === 'charge') h.int(e.fuse).int(e.target);
    else if (e.kind === 'torch' || e.kind === 'cloud') h.int(e.until);
    if (e.veilUntil !== undefined) h.int(e.veilUntil);
    if (e.slowUntil !== undefined) h.int(e.slowUntil);
    if (e.hidden) h.int(e.id);
    if (e.seenBy !== undefined) h.int(e.seenBy);
  }
}

/** Is a building/troop/hero type part of the expansion? (for UI and filters) */
export const isAddonBuilding = (type) => !!BUILDINGS[type]?.addon;
export const isAddonHero = (id) => !!HEROES[id]?.addon;
