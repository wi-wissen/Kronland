// Level packs: load pack.json, check schema, formats, minClient and the SHA-256 of every file (Web Crypto), keep the
// files in IndexedDB for offline play and hand levels to the game (scenarioToDef via App.openLevel).
// File names are their own checksum: <sha256>.json / <sha256>.png … and never change, so cached files need no
// re-check. The state of a pack is the SHA-256 of its pack.json; progress and saves remember it.

import { validate } from './schema.js';
import { NetError } from './errors.js';
import { sha256Hex } from './hash.js';
import { validateScenario, scenarioToDef } from '../sim/scripting/scenario.js';
import { assetAllowed } from '../levels/assets.js';
import schema from '../../contract/schemas/pack.schema.json';
import { version as GAME_VERSION } from '../../package.json';

export const PACK_VERSION = 1;
/** Limits (docs/SERVER.md): manifest, level and media files. */
export const LIMITS = { manifest: 1_000_000, level: 2_000_000, media: 20_000_000, modelWarn: 5_000_000 };
const CONCURRENCY = 6;

/** -1/0/1 for "a.b.c" versions. */
export function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** Does this game version satisfy the pack's minClient? */
export const clientOk = (minClient, version = GAME_VERSION) => !minClient || compareVersions(minClient, version) <= 0;

export { sha256Hex };

/**
 * Where the files of a pack lie. Static sources: next to pack.json. The server's manifest endpoint
 * (…/packs/{id}/manifest) has its files at …/packs/{id}/files/ (the server may redirect to signed addresses).
 */
export function filesBase(manifestUrl) {
  const u = new URL(manifestUrl);
  u.search = ''; u.hash = '';
  u.pathname = /\/manifest$/.test(u.pathname) ? u.pathname.replace(/manifest$/, 'files/') : u.pathname.replace(/[^/]*$/, '');
  return u.href;
}

async function fetchBytes(url, f, max, name) {
  let res;
  try { res = await f(url); } catch (e) { throw new NetError('packs.err.network', { file: name, url }, e); }
  if (!res.ok) throw new NetError(res.status === 404 ? 'packs.err.notFound' : 'packs.err.network', { file: name, url, status: res.status });
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > max) throw new NetError('packs.err.size', { file: name, mb: Math.round(max / 1e6) });
  return bytes;
}

/** Run `fn` over `items` with a few requests at a time; the first failure wins. */
async function pool(items, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => { while (queue.length) await fn(queue.shift()); }));
}

/**
 * Check a manifest text: formats, schema, client version. Returns the parsed pack.
 * @param {string} text @param {{ id?: string, version?: string }} [expect]
 */
export function parseManifest(text, { id, version = GAME_VERSION } = {}) {
  let pack;
  try { pack = JSON.parse(text); } catch (e) { throw new NetError('packs.err.schema', { path: '/', detail: 'json' }, e); }
  if (!pack || pack.format !== 'kronland-pack') throw new NetError('packs.err.schema', { path: '/format', detail: 'format' });
  if (Number.isInteger(pack.version) && pack.version > PACK_VERSION) throw new NetError('packs.err.newer', { what: 'pack' });
  if (!Number.isInteger(pack.version) || pack.version < 1) throw new NetError('packs.err.outdated', { what: 'pack' });
  const issue = validate(schema, pack)[0];
  if (issue) throw new NetError('packs.err.schema', { path: issue.path || '/', detail: issue.message });
  if (id && pack.id !== id) throw new NetError('packs.err.schema', { path: '/id', detail: 'differs from the catalog' });
  if (pack.preview && !pack.media?.[pack.preview]) throw new NetError('packs.err.schema', { path: '/preview', detail: 'not in media' });
  if (!clientOk(pack.minClient, version)) throw new NetError('packs.err.minClient', { need: pack.minClient, have: version });
  return pack;
}

/**
 * @typedef {Object} LoadedPack
 * @property {string} id
 * @property {string} hash SHA-256 of pack.json (state of the pack)
 * @property {any} manifest
 * @property {Array<{ id: string, scenario: any }>} levels
 * @property {Map<string, Blob>} media 'assets/<name>' -> file, as Level packages expect it
 * @property {boolean} offline loaded from the cache because the network was not reachable
 * @property {string[]} warnings
 */

