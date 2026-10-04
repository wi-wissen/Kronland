// Splits the AI icon sheet (assets-src/icons/sheet.webp, white background, grid per layout.json)
// into single icons, cuts them out and assembles them into an atlas:
//   public/icons/symbols.webp   – atlas, CELL×CELL per icon, order as in layout.json
//   src/ui/icons/atlas.js       – name → index (read by the game, do not edit by hand)
// Usage: node scripts/icons/slice.mjs [--preview file.png]
import fs from 'node:fs';
import sharp from 'sharp';
import { requireAssetsSrc } from '../require-assets-src.mjs';

requireAssetsSrc('icons');

const SRC = 'assets-src/icons/sheet.webp';
const LAYOUT = JSON.parse(fs.readFileSync('assets-src/icons/layout.json', 'utf8'));
const CELL = 128; // output size per icon (at most ~44 px are displayed, ×2 for high-resolution screens)
const PAD = 4;

const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const px = (x, y) => (y * W + x) * 3;

// 1) Background: flood all light, unsaturated pixels from the image edges (white and soft shadows).
//    Dark outlines of the icons stop the flood, light areas inside are preserved.
const bg = new Uint8Array(W * H);
// Light, grey icons (cloud, swirl …) tolerate only a strict threshold, otherwise the flood eats into them.
// For all others the grey ground shadows are captured too and recomputed as semi-transparent at the bottom.
const LIGHT = new Set(['weather-rain', 'weather-winter', 'ab-shieldBash', 'skull', 'scroll', 'hp', 'u-sword', 'u-spear', 'attack', 'free-85', 'ab-caltrops']);
const cellW = W / LAYOUT.cols, cellH = H / LAYOUT.rows;
const strict = new Uint8Array(W * H);
for (let k = 0; k < W * H; k++) {
  const idx = Math.floor((k / W | 0) / cellH) * LAYOUT.cols + Math.floor((k % W) / cellW);
  strict[k] = LIGHT.has(LAYOUT.names[idx]) ? 1 : 0;
}
const isBgLike = (i) => {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
  return strict[i / 3] ? mn > 232 && mx - mn < 16 : mn > 185 && mx - mn < 20;
};
const stack = [];
for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
while (stack.length) {
  const k = stack.pop();
  if (bg[k] || !isBgLike(k * 3)) continue;
  bg[k] = 1;
  const x = k % W, y = (k / W) | 0;
  if (x > 0) stack.push(k - 1);
  if (x < W - 1) stack.push(k + 1);
  if (y > 0) stack.push(k - W);
  if (y < H - 1) stack.push(k + W);
}

// 1b) Enclosed white (e.g. between bow and string): larger areas of pure white also count
//     as background. Light parts of the icons (parchment, clouds) are never that pure and that large.
const pure = (i) => Math.min(data[i], data[i + 1], data[i + 2]) > 247 && Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) < 6;
const visited = new Uint8Array(W * H);
for (let k0 = 0; k0 < W * H; k0++) {
  if (bg[k0] || visited[k0] || !pure(k0 * 3)) continue;
  const region = [k0], st = [k0];
  visited[k0] = 1;
  while (st.length) {
    const k = st.pop();
    const x = k % W;
    for (const nk of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W]) {
      if (nk >= 0 && nk < W * H && !visited[nk] && !bg[nk] && pure(nk * 3)) { visited[nk] = 1; st.push(nk); region.push(nk); }
    }
  }
  if (region.length > 400) for (const k of region) bg[k] = 1;
}

// 1c) Fringe: pixels directly at the background are anti-aliasing against white and are recomputed too.
const edge = new Uint8Array(W * H);
for (let pass = 0; pass < 2; pass++) {
  const src = pass === 0 ? bg : edge;
  const add = [];
  for (let k = 0; k < W * H; k++) {
    if (bg[k] || edge[k]) continue;
    const x = k % W;
    if ((x > 0 && src[k - 1]) || (x < W - 1 && src[k + 1]) || (k >= W && src[k - W]) || (k < W * H - W && src[k + W])) add.push(k);
  }
  for (const k of add) edge[k] = 1;
}

// 2) Cut out: in the background "colour over white" is recomputed (anti-aliasing and shadows
//    stay as semi-transparent dark), everything else is opaque.
const rgba = Buffer.alloc(W * H * 4);
for (let k = 0; k < W * H; k++) {
  const i = k * 3, o = k * 4;
  if (!bg[k] && !edge[k]) { rgba[o] = data[i]; rgba[o + 1] = data[i + 1]; rgba[o + 2] = data[i + 2]; rgba[o + 3] = 255; continue; }
  const mn = Math.min(data[i], data[i + 1], data[i + 2]);
  let a = 1 - mn / 255;
  if (a < 0.06) a = 0; // noise in the white
  else a = Math.min(1, (a - 0.06) / 0.94 * 1.1);
  if (a === 0) continue;
  for (let c = 0; c < 3; c++) rgba[o + c] = Math.max(0, Math.min(255, Math.round((data[i + c] - (1 - a) * 255) / a)));
  rgba[o + 3] = Math.round(a * 255);
}

