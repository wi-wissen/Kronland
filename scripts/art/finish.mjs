// Prepare raw images from scripts/art/generate.mjs for the game (selection is in assets-src/art/<job>/job.json → finish).
//
//   node scripts/art/finish.mjs symbols   cut out individual icons → public/icons/<name>.webp (128 px, alpha)
//   node scripts/art/finish.mjs menu      likewise (every job with "kind": "symbols" in job.json)
//   node scripts/art/finish.mjs herald    portrait on cream background #f1ece4 → public/portraits/sp-herald.webp (256 px)
//   node scripts/art/finish.mjs title     backdrop for the start menu → public/art/title.webp (< 400 KB)
//   node scripts/art/finish.mjs loading   backdrop for the loading screen → public/art/loading.webp (< 400 KB)
//   node scripts/art/finish.mjs cursors   mouse cursors → public/icons/cursor-<name>.png (40 px) + src/game/cursorHotspots.js
//   --preview file.png  (icons only) result on dark and light background
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ROOT } from '../asset-gen/lib.mjs';
import { requireAssetsSrc } from '../require-assets-src.mjs';

const [name] = process.argv.slice(2);
requireAssetsSrc('art');
const dir = path.join(ROOT, 'assets-src/art', name ?? '');
if (!name || !fs.existsSync(path.join(dir, 'job.json'))) { console.error('Usage: finish.mjs <symbols|menu|herald|title|loading>'); process.exit(1); }
const job = JSON.parse(fs.readFileSync(path.join(dir, 'job.json'), 'utf8'));
const fin = job.finish;
const rel = (f) => path.relative(ROOT, f);

/** Flood from the image edges all pixels for which `like(i)` holds (i = index into the RGB array). */
function flood(W, H, like) {
  const bg = new Uint8Array(W * H);
  const st = [];
  for (let x = 0; x < W; x++) st.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
  while (st.length) {
    const k = st.pop();
    if (bg[k] || !like(k * 3)) continue;
    bg[k] = 1;
    const x = k % W;
    if (x > 0) st.push(k - 1);
    if (x < W - 1) st.push(k + 1);
    if (k >= W) st.push(k - W);
    if (k < W * H - W) st.push(k + W);
  }
  return bg;
}

/** Fringe of `n` pixels around the mask. */
function ring(bg, W, H, n) {
  const edge = new Uint8Array(W * H);
  for (let pass = 0; pass < n; pass++) {
    const src = pass === 0 ? bg : edge, add = [];
    for (let k = 0; k < W * H; k++) {
      if (bg[k] || edge[k]) continue;
      const x = k % W;
      if ((x > 0 && src[k - 1]) || (x < W - 1 && src[k + 1]) || (k >= W && src[k - W]) || (k < W * H - W && src[k + W])) add.push(k);
    }
    for (const k of add) edge[k] = 1;
  }
  return edge;
}

/**
 * Cut out an icon on white (like scripts/icons/slice.mjs): flood white and grey shadows from the edges,
 * add larger pure-white enclosures (can be switched off: `innerWhite: false`, e.g. for chalk on a board), and in the background and 2 px fringe recompute "colour over white".
 */
