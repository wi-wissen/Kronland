// Level packages: a level is a folder (scenario.json, .py files, assets/); to pass it on, the same folder is a
// normal .zip. A level can also be opened by link from a static host – as .zip or as folder (next to its
// scenario.json). Format: docs/SKRIPTE.md#level-ordner. Assets only serve the display, the simulation never sees them.

import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { packLevel, unpackLevel, validateScenario, SECTION_FILE_RE } from '../sim/scripting/scenario.js';
import { ASSET_TYPES, assetAllowed, extOf } from './assets.js';

/** Limits for packages from other people: number of files, size per asset and in total (bytes). */
export const PACKAGE_LIMITS = { files: 300, asset: 15_000_000, total: 60_000_000, json: 1_000_000, code: 200_000 };

/**
 * Level from the files of a folder or .zip.
 * @param {Record<string, Uint8Array>} files path → content (a single enclosing folder is ignored)
 * @returns {{ scenario: any|null, assets: Map<string, Blob>, problems: string[] }}
 */
export function levelFromFiles(files) {
  const problems = [];
  let names = Object.keys(files).filter((n) => !n.endsWith('/') && !/(^|\/)(__MACOSX|\.DS_Store)/.test(n));
  // Zipped folder "lindgrund/scenario.json": strip the common folder
  if (!names.includes('scenario.json')) {
    const top = names.find((n) => /^[^/]+\/scenario\.json$/.test(n));
    if (top) {
      const prefix = top.slice(0, top.indexOf('/') + 1);
      names = names.filter((n) => n.startsWith(prefix));
      files = Object.fromEntries(names.map((n) => [n.slice(prefix.length), files[n]]));
      names = Object.keys(files);
    }
  }
  if (!names.includes('scenario.json')) return { scenario: null, assets: new Map(), problems: ['scenario.json missing'] };
  if (names.length > PACKAGE_LIMITS.files) return { scenario: null, assets: new Map(), problems: [`at most ${PACKAGE_LIMITS.files} files`] };
  const total = names.reduce((n, k) => n + files[k].length, 0);
  if (total > PACKAGE_LIMITS.total) return { scenario: null, assets: new Map(), problems: ['package too large'] };
  if (files['scenario.json'].length > PACKAGE_LIMITS.json) return { scenario: null, assets: new Map(), problems: ['scenario.json too large'] };
  let json;
  try { json = JSON.parse(strFromU8(files['scenario.json']).replace(/^﻿/, '')); } catch (e) {
    return { scenario: null, assets: new Map(), problems: [`scenario.json: ${e.message}`] };
  }
  const read = (name) => (SECTION_FILE_RE.test(name) && files[name] && files[name].length <= PACKAGE_LIMITS.code ? strFromU8(files[name]) : null);
  const scenario = json && typeof json === 'object' ? packLevel(json, read) : json;
  problems.push(...validateScenario(scenario));
  const assets = new Map();
  for (const n of names) {
    if (n === 'scenario.json' || /^[^/]+\.py$/.test(n)) continue;
    if (!assetAllowed(n)) continue; // other files (README, sources) are simply not used
    if (files[n].length > PACKAGE_LIMITS.asset) { problems.push(`${n} too large`); continue; }
    assets.set(n, new Blob([files[n]], { type: ASSET_TYPES[extOf(n)] }));
  }
  return { scenario: problems.length ? null : scenario, assets, problems };
}

/**
 * Read a .zip.
 * @param {ArrayBuffer|Uint8Array} data
 */
export function readLevelZip(data) {
  let files;
  try {
    let count = 0;
    files = unzipSync(data instanceof Uint8Array ? data : new Uint8Array(data), {
      // stop early on packages with very many entries
      filter: (f) => ++count <= PACKAGE_LIMITS.files * 2 && f.originalSize <= PACKAGE_LIMITS.total,
    });
  } catch (e) {
    return { scenario: null, assets: new Map(), problems: [`not a zip file (${e.message})`] };
  }
  return levelFromFiles(files);
}

/**
 * Level → .zip: scenario.json, one .py file per section and assets/.
 * @param {any} scenario packed scenario @param {Map<string, Blob|Uint8Array>} [assets]
 * @returns {Promise<Uint8Array>}
 */
export async function writeLevelZip(scenario, assets = new Map()) {
  const { json, files } = unpackLevel(scenario);
  delete json.folder;
  const out = { 'scenario.json': strToU8(JSON.stringify(json, null, 2) + '\n') };
  for (const [name, code] of Object.entries(files)) out[name] = strToU8(code);
  for (const [path, data] of assets) {
    if (!assetAllowed(path)) continue;
    out[path] = data instanceof Uint8Array ? data : new Uint8Array(await data.arrayBuffer());
  }
  // Pictures, sounds and models are compressed already
  return zipSync(out, { level: 6, mtime: new Date('2026-01-01T00:00:00Z') });
}

/** Is the address a .zip (otherwise a folder or its scenario.json)? */
const isZip = (url) => /\.zip$/i.test(new URL(url).pathname);

/**
 * Open a level by link: a .zip or a folder on a static host (its assets stay there and load when needed).
 * @param {string} link absolute or relative to the page
 * @param {typeof fetch} [get]
 * @returns {Promise<{ scenario: any|null, assets: Map<string, Blob>, base: string|null, problems: string[] }>}
 */
export async function fetchLevel(link, get = fetch) {
  let url;
  try { url = new URL(link, globalThis.location?.href ?? 'http://localhost/').href; } catch { return { scenario: null, assets: new Map(), base: null, problems: ['invalid address'] }; }
  if (!/^https?:$/.test(new URL(url).protocol)) return { scenario: null, assets: new Map(), base: null, problems: ['only http(s) addresses'] };
  if (isZip(url)) {
    const r = await get(url);
    if (!r.ok) return { scenario: null, assets: new Map(), base: null, problems: [`HTTP ${r.status}`] };
    return { ...readLevelZip(await r.arrayBuffer()), base: null };
  }
  const json = /\/scenario\.json$/i.test(new URL(url).pathname) ? url : new URL('scenario.json', url.endsWith('/') ? url : `${url}/`).href;
  const base = new URL('./', json).href;
  const r = await get(json);
  if (!r.ok) return { scenario: null, assets: new Map(), base, problems: [`HTTP ${r.status}`] };
  const files = { 'scenario.json': new Uint8Array(await r.arrayBuffer()) };
  let meta;
  try { meta = JSON.parse(strFromU8(files['scenario.json'])); } catch (e) { return { scenario: null, assets: new Map(), base, problems: [`scenario.json: ${e.message}`] }; }
  const names = (Array.isArray(meta?.sections) ? meta.sections : []).map((s) => s?.file).filter((f) => typeof f === 'string' && SECTION_FILE_RE.test(f));
  await Promise.all([...new Set(names)].map(async (f) => {
    const q = await get(new URL(f, base).href);
    if (q.ok) files[f] = new Uint8Array(await q.arrayBuffer());
  }));
  return { ...levelFromFiles(files), base };
}
