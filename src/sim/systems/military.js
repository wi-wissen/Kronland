// Military: squad leaders with soldiers, heroes, militia, towers, traps, combat and damage.

import { UNITS, MILITIA, SERF_COMBAT, TOWER, HEROES, HERO_COMMON, WORKER_COMBAT } from '../data/units.js';
import { COMBAT, computeDamage } from '../data/combat.js';
import { BUILDINGS, buildingArmor } from '../data/buildings.js';
import { moveAlong, pathTo } from './movement.js';
import { idiv, isqrt, toTile, UNIT } from '../fixed.js';
import { removeWorker } from './workers.js';

const FIGHTERS = new Set(['leader', 'soldier', 'hero']);

// ---------- Values ----------

/** Combat values of an entity (null = cannot attack or cannot be attacked). */
export function combatStats(sim, e) {
  switch (e.kind) {
    case 'leader': case 'soldier': {
      const d = UNITS[e.def];
      let attack = d.attack;
      const L = e.kind === 'leader' ? e : sim.entities.get(e.leader);
      if (L?.buff && sim.tick < L.buff.until) attack = idiv(attack * L.buff.attackPercent, 100);
      if (d.range > 2000 && sim.weather?.state === 'rain') attack = idiv(attack * 70, 100); // (A)
      return { attack, armor: d.armor, attackType: d.attackType, armorType: d.armorType, range: d.range, cooldown: d.cooldown, speed: d.speed };
    }
    case 'hero': {
      const h = HEROES[e.hero];
      const attack = e.buff && sim.tick < e.buff.until ? idiv(h.attack * e.buff.attackPercent, 100) : h.attack;
      return { attack, armor: h.armor, ...HERO_COMMON, range: h.range, cooldown: h.cooldown, speed: h.speed };
    }
    case 'unit': {
      const c = e.militia ? MILITIA : SERF_COMBAT;
      return { ...c, speed: 200 };
    }
    case 'worker': return { attack: 0, ...WORKER_COMBAT, range: 0, cooldown: 0, speed: 0 };
    case 'building': {
      const t = e.type === 'tower' && e.done ? TOWER[e.level] : null;
      return {
        attack: t?.attack ?? 0, armor: buildingArmor(e.type, e.level), attackType: t?.attackType ?? 'chaos',
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
    case 'building': return BUILDINGS[e.type].levels[e.level].hp;
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

export const isEnemy = (sim, a, b) => a !== b && a >= 0 && b >= 0 && !sim.players[b]?.defeated && !sim.allied(a, b);

/** May this target be attacked? */
export function targetable(sim, t) {
  if (!t || !sim.entities.has(t.id)) return false;
  switch (t.kind) {
    case 'leader': return t.soldiers.length === 0; // captain only once all soldiers have fallen
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

/** Nearest enemy in range. opts.buildings: also buildings, opts.units: also units. */
export function nearestEnemy(sim, e, radius, opts = { units: true, buildings: false }) {
  const C = COMBAT.gridCell * UNIT;
  const p = posOf(e);
  const owner = e.owner;
  let best = null, bd = radius + 1, bestUnit = null, bdu = radius + 1;
  const seen = new Set();
  for (let cy = Math.floor((p.y - radius) / C); cy <= Math.floor((p.y + radius) / C); cy++) {
    for (let cx = Math.floor((p.x - radius) / C); cx <= Math.floor((p.x + radius) / C); cx++) {
      const list = sim.grid?.get(cy * 4096 + cx);
      if (!list) continue;
      for (const t of list) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        if (!isEnemy(sim, owner, t.owner) || !targetable(sim, t)) continue;
        const isB = t.kind === 'building' || t.kind === 'trap';
        if (isB && !opts.buildings) continue;
        if (!isB && !opts.units) continue;
        const d = distTo(e, t);
        if (d > radius) continue;
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
  if (target.hp > 0) return;
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
      sim.events.push({ type: 'buildingDestroyed', building: t.id, buildingType: t.type, owner: t.owner });
      sim.removeEntity(t);
      if (t.type === 'headquarters') sim.checkDefeat(t.owner);
      break;
    case 'unit': {
      // Serf: release from construction site
      const site = t.job?.kind === 'build' ? sim.entities.get(t.job.target) : null;
      if (site) site.builders = site.builders.filter((id) => id !== t.id);
      sim.entities.delete(t.id);
      break;
    }
    default: sim.entities.delete(t.id);
  }
}

function attack(sim, e, st, t) {
  const tst = combatStats(sim, t.kind === 'leader' && t.soldiers.length ? sim.entities.get(t.soldiers[0]) ?? t : t);
  const dmg = computeDamage(st.attack, st.attackType, tst.armorType, tst.armor, sim.rng.int(3));
  if (st.range > 2000) {
    const a = posOf(e), b = posOf(t);
    sim.events.push({ type: 'shot', from: a, to: b, owner: e.owner, kind: e.kind === 'building' || e.kind === 'turret' ? 'bolt' : (UNITS[e.def]?.line === 'cannon' ? 'ball' : 'arrow') });
  } else {
    sim.events.push({ type: 'hit', by: e.id, target: t.id });
  }
  applyDamage(sim, t, dmg, e);
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
  return sim.weather?.state === 'winter' ? idiv(base * 75, 100) : base;
}

/** Walk straight to a point if free; otherwise path. */
function stepToward(sim, e, x, y, speed) {
  const dx = x - e.px, dy = y - e.py;
  const d = isqrt(dx * dx + dy * dy);
  if (d === 0) return true;
  const s = Math.min(speed, d);
  const nx = e.px + idiv(dx * s, d), ny = e.py + idiv(dy * s, d);
  if (sim.map.walkable(toTile(nx), toTile(ny))) { e.px = nx; e.py = ny; return d <= speed; }
  // Obstacle: path to the target tile
  if (!e.path.length) {
    const tx = toTile(x), ty = toTile(y);
    e.path = (sim.map.walkable(tx, ty) && pathTo(sim, e, [sim.map.idx(tx, ty)])) || [];
  }
  moveAlong(sim, e, speed);
  return false;
}

/** Pursue and attack the target. */
function engage(sim, e, st, t) {
  e.targetId = t.id;
  const d = distTo(e, t);
  if (d <= st.range) {
    e.path = [];
    if (e.cooldown <= 0) { attack(sim, e, st, t); e.cooldown = st.cooldown; }
    return;
  }
  if (st.speed <= 0) { e.targetId = 0; return; }
  if (t.kind !== 'building' && d < 3 * UNIT) {
    e.path = [];
    const q = posOf(t);
    stepToward(sim, e, q.x, q.y, speedOf(sim, st.speed));
    return;
  }
  if (!e.path.length || (sim.tick + e.id) % 15 === 0) e.path = pathTo(sim, e, goalTiles(sim, t)) ?? [];
  if (!e.path.length) { e.targetId = 0; return; }
  moveAlong(sim, e, speedOf(sim, st.speed));
}

/** Distance between two points; accepts entities (px/py) and points (x/y). */
const distPt = (a, b) => isqrt(((a.px ?? a.x) - (b.px ?? b.x)) ** 2 + ((a.py ?? a.y) - (b.py ?? b.y)) ** 2);

// ---------- Commanders (squad leader, hero, militia) ----------

function updateCommander(sim, e) {
  const st = combatStats(sim, e);
  if (e.cooldown > 0) e.cooldown--;
  const o = e.order ?? { type: 'idle' };
  let t = e.targetId ? sim.entities.get(e.targetId) : null;
  if (t && !(targetable(sim, t) && isEnemy(sim, e.owner, t.owner))) { t = null; e.targetId = 0; }

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
    if (target && targetable(sim, target) && isEnemy(sim, e.owner, target.owner)) { engage(sim, e, st, target); return; }
    e.order = { type: 'idle' }; e.anchor = { x: e.px, y: e.py }; e.targetId = 0;
    return;
  }

  if (o.type === 'attackMove') {
    if (!t) t = nearestEnemy(sim, e, COMBAT.sight * UNIT, { units: true, buildings: true });
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
  if (!t) t = nearestEnemy(sim, e, COMBAT.sight * UNIT, { units: true, buildings: false });
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
  if (t && !(targetable(sim, t) && isEnemy(sim, s.owner, t.owner)) || moving) { t = null; s.targetId = 0; }
  if (!t && !moving) {
    const lt = L.targetId ? sim.entities.get(L.targetId) : null;
    if (lt && targetable(sim, lt)) t = lt;
    else t = nearestEnemy(sim, s, (L.order?.type === 'hold' ? st.range : COMBAT.sight * UNIT), { units: true, buildings: L.order?.type === 'attack' || L.order?.type === 'attackMove' });
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
    if (!s.path.length || (sim.tick + s.id) % 20 === 0) s.path = pathTo(sim, s, goalTiles(sim, L)) ?? [];
    moveAlong(sim, s, spd);
  } else {
    stepToward(sim, s, gx, gy, spd);
  }
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

/** Trigger an ability. @returns {string|null} error text */
export function useAbility(sim, h, ability, x, y) {
  const def = HEROES[h.hero]?.abilities[ability];
  if (!def) return 'Unbekannte Fähigkeit';
  if (h.down) return 'Held ist bewusstlos';
  if ((h.ready[ability] ?? 0) > sim.tick) return 'Noch nicht bereit';
  h.ready[ability] = sim.tick + def.cooldown;
  const around = (radius, pred) => {
    const out = [];
    for (const e of sim.entities.values()) {
      if (!pred(e)) continue;
      if (distTo(h, e) <= radius) out.push(e);
    }
    return out;
  };
  switch (ability) {
    case 'whirl':
      for (const e of around(def.radius, (e) => (FIGHTERS.has(e.kind) || e.kind === 'unit') && isEnemy(sim, h.owner, e.owner) && targetable(sim, e))) applyDamage(sim, e, def.damage, h);
      break;
    case 'might':
      for (const e of around(def.radius, (e) => (e.kind === 'leader' || e.kind === 'hero') && e.owner === h.owner)) e.buff = { attackPercent: def.attackPercent, until: sim.tick + def.duration };
      break;
    case 'heal':
      for (const e of around(def.radius, (e) => (FIGHTERS.has(e.kind) || e.kind === 'unit') && e.owner === h.owner && !e.down)) e.hp = Math.min(maxHp(sim, e), e.hp + def.amount);
      break;
    case 'trap': case 'bomb': case 'turret': {
      const kind = ability === 'turret' ? 'turret' : ability === 'bomb' ? 'bomb' : 'trap';
      const obj = {
        id: sim.nextId++, kind, owner: h.owner, px: x ?? h.px, py: y ?? h.py,
        hp: ability === 'turret' ? 500 : ability === 'trap' ? def.hp : 1, maxHp: 500,
        damage: def.damage ?? 0, radius: def.radius ?? 0, fuse: def.fuse ?? 0,
        attack: def.attack ?? 0, range: def.range ?? 0, shots: def.shots ?? 0, cooldown: 0, path: [],
      };
      sim.entities.set(obj.id, obj);
      break;
    }
    default: return 'Unbekannte Fähigkeit';
  }
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
  for (const e of [...sim.entities.values()]) {
    if (!sim.entities.has(e.id)) continue;
    switch (e.kind) {
      case 'leader': updateCommander(sim, e); break;
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
      case 'bomb':
        if (--e.fuse <= 0) explode(sim, e);
        break;
      default: break;
    }
  }
}

/** Switch the militia on or off. */
export function setMilitia(sim, owner, on) {
  const hq = sim.findBuilding(owner, 'headquarters');
  for (const e of sim.entities.values()) {
    if (e.kind !== 'unit' || e.owner !== owner) continue;
    if (on && !e.militia) {
      const site = e.job?.kind === 'build' ? sim.entities.get(e.job.target) : null;
      if (site) site.builders = site.builders.filter((id) => id !== e.id);
      e.job = null; e.path = []; e.goal = undefined;
      e.militia = true; e.cooldown = 0; e.targetId = 0;
      e.order = hq ? { type: 'move', x: (hq.x + (hq.w >> 1)) * UNIT + 500, y: (hq.y + hq.h + 1) * UNIT + 500 } : { type: 'idle' };
    } else if (!on && e.militia) {
      e.militia = false; e.order = undefined; e.targetId = 0; e.path = [];
    }
  }
}
