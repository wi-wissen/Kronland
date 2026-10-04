// Serfs: walk, build, repair, chop wood, mine resource piles, look for follow-up work.

import { moveAlong, pathTo, isAdjacent } from './movement.js';
import { BALANCE } from '../data/balance.js';
import { toTile } from '../fixed.js';
import { techBonus, boosted, buildingMaxHp } from './techs.js';
import { DAMAGE, isDamaged } from './damage.js';

const S = BALANCE.serf;

/** Area of a target (building or 1×1 node). */
function rectOf(t) {
  return t.kind === 'building' ? { x: t.x, y: t.y, w: t.w, h: t.h } : { x: t.x, y: t.y, w: 1, h: 1 };
}

/** Is the target still valid work for this serf? */
function jobValid(sim, u, t) {
  if (!t) return false;
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
  u.timer = 0;
  u.path = [];
}

/** Arbeit zuweisen. @returns {boolean} */
export function assignJob(sim, u, t) {
  if (t.kind === 'building') {
    if (t.owner !== u.owner) return false;
    // Finished buildings: repair, if damaged
    if (t.done && !isDamaged(sim, t)) return false;
    if (t.builders.includes(u.id)) return true;
    if (t.builders.length >= S.maxBuildersPerSite) return false;
    clearJob(sim, u);
    t.builders.push(u.id);
    u.job = { kind: t.done ? 'repair' : 'build', target: t.id };
  } else if (t.kind === 'tree' || t.kind === 'pile') {
    if (t.amount <= 0) return false;
    clearJob(sim, u);
    u.job = { kind: 'gather', target: t.id, res: t.res };
  } else return false;
  u.goal = undefined;
  return true;
}

/** Find the nearest work of the same kind in the surroundings. */
function findNextJob(sim, u, prev) {
  const tx = toTile(u.px), ty = toTile(u.py);
  const r2 = S.searchRadius * S.searchRadius;
  let best = null, bestD = Infinity;
  for (const e of sim.entities.values()) {
    let fits = false;
    if (prev.kind === 'build') fits = e.kind === 'building' && !e.done && e.owner === u.owner && e.builders.length < S.maxBuildersPerSite;
    else if (prev.kind === 'repair') fits = e.kind === 'building' && e.owner === u.owner && isDamaged(sim, e) && e.builders.length < S.maxBuildersPerSite;
    else fits = (e.kind === 'tree' || e.kind === 'pile') && e.res === prev.res && e.amount > 0;
    if (!fits) continue;
    const r = rectOf(e);
    const cx = r.x + (r.w >> 1), cy = r.y + (r.h >> 1);
    const d = (cx - tx) ** 2 + (cy - ty) ** 2;
    if (d <= r2 && d < bestD) { best = e; bestD = d; }
  }
  if (best && assignJob(sim, u, best)) return true;
  clearJob(sim, u);
  return false;
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

/** Tick of a serf. */
export function updateSerf(sim, u) {
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

  const r = rectOf(t);
  if (isAdjacent(u, r) && !u.path.length) { doWork(sim, u, t); return; }

  if (!u.path.length) {
    const p = pathTo(sim, u, sim.map.ring(r.x, r.y, r.w, r.h));
    if (p === null) { clearJob(sim, u); return; }
    if (!p.length) { doWork(sim, u, t); return; }
    u.path = p;
  }
  moveSerf(sim, u);
}
