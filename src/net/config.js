// Configuration and sources (docs/SERVER.md). public/kronland.config.json names the server (optional) and further
// static catalogs; players add their own sources (localStorage). Missing or broken file = stage 0, the game works
// without network exactly as before.

import { siteUrl } from '../paths.js';
import { validate } from './schema.js';
import { NetError } from './errors.js';
import schema from '../../contract/schemas/config.schema.json';

export const CONFIG_VERSION = 1;
const CACHE_KEY = 'kronland-config-cache';
const SOURCES_KEY = 'kronland-sources';
export const MAX_PLAYER_SOURCES = 20;

/** @typedef {{ server: string|null, sources: string[] }} NetConfig */
/** @typedef {{ url: string, kind: 'server'|'config'|'player' }} Source */

export const EMPTY_CONFIG = Object.freeze({ server: null, sources: [] });

const isLocal = (host) => host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

/**
 * Check a configuration file. A newer version asks for an update, a broken file is an error.
 * @param {any} json @returns {NetConfig}
 */
export function parseConfig(json) {
  if (!json || typeof json !== 'object' || json.format !== 'kronland-config') throw new NetError('packs.err.config', { detail: 'format' });
  if (Number.isInteger(json.version) && json.version > CONFIG_VERSION) throw new NetError('packs.err.newer', { what: 'config' });
  const issue = validate(schema, json)[0];
  if (issue) throw new NetError('packs.err.config', { detail: `${issue.path || '/'} ${issue.message}` });
  return { server: json.server ?? null, sources: [...new Set(json.sources ?? [])] };
}

/**
 * Normalise a catalog address entered by a person or taken from a link: http(s) only (http only for localhost),
 * a folder address gets catalog.json, no fragment. Returns null if it is not usable.
 * @param {string} input @param {string} [base]
 */
export function cleanSourceUrl(input, base = globalThis.location?.href) {
  let u;
  try { u = new URL(String(input ?? '').trim(), base); } catch { return null; }
  if (u.href.length > 500) return null;
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && isLocal(u.hostname))) return null;
  u.hash = '';
  if (u.pathname.endsWith('/')) u.pathname += 'catalog.json';
  return u.href;
}

/** `?source=<url>` of a start link, or null. */
export function sourceParam(search) {
  const v = new URLSearchParams(search).get('source');
  return v ? cleanSourceUrl(v) : null;
}

/** `?config=<url>` replaces the configuration file - only on localhost (development, tests against the mock server). */
export function configOverride(search, hostname) {
  const v = isLocal(hostname) ? new URLSearchParams(search).get('config') : null;
  return v || null;
}

/**
 * Load the configuration network-first; offline the last good copy applies. Never throws: stage 0 is the fallback.
 * @param {{ fetch?: typeof fetch, url?: string, storage?: Storage }} [env]
 * @returns {Promise<NetConfig>}
 */
export async function loadConfig({ fetch: f = globalThis.fetch?.bind(globalThis), url = siteUrl('kronland.config.json'), storage = globalThis.localStorage } = {}) {
  let text = null;
  try {
    const res = await f(url, { cache: 'no-store' });
    if (res.ok) text = await res.text();
    else if (res.status === 404) return { ...EMPTY_CONFIG, sources: [] };
  } catch { /* offline: cached copy below */ }
  try {
    if (text === null) text = storage?.getItem(CACHE_KEY) ?? null;
    if (text === null) return { ...EMPTY_CONFIG, sources: [] };
    const config = parseConfig(JSON.parse(text));
    try { storage?.setItem(CACHE_KEY, text); } catch { /* not remembered */ }
    return config;
  } catch (e) {
    console.warn('Net: configuration not usable, running without server', e);
    return { ...EMPTY_CONFIG, sources: [] };
  }
}

/** @returns {string[]} sources added by the player */
export function loadPlayerSources(storage = globalThis.localStorage) {
  try {
    const list = JSON.parse(storage?.getItem(SOURCES_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((u) => typeof u === 'string').slice(0, MAX_PLAYER_SOURCES) : [];
  } catch { return []; }
}

const savePlayerSources = (list, storage) => { try { storage?.setItem(SOURCES_KEY, JSON.stringify(list)); } catch { /* not remembered */ } };

/**
 * Add a source of the player. Throws packs.err.source for an unusable address.
 * @param {string} input @param {NetConfig} config @param {Storage} [storage]
 * @returns {string} the stored address
 */
export function addPlayerSource(input, config = EMPTY_CONFIG, storage = globalThis.localStorage) {
  const url = cleanSourceUrl(input);
  if (!url) throw new NetError('packs.err.source');
  const known = sourceList(config, loadPlayerSources(storage)).some((s) => s.url === url);
  if (known) throw new NetError('packs.err.sourceKnown');
  const list = loadPlayerSources(storage);
  if (list.length >= MAX_PLAYER_SOURCES) throw new NetError('packs.err.sourceMax', { n: MAX_PLAYER_SOURCES });
  savePlayerSources([...list, url], storage);
  return url;
}

export function removePlayerSource(url, storage = globalThis.localStorage) {
  savePlayerSources(loadPlayerSources(storage).filter((u) => u !== url), storage);
}

/**
 * All catalogs in priority order: the server first, then the file's sources, then the player's. Duplicates once.
 * @param {NetConfig} config @param {string[]} [player]
 * @returns {Source[]}
 */
export function sourceList(config, player = []) {
  /** @type {Source[]} */
  const out = [];
  const add = (url, kind) => { if (!out.some((s) => s.url === url)) out.push({ url, kind }); };
  if (config.server) add(`${config.server}/catalog.json`, 'server');
  for (const u of config.sources) add(u, 'config');
  for (const u of player) add(u, 'player');
  return out;
}
