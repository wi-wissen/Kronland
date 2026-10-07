// Models loaded on demand (own buildings other than castle/village centre/house, figures other than serfs, e.g. the hero,
// workers, soldiers, bandits): until they arrive the renderer shows procedural placeholders. At the start of a game
// that is visible for a moment – even when every file is already in the service-worker cache and arrives in
// milliseconds. `settleLazyLoads` lets the loading screen wait for exactly these models, but only if all of them
// are cached (fast path); on a first visit nothing waits longer than before. Docs: docs/PERFORMANCE.md.

/** @typedef {{ promise: Promise<unknown>, urls: string[] }} LazyJob */
/** @type {Set<LazyJob>} */
const jobs = new Set();

/**
 * Register an on-demand load (until it settles).
 * @param {Promise<unknown>} promise resolves when the model is usable @param {string[]} urls files it fetches
 * @returns {Promise<unknown>} the same promise
 */
export function trackLoad(promise, urls) {
  const job = { promise, urls };
  jobs.add(job);
  promise.then(() => jobs.delete(job), () => jobs.delete(job));
  return promise;
}

/** Loads still running. */
export const pendingLoads = () => [...jobs];

/** Is the file in a cache (service worker)? Without Cache API: no. @param {string} url */
export async function inCache(url) {
  if (typeof caches === 'undefined') return false;
  try { return !!(await caches.match(new URL(url, globalThis.location?.href).href)); } catch { return false; }
}

/**
 * Wait for the on-demand loads the first frames triggered – only if all their files are cached, at most `maxMs`.
 * Several rounds: a finished load can trigger the next one (building: far levels first, then the original).
 * @param {{ maxMs?: number, frame?: () => Promise<void>, isCached?: (url: string) => Promise<boolean>, now?: () => number }} [opts]
 * @returns {Promise<'none'|'cold'|'done'|'timeout'>} none: nothing to load; cold: not (all) cached, no wait
 */
export async function settleLazyLoads({ maxMs = 3000, frame = nextFrame, isCached = inCache, now = () => performance.now() } = {}) {
  const end = now() + maxMs;
  let result = 'none';
  for (let round = 0; round < 6; round++) {
    // let the renderer draw (and request what it misses)
    await frame();
    await frame();
    const list = pendingLoads();
    if (!list.length) return result;
    const urls = [...new Set(list.flatMap((j) => j.urls))];
    const cached = await Promise.all(urls.map(isCached));
    if (!cached.every(Boolean)) return 'cold';
    const left = end - now();
    if (left <= 0) return 'timeout';
    let timer;
    const timedOut = await Promise.race([
      Promise.allSettled(list.map((j) => j.promise)).then(() => false),
      new Promise((r) => { timer = setTimeout(() => r(true), left); }),
    ]);
    clearTimeout(timer);
    if (timedOut) return 'timeout';
    result = 'done';
  }
  return result;
}

/** Next animation frame (or a short timeout without rAF, e.g. hidden tab). */
function nextFrame() {
  return new Promise((r) => {
    const t = setTimeout(r, 50);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => { clearTimeout(t); r(); });
  });
}
