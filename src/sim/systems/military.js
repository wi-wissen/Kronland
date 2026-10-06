// Military: squad leaders with soldiers, heroes, militia, towers, traps, combat and damage.

import { DIR72 } from '../dirs.js';
import { UNITS, MILITIA, SERF_COMBAT, TOWER, HEROES, HERO_COMMON, WORKER_COMBAT } from '../data/units.js';
import { COMBAT, computeDamage } from '../data/combat.js';
import { buildingArmor } from '../data/buildings.js';
import { moveAlong, pathTo, canStep, goalsAt, nearestWalkable } from './movement.js';
import { idiv, isqrt, toTile, tileCenter, UNIT } from '../fixed.js';
import { removeWorker } from './workers.js';
import { startFlee } from './serfs.js';
import { techBonus, boosted, buildingMaxHp } from './techs.js';
import { EXPERIENCE as XP, starsOf } from '../data/experience.js';
import { BALANCE } from '../data/balance.js';
import { revealArea } from './vision.js';
import { WEATHER_EFFECTS } from '../data/weather.js';

const FIGHTERS = new Set(['leader', 'soldier', 'hero']);
/** Largest distance of an ability target point (bomb, trap, cannon) from the hero, milli-tiles (A) */
export const ABILITY_RANGE = 6000;
/** From this distance (milli-tiles, Manhattan) to all soldiers a squad leader is defenceless (A) */
const DETACHED = 12000;

// ---------- Values ----------

/** Combat values of an entity (null = cannot attack or cannot be attacked). */
export function combatStats(sim, e) {
  switch (e.kind) {
    case 'leader': case 'soldier': {
      const d = UNITS[e.def];
      const L = e.kind === 'leader' ? e : sim.entities.get(e.leader);
      // Building technologies (armour, weapons, speed)
      const tb = techBonus(sim, e.owner, 'units', d.line);
      let attack = d.attack + tb.attack, armor = d.armor + tb.armor, range = d.range + tb.range;
      const ranged = d.range > 2000;
      let sight = COMBAT.sight + techBonus(sim, e.owner, 'leaders').sight;
      // Experience of the squad leader (applies to the whole squad)
      const stars = starsOf(L?.xp);
      if (stars >= 2 && (ranged || d.line === 'lightCav' || d.line === 'heavyCav')) { sight += XP.sightBonus; if (ranged) range += XP.rangeBonus; }
      if (stars >= 4) attack += XP.attackBonus;
      if (stars >= 5) { if (ranged) attack += XP.rangedAttackBonus; else armor += XP.meleeArmorBonus; }
      if (L?.buff && sim.tick < L.buff.until) { attack = idiv(attack * L.buff.attackPercent, 100); range += L.buff.range ?? 0; }
      const rangedPct = WEATHER_EFFECTS[sim.weather?.state]?.rangedAttackPercent ?? 100; // rain (A)
      if (ranged && rangedPct !== 100) attack = idiv(attack * rangedPct, 100);
      return {
        attack, armor, attackType: d.attackType, armorType: d.armorType, range, cooldown: d.cooldown,
        speed: boosted(d.speed, tb.speed), sight, crit: stars >= 1 ? XP.critPercent : 0,
      };
    }
    case 'hero': {
      const h = HEROES[e.hero];
      const attack = e.buff && sim.tick < e.buff.until ? idiv(h.attack * e.buff.attackPercent, 100) : h.attack;
      const range = h.range + (e.buff && sim.tick < e.buff.until ? e.buff.range ?? 0 : 0);
      return { attack, armor: h.armor, ...HERO_COMMON, range, cooldown: h.cooldown, speed: h.speed };
    }
    case 'unit': {
      const c = e.militia ? MILITIA : SERF_COMBAT;
      const sb = techBonus(sim, e.owner, 'serfs');
      const mb = e.militia ? techBonus(sim, e.owner, 'militia') : sb;
      const extra = e.militia ? mb : { attack: 0, armor: 0 };
      return { ...c, attack: c.attack + extra.attack, armor: c.armor + sb.armor + extra.armor, speed: boosted(BALANCE.serf.speed, sb.speed) };
    }
    case 'worker': return { attack: 0, ...WORKER_COMBAT, armor: WORKER_COMBAT.armor + techBonus(sim, e.owner, 'workers').armor, range: 0, cooldown: 0, speed: 0 };
    case 'building': {
      const t = e.type === 'tower' && e.done ? TOWER[e.level] : null;
      const own = e.owner >= 0 && sim.players[e.owner] ? techBonus(sim, e.owner, 'buildings').armor : 0;
      return {
        attack: t?.attack ?? 0, armor: buildingArmor(e.type, e.level) + own, attackType: t?.attackType ?? 'chaos',
        armorType: 'fortified', range: t?.range ?? 0, cooldown: t?.cooldown ?? 0, speed: 0,
      };
    }
    case 'turret': return { attack: e.attack, armor: 5, attackType: 'shot', armorType: 'fortified', range: e.range, cooldown: 20, speed: 0 };
    case 'trap': return { attack: 0, armor: 5, attackType: 'chaos', armorType: 'fortified', range: 0, cooldown: 0, speed: 0 };
    default: return null;
  }
}

