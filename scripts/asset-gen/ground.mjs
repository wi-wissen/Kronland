// Ground textures via image AI: painted, seamlessly tileable textures for grass, meadow, earth, sand, rock and snow.
//
//   node scripts/asset-gen/ground.mjs gen <kind|all> [--model …] [--n 2] [--hi]
//       generate candidates → assets-src/ground/<kind>/<nr>-<model>.webp (--hi: 2K instead of 1K, Seedream only)
//   node scripts/asset-gen/ground.mjs use <kind> <file> [--crop 0.02] [--keep-colors]
//       adopt a candidate: cut off the edge, match the mean colour (GROUND_TARGETS), make seamless
//       → public/textures/ground/<kind>.webp (1024) and <kind>-512.webp
//   node scripts/asset-gen/ground.mjs sheet [kind …]
//       overview: each candidate tiled 2×2 (seams visible) → assets-src/ground/candidates.webp
//
// Prompts, model and cost per image: assets-src/ground/ground.json. Workflow and style: docs/BODEN.md.
// All models run via OpenRouter's image API (/api/v1/images), also GPT-Image (cheaper there
// than via chat completions). Slow models are cut off after ~30 s in the cloud environment.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { reexecWithProxy, ROOT } from './lib.mjs';
import { makeSeamless, shiftMean } from './groundtex.mjs';

reexecWithProxy();

const SRC = path.join(ROOT, 'assets-src/ground');
const OUT = path.join(ROOT, 'public/textures/ground');
const LOG = path.join(SRC, 'ground.json');
const DEFAULT_MODEL = 'bytedance-seed/seedream-5-0-flash';

/** Shared style (English: image models follow it most reliably). */
export const GROUND_STYLE = 'Seamless tileable square texture for the ground of a cozy medieval village-building strategy game, '
  + 'seen exactly from directly above (orthographic top-down, flat, no perspective, no horizon). '
  + 'Stylized hand-painted look matching a warm, cozy 3D animated film: soft painterly brush strokes, rich but natural '
  + 'warm colors, gentle value variation. Soft even daylight from above, no cast shadows from objects, no text, no border, '
  + 'no frame, no vignette, no lighting gradient across the image. Organic irregular distribution with no grid, no rows '
  + 'and no visibly repeating motif. All four edges must continue seamlessly.';

/** Content per ground kind. */
export const GROUND_KINDS = {
  grass: 'Ground: short lush grass. Mostly soft short grass in fresh to warm yellow-green with irregular lighter and darker '
    + 'patches, a few small rounded grass clumps and tiny clover leaves. No flowers, no stones, no bare soil.',
  meadow: 'Ground: a flowering meadow. Soft grass in warm green to sunny yellow-green with small wildflowers in small loose '
    + 'groups (white daisies, yellow buttercups, a few soft violet and pale blue blossoms) and some clover. The flowers are '
    + 'small dots, not large. No stones, no bare soil.',
  dirt: 'Ground: packed brown earth of a village yard and footpath. Warm brown soil with soft lighter dusty patches, small '
    + 'rounded pebbles and a few tiny stones, a few dry grass bits at random spots. No grass areas, no puddles, no wheel '
    + 'tracks, no straight lines.',
  sand: 'Ground: warm light sand of a river beach. Soft fine sand with gentle irregular wind ripples, a few tiny pebbles. '
    + 'No water, no footprints, no shells larger than a pebble.',
  rock: 'Surface: weathered grey stone of a rocky cliff seen face-on, layered rock strata with cracks, slightly warm grey '
    + 'with a few lichen spots in muted olive and ochre. No grass, no plants, no sky.',
  snow: 'Ground: fresh soft snow cover, white with very subtle cool blue shadows in soft drifts and a few tiny sparkles. '
    + 'No footprints, no objects, no plants.',
};

/**
 * Mean target colour per kind (RGB): image models like to paint too garish, the game's light and shadow are tuned to this
 * colour world (like the earlier textures painted in code). On adoption the mean is shifted there,
 * the painted light-dark differences stay. null = colours unchanged.
 */
export const GROUND_TARGETS = {
  // measured on the textures painted in code (level "high"); grass slightly darker because the painted highlights are brighter
  grass: [98, 146, 54], meadow: [124, 158, 64], dirt: [135, 101, 67], sand: [217, 192, 139], rock: [131, 126, 114], snow: null,
};

const slug = (m) => m.split('/').pop().replace(/[^a-z0-9.-]+/gi, '-');
const readLog = () => (fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : { images: [] });
const writeLog = (l) => { fs.mkdirSync(SRC, { recursive: true }); fs.writeFileSync(LOG, JSON.stringify(l, null, 2) + '\n'); };

