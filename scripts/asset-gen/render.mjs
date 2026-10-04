// Preview image of one or more characters (4 view angles per row) via tools/figure-preview.html.
//
//   node scripts/asset-gen/render.mjs out.png assets-src/characters/serf/raw.glb [more.glb] [--clip chop --t 0.4]
//   … --clip chop --ts 0,0.2,0.4,0.6,0.8   Bildfolge (Spalten = Zeitpunkte)
//
// Starts a Vite server (port 4390 or PREVIEW_PORT) and takes a screenshot with Playwright.

import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';

export async function renderPreview(out, files, { clip, t = 0, ts, hide, team, zoom, width = 1200, rowHeight = 360, views = 4 } = {}) {
  const port = Number(process.env.PREVIEW_PORT || 4390);
  const server = await createServer({ root: ROOT, server: { port, strictPort: false }, logLevel: 'error' });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  const exe = process.env.PW_CHROMIUM ?? (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width, height: rowHeight * files.length } });
    const f = files.map((x) => '/' + path.relative(ROOT, path.resolve(x))).join(',');
    const qs = new URLSearchParams({ f, views: String(views), ...(clip ? { clip, t: String(t) } : {}), ...(ts ? { ts } : {}), ...(hide ? { hide } : {}), ...(team ? { team } : {}), ...(zoom ? { zoom } : {}) });
    await page.goto(`${url}tools/figure-preview.html?${qs}`);
    await page.waitForFunction(() => document.title === 'ready', null, { timeout: 120000 });
    console.log((await page.evaluate(() => window.__info)).join('\n'));
    await page.screenshot({ path: out });
  } finally {
    await browser.close();
    await server.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
  const clip = opt('--clip'), t = Number(opt('--t') ?? 0), ts = opt('--ts'), hide = opt('--hide'), team = opt('--team'), zoom = opt('--zoom');
  const [out, ...files] = args;
  await renderPreview(out, files, { clip, t, ts, hide, team, zoom });
}
