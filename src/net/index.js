// Network layer of the game: wires config, sources, sign-in, packs, cloud saves and progress together.
// Loaded on demand (dynamic import from the UI); components read the small reactive `net` state (state.js).
// Without a server and without sources nothing here changes the game (stage 0).

import { net, seen, library, canDiscover } from './state.js';
import { NetError } from './errors.js';
import { loadConfig, configOverride, loadPlayerSources, addPlayerSource, removePlayerSource, sourceList, sourceParam } from './config.js';
import { loadAll, parseCatalog } from './catalog.js';
import { openKv } from './kv.js';
import { createAuth } from './auth.js';
import { createApi } from './api.js';
import { createProgress, createTracker, markDone } from './progress.js';
import { createSeen } from './seen.js';

/** @type {Promise<any>|null} */
let ctxPromise = null;

/** The wired-up context (read the configuration, restore the session). Same promise for every caller. */
export function initNet(env = {}) {
  ctxPromise ??= build(env);
  return ctxPromise;
}

async function build({ location = globalThis.location, fetch: f = globalThis.fetch.bind(globalThis), history = globalThis.history } = {}) {
  const override = configOverride(location.search, location.hostname);
  const config = await loadConfig(override ? { url: override, fetch: f } : { fetch: f });
  net.server = config.server;
  net.sources = config.sources;
  net.playerSources = loadPlayerSources();
  const kv = await openKv();
  const ctx = { config, kv, fetch: f, auth: null, api: null, progress: null, tracker: null, location, history, seen: createSeen(kv.kv, seen) };
  await ctx.seen.load();
  if (config.server) {
    ctx.auth = createAuth({ server: config.server, fetch: f, kv: kv.kv });
    ctx.api = createApi({ server: config.server, auth: ctx.auth, fetch: f });
    await ctx.auth.load();
    try {
      const back = await ctx.auth.handleRedirect(location.search);
      if (back) {
        try { history.replaceState(null, '', location.pathname + (back.returnQuery ? `?${back.returnQuery}` : '')); } catch { /* address stays */ }
      }
    } catch (e) {
      net.error = { code: e.code ?? 'net.err.unknown', params: e.params ?? {} };
      try { history.replaceState(null, '', location.pathname); } catch { /* address stays */ }
    }
    await refreshUser(ctx);
    ctx.progress = createProgress({ api: ctx.api, kv: kv.kv, canSend: async () => !!(await ctx.auth.token()) });
    ctx.tracker = createTracker(ctx.progress);
    globalThis.addEventListener?.('online', () => { ctx.progress.flush().catch(() => {}); });
    if (net.signedIn) ctx.progress.flush().catch(() => {});
  }
  net.ready = true;
  return ctx;
}

/** Who is signed in (name and account page); the last known name stays if the server cannot be reached. */
async function refreshUser(ctx) {
  net.signedIn = ctx.auth?.signedIn ?? false;
  if (!net.signedIn) { net.user = null; return; }
  try {
    net.user = await ctx.api.get('/api/v1/me');
    await ctx.kv.kv.set('user', net.user).catch(() => {});
  } catch (e) {
    if (e.status === 401) { await ctx.auth.logout(); net.signedIn = false; net.user = null; return; }
    net.user = (await ctx.kv.kv.get('user').catch(() => null)) ?? { displayName: '…', accountUrl: ctx.config.server };
  }
  net.signedIn = ctx.auth.signedIn;
}

/** Start the sign-in (leaves the page). @param {string} [returnQuery] query to restore afterwards, e.g. `play=abc` */
export async function login(returnQuery = '') {
  const ctx = await initNet();
  if (!ctx.auth) throw new NetError('auth.err.noServer');
  net.error = null;
  await ctx.auth.login(returnQuery);
}

export async function logout() {
  const ctx = await initNet();
  await ctx.auth?.logout();
  net.signedIn = false;
  net.user = null;
}

/** Catalog entries from all sources (and, signed in, the player's own list first). */
export async function listPacks() {
  const ctx = await initNet();
  const sources = sourceList(ctx.config, net.playerSources);
  let first = [];
  const extra = [];
  if (net.signedIn) {
    try {
      const base = `${ctx.config.server}/`;
      const mine = parseCatalog(await ctx.api.get('/api/v1/packs'), base);
      first = [{ source: { url: `${ctx.config.server}/api/v1/packs`, kind: 'server' }, name: null, packs: mine.packs }];
    } catch (e) { extra.push({ source: `${ctx.config.server}/api/v1/packs`, error: e }); }
  }
  const out = await loadAll({ sources, fetch: ctx.api?.fetch ?? ctx.fetch, first });
  return { packs: out.packs, errors: [...extra, ...out.errors] };
}

