// AI opponent: handling of the add-on content (src/sim/systems/addon.js).
// Like AiPlayer only commands, deterministic and no cheating under the fog:
//   - Tavern, gunsmith, bridge and ornamental buildings are in the build plan (ADDON_PLAN).
//   - Scouts explore waypoints in turn, look for deposits there and, when attacking, throw
//     torches at the (known) enemy castle; after a theft one guards the own castle.
//   - Thieves (normal/hard) steal from the last seen enemy castle; hard additionally blows up
//     a known enemy tower when attacking. Unknown targets are explored first.
//   - Defence: if the AI is robbed, it builds a guard tower at the castle (towers detect thieves);
//     the army attacks visible enemy specialists near the castle (AiPlayer.scan).

import { SPECIALISTS } from '../sim/data/addon.js';
import { checkRecruitSpecial } from '../sim/systems/addon.js';
import { knownBuildings, canSee } from '../sim/systems/vision.js';
import { UNIT } from '../sim/fixed.js';

/** Additional build goals with the add-on: [building, count, after which entry of the base plan]. */
export const ADDON_PLAN_INSERTS = [
  ['tavern', 1, 'storehouse'],
  ['fountain', 1, 'tower'],
  ['bridge', 1, 'archery'],
  ['gunsmith', 1, 'foundry'],
  ['statue', 1, 'clock'],
];

/** Add-on buildings in the build plan (only after the first barracks, so wood is not missing for the army). */
export const ADDON_PLAN_TYPES = new Set(ADDON_PLAN_INSERTS.map(([t]) => t));

/** Build plan with the add-on. @param {Array<[string, number]>} base */
export function addonPlan(base) {
  const out = [];
  for (const entry of base) {
    out.push(entry);
    for (const [type, n, after] of ADDON_PLAN_INSERTS) if (after === entry[0] && entry[1] === 1) out.push([type, n]);
  }
  return out;
}

/** Specialists per difficulty level. */
const WANT = { easy: { scout: 1, thief: 0 }, normal: { scout: 1, thief: 1 }, hard: { scout: 1, thief: 2 } };

/**
 * Recruit and lead specialists. Called from AiPlayer.military() (only with sim.addon).
 * @param {import('./AiPlayer.js').AiPlayer} ai
 */
export function addonMilitary(ai) {
  const sim = ai.sim;
  if (!sim.addon) return;
  const mine = [...sim.entities.values()].filter((e) => e.kind === 'specialist' && e.owner === ai.player);
  recruitSpecialists(ai, mine);
  const scouts = mine.filter((e) => e.spec === 'scout');
  const thieves = mine.filter((e) => e.spec === 'thief');
  scouts.forEach((s, i) => commandScout(ai, s, i));
  thieves.forEach((t, i) => commandThief(ai, t, i));
  // Forget orders of fallen thieves (otherwise the AI state grows in the save game)
  if (ai.thiefOrders) for (const id of Object.keys(ai.thiefOrders)) if (!sim.entities.has(Number(id))) delete ai.thiefOrders[id];
}

function recruitSpecialists(ai, mine) {
  const sim = ai.sim;
  const tavern = ai.buildings.find((b) => b.type === 'tavern' && b.done);
  // Population slots go to the army first
  if (!tavern || sim.popLimit(ai.player) - sim.popUsed(ai.player) < 12) return;
  const want = WANT[ai.difficulty] ?? WANT.normal;
  for (const spec of ['scout', 'thief']) {
    if (mine.filter((e) => e.spec === spec).length >= want[spec]) continue;
    if (!ai.affordable(SPECIALISTS[spec].cost, 1.5)) continue;
    if (checkRecruitSpecial(sim, ai.player, tavern, spec)) continue;
    ai.issue({ type: 'recruitSpecial', building: tavern.id, spec });
    return;
  }
}

/** Waypoints for exploring: map centre, towards the enemy, own surroundings (reachable tiles only). */
function waypoints(ai) {
  const sim = ai.sim, m = sim.map, h = ai.home, mid = m.width >> 1;
  const enemy = ai.enemyHome(true);
  const pts = [{ x: mid, y: mid }];
  if (enemy) pts.push({ x: Math.round((h.x + enemy.x) / 2), y: Math.round((h.y + enemy.y) / 2) }, { x: Math.round(h.x + (enemy.x - h.x) * 0.75), y: Math.round(h.y + (enemy.y - h.y) * 0.75) });
  pts.push({ x: Math.round((h.x + mid) / 2 + (h.y < mid ? 12 : -12)), y: Math.round((h.y + mid) / 2) }, { x: Math.round((h.x + mid) / 2), y: Math.round((h.y + mid) / 2 + (h.x < mid ? 12 : -12)) });
  return pts.map((p) => ai.reachPoint(p.x, p.y, 10)).filter(Boolean);
}

