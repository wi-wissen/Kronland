// Service worker: reload pages that still run code from before the update handling (src/pwa.js, PR #32).
//
// Such "legacy" pages cannot notice a new version themselves. When a new worker activates, it greets every window in
// its scope (postMessage 'kronland-ping'). Pages built since then answer at once from a tiny inline script in the
// HTML head (`PONG_SCRIPT`, injected into every page by the plugin below) – they handle updates themselves, running
// games included. Of the pages that stay silent for PING_WAIT_MS (legacy pages) only the one the user has just
// (re)loaded is reloaded with `client.navigate` (`pickLegacyClients`); other legacy tabs are left alone. An address reloaded this way is not
// reloaded again within GUARD_MS (a Cache entry): a page that keeps coming back silent is never reloaded in a loop.
//
// The worker part is added to the generated sw.js via workbox `importScripts` as a file with a content hash in its
// name (sw.js changes whenever this code changes). Docs: docs/PERFORMANCE.md#updates-nach-einem-deploy.

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Message types between worker and page. */
export const PING = 'kronland-ping';
export const PONG = 'kronland-pong';

/**
 * Which silent window gets reloaded? Only the one that brought the new worker: update checks happen on page loads,
 * so the new worker activates while the user is looking at the page they have just (re)loaded – that page is
 * visible and focused. All other legacy tabs count as running (possibly a long game – a legacy page cannot tell us)
 * and are left alone; they get the new version on their next reload, which the new worker then serves.
 * The new worker cannot see that navigation itself (the old worker handled it), so focus decides:
 * the focused silent window; without focus info the first visible one in `matchAll` order (most recently focused
 * first). Self-contained (serialised into the worker).
 * @param {{ id: string, url: string, visibilityState?: string, focused?: boolean }[]} clients in matchAll order
 * @param {Set<string>} answered ids of clients that answered the ping
 * @param {string} scope registration scope (site root URL, with trailing '/')
 * @returns {string[]} ids to reload (at most one)
 */
export function pickLegacyClients(clients, answered, scope) {
  const root = new URL(scope).pathname;
  const silent = clients.filter((c) => {
    if (answered.has(c.id) || c.visibilityState !== 'visible') return false;
    try { return new URL(c.url).pathname.startsWith(root); } catch { return false; }
  });
  const pick = silent.find((c) => c.focused) ?? silent[0];
  return pick ? [pick.id] : [];
}

/**
 * Worker side (runs in sw.js; self-contained apart from `pick`).
 * @param {any} sw the ServiceWorkerGlobalScope @param {typeof pickLegacyClients} pick
 * @param {{ wait: number, guard: number, ping: string, pong: string }} cfg
 */
export function installLegacyReload(sw, pick, cfg) {
  const answered = new Set();
  sw.addEventListener('message', (e) => {
    if (e.data && e.data.type === cfg.pong && e.source) answered.add(e.source.id);
  });
  async function run() {
    await sw.clients.claim();
    const list = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (!list.length) return;
    for (const c of list) c.postMessage({ type: cfg.ping });
    await new Promise((r) => setTimeout(r, cfg.wait));
    const ids = pick(list.map((c) => ({ id: c.id, url: c.url, visibilityState: c.visibilityState, focused: c.focused })), answered, sw.registration.scope);
    if (!ids.length) return;
    // Loop guard: an address this worker family reloaded within cfg.guard is not reloaded again (Cache entry)
    const cache = await caches.open('kronland-sw');
    const done = (await cache.match('legacy-reload').then((r) => (r ? r.json() : null)).catch(() => null)) ?? {};
    const now = Date.now();
    for (const [u, at] of Object.entries(done)) if (!(now >= at && now - at < cfg.guard)) delete done[u];
    const targets = list.filter((c) => ids.includes(c.id) && !(c.url in done));
    if (!targets.length) return;
    for (const c of targets) done[c.url] = now;
    await cache.put('legacy-reload', new Response(JSON.stringify(done)));
    await Promise.all(targets.map((c) => c.navigate(c.url).catch(() => null)));
  }
  // Not inside waitUntil: navigate() waits for the reloaded page, whose request needs this worker to be active.
  // The worker stays alive meanwhile (pending messages, idle timeout of ~30 s).
  sw.addEventListener('activate', () => { run().catch(() => {}); });
}

/** Wait for answers (ms); an address reloaded by the worker is left alone for this long (ms). */
export const PING_WAIT_MS = 1500;
export const GUARD_MS = 60_000;

/** Source of the worker file (classic script for importScripts). */
export function legacyReloadSource() {
  const cfg = { wait: PING_WAIT_MS, guard: GUARD_MS, ping: PING, pong: PONG };
  return `// Generated from scripts/sw-legacy.js – reload pages from before the update handling\n`
    + `(function () {\nconst pickLegacyClients = ${pickLegacyClients.toString()};\n`
    + `(${installLegacyReload.toString()})(self, pickLegacyClients, ${JSON.stringify(cfg)});\n})();\n`;
}

/** Inline script for every page: answer the worker's greeting at once (before any module has loaded). */
export const PONG_SCRIPT = `<script>(function(c){if(!c)return;c.addEventListener('message',function(e){`
  + `if(e.data&&e.data.type==='${PING}'&&e.source)e.source.postMessage({type:'${PONG}'})});c.startMessages&&c.startMessages()})(navigator.serviceWorker)</script>`;

/** Name of the worker file in the build (content hash, like the game files). */
export function legacyReloadFile() {
  const hash = createHash('sha256').update(legacyReloadSource()).digest('hex').slice(0, 10);
  return `sw-legacy.${hash}.js`;
}

/** Put the answer script right after the charset declaration (or at the start of <head>). @param {string} html */
export function injectPong(html) {
  if (html.includes(PONG_SCRIPT)) return html;
  const charset = /<meta charset=[^>]*>/i.exec(html);
  if (charset) return html.replace(charset[0], `${charset[0]}\n    ${PONG_SCRIPT}`);
  return html.replace(/<head>/i, `<head>\n    ${PONG_SCRIPT}`);
}

/**
 * Vite plugin: inline answer script into every page, worker file into the build (before vite-plugin-pwa writes
 * sw.js in closeBundle).
 * @returns {import('vite').Plugin}
 */
export default function swLegacy() {
  let outDir = '';
  return {
    name: 'kronland:sw-legacy',
    apply: 'build',
    configResolved(cfg) { outDir = resolve(cfg.root, cfg.build.outDir); },
    transformIndexHtml: { order: 'post', handler: injectPong },
    writeBundle() {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, legacyReloadFile()), legacyReloadSource());
    },
  };
}
