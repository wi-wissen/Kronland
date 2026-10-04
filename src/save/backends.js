// Storage backends for save games: simple key/value store for text (async).
//
// Choice: IndexedDB first – large quota (usually hundreds of MB instead of ~5 MB with localStorage) and
// asynchronous, so it does not block the game when writing large saves. If IndexedDB is missing or
// blocked (some private windows, embedded views), localStorage serves as fallback; if that fails too,
// saves stay in memory only until the page is closed (notice in the UI).
// In all cases the data is stored compressed (codec.js).

import { SaveError } from './format.js';

const isQuota = (e) => !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
const wrap = (e) => (e instanceof SaveError ? e : new SaveError(isQuota(e) ? 'saves.err.quota' : 'saves.err.storage', {}, e));

/**
 * @typedef {Object} Backend
 * @property {'indexeddb'|'localstorage'|'memory'} kind
 * @property {(key: string) => Promise<string|null>} get
 * @property {(key: string, value: string) => Promise<void>} set
 * @property {(key: string) => Promise<void>} delete
 * @property {(key: string, fn: (current: string|null) => Change) => Promise<void>} atomic
 *   Reads `key`, computes the change from it synchronously and writes everything in one go – in a single
 *   transaction for IndexedDB (also against other tabs), otherwise with rollback on errors. If fn throws, nothing is written.
 */

/**
 * @typedef {Object} Change
 * @property {string} value new value for the key that was read
 * @property {Array<[string, string]>} [set] write further keys (before `value`)
 * @property {string[]} [del] delete keys
 */

/**
 * atomic() for synchronous stores (memory, localStorage): everything in one JS run without an `await`
 * in between (so it cannot be interrupted); on an error (storage full) restore the old values.
 * @param {{ getSync(k: string): string|null, setSync(k: string, v: string): void, deleteSync(k: string): void }} b
 */
function atomicSync(b, key, fn) {
  const change = fn(b.getSync(key));
  const writes = [...(change.set ?? []), [key, change.value]];
  const done = [];
  try {
    for (const [k, v] of writes) { const old = b.getSync(k); b.setSync(k, v); done.push([k, old]); }
  } catch (e) {
    for (const [k, old] of done.reverse()) { try { if (old === null) b.deleteSync(k); else b.setSync(k, old); } catch { /* best effort */ } }
    throw e;
  }
  for (const k of change.del ?? []) { try { b.deleteSync(k); } catch { /* stays behind as a leftover */ } }
}

/** In memory (tests; fallback when the browser does not allow storing anything). */
export class MemoryBackend {
  /** @param {{ limit?: number }} [opts] limit: max. total characters, to test "storage full" */
  constructor({ limit = Infinity } = {}) { this.kind = 'memory'; this.map = new Map(); this.limit = limit; }
  getSync(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setSync(key, value) {
    let used = value.length;
    for (const [k, v] of this.map) if (k !== key) used += v.length;
    if (used > this.limit) throw new SaveError('saves.err.quota');
    this.map.set(key, value);
  }
  deleteSync(key) { this.map.delete(key); }
  async get(key) { return this.getSync(key); }
  async set(key, value) { this.setSync(key, value); }
  async delete(key) { this.deleteSync(key); }
  async atomic(key, fn) { atomicSync(this, key, fn); }
}

/** localStorage with prefix. */
export class LocalStorageBackend {
  constructor(storage = globalThis.localStorage, prefix = 'kronland-saves:') { this.kind = 'localstorage'; this.ls = storage; this.prefix = prefix; }
  getSync(key) { try { return this.ls.getItem(this.prefix + key); } catch (e) { throw wrap(e); } }
  setSync(key, value) { try { this.ls.setItem(this.prefix + key, value); } catch (e) { throw wrap(e); } }
  deleteSync(key) { try { this.ls.removeItem(this.prefix + key); } catch (e) { throw wrap(e); } }
  async get(key) { return this.getSync(key); }
  async set(key, value) { this.setSync(key, value); }
  async delete(key) { this.deleteSync(key); }
  async atomic(key, fn) { atomicSync(this, key, fn); }
  /** Can we write here at all? */
  static usable(storage = globalThis.localStorage) {
    try { const k = 'kronland-probe'; storage.setItem(k, '1'); storage.removeItem(k); return true; } catch { return false; }
  }
}

const req = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

/** IndexedDB: database 'kronland', object store 'saves' (key → text). */
export class IdbBackend {
  constructor(db, name = 'kronland', idb = globalThis.indexedDB) {
    this.kind = 'indexeddb'; this.name = name; this.idb = idb;
    this.attach(db);
  }

