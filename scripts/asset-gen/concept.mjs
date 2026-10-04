// Create or edit concept images via an OpenRouter image model.
//
//   node scripts/asset-gen/concept.mjs edit <id> "<change>" [--from sheet.webp] [--model …]
//       edits the concept sheet (e.g. "cap in marker colour"), result: sheet.png (original → sheet-vN.*)
//   node scripts/asset-gen/concept.mjs new <id> "<description>" --ref <id>[,<id>] [--model …]
//       new sheet in the style of the templates (their sheet.* as reference images), result: sheet.png
//   node scripts/asset-gen/concept.mjs female <id> --from <male id>
//       female variant from the male sheet (same clothing, same style)
//   node scripts/asset-gen/concept.mjs far <id> --from <id of the detail sheet>
//       simplified far concept for the game model (hair as a block, large colour areas, simple face)
//   --guide  appends the detailed style reference (assets-src/characters/style-reference-prompt.md) to the prompt
//            (heroes: `new nelia --ref serf,serf_f --guide --model openai/gpt-5.4-image-2 "…"`)
//
// Prompts and model end up in assets-src/characters/<id>/concept.json (traceable, repeatable).
// Style rules and templates: docs/STIL.md.

import fs from 'node:fs';
import path from 'node:path';
import { reexecWithProxy, openrouter, dataUri, SRC_DIR } from './lib.mjs';
import { STYLE, FEMALE, FAR } from './style.mjs';

reexecWithProxy();

const DEFAULT_MODEL = 'google/gemini-3-pro-image';

const sheetOf = (id) => ['sheet.png', 'sheet.webp', 'sheet.jpg'].map((f) => path.join(SRC_DIR, id, f)).find((f) => fs.existsSync(f));

async function generate(model, text, images) {
  const res = await openrouter({
    model, modalities: ['image', 'text'],
    messages: [{ role: 'user', content: [...images.map((f) => ({ type: 'image_url', image_url: { url: dataUri(f) } })), { type: 'text', text }] }],
  });
  const url = res.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error('No image in the response: ' + JSON.stringify(res.choices?.[0]?.message?.content ?? res).slice(0, 300));
  return { buf: Buffer.from(url.split(',')[1], 'base64'), cost: res.usage?.cost };
}

/** Save the old sheet.* as sheet-vN.*, write the new image as sheet.png. */
function store(id, buf) {
  const dir = path.join(SRC_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  const old = sheetOf(id);
  if (old) {
    let n = 1;
    while (fs.readdirSync(dir).some((f) => f.startsWith(`sheet-v${n}.`))) n++;
    fs.renameSync(old, path.join(dir, `sheet-v${n}${path.extname(old)}`));
  }
  fs.writeFileSync(path.join(dir, 'sheet.png'), buf);
  return path.join(dir, 'sheet.png');
}

function log(id, entry) {
  const f = path.join(SRC_DIR, id, 'concept.json');
  const c = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : { steps: [] };
  c.steps.push(entry);
  fs.writeFileSync(f, JSON.stringify(c, null, 2) + '\n');
}

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
const model = opt('--model') ?? DEFAULT_MODEL;
const from = opt('--from');
const ref = opt('--ref');
const guideAt = args.indexOf('--guide');
if (guideAt >= 0) args.splice(guideAt, 1);
const GUIDE = guideAt >= 0 ? '\n\n' + fs.readFileSync(path.join(SRC_DIR, 'style-reference-prompt.md'), 'utf8') : '';
const [cmd, id, text] = args;

try {
  if (cmd === 'edit') {
    const src = from ? path.join(SRC_DIR, id, from) : sheetOf(id);
    const prompt = `Edit this character turnaround sheet. Change ONLY the following, keep everything else identical (pose, proportions, clothing, colors, style, layout of the four views, plain light background): ${text}`;
    const { buf, cost } = await generate(model, prompt, [src]);
    const out = store(id, buf);
    log(id, { kind: 'edit', model, prompt, source: path.basename(src), cost });
    console.log(out, cost ? `(${cost.toFixed(3)} $)` : '');
  } else if (cmd === 'female') {
    const src = sheetOf(from);
    const prompt = `${FEMALE}\n${STYLE}`;
    const { buf, cost } = await generate(model, prompt, [src]);
    const out = store(id, buf);
    log(id, { kind: 'female', model, prompt, source: `${from}/${path.basename(src)}`, cost });
    console.log(out, cost ? `(${cost.toFixed(3)} $)` : '');
  } else if (cmd === 'far') {
    const src = sheetOf(from);
    const { buf, cost } = await generate(model, FAR, [src]);
    const out = store(id, buf);
    log(id, { kind: 'far', model, prompt: FAR, source: `${from}/${path.basename(src)}`, cost });
    console.log(out, cost ? `(${cost.toFixed(3)} $)` : '');
  } else if (cmd === 'new') {
    const refs = (ref ?? '').split(',').filter(Boolean).map(sheetOf).filter(Boolean);
    const prompt = `Use the attached character sheets only as STYLE reference (rendering, proportions, palette, marker color usage). Create a NEW character: ${text}\n${STYLE}${GUIDE}`;
    const { buf, cost } = await generate(model, prompt, refs);
    const out = store(id, buf);
    log(id, { kind: 'new', model, prompt, refs: ref, cost });
    console.log(out, cost ? `(${cost.toFixed(3)} $)` : '');
  } else {
    console.error('Usage: concept.mjs edit|new|female|far <id> …');
    process.exit(1);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
