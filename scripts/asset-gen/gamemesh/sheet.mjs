// node scripts/asset-gen/gamemesh/sheet.mjs out.png "Label|sub=path.glb" ...   (run from project root)
import sharp from 'sharp';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
const [out, ...items] = process.argv.slice(2);
const root = process.cwd().split(String.fromCharCode(92)).join('/');
const server = await createServer({ root, server: { port: 4413, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const T = 500;
const VIEWS = JSON.parse(process.env.VIEWS || 'null') ?? [
  { az: 0.5, el: 0.35, dist: 2.3, ty: 0.5, r: 90, extra: {} },       // Spielzoom: low-res, upscaled
  { az: 0.25, el: 0.1, dist: 0.42, ty: 0.86, extra: {} },            // head close-up
  { az: 1.4, el: 0.15, dist: 0.6, ty: 0.82, extra: {} },             // head side
  { az: 2.6, el: 0.3, dist: 2.0, ty: 0.5, extra: {} },               // back 3/4
];
async function shot(f, v) {
  const p = await browser.newPage({ viewport: { width: T, height: T } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  const qs = new URLSearchParams({ f: '/' + f, s: T, r: v.r ?? T, az: v.az, el: v.el, dist: v.dist, ty: v.ty, ...(v.extra || {}), ...(JSON.parse(process.env.EXTRA || '{}')) });
  await p.goto(`${base}scripts/asset-gen/gamemesh/view.html?${qs}`);
  await p.waitForFunction(() => document.title === 'ready', null, { timeout: 180000 });
  const info = await p.evaluate(() => window.__info);
  const buf = await p.screenshot();
  await p.close();
  return { info, buf };
}
const LW = 200; const comps = []; let texts = '';
const files = items.map((x) => x.split('='));
for (let i = 0; i < files.length; i++) {
  const t = files[i][0].split('|');
  for (let k = 0; k < VIEWS.length; k++) {
    const s = await shot(files[i][1], VIEWS[k]);
    if (k === 0) texts += `<text x="8" y="${i * T + 230}" font-family="sans-serif" font-size="20" font-weight="700" fill="#222">${t[0]}</text><text x="8" y="${i * T + 256}" font-family="sans-serif" font-size="14" fill="#444">${t[1] ?? ''}</text><text x="8" y="${i * T + 278}" font-family="sans-serif" font-size="14" fill="#444">${Math.round(s.info.tris)} Dreiecke</text>`;
    comps.push({ input: s.buf, left: LW + k * T, top: i * T });
  }
}
comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${LW}" height="${files.length * T}">${texts}</svg>`), left: 0, top: 0 });
await sharp({ create: { width: LW + VIEWS.length * T, height: files.length * T, channels: 3, background: '#f4f1ea' } }).composite(comps).png().toFile(out);
await browser.close(); await server.close();
