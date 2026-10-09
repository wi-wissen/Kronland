// Builds the example pack contract/fixtures/pack-adventures-2/ from the bundled coding adventures
// (hash-named files as the pack format demands) and writes its SHA-256 into the catalog fixtures.
//   node contract/build-fixtures.mjs
// The result is committed; tests/net/fixtures.test.js checks that it is up to date.

import { createHash } from 'node:crypto';
import { deflateSync, crc32 } from 'node:zlib';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { ADVENTURES } from '../src/sim/missions/levels/index.js';

const ROOT = new URL('./fixtures/', import.meta.url);
const OUT = new URL('pack-adventures-2/', ROOT);
export const PACK_ID = 'wi7.adventures-2';
const sha = (data) => createHash('sha256').update(data).digest('hex');

/** Small gradient PNG (the example's preview and portrait; generated, no third-party artwork). */
function gradientPng(w = 96, h = 64) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = 40 + Math.round((x / w) * 120); raw[o + 1] = 90 + Math.round((y / h) * 90); raw[o + 2] = 70;
    }
  }
  const chunk = (type, data) => {
    const t = Buffer.from(type), len = Buffer.alloc(4), crc = Buffer.alloc(4);
    len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export function buildPack() {
  const png = gradientPng();
  const mediaName = `${sha(png)}.png`;
  const files = new Map([[mediaName, png]]);
  const levels = ADVENTURES.slice(0, 5).map((s, i) => {
    const scenario = structuredClone(s);
    delete scenario.folder;
    delete scenario.next;
    if (i === 0) scenario.speakers = { nelia: { name: { de: 'Nelia', en: 'Nelia' }, portrait: `assets/${mediaName}`, color: '#c2493a' } };
    const text = JSON.stringify(scenario);
    const file = `${sha(text)}.json`;
    files.set(file, text);
    return { id: scenario.id, file };
  });
  const pack = {
    format: 'kronland-pack', version: 1, id: PACK_ID,
    title: { de: 'Programmier-Abenteuer 2', en: 'Coding Adventures 2' },
    summary: { de: 'Fünf Lernabenteuer: Schleifen, Bedingungen und Funktionen mit Nelia.', en: 'Five learning adventures: loops, conditions and functions with Nelia.' },
    author: 'wi7', license: 'CC-BY-4.0', minClient: '1.0.0', preview: mediaName, levels,
    media: { [mediaName]: { type: 'image/png', bytes: png.length } },
  };
  const manifest = JSON.stringify(pack, null, 2) + '\n';
  return { pack, manifest, files, hash: sha(manifest) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { pack, manifest, files, hash } = buildPack();
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(new URL('pack.json', OUT), manifest);
  for (const [name, data] of files) writeFileSync(new URL(name, OUT), data);
  // sha256 and level count into the catalog fixtures (the other entries are hand-written)
  for (const f of ['catalog-static.json', 'catalog-server.json', 'packs-me.json']) {
    const url = new URL(f, ROOT), cat = JSON.parse(readFileSync(url, 'utf8'));
    for (const e of cat.packs) if (e.id === PACK_ID) { e.sha256 = hash; e.levels = pack.levels.length; e.preview = `${e.manifest.replace(/[^/]*$/, '')}${pack.preview}`; }
    writeFileSync(url, JSON.stringify(cat, null, 2) + '\n');
  }
  // Own pack of the example player (editor view, GET /api/v1/packs/k7m2q9): one level
  const own = structuredClone(ADVENTURES[1]);
  delete own.folder; delete own.next;
  const doc = { format: 'kronland-pack', version: 1, id: 'k7m2q9', title: { de: 'Mein erstes Level', en: 'My first level' }, summary: { de: '', en: '' }, levels: [{ id: own.id, scenario: own }] };
  writeFileSync(new URL('pack-document.json', ROOT), JSON.stringify(doc, null, 2) + '\n');
  console.log(`pack ${PACK_ID}: ${files.size} files, pack.json ${hash}`);
}
