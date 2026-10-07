// Service worker (vite-plugin-pwa, generateSW) and updates after a deploy. The worker lives in the site root (sw.js)
// and applies to the whole site; the game under play/ registers it with a path to the root (src/paths.js).
// Build only – the dev server has no sw.js.
//
// Standard "prompt" pattern: pages come from the network first (vite.config.js → runtimeCaching), so a reload after
// a deploy shows the new version at once. A new worker installs and then *waits* (no skipWaiting): the old one keeps
// serving – and keeps its precache – as long as this page runs the old code. The page decides when the new worker
// takes over (`SKIP_WAITING` message) and reloads once on `controllerchange`: right away in the menus, in a running
// game or editor draft only when the user asks ("Save and reload", `applyUpdate`), at the latest on return to the
// menus. A page that already runs the new code (came from the network) lets the waiting worker take over quietly,
// without a reload, once it is idle. A lazy bundle that fails to load (`vite:preloadError`) reloads once in the
// menus and shows the notice in a game. Docs: docs/PERFORMANCE.md#updates-nach-einem-deploy.
import { reactive } from 'vue';
import { siteRoot, siteUrl } from './paths.js';
import { cleanupAssetCaches } from './cacheCleanup.js';

/* global __KRONLAND_BUILD__ */
/** Optional build label (env KRONLAND_BUILD at build time, used by the deploy test); '' otherwise. */
export const BUILD_TAG = typeof __KRONLAND_BUILD__ !== 'undefined' ? __KRONLAND_BUILD__ : '';

/** Update state for the UI: a newer version is online and this page still runs the old one. */
export const update = reactive({ available: false });

/** Guard against reload loops: at most one automatic reload per this many ms. */
export const RELOAD_GUARD_MS = 60_000;
const GUARD_KEY = 'kronland-update-reload';
/** A tab coming back to the foreground looks for updates at most this often. */
const RECHECK_MS = 10 * 60_000;

/** 'https://x/assets/play-Ab.js?v' or '../assets/play-Ab.js' → 'assets/play-Ab.js'; null without 'assets/'. */
function bundleName(ref) {
  const i = ref.indexOf('assets/');
  return i >= 0 ? ref.slice(i).replace(/[?#].*$/, '') : null;
}

/**
 * Hashed bundles (`assets/…`) referenced by script and link tags of an HTML text.
 * @param {string} html @returns {Set<string>}
 */
export function bundleRefs(html) {
  const out = new Set();
  for (const m of String(html).matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]*)"/gi)) {
    const b = bundleName(m[1]);
    if (b) out.add(b);
  }
  return out;
}

/**
 * Is the page outdated? True if the HTML just fetched from the server references a bundle the running page did not
 * load. (The running document may hold more: Vite adds tags for lazy bundles at runtime.)
 * @param {Set<string>} running bundles of the running page @param {string} html current HTML from the server
 */
export function isOutdated(running, html) {
  const fresh = bundleRefs(html);
  if (!fresh.size || !running.size) return false; // error page, dev server: no statement
  for (const r of fresh) if (!running.has(r)) return true;
  return false;
}

/**
 * May the page reload itself now? Not twice within RELOAD_GUARD_MS (a server that keeps delivering an old page
 * must not cause a loop).
 * @param {number} now @param {number|null} last time of the last automatic reload (sessionStorage)
 */
export const reloadAllowed = (now, last) => !(last && now - last >= 0 && now - last < RELOAD_GUARD_MS);

/** @type {() => boolean} may the page be reloaded without losing anything (no running game, no editor draft)? */
let canReload = () => true;
/** The game sets this: reload only in the menus. @param {() => boolean} fn */
export function setReloadPolicy(fn) { canReload = fn; }

/**
 * What to do about an update, given whether this page is outdated (`checkForUpdate`), whether a new worker is
 * waiting and whether nothing would be lost by a reload.
 * @param {{ outdated: boolean|null, waiting: boolean, idle: boolean }} s
 * @returns {'reload'|'notice'|'activate'|'none'} reload = let the new worker take over and reload once;
 *   notice = show "new version" and wait for the user; activate = let the waiting worker take over without a reload
 *   (it belongs to the code this page already runs); none = nothing (current, or unknown/offline)
 */
export function updateAction({ outdated, waiting, idle }) {
  if (outdated) return idle ? 'reload' : 'notice';
  if (outdated === false && waiting && idle) return 'activate';
  return 'none';
}

/** @type {ServiceWorkerRegistration|null} */
let registration = null;
/** Navigation to run once the waiting worker has taken over (this page asked it to). */
let afterSwitch = null;
/** How long to wait for `controllerchange` after SKIP_WAITING before navigating anyway (worker stuck, no support). */
const SWITCH_TIMEOUT_MS = 4_000;

