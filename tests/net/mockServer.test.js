// The mock server is the stand-in for the real server in development and E2E tests: it must follow the contract
// (responses validate against the schemas) and really check PKCE.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startMockServer } from '../../scripts/mock-server.mjs';
import { challengeFor, createVerifier } from '../../src/net/auth.js';
import { validate, validateDef } from '../../src/net/schema.js';
import { schemaOf, fixJson, signIn, GAME } from './helpers.js';

let mock, base;
beforeAll(async () => { mock = await startMockServer(); base = mock.url; });
afterAll(() => mock.close());

describe('fixtures over HTTP', () => {
  it('catalogs and CORS', async () => {
    for (const p of ['/catalog.json', '/static/catalog.json']) {
      const res = await fetch(base + p);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
      expect(validate(schemaOf('catalog'), await res.json())).toEqual([]);
    }
    const pre = await fetch(base + '/api/v1/saves', { method: 'OPTIONS' });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-headers')).toContain('Authorization');
    const cfg = await (await fetch(base + '/kronland.config.json')).json();
    expect(cfg.server).toBe(base);
  });

  it('pack files are served by their names', async () => {
    const pack = await (await fetch(`${base}/static/pack-adventures-2/pack.json`)).json();
    expect((await fetch(`${base}/packs/wi7.adventures-2/${pack.levels[0].file}`)).status).toBe(200);
    expect((await fetch(`${base}/packs/wi7.adventures-2/${Object.keys(pack.media)[0]}`)).headers.get('content-type')).toBe('image/png');
    expect((await fetch(`${base}/static/nope.json`)).status).toBe(404);
  });

  it('the share link redirects into the game', async () => {
    const res = await fetch(`${base}/play/abc`, { redirect: 'manual' });
    expect(res.headers.get('location')).toBe('http://localhost:4173/play/?play=abc');
  });
});