  attach(db) {
    this.db = db;
    // Another tab wants to upgrade the database (future version): release the connection, reopen if needed
    db.onversionchange = () => { db.close(); if (this.db === db) this.db = null; };
    db.onclose = () => { if (this.db === db) this.db = null; };
  }

  /** @returns {Promise<IDBDatabase>} */
  static openDb(name, idb) {
    const open = idb.open(name, 1);
    open.onupgradeneeded = () => { if (!open.result.objectStoreNames.contains('saves')) open.result.createObjectStore('saves'); };
    let timer;
    return Promise.race([
      req(open),
      // Some browsers never answer open() in private mode → give up after ~8 s. Counted in
      // short steps: if the main thread is busy for a long time (game start with software graphics), the deadline
      // does not keep running, and an answer that has already arrived is not wrongly counted as "hanging".
      new Promise((_, reject) => {
        let left = 32;
        const step = () => { timer = setTimeout(() => (--left > 0 ? step() : reject(new Error('timeout'))), 250); };
        step();
      }),
    ]).finally(() => clearTimeout(timer));
  }

  /** @returns {Promise<IdbBackend|null>} null if IndexedDB is missing or blocked */
  static async open(name = 'kronland', idb = globalThis.indexedDB) {
    if (!idb) return null;
    try {
      const b = new IdbBackend(await IdbBackend.openDb(name, idb), name, idb);
      await b.get('probe');
      return b;
    } catch (e) {
      console.warn('Saves: IndexedDB not usable, falling back', e);
      return null;
    }
  }

  /**
   * Run a transaction. If the connection is gone (Safari closes it in the background, for example), reopen once.
   * @param {IDBTransactionMode} mode @param {(store: IDBObjectStore) => IDBRequest|void} fn
   */
  async tx(mode, fn, retry = true) {
    let t;
    try {
      if (!this.db) this.attach(await IdbBackend.openDb(this.name, this.idb));
      t = this.db.transaction('saves', mode);
    } catch (e) {
      if (retry && (e?.name === 'InvalidStateError' || !this.db)) { this.db = null; return this.tx(mode, fn, false); }
      throw wrap(e);
    }
    try {
      const done = new Promise((resolve, reject) => { t.oncomplete = resolve; t.onerror = () => reject(t.error); t.onabort = () => reject(t.error ?? new Error('abort')); });
      const r = fn(t.objectStore('saves'));
      const result = r ? await req(r) : undefined;
      await done;
      return result;
    } catch (e) { throw wrap(e); }
  }

  async get(key) { return (await this.tx('readonly', (s) => s.get(key))) ?? null; }
  async set(key, value) { await this.tx('readwrite', (s) => s.put(value, key)); }
  async delete(key) { await this.tx('readwrite', (s) => s.delete(key)); }

  /** Read and write in one transaction: other tabs cannot interfere. */
  async atomic(key, fn) {
    let thrown = null;
    await this.tx('readwrite', (s) => {
      const r = s.get(key);
      r.onsuccess = () => {
        let change;
        try { change = fn(r.result ?? null); } catch (e) { thrown = e; r.transaction.abort(); return; }
        for (const [k, v] of change.set ?? []) s.put(v, k);
        s.put(change.value, key);
        for (const k of change.del ?? []) s.delete(k);
      };
    }).catch((e) => { throw thrown ?? e; });
  }
}

/** Open the best available backend. @returns {Promise<Backend>} */
export async function openBackend() {
  const idb = await IdbBackend.open();
  if (idb) return idb;
  if (globalThis.localStorage && LocalStorageBackend.usable()) return new LocalStorageBackend();
  return new MemoryBackend();
}
