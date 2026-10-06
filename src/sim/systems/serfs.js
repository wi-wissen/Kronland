// Serfs: walk, build, repair, chop wood, mine resource piles, look for follow-up work.

import { moveAlong, pathTo, isAdjacent } from './movement.js';
import { BALANCE } from '../data/balance.js';
import { toTile, isqrt, idiv, UNIT } from '../fixed.js';
import { nearestWalkable } from './movement.js';
import { isEnemy, targetable, strike } from './military.js';
import { SERF_COMBAT } from '../data/units.js';
import { techBonus, boosted, buildingMaxHp } from './techs.js';
import { DAMAGE, isDamaged } from './damage.js';
import { takenSpots, pickSpot, freeSpots, regionOf } from './spots.js';

const S = BALANCE.serf;

/** Area of a target (building or 1×1 node). */
function rectOf(t) {
  return t.kind === 'building' ? { x: t.x, y: t.y, w: t.w, h: t.h } : { x: t.x, y: t.y, w: 1, h: 1 };
}

/** Work spots around a target: the walkable tiles directly next to it. */
const spotsAround = (sim, t) => { const r = rectOf(t); return sim.map.ring(r.x, r.y, r.w, r.h); };

/** Is the target still valid work for this serf? */
/** Figures that serfs can attack (as in the model: click the opponent instead of a tree). No buildings. */
const FIGHTABLE = new Set(['unit', 'worker', 'leader', 'soldier', 'hero']);
const canFight = (sim, u, t) => !!t && FIGHTABLE.has(t.kind) && isEnemy(sim, u.owner, t.owner) && targetable(sim, t);

function jobValid(sim, u, t) {
  if (!t) return false;
  if (u.job.kind === 'fight') return canFight(sim, u, t);
  if (u.job.kind === 'build') return t.kind === 'building' && !t.done && t.owner === u.owner;
  if (u.job.kind === 'repair') return t.kind === 'building' && t.owner === u.owner && isDamaged(sim, t);
  return (t.kind === 'tree' || t.kind === 'pile') && t.amount > 0;
}

/** Release a serf from their work. */
export function clearJob(sim, u) {
  if (u.job?.kind === 'build' || u.job?.kind === 'repair') {
    const t = sim.entities.get(u.job.target);
    if (t && t.kind === 'building') t.builders = t.builders.filter((id) => id !== u.id);
  }
  u.job = null;
  u.spot = -1;
  u.timer = 0;
  u.path = [];
}

/**
 * Assign work. Each serf gets their own spot around the target; if none is
 * free any more (or the construction site is already staffed with `maxBuildersPerSite`), it is not accepted.
 * @returns {boolean}
 */
export function assignJob(sim, u, t) {
  if (t.kind === 'building') {
    if (t.owner !== u.owner) return false;
    // Finished buildings: repair, if damaged
    if (t.done && !isDamaged(sim, t)) return false;
    if (t.builders.includes(u.id)) return true;
    if (t.builders.length >= S.maxBuildersPerSite) return false;
    const spot = pickSpot(sim, u, spotsAround(sim, t));
    if (spot < 0) return false;
    clearJob(sim, u);
    t.builders.push(u.id);
    u.job = { kind: t.done ? 'repair' : 'build', target: t.id };
    u.spot = spot;
  } else if (t.kind === 'tree' || t.kind === 'pile') {
    if (t.amount <= 0) return false;
    if (u.job?.target === t.id && u.spot >= 0) return true;
    const spot = pickSpot(sim, u, spotsAround(sim, t));
    if (spot < 0) return false;
    clearJob(sim, u);
    u.job = { kind: 'gather', target: t.id, res: t.res };
    u.spot = spot;
  } else if (canFight(sim, u, t)) {
    // Attack opponent: with bare fists (SERF_COMBAT), until it falls; idle afterwards
    clearJob(sim, u);
    delete u.fleeUntil; delete u.fleeGoal;
    u.job = { kind: 'fight', target: t.id };
  } else return false;
  u.goal = undefined;
  u.path = [];
  return true;
}

/**
 * How many serfs (from the region of `u`) a construction site or repair can still take:
 * at most `maxBuildersPerSite` and only as many as there are free spots around it. For AI and bots.
 */
export function siteRoom(sim, b, u) {
  const left = S.maxBuildersPerSite - b.builders.length;
  if (left <= 0) return 0;
  const free = freeSpots(sim.map, spotsAround(sim, b), takenSpots(sim), u ? regionOf(sim.map, u) : 0).length;
  return Math.min(left, free);
}

