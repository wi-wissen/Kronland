// Service worker (vite-plugin-pwa, generateSW) and updates after a deploy. The worker lives in the site root (sw.js)
// and applies to the whole site; the game under play/ registers it with a path to the root (src/paths.js).
// Build only – the dev server has no sw.js.
//
// Pages come from the network first (vite.config.js → runtimeCaching), so a reload after a deploy shows the new
// version at once. A tab that stays open across a deploy still runs the old code; the new worker takes over
// (skipWaiting, clientsClaim) and drops the old bundles from its cache. Such a tab notices it is outdated
// (`checkForUpdate`) and reloads itself – but only when nothing would be lost (`setReloadPolicy`); otherwise
// `update.available` shows a notice in the game menu. A lazily loaded bundle that fails to load (old tab,
// file gone after the deploy) triggers the same check. Docs: docs/PERFORMANCE.md#updates-nach-einem-deploy.
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

function reloadOnce() {
  let last;
  try { last = Number(sessionStorage.getItem(GUARD_KEY)) || null; } catch { return false; } // no guard → no automatic reload
  const now = Date.now();
  if (!reloadAllowed(now, last)) return false;
  try { sessionStorage.setItem(GUARD_KEY, String(now)); } catch { return false; }
  location.reload();
  return true;
}

/** A newer version is online: reload right away if allowed, otherwise show the notice. */
export function markOutdated() {
  update.available = true;
  if (canReload()) reloadOnce();
}

/** The game left a running match (back in the menus): apply a pending update now. */
export function updateIfIdle() {
  if (update.available && canReload()) reloadOnce();
}

/**
 * Apply a pending update now (button in the game menu; the caller saves first). Without the start link in the
 * address: the start menu then offers "Continue" instead of starting the map afresh.
 */
export function applyUpdate() {
  try { sessionStorage.setItem(GUARD_KEY, String(Date.now())); } catch { /* reload anyway */ }
  location.href = location.pathname;
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
 * Ask the server for the current page (past every cache) and compare its bundles with the running ones.
 * @returns {Promise<boolean|null>} true = outdated, false = current, null = unknown (offline)
 */
export async function checkForUpdate() {
  lastCheck = Date.now();
  try {
    const r = await fetch(location.pathname, { cache: 'no-store', credentials: 'same-origin' });
    if (!r.ok) return null;
    const outdated = isOutdated(runningRefs(), await r.text());
    if (outdated) markOutdated();
    return outdated;
  } catch { return null; }
}

export function registerServiceWorker() {
  if (typeof window !== 'undefined') window.__kronlandBuild = BUILD_TAG;
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  // A lazy bundle could not be loaded: typical for a tab that outlived a deploy (old file gone).
  window.addEventListener('vite:preloadError', () => { if (!update.available) checkForUpdate(); });
  const go = async () => {
    let reg = null;
    let controlled = !!navigator.serviceWorker.controller;
    try { reg = await navigator.serviceWorker.register(siteUrl('sw.js'), { scope: siteRoot() }); } catch { /* no worker: the page still works */ }
    // A new worker took over (deploy while this tab was open): is this page outdated? Not when the very first
    // worker takes control of a page that had none (first visit).
    controlled ||= !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (controlled) checkForUpdate();
      controlled = true;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastCheck < RECHECK_MS) return;
      reg?.update().catch(() => {});
      checkForUpdate();
    });
    // Usually current (the page came from the network); outdated after an offline start or with a stale HTTP cache
    const outdated = await checkForUpdate();
    // Delete old versions of changed game files later, at leisure (they do not disturb loading) – never from an
    // outdated page: it would take the new version's files for stale ones.
    if (outdated === false) setTimeout(() => { if (!update.available) cleanupAssetCaches().catch(() => {}); }, 30_000);
  };
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}