function cutout(data, W, H, innerWhite = true) {
  const bg = flood(W, H, (i) => {
    const mn = Math.min(data[i], data[i + 1], data[i + 2]), mx = Math.max(data[i], data[i + 1], data[i + 2]);
    return mn > 185 && mx - mn < 20;
  });
  // enclosed white (e.g. between horn and strap): larger pure-white areas also count as background
  const pure = (k) => { const i = k * 3; const mn = Math.min(data[i], data[i + 1], data[i + 2]); return mn > 245 && Math.max(data[i], data[i + 1], data[i + 2]) - mn < 8; };
  const seen = new Uint8Array(W * H);
  for (let k0 = 0; k0 < W * H; k0++) {
    if (!innerWhite) break;
    if (bg[k0] || seen[k0] || !pure(k0)) continue;
    const region = [k0], st = [k0];
    seen[k0] = 1;
    while (st.length) {
      const k = st.pop(), x = k % W;
      for (const nk of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W]) {
        if (nk >= 0 && nk < W * H && !seen[nk] && !bg[nk] && pure(nk)) { seen[nk] = 1; st.push(nk); region.push(nk); }
      }
    }
    if (region.length > 400) for (const k of region) bg[k] = 1;
  }
  const edge = ring(bg, W, H, 2);
  const rgba = Buffer.alloc(W * H * 4);
  for (let k = 0; k < W * H; k++) {
    const i = k * 3, o = k * 4;
    if (!bg[k] && !edge[k]) { rgba[o] = data[i]; rgba[o + 1] = data[i + 1]; rgba[o + 2] = data[i + 2]; rgba[o + 3] = 255; continue; }
    let a = 1 - Math.min(data[i], data[i + 1], data[i + 2]) / 255;
    a = a < 0.06 ? 0 : Math.min(1, ((a - 0.06) / 0.94) * 1.1);
    if (!a) continue;
    for (let c = 0; c < 3; c++) rgba[o + c] = Math.max(0, Math.min(255, Math.round((data[i + c] - (1 - a) * 255) / a)));
    rgba[o + 3] = Math.round(a * 255);
  }
  return rgba;
}

