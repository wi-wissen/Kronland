// Builds a level pack for a static source (docs/SERVER.md) from level .zip files (editor: "Speichern").
//
//   node scripts/build-pack.mjs --id wi7.my-pack --title "Titel|Title" [--summary "Text|Text"] [--author wi7]
//        [--license CC-BY-4.0] [--min-client 1.0.0] --out site/ level1.zip level2.zip …
//
// Writes <out>/packs/<id>/pack.json and the hash-named files next to it and adds the pack to <out>/catalog.json
// (created if missing). Publish <out>/ on any static host (GitHub Pages: docs/SERVER.md).

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { readLevelZip } from '../src/levels/package.js';
import { buildPackFiles } from '../src/net/packBuild.js';
import pkg from '../package.json' with { type: 'json' };

const GAME_VERSION = pkg.version;

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args.splice(i, 2)[1] : fallback; };
const text = (v) => (v ? { de: v.split('|')[0], en: v.split('|')[1] ?? v.split('|')[0] } : undefined);

const id = opt('id'), title = opt('title'), out = opt('out', 'site');
const info = { id, title: text(title), summary: text(opt('summary')), author: opt('author'), license: opt('license'), minClient: opt('min-client', GAME_VERSION) };
const zips = args;
if (!id || !title || !zips.length) {
  console.error('usage: node scripts/build-pack.mjs --id <publisher.name> --title "Titel|Title" [--summary …] [--author …] [--license …] [--min-client x.y.z] --out <dir> level.zip …');
  process.exit(1);
}

const levels = zips.map((z) => {
  const level = readLevelZip(readFileSync(z));
  if (!level.scenario) { console.error(`${z}: ${level.problems.join('; ')}`); process.exit(1); }
  return { scenario: level.scenario, files: level.assets };
});
const { manifest, hash, files, pack } = await buildPackFiles(info, levels);

const dir = join(out, 'packs', id);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'pack.json'), manifest);
for (const [name, data] of files) writeFileSync(join(dir, name), data instanceof Blob ? Buffer.from(await data.arrayBuffer()) : data);

const catalogPath = join(out, 'catalog.json');
const catalog = existsSync(catalogPath) ? JSON.parse(readFileSync(catalogPath, 'utf8')) : { format: 'kronland-catalog', version: 1, name: pack.title, packs: [] };
const entry = {
  id, title: pack.title, ...(pack.summary ? { summary: pack.summary } : {}), ...(pack.preview ? { preview: `packs/${id}/${pack.preview}` } : {}),
  levels: pack.levels.length, ...(pack.minClient ? { minClient: pack.minClient } : {}), access: 'open', manifest: `packs/${id}/pack.json`, sha256: hash,
};
catalog.packs = [...catalog.packs.filter((p) => p.id !== id), entry];
mkdirSync(dirname(catalogPath), { recursive: true });
writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
console.log(`pack ${id}: ${pack.levels.length} level(s), ${files.size} files -> ${dir}\ncatalog: ${catalogPath} (sha256 ${hash})`);
