// "Player" for mission tests: gives only the commands a human would give via the UI
// (no direct intervention in the state).

import { UNIT } from '../../src/sim/fixed.js';

export const P = 0;

export const serfs = (sim, owner = P) => [...sim.entities.values()].filter((e) => e.kind === 'unit' && e.owner === owner && !e.militia);
export const idle = (sim, owner = P) => serfs(sim, owner).filter((u) => !u.job && u.goal === undefined);
export const own = (sim, type, owner = P) => [...sim.entities.values()].filter((e) => e.kind === 'building' && e.owner === owner && e.type === type);
export const leaders = (sim, owner = P) => [...sim.entities.values()].filter((e) => e.kind === 'leader' && e.owner === owner);
export const hero = (sim, owner = P) => [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === owner);

/** Player command in the next tick; returns the events of this tick. */
export const act = (sim, cmd) => sim.step([{ player: P, ...cmd }]);

/** Place a building near the castle (or `near`) and build it with serfs. */
export function build(sim, type, n = 4, near = null) {
  const hq = sim.findBuilding(P, 'headquarters');
  const c = near ?? { x: hq.x + 2, y: hq.y + 2 };
  const pos = sim.findPlacement(P, type, c.x, c.y, 30);
  if (!pos) throw new Error(`no spot for ${type}: ${sim.checkPlacement(P, type, c.x, c.y)}`);
  const units = idle(sim).slice(0, n).map((u) => u.id);
  const ev = act(sim, { type: 'placeBuilding', building: type, x: pos.x, y: pos.y, units: units.length ? units : serfs(sim).slice(0, n).map((u) => u.id) });
  const placed = ev.find((e) => e.type === 'buildingPlaced');
  if (!placed) throw new Error(`Bau abgelehnt: ${JSON.stringify(ev.filter((e) => e.type === 'rejected'))}`);
  return placed.building;
}

/** Let free serfs chop wood. */
export function gatherWood(sim, k = 99) {
  const hq = sim.findBuilding(P, 'headquarters');
  const trees = [...sim.entities.values()].filter((e) => e.kind === 'tree')
    .sort((a, b) => ((a.x - hq.x) ** 2 + (a.y - hq.y) ** 2) - ((b.x - hq.x) ** 2 + (b.y - hq.y) ** 2) || a.id - b.id);
  idle(sim).slice(0, k).forEach((u, i) => sim.command({ player: P, type: 'assignWork', units: [u.id], target: trees[i % trees.length].id }));
}

/** Step until cond is met. */
export function until(sim, cond, max, every = null) {
  for (let i = 0; i < max; i++) {
    if (every && i % 50 === 0) every(sim);
    sim.step();
    if (cond(sim)) return true;
  }
  return false;
}

/** Let troops attack a point (tile). */
export function attackMove(sim, ids, p) {
  sim.command({ player: P, type: 'order', units: ids, order: 'attackMove', x: p.x, y: p.y });
}

export const tileOf = (e) => ({ x: Math.floor(e.px / UNIT), y: Math.floor(e.py / UNIT) });

export const objective = (sim, id) => sim.mission.state.objectives.find((o) => o.id === id);
export const stepId = (sim) => sim.mission.currentStep()?.id ?? null;
