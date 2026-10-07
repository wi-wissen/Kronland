// Loads the doc cards (docCards.js with commandDocs.js, ~60 kB per language) only when needed – on the first
// hover over code, long-press or opening the help. Afterwards `docs()` answers synchronously.

let mod = null;
let pending = null;

/** @returns {Promise<typeof import('./docCards.js')>} */
export function loadDocs() {
  if (mod) return Promise.resolve(mod);
  pending ??= import('./docCards.js').then((m) => { mod = m; return m; });
  return pending;
}

/** Loaded module or null (then call loadDocs()). */
export const docs = () => mod;
