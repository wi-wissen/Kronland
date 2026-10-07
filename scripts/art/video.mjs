// Painted image → short video clip via an OpenRouter video model (image-to-video). For the animated menu backdrop
// the still image is passed as first AND last frame, so the clip ends where it starts and loops without a cut.
//
//   node scripts/art/video.mjs <job> [--model …] [--resolution 720p] [--duration 8]
//
// Job: assets-src/art/<job>/job.json – model, frame (still image, relative to the repo), resolution, duration,
// aspect, loop (true: still also as last frame) – and prompt.txt. Result: assets-src/art/<job>/raw-N.mp4, each run
// with model, duration and cost in job.json → runs. Post-processing: node scripts/art/loop.mjs <job> <raw-N.mp4>.
// Key: OPENROUTER_API_KEY (in the cloud container the proxy injects it). It is never printed.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { reexecWithProxy, ROOT } from '../asset-gen/lib.mjs';
import { requireAssetsSrc } from '../require-assets-src.mjs';

reexecWithProxy();

const API = 'https://openrouter.ai/api/v1/videos';
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
const model = opt('--model'), resolution = opt('--resolution'), duration = opt('--duration');
const [name] = args;
if (!name) { console.error('Usage: video.mjs <job> [--model …] [--resolution 720p] [--duration 8]'); process.exit(1); }
requireAssetsSrc('art', name);
const dir = path.join(ROOT, 'assets-src/art', name);
const job = JSON.parse(fs.readFileSync(path.join(dir, 'job.json'), 'utf8'));
const prompt = fs.readFileSync(path.join(dir, 'prompt.txt'), 'utf8').trim();

const headers = { 'Content-Type': 'application/json', 'X-Title': 'Kronland asset-gen' };
if (process.env.OPENROUTER_API_KEY) headers.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY}`;

async function api(url, body) {
  const r = await fetch(url, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${text.slice(0, 600)}`);
  return JSON.parse(text);
}

// Still image as JPEG data URL, cropped to the exact aspect of the clip (16:9 by default)
const [aw, ah] = (job.aspect ?? '16:9').split(':').map(Number);
const W = 1920, H = Math.round(W * ah / aw);
const still = await sharp(path.join(ROOT, job.frame)).resize(W, H, { fit: 'cover', position: job.position ?? 'centre' }).jpeg({ quality: 92 }).toBuffer();
const frame = (frame_type) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${still.toString('base64')}` }, frame_type });

const m = model ?? job.model;
const body = {
  model: m, prompt,
  resolution: resolution ?? job.resolution ?? '720p',
  aspect_ratio: job.aspect ?? '16:9',
  duration: Number(duration ?? job.duration ?? 8),
  generate_audio: false,
  frame_images: job.loop === false ? [frame('first_frame')] : [frame('first_frame'), frame('last_frame')],
};
const t0 = Date.now();
const sub = await api(API, body);
console.log(`${name}: job ${sub.id} (${m}, ${body.resolution}, ${body.duration} s) submitted`);
let st;
for (;;) {
  await new Promise((res) => setTimeout(res, 15000));
  st = await api(sub.polling_url ?? `${API}/${sub.id}`);
  process.stdout.write(`\r${name}: ${st.status} after ${Math.round((Date.now() - t0) / 1000)} s   `);
  if (st.status === 'completed') break;
  if (st.status === 'failed' || st.status === 'cancelled') { console.error(`\n${name}: failed: ${JSON.stringify(st.error ?? st).slice(0, 600)}`); process.exit(1); }
}
const r = await fetch(st.unsigned_urls[0], { headers });
if (!r.ok) throw new Error(`Download ${r.status}`);
let n = 1;
const data = Buffer.from(await r.arrayBuffer());
while (fs.existsSync(path.join(dir, `raw-${n}.mp4`))) n++;
const out = path.join(dir, `raw-${n}.mp4`);
fs.writeFileSync(out, data);
const run = { file: `raw-${n}.mp4`, model: m, prompt, resolution: body.resolution, duration: body.duration, seconds: Math.round((Date.now() - t0) / 1000), cost: st.usage?.cost ?? null };
// Re-read: several runs of the same job may be in flight (e.g. different models)
const now = JSON.parse(fs.readFileSync(path.join(dir, 'job.json'), 'utf8'));
now.runs = [...(now.runs ?? []), run];
fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify(now, null, 2) + '\n');
console.log(`\n${name}: ${path.relative(ROOT, out)} in ${run.seconds} s, cost ${run.cost ?? '?'} $`);