/** One image via OpenRouter's image API. */
async function imagesApi(model, prompt, extra = {}) {
  const h = { 'Content-Type': 'application/json', 'X-Title': 'Kronland asset-gen' };
  if (process.env.OPENROUTER_API_KEY) h.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY}`;
  const body = { model, prompt, n: 1, aspect_ratio: '1:1', ...extra };
  const r = await fetch('https://openrouter.ai/api/v1/images', { method: 'POST', headers: h, body: JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`OpenRouter image (${model}): ${r.status} ${text.slice(0, 300)}`);
  const j = JSON.parse(text);
  const d = j.data?.[0];
  if (!d?.b64_json) throw new Error(`No image in the response (${model})`);
  return { buf: Buffer.from(d.b64_json, 'base64'), cost: j.usage?.cost };
}

async function gen(kind, model, n, hi) {
  const prompt = `${GROUND_STYLE}\n${GROUND_KINDS[kind]}`;
  const dir = path.join(SRC, kind);
  fs.mkdirSync(dir, { recursive: true });
  const extra = model.startsWith('bytedance-seed/') ? { resolution: hi ? '2K' : '1K' } : {};
  for (let i = 0; i < n; i++) {
    const { buf, cost } = await imagesApi(model, prompt, extra);
    // WebP 92: hardly any loss, a tenth of the PNG size (source images live in the repository)
    const img = await sharp(buf).webp({ quality: 92 }).toBuffer();
    let nr = 1;
    while (fs.readdirSync(dir).some((f) => f.startsWith(`${nr}-`))) nr++;
    const file = path.join(dir, `${nr}-${slug(model)}.webp`);
    fs.writeFileSync(file, img);
    // no await between reading and writing: parallel calls do not lose entries
    const log = readLog();
    log.images.push({ kind, file: path.relative(SRC, file), model, prompt, ...extra, cost });
    writeLog(log);
    console.log(path.relative(ROOT, file), cost != null ? `(${cost.toFixed(3)} $)` : '');
  }
}

/** Adopt a candidate: cut off the edge, make seamless, write as WebP in two sizes. */
async function use(kind, file, crop, keepColors) {
  // Path as given, otherwise relative to assets-src/ground/<kind>/ or assets-src/ground/
  const src = [file, path.join(SRC, kind, file), path.join(SRC, file)].find((f) => fs.existsSync(f));
  if (!src) throw new Error(`File not found: ${file}`);
  const meta = await sharp(src).metadata();
  const c = Math.round(Math.min(meta.width, meta.height) * crop);
  const side = Math.min(meta.width, meta.height) - 2 * c;
  const { data, info } = await sharp(src).extract({ left: c, top: c, width: side, height: side })
    .resize(1024, 1024, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const target = keepColors ? null : GROUND_TARGETS[kind];
  const px = makeSeamless(target ? shiftMean(data, target) : data, info.width, info.height, 3);
  const img = sharp(Buffer.from(px), { raw: { width: info.width, height: info.height, channels: 3 } });
  fs.mkdirSync(OUT, { recursive: true });
  await img.clone().webp({ quality: 86 }).toFile(path.join(OUT, `${kind}.webp`));
  await img.clone().resize(512, 512, { kernel: 'lanczos3' }).webp({ quality: 86 }).toFile(path.join(OUT, `${kind}-512.webp`));
  const log = readLog();
  log.used = { ...(log.used ?? {}), [kind]: { file: path.relative(SRC, src), crop, target } };
  writeLog(log);
  console.log(`${kind}: ${path.relative(ROOT, src)} → public/textures/ground/${kind}.webp, ${kind}-512.webp`);
}

/** Overview: each candidate made seamless and tiled 2×2, with label. */
async function sheet(kinds) {
  const tiles = [];
  for (const kind of kinds) {
    const dir = path.join(SRC, kind);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((f) => /\.(png|webp|jpe?g)$/.test(f)).sort()) {
      const { data, info } = await sharp(path.join(dir, f)).resize(256, 256).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const one = await sharp(Buffer.from(makeSeamless(data, 256, 256, 3)), { raw: { width: 256, height: 256, channels: 3 } }).png().toBuffer();
      const label = Buffer.from(`<svg width="512" height="30"><rect width="512" height="30" fill="#000" opacity="0.6"/><text x="8" y="21" font-size="18" font-family="sans-serif" fill="#fff">${kind}/${f}</text></svg>`);
      tiles.push(await sharp({ create: { width: 512, height: 512, channels: 3, background: '#000' } })
        .composite([[0, 0], [256, 0], [0, 256], [256, 256]].map(([left, top]) => ({ input: one, left, top })).concat([{ input: label, left: 0, top: 0 }]))
        .png().toBuffer());
    }
  }
  if (!tiles.length) throw new Error('No candidates');
  const cols = Math.min(4, tiles.length), rows = Math.ceil(tiles.length / cols);
  const out = path.join(SRC, 'candidates.webp');
  await sharp({ create: { width: cols * 520, height: rows * 520, channels: 3, background: '#222' } })
    .composite(tiles.map((input, i) => ({ input, left: (i % cols) * 520 + 4, top: Math.floor(i / cols) * 520 + 4 })))
    .webp({ quality: 80 }).toFile(out);
  console.log(path.relative(ROOT, out));
}

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = (n) => { const i = args.indexOf(n); if (i < 0) return false; args.splice(i, 1); return true; };
const model = opt('--model') ?? DEFAULT_MODEL;
const n = Number(opt('--n') ?? 1);
const crop = Number(opt('--crop') ?? 0.02);
const hi = flag('--hi');
const keepColors = flag('--keep-colors');
const [cmd, ...rest] = args;

try {
  if (cmd === 'gen') {
    const kinds = rest[0] === 'all' ? Object.keys(GROUND_KINDS) : rest;
    for (const k of kinds) if (!GROUND_KINDS[k]) throw new Error(`Unbekannte Bodenart: ${k}`);
    await Promise.all(kinds.map((k) => gen(k, model, n, hi)));
  } else if (cmd === 'use') {
    if (!GROUND_KINDS[rest[0]] || !rest[1]) throw new Error('Aufruf: use <art> <datei>');
    await use(rest[0], rest[1], crop, keepColors);
  } else if (cmd === 'sheet') {
    await sheet(rest.length ? rest : Object.keys(GROUND_KINDS));
  } else {
    console.log('Aufruf: ground.mjs gen <art|all> [--model …] [--n 2] | use <art> <datei> | sheet [art …]');
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
