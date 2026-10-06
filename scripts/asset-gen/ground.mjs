// Ground textures via image AI: painted, seamlessly tileable textures for grass, meadow, earth, sand, rock and snow.
// Plus nature textures (foliage, needles, bark, boulders) for the structure on trees, bushes and rocks
// (src/render/naturetex.js): same commands, sources under assets-src/nature/, output public/textures/nature/.
//
//   node scripts/asset-gen/ground.mjs gen <kind|all> [--model …] [--n 2] [--hi]
//       generate candidates → assets-src/ground/<kind>/<nr>-<model>.webp (--hi: 2K instead of 1K, Seedream only)
//   node scripts/asset-gen/ground.mjs use <kind> <file> [--crop 0.02] [--keep-colors]
//       adopt a candidate: cut off the edge, match the mean colour (GROUND_TARGETS), make seamless
//       → public/textures/ground/<kind>.webp (1024) and <kind>-512.webp
//   node scripts/asset-gen/ground.mjs sheet [kind …]
//       overview: each candidate tiled 2×2 (seams visible) → assets-src/ground/candidates.webp
//   node scripts/asset-gen/ground.mjs gen nature --n 2     (nature kinds: leaves, needles, bark, boulder, planks, masonry)
//   node scripts/asset-gen/ground.mjs sheet nature         → assets-src/nature/candidates.webp
//   node scripts/asset-gen/ground.mjs use bark 1-seedream-5-0-flash.webp → public/textures/nature/bark-512.webp
//
// Prompts, model and cost per image: assets-src/ground/ground.json. Workflow and style: docs/BODEN.md.
// All models run via OpenRouter's image API (/api/v1/images), also GPT-Image (cheaper there
// than via chat completions). Slow models are cut off after ~30 s in the cloud environment.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { reexecWithProxy, ROOT } from './lib.mjs';
import { makeSeamless, shiftMean } from './groundtex.mjs';
import { requireAssetsSrc } from '../require-assets-src.mjs';

requireAssetsSrc();
reexecWithProxy();

/** Folder per set: ground or nature (nature kinds are in NATURE_KINDS). */
const DIRS = {
  ground: { src: path.join(ROOT, 'assets-src/ground'), out: path.join(ROOT, 'public/textures/ground'), log: 'ground.json' },
  nature: { src: path.join(ROOT, 'assets-src/nature'), out: path.join(ROOT, 'public/textures/nature'), log: 'nature.json' },
};
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

/** Style of the nature textures: side view, bold coarse shapes with light and shadow (applied triplanar). */
export const NATURE_STYLE = 'Seamless tileable square texture for stylized low-poly 3D trees, bushes and rocks in a cozy '
  + 'medieval village-building strategy game. Hand-painted look matching a warm, cozy 3D animated film: bold simple '
  + 'painterly shapes with clear light and shadow accents, large readable forms instead of fine noise, soft brush strokes, '
  + 'strong value contrast between lit tops and shaded undersides of each shape. The surface fills the whole square, seen '
  + 'flat-on. Even lighting across the whole image with no overall gradient, no vignette, no border, no frame, no text, '
  + 'no background, no sky. Organic irregular distribution with no grid, no rows and no visibly repeating motif. All four '
  + 'edges must continue seamlessly.';

/** Content per nature kind. */
export const NATURE_KINDS = {
  leaves: 'Content: dense broadleaf tree foliage seen from the side, built from large rounded clumps of leaves. Each clump '
    + 'is a soft painted blob with a bright sunlit yellow-green upper rim and a darker cool green shadow underneath, a few '
    + 'simple leaf shapes along the clump edges. The clumps overlap like scales and fill the image completely, about 5 to '
    + '6 clumps across the image. No branches, no gaps, no sky, no flowers, no fruit.',
  needles: 'Content: a close-up of the dense surface of a single big fir tree crown, completely filled with overlapping '
    + 'feathery fir branch sprays (not whole trees, no tree silhouettes, no triangles). Each spray is a soft painted '
    + 'fan of short needles hanging slightly downward, with a lighter fresh green upper edge and a dark cool green '
    + 'shadow underneath, sprays overlapping in an irregular scale-like pattern, about 6 sprays across the image, deep '
    + 'blue-green. No trunk, no cones, no gaps, no sky.',
  bark: 'Content: rough bark of an old oak trunk seen face-on. Strictly vertical grain: long vertical ridges and deep '
    + 'furrows running from the top edge to the bottom edge, painted in warm browns with lighter ridge tops and dark '
    + 'furrows, a few small knots. No moss, no leaves, no horizontal cuts.',
  boulder: 'Content: surface of a big weathered granite boulder seen face-on: broad flat facets and chunky planes '
    + 'separated by a few bold dark cracks, lighter warm grey highlights on the facets and cool grey shadows in the '
    + 'cracks, a few small lichen spots in muted olive. Large shapes only, about 4 to 6 facets across the image. No fine '
    + 'gravel, no pebbles, no grass, no moss carpet.',
  planks: 'Content: rough sawn wooden planks and beams seen face-on, all running horizontally from the left edge to the '
    + 'right edge, about 5 boards stacked top to bottom, painted wood grain with lighter worn edges and dark gaps between '
    + 'the boards, a few iron nails and small knots, warm honey-brown. No bark, no paint, no metal plates.',
  masonry: 'Content: a wall of roughly cut light grey stone blocks seen face-on, irregular rectangular blocks of different '
    + 'sizes in staggered courses with dark mortar joints, each block bevelled with a lighter top edge and a cool shadow '
    + 'on its lower edge, a few chipped corners. About 5 courses top to bottom. No moss, no plants, no windows.',
};