export function maxHp(sim, e) {
  switch (e.kind) {
    case 'leader': return UNITS[e.def].hp;
    case 'soldier': return UNITS[e.def].soldierHp;
    case 'hero': return HEROES[e.hero].hp;
    case 'unit': return 200;
    case 'worker': return WORKER_COMBAT.hp;
    case 'building': return buildingMaxHp(sim, e);
    default: return e.maxHp ?? 1;
  }
}

/** Position in milli-tiles (building: centre). */
export function posOf(e) {
  if (e.kind === 'building') return { x: (e.x * 2 + e.w) * 500, y: (e.y * 2 + e.h) * 500 };
  if (e.px !== undefined) return { x: e.px, y: e.py };
  return { x: e.x * UNIT + 500, y: e.y * UNIT + 500 };
}

/** Distance from e to target t in milli-tiles (building: to the edge). */
export function distTo(e, t) {
  const p = posOf(e);
  if (t.kind === 'building') {
    const x0 = t.x * UNIT, y0 = t.y * UNIT, x1 = (t.x + t.w) * UNIT, y1 = (t.y + t.h) * UNIT;
    const dx = p.x < x0 ? x0 - p.x : p.x > x1 ? p.x - x1 : 0;
    const dy = p.y < y0 ? y0 - p.y : p.y > y1 ? p.y - y1 : 0;
    return isqrt(dx * dx + dy * dy);
  }
  const q = posOf(t);
  return isqrt((q.x - p.x) ** 2 + (q.y - p.y) ** 2);
}

/** Enemies: hostile diplomacy (default: different teams), both still in the game (eliminated ones no longer attack). */
export const isEnemy = (sim, a, b) => a !== b && a >= 0 && b >= 0 && !sim.players[b]?.defeated && !sim.players[a]?.defeated && sim.hostile(a, b);

/** May this target be attacked? */
export function targetable(sim, t) {
  if (!t || !sim.entities.has(t.id)) return false;
  switch (t.kind) {
    // Squad leader only once all soldiers have fallen – or none is left with him (soldiers
    // cut off: far away or on the other side of a river); otherwise he would be permanently invulnerable
    case 'leader': {
      if (t.soldiers.length === 0) return true;
      const m = sim.map, region = m.regionAt(m.idx(toTile(t.px), toTile(t.py)));
      return t.soldiers.every((id) => {
        const s = sim.entities.get(id);
        return !s || Math.abs(s.px - t.px) + Math.abs(s.py - t.py) > DETACHED
          || m.regionAt(m.idx(toTile(s.px), toTile(s.py))) !== region;
      });
    }
    case 'hero': return !t.down;
    case 'worker': return !t.inside;
    case 'soldier': case 'unit': case 'building': case 'turret': case 'trap': return true;
    default: return false;
  }
}

// ---------- Search grid ----------

export function buildGrid(sim) {
  const C = COMBAT.gridCell;
  const grid = new Map();
  const add = (cx, cy, e) => {
    const k = cy * 4096 + cx;
    let a = grid.get(k);
    if (!a) grid.set(k, (a = []));
    a.push(e);
  };
  for (const e of sim.entities.values()) {
    if (e.kind === 'building') {
      for (let cy = Math.floor(e.y / C); cy <= Math.floor((e.y + e.h - 1) / C); cy++)
        for (let cx = Math.floor(e.x / C); cx <= Math.floor((e.x + e.w - 1) / C); cx++) add(cx, cy, e);
    } else if (FIGHTERS.has(e.kind) || e.kind === 'unit' || e.kind === 'worker' || e.kind === 'turret' || e.kind === 'trap') {
      const p = posOf(e);
      add(Math.floor(p.x / UNIT / C), Math.floor(p.y / UNIT / C), e);
    }
  }
  sim.grid = grid;
}

/** Can attack (squads, heroes, militia, self-firing cannon)? Serfs and workers cannot. */
const isCombatant = (t) => FIGHTERS.has(t.kind) || t.kind === 'turret' || (t.kind === 'unit' && !!t.militia);

/**
 * Nearest enemy in range. opts.buildings: also buildings, opts.units: also units,
 * opts.fighters: only units that fight themselves.
 */
