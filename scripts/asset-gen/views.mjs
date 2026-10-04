// Split a concept sheet (several views side by side on a light background) into single views.
//
//   node scripts/asset-gen/views.mjs <id>        # reads assets-src/characters/<id>/sheet.(webp|png|jpg)
//
// Result: view-1.png … view-n.png (square, 1024², figure centred, background as in the sheet).
// Columns with a figure are found via the distance to the background colour (top-left corner).

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { SRC_DIR } from './lib.mjs';

export async function splitSheet(dir, { size = 1024, pad = 0.06 } = {}) {
  const sheet = ['sheet.webp', 'sheet.png', 'sheet.jpg'].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));
  if (!sheet) throw new Error(`No sheet.* in ${dir}`);
  const { data, info } = await sharp(sheet).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const px = (x, y) => (y * W + x) * 3;
  const bg = [data[px(4, 4)], data[px(4, 4) + 1], data[px(4, 4) + 2]];
  const fg = (x, y) => Math.abs(data[px(x, y)] - bg[0]) + Math.abs(data[px(x, y) + 1] - bg[1]) + Math.abs(data[px(x, y) + 2] - bg[2]) > 40;
  // Columns with a figure → runs
  const runs = [];
  let s = -1;
  for (let x = 0; x <= W; x++) {
    let on = false;
    if (x < W) for (let y = 0; y < H && !on; y += 2) on = fg(x, y);
    if (on && s < 0) s = x;
    if (!on && s >= 0) { if (x - s > 20) runs.push([s, x]); s = -1; }
  }
  const out = [];
  for (const [i, [x0, x1]] of runs.entries()) {
    let y0 = H, y1 = 0;
    for (let y = 0; y < H; y++) for (let x = x0; x < x1; x += 2) if (fg(x, y)) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); break; }
    const w = x1 - x0, h = y1 - y0 + 1;
    const side = Math.round(Math.max(w, h) * (1 + pad * 2));
    const file = path.join(dir, `view-${i + 1}.png`);
    const crop = await sharp(sheet).extract({ left: x0, top: y0, width: w, height: h }).toBuffer();
    await sharp({ create: { width: side, height: side, channels: 3, background: { r: bg[0], g: bg[1], b: bg[2] } } })
      .composite([{ input: crop, left: Math.round((side - w) / 2), top: Math.round((side - h) / 2) }])
      .resize(size, size).png().toFile(file);
    out.push(file);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const id = process.argv[2];
  if (!id) { console.error('Usage: node scripts/asset-gen/views.mjs <id>'); process.exit(1); }
  const files = await splitSheet(path.join(SRC_DIR, id));
  console.log(files.map((f) => path.relative(process.cwd(), f)).join('\n'));
}
