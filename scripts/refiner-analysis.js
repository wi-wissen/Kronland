// Production per refiner and minute depending on motivation and house/farm –
// same measurement setup as the well-known refiner analysis of the model game (docs/SPIELREGELN.md §4).
// `node scripts/refiner-analysis.js [minutes] [motivations…]`
import { Sim } from '../src/sim/sim.js';
import { TECHS } from '../src/sim/data/technologies.js';
import { BUILDING_TECHS } from '../src/sim/data/buildingTechs.js';

const argv = process.argv.slice(2);
const minutes = Number(argv[0] ?? 10);
const levels = argv.length > 1 ? argv.slice(1).map(Number) : [300, 250, 200, 150, 120, 100, 80, 60, 50, 40, 30];
const JOBS = [['bank', 'gold'], ['smithy', 'iron'], ['alchemist', 'sulfur'], ['brickworks', 'clay'], ['stonemason', 'stone'], ['sawmill', 'wood']];
const SETUPS = { 'House and farm': ['residence', 'farm'], 'House only': ['residence'], 'Farm only': ['farm'], 'Neither': [] };

function build(sim, type, near) {
  const pl = sim.players[0];
  pl.techs = new Set([...Object.keys(TECHS), ...Object.keys(BUILDING_TECHS)]);
  const pos = sim.findPlacement(0, type, near.x, near.y, 30);
  if (!pos) throw new Error('No spot for ' + type);
  return sim.createBuilding(0, type, pos.x, pos.y, true);
}

/** Output per worker and minute (in tenths, rounded to integers). */
export function measure(job, res, housing, motivation, mins = minutes) {
  const sim = new Sim({ seed: 7 });
  const hq = sim.findBuilding(0, 'headquarters');
  const near = { x: hq.x + 6, y: hq.y + 2 };
  const wp = build(sim, job, near);
  for (const h of housing) build(sim, h, near);
  const p = sim.players[0];
  p.taxLevel = 2;
  sim.run(300); // move-in
  for (const r of Object.keys(p.raw)) p.raw[r] = 100000;
  const n = wp.workers.length;
  const start = p.stock[res];
  for (let t = 0; t < mins * 600; t++) {
    for (const id of wp.workers) sim.entities.get(id).motivation = motivation;
    sim.step();
  }
  return Math.round(((p.stock[res] - start) * 10) / (n * mins)) / 10;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [name, housing] of Object.entries(SETUPS)) {
    console.log(`\n${name}\nMotivation\t${JOBS.map(([, r]) => r).join('\t')}`);
    for (const m of levels) console.log(`${m}\t\t${JOBS.map(([j, r]) => measure(j, r, housing, m)).join('\t')}`);
  }
}