export function nearestEnemy(sim, e, radius, opts = { units: true, buildings: false }) {
  const C = COMBAT.gridCell * UNIT;
  const p = posOf(e);
  const owner = e.owner;
  let best = null, bd = radius + 1, bestUnit = null, bdu = radius + 1;
  // Hottest path in the melee (swarm: >40 % of the computing time): cheap checks first, hostility per
  // owner only once per call, duplicates only for buildings (only they lie in several cells), distance
  // pre-filtered by square first. The result is the same as with the simple version (pure filters).
  /** @type {Array<boolean|undefined>} */
  const foe = [];
  const seen = opts.buildings ? new Set() : null;
  const far = (radius + 1) * (radius + 1);
  for (let cy = Math.floor((p.y - radius) / C); cy <= Math.floor((p.y + radius) / C); cy++) {
    for (let cx = Math.floor((p.x - radius) / C); cx <= Math.floor((p.x + radius) / C); cx++) {
      const list = sim.grid?.get(cy * 4096 + cx);
      if (!list) continue;
      for (const t of list) {
        const o = t.owner;
        let f = foe[o];
        if (f === undefined) { f = isEnemy(sim, owner, o); if (o >= 0) foe[o] = f; }
        if (!f) continue;
        const isB = t.kind === 'building' || t.kind === 'trap';
        if (isB) {
          if (!opts.buildings) continue;
          if (seen.has(t.id)) continue;
          seen.add(t.id);
          // Nobody attacks bridges on their own (only on command or by explosive charge)
          if (t.type === 'bridge') continue;
        } else {
          if (!opts.units) continue;
          if (opts.fighters && !isCombatant(t)) continue;
          const q = posOf(t), dx = q.x - p.x, dy = q.y - p.y;
          if (dx * dx + dy * dy >= far) continue; // surely outside (isqrt(d²) > radius)
        }
        const d = distTo(e, t);
        if (d > radius) continue;
        if (!(isB ? d < bd : d < bdu || d < bd)) continue;
        if (!targetable(sim, t)) continue;
        if (!isB && d < bdu) { bdu = d; bestUnit = t; }
        if (d < bd) { bd = d; best = t; }
      }
    }
  }
  return bestUnit ?? best; // units before buildings
}

// ---------- Damage ----------

export function applyDamage(sim, target, dmg, attacker) {
  if (target.kind === 'leader' && target.soldiers.length) {
    const s = sim.entities.get(target.soldiers[0]);
    if (s) target = s;
  }
  target.hp -= dmg;
  if (target.hp > 0) {
    // Serfs (no militia) do not fight back on their own: they flee and continue working afterwards
    if (target.kind === 'unit' && !target.militia && target.job?.kind !== 'fight' && attacker && attacker.owner !== target.owner && target.fleeUntil === undefined) startFlee(sim, target, attacker);
    return;
  }
  kill(sim, target, attacker);
}

export function kill(sim, t, attacker) {
  sim.events.push({ type: 'killed', id: t.id, kind: t.kind, owner: t.owner, by: attacker?.owner ?? -1 });
  switch (t.kind) {
    case 'soldier': {
      const L = sim.entities.get(t.leader);
      if (L) L.soldiers = L.soldiers.filter((id) => id !== t.id);
      sim.entities.delete(t.id);
      break;
    }
    case 'hero':
      t.hp = 0; t.down = true; t.downTimer = 0; t.path = []; t.targetId = 0; t.order = { type: 'idle' };
      break;
    case 'worker': removeWorker(sim, t, 'killed'); break;
    case 'building':
      sim.destroyBuilding(t, attacker);
      break;
    case 'unit': {
      // Serf: release from construction site
      const site = t.job?.kind === 'build' || t.job?.kind === 'repair' ? sim.entities.get(t.job.target) : null;
      if (site) site.builders = site.builders.filter((id) => id !== t.id);
      sim.entities.delete(t.id);
      break;
    }
    default: sim.entities.delete(t.id);
  }
}

function attack(sim, e, st, t) {
  const tst = combatStats(sim, t.kind === 'leader' && t.soldiers.length ? sim.entities.get(t.soldiers[0]) ?? t : t);
  let dmg = computeDamage(st.attack, st.attackType, tst.armorType, tst.armor, sim.rng.int(3));
  // Experience: hits count for the squad leader; from 1 star critical hits
  if (st.crit && sim.rng.int(100) < st.crit) dmg *= 2;
  if (e.kind === 'leader' || e.kind === 'soldier') gainXp(sim, e.kind === 'leader' ? e : sim.entities.get(e.leader));
  if (st.range > 2000) {
    const a = posOf(e), b = posOf(t);
    const line = UNITS[e.def]?.line;
    const kind = e.kind === 'building' || e.kind === 'turret' ? 'bolt' : line === 'cannon' ? 'ball' : 'arrow';
    sim.events.push({ type: 'shot', from: a, to: b, owner: e.owner, kind, by: e.id, target: t.id });
  } else {
    sim.events.push({ type: 'hit', by: e.id, target: t.id });
  }
  applyDamage(sim, t, dmg, e);
}

/** One hit from e on t with the combat values of e (serfs attacking an opponent). */
export function strike(sim, e, t) { attack(sim, e, combatStats(sim, e), t); }

/** Experience point for a hit; reports new stars. */
function gainXp(sim, L) {
  if (!L) return;
  const before = starsOf(L.xp);
  L.xp = (L.xp ?? 0) + 1;
  const after = starsOf(L.xp);
  if (after > before) sim.events.push({ type: 'promoted', player: L.owner, leader: L.id, stars: after });
}