/** Fill the reactive `library` with the packs of all sources (the library and the start menu read it). Never throws. */
export async function refreshLibrary() {
  library.loading = true;
  try {
    if (!canDiscover()) { library.packs = []; library.errors = []; return; }
    const r = await listPacks();
    library.packs = r.packs;
    library.errors = r.errors;
  } catch (e) {
    library.packs = [];
    library.errors = [{ source: net.server ?? '', error: e }];
  } finally { library.loading = false; library.loaded = true; }
}

/** Load a pack (hash-checked, cached for offline). @param {import('./catalog.js').PackEntry} entry */
export async function openPack(entry) {
  const ctx = await initNet();
  const { loadPack } = await import('./packs.js');
  return loadPack(entry, { fetch: ctx.api?.fetch ?? ctx.fetch, cache: ctx.kv });
}

/** `?play=<id>`: a pack from the catalogs or, failing that, from the server by id (unlisted link). */
export async function findPack(id) {
  const { packs } = await listPacks();
  const hit = packs.find((p) => p.id === id);
  if (hit) return hit;
  const ctx = await initNet();
  if (!ctx.config.server) return null;
  return { id, title: { de: id, en: id }, access: 'open', manifest: `${ctx.config.server}/api/v1/packs/${encodeURIComponent(id)}/manifest`, origin: { url: ctx.config.server, kind: 'server', name: null } };
}

export function addSource(input) {
  const url = addPlayerSource(input, { server: net.server, sources: net.sources });
  net.playerSources = loadPlayerSources();
  return url;
}

/** Is this address one of the sources already (file or player)? */
export const knownSource = (url) => sourceList({ server: net.server, sources: net.sources }, net.playerSources).some((s) => s.url === url);

export function removeSource(url) {
  removePlayerSource(url);
  net.playerSources = loadPlayerSources();
}

/** Parameters of a start link that concern the network layer. */
export function netLinks(search) {
  const q = new URLSearchParams(search);
  return { source: sourceParam(search), play: q.get('play') || null, save: q.get('save') || null };
}

/** Save games on the server (a SaveStore) or null if not signed in. */
export async function cloudStore() {
  const ctx = await initNet();
  if (!net.signedIn) return null;
  const { createCloudStore } = await import('./cloudSaves.js');
  return (ctx.cloud ??= createCloudStore(ctx.api));
}

/** `?save=<url>` -> { doc, readOnly } */
export async function openSave(url) {
  const ctx = await initNet();
  if (!ctx.api) throw new NetError('saves.err.foreignHost');
  const { openSaveUrl } = await import('./cloudSaves.js');
  return openSaveUrl(url, { api: ctx.api, signedIn: net.signedIn });
}

/** Editor: own packs, save, open, delete. */
export async function serverPacks() {
  const ctx = await initNet();
  if (!net.signedIn) throw new NetError('auth.err.signedOut');
  const m = await import('./serverPacks.js');
  return {
    newId: m.newPackId,
    save: (scenario, files, id) => m.saveToServer(ctx.api, scenario, files, id),
    open: (id) => m.loadOwnPack(ctx.api, id),
    remove: async (id) => { await ctx.api.del(`/api/v1/packs/${encodeURIComponent(id)}`); const { forgetPack } = await import('./packs.js'); await forgetPack(ctx.kv, id); },
  };
}

/** Progress hooks for levels of packs (only while signed in; the tracker buffers while offline). */
export const track = {
  start: (ref) => { if (net.signedIn && ref) ctxPromise?.then((c) => c.tracker?.start(ref)); },
  run: (sections) => { if (net.signedIn) ctxPromise?.then((c) => c.tracker?.run(sections)); },
  finish: (type, ref) => { if (ref && type === 'completed') markDone(ref); if (net.signedIn && ref) ctxPromise?.then((c) => c.tracker?.finish(type)); },
  stop: () => { ctxPromise?.then((c) => c.tracker?.stop()); },
};

/** The player opened a pack: the "New" badge goes away and stays away. */
export async function markSeen(id) { await (await initNet()).seen.mark(id); }