/**
 * Load a pack of the catalog (or from the offline cache).
 * @param {{ id: string, manifest?: string, sha256?: string, access?: string, minClient?: string }} entry
 * @param {{ fetch?: typeof fetch, cache?: { packs: any, files: any }, version?: string }} [env]
 * @returns {Promise<LoadedPack>}
 */
export async function loadPack(entry, { fetch: f = globalThis.fetch.bind(globalThis), cache, version = GAME_VERSION } = {}) {
  if (entry.access === 'locked' || !entry.manifest) throw new NetError('packs.err.locked', { id: entry.id });
  if (!clientOk(entry.minClient, version)) throw new NetError('packs.err.minClient', { need: entry.minClient, have: version });
  let text, offline = false;
  try {
    text = new TextDecoder().decode(await fetchBytes(entry.manifest, f, LIMITS.manifest, 'pack.json'));
  } catch (e) {
    const cached = e instanceof NetError && e.code === 'packs.err.network' ? await cache?.packs.get(entry.id).catch(() => null) : null;
    if (!cached) throw e;
    text = cached.text; offline = true;
  }
  const hash = await sha256Hex(text);
  if (!offline && entry.sha256 && entry.sha256 !== hash) throw new NetError('packs.err.hash', { file: 'pack.json' });
  const manifest = parseManifest(text, { id: entry.id, version });
  const base = filesBase(entry.manifest);
  const warnings = [];

  /** File by name: cache first (immutable), otherwise fetch and verify against the name. */
  const file = async (name, max) => {
    const hit = await cache?.files.get(name).catch(() => null);
    if (hit) return hit;
    if (offline) throw new NetError('packs.err.network', { file: name });
    const bytes = await fetchBytes(new URL(name, base).href, f, max, name);
    if (await sha256Hex(bytes) !== name.replace(/\.[a-z0-9]+$/, '')) throw new NetError('packs.err.hash', { file: name });
    const rec = { data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    await cache?.files.set(name, rec).catch(() => {});
    return rec;
  };

  const levels = [];
  await pool(manifest.levels.map((l, i) => [l, i]), async ([l, i]) => {
    const rec = await file(l.file, LIMITS.level);
    let scenario;
    try { scenario = JSON.parse(new TextDecoder().decode(rec.data)); } catch (e) { throw new NetError('packs.err.schema', { path: `/levels/${i}`, detail: 'json' }, e); }
    const problem = validateScenario(scenario)[0];
    if (problem) throw new NetError('packs.err.schema', { path: `/levels/${i}`, detail: problem });
    if (scenario.id !== l.id) throw new NetError('packs.err.schema', { path: `/levels/${i}/id`, detail: 'differs from the scenario' });
    levels[i] = { id: l.id, scenario };
  });

  const media = new Map();
  await pool(Object.entries(manifest.media ?? {}), async ([name, info]) => {
    const rec = await file(name, LIMITS.media);
    if (rec.data.byteLength !== info.bytes) throw new NetError('packs.err.hash', { file: name });
    if (info.type === 'model/gltf-binary' && info.bytes > LIMITS.modelWarn) warnings.push(name);
    if (assetAllowed(`assets/${name}`)) media.set(`assets/${name}`, new Blob([rec.data], { type: info.type }));
  });

  if (!offline) await cache?.packs.set(entry.id, { hash, text, at: Date.now() }).catch(() => {});
  return { id: manifest.id, hash, manifest, levels, media, offline, warnings };
}

/** Level package for App.openLevel: scenario, media and the reference progress events need. */
export function levelPackage(pack, levelId) {
  const level = pack.levels.find((l) => l.id === levelId);
  if (!level) return null;
  return { scenario: level.scenario, assets: pack.media, base: null, pack: { id: pack.id, hash: pack.hash, level: level.id } };
}

/** Mission definitions of all levels (titles, goals for the list) - the same step the game takes when it starts one. */
export const levelDefs = (pack) => pack.levels.map((l) => scenarioToDef(l.scenario));

/** Forget a cached pack (deleted on the server). Files stay; they are shared and small. */
export const forgetPack = (cache, id) => cache?.packs.delete(id).catch(() => {});