/** From 3 stars the squad slowly heals itself. */
function regenerate(sim, L) {
  if (starsOf(L.xp) < 3 || (sim.tick + L.id) % XP.regenTicks !== 0) return;
  L.hp = Math.min(UNITS[L.def].hp, L.hp + XP.regenHp);
  for (const id of L.soldiers) {
    const s = sim.entities.get(id);
    if (s) s.hp = Math.min(UNITS[s.def].soldierHp, s.hp + XP.regenHp);
  }
}

// ---------- Movement ----------

function goalTiles(sim, t) {
  if (t.kind === 'building') return sim.map.ring(t.x, t.y, t.w, t.h);
  const p = posOf(t);
  const tx = toTile(p.x), ty = toTile(p.y);
  const out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (sim.map.walkable(tx + dx, ty + dy)) out.push(sim.map.idx(tx + dx, ty + dy));
  }
  return out;
}

function speedOf(sim, base) {
  const pct = WEATHER_EFFECTS[sim.weather?.state]?.speedPercent ?? 100; // winter (A)
  return pct !== 100 ? idiv(base * pct, 100) : base;
}

/**
 * Approach a point: straight ahead as long as every sub-step is allowed (no entering blocked
 * tiles, no corner cutting, see canStep); otherwise detour via pathfinding, which is then followed
 * to the end (no back and forth between straight line and detour).
 */
function stepToward(sim, e, x, y, speed) {
  if (e.path.length) {
    // Running detour – only if it still leads to the target (otherwise it stems from an earlier order)
    const last = e.path[e.path.length - 1], W = sim.map.width;
    if (Math.abs((last % W) - toTile(x)) <= 2 && Math.abs(((last / W) | 0) - toTile(y)) <= 2) { moveAlong(sim, e, speed); return false; }
    e.path = [];
  }
  const dx = x - e.px, dy = y - e.py;
  const d = isqrt(dx * dx + dy * dy);
  if (d === 0) return true;
  const s = Math.min(speed, d);
  const nx = e.px + idiv(dx * s, d), ny = e.py + idiv(dy * s, d);
  if (canStep(sim.map, e.px, e.py, nx, ny)) { e.px = nx; e.py = ny; return d <= speed; }
  // Obstacle: detour to the target tile (or its free neighbours)
  e.path = pathTo(sim, e, goalsAt(sim.map, x, y)) ?? [];
  moveAlong(sim, e, speed);
  return false;
}

/** Structure instead of squad (building, trap)? Such targets make attackers give up for enemy units. */
const isStructure = (t) => t.kind === 'building' || t.kind === 'trap';

/**
 * Fighting enemy unit in sight (attackers of a building turn to it; serfs
 * and workers do not distract).
 */
function threat(sim, e, st) {
  return nearestEnemy(sim, e, (st.sight ?? COMBAT.sight) * UNIT, { units: true, buildings: false, fighters: true });
}

/** Look for threats every 5 ticks (staggered per figure) – saves searches in the melee. */
const threatTick = (sim, e) => (sim.tick + e.id) % 5 === 0;

/** Pursue and attack the target. */
function engage(sim, e, st, t) {
  if (e.targetId !== t.id) e.path = []; // new target: the old path leads elsewhere
  e.targetId = t.id;
  const d = distTo(e, t);
  // Melee fighters close to a squad: take their own spot in the ring around the target (surrounding)
  const slot = st.speed > 0 && st.range <= COMBAT.surroundMaxRange && d < 3 * UNIT && !isStructure(t) ? surroundSlot(sim, e, t) : null;
  if (d <= st.range) {
    e.path = [];
    if (e.cooldown <= 0) { attack(sim, e, st, t); e.cooldown = st.cooldown; }
    // move onto the spot at striking distance – only straight ahead (the spot is in range, no pathfinding)
    if (slot) slideTo(sim, e, slot, idiv(speedOf(sim, st.speed), 2));
    return;
  }
  if (st.speed <= 0) { e.targetId = 0; return; }
  if (t.kind !== 'building' && d < 3 * UNIT) {
    const q = slot ?? posOf(t);
    stepToward(sim, e, q.x, q.y, speedOf(sim, st.speed));
    return;
  }
  if (!e.path.length || (sim.tick + e.id) % 15 === 0) e.path = pathTo(sim, e, goalTiles(sim, t)) ?? rangePath(sim, e, t, st.range) ?? [];
  if (!e.path.length) { e.targetId = 0; return; }
  moveAlong(sim, e, speedOf(sim, st.speed));
}

// ---------- Surrounding ----------

/** 24 directions in a 15° grid as integer vectors (length 1000) – no floating-point angles in the sim. */
const DIR24 = Array.from({ length: 24 }, (_, k) => DIR72[3 * k]);

/**
 * Taken spots per target in this tick: target ID → bitmasks per ring. Cleared at the start of every military tick
 * and refilled in fixed order (entities) – derived state, nothing to save.
 */
const claims = new Map();

/**
 * Spot of attacker `e` in the ring around `t` (milli-tiles) or null (all near spots taken). Prefers
 * the spot in the direction `e` comes from; if it is already taken, the next free one beside it, then the
 * outer ring. This way a spot once taken stays stable, and nobody runs across around the target.
 */