function commandScout(ai, s, i) {
  const sim = ai.sim, me = ai.me;
  const at = { x: s.px / UNIT, y: s.py / UNIT };
  const ready = (a) => (s.ready[a] ?? 0) <= sim.tick;
  // After a theft: the first scout guards the castle (detects thieves)
  if (i === 0 && (me.robbed ?? 0) > 0 && sim.tick - (ai.robbedAt ?? -99999) < 6000) {
    const guard = ai.reachPoint(ai.home.x, ai.home.y + 4, 6);
    if (guard && Math.hypot(at.x - guard.x, at.y - guard.y) > 4 && s.order.type === 'idle') ai.issue({ type: 'special', units: [s.id], action: 'move', x: guard.x, y: guard.y });
    return;
  }
  // Searching for resources costs nothing but the cooldown: also on the way with the army
  if (ai.armyState === 'attack' && ready('findResources') && sim.tick > 1200 && s.order.type === 'idle') {
    ai.issue({ type: 'special', units: [s.id], action: 'findResources' });
    return;
  }
  // Attack: follow the army and throw torches at the known enemy castle
  if (ai.armyState === 'attack') {
    const enemy = ai.enemyHome();
    if (enemy && ready('torch') && Math.hypot(at.x - enemy.x - 0.5, at.y - enemy.y - 0.5) * UNIT <= SPECIALISTS.scout.abilities.torch.range - 800) {
      ai.issue({ type: 'special', units: [s.id], action: 'torch', x: enemy.x, y: enemy.y });
      return;
    }
    const army = ai.leaders;
    if (army.length && s.order.type === 'idle') {
      const cx = Math.round(army.reduce((a, L) => a + L.px, 0) / army.length / UNIT), cy = Math.round(army.reduce((a, L) => a + L.py, 0) / army.length / UNIT);
      const p = ai.reachPoint(cx, cy, 6);
      if (p && Math.hypot(at.x - p.x, at.y - p.y) > 5) ai.issue({ type: 'special', units: [s.id], action: 'move', x: p.x, y: p.y });
    }
    return;
  }
  if (s.order.type !== 'idle') return;
  // At the waypoint: look for deposits, then on to the next
  if (ready('findResources') && sim.tick > 1200) { ai.issue({ type: 'special', units: [s.id], action: 'findResources' }); return; }
  const pts = waypoints(ai);
  if (!pts.length) return;
  ai.scoutLeg = ((ai.scoutLeg ?? i) + 1) % pts.length;
  const p = pts[(ai.scoutLeg + i) % pts.length];
  ai.issue({ type: 'special', units: [s.id], action: 'move', x: p.x, y: p.y });
}

/** Known enemy building of a type (last seen; without fog: the real building), reachable. */
function knownTarget(ai, types) {
  const sim = ai.sim;
  const known = knownBuildings(sim, ai.player);
  const list = known ? [...known.values()].filter((g) => g.kind === 'building')
    : [...sim.entities.values()].filter((e) => e.kind === 'building');
  let best = null, bd = Infinity;
  for (const g of list) {
    if (!types.includes(g.type) || !g.done || ai.badTargets?.has(g.id) || g.owner === ai.player || g.owner < 0 || sim.allied(ai.player, g.owner) || sim.players[g.owner]?.defeated) continue;
    if (!ai.reachableRect(g.x, g.y, g.w, g.h)) continue;
    const d = Math.hypot(g.x - ai.home.x, g.y - ai.home.y);
    if (d < bd) { bd = d; best = g; }
  }
  return best;
}

function commandThief(ai, t, i) {
  const sim = ai.sim;
  if (t.carry || t.order.type === 'steal' || t.order.type === 'sabotage' || t.order.type === 'deliver') return;
  // Last order failed at once (last seen target no longer exists or similar): remember the target and avoid it
  const last = ai.thiefOrders?.[t.id];
  if (last && last.tick < sim.tick && (t.ready[last.action] ?? 0) === last.ready) (ai.badTargets ??= new Set()).add(last.target);
  if (ai.thiefOrders) delete ai.thiefOrders[t.id];
  const order = (action, target) => {
    (ai.thiefOrders ??= {})[t.id] = { action, target: target.id, tick: sim.tick, ready: t.ready[action] ?? 0 };
    ai.issue({ type: 'special', units: [t.id], action, target: target.id });
  };
  const ready = (a) => (t.ready[a] ?? 0) <= sim.tick;
  if (ai.difficulty === 'easy') return;
  // Hard: blow up a known tower (otherwise the castle) when attacking
  if (ai.difficulty === 'hard' && ai.armyState === 'attack' && ready('sabotage')) {
    const target = knownTarget(ai, ['tower']) ?? knownTarget(ai, ['headquarters']);
    if (target) { order('sabotage', target); return; }
  }
  if (ready('steal') && sim.tick >= (ai.cfg.firstAttack >> 1)) {
    const target = knownTarget(ai, ['storehouse', 'headquarters']);
    if (target) { order('steal', target); return; }
    // Target unknown: explore towards the enemy start position
    const enemy = ai.enemyHome(true);
    if (enemy && t.order.type === 'idle') {
      const p = ai.reachPoint(enemy.x, enemy.y, 12);
      if (p) ai.issue({ type: 'special', units: [t.id], action: 'move', x: p.x, y: p.y });
    }
    return;
  }
  // otherwise go home (after a blast do not stay standing at the victim)
  const at = { x: t.px / UNIT, y: t.py / UNIT };
  if (t.order.type === 'idle' && Math.hypot(at.x - ai.home.x, at.y - ai.home.y) > 10) {
    const p = ai.reachPoint(ai.home.x + 3 + i, ai.home.y + 6, 6);
    if (p) ai.issue({ type: 'special', units: [t.id], action: 'move', x: p.x, y: p.y });
  }
}

/**
 * Was the AI robbed? Then wish for a guard tower near the castle (towers detect thieves).
 * @returns {boolean} tower at the castle urgently needed
 */
export function wantsGuardTower(ai) {
  const robbed = ai.me.robbed ?? 0;
  if (robbed > (ai.robbedSeen ?? 0)) { ai.robbedSeen = robbed; ai.robbedAt = ai.sim.tick; }
  if (!robbed) return false;
  const hq = ai.hq;
  if (!hq) return false;
  return !ai.buildings.some((b) => b.type === 'tower' && Math.abs(b.x - hq.x) < 12 && Math.abs(b.y - hq.y) < 12);
}

/** Visible enemy specialists (detected thieves, scouts) near the castle. */
export function visibleEnemySpecialist(ai, e) {
  return e.kind === 'specialist' && !e.hidden && canSee(ai.sim, ai.player, e);
}
