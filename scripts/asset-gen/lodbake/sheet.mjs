// Comparison sheet: rows = models (first row = reference), columns = views; SSIM against the first row.
// usage: node scripts/asset-gen/lodbake/sheet.mjs out.png --fp w,d "Label|sub=path.glb" ...   (env PW_CHROMIUM)
// --fp: footprint in tiles (game scales the model to it). The LOD columns render the model at the size it has
// on screen when the game switches levels (camera FOV 40°, 900 px canvas height, thresholds 38 / 72 tiles,
// graphics level "low" 0.55 → lod1 from 21 tiles); "dpr2" = retina display (twice the pixels).
import sharp from 'sharp';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const fpI = args.indexOf('--fp');
const fp = fpI >= 0 ? args.splice(fpI, 2)[1].split(',').map(Number) : [4, 4];
const [out, ...items] = args;
const root = process.cwd().split(String.fromCharCode(92)).join('/');
const server = await createServer({ root, server: { port: 4441, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const url = (f, box, v) => `${base}scripts/asset-gen/lodbake/view.html?` + new URLSearchParams({ f: '/' + f, box: box.join(','), az: v[0], el: v[1], zoom: v[2], oy: v[3] ?? 0, ds: process.env.DS ?? '' });
async function shot(f, box, v) {
  const p = await browser.newPage({ viewport: { width: 600, height: 600 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(url(f, box, v));
  await p.waitForFunction(() => document.title === 'ready', null, { timeout: 120000 });
  const info = await p.evaluate(() => window.__info);
  const buf = await p.screenshot();
  await p.close();
  return { info, buf };
}
const BG = [0x8a, 0x9a, 0x78];
async function lum(buf) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height, L = new Float32Array(n), M = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    L[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    M[i] = Math.abs(r - BG[0]) + Math.abs(g - BG[1]) + Math.abs(b - BG[2]) > 12 ? 1 : 0;
  }
  return { L, M, w: info.width, h: info.height };
}
function maskHeight(A) { let lo = A.h, hi = -1; for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) if (A.M[y * A.w + x]) { lo = Math.min(lo, y); hi = Math.max(hi, y); } return hi - lo + 1; }
function ssim(A, B) {
  const C1 = 6.5025, C2 = 58.5225; let s = 0, n = 0;
  for (let y = 0; y + 8 <= A.h; y += 4) for (let x = 0; x + 8 <= A.w; x += 4) {
    let any = 0, ma = 0, mb = 0;
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const k = (y + j) * A.w + x + i; any |= A.M[k] | B.M[k]; ma += A.L[k]; mb += B.L[k]; }
    if (!any) continue;
    ma /= 64; mb /= 64; let va = 0, vb = 0, cv = 0;
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const k = (y + j) * A.w + x + i, da = A.L[k] - ma, db = B.L[k] - mb; va += da * da; vb += db * db; cv += da * db; }
    va /= 63; vb /= 63; cv /= 63;
    s += ((2 * ma * mb + C1) * (2 * cv + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2)); n++;
  }
  return s / n;
}

const files = items.map((x) => x.split('='));
const ref = await shot(files[0][1], [0, 0, 0, 1], [0.6, 0.5, 1]);
const box = [...ref.info.center, Math.max(...ref.info.size)];
const [sx, sy, sz] = ref.info.size;
const H = sy * Math.min((fp[0] * 0.92) / sx, (fp[1] * 0.92) / sz); // height in tiles in the game
const px = (D) => (H * 900) / (2 * D * Math.tan((20 * Math.PI) / 180));
// game-like camera direction for the LOD views; calibrate zoom → on-screen height with the reference
const GAME = [2.2, 0.9];
const cal = maskHeight(await lum((await shot(files[0][1], box, [...GAME, 1])).buf));
const zoomFor = (p) => Math.min(1.4, p / cal);
const lodViews = [
  ['L1 38 dpr2', Math.min(560, 2 * px(38))], ['L1 21 low', px(21)], ['L2 72 dpr2', 2 * px(72)], ['L2 72', px(72)],
];
console.log(`height ${H.toFixed(2)} tiles; px at lod1 ${px(38).toFixed(0)} (dpr2 ${(2 * px(38)).toFixed(0)}), low ${px(21).toFixed(0)}, lod2 ${px(72).toFixed(0)}`);
// columns shown: game zoom, extreme close-up, lod1 switch (dpr2, 1:1), lod2 switch (dpr1, magnified 3x)
const shown = [[0.6, 0.5, 1], [0.6, 0.5, 2.6, 0.15]];
const hidden = [[0.6 + Math.PI, 0.5, 1], [0.6, 1.35, 1], ...lodViews.map(([, p]) => [...GAME, zoomFor(p)])];
const names = ['game', 'close', 'back', 'top', ...lodViews.map(([n]) => n)];
const all = [...shown, ...hidden];
const T = 600, LW = 210;
const magOf = (p) => Math.max(1, Math.min(4, Math.floor(420 / p)));
const refL = [], comps = [];
let texts = '';
for (let i = 0; i < files.length; i++) {
  const t = files[i][0].split('|');
  const bufs = [];
  for (const v of all) bufs.push(await shot(files[i][1], box, v));
  const Ls = await Promise.all(bufs.map((b) => lum(b.buf)));
  if (i === 0) refL.push(...Ls);
  const ss = Ls.map((L, k) => ssim(refL[k], L));
  console.log(`${t[0].padEnd(16)} ${String(Math.round(bufs[0].info.tris)).padStart(6)} tris  ` + names.map((n, k) => `${n} ${ss[k].toFixed(3)}`).join('  '));
  const lines = [`${Math.round(bufs[0].info.tris)} Dreiecke ${t[1] ?? ''}`];
  if (i) lines.push(`SSIM Nah ${ss[0].toFixed(2)} · extrem ${ss[1].toFixed(2)}`, `Stufe-1-Wechsel ${ss[4].toFixed(2)} (niedrig ${ss[5].toFixed(2)})`, `Stufe-2-Wechsel ${ss[6].toFixed(2)} / ${ss[7].toFixed(2)}`);
  texts += `<text x="8" y="${i * T + 260}" font-family="sans-serif" font-size="20" font-weight="700" fill="#222">${t[0]}</text>` +
    lines.map((l, k) => `<text x="8" y="${i * T + 286 + k * 20}" font-family="sans-serif" font-size="14" fill="#444">${l}</text>`).join('');
  comps.push({ input: bufs[0].buf, left: LW, top: i * T }, { input: bufs[1].buf, left: LW + T, top: i * T });
  // lod switch views: crop around the model, lod1 (dpr2) at 1:1 if it fits, lod2 magnified
  const magOf = (p) => Math.max(1, Math.min(4, Math.floor(420 / p)));
  for (const [col, k, mag] of [[2, 4, magOf(lodViews[0][1])], [3, 7, magOf(lodViews[3][1])]]) {
    const size = Math.round(T / mag);
    const crop = await sharp(bufs[k].buf).extract({ left: (T - size) >> 1, top: (T - size) >> 1, width: size, height: size }).resize(T, T, { kernel: 'nearest' }).toBuffer();
    comps.push({ input: crop, left: LW + col * T, top: i * T });
  }
}
const head = `<text x="${LW + 10}" y="20" font-family="sans-serif" font-size="15" fill="#222">Nah (Spielzoom)</text><text x="${LW + T + 10}" y="20" font-family="sans-serif" font-size="15" fill="#fff">extreme Nahaufnahme</text>` +
  `<text x="${LW + 2 * T + 10}" y="20" font-family="sans-serif" font-size="15" fill="#222">Wechsel auf Stufe 1 (38 Kacheln, Retina${magOf(lodViews[0][1]) > 1 ? `, ${magOf(lodViews[0][1])}× vergrößert` : ', 1:1'})</text><text x="${LW + 3 * T + 10}" y="20" font-family="sans-serif" font-size="15" fill="#222">weit weg: Wechsel auf Stufe 2 (72 Kacheln, ${magOf(lodViews[3][1])}× vergrößert)</text>`;
comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${LW + 4 * T}" height="${files.length * T}">${texts}${head}</svg>`), left: 0, top: 0 });
await sharp({ create: { width: LW + 4 * T, height: files.length * T, channels: 3, background: '#f4f1ea' } }).composite(comps).png().toFile(out);
await browser.close();
await server.close();