export function surroundSlot(sim, e, t) {
  const q = posOf(t);
  const dx = e.px - q.x, dy = e.py - q.y;
  let mask = claims.get(t.id);
  if (!mask) claims.set(t.id, (mask = COMBAT.surround.map(() => 0)));
  for (let r = 0; r < COMBAT.surround.length; r++) {
    const { radius, slots } = COMBAT.surround[r];
    const step = 24 / slots, shift = r & 1; // outer ring offset by 15°
    // Direction to the attacker: spot with the largest dot product
    let best = 0, bd = -Infinity;
    for (let k = 0; k < slots; k++) {
      const v = DIR24[k * step + shift], dot = v.x * dx + v.y * dy;
      if (dot > bd) { bd = dot; best = k; }
    }
    const reach = r === 0 ? 2 : 4;
    for (let i = 0; i <= 2 * reach; i++) {
      const k = (best + (i & 1 ? (i + 1) >> 1 : -(i >> 1)) + slots) % slots;
      if (mask[r] & (1 << k)) continue;
      const v = DIR24[k * step + shift];
      const x = q.x + idiv(v.x * radius, 1000), y = q.y + idiv(v.y * radius, 1000);
      if (!sim.map.walkable(toTile(x), toTile(y))) continue;
      mask[r] |= 1 << k;
      return { x, y };
    }
  }
  return null;
}

/** A bit straight ahead towards a nearby point, if the step is allowed (no pathfinding). */
function slideTo(sim, e, p, speed) {
  const dx = p.x - e.px, dy = p.y - e.py;
  const d = isqrt(dx * dx + dy * dy);
  if (d < 80) return;
  const s = Math.min(speed, d);
  const nx = e.px + idiv(dx * s, d), ny = e.py + idiv(dy * s, d);
  if (canStep(sim.map, e.px, e.py, nx, ny)) { e.px = nx; e.py = ny; }
}

/**
 * Ranged fighter and unreachable target (e.g. across the water): path to a tile in the own region
 * from which the target is in range – archers and cannons then fire at it from the bank.
 */
function rangePath(sim, e, t, range) {
  if (range < 3 * UNIT) return null;
  const m = sim.map, ex = toTile(e.px), ey = toTile(e.py);
  if (!m.walkable(ex, ey)) return null;
  const region = m.regionAt(m.idx(ex, ey)), r = toTile(range);
  const x0 = t.kind === 'building' ? t.x : toTile(t.px), y0 = t.kind === 'building' ? t.y : toTile(t.py);
  const x1 = t.kind === 'building' ? t.x + t.w - 1 : x0, y1 = t.kind === 'building' ? t.y + t.h - 1 : y0;
  const goals = [];
  for (let y = y0 - r; y <= y1 + r; y++) for (let x = x0 - r; x <= x1 + r; x++) {
    if (!m.inBounds(x, y) || !m.walkable(x, y) || m.regionAt(m.idx(x, y)) !== region) continue;
    if (distTo({ px: tileCenter(x), py: tileCenter(y) }, t) <= range - 300) goals.push(m.idx(x, y));
  }
  return goals.length ? pathTo(sim, e, goals) : null;
}

/** Distance between two points; accepts entities (px/py) and points (x/y). */
const distPt = (a, b) => isqrt(((a.px ?? a.x) - (b.px ?? b.x)) ** 2 + ((a.py ?? a.y) - (b.py ?? b.y)) ** 2);

/** Enemy and attackable. */
const canHit = (sim, e, t) => targetable(sim, t) && isEnemy(sim, e.owner, t.owner);

// ---------- Commanders (squad leader, hero, militia) ----------