/** Ask the waiting worker (if any) to take over. @returns {boolean} a worker was waiting */
function activateWaiting() {
  const w = registration?.waiting;
  if (!w) return false;
  w.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

/** Load the new version: a waiting worker takes over first (`controllerchange`), then `nav` runs exactly once. */
function switchAndGo(nav) {
  let done = false;
  const go = () => { if (!done) { done = true; afterSwitch = null; nav(); } };
  if (!activateWaiting()) return go();
  afterSwitch = go;
  setTimeout(go, SWITCH_TIMEOUT_MS);
}

function reloadOnce() {
  let last;
  try { last = Number(sessionStorage.getItem(GUARD_KEY)) || null; } catch { return false; } // no guard → no automatic reload
  const now = Date.now();
  if (!reloadAllowed(now, last)) return false;
  try { sessionStorage.setItem(GUARD_KEY, String(now)); } catch { return false; }
  switchAndGo(() => location.reload());
  return true;
}

/** Act on the current state (see `updateAction`). @param {boolean|null} outdated */
function settle(outdated) {
  if (outdated) update.available = true;
  const action = updateAction({ outdated: update.available || outdated, waiting: !!registration?.waiting, idle: canReload() });
  if (action === 'reload') reloadOnce();
  else if (action === 'activate') activateWaiting();
}

/** The game left a running match (back in the menus): apply a pending update now. */
export function updateIfIdle() {
  if (update.available) settle(true);
  else if (registration?.waiting) checkForUpdate(); // a worker waits for this (current?) page: let it take over
}

/**
 * Apply a pending update now (button in the game menu; the caller saves first). Without the start link in the
 * address: the start menu then offers "Continue" instead of starting the map afresh.
 */
export function applyUpdate() {
  try { sessionStorage.setItem(GUARD_KEY, String(Date.now())); } catch { /* reload anyway */ }
  switchAndGo(() => { location.href = location.pathname; });
}

/** Bundles the running page was started with. */
function runningRefs() {
  const out = new Set();
  for (const el of document.querySelectorAll('script[src], link[href]')) {
    const b = bundleName(el.getAttribute('src') ?? el.getAttribute('href') ?? '');
    if (b) out.add(b);
  }
  return out;
}

let lastCheck = 0;
/**
 * Ask the server for the current page (past every cache) and compare its bundles with the running ones, then act
 * on the result (`settle`).
 * @returns {Promise<boolean|null>} true = outdated, false = current, null = unknown (offline)
 */
export async function checkForUpdate() {
  const outdated = await fetchOutdated();
  settle(outdated);
  return outdated;
}

async function fetchOutdated() {
  lastCheck = Date.now();
  try {
    const r = await fetch(location.pathname, { cache: 'no-store', credentials: 'same-origin' });
    if (!r.ok) return null;
    return isOutdated(runningRefs(), await r.text());
  } catch { return null; }
}

/** A new worker finished installing next to an active one: it waits until this page decides. @param {ServiceWorker|null} sw */
function watchInstall(sw) {
  sw?.addEventListener('statechange', () => {
    if (sw.state === 'installed' && navigator.serviceWorker.controller) checkForUpdate();
  });
}

export function registerServiceWorker() {
  if (typeof window !== 'undefined') window.__kronlandBuild = BUILD_TAG;
  if (!import.meta.env.PROD || typeof window === 'undefined') return;
  // A lazy bundle could not be loaded (Vite's standard hook): typical for a tab that outlived a deploy (old file
  // gone). Menus: reload once (guarded); in a game: notice instead of losing it.
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault(); // no unhandled error: the reload or the notice takes over
    if (canReload()) reloadOnce();
    else checkForUpdate();
  });
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const go = async () => {
    let controlled = !!navigator.serviceWorker.controller;
    try { registration = await navigator.serviceWorker.register(siteUrl('sw.js'), { scope: siteRoot() }); } catch { /* no worker: the page still works */ }
    controlled ||= !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // this page asked the waiting worker to take over: load the new version now
      if (afterSwitch) return afterSwitch();
      // another tab let the new worker take over: is this page outdated? Not when the very first worker takes
      // control of a page that had none (first visit).
      if (controlled) checkForUpdate();
      controlled = true;
    });
    if (registration) {
      watchInstall(registration.installing);
      registration.addEventListener('updatefound', () => watchInstall(registration.installing));
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastCheck < RECHECK_MS) return;
      registration?.update().catch(() => {});
      checkForUpdate();
    });
    // Usually current (the page came from the network); outdated after an offline start or with a stale HTTP cache.
    // A worker already waiting (deployed while this page was loading) is handled here too.
    const outdated = await checkForUpdate();
    // Delete old versions of changed game files later, at leisure (they do not disturb loading) – only from a
    // current page served by the current worker (none waiting): an outdated page would take the new version's files
    // for stale ones, and while a worker waits, a page of the old version may still run in another tab.
    if (outdated === false) {
      setTimeout(() => {
        if (!update.available && navigator.serviceWorker.controller && !registration?.waiting && !registration?.installing) cleanupAssetCaches().catch(() => {});
      }, 30_000);
    }
  };
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}
