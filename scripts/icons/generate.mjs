// Has an image model repaint all icons of the template in one pass via OpenRouter.
//   NODE_USE_ENV_PROXY=1 node scripts/icons/generate.mjs <model> <output-without-extension> [1K|2K|4K]
// Example: node scripts/icons/generate.mjs openai/gpt-5.4-image-2 /tmp/sheet 2K
// Key: OPENROUTER_API_KEY (in the cloud container the proxy injects it itself).
// Inputs: assets-src/icons/template.png (content), style-prompt.txt (style description), assets-src/icons/style-1.webp, style-2.webp (style references), layout.json.
import fs from 'node:fs';
import { requireAssetsSrc } from '../require-assets-src.mjs';

const [model, out, size = '2K'] = process.argv.slice(2);
if (!model || !out) { console.error('Usage: generate.mjs <model> <output> [1K|2K|4K]'); process.exit(1); }
requireAssetsSrc('icons');
const L = JSON.parse(fs.readFileSync('assets-src/icons/layout.json', 'utf8'));
const uri = (f, mime) => `data:${mime};base64,` + fs.readFileSync(f).toString('base64');
// Style block from the style reference (docs/STILREFERENZ.md), condensed for icons
const STYLE = fs.readFileSync('assets-src/icons/style-prompt.txt', 'utf8').trim();
const list = [];
for (let r = 0; r < L.rows; r++) list.push(`Row ${r + 1}: ` + L.names.slice(r * L.cols, r * L.cols + L.cols).join(', '));

const prompt = `You get three images.
IMAGE 1 is a layout sheet of ${L.names.length} placeholder icons for a medieval village-building strategy game, arranged in a strict grid of ${L.cols} columns x ${L.rows} rows (the last row has empty cells at the end). It only defines WHAT goes in each cell – ignore its flat clip-art look completely.
IMAGES 2 and 3 are character turnaround sheets of two villagers from this game. They define the ART STYLE that every icon must match, as if all icons were made by the same studio for the same game as these two characters.

${STYLE}

Task: Repaint EVERY cell of image 1 in this style, as one new image with exactly the same grid: ${L.cols} columns x ${L.rows} rows, same order, same subject in each cell, each icon centered and filling about 80 % of its cell, the empty cells stay empty. Each icon must stay readable at 48 px: one clear subject with a bold silhouette, 3/4 view where it makes sense.
Background: plain uniform pure white (#FFFFFF) everywhere, no gradients, no drop shadows, no frames, no grid lines, no tiles or badges behind icons.
No text, no letters, no numbers, no labels anywhere.
Keep the meaning of each icon ("b-…" are buildings, "u-…" soldier unit types, "hero-…" hero portraits, "ab-…" hero abilities, "cat-…" building categories, "weather-…" seasons; clay is a chunk of reddish clay, stone a rough stone block, iron iron bars, sulfur yellow sulfur crystals, gold gold coins).
Cell contents (row by row, left to right):
${list.join('\n')}`;

const body = {
  model,
  modalities: ['image', 'text'],
  messages: [{ role: 'user', content: [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: uri('assets-src/icons/template.png', 'image/png') } },
    { type: 'image_url', image_url: { url: uri('assets-src/icons/style-1.webp', 'image/webp') } },
    { type: 'image_url', image_url: { url: uri('assets-src/icons/style-2.webp', 'image/webp') } },
  ] }],
  image_config: { aspect_ratio: '3:2', image_size: size },
};
fs.writeFileSync(out + '.prompt.txt', prompt);
const t0 = Date.now();
const headers = { 'Content-Type': 'application/json', 'X-Title': 'Kronland Icons' };
if (process.env.OPENROUTER_API_KEY) headers.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY}`;
const res = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers, body: JSON.stringify(body) });
const j = await res.json();
const img = j.choices?.[0]?.message?.images?.[0]?.image_url?.url;
if (!img) { console.error('No image:', res.status, JSON.stringify(j).slice(0, 800)); process.exit(1); }
const [, ext, b64] = img.match(/^data:image\/(\w+);base64,(.*)$/);
fs.writeFileSync(`${out}.${ext}`, Buffer.from(b64, 'base64'));
console.log(`${model}: ${out}.${ext} in ${Math.round((Date.now() - t0) / 1000)} s, cost ${j.usage?.cost ?? '?'} $`);
