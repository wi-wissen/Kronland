// Track field from real walking for the bench: on a flat empty map, the serfs of a castle walk an L-shaped route
// (a straight stretch and a 90° bend) back and forth with move commands – like a player sends them – and the
// simulation lays the tracks (fading mode, summer). Shows that walking gives one path, not several strips.

import { createScenarioSim } from '../../src/sim/missions/runtime.js';

/**
 * @param {{ minutes?: number, size?: number }} [o]
 * @returns {{ W: number, H: number, tracks: Uint8Array, route: {x:number,y:number}[], walkers: number }}
 */
export function walkedField({ minutes = 5, size = 40 } = {}) {
  const sim = createScenarioSim({
    format: 'kronland-scenario', version: 2, id: 'tracks-walk', kind: 'mission', end: 'script',
    world: { base: 'flat', width: size, height: size, fog: false, starts: [{ x: 6, y: 6 }], places: {} },
    weatherCycle: [['summer', 1e9]],
    players: [{ kind: 'human', hero: null }],
    sections: [{ id: 'world', level: 'mission', code: 'pass\n' }],
  }, { tracks: 'fading' });
  const hq = sim.findBuilding(0, 'headquarters');
  // route: from the castle door east, then a 90° bend to the south
  const x0 = hq.x + hq.w + 1, y0 = hq.y + hq.h + 1;
  const route = [{ x: x0, y: y0 }, { x: x0 + 14, y: y0 }, { x: x0 + 14, y: y0 + 12 }];
  const serfs = [...sim.entities.values()].filter((e) => e.kind === 'unit' && e.owner === 0).map((e) => e.id);
  let leg = 0, dir = 1, wait = 0;
  for (let t = 0; t < minutes * 600; t++) {
    const goal = route[leg];
    const there = serfs.every((id) => {
      const e = sim.entities.get(id);
      return Math.abs(Math.floor(e.px / 1000) - goal.x) <= 1 && Math.abs(Math.floor(e.py / 1000) - goal.y) <= 1;
    });
    if (there || ++wait > 300) {
      leg += dir;
      if (leg >= route.length || leg < 0) { dir = -dir; leg += 2 * dir; }
      sim.command({ type: 'move', player: 0, units: serfs, x: route[leg].x, y: route[leg].y });
      wait = 0;
    }
    sim.step();
  }
  // only the tracks: castle and its door stay out of the picture (the bench map is empty)
  return { W: sim.map.width, H: sim.map.height, tracks: sim.map.tracks.slice(), route, walkers: serfs.length };
}