// 3) Find connected parts. Large parts are assigned to a grid cell by centroid
//    (more robust than rigid cutting if the model shifts icons slightly), small parts such as
//    sparks or raindrops to the nearest large part – they often reach into the neighbouring row.
const cw = W / LAYOUT.cols, ch = H / LAYOUT.rows;
const comps = [];
const seen = new Uint8Array(W * H);
for (let k0 = 0; k0 < W * H; k0++) {
  if (seen[k0] || rgba[k0 * 4 + 3] < 40) continue;
  let x0 = W, y0 = H, x1 = 0, y1 = 0, sx = 0, sy = 0, n = 0;
  const st = [k0];
  seen[k0] = 1;
  while (st.length) {
    const k = st.pop();
    const x = k % W, y = (k / W) | 0;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    sx += x; sy += y; n++;
    for (const nk of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < H - 1 ? k + W : -1]) {
      if (nk >= 0 && !seen[nk] && rgba[nk * 4 + 3] >= 40) { seen[nk] = 1; st.push(nk); }
    }
  }
  if (n >= 30) comps.push({ x0, y0, x1, y1, cx: sx / n, cy: sy / n, n }); // smaller is dust
}
const BIG = cw * ch * 0.05;
const boxes = LAYOUT.names.map(() => null);
const grow = (idx, c) => {
  const b = boxes[idx];
  boxes[idx] = b ? { x0: Math.min(b.x0, c.x0), y0: Math.min(b.y0, c.y0), x1: Math.max(b.x1, c.x1), y1: Math.max(b.y1, c.y1) } : { x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 };
};
const big = [];
for (const c of comps.filter((c) => c.n >= BIG)) {
  const col = Math.min(LAYOUT.cols - 1, Math.floor(c.cx / cw)), row = Math.min(LAYOUT.rows - 1, Math.floor(c.cy / ch));
  const idx = row * LAYOUT.cols + col;
  if (idx >= LAYOUT.names.length) { console.warn(`Part outside the occupied cells at row ${row + 1}, column ${col + 1}`); continue; }
  grow(idx, c);
  big.push({ idx, c });
}
for (const c of comps.filter((c) => c.n < BIG)) {
  // distance to the frame of the large part (0 if inside)
  let best = null, bd = Infinity;
  for (const { idx, c: g } of big) {
    const dx = Math.max(g.x0 - c.cx, 0, c.cx - g.x1), dy = Math.max(g.y0 - c.cy, 0, c.cy - g.y1);
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = idx; }
  }
  if (best !== null && bd < (cw * 0.35) ** 2) grow(best, c);
}

// 4) Atlas: each icon fitted into a square and centred
const cols = LAYOUT.cols, rows = Math.ceil(LAYOUT.names.length / cols);
const full = sharp(rgba, { raw: { width: W, height: H, channels: 4 } });
const parts = [];
for (const [idx, name] of LAYOUT.names.entries()) {
  const b = boxes[idx];
  if (!b) throw new Error(`No icon found for ${name}`);
  const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
  if (w > cw * 1.15 || h > ch * 1.15) console.warn(`${name}: unusually large (${w}×${h})`);
  const buf = await full.clone().extract({ left: b.x0, top: b.y0, width: w, height: h })
    .resize(CELL - 2 * PAD, CELL - 2 * PAD, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
    .png().toBuffer();
  parts.push({ input: buf, left: (idx % cols) * CELL + PAD, top: Math.floor(idx / cols) * CELL + PAD });
}
fs.mkdirSync('public/icons', { recursive: true });
const atlas = sharp({ create: { width: cols * CELL, height: rows * CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(parts);
const out = await atlas.clone().webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile('public/icons/symbols.webp');
console.log(`public/icons/symbols.webp: ${cols * CELL}×${rows * CELL}, ${Math.round(out.size / 1024)} KB, ${LAYOUT.names.length} icons`);

const js = `// Generated by scripts/icons/slice.mjs – do not edit by hand.
// Colourful icons as atlas public/icons/symbols.webp (AI sheet, see docs/SYMBOLE.md).
export const ATLAS = { url: 'icons/symbols.webp', cols: ${cols}, rows: ${rows} };
export const ATLAS_INDEX = {
${LAYOUT.names.map((n, i) => (n.startsWith('free-') ? null : `  ${JSON.stringify(n)}: ${i},`)).filter(Boolean).join('\n')}
};
`;
fs.writeFileSync('src/ui/icons/atlas.js', js);

const vi = process.argv.indexOf('--preview');
if (vi > 0) {
  // Preview on dark and light background to check edges and shadows
  const a = await atlas.clone().png().toBuffer();
  const meta = { width: cols * CELL, height: rows * CELL };
  const dark = await sharp({ create: { ...meta, channels: 4, background: '#3a2c20' } }).composite([{ input: a }]).png().toBuffer();
  const light = await sharp({ create: { ...meta, channels: 4, background: '#e9dcc0' } }).composite([{ input: a }]).png().toBuffer();
  await sharp({ create: { width: meta.width, height: meta.height * 2, channels: 4, background: '#000' } })
    .composite([{ input: dark, top: 0, left: 0 }, { input: light, top: meta.height, left: 0 }]).png().toFile(process.argv[vi + 1]);
}
