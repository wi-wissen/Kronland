// Small key/value stores for the network layer in IndexedDB (database 'kronland-net', separate from the save
// database so neither can block the other's upgrade), with an in-memory fallback if IndexedDB is missing or blocked
// (private windows, tests). Values are structured-cloned, so Blob and ArrayBuffer work.
//   kv       tokens, progress buffer, remembered user
//   packs    pack id -> { hash, text, at } (last manifest, for offline play)
//   files    file name (= SHA-256 + extension) -> { type, data: ArrayBuffer } (immutable pack files)

export const STORES = ['kv', 'packs', 'files'];

/** @typedef {{ get(k: string): Promise<any>, set(k: string, v: any): Promise<void>, delete(k: string): Promise<void>, keys(): Promise<string[]> }} Store */

/** @returns {Record<string, Store>} */
export function memoryKv() {
  return Object.fromEntries(STORES.map((n) => {
    const m = new Map();
    return [n, { get: async (k) => (m.has(k) ? structuredClone(m.get(k)) : undefined), set: async (k, v) => { m.set(k, structuredClone(v)); }, delete: async (k) => { m.delete(k); }, keys: async () => [...m.keys()] }];
  }));
}

const req = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

/**
 * Open the stores; falls back to memory if IndexedDB is not usable.
 * @param {IDBFactory|undefined} [idb]
 * @returns {Promise<Record<string, Store>>}
 */
export async function openKv(idb = globalThis.indexedDB) {
  if (!idb) return memoryKv();
  try {
    const open = idb.open('kronland-net', 1);
    open.onupgradeneeded = () => { for (const n of STORES) if (!open.result.objectStoreNames.contains(n)) open.result.createObjectStore(n); };
    const db = await req(open);
    const run = async (store, mode, fn) => {
      const t = db.transaction(store, mode);
      const done = new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
      const r = await req(fn(t.objectStore(store)));
      await done;
      return r;
    };
    return Object.fromEntries(STORES.map((n) => [n, {
      get: (k) => run(n, 'readonly', (s) => s.get(k)),
      set: async (k, v) => { await run(n, 'readwrite', (s) => s.put(v, k)); },
      delete: async (k) => { await run(n, 'readwrite', (s) => s.delete(k)); },
      keys: async () => (await run(n, 'readonly', (s) => s.getAllKeys())).map(String),
    }]));
  } catch (e) {
    console.warn('Net: IndexedDB not usable, keeping data in memory', e);
    return memoryKv();
  }
}
