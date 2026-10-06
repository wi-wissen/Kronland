// Management of multiple save games (slots): list, save, overwrite, rename, delete.
// Storage in the backend (backends.js) under two kinds of keys:
//   'index'      → JSON list of the entries (name, time, game time, mode, thumbnail, size)
//   'slot:<id>'  → compressed save envelope (format.js, codec.js)
// The list thus loads only the small metadata; the large state is read only on load.
// All writes run one after another (queue), so autosave and saving do not overtake each other.

import { encode, decode } from './codec.js';
import { createSaveDoc, parseSaveText, stringifyDoc, describeState, SaveError } from './format.js';

export const AUTO_ID = 'auto';
/** Earlier single save game (up to phase 9) */
export const LEGACY_KEY = 'kronland-save-1';

/**
 * @typedef {Object} SaveEntry
 * @property {string} id
 * @property {string} name
 * @property {string} savedAt ISO time
 * @property {number} tick
 * @property {'free'|'mission'} mode
 * @property {string|null} mission
 * @property {number} seed
 * @property {number} players
 * @property {boolean} fog
 * @property {string|null} thumb small preview image (data: URL)
 * @property {number} size stored characters
 * @property {boolean} auto autosave slot
 */

/** @param {string|null} raw @returns {SaveEntry[]} */
function parseIndex(raw) {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((e) => e && typeof e.id === 'string') : [];
  } catch { return []; }
}

