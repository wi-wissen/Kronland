// Split a concept sheet (several views side by side on a light background) into single views.
//
//   node scripts/asset-gen/views.mjs <id>        # reads assets-src/characters/<id>/sheet.(webp|png|jpg)
//
// Result: view-1.png … view-n.png (square, 1024², figure centred, background as in the sheet).
// Figures = connected areas that stand out from the background (mean of the corners); if a weapon reaches into the
// column of the neighbouring figure, it still stays with its own figure.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { SRC_DIR } from './lib.mjs';
import { requireAssetsSrc } from '../require-assets-src.mjs';

export async function splitSheet(dir, { size = 1024, pad = 0.06 } = {}) {
  const sheet = ['sheet.webp', 'sheet.png', 'sheet.jpg'].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));
  if (!sheet) throw new Error(`No sheet.* in ${dir}`);
  const { data, info } = await sharp(sheet).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const px = (x, y) => (y * W + x) * 3;
  // Background: mean of the four corners (sheets often have a slight gradient), threshold with some margin above it
  const corners = [[4, 4], [W - 5, 4], [4, H - 5], [W - 5, H - 5]];
  const bg = [0, 1, 2].map((c) => corners.reduce((a, [x, y]) => a + data[px(x, y) + c], 0) / 4);
  const spread = Math.max(...corners.map(([x, y]) => [0, 1, 2].reduce((a, c) => a + Math.abs(data[px(x, y) + c] - bg[c]), 0)));
  const thr = Math.max(40, spread * 2 + 20);
  const fg = (x, y) => Math.abs(data[px(x, y)] - bg[0]) + Math.abs(data[px(x, y) + 1] - bg[1]) + Math.abs(data[px(x, y) + 2] - bg[2]) > thr;
  // Connected areas instead of columns: weapons may reach into the neighbouring figure's column
  const label = new Int32Array(W * H);
  const comps = [];
  for (let y0 = 0; y0 < H; y0++) for (let x0 = 0; x0 < W; x0++) {
    if (label[y0 * W + x0] || !fg(x0, y0)) continue;
    const c = { id: comps.length + 1, n: 0, sx: 0, x0, x1: x0, y0, y1: y0 };
    const stack = [y0 * W + x0];
    label[y0 * W + x0] = c.id;
    while (stack.length) {
      const i = stack.pop(), x = i % W, y = (i - x) / W;
      c.n++; c.sx += x;
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (!label[j] && fg(nx, ny)) { label[j] = c.id; stack.push(j); }
      }
    }
    comps.push(c);
  }
  const big = Math.max(...comps.map((c) => c.n));
  // Figures = large areas; small parts (highlights, loose pieces) go to the nearest figure
  const figs = comps.filter((c) => c.n > big * 0.15).sort((a, b) => a.sx / a.n - b.sx / b.n).map((c) => ({ ids: new Set([c.id]), ...c }));
  for (const c of comps) {
    if (c.n <= big * 0.15 && c.n > 30) {
      const cx = c.sx / c.n;
      const f = figs.reduce((a, b) => (Math.abs(b.sx / b.n - cx) < Math.abs(a.sx / a.n - cx) ? b : a));
      f.ids.add(c.id); f.x0 = Math.min(f.x0, c.x0); f.x1 = Math.max(f.x1, c.x1); f.y0 = Math.min(f.y0, c.y0); f.y1 = Math.max(f.y1, c.y1);
    }
  }
  const src = await sharp(sheet).removeAlpha().raw().toBuffer();
  const out = [];
  for (const [i, f] of figs.entries()) {
    // Crop with 2 px margin; pixels of other figures become background (edge pixels of the own figure stay)
    const x0 = Math.max(0, f.x0 - 2), y0 = Math.max(0, f.y0 - 2), w = Math.min(W, f.x1 + 3) - x0, h = Math.min(H, f.y1 + 3) - y0;
    const buf = Buffer.alloc(w * h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let own = false, other = false;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const X = x0 + x + dx, Y = y0 + y + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const l = label[Y * W + X];
        if (l) { if (f.ids.has(l)) own = true; else other = true; }
      }
      const o = (y * w + x) * 3, k = ((y0 + y) * W + x0 + x) * 3;
      for (let c = 0; c < 3; c++) buf[o + c] = own || !other ? src[k + c] : Math.round(bg[c]);
    }
    // Never scale up (soft source → blurry face): small figures centred on size², large ones scaled down
    const side = Math.max(size, Math.round(Math.max(w, h) * (1 + pad * 2)));
    const file = path.join(dir, `view-${i + 1}.png`);
    const crop = await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
    // composite first, then scale (otherwise sharp runs resize before composite)
    const square = await sharp({ create: { width: side, height: side, channels: 3, background: { r: bg[0], g: bg[1], b: bg[2] } } })
      .composite([{ input: crop, left: Math.round((side - w) / 2), top: Math.round((side - h) / 2) }]).png().toBuffer();
    await sharp(square).resize(size, size).png().toFile(file);
    out.push(file);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const id = process.argv[2];
  if (!id) { console.error('Usage: node scripts/asset-gen/views.mjs <id>'); process.exit(1); }
  requireAssetsSrc('characters', id);
  const files = await splitSheet(path.join(SRC_DIR, id));
  console.log(files.map((f) => path.relative(process.cwd(), f)).join('\n'));
}