/** Mean target colour per nature kind (in the game only the brightness structure counts, the hue comes from the model). */
export const NATURE_TARGETS = { leaves: [92, 132, 56], needles: [56, 94, 60], bark: [112, 82, 54], boulder: [138, 133, 122], planks: [150, 108, 66], masonry: [150, 146, 138] };

const setOf = (kind) => (NATURE_KINDS[kind] ? 'nature' : 'ground');
const promptOf = (kind) => (setOf(kind) === 'nature' ? `${NATURE_STYLE}\n${NATURE_KINDS[kind]}` : `${GROUND_STYLE}\n${GROUND_KINDS[kind]}`);
const targetOf = (kind) => (setOf(kind) === 'nature' ? NATURE_TARGETS : GROUND_TARGETS)[kind];

const slug = (m) => m.split('/').pop().replace(/[^a-z0-9.-]+/gi, '-');
const logFile = (set) => path.join(DIRS[set].src, DIRS[set].log);
const readLog = (set) => (fs.existsSync(logFile(set)) ? JSON.parse(fs.readFileSync(logFile(set), 'utf8')) : { images: [] });
const writeLog = (set, l) => { fs.mkdirSync(DIRS[set].src, { recursive: true }); fs.writeFileSync(logFile(set), JSON.stringify(l, null, 2) + '\n'); };

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
  const prompt = promptOf(kind), set = setOf(kind), SRC = DIRS[set].src;
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
    const log = readLog(set);
    log.images.push({ kind, file: path.relative(SRC, file), model, prompt, ...extra, cost });
    writeLog(set, log);
    console.log(path.relative(ROOT, file), cost != null ? `(${cost.toFixed(3)} $)` : '');
  }
}

/** Adopt a candidate: cut off the edge, make seamless, write as WebP in two sizes. */
async function use(kind, file, crop, keepColors) {
  // path as given, otherwise relative to assets-src/<set>/<kind>/ or assets-src/<set>/
  const set = setOf(kind), { src: SRC, out: OUT } = DIRS[set];
  const src = [file, path.join(SRC, kind, file), path.join(SRC, file)].find((f) => fs.existsSync(f));
  if (!src) throw new Error(`File not found: ${file}`);
  const meta = await sharp(src).metadata();
  const c = Math.round(Math.min(meta.width, meta.height) * crop);
  const side = Math.min(meta.width, meta.height) - 2 * c;
  const { data, info } = await sharp(src).extract({ left: c, top: c, width: side, height: side })
    .resize(1024, 1024, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const target = keepColors ? null : targetOf(kind);
  const px = makeSeamless(target ? shiftMean(data, target) : data, info.width, info.height, 3);
  const img = sharp(Buffer.from(px), { raw: { width: info.width, height: info.height, channels: 3 } });
  fs.mkdirSync(OUT, { recursive: true });
  // the game loads nature textures only at 512 (naturetex.js): the large version stays as a raw file in assets-src/
  const big = set === 'nature' ? path.join(SRC, kind, `${kind}-1024.webp`) : path.join(OUT, `${kind}.webp`);
  await img.clone().webp({ quality: 86 }).toFile(big);
  await img.clone().resize(512, 512, { kernel: 'lanczos3' }).webp({ quality: 86 }).toFile(path.join(OUT, `${kind}-512.webp`));
  const log = readLog(set);
  log.used = { ...(log.used ?? {}), [kind]: { file: path.relative(SRC, src), crop, target } };
  writeLog(set, log);
  console.log(`${kind}: ${path.relative(ROOT, src)} → ${path.relative(ROOT, big)}, ${path.relative(ROOT, OUT)}/${kind}-512.webp`);
}

/** Overview: each candidate made seamless and tiled 2×2, with label. */
async function sheet(kinds) {
  const tiles = [];
  for (const kind of kinds) {
    const dir = path.join(DIRS[setOf(kind)].src, kind);
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
  const out = path.join(DIRS[setOf(kinds[0])].src, 'candidates.webp');
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
    const kinds = rest[0] === 'all' ? Object.keys(GROUND_KINDS) : rest[0] === 'nature' ? Object.keys(NATURE_KINDS) : rest;
    for (const k of kinds) if (!GROUND_KINDS[k] && !NATURE_KINDS[k]) throw new Error(`Unknown kind: ${k}`);
    await Promise.all(kinds.map((k) => gen(k, model, n, hi)));
  } else if (cmd === 'use') {
    if ((!GROUND_KINDS[rest[0]] && !NATURE_KINDS[rest[0]]) || !rest[1]) throw new Error('Usage: use <kind> <file>');
    await use(rest[0], rest[1], crop, keepColors);
  } else if (cmd === 'sheet') {
    await sheet(rest[0] === 'nature' ? Object.keys(NATURE_KINDS) : rest.length ? rest : Object.keys(GROUND_KINDS));
  } else {
    console.log('Usage: ground.mjs gen <kind|all|nature> [--model …] [--n 2] | use <kind> <file> | sheet [kind …|nature]');
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
