#!/usr/bin/env node
// Endurance run of a mission without graphics (default: bustle), as in the game with all AI opponents.
// Measures per game minute the compute time per tick (mean/maximum, AI separately), counts characters and reports
// exceptions; also once per minute the cost of a save game (saveGame + JSON).
//
//   node scripts/stress-run.js [mission] [minutes] [--seed=N] [--no-save] [--build=S]
//   --build=S: the human player (0) places a building near the castle every S game seconds and sends
//              serfs there (like a player who keeps expanding during the battles)
import { createMissionSim } from '../src/sim/missions/runtime.js';
import { TileMap } from '../src/sim/map.js';
import { saveGame } from '../src/sim/serialize.js';
import { performance } from 'node:perf_hooks';

const args = process.argv.slice(2);
const pos = args.filter((a) => !a.startsWith('--'));
const flag = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const id = pos[0] ?? 'bustle';
const minutes = Number(pos[1] ?? 15);
const seed = flag('seed') ? Number(flag('seed')) : undefined;
const withSave = !args.includes('--no-save');
const buildEvery = flag('build') ? Number(flag('build')) * 10 : 0;

// count and time the region computation (TileMap.regionAt)
let regionCalls = 0, regionMs = 0;
const compute = TileMap.prototype.computeRegions;
TileMap.prototype.computeRegions = function (...a) { const t = performance.now(); const r = compute.apply(this, a); regionMs += performance.now() - t; regionCalls++; return r; };
const BUILD_TYPES = ['residence', 'farm', 'sawmill', 'brickworks', 'storehouse', 'tower', 'stonemason', 'residence', 'farm'];
let built = 0, buildRejected = 0;
function playerBuilds(sim) {
  const hq = sim.findBuilding(0, 'headquarters');
  if (!hq) return;
  const type = BUILD_TYPES[built % BUILD_TYPES.length];
  const at = sim.findPlacement(0, type, hq.x + (hq.w >> 1), hq.y + (hq.h >> 1), 45);
  if (!at) { buildRejected++; built++; return; }
  const serfs = [...sim.entities.values()].filter((e) => e.kind === 'unit' && e.owner === 0 && !e.militia).slice(0, 4).map((e) => e.id);
  if (sim.applyCommand({ type: 'placeBuilding', player: 0, building: type, x: at.x, y: at.y, units: serfs })) built++;
  else buildRejected++;
}

const t0 = performance.now();
const sim = createMissionSim(id, { seed });
// AI opponents run inside sim.step (src/ai/runner.js); sim.clock lets it measure their share in sim.aiMs
sim.clock = () => performance.now();
console.log(`Setup ${(performance.now() - t0).toFixed(0)} ms, ${sim.entities.size} entities`);

let errors = 0;
let win = { n: 0, sum: 0, max: 0, ai: 0, aiMax: 0 };
const kinds = () => { const c = {}; for (const e of sim.entities.values()) c[e.kind] = (c[e.kind] ?? 0) + 1; return c; };
for (let t = 1; t <= minutes * 600; t++) {
  const a = performance.now();
  if (buildEvery && t % buildEvery === 0) playerBuilds(sim);
  sim.aiMs = 0;
  try {
    for (const e of sim.step([])) if (e.type === 'aiError' && errors++ < 10) console.error(`Tick ${sim.tick} AI ${e.player}:`, e.message);
  } catch (e) { if (errors++ < 10) console.error(`Tick ${sim.tick} sim:`, e); }
  const ms = performance.now() - a, aiMs = sim.aiMs ?? 0;
  if (ms > 500) console.log(`  long tick ${sim.tick}: ${ms.toFixed(0)} ms`);
  win.n++; win.sum += ms; win.max = Math.max(win.max, ms); win.ai += aiMs; win.aiMax = Math.max(win.aiMax, aiMs);
  if (t % 600 === 0) {
    let save = '';
    if (withSave) {
      const s0 = performance.now(); const st = saveGame(sim); const s1 = performance.now(); const txt = JSON.stringify(st); const s2 = performance.now();
      save = ` | save clone ${(s1 - s0).toFixed(0)} ms JSON ${(s2 - s1).toFixed(0)} ms ${(txt.length / 1048576).toFixed(1)} MB`;
    }
    const k = kinds();
    const mem = process.memoryUsage().heapUsed / 1048576;
    console.log(`${String(t / 600).padStart(3)} min  tick Ø ${(win.sum / win.n).toFixed(1)} ms max ${win.max.toFixed(0)} ms (AI Ø ${(win.ai / win.n).toFixed(1)} max ${win.aiMax.toFixed(0)})  `
      + `Ent ${sim.entities.size} [Wrk ${k.worker ?? 0} Ser ${k.unit ?? 0} Cpt ${k.leader ?? 0} Sol ${k.soldier ?? 0} Bld ${k.building ?? 0}]  Heap ${mem.toFixed(0)} MB  regions ${regionCalls}× ${regionMs.toFixed(0)} ms${buildEvery ? `  built ${built - buildRejected}/${built}` : ''}${save}`);
    regionCalls = 0; regionMs = 0;
    win = { n: 0, sum: 0, max: 0, ai: 0, aiMax: 0 };
  }
}
console.log(`Done: ${((performance.now() - t0) / 1000).toFixed(0)} s, exceptions ${errors}`);
