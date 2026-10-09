import { describe, it, expect } from 'vitest';
import { createApi, ApiError } from '../../src/net/api.js';
import { errorMessage, NetError } from '../../src/net/errors.js';
import { fixJson } from './helpers.js';

const SERVER = 'https://api.example';
const reply = (status, body, headers = {}) => new Response(body === null ? null : JSON.stringify(body), { status, headers });

function setup(handler, token = 'T1') {
  const requests = [];
  const auth = { token: async () => token, refresh: async () => { token = 'T2'; return token; } };
  const fetch = async (url, init) => { requests.push({ url, ...init }); return handler(requests.length, url, init); };
  return { api: createApi({ server: SERVER, auth, fetch }), requests };
}

describe('api client', () => {
  it('sends the bearer token and JSON bodies to the server', async () => {
    const { api, requests } = setup(() => reply(200, { ok: true }));
    expect(await api.put('/api/v1/packs/x', { a: 1 })).toEqual({ ok: true });
    expect(requests[0].url).toBe(`${SERVER}/api/v1/packs/x`);
    expect(requests[0].headers.Authorization).toBe('Bearer T1');
    expect(requests[0].headers['Content-Type']).toBe('application/json');
    expect(requests[0].body).toBe('{"a":1}');
  });

  it('error format { error: { code, params } } becomes an ApiError', async () => {
    const { api } = setup(() => reply(422, fixJson('errors/packs-err-schema.json')));
    const e = await api.get('/x').catch((x) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toBeInstanceOf(NetError);
    expect(e).toMatchObject({ code: 'packs.err.schema', params: { path: '/levels/0/world/width' }, status: 422 });
  });

  it('answers without that format get net.err.http; 204 is null', async () => {
    const { api } = setup((n) => (n === 1 ? new Response('<html>oops</html>', { status: 502 }) : reply(204, null)));
    await expect(api.get('/x')).rejects.toMatchObject({ code: 'net.err.http', params: { status: 502 } });
    expect(await api.del('/x')).toBeNull();
  });

  it('no network is net.err.offline', async () => {
    const api = createApi({ server: SERVER, fetch: async () => { throw new TypeError('Failed to fetch'); } });
    await expect(api.get('/x')).rejects.toMatchObject({ code: 'net.err.offline' });
  });

  it('401: refresh the token and retry once, not forever', async () => {
    const { api, requests } = setup((n) => (n === 1 ? reply(401, fixJson('errors/auth-err-invalid.json')) : reply(200, { n })));
    expect(await api.get('/x')).toEqual({ n: 2 });
    expect(requests.map((r) => r.headers.Authorization)).toEqual(['Bearer T1', 'Bearer T2']);
    const always = setup(() => reply(401, fixJson('errors/auth-err-invalid.json')));
    await expect(always.api.get('/x')).rejects.toMatchObject({ code: 'auth.err.invalid', status: 401 });
    expect(always.requests).toHaveLength(2);
  });

  it('the token goes only to the game server, never to other hosts', async () => {
    const { api, requests } = setup(() => new Response('x'));
    await api.fetch('https://cdn.example/file.png');
    await api.fetch(`${SERVER}/api/v1/packs/a/files/b.json`);
    expect(requests[0].headers?.Authorization).toBeUndefined();
    expect(requests[1].headers.Authorization).toBe('Bearer T1');
  });

  it('without a token no Authorization header', async () => {
    const { api, requests } = setup(() => reply(200, {}), null);
    await api.get('/api/v1/x');
    expect(requests[0].headers.Authorization).toBeUndefined();
  });
});

describe('error texts', () => {
  const t = (k, p) => `${k}:${JSON.stringify(p ?? {})}`;
  it('known codes use their text, unknown ones a generic text with the code', () => {
    const has = (k) => k === 'packs.err.schema';
    expect(errorMessage(new NetError('packs.err.schema', { path: '/a' }), t, has)).toBe('packs.err.schema:{"path":"/a"}');
    expect(errorMessage(new NetError('server.new.code'), t, has)).toBe('net.err.unknown:{"code":"server.new.code"}');
    expect(errorMessage(new Error('boom'), t, has)).toBe('net.err.unknown:{"code":"boom"}');
  });
});
