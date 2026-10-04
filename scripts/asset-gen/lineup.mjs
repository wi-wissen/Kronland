// Characters only: at real in-game size on grass and earth colour, enlarged next to it (legibility check).
//
//   node scripts/asset-gen/lineup.mjs out.png a.glb b.glb … [--px 40] [--team 2f6fd6] [--zoom 4] [--labels A,B,…]
//
// Starts Vite and tools/figure-preview.html in ?px=… mode; backgrounds like grass and earth in the game.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { ROOT } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const px = Number(opt('--px', 40)), team = opt('--team', '2f6fd6'), zoom = Number(opt('--zoom', 4)), hide = opt('--hide', 'Axe,Hammer,Pickaxe');
const [out, ...files] = args;
const BGS = ['6f9a3e', '9a7650']; // grass, earth (as in the game)
const cw = Math.round(px * 1.4), ch = Math.round(px * 1.5);

const server = await createServer({ root: ROOT, server: { port: Number(process.env.PREVIEW_PORT || 4398) }, logLevel: 'error' });
await server.listen();
const exe = process.env.PW_CHROMIUM ?? (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: cw * files.length, height: ch * BGS.length } });
  const f = files.map((x) => '/' + path.relative(ROOT, path.resolve(x))).join(',');
  const qs = new URLSearchParams({ f, px: String(px), bgs: BGS.join(','), team, hide });
  await page.goto(`${server.resolvedUrls.local[0]}tools/figure-preview.html?${qs}`);
  await page.waitForFunction(() => document.title === 'ready', null, { timeout: 120000 });
  const small = await page.screenshot();
  // game size on the left, enlarged (pixels visible) on the right
  const meta = await sharp(small).metadata();
  const big = await sharp(small).resize(meta.width * zoom, meta.height * zoom, { kernel: 'nearest' }).toBuffer();
  const W = meta.width * (zoom + 1) + 20, H = meta.height * zoom;
  await sharp({ create: { width: W, height: H, channels: 3, background: '#f4f1ea' } })
    .composite([{ input: small, left: 0, top: 0 }, { input: big, left: meta.width + 20, top: 0 }]).png().toFile(out);
  console.log(out, W, H);
} finally {
  await browser.close();
  await server.close();
}
