// Save games for the UI: shared store (opened once), file import and export.
// Format: format.js · Storage: store.js/backends.js · Compression: codec.js

import { openBackend, LocalStorageBackend } from './backends.js';
import { SaveStore, AUTO_ID } from './store.js';
import { parseSaveText, stringifyDoc, exportFileName, createSaveDoc, SaveError, MAX_FILE_BYTES } from './format.js';

export { SaveError, AUTO_ID };

/** Autosave every 2 game minutes (ticks of 100 ms); even with a crowd only a few milliseconds (docs/PERFORMANCE.md) */
export const AUTOSAVE_TICKS = 2 * 60 * 10;
/** First autosave 30 game seconds after game start or load – a fresh restore point */
export const AUTOSAVE_FIRST_TICKS = 30 * 10;

/** Is an autosave due? */
export const autosaveDue = (tick, lastTick) => tick - lastTick >= AUTOSAVE_TICKS;

/** Initial value for autosaveDue at game start: the first autosave comes after AUTOSAVE_FIRST_TICKS. */
export const autosaveStart = (tick) => tick - AUTOSAVE_TICKS + AUTOSAVE_FIRST_TICKS;

/**
 * Capture the save game immediately as compact JSON text (synchronous, still within the same tick). `state` may point to the
 * running state (saveGame(…, { clone: false })): the text is the snapshot.
 * @param {any} state @param {{ name: string, savedAt?: Date }} info
 * @returns {{ text: string, meta: any }}
 */
export function snapshotText(state, info) {
  const doc = createSaveDoc(state, info);
  return { text: stringifyDoc(doc, { compact: true }), meta: doc.meta };
}

/** Wait briefly until the browser has air (between two frames), at most `timeout` ms. */
export const whenIdle = (timeout = 1500) => new Promise((resolve) => {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout });
  else setTimeout(resolve, 0);
});

let storePromise = null;

/**
 * Open the shared store (on the first call also adopt the old single save game).
 * @param {{ legacyName?: string }} [opts]
 * @returns {Promise<SaveStore>}
 */
export function getStore(opts = {}) {
  storePromise ??= (async () => {
    const store = new SaveStore(await openBackend());
    try { await store.migrateLegacy(globalThis.localStorage, opts.legacyName); } catch { /* old save stays behind */ }
    // Pull saves from an earlier session in which only localStorage worked into IndexedDB
    if (store.kind === 'indexeddb' && globalThis.localStorage) {
      try { await store.adoptFrom(new LocalStorageBackend()); } catch { /* stay in localStorage, next attempt at next start */ }
    }
    return store;
  })();
  return storePromise;
}

/** Tests only: set a different store. */
export function setStore(store) { storePromise = Promise.resolve(store); }

/**
 * Read the import file and check it completely.
 * @param {File|Blob} file
 * @returns {Promise<any>} envelope
 */
export async function readSaveFile(file) {
  if (!file) throw new SaveError('saves.err.notJson');
  if (file.size > MAX_FILE_BYTES) throw new SaveError('saves.err.tooLarge', { mb: Math.round(MAX_FILE_BYTES / 1048576) });
  let text;
  try { text = await file.text(); } catch (e) { throw new SaveError('saves.err.read', {}, e); }
  return parseSaveText(text, { deep: true });
}

/**
 * Download the envelope as a file.
 * @param {any} doc @param {{ compact?: boolean }} [opts]
 * @returns {string} file name
 */
export function downloadDoc(doc, { compact = false } = {}) {
  const name = exportFileName(doc.meta?.name, new Date());
  const blob = new Blob([stringifyDoc(doc, { compact })], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return name;
}
