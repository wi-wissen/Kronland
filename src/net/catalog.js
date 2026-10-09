// Catalogs: load the catalog of every source, check it, merge it into one list. The server's catalog is the first
// source; for the same pack id the first source wins. Unreachable or broken sources are reported, never fatal.

import { validate } from './schema.js';
import { NetError } from './errors.js';
import schema from '../../contract/schemas/catalog.schema.json';

export const CATALOG_VERSION = 1;

/**
 * @typedef {Object} PackEntry
 * @property {string} id
 * @property {{ de: string, en: string }} title
 * @property {{ de: string, en: string }} [summary]
 * @property {string|null} preview absolute address
 * @property {number} [levels]
 * @property {string} [minClient]
 * @property {'open'|'locked'} access
 * @property {string} [manifest] absolute address of pack.json
 * @property {string} [sha256]
 * @property {string} [link]
 * @property {boolean} [own]
 * @property {{ url: string, kind: string, name: {de: string, en: string}|null }} origin
 */

/**
 * Check a catalog and make its addresses absolute. Entries with problems are dropped (one broken entry must not hide
 * the rest); a broken frame rejects the whole catalog.
 * @param {any} json @param {string} base address the relative ones refer to
 * @returns {{ name: {de: string, en: string}|null, packs: Omit<PackEntry, 'origin'>[], dropped: number }}
 */
export function parseCatalog(json, base) {
  if (!json || typeof json !== 'object' || json.format !== 'kronland-catalog') throw new NetError('packs.err.catalog', { detail: 'format' });
  if (Number.isInteger(json.version) && json.version > CATALOG_VERSION) throw new NetError('packs.err.newer', { what: 'catalog' });
  if (!Number.isInteger(json.version) || json.version < 1) throw new NetError('packs.err.outdated', { what: 'catalog' });
  const bad = new Set();
  for (const issue of validate(schema, json)) {
    const m = /^\/packs\/(\d+)(\/|$)/.exec(issue.path);
    if (!m) throw new NetError('packs.err.catalog', { detail: `${issue.path || '/'} ${issue.message}` });
    bad.add(Number(m[1]));
  }
  const abs = (u) => { try { return u ? new URL(u, base).href : null; } catch { return null; } };
  const packs = json.packs.filter((_, i) => !bad.has(i)).map((e) => ({ ...e, preview: abs(e.preview), manifest: e.manifest ? abs(e.manifest) : undefined }));
  return { name: json.name ?? null, packs: packs.filter((e) => e.access === 'locked' || e.manifest), dropped: json.packs.length - packs.length };
}

/**
 * Load one catalog.
 * @param {string} url @param {typeof fetch} f
 */
export async function loadCatalog(url, f = globalThis.fetch.bind(globalThis)) {
  let res;
  try { res = await f(url, { cache: 'no-cache' }); } catch (e) { throw new NetError('packs.err.network', { url }, e); }
  if (!res.ok) throw new NetError(res.status === 404 ? 'packs.err.notFound' : 'packs.err.network', { url, status: res.status });
  let json;
  try { json = await res.json(); } catch (e) { throw new NetError('packs.err.catalog', { detail: 'json' }, e); }
  return parseCatalog(json, url);
}

/**
 * One list from several catalogs, in priority order; the first occurrence of an id wins.
 * @param {Array<{ source: { url: string, kind: string }, name: any, packs: any[] }>} lists
 * @returns {PackEntry[]}
 */
export function mergeCatalogs(lists) {
  const seen = new Set();
  /** @type {PackEntry[]} */
  const out = [];
  for (const { source, name, packs } of lists) {
    for (const e of packs) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push({ ...e, origin: { url: source.url, kind: source.kind, name: name ?? null } });
    }
  }
  return out;
}

/**
 * Load all sources and merge them. `first` lists come before the catalogs (the signed-in player's entries from
 * GET /api/v1/packs, which replace the public ones of the same id).
 * @param {{ sources: Array<{ url: string, kind: string }>, fetch?: typeof fetch, first?: Array<{ source: any, name: any, packs: any[] }> }} o
 * @returns {Promise<{ packs: PackEntry[], errors: Array<{ source: string, error: NetError }> }>}
 */
export async function loadAll({ sources, fetch: f = globalThis.fetch.bind(globalThis), first = [] }) {
  const errors = [];
  const loaded = await Promise.all(sources.map(async (source) => {
    try { return { source, ...(await loadCatalog(source.url, f)) }; } catch (error) {
      errors.push({ source: source.url, error: error instanceof NetError ? error : new NetError('packs.err.network', { url: source.url }, error) });
      return null;
    }
  }));
  return { packs: mergeCatalogs([...first, ...loaded.filter(Boolean)]), errors };
}
