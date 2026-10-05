// Painted single images (title image, loading image, herald portrait, individual icons) via an OpenRouter image model.
//
//   node scripts/art/generate.mjs <job> [--model …] [--size 1K|2K|4K] [--aspect 16:9]
//
// Job: assets-src/art/<job>/job.json – model, format, reference images (optionally with crop) –
// and prompt.txt (the full prompt). Result: assets-src/art/<job>/raw-N.webp, each run with
// model, duration and cost in job.json → runs. Post-processing: python3 scripts/art/finish.py <job>.
// Key: OPENROUTER_API_KEY (in the cloud container the proxy injects it). It is never printed.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { reexecWithProxy, openrouter, ROOT } from '../asset-gen/lib.mjs';
import { requireAssetsSrc } from '../require-assets-src.mjs';

reexecWithProxy();

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
const model = opt('--model'), size = opt('--size'), aspect = opt('--aspect');
const [name] = args;
if (!name) { console.error('Usage: generate.mjs <job> [--model …] [--size 2K] [--aspect 16:9]'); process.exit(1); }
requireAssetsSrc('art', name);
const dir = path.join(ROOT, 'assets-src/art', name);
const job = JSON.parse(fs.readFileSync(path.join(dir, 'job.json'), 'utf8'));
const prompt = fs.readFileSync(path.join(dir, 'prompt.txt'), 'utf8').trim();

/** Reference image as PNG data URL; `crop: [x, y, w, h]` cuts out a section, `max` limits the edge length. */
async function ref(r) {
  let img = sharp(path.join(ROOT, r.file)).flatten({ background: r.bg ?? '#ffffff' });
  if (r.crop) img = img.extract({ left: r.crop[0], top: r.crop[1], width: r.crop[2], height: r.crop[3] });
  const buf = await img.resize({ width: r.max ?? 1024, height: r.max ?? 1024, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  return { type: 'image_url', image_url: { url: `data:image/png;base64,${buf.toString('base64')}` } };
}

const m = model ?? job.model;
const images = await Promise.all((job.refs ?? []).map(ref));
const t0 = Date.now();
const res = await openrouter({
  model: m, modalities: ['image', 'text'],
  image_config: { aspect_ratio: aspect ?? job.aspect ?? '1:1', image_size: size ?? job.size ?? '1K' },
  messages: [{ role: 'user', content: [...images, { type: 'text', text: prompt }] }],
});
const url = res.choices?.[0]?.message?.images?.[0]?.image_url?.url;
if (!url) { console.error('No image:', JSON.stringify(res.choices?.[0]?.message?.content ?? res).slice(0, 500)); process.exit(1); }
let n = 1;
while (fs.existsSync(path.join(dir, `raw-${n}.webp`))) n++;
const out = path.join(dir, `raw-${n}.webp`);
// Raw image as WebP (quality 92) like assets-src/icons/sheet.webp – saves space in the repo
await sharp(Buffer.from(url.split(',')[1], 'base64')).webp({ quality: 92, effort: 6 }).toFile(out);
const meta = await sharp(out).metadata();
const run = { file: `raw-${n}.webp`, model: m, size: `${meta.width}x${meta.height}`, seconds: Math.round((Date.now() - t0) / 1000), cost: res.usage?.cost ?? null };
job.runs = [...(job.runs ?? []), run];
fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify(job, null, 2) + '\n');
console.log(`${name}: ${path.relative(ROOT, out)} ${run.size} in ${run.seconds} s, cost ${run.cost ?? '?'} $`);
