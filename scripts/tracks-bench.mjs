// Test bench for the look of tracks: five shapes × three strengths (scripts/tracks-bench/cases.js) on a flat empty map,
// each cell photographed with the same game camera in summer and in winter, plus a contact sheet per season.
// Needs a running dev server: `npm run dev -- --port 4361`, then
//   node scripts/tracks-bench.mjs [outDir] [port] [quality]
// Browser: PW_CHROMIUM=/path/to/chrome if the Playwright version does not match the installed one.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { BENCH_CASES, BENCH_STRENGTHS, BENCH_CELL, benchField } from './tracks-bench/cases.js';
import { walkedField } from './tracks-bench/walked.js';

const out = process.argv[2] ?? 'test-results/tracks-bench';
const port = Number(process.argv[3] ?? 4361);
const quality = process.argv[4] ?? 'medium';
mkdirSync(out, { recursive: true });

const gl = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args: gl, ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.addInitScript((q) => { localStorage.setItem('kronland.quality', q); }, quality);
await page.goto(`http://localhost:${port}/play/?seed=1&fog=off&no-models`, { timeout: 180_000, waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__kronland?.renderer, null, { timeout: 180_000, waitUntil: 'domcontentloaded' });
// Only the 3D picture: everything else invisible
await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }' });

const field = benchField();
const levels = Object.keys(BENCH_STRENGTHS);

/** New flat world with the bench field, in the given weather (mode "permanent": nothing fades or melts away). */
async function setup(weather, field) {
  await page.evaluate(async ([f, weather]) => {
    const { createScenarioSim } = await import('/src/sim/missions/runtime.js');
    const e = window.__kronland;
    e.paused = true;
    const sim = createScenarioSim({
      format: 'kronland-scenario', version: 2, id: 'tracks-bench', kind: 'mission', end: 'script',
      world: { base: 'flat', width: f.W, height: f.H, fog: false, starts: [{ x: 0, y: 0 }], places: {}, tracks: { mode: 'permanent' } },
      weatherCycle: [[weather, 1e9]],
      players: [{ kind: 'human', hero: 'nelia', hq: false }],
      sections: [{ id: 'world', level: 'mission', code: 'pass\n' }],
    });
    sim.map.tracks.set(f.tracks);
    sim.map.groundVersion++;
    for (const h of sim.entities.values()) if (h.kind === 'hero') { h.px = 500; h.py = (f.H - 1) * 1000 + 500; }
    e.restart(sim);
    e.renderer.tracks.revealAll();
    // running (a paused game is drawn desaturated); nothing moves on this map
    e.paused = false;
  }, [{ W: field.W, H: field.H, tracks: [...field.tracks] }, weather]);
}

async function shoot(cell, file, dist = 13) {
  await page.evaluate(([x, z, d]) => {
    const r = window.__kronland.renderer.rig;
    r.lookAt(x, z); r.dist = d; r.yaw = 0; r.clamp();
  }, [cell.x + BENCH_CELL / 2, cell.y + BENCH_CELL / 2, dist]);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: file, timeout: 300_000 });
}

for (const weather of ['summer', 'winter']) {
  await setup(weather, field);
  await page.waitForTimeout(3000);
  for (const cell of field.cells) {
    const file = `${out}/${weather}-${cell.shape}-${cell.level}.png`;
    await shoot(cell, file);
    console.log(file);
  }
}
// Real walking: the castle's serfs walk an L-shaped route back and forth (the field the simulation laid down)
const walked = walkedField();
const [, corner] = walked.route;
for (const weather of ['summer', 'winter']) {
  await setup(weather, walked);
  await page.waitForTimeout(3000);
  const file = `${out}/${weather}-walked.png`;
  await shoot({ x: corner.x - 8 - BENCH_CELL / 2, y: corner.y + 3 - BENCH_CELL / 2 }, file, 18);
  console.log(file, `(${walked.walkers} serfs)`);
}
await browser.close();
console.log(`${BENCH_CASES.length} shapes × ${levels.length} strengths × 2 seasons in ${out}`);
