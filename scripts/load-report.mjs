// Load report: how much data does the game really load? Starts the production build (vite preview), opens
// scenarios in Chromium and counts every response by kind (code, characters, buildings, textures, audio …) – on the first
// visit (empty cache) and the second (service worker and cache). Result as a Markdown table, values in
// docs/PERFORMANCE.md (German; the table labels below are German on purpose).
//
//   npm run build && node scripts/load-report.mjs                 # all scenarios
//   node scripts/load-report.mjs game phone                      # only these
//   node scripts/load-report.mjs --port 4311 --json report.json   # other port, raw data as JSON
//   node scripts/load-report.mjs --from-json report.json          # tables from a saved measurement
//
// Needs Playwright; if the version does not match the preinstalled browser: PW_CHROMIUM=/opt/pw-browsers/chromium.

import { chromium, devices } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const PORT = Number(opt('--port', process.env.E2E_PORT || 4311));
const JSON_OUT = opt('--json', null);
const LIST = args.includes('--list') && !!args.splice(args.indexOf('--list'), 1);
const BASE = `http://localhost:${PORT}`;

/** Scenarios: URL, device, wait after the first frame (loading workers, music …). */
export const SCENARIOS = {
  menu: { label: 'Startmenü (Spiel noch nicht begonnen)', url: '/play/', menu: true },
  game: { label: 'Freies Spiel, 2 Spieler, Desktop „hoch“', url: '/play/?seed=42&quality=high' },
  phone: { label: 'Freies Spiel, 2 Spieler, Handy „niedrig“', url: '/play/?seed=42&quality=low', device: 'Pixel 7' },
  four: { label: 'Freies Spiel, 4 Spieler, Desktop „hoch“', url: '/play/?seed=42&players=4&quality=high' },
  c1: { label: 'Kampagne Mission 1', url: '/play/?mission=c1&quality=high' },
  showcase: { label: 'Schaukasten (alles einmal)', url: '/play/?mission=showcase&quality=high' },
  bustle: { label: 'Belastungsprobe Gewimmel', url: '/play/?mission=bustle&quality=high' },
};