function updateCommander(sim, e) {
  const st = combatStats(sim, e);
  if (e.cooldown > 0) e.cooldown--;
  // Intimidated (ability "Einschüchtern"): flees to the flee point, orders wait
  if (e.fearUntil !== undefined) {
    if (sim.tick < e.fearUntil) {
      if (e.order?.type !== 'move' || e.order.x !== e.fleeTo.x || e.order.y !== e.fleeTo.y) { e.order = { type: 'move', ...e.fleeTo }; e.path = []; }
      if (distPt(e, e.fleeTo) < 400) { e.path = []; return; }
    } else { delete e.fearUntil; delete e.fleeTo; e.order = { type: 'idle' }; e.anchor = { x: e.px, y: e.py }; }
  }
  const o = e.order ?? { type: 'idle' };
  let t = e.targetId ? sim.entities.get(e.targetId) : null;
  if (t && !canHit(sim, e, t)) { t = null; e.targetId = 0; }

  if (o.type === 'move') {
    e.targetId = 0;
    if (!e.path.length) {
      if (distPt(e, o) < 400) { e.order = { type: 'idle' }; e.anchor = { x: e.px, y: e.py }; return; }
      const p = pathTo(sim, e, [sim.map.idx(toTile(o.x), toTile(o.y))]);
      if (!p || !p.length) { e.order = { type: 'idle' }; e.anchor = { x: e.px, y: e.py }; return; }
      e.path = p;
    }
    moveAlong(sim, e, speedOf(sim, st.speed));
    if (!e.path.length) { e.order = { type: 'idle' }; e.anchor = { x: e.px, y: e.py }; }
    return;
  }

  if (o.type === 'attack') {
    const target = sim.entities.get(o.target);
    if (target && canHit(sim, e, target)) {
      // Building target: first the enemy squads in sight, then back to the building
      let tt = target;
      if (isStructure(target)) {
        if (t && !isStructure(t) && distTo(e, t) <= (st.sight ?? COMBAT.sight) * UNIT) tt = t;
        else if (threatTick(sim, e)) tt = threat(sim, e, st) ?? target;
        else if (t && !isStructure(t)) tt = target;
        else if (t) tt = t;
      }
      engage(sim, e, st, tt); return;
    }
    e.order = { type: 'idle' }; e.anchor = { x: e.px, y: e.py }; e.targetId = 0;
    return;
  }

  if (o.type === 'attackMove') {
    if (!t) t = nearestEnemy(sim, e, (st.sight ?? COMBAT.sight) * UNIT, { units: true, buildings: true });
    // Give up the building target as soon as enemy squads are in sight (nearestEnemy prefers units)
    else if (isStructure(t) && threatTick(sim, e)) t = threat(sim, e, st) ?? t;
    if (t) { engage(sim, e, st, t); return; }
    if (!e.path.length) {
      if (distPt(e, o) < 600) { e.order = { type: 'idle' }; e.anchor = { x: e.px, y: e.py }; return; }
      e.path = pathTo(sim, e, [sim.map.idx(toTile(o.x), toTile(o.y))]) ?? [];
      if (!e.path.length) { e.order = { type: 'idle' }; e.anchor = { x: e.px, y: e.py }; return; }
    }
    moveAlong(sim, e, speedOf(sim, st.speed));
    return;
  }

  if (o.type === 'hold') {
    if (!t || distTo(e, t) > st.range) t = nearestEnemy(sim, e, st.range, { units: true, buildings: false });
    if (t && distTo(e, t) <= st.range) engage(sim, e, st, t); else e.targetId = 0;
    return;
  }

  // Defend (default): attack enemies in sight, not too far from the anchor point
  const anchor = e.anchor ?? (e.anchor = { x: e.px, y: e.py });
  if (!t) t = nearestEnemy(sim, e, (st.sight ?? COMBAT.sight) * UNIT, { units: true, buildings: false });
  if (t && distPt(anchor, posOf(t)) <= COMBAT.leash * UNIT) { engage(sim, e, st, t); return; }
  e.targetId = 0;
  if (distPt(e, anchor) > 1200) {
    if (!e.path.length) e.path = pathTo(sim, e, [sim.map.idx(toTile(anchor.x), toTile(anchor.y))]) ?? [];
    if (e.path.length) moveAlong(sim, e, speedOf(sim, st.speed)); else e.anchor = { x: e.px, y: e.py };
  }
}

// ---------- Soldiers ----------

/** Formation spot of a soldier relative to the squad leader. */
export function slotOffset(i) {
  const col = i % 4, row = Math.floor(i / 4);
  return { x: (col * 2 - 3) * 350, y: (row + 1) * 700 };
}

function updateSoldier(sim, s) {
  const L = sim.entities.get(s.leader);
  if (!L) { sim.entities.delete(s.id); return; }
  const st = combatStats(sim, s);
  if (s.cooldown > 0) s.cooldown--;
  const moving = L.order?.type === 'move';
  let t = s.targetId ? sim.entities.get(s.targetId) : null;
  if (t && !canHit(sim, s, t) || moving) { t = null; s.targetId = 0; }
  const sightR = (st.sight ?? COMBAT.sight) * UNIT;
  if (t && isStructure(t)) {
    // Attack buildings until enemy squads come: then them first (like the squad leader)
    const lt = L.targetId ? sim.entities.get(L.targetId) : null;
    if (lt && !isStructure(lt) && targetable(sim, lt) && isEnemy(sim, s.owner, lt.owner)) t = lt;
    else if (threatTick(sim, s)) t = threat(sim, s, st) ?? t;
  }
  if (!t && !moving) {
    const lt = L.targetId ? sim.entities.get(L.targetId) : null;
    if (lt && targetable(sim, lt)) t = isStructure(lt) ? threat(sim, s, st) ?? lt : lt;
    else t = nearestEnemy(sim, s, (L.order?.type === 'hold' ? st.range : sightR), { units: true, buildings: L.order?.type === 'attack' || L.order?.type === 'attackMove' });
    if (t && distTo(L, t) > COMBAT.leash * UNIT) t = null;
  }
  if (t) {
    if (L.order?.type === 'hold' && distTo(s, t) > st.range) { s.targetId = 0; }
    else { engage(sim, s, st, t); return; }
  }
  const off = slotOffset(L.soldiers.indexOf(s.id));
  const gx = L.px + off.x, gy = L.py + off.y;
  const d = isqrt((gx - s.px) ** 2 + (gy - s.py) ** 2);
  if (d < 150) return;
  const spd = speedOf(sim, st.speed + (d > 2000 ? 60 : 0));
  if (d > 5000) {
    // Far from the squad leader: path to him; if he is unreachable (other bank), to the nearest
    // reachable spot near him. The squad leader then stays attackable (DETACHED in targetable).
    if (!s.path.length || (sim.tick + s.id) % 20 === 0) s.path = pathTo(sim, s, goalTiles(sim, L)) ?? pathTowardUnreachable(sim, s, L) ?? [];
    moveAlong(sim, s, spd);
  } else {
    stepToward(sim, s, gx, gy, spd);
  }
}

