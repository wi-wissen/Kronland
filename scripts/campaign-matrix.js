#!/usr/bin/env node
// Campaign matrix: plays every mission with the test bot (tests/sim/missionBot.js) on several
// maps headless and prints a table (victory, duration, objective times, army, losses).
// Also control runs with a passive bot (economy only) that must lose missions 5 and 6.
//
//   node scripts/campaign-matrix.js                 # all missions, 4 maps, plus control runs
//   node scripts/campaign-matrix.js c3 c4           # only these missions
//   node scripts/campaign-matrix.js --seeds=7,99    # other maps (default: mission seed, 7, 99, 31337)
//   node scripts/campaign-matrix.js --no-passive    # without control runs
//   node scripts/campaign-matrix.js --json          # raw data (incl. resource curves) as JSON
//
// Runs in parallel in worker threads (as many as processor cores).

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';

const MISSIONS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
const PASSIVE_MUST_LOSE = ['c5', 'c6']; // c5: does not win (timeout counts), c6: castle falls

if (!isMainThread) {
  const { playMission } = await import('../tests/sim/missionBot.js');
  const { id, seed, passive } = workerData;
  const t0 = Date.now();
  const { report } = playMission(id, seed ?? undefined, { passive });
  parentPort.postMessage({ ...report, ms: Date.now() - t0 });
} else {
  const args = process.argv.slice(2);
  const flag = (name) => args.find((a) => a.startsWith(`--${name}`));
  const ids = args.filter((a) => !a.startsWith('--'));
  const missions = ids.length ? ids : MISSIONS;
  const seedArg = flag('seeds')?.split('=')[1];
  const seeds = seedArg ? seedArg.split(',').map(Number) : [null, 7, 99, 31337];
  const jobs = [];
  for (const id of missions) for (const seed of seeds) jobs.push({ id, seed, passive: false });
  if (!flag('no-passive')) for (const id of missions.filter((m) => PASSIVE_MUST_LOSE.includes(m))) for (const seed of seeds.slice(0, 2)) jobs.push({ id, seed, passive: true });

  const { TIME_LIMITS } = await import('../tests/sim/missionBot.js');
  const results = new Array(jobs.length);
  let next = 0;
  const run = () => new Promise((resolve) => {
    const step = () => {
      if (next >= jobs.length) return resolve();
      const i = next++;
      const w = new Worker(new URL(import.meta.url), { workerData: jobs[i] });
      w.once('message', (r) => { results[i] = r; });
      w.once('error', (e) => { results[i] = { ...jobs[i], error: String(e?.stack ?? e) }; });
      w.once('exit', () => { process.stderr.write('.'); step(); });
    };
    step();
  });
  const t0 = Date.now();
  await Promise.all(Array.from({ length: Math.max(1, Math.min(os.availableParallelism?.() ?? os.cpus().length, jobs.length)) }, run));
  process.stderr.write('\n');

  if (flag('json')) {
    console.log(JSON.stringify(results, null, 1));
  } else {
    const pad = (s, n) => String(s).padEnd(n);
    console.log(pad('Mission', 8) + pad('Seed', 7) + pad('Bot', 8) + pad('Result', 27) + pad('Time', 8) + pad('Limit', 7) + pad('Army', 6) + pad('Losses (C/S/W/B)', 21) + 'Objectives (minute)');
    let bad = 0;
    for (const r of results) {
      if (r.error) { console.log(`${r.id} ${r.seed}: ERROR ${r.error}`); bad++; continue; }
      const limit = TIME_LIMITS[r.id];
      const ok = r.passive ? (PASSIVE_MUST_LOSE.includes(r.id) ? !r.won : true) : r.won && r.minutes <= limit;
      if (!ok) bad++;
      const res = `${r.won ? 'Victory' : 'Defeat'}${r.won ? '' : ` (${r.reason})`}`;
      const l = r.losses;
      const objs = Object.entries(r.objectives).map(([k, v]) => `${k}:${v.status === 'done' ? v.min : v.status === 'failed' ? `✗${v.min ?? ''}` : '–'}`).join(' ');
      console.log(pad(r.id, 8) + pad(r.seed, 7) + pad(r.passive ? 'passive' : 'active', 8) + pad(res + (ok ? '' : ' !!'), 27) + pad(`${r.minutes}m`, 8) + pad(r.passive ? '' : `${limit}m`, 7)
        + pad(r.maxArmy, 6) + pad(`${l.leaders}/${l.soldiers}/${l.serfs + l.workers}/${l.buildings}`, 21) + objs + (r.warnings.length ? `  WARN ${r.warnings.join('; ')}` : ''));
    }
    console.log(`\n${results.length} runs in ${((Date.now() - t0) / 1000).toFixed(0)} s, ${bad ? `${bad} outside the targets` : 'all within the targets'}.`);
    console.log('Losses: C = captains, S = soldiers, W = serfs + workers, B = buildings. The active bot must win within the time limit, the passive bot must lose c5/c6.');
    process.exitCode = bad ? 1 : 0;
  }
}