const newId = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export class SaveStore {
  /** @param {import('./backends.js').Backend} backend */
  constructor(backend) {
    this.backend = backend;
    this.queue = Promise.resolve();
  }

  get kind() { return this.backend.kind; }

  /** Run writes one after another. */
  serial(fn) {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {});
    return run;
  }

  async readIndex() {
    let raw;
    try { raw = await this.backend.get('index'); } catch { return []; }
    return parseIndex(raw);
  }

  /**
   * Read the list, change it and write it back – together with the data of a slot in one go
   * (backend.atomic: a transaction for IndexedDB, so also safe against a second tab).
   * @param {(list: SaveEntry[]) => { list: SaveEntry[], set?: Array<[string, string]>, del?: string[] }} fn
   */
  async updateIndex(fn) {
    await this.backend.atomic('index', (raw) => {
      const r = fn(parseIndex(raw));
      return { value: JSON.stringify(r.list), set: r.set, del: r.del };
    });
  }

  /** Entries, newest first. @returns {Promise<SaveEntry[]>} */
  async list() {
    await this.queue;
    const list = await this.readIndex();
    return list.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  }

  /** Newest entry or null. */
  async latest() { return (await this.list())[0] ?? null; }

  /**
   * Store a save game.
   * @param {any} state simulation state (saveGame())
   * @param {{ id?: string, name: string, thumb?: string|null, savedAt?: Date }} opts
   *   id: overwrite an existing slot or use a fixed slot (AUTO_ID)
   * @returns {Promise<SaveEntry>}
   */
  save(state, { id, name, thumb = null, savedAt = new Date() }) {
    return this.serial(async () => {
      const doc = createSaveDoc(state, { name, savedAt });
      return this.put(doc, { id, thumb });
    });
  }

  /** Store a finished envelope (e.g. from an import) as a new slot. */
  importDoc(doc, { thumb = null } = {}) {
    return this.serial(() => this.put(doc, { thumb }));
  }

  /**
   * Store the finished JSON text of an envelope (autosave: the text is created immediately in the tick without a deep copy,
   * compression and storage run afterwards asynchronously).
   * @param {string} text compact JSON text (stringifyDoc) @param {any} meta doc.meta
   * @param {{ id?: string, thumb?: string|null }} opts
   * @returns {Promise<SaveEntry>}
   */
  saveText(text, meta, { id, thumb = null }) {
    return this.serial(() => this.putText(text, meta, { id, thumb }));
  }

  put(doc, { id, thumb }) {
    return this.putText(stringifyDoc(doc, { compact: true }), { ...doc.meta, ...describeState(doc.state) }, { id, thumb });
  }

  async putText(text, meta, { id, thumb }) {
    const slotId = id ?? newId();
    // Compress before the transaction (IndexedDB transactions end as soon as something else is awaited)
    const data = await encode(text);
    /** @type {SaveEntry} */
    const entry = {
      id: slotId, name: meta.name, savedAt: meta.savedAt,
      tick: meta.tick, mode: meta.mode, mission: meta.mission, seed: meta.seed, players: meta.players, fog: meta.fog,
      thumb: thumb ?? null, size: data.length, auto: slotId === AUTO_ID,
    };
    // Slot and list together: if the storage is full, both stay at the old state
    await this.updateIndex((list) => ({ list: [entry, ...list.filter((e) => e.id !== slotId)], set: [['slot:' + slotId, data]] }));
    return entry;
  }

  /**
   * Read the envelope of a slot (checked and migrated). The name from the list applies (rename).
   * @returns {Promise<any>}
   */
  async load(id) {
    await this.queue;
    const list = await this.readIndex();
    const entry = list.find((e) => e.id === id);
    const raw = await this.backend.get('slot:' + id);
    if (!entry || !raw) throw new SaveError('saves.err.missing');
    let text;
    try { text = await decode(raw); } catch (e) { throw new SaveError('saves.err.broken', { detail: 'decode' }, e); }
    const doc = parseSaveText(text);
    doc.meta.name = entry.name;
    return doc;
  }

  /** Rename (the list only; the name in the state is replaced on load/export). */
  rename(id, name) {
    return this.serial(async () => {
      let entry = null;
      await this.updateIndex((list) => {
        entry = list.find((x) => x.id === id);
        if (!entry) throw new SaveError('saves.err.missing');
        entry.name = String(name).trim().slice(0, 80) || entry.name;
        return { list };
      });
      return entry;
    });
  }

  remove(id) {
    return this.serial(() => this.updateIndex((list) => ({ list: list.filter((e) => e.id !== id), del: ['slot:' + id] })));
  }

  /**
   * Adopt slots from another store and delete them there – e.g. saves made in a session without
   * IndexedDB (fallback to localStorage). Same IDs: the newer save wins.
   * @param {import('./backends.js').Backend} other
   * @returns {Promise<number>} number of adopted slots
   */
  adoptFrom(other) {
    return this.serial(async () => {
      const theirs = parseIndex(await other.get('index'));
      let n = 0;
      for (const e of theirs) {
        const data = await other.get('slot:' + e.id);
        if (data) {
          await this.updateIndex((list) => {
            const mine = list.find((x) => x.id === e.id);
            if (mine && String(mine.savedAt) >= String(e.savedAt)) return { list };
            n++;
            return { list: [e, ...list.filter((x) => x.id !== e.id)], set: [['slot:' + e.id, data]] };
          });
        }
        await other.delete('slot:' + e.id).catch(() => {});
      }
      if (theirs.length) await other.delete('index').catch(() => {});
      return n;
    });
  }

  /**
   * Adopt the earlier single save game from localStorage (once) and remove it there.
   * @param {Storage} [ls] @param {string} [name]
   * @returns {Promise<SaveEntry|null>}
   */
  migrateLegacy(ls = globalThis.localStorage, name = 'Kronland') {
    return this.serial(async () => {
      let raw = null;
      try { raw = ls?.getItem(LEGACY_KEY) ?? null; } catch { return null; }
      if (!raw) return null;
      let entry = null;
      try {
        const doc = parseSaveText(raw);
        doc.meta.name = name;
        doc.meta.savedAt = new Date().toISOString();
        entry = await this.put(doc, { thumb: null });
      } catch (e) {
        // Broken old save: do not adopt, but also do not retry again and again
        if (e instanceof SaveError && (e.code === 'saves.err.quota' || e.code === 'saves.err.storage')) throw e;
      }
      try { ls.removeItem(LEGACY_KEY); } catch { /* never mind */ }
      return entry;
    });
  }
}