/** Does the target still have a free spot that `u` can reach? (Without the spot of `u` itself.) */
export function hasFreeSpot(sim, u, t, taken = takenSpots(sim, u.id)) {
  return freeSpots(sim.map, spotsAround(sim, t), taken, regionOf(sim.map, u)).length > 0;
}

/** How many serfs work at a tree or pile at the same time (after that they move aside). */
const gatherCap = (t) => (t.kind === 'tree' ? S.gatherersPerTree : S.gatherersPerPile);

/**
 * Serfs per resource node (tree, pile). `skip` are serfs that are currently being redistributed –
 * their previous work no longer counts.
 * @returns {Map<number, number>}
 */
function gathererCounts(sim, skip = null) {
  const counts = new Map();
  for (const e of sim.entities.values()) {
    if (e.kind !== 'unit' || e.job?.kind !== 'gather' || skip?.has(e.id)) continue;
    counts.set(e.job.target, (counts.get(e.job.target) ?? 0) + 1);
  }
  return counts;
}

/** Is a 1×1 node reachable from region `region` (a free neighbouring tile in it)? */
function reachable(map, e, region) {
  for (let y = e.y - 1; y <= e.y + 1; y++) for (let x = e.x - 1; x <= e.x + 1; x++) {
    if (map.walkable(x, y) && map.regionAt(map.idx(x, y)) === region) return true;
  }
  return false;
}

/**
 * Nearest node reachable for `u` with resource `res` around the tile (tx,ty) within the search radius.
 * Prefers nodes below their limit (`gatherersPerTree`/`…Pile`); if all are occupied, the nearest
 * at all (better to share than stand idle). Only ever nodes with a free spot around them – every
 * serf stands on its own tile. Tie: smaller ID (insertion order) – deterministic.
 */
function nearestNode(sim, u, res, tx, ty, counts, taken = takenSpots(sim, u.id)) {
  const m = sim.map, r2 = S.searchRadius * S.searchRadius;
  const region = regionOf(m, u);
  let free = null, freeD = Infinity, any = null, anyD = Infinity;
  for (const e of sim.entities.values()) {
    if ((e.kind !== 'tree' && e.kind !== 'pile') || e.res !== res || e.amount <= 0) continue;
    const d = (e.x - tx) ** 2 + (e.y - ty) ** 2;
    if (d > r2 || (d >= anyD && d >= freeD)) continue;
    if (region && !reachable(m, e, region)) continue;
    // Without a free spot around (neighbouring trees, other serfs) the node is full
    if (!freeSpots(m, spotsAround(sim, e), taken, region).length) continue;
    if (d < anyD) { any = e; anyD = d; }
    if (d < freeD && (counts.get(e.id) ?? 0) < gatherCap(e)) { free = e; freeD = d; }
  }
  return free ?? any;
}

/**
 * Send several serfs to mine: the clicked node is staffed up to its limit
 * (the nearest first), the others distribute over free nodes of the same kind nearby.
 * @returns {number} number of assigned serfs
 */
export function assignGather(sim, serfs, t) {
  if (t.amount <= 0) return 0;
  const counts = gathererCounts(sim, new Set(serfs.map((u) => u.id)));
  const dist = (u) => (toTile(u.px) - t.x) ** 2 + (toTile(u.py) - t.y) ** 2;
  const order = serfs.map((u) => ({ u, d: dist(u) })).sort((a, b) => a.d - b.d || a.u.id - b.u.id);
  let ok = 0;
  for (const { u } of order) {
    const own = (counts.get(t.id) ?? 0) < gatherCap(t) && hasFreeSpot(sim, u, t);
    const node = own ? t : nearestNode(sim, u, t.res, t.x, t.y, counts) ?? t;
    if (!assignJob(sim, u, node)) continue;
    counts.set(node.id, (counts.get(node.id) ?? 0) + 1);
    ok++;
  }
  return ok;
}