describe('OAuth with PKCE', () => {
  const authorize = async (params) => {
    const verifier = createVerifier();
    const q = new URLSearchParams({ response_type: 'code', client_id: 'kronland-game', redirect_uri: GAME, state: 's1', code_challenge_method: 'S256', code_challenge: await challengeFor(verifier), ...params });
    const form = new URLSearchParams({ decision: 'allow', client_id: q.get('client_id'), redirect_uri: GAME, state: 's1', code_challenge: q.get('code_challenge') });
    const res = await fetch(`${base}/oauth/authorize`, { method: 'POST', body: form, redirect: 'manual' });
    return { verifier, code: new URL(res.headers.get('location')).searchParams.get('code'), res, q };
  };
  const token = (body) => fetch(`${base}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: 'kronland-game', redirect_uri: GAME, ...body }) });

  it('the authorize page insists on S256 and the required parameters', async () => {
    expect((await fetch(`${base}/oauth/authorize?response_type=code&client_id=kronland-game&redirect_uri=${GAME}&state=s&code_challenge=x&code_challenge_method=plain`)).status).toBe(400);
    expect((await fetch(`${base}/oauth/authorize?response_type=code&client_id=kronland-game&redirect_uri=${GAME}`)).status).toBe(400);
  });

  it('a right verifier gets tokens, a wrong one does not; a code works once', async () => {
    const good = await authorize();
    const res = await token({ grant_type: 'authorization_code', code: good.code, code_verifier: good.verifier });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ token_type: 'Bearer', expires_in: 3600 });
    expect((await token({ grant_type: 'authorization_code', code: good.code, code_verifier: good.verifier })).status).toBe(400);

    const other = await authorize();
    const wrong = await token({ grant_type: 'authorization_code', code: other.code, code_verifier: createVerifier() });
    expect(wrong.status).toBe(400);
    expect(await wrong.json()).toEqual({ error: 'invalid_grant' });
    // the code is used up even after a failed try
    expect((await token({ grant_type: 'authorization_code', code: other.code, code_verifier: other.verifier })).status).toBe(400);
  });

  it('wrong redirect address or client is refused; refresh tokens rotate', async () => {
    const a = await authorize();
    expect((await token({ grant_type: 'authorization_code', code: a.code, code_verifier: a.verifier, redirect_uri: 'http://evil.example/' })).status).toBe(400);
    const b = await authorize();
    const first = await (await token({ grant_type: 'authorization_code', code: b.code, code_verifier: b.verifier })).json();
    const second = await (await token({ grant_type: 'refresh_token', refresh_token: first.refresh_token })).json();
    expect(second.access_token).not.toBe(first.access_token);
    expect((await token({ grant_type: 'refresh_token', refresh_token: first.refresh_token })).status).toBe(400);
    expect((await fetch(`${base}/oauth/token`, { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code', client_id: 'other' }) })).status).toBe(400);
  });

  it('deny comes back as error=access_denied with the state', async () => {
    const res = await fetch(`${base}/oauth/authorize`, { method: 'POST', body: new URLSearchParams({ decision: 'deny', redirect_uri: GAME, state: 'zz' }), redirect: 'manual' });
    const to = new URL(res.headers.get('location'));
    expect(to.searchParams.get('error')).toBe('access_denied');
    expect(to.searchParams.get('state')).toBe('zz');
  });
});

describe('API', () => {
  it('everything under /api/v1 needs a token and answers errors in the contract format', async () => {
    const res = await fetch(`${base}/api/v1/me`);
    expect(res.status).toBe(401);
    expect(validate(schemaOf('error'), await res.json())).toEqual([]);
  });

  it('me, packs for me', async () => {
    const { api } = await signIn(base);
    expect(validate(schemaOf('me'), await api.get('/api/v1/me'))).toEqual([]);
    const mine = await api.get('/api/v1/packs');
    expect(validate(schemaOf('catalog'), mine)).toEqual([]);
    expect(mine.packs.find((p) => p.own).manifest).toBe(`${base}/api/v1/packs/k7m2q9/manifest`);
  });

  it('an expired access token is refreshed by the client and the request repeated', async () => {
    const { api } = await signIn(base);
    await fetch(`${base}/mock/revoke`, { method: 'POST' });
    expect((await api.get('/api/v1/me')).displayName).toBe('Löwe 7');
  });

  it('progress: valid events are stored once, invalid ones get 422 in the error format', async () => {
    const { api } = await signIn(base);
    const event = { id: '00000000-0000-4000-8000-000000000001', at: '2026-10-09T14:03:11Z', pack: 'wi7.adventures-2', level: 'r1-2', type: 'run', code: { player: 'x' } };
    await api.post('/api/v1/progress', { events: [event] });
    await api.post('/api/v1/progress', { events: [event] });
    expect((await (await fetch(`${base}/mock/progress`)).json()).events.filter((e) => e.id === event.id)).toHaveLength(1);
    await expect(api.post('/api/v1/progress', { events: [{ ...event, type: 'dance' }] })).rejects.toMatchObject({ status: 422, code: 'net.err.invalid' });
  });

  it('saves: create, list, read, overwrite with If-Match, conflict, delete, signed link', async () => {
    const { api } = await signIn(base);
    const envelope = { ...fixJson('save-s1.json') };
    const created = await api.post('/api/v1/saves', { envelope, id: 'mine1', thumb: 'data:image/png;base64,AAAA' });
    expect(created.id).toBe('mine1');
    expect(validateDef(schemaOf('saves'), 'entry', created)).toEqual([]);
    const list = await api.get('/api/v1/saves');
    expect(validate(schemaOf('saves'), list)).toEqual([]);
    expect(list.saves.map((s) => s.id)).toEqual(expect.arrayContaining(['s1', 's2', 'mine1']));

    const res = await api.send('GET', '/api/v1/saves/mine1');
    expect(res.headers.get('etag')).toBe(`"${created.etag}"`);
    expect((await res.json()).format).toBe('kronland-save');

    const renamed = { ...envelope, meta: { ...envelope.meta, name: 'Neu' } };
    const saved = await api.put('/api/v1/saves/mine1', { envelope: renamed }, { headers: { 'If-Match': `"${created.etag}"` } });
    expect(saved.name).toBe('Neu');
    expect(saved.thumb).toBe('data:image/png;base64,AAAA'); // left out = kept
    await expect(api.put('/api/v1/saves/mine1', { envelope }, { headers: { 'If-Match': `"${created.etag}"` } })).rejects.toMatchObject({ status: 412, code: 'saves.err.conflict' });
    await expect(api.put('/api/v1/saves/mine1', { envelope })).rejects.toMatchObject({ status: 412 });

    // signed link: no token needed, a bad signature is refused
    const { url } = await (await fetch(`${base}/mock/signed/mine1`)).json();
    expect((await fetch(url)).status).toBe(200);
    expect((await fetch(url.replace(/signature=\w+/, 'signature=bad'))).status).toBe(403);
    expect((await fetch(`${base}/api/v1/saves/mine1`)).status).toBe(401);

    expect(await api.del('/api/v1/saves/mine1')).toBeNull();
    await expect(api.get('/api/v1/saves/mine1')).rejects.toMatchObject({ status: 404 });
  });

  it('own packs: media, PUT validated against the document schema, manifest, delete', async () => {
    const { api } = await signIn(base);
    const doc = fixJson('pack-document.json');
    doc.id = 'zz9999';
    await expect(api.put('/api/v1/packs/zz9999', { ...doc, format: 'x' })).rejects.toMatchObject({ status: 422, code: 'packs.err.schema' });
    const form = new FormData();
    form.append('file', new Blob([Buffer.from('png')], { type: 'image/png' }), 'x.png');
    const media = await api.post('/api/v1/packs/zz9999/media', form);
    expect(media.name).toMatch(/^[0-9a-f]{64}\.png$/);
    await api.put('/api/v1/packs/zz9999', { ...doc, media: { [media.name]: { type: 'image/png', bytes: 3 } } });
    const manifest = await (await api.send('GET', '/api/v1/packs/zz9999/manifest')).json();
    expect(validate(schemaOf('pack'), manifest)).toEqual([]);
    expect(manifest.media[media.name].bytes).toBe(3);
    expect((await fetch(`${base}/api/v1/packs/zz9999/manifest`)).status).toBe(401); // private
    await api.del('/api/v1/packs/zz9999');
    await expect(api.get('/api/v1/packs/zz9999')).rejects.toMatchObject({ status: 404 });
    await expect(api.put('/api/v1/packs/zz9998', { ...doc, id: 'zz9998', media: { ['0'.repeat(64) + '.png']: { type: 'image/png', bytes: 3 } } })).rejects.toMatchObject({ code: 'packs.err.media' });
  });
});

describe('token revocation (RFC 7009)', () => {
  const revoke = (params) => fetch(`${base}/oauth/revoke`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
  const tokenOf = async (kv) => kv.get('tokens');

  it('revoking the refresh token ends the whole grant: access token 401, refresh refused', async () => {
    const { kv } = await signIn(base);
    const t = await tokenOf(kv);
    const me = (a) => fetch(`${base}/api/v1/me`, { headers: { Authorization: `Bearer ${a}` } });
    expect((await me(t.access)).status).toBe(200);
    const res = await revoke({ token: t.refresh, token_type_hint: 'refresh_token', client_id: 'kronland-game' });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(mock.state.revoked.at(-1)).toMatchObject({ token: t.refresh, hint: 'refresh_token' });
    expect((await me(t.access)).status).toBe(401);
    const again = await fetch(`${base}/oauth/token`, { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: 'kronland-game' }) });
    expect(again.status).toBe(400);
    expect((await again.json()).error).toBe('invalid_grant');
  });

  it('revoking an access token also ends the grant', async () => {
    const { kv } = await signIn(base);
    const t = await tokenOf(kv);
    expect((await revoke({ token: t.access, token_type_hint: 'access_token', client_id: 'kronland-game' })).status).toBe(200);
    const again = await fetch(`${base}/oauth/token`, { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: 'kronland-game' }) });
    expect(again.status).toBe(400);
  });

  it('other grants stay valid; unknown tokens answer 200', async () => {
    const a = await tokenOf((await signIn(base)).kv), b = await tokenOf((await signIn(base)).kv);
    expect((await revoke({ token: a.refresh, client_id: 'kronland-game' })).status).toBe(200);
    expect((await fetch(`${base}/api/v1/me`, { headers: { Authorization: `Bearer ${b.access}` } })).status).toBe(200);
    const n = mock.state.revoked.length;
    expect((await revoke({ token: 'rt_nope', token_type_hint: 'refresh_token', client_id: 'kronland-game' })).status).toBe(200);
    expect(mock.state.revoked).toHaveLength(n + 1);
  });

  it('errors follow RFC 6749 section 5.2', async () => {
    expect(await (await revoke({ client_id: 'kronland-game' })).json()).toEqual({ error: 'invalid_request' });
    const bad = await revoke({ token: 'x', token_type_hint: 'password', client_id: 'kronland-game' });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'unsupported_token_type' });
    expect((await revoke({ token: 'x', client_id: 'other' })).status).toBe(400);
  });
});

