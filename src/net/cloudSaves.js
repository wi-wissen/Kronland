// Cloud save games: a storage backend for src/save next to IndexedDB (backends.js). SaveStore keeps working
// unchanged - list, save, load, rename, delete - only the place differs. The server stores the envelope
// (format kronland-save) unchanged; overwriting needs the ETag last seen (If-Match), so a second device cannot
// be overwritten unnoticed (saves.err.conflict).
//
//   index        -> GET /api/v1/saves                       (metadata and preview of every save)
//   slot:<id>    -> GET /api/v1/saves/<id>                  (the envelope)
//   write        -> POST /api/v1/saves | PUT /api/v1/saves/<id> with If-Match
//   delete       -> DELETE /api/v1/saves/<id>

import { SaveStore } from '../save/store.js';
import { SaveError, parseSaveText } from '../save/format.js';
import { decode } from '../save/codec.js';
import { NetError } from './errors.js';
import { errorFrom } from './api.js';

const quote = (etag) => `"${etag}"`;
const unquote = (h) => String(h ?? '').replace(/^W\//, '').replace(/^"|"$/g, '');

/** NetError -> SaveError with a key the save dialogs know. */
function asSaveError(e) {
  if (e instanceof SaveError) return e;
  if (e instanceof NetError) {
    if (e.status === 412) return new SaveError('saves.err.conflict', e.params, e);
    if (e.status === 401 || e.status === 403) return new SaveError('saves.err.signedOut', {}, e);
    if (e.code === 'net.err.offline') return new SaveError('saves.err.offline', {}, e);
    return new SaveError('saves.err.cloud', { code: e.code }, e);
  }
  return e;
}

export class CloudBackend {
  /** @param {ReturnType<typeof import('./api.js').createApi>} api */
  constructor(api) {
    this.kind = 'cloud';
    this.api = api;
    /** save id -> ETag last seen */
    this.etags = new Map();
    /** Last failure of a read (SaveStore.list() swallows errors; the dialog asks for it) */
    this.lastError = null;
  }

  /** The list from the server. `refresh`: remember its ETags (what the player sees now); otherwise only unknown ids are added. */
  async fetchIndex(refresh) {
    const { saves } = await this.api.get('/api/v1/saves');
    if (refresh) this.etags = new Map(saves.map((s) => [s.id, s.etag]));
    else for (const s of saves) if (!this.etags.has(s.id)) this.etags.set(s.id, s.etag);
    return JSON.stringify(saves.map(({ etag: _etag, ...entry }) => entry));
  }

  async get(key) {
    try {
      if (key === 'index') {
        const text = await this.fetchIndex(true);
        this.lastError = null;
        return text;
      }
      if (key.startsWith('slot:')) {
        const id = key.slice(5);
        const res = await this.api.send('GET', `/api/v1/saves/${encodeURIComponent(id)}`);
        if (res.status === 404) return null;
        if (!res.ok) throw await errorFrom(res);
        this.etags.set(id, unquote(res.headers.get('ETag')));
        return await res.text();
      }
      return null;
    } catch (e) {
      this.lastError = asSaveError(e);
      if (key.startsWith('slot:')) throw this.lastError;
      return null;
    }
  }

  async set(key, value) {
    if (key.startsWith('slot:')) await this.write(key.slice(5), await decode(value), null);
  }

  async delete(key) {
    if (!key.startsWith('slot:')) return;
    try { await this.api.del(`/api/v1/saves/${encodeURIComponent(key.slice(5))}`, { headers: this.ifMatch(key.slice(5)) }); } catch (e) { throw asSaveError(e); }
    this.etags.delete(key.slice(5));
  }

  ifMatch(id) { return this.etags.has(id) ? { 'If-Match': quote(this.etags.get(id)) } : {}; }

  /** Write one save: new -> POST, known -> PUT with If-Match. */
  async write(id, text, entry) {
    // Without an entry (rename) the thumbnail field is left out: the server keeps the one it has
    const body = { envelope: JSON.parse(text), ...(entry ? { thumb: entry.thumb ?? null } : {}) };
    try {
      const known = this.etags.has(id);
      const saved = known
        ? await this.api.put(`/api/v1/saves/${encodeURIComponent(id)}`, body, { headers: this.ifMatch(id) })
        : await this.api.post('/api/v1/saves', { ...body, id });
      this.etags.set(saved.id, saved.etag);
      if (saved.id !== id) this.etags.delete(id);
    } catch (e) { throw asSaveError(e); }
  }

  /** Rename = overwrite the envelope with another meta.name. */
  async rename(id, name) {
    const text = await this.get('slot:' + id);
    if (text === null) throw new SaveError('saves.err.missing');
    const envelope = JSON.parse(text);
    envelope.meta.name = name;
    await this.write(id, JSON.stringify(envelope), null);
  }

  /** SaveStore.updateIndex(): read the list, let the store compute the change, apply it with requests. */
  async atomic(key, fn) {
    let raw;
    try { raw = await this.fetchIndex(false); } catch (e) { throw asSaveError(e); }
    const change = fn(raw);
    const before = new Map(JSON.parse(raw).map((e) => [e.id, e]));
    const list = JSON.parse(change.value);
    for (const k of change.del ?? []) await this.delete(k);
    const written = new Set();
    for (const [k, v] of change.set ?? []) {
      const id = k.slice(5);
      await this.write(id, await decode(v), list.find((e) => e.id === id));
      written.add(id);
    }
    for (const e of list) {
      const old = before.get(e.id);
      if (old && !written.has(e.id) && old.name !== e.name) await this.rename(e.id, e.name);
    }
  }
}

/** SaveStore on the server. */
export const createCloudStore = (api) => new SaveStore(new CloudBackend(api));

/**
 * `?save=<url>`: load a save from the game's server. Own saves open normally; a foreign one (teacher's signed link)
 * opens read-only. The address must belong to the configured server.
 * @param {string} url
 * @param {{ api: ReturnType<typeof import('./api.js').createApi>, signedIn: boolean }} env
 * @returns {Promise<{ doc: any, readOnly: boolean }>}
 */
export async function openSaveUrl(url, { api, signedIn }) {
  let u;
  try { u = new URL(url); } catch { throw new SaveError('saves.err.wrongFormat'); }
  const m = /^\/api\/v1\/saves\/([A-Za-z0-9_-]{1,64})\/?$/.exec(u.pathname);
  if (!m || !(u.origin === new URL(api.server).origin)) throw new SaveError('saves.err.foreignHost');
  let res;
  try { res = await api.send('GET', u.href); } catch (e) { throw asSaveError(e); }
  if (!res.ok) throw asSaveError(await errorFrom(res));
  const doc = parseSaveText(await res.text(), { deep: true });
  let own = false;
  if (signedIn) {
    try { own = (await api.get('/api/v1/saves')).saves.some((s) => s.id === m[1]); } catch { /* unknown: read-only */ }
  }
  return { doc, readOnly: !own };
}