/** Find the nearest work of the same kind in the surroundings. */
function findNextJob(sim, u, prev) {
  const tx = toTile(u.px), ty = toTile(u.py);
  if (prev.kind === 'gather') {
    const node = nearestNode(sim, u, prev.res, tx, ty, gathererCounts(sim, new Set([u.id])));
    if (node && assignJob(sim, u, node)) return true;
    clearJob(sim, u);
    // Nothing left nearby: notice, so that the player reassigns the idle ones
    sim.events.push({ type: 'noMoreNodes', player: u.owner, res: prev.res, unit: u.id });
    return false;
  }
  const r2 = S.searchRadius * S.searchRadius;
  let best = null, bestD = Infinity;
  for (const e of sim.entities.values()) {
    let fits = false;
    if (prev.kind === 'build') fits = e.kind === 'building' && !e.done && e.owner === u.owner && e.builders.length < S.maxBuildersPerSite;
    else if (prev.kind === 'repair') fits = e.kind === 'building' && e.owner === u.owner && isDamaged(sim, e) && e.builders.length < S.maxBuildersPerSite;
    if (!fits) continue;
    const r = rectOf(e);
    const cx = r.x + (r.w >> 1), cy = r.y + (r.h >> 1);
    const d = (cx - tx) ** 2 + (cy - ty) ** 2;
    if (d <= r2 && d < bestD && hasFreeSpot(sim, u, e)) { best = e; bestD = d; }
  }
  if (best && assignJob(sim, u, best)) return true;
  clearJob(sim, u);
  return false;
}

/**
 * Attack by a serf: walk there (path renewed every second, the target moves), hit when in range.
 * u.timer counts the cooldown between two hits.
 */
function fight(sim, u, t) {
  const tx = t.px ?? (t.x * UNIT + 500), ty = t.py ?? (t.y * UNIT + 500);
  const dx = tx - u.px, dy = ty - u.py;
  if (dx * dx + dy * dy <= SERF_COMBAT.range * SERF_COMBAT.range) {
    u.path = [];
    if (u.timer > 0) { u.timer--; return; }
    strike(sim, u, t);
    u.timer = SERF_COMBAT.cooldown;
    return;
  }
  if (u.timer > 0) u.timer--;
  if (!u.path.length || (sim.tick + u.id) % 10 === 0) {
    const p = pathTo(sim, u, [sim.map.idx(toTile(tx), toTile(ty))]);
    if (p === null) { clearJob(sim, u); return; }
    u.path = p;
  }
  if (u.path.length) moveSerf(sim, u);
}

/** Speed of a serf (high-quality shoes). */
export const serfSpeed = (sim, u) => boosted(S.speed, techBonus(sim, u.owner, 'serfs').speed);

const moveSerf = (sim, u) => moveAlong(sim, u, serfSpeed(sim, u));

function doWork(sim, u, t) {
  if (u.job.kind === 'repair') {
    const max = buildingMaxHp(sim, t);
    t.hp = Math.min(max, t.hp + DAMAGE.repairHpPerTick);
    if (t.hp >= max) {
      const builders = t.builders.map((id) => sim.entities.get(id)).filter(Boolean);
      t.builders = [];
      sim.events.push({ type: 'repaired', player: t.owner, building: t.id });
      for (const b of builders) { b.job = null; findNextJob(sim, b, { kind: 'repair' }); }
    }
    return;
  }
  if (u.job.kind === 'build') {
    t.progress++;
    const maxHp = buildingMaxHp(sim, t);
    t.hp = Math.max(t.hp, Math.trunc((maxHp * t.progress) / t.work));
    if (t.progress >= t.work) {
      t.done = true;
      t.hp = maxHp;
      const builders = t.builders.map((id) => sim.entities.get(id)).filter(Boolean);
      t.builders = [];
      sim.onBuildingDone(t);
      for (const b of builders) findNextJob(sim, b, { kind: 'build' });
    }
    return;
  }
  // Mining
  u.timer++;
  const wood = t.res === 'wood';
  if (u.timer < (wood ? S.chopTicks : S.mineTicks)) return;
  u.timer = 0;
  const amount = Math.min(wood ? S.chopYield : S.mineYield, t.amount);
  t.amount -= amount;
  sim.players[u.owner].raw[t.res] += amount;
  if (t.amount <= 0) {
    sim.removeEntity(t);
    sim.events.push({ type: 'nodeDepleted', node: t.id, res: t.res });
    findNextJob(sim, u, { kind: 'gather', res: t.res });
  }
}

/** Is tile `k` directly around rectangle `r` (not inside it)? */
function onRing(m, k, r) {
  const x = k % m.width, y = (k / m.width) | 0;
  const inside = x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  return !inside && x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h;
}

/** Tick of a serf. */
/**
 * An attacked serf (no militia) flees: to the castle, otherwise – if the attacker is closer to the castle
 * or there is none – away from the attacker. The work stays assigned and continues afterwards (as in the model:
 * serfs do not fight back on their own, they run away; they only fight as militia).
 * @param {import('../sim.js').Sim} sim @param {any} u serf @param {any} a attacker (with px/py or x/y)
 */
