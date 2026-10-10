// Progress events for levels from packs: started, run, completed, failed (contract/schemas/progress.schema.json).
// Events are kept in a buffer (IndexedDB) and sent to POST /api/v1/progress when the player is signed in and online;
// each event has a UUID, so sending twice is harmless. The game does not know who reads them.

import { NetError } from './errors.js';

/** Editable code of one event: all sections together at most this many characters. */
export const MAX_CODE = 64 * 1024;
export const MAX_BUFFER = 500;
export const BATCH = 50;
const KEY = 'progress';
const DONE_KEY = 'kronland-pack-done';

/** Code sections limited to MAX_CODE characters in total (the longest ones are cut). */
export function limitCode(sections, max = MAX_CODE) {
  const entries = Object.entries(sections ?? {}).filter(([, v]) => typeof v === 'string').slice(0, 32);
  let total = entries.reduce((n, [, v]) => n + v.length, 0);
  const out = Object.fromEntries(entries);
  while (total > max) {
    const [k] = entries.reduce((a, b) => (out[b[0]].length > out[a[0]].length ? b : a));
    const cut = Math.min(out[k].length, total - max);
    out[k] = out[k].slice(0, out[k].length - cut);
    total -= cut;
  }
  return out;
}

/**
 * @param {{ api: { post(path: string, body: any): Promise<any> }, kv: { get(k: string): Promise<any>, set(k: string, v: any): Promise<void> }, canSend?: () => Promise<boolean>|boolean, now?: () => Date, uuid?: () => string }} env
 */
export function createProgress({ api, kv, canSend = () => true, now = () => new Date(), uuid = () => globalThis.crypto.randomUUID() }) {
  let queue = Promise.resolve();
  /** Run buffer changes one after another. */
  const serial = (fn) => { const run = queue.then(fn, fn); queue = run.catch(() => {}); return run; };
  const read = async () => { const b = await kv.get(KEY).catch(() => null); return Array.isArray(b) ? b : []; };
  const write = (b) => kv.set(KEY, b.slice(-MAX_BUFFER)).catch(() => {});
  let timer = null;

  const self = {
    /** Events waiting to be sent. */
    pending: async () => (await queue.then(read)).length,

    /** Buffer an event and try to send it soon. @returns {Promise<object>} the event */
    record(partial) {
      const event = { id: uuid(), at: now().toISOString().replace(/\.\d+Z$/, 'Z'), ...partial };
      return serial(async () => { await write([...(await read()), event]); return event; }).then((e) => { self.flushSoon(); return e; });
    },

    flushSoon(ms = 1500) {
      clearTimeout(timer);
      timer = setTimeout(() => { self.flush().catch(() => {}); }, ms);
    },

    /** Send the buffer in batches. @returns {Promise<number>} events delivered (or dropped as invalid) */
    flush() {
      return serial(async () => {
        if (!(await canSend())) return 0;
        let sent = 0;
        for (;;) {
          const batch = (await read()).slice(0, BATCH);
          if (!batch.length) return sent;
          try {
            await api.post('/api/v1/progress', { events: batch });
          } catch (e) {
            // The server refused the content (422): do not retry forever. Anything else (offline, 5xx): keep for later.
            if (!(e instanceof NetError) || e.status !== 422) return sent;
          }
          const gone = new Set(batch.map((x) => x.id));
          await write((await read()).filter((x) => !gone.has(x.id)));
          sent += batch.length;
        }
      });
    },
  };
  return self;
}

/**
 * Follows one level at a time and turns the game's hooks into events.
 * @param {{ record(e: any): any }} progress @param {() => number} [now] ms
 */
export function createTracker(progress, now = Date.now) {
  /** @type {null | { pack: string, packHash: string, level: string, t0: number, runs: number, starts: number, code: any }} */
  let cur = null;
  const base = () => ({ pack: cur.pack, packHash: cur.packHash, level: cur.level });
  const seconds = () => Math.max(0, Math.round((now() - cur.t0) / 1000));
  const attempts = () => cur.runs || cur.starts;
  return {
    /** The level starts (again). @param {{ id: string, hash: string, level: string }} ref */
    start(ref) {
      const same = cur && cur.pack === ref.id && cur.level === ref.level;
      cur = { pack: ref.id, packHash: ref.hash, level: ref.level, t0: same ? cur.t0 : now(), runs: same ? cur.runs : 0, starts: same ? cur.starts + 1 : 1, code: same ? cur.code : null };
      progress.record({ ...base(), type: 'started', attempts: attempts(), seconds: seconds() });
    },
    /** The player pressed "Run" with these editable sections. */
    run(sections) {
      if (!cur) return;
      cur.runs++;
      cur.code = limitCode(sections);
      progress.record({ ...base(), type: 'run', attempts: cur.runs, seconds: seconds(), code: cur.code });
    },
    /** @param {'completed'|'failed'} type @param {number} [score] */
    finish(type, score) {
      if (!cur) return;
      progress.record({ ...base(), type, attempts: attempts(), seconds: seconds(), ...(Number.isInteger(score) ? { score } : {}), ...(cur.code ? { code: cur.code } : {}) });
    },
    stop() { cur = null; },
  };
}

/** Levels of packs the player has completed on this device (check marks in the list): "<pack>/<level>" */
export function loadDone(storage = globalThis.localStorage) {
  try { const v = JSON.parse(storage?.getItem(DONE_KEY) ?? '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
export function markDone(ref, storage = globalThis.localStorage) {
  try { storage?.setItem(DONE_KEY, JSON.stringify({ ...loadDone(storage), [`${ref.id}/${ref.level}`]: ref.hash })); } catch { /* not remembered */ }
}