/** Path to the tile near `t` that `e` can still reach (same region), or null. */
function pathTowardUnreachable(sim, e, t) {
  const m = sim.map, tx = toTile(e.px), ty = toTile(e.py);
  if (!m.walkable(tx, ty)) return null;
  const p = posOf(t);
  const k = nearestWalkable(m, toTile(p.x), toTile(p.y), p.x, p.y, 16, m.regionAt(m.idx(tx, ty)));
  if (k < 0 || k === m.idx(tx, ty)) return null;
  return pathTo(sim, e, [k]);
}

// ---------- Heroes ----------

function updateHero(sim, h) {
  if (h.down) {
    const enemy = nearestEnemy(sim, h, COMBAT.heroReviveRadius * UNIT, { units: true, buildings: false });
    h.downTimer = enemy ? 0 : h.downTimer + 1;
    if (h.downTimer >= COMBAT.heroReviveTicks) {
      h.down = false;
      h.hp = Math.trunc(HEROES[h.hero].hp / 2);
      for (const [id, a] of Object.entries(HEROES[h.hero].abilities)) h.ready[id] = sim.tick + a.cooldown;
      sim.events.push({ type: 'heroRevived', id: h.id, owner: h.owner });
    }
    return;
  }
  updateCommander(sim, h);
}

/** Trigger ability. @returns {string|null} error code (see src/i18n) */
export function useAbility(sim, h, ability, x, y) {
  const abilities = HEROES[h.hero]?.abilities;
  const def = abilities && typeof ability === 'string' && Object.hasOwn(abilities, ability) ? abilities[ability] : null;
  if (!def) return 'err.unknownAbility';
  if (h.down) return 'err.heroDown';
  // Target point (only via commands with x/y): on the map and near the hero, otherwise hero position
  if (x !== undefined || y !== undefined) {
    const ok = Number.isInteger(x) && Number.isInteger(y) && sim.map.inBounds(toTile(x), toTile(y))
      && isqrt((x - h.px) ** 2 + (y - h.py) ** 2) <= ABILITY_RANGE;
    if (!ok) return 'err.notWalkable';
  }
  if ((h.ready[ability] ?? 0) > sim.tick) return 'err.notReady';
  const around = (radius, pred) => {
    const out = [];
    for (const e of sim.entities.values()) {
      if (!pred(e)) continue;
      if (distTo(h, e) <= radius) out.push(e);
    }
    return out;
  };
  switch (ability) {
    case 'farsight':
      // Far sight: a large area around the heroine visible for a while (and permanently explored)
      revealArea(sim, h.owner, toTile(x ?? h.px), toTile(y ?? h.py), def.reveal, def.duration);
      break;
    case 'courage':
      for (const e of around(def.radius, (e) => (e.kind === 'leader' || e.kind === 'hero') && e.owner === h.owner)) e.buff = { attackPercent: def.attackPercent, until: sim.tick + def.duration };
      break;
    case 'bribe': {
      // nearest enemy squad (squad leader with soldiers) in range switches sides for taler
      let best = null, bd = def.radius + 1;
      for (const e of sim.entities.values()) {
        if (e.kind !== 'leader' || !isEnemy(sim, h.owner, e.owner)) continue;
        const d = distTo(h, e);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) return 'err.noTarget';
      if (!sim.pay(h.owner, { gold: def.gold + def.goldPerSoldier * best.soldiers.length })) return 'err.notEnoughGold';
      const from = best.owner;
      for (const id of [best.id, ...best.soldiers]) {
        const e = sim.entities.get(id);
        if (!e) continue;
        e.owner = h.owner; e.targetId = 0; e.path = []; e.buff = null;
        delete e.fearUntil; delete e.fleeTo;
      }
      best.order = { type: 'idle' }; best.anchor = { x: best.px, y: best.py };
      sim.events.push({ type: 'bribed', leader: best.id, from, to: h.owner });
      break;
    }
    case 'salve':
      for (const e of around(def.radius, (e) => (FIGHTERS.has(e.kind) || e.kind === 'unit') && e.owner === h.owner && !e.down)) e.hp = Math.min(maxHp(sim, e), e.hp + def.amount);
      break;
    case 'shieldBash':
      for (const e of around(def.radius, (e) => (FIGHTERS.has(e.kind) || e.kind === 'unit') && isEnemy(sim, h.owner, e.owner) && targetable(sim, e))) applyDamage(sim, e, def.damage, h);
      break;
    case 'intimidate': {
      // enemy squad leaders and militia flee from the hero; soldiers follow their squad leader
      const n = around(def.radius, (e) => (e.kind === 'leader' || (e.kind === 'unit' && e.militia)) && isEnemy(sim, h.owner, e.owner));
      for (const e of n) {
        const dx = e.px - h.px, dy = e.py - h.py, d = Math.max(1, isqrt(dx * dx + dy * dy));
        let fx = e.px + idiv(dx * def.flee, d), fy = e.py + idiv(dy * def.flee, d);
        fx = Math.max(500, Math.min(sim.map.width * UNIT - 500, fx)); fy = Math.max(500, Math.min(sim.map.height * UNIT - 500, fy));
        const k = nearestWalkable(sim.map, toTile(fx), toTile(fy), fx, fy, 6);
        if (k >= 0) { fx = (k % sim.map.width) * UNIT + 500; fy = ((k / sim.map.width) | 0) * UNIT + 500; }
        e.fearUntil = sim.tick + def.duration; e.fleeTo = { x: fx, y: fy };
        e.order = { type: 'move', x: fx, y: fy }; e.path = []; e.targetId = 0;
      }
      break;
    }
    case 'caltrops': case 'fieldGun': {
      const kind = ability === 'fieldGun' ? 'turret' : 'trap';
      const obj = {
        id: sim.nextId++, kind, owner: h.owner, px: x ?? h.px, py: y ?? h.py,
        hp: kind === 'turret' ? 500 : def.hp, maxHp: 500,
        damage: def.damage ?? 0, radius: def.radius ?? 0, fuse: 0,
        attack: def.attack ?? 0, range: def.range ?? 0, shots: def.shots ?? 0, cooldown: 0, path: [],
      };
      sim.entities.set(obj.id, obj);
      break;
    }
    default: return 'err.unknownAbility';
  }
  h.ready[ability] = sim.tick + def.cooldown;
  sim.events.push({ type: 'ability', hero: h.id, ability, owner: h.owner, x: x ?? h.px, y: y ?? h.py });
  return null;
}

