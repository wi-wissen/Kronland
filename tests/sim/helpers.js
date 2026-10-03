import { Sim } from '../../src/sim/sim.js';

export const newSim = (seed = 42) => new Sim({ seed });

export const serfsOf = (sim, owner = 0) =>
  [...sim.entities.values()].filter((e) => e.kind === 'unit' && e.type === 'serf' && e.owner === owner);

export const hqOf = (sim, owner = 0) => sim.findBuilding(owner, 'headquarters');

/** Nearest node (tree/pile) to a point. */
export function nearestNode(sim, kind, res, x, y) {
  let best = null, bestD = Infinity;
  for (const e of sim.entities.values()) {
    if (e.kind !== kind || (res && e.res !== res)) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bestD) { best = e; bestD = d; }
  }
  return best;
}

/** Steps until the condition is met. @returns {number} ticks needed, -1 on timeout */
export function runUntil(sim, cond, maxTicks) {
  for (let i = 0; i < maxTicks; i++) {
    sim.step();
    if (cond(sim)) return i + 1;
  }
  return -1;
}

/** Places a building near the castle and returns the ID. */
export function placeNearHq(sim, type, owner = 0, units = []) {
  const hq = hqOf(sim, owner);
  const pos = sim.findPlacement(owner, type, hq.x + 2, hq.y + 2);
  if (!pos) throw new Error('No building site for ' + type);
  const events = sim.step([{ type: 'placeBuilding', player: owner, building: type, x: pos.x, y: pos.y, units }]);
  const ev = events.find((e) => e.type === 'buildingPlaced');
  if (!ev) throw new Error('Bau abgelehnt: ' + JSON.stringify(events));
  return ev.building;
}
