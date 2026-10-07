// Preview of the moving parts of a building model (cut out per src/render/movingParts.js) via tools/moving-parts.html.
//
//   node scripts/asset-gen/moving-parts.mjs out.png windwheel [--p '<JSON parts>'] [--turn 0.6] [--c x,y,z --zoom 3 --az 0.67] [--show part|rest]
//
// Shows front, side and top view with a model-unit grid (to read pivot, radius and span) and a perspective view
// with the parts turned. Starts a Vite server (port 4391 or PREVIEW_PORT) and takes a screenshot with Playwright.

import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs';
import { ROOT } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
const p = opt('--p'), turn = opt('--turn'), c = opt('--c'), zoom = opt('--zoom'), az = opt('--az'), show = opt('--show');
const [out, model] = args;
if (!out || !model) {
  console.error('usage: node scripts/asset-gen/moving-parts.mjs out.png <model> [--p <JSON>] [--turn <rad>] [--c x,y,z] [--zoom <n>]');
  process.exit(1);
}
const port = Number(process.env.PREVIEW_PORT || 4391);
const server = await createServer({ root: ROOT, server: { port, strictPort: false }, logLevel: 'error' });
await server.listen();
const exe = process.env.PW_CHROMIUM ?? (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
  const qs = new URLSearchParams({ f: `/models/buildings/${model}.glb`, ...(p ? { p } : {}), ...(turn ? { turn } : {}), ...(c ? { c } : {}), ...(zoom ? { zoom } : {}), ...(az ? { az } : {}), ...(show ? { show } : {}) });
  page.on('pageerror', (e) => console.error(e.message));
  await page.goto(`${server.resolvedUrls.local[0]}tools/moving-parts.html?${qs}`);
  await page.waitForFunction(() => document.title === 'ready', null, { timeout: 120000 });
  console.log((await page.evaluate(() => window.__info)).join('\n'));
  await page.screenshot({ path: out });
} finally {
  await browser.close();
  await server.close();
}
