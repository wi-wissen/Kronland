// „Prüfen“ in the browser: the headless check of src/sim/check.js in time slices, so that the page and the running
// game stay responsive (one slice at most ~12 ms, then the browser gets control back).

import { WorldCheck, checkWorlds } from '../sim/check.js';

/**
 * @param {any} def mission definition @param {string} stage @param {Record<string, string>} sections
 * @param {{ seed?: number, sliceMs?: number, onProgress?: (done: number, results: any[]) => void, cancelled?: () => boolean }} [o]
 * @returns {Promise<{ stage: string, passed: boolean, results: any[], ms: number }|null>} null when cancelled
 */
export async function checkProgramAsync(def, stage, sections, o = {}) {
  const slice = o.sliceMs ?? 12;
  const yieldNow = () => new Promise((r) => setTimeout(r, 0));
  const t0 = performance.now();
  const results = [];
  for (const w of checkWorlds(def)) {
    const c = new WorldCheck(def, w, stage, sections, o);
    while (!c.result) {
      const s0 = performance.now();
      while (!c.result && performance.now() - s0 < slice) c.advance(10);
      if (o.cancelled?.()) return null;
      if (!c.result) await yieldNow();
    }
    results.push(c.result);
    o.onProgress?.(results.length, results.slice());
    await yieldNow();
  }
  return { stage, passed: results.every((r) => r.status === 'solved'), results, ms: Math.round(performance.now() - t0) };
}