if (name === 'symbols' || job.kind === 'symbols') {
  // finish: { "<symbolname>": { "raw": "raw-1.webp", "slot": 0 } } – slot = third of the image (0 left … 2 right);
  // if an icon extends beyond its third, use a section "crop": [x, y, w, h] in raw image pixels instead of slot
  const CELL = 128, PAD = 4;
  const outs = [];
  for (const [icon, { raw, slot, crop, innerWhite }] of Object.entries(fin)) {
    const src = sharp(path.join(dir, raw));
    const { width: W0, height: H } = await src.metadata();
    const w = Math.floor(W0 / 3);
    const area = crop ? { left: crop[0], top: crop[1], width: crop[2], height: crop[3] } : { left: slot * w, top: 0, width: w, height: H };
    const { data, info } = await sharp(path.join(dir, raw)).removeAlpha().extract(area).raw().toBuffer({ resolveWithObject: true });
    const rgba = cutout(data, info.width, info.height, innerWhite !== false);
    // crop to opaque parts (dust below opacity 40 does not count)
    let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0;
    for (let k = 0; k < info.width * info.height; k++) {
      if (rgba[k * 4 + 3] < 40) continue;
      const x = k % info.width, y = (k / info.width) | 0;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const buf = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
      .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
      .resize(CELL - 2 * PAD, CELL - 2 * PAD, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
      .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    const file = path.join(ROOT, 'public/icons', `${icon}.webp`);
    const r = await sharp(buf).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(file);
    console.log(`${rel(file)}: ${CELL}×${CELL}, ${Math.round(r.size / 1024)} KB`);
    outs.push(buf);
  }
  const vi = process.argv.indexOf('--preview');
  if (vi > 0) {
    const tiles = [];
    for (const [row, color] of [[0, '#3a2c20'], [1, '#e9dcc0']]) {
      outs.forEach((b, i) => tiles.push({ input: b, left: i * CELL, top: row * CELL }));
      tiles.unshift({ input: { create: { width: outs.length * CELL, height: CELL, channels: 4, background: color } }, left: 0, top: row * CELL });
    }
    await sharp({ create: { width: outs.length * CELL, height: 2 * CELL, channels: 4, background: '#000' } }).composite(tiles).png().toFile(process.argv[vi + 1]);
  }
} else if (job.kind === 'cursors') {
  // finish: { "out": "cursor" | "decal", "items": { "<name>": { "raw": "raw-1.webp", "crop": [x, y, w, h], "flip": true } } }
  // cursor: 40 px PNG, hot spot = opaque pixel furthest to the top left (tip of finger, blade, head);
  // decal: 256 px WebP, centred square (ground marker, seen from above)
  const decal = fin.out === 'decal', SIZE = decal ? 256 : 40, PAD = decal ? 4 : 1;
  const hot = {};
  for (const [item, { raw, crop, flip, innerWhite }] of Object.entries(fin.items)) {
    const { data, info } = await sharp(path.join(dir, raw)).removeAlpha()
      .extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] }).raw().toBuffer({ resolveWithObject: true });
    // shiny steel has pure-white highlights: only cut out enclosed white where asked
    const rgba = cutout(data, info.width, info.height, innerWhite === true);
    let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0;
    for (let k = 0; k < info.width * info.height; k++) {
      if (rgba[k * 4 + 3] < 40) continue;
      const x = k % info.width, y = (k / info.width) | 0;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    let img = sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
      .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 });
    if (flip) img = sharp(await img.flop().png().toBuffer());
    const buf = await img.resize(SIZE - 2 * PAD, SIZE - 2 * PAD, { fit: 'contain', position: decal ? 'centre' : 'left top', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
      .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    if (decal) {
      const file = path.join(ROOT, 'public/icons', `${item}.webp`);
      const r = await sharp(buf).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(file);
      console.log(`${rel(file)}: ${SIZE}×${SIZE}, ${Math.round(r.size / 1024)} KB`);
      continue;
    }
    const px = await sharp(buf).raw().toBuffer();
    let best = Infinity;
    for (let k = 0; k < SIZE * SIZE; k++) {
      const x = k % SIZE, y = (k / SIZE) | 0;
      if (px[k * 4 + 3] >= 128 && x + y < best) { best = x + y; hot[item] = [x, y]; }
    }
    const file = path.join(ROOT, 'public/icons', `cursor-${item}.png`);
    fs.writeFileSync(file, await sharp(buf).png({ compressionLevel: 9, palette: false }).toBuffer());
    console.log(`${rel(file)}: ${SIZE}×${SIZE}, hot spot ${hot[item]}`);
  }
  if (!decal) {
    const file = path.join(ROOT, 'src/game/cursorHotspots.js');
    fs.writeFileSync(file, `// Generated by scripts/art/finish.mjs cursors – do not edit by hand.\n// Hot spot (x, y in px) of each painted cursor public/icons/cursor-<name>.png (${SIZE} px).\nexport const CURSOR_SIZE = ${SIZE};\nexport const CURSOR_HOTSPOTS = ${JSON.stringify(hot)};\n`);
    console.log(rel(file));
  }
} else if (name === 'herald') {
  // finish: { "raw": "raw-1.webp", "crop": [x, y, side] } – square crop of head and shoulders
  const CREAM = [241, 236, 228];
  const [cx, cy, side] = fin.crop;
  const { data, info } = await sharp(path.join(dir, fin.raw)).removeAlpha().extract({ left: cx, top: cy, width: side, height: side })
    .resize(256, 256, { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  // set the background (colour of the top-left corner, from the edges) exactly to the cream of the other portraits
  const ref = [data[0], data[1], data[2]];
  const bg = flood(W, H, (i) => Math.abs(data[i] - ref[0]) + Math.abs(data[i + 1] - ref[1]) + Math.abs(data[i + 2] - ref[2]) < 30);
  const edge = ring(bg, W, H, 1);
  const out = Buffer.from(data);
  for (let k = 0; k < W * H; k++) {
    const t = bg[k] ? 1 : edge[k] ? 0.5 : 0;
    if (!t) continue;
    for (let c = 0; c < 3; c++) out[k * 3 + c] = Math.round(data[k * 3 + c] * (1 - t) + CREAM[c] * t);
  }
  const file = path.join(ROOT, 'public/portraits/sp-herald.webp');
  const r = await sharp(out, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 88 }).toFile(file);
  console.log(`${rel(file)}: 256×256, ${Math.round(r.size / 1024)} KB`);
} else {
  // Backdrops: finish: { "raw": "raw-1.webp", "out": "public/art/title.webp", "width": 1920 } – quality drops until < 400 KB
  const file = path.join(ROOT, fin.out);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const img = sharp(path.join(dir, fin.raw)).removeAlpha().resize({ width: fin.width ?? 1920, kernel: 'lanczos3' });
  let q = 82, buf;
  do { buf = await img.clone().webp({ quality: q, effort: 6, smartSubsample: true }).toBuffer(); q -= 4; } while (buf.length > 400 * 1024 && q > 40);
  fs.writeFileSync(file, buf);
  const m = await sharp(buf).metadata();
  console.log(`${rel(file)}: ${m.width}×${m.height}, quality ${q + 4}, ${Math.round(buf.length / 1024)} KB`);
}