/** Kind of a file by its path. */
export function category(path) {
  if (/\/models\/characters\//.test(path)) return /\.lod\d\.[0-9a-f]+\.glb$|\.lod\d\.glb$/.test(path) ? 'Figuren (Spielmodell)' : /\.json$/.test(path) ? 'Figuren-Manifest' : 'Figuren (Nahmodell)';
  if (/\/models\/buildings\/(tree_|bush)/.test(path)) return 'Bäume, Büsche';
  if (/\/models\//.test(path)) return 'Gebäude, Felsen';
  if (/\/textures\//.test(path)) return 'Texturen';
  if (/\/audio\/music\//.test(path)) return 'Musik';
  if (/\/audio\/voice\//.test(path)) return 'Stimmen';
  if (/\/audio\//.test(path)) return 'Effekte';
  if (/\/(icons|portraits|art)\//.test(path)) return 'Oberflächenbilder';
  if (/\.(js|css|html|webmanifest)$|\/$/.test(path)) return 'Code, Seiten';
  return 'Sonstiges';
}

const gl = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];

async function serverUp() {
  try { return (await fetch(BASE + '/play/')).ok; } catch { return false; }
}

async function ensureServer() {
  if (await serverUp()) return null;
  if (!existsSync('dist/play/index.html')) throw new Error('No build: run npm run build first');
  const p = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 500));
  return p;
}

/** Load a page and count all responses; returns bytes per kind (network) and count from the service worker. */
async function visit(context, sc) {
  const page = await context.newPage();
  const rows = [];
  page.on('requestfinished', async (req) => {
    const res = await req.response();
    if (!res) return;
    const url = new URL(req.url());
    if (url.protocol === 'blob:' || url.origin !== BASE) return; // blob: images embedded in the model
    // size from the build (also valid for responses from the cache, whose transfer is 0)
    const file = 'dist' + decodeURIComponent(url.pathname) + (url.pathname.endsWith('/') ? 'index.html' : '');
    let bytes = existsSync(file) ? statSync(file).size : 0;
    if (!bytes) try { bytes = Math.max(0, (await req.sizes()).responseBodySize); } catch { /* aborted */ }
    rows.push({ path: url.pathname, bytes, sw: res.fromServiceWorker(), status: res.status() });
  });
  const t0 = Date.now();
  await page.goto(BASE + sc.url);
  if (sc.menu) await page.waitForTimeout(4000);
  else {
    await page.waitForFunction(() => window.__kronland?.renderer?.frameNo > 2, null, { timeout: 240_000 });
    // models loaded later (workers, troops, winter) and audio
    await page.waitForTimeout(8000);
  }
  const seconds = (Date.now() - t0) / 1000;
  await page.close();
  return { rows, seconds };
}

function summarize(rows) {
  const by = {};
  for (const r of rows) {
    const c = category(r.path);
    const e = (by[c] ??= { files: 0, net: 0, sw: 0 });
    e.files++;
    if (r.sw) e.sw += r.bytes; else e.net += r.bytes;
  }
  return by;
}

const mb = (b) => (b / 1e6).toFixed(b < 1e5 ? 2 : 1);

async function main() {
  // print the tables from an earlier measurement again: --from-json report.json
  const from = opt('--from-json', null);
  if (from) { for (const [n, r] of Object.entries(JSON.parse(readFileSync(from, 'utf8')))) print(n, r); return; }
  const names = args.length ? args : Object.keys(SCENARIOS);
  const server = await ensureServer();
  const browser = await chromium.launch({ args: gl, ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}) });
  const out = {};
  try {
    for (const name of names) {
      const sc = SCENARIOS[name];
      if (!sc) { console.error(`unknown scenario ${name}`); continue; }
      const dev = sc.device ? devices[sc.device] : { viewport: { width: 1440, height: 900 } };
      const context = await browser.newContext({ ...dev });
      await context.addInitScript(() => { localStorage.setItem('kronland-lang', 'de'); });
      const cold = await visit(context, sc);
      // service worker fully installed (precache filled), then second visit
      const page = await context.newPage();
      await page.goto(BASE + '/play/');
      await page.evaluate(() => navigator.serviceWorker?.ready.then(() => true));
      await page.close();
      const warm = await visit(context, sc);
      // third visit: now everything from the first game is in the runtime cache too
      const third = await visit(context, sc);
      await context.close();
      if (LIST) for (const r of cold.rows) console.log(category(r.path).padEnd(24), String(r.bytes).padStart(9), r.path);
      out[name] = { label: sc.label, cold: summarize(cold.rows), warm: summarize(warm.rows), third: summarize(third.rows), seconds: [cold.seconds, warm.seconds, third.seconds] };
      print(name, out[name]);
    }
  } finally {
    await browser.close();
    server?.kill();
  }
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(out, null, 2));
}

function print(name, r) {
  const cats = [...new Set([...Object.keys(r.cold), ...Object.keys(r.third)])].sort();
  const sum = (o, k) => Object.values(o).reduce((s, e) => s + (typeof k === 'function' ? k(e) : e[k]), 0);
  // 1st visit: cache empty – everything comes from the network, also what already runs through the freshly active service worker
  const all = (e) => (e?.net ?? 0) + (e?.sw ?? 0);
  console.log(`\n### ${r.label} (\`${name}\`)\n`);
  console.log('| Art | Dateien | 1. Besuch | 2. Besuch: Netz | 3. Besuch: Netz / Cache |');
  console.log('|---|--:|--:|--:|--:|');
  for (const c of cats) {
    const a = r.cold[c], b = r.warm[c], d = r.third[c];
    console.log(`| ${c} | ${a?.files ?? 0} | ${mb(all(a))} MB | ${mb(b?.net ?? 0)} MB | ${mb(d?.net ?? 0)} / ${mb(d?.sw ?? 0)} MB |`);
  }
  console.log(`| **Summe** | ${sum(r.cold, 'files')} | **${mb(sum(r.cold, all))} MB** | ${mb(sum(r.warm, 'net'))} MB | ${mb(sum(r.third, 'net'))} / ${mb(sum(r.third, 'sw'))} MB |`);
  console.log(`\nLadezeit bis zum ersten Bild + 8 s (Software-Grafik): ${r.seconds.map((s) => s.toFixed(0) + ' s').join(' / ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