function explode(sim, obj) {
  for (const e of [...sim.entities.values()]) {
    if (!isEnemy(sim, obj.owner, e.owner) || !targetable(sim, e)) continue;
    if (distTo(obj, e) <= obj.radius) applyDamage(sim, e, obj.damage, obj);
  }
  sim.events.push({ type: 'explosion', x: obj.px, y: obj.py });
  sim.entities.delete(obj.id);
}

// ---------- Tick ----------

export function updateMilitary(sim) {
  buildGrid(sim);
  claims.clear();
  for (const e of [...sim.entities.values()]) {
    if (!sim.entities.has(e.id)) continue;
    switch (e.kind) {
      case 'leader': regenerate(sim, e); updateCommander(sim, e); break;
      case 'soldier': updateSoldier(sim, e); break;
      case 'hero': updateHero(sim, e); break;
      case 'unit': if (e.militia) updateCommander(sim, e); break;
      case 'building':
        if (e.type === 'tower' && e.done && e.level >= 1) {
          if (e.cooldown > 0) { e.cooldown--; break; }
          const st = combatStats(sim, e);
          const t = nearestEnemy(sim, e, st.range, { units: true, buildings: false });
          if (t) { attack(sim, e, st, t); e.cooldown = st.cooldown; }
        }
        break;
      case 'turret': {
        if (e.cooldown > 0) { e.cooldown--; break; }
        const st = combatStats(sim, e);
        const t = nearestEnemy(sim, e, st.range, { units: true, buildings: false });
        if (t) { attack(sim, e, st, t); e.cooldown = st.cooldown; if (--e.shots <= 0) sim.entities.delete(e.id); }
        break;
      }
      case 'trap':
        if (nearestEnemy(sim, e, 1500, { units: true, buildings: false })) explode(sim, e);
        break;
      default: break;
    }
  }
}

/** Switch militia on or off: all serfs of the player or only those with the IDs `ids` ("To arms"). */
export function setMilitia(sim, owner, on, ids = null) {
  const hq = sim.findBuilding(owner, 'headquarters');
  const only = ids ? new Set(ids) : null;
  for (const e of sim.entities.values()) {
    if (e.kind !== 'unit' || e.owner !== owner || (only && !only.has(e.id))) continue;
    delete e.fleeUntil; delete e.fleeGoal;
    if (on && !e.militia) {
      const site = e.job?.kind === 'build' || e.job?.kind === 'repair' ? sim.entities.get(e.job.target) : null;
      if (site) site.builders = site.builders.filter((id) => id !== e.id);
      e.job = null; e.path = []; e.goal = undefined;
      e.militia = true; e.cooldown = 0; e.targetId = 0;
      e.order = hq ? { type: 'move', x: (hq.x + (hq.w >> 1)) * UNIT + 500, y: (hq.y + hq.h + 1) * UNIT + 500 } : { type: 'idle' };
    } else if (!on && e.militia) {
      e.militia = false; e.order = undefined; e.targetId = 0; e.path = [];
    }
  }
}
