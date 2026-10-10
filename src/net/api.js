// REST client for the game API (contract/openapi.yaml): bearer token, error format { error: { code, params } },
// one retry after a refreshed token.

import { NetError } from './errors.js';

export class ApiError extends NetError {
  /** @param {string} code @param {Record<string, any>} params @param {number} status */
  constructor(code, params, status) { super(code, params); this.name = 'ApiError'; this.status = status; }
}

/** Error from a failed response: the server's code, otherwise net.err.http. */
export async function errorFrom(res) {
  let body = null;
  try { body = await res.json(); } catch { /* no JSON */ }
  const e = body?.error;
  if (e && typeof e.code === 'string') return new ApiError(e.code, e.params && typeof e.params === 'object' ? e.params : {}, res.status);
  return new ApiError('net.err.http', { status: res.status }, res.status);
}

/**
 * @param {{ server: string, auth?: { token(): Promise<string|null>, refresh(): Promise<string|null> }|null, fetch?: typeof fetch }} env
 */
export function createApi({ server, auth = null, fetch: f = globalThis.fetch.bind(globalThis) }) {
  const url = (path) => (/^https?:\/\//.test(path) ? path : server + path);
  const own = (u) => u === server || u.startsWith(server + '/');

  async function send(method, path, { body, headers = {}, signal } = {}, retry = true) {
    const u = url(path);
    const h = { Accept: 'application/json', ...headers };
    const token = own(u) ? await auth?.token() : null;
    if (token) h.Authorization = `Bearer ${token}`;
    let payload = body;
    if (body !== undefined && !(body instanceof FormData) && !(body instanceof Blob) && typeof body !== 'string') { payload = JSON.stringify(body); h['Content-Type'] = 'application/json'; }
    let res;
    try { res = await f(u, { method, headers: h, body: payload, signal }); } catch (e) { throw new NetError('net.err.offline', { url: u }, e); }
    if (res.status === 401 && token && retry && (await auth?.refresh())) return send(method, path, { body, headers, signal }, false);
    return res;
  }

  /** Request that must succeed: JSON answer (or null for 204). */
  async function request(method, path, opts) {
    const res = await send(method, path, opts);
    if (!res.ok) throw await errorFrom(res);
    return res.status === 204 ? null : res.json();
  }

  return {
    server,
    send,
    request,
    get: (path, opts) => request('GET', path, opts),
    post: (path, body, opts) => request('POST', path, { ...opts, body }),
    put: (path, body, opts) => request('PUT', path, { ...opts, body }),
    del: (path, opts) => request('DELETE', path, opts),
    /** fetch() that adds the token for the server's own addresses (pack manifests and files of private packs). */
    fetch: (u, init = {}) => (own(String(u)) ? send(init.method ?? 'GET', String(u), { headers: init.headers, body: init.body, signal: init.signal }) : f(u, init)),
  };
}