export function startFlee(sim, u, a) {
  const ax = a.px ?? a.x * UNIT + idiv((a.w ?? 1) * UNIT, 2), ay = a.py ?? a.y * UNIT + idiv((a.h ?? 1) * UNIT, 2);
  const hq = sim.findBuilding(u.owner, 'headquarters');
  let tx, ty;
  if (hq) {
    const dx = (hq.x + (hq.w >> 1)) * UNIT + 500, dy = (hq.y + hq.h + 1) * UNIT + 500;
    const me = (u.px - dx) ** 2 + (u.py - dy) ** 2, foe = (ax - dx) ** 2 + (ay - dy) ** 2;
    if (foe > me && me > (3 * UNIT) ** 2) { tx = toTile(dx); ty = toTile(dy); }
  }
  if (tx === undefined) {
    let vx = u.px - ax, vy = u.py - ay;
    const len = isqrt(vx * vx + vy * vy);
    if (!len) { vx = UNIT; vy = 0; } else { vx = idiv(vx * UNIT, len); vy = idiv(vy * UNIT, len); }
    const n = BALANCE.serf.fleeTiles;
    tx = toTile(u.px + vx * n); ty = toTile(u.py + vy * n);
    tx = Math.max(0, Math.min(sim.map.width - 1, tx)); ty = Math.max(0, Math.min(sim.map.height - 1, ty));
  }
  const goal = nearestWalkable(sim.map, tx, ty, u.px, u.py, 6);
  if (goal < 0) return;
  u.fleeUntil = sim.tick + BALANCE.serf.fleeTicks;
  u.fleeGoal = goal;
  u.path = [];
}

export function updateSerf(sim, u) {
  // Fleeing: first away, afterwards (work stays assigned) continue normally
  if (u.fleeUntil !== undefined) {
    if (sim.tick < u.fleeUntil) {
      if (!u.path.length && sim.map.idx(toTile(u.px), toTile(u.py)) !== u.fleeGoal) u.path = pathTo(sim, u, [u.fleeGoal]) ?? [];
      if (u.path.length) moveSerf(sim, u);
      return;
    }
    delete u.fleeUntil; delete u.fleeGoal;
    u.path = [];
  }
  // Walk command without work
  if (!u.job) {
    if (u.goal !== undefined) {
      if (!u.path.length) {
        const p = pathTo(sim, u, [u.goal]);
        if (!p || !p.length) { u.goal = undefined; return; }
        u.path = p;
      }
      moveSerf(sim, u);
      if (!u.path.length) u.goal = undefined;
    }
    return;
  }

  const t = sim.entities.get(u.job.target);
  if (!jobValid(sim, u, t)) { findNextJob(sim, u, u.job); return; }
  if (u.job.kind === 'fight') { fight(sim, u, t); return; }

  const r = rectOf(t);
  const m = sim.map;
  // Own spot: still walkable and directly at the target? Otherwise choose a new one (tile built over or similar).
  // Without a spot (emergency mode below) only search again now and then and not in the middle of the path.
  const spotOk = u.spot >= 0 && m.walkable(u.spot % m.width, (u.spot / m.width) | 0) && onRing(m, u.spot, r);
  if (!spotOk && (u.spot >= 0 || (!u.path.length && (sim.tick + u.id) % 10 === 0))) {
    u.spot = pickSpot(sim, u, m.ring(r.x, r.y, r.w, r.h));
    u.path = [];
  }
  if (u.spot >= 0) {
    if (!u.path.length) {
      if (m.idx(toTile(u.px), toTile(u.py)) === u.spot) { doWork(sim, u, t); return; }
      const p = pathTo(sim, u, [u.spot]);
      if (!p) { clearJob(sim, u); return; }
      if (!p.length) { doWork(sim, u, t); return; }
      u.path = p;
    }
    moveSerf(sim, u);
    return;
  }

  // No spot free all around any more (very rare, e.g. built up): as before at any neighbouring tile
  if (isAdjacent(u, r) && !u.path.length) { doWork(sim, u, t); return; }

  if (!u.path.length) {
    const p = pathTo(sim, u, sim.map.ring(r.x, r.y, r.w, r.h));
    if (p === null) { clearJob(sim, u); return; }
    if (!p.length) { doWork(sim, u, t); return; }
    u.path = p;
  }
  moveSerf(sim, u);
}
